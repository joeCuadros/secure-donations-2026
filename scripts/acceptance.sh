#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# scripts/acceptance.sh - Pruebas de aceptacion T01-T12 contra la API desplegada.
#
# Requisitos: bash y curl. jq es opcional (si no esta, se usan sed/grep sobre el JSON compacto de la API).
#
# Uso:
#   export API_URL="https://<api-id>.execute-api.us-east-2.amazonaws.com/academic"   # salida HttpApiEndpoint
#   export DONOR_ACCESS_TOKEN=...      # access token de un usuario del grupo DONANTE
#   export DONOR_ID_TOKEN=...          # ID token de ese mismo usuario (solo para T11)
#   export DONOR2_ACCESS_TOKEN=...     # access token de un SEGUNDO usuario DONANTE (T09)
#   export MANAGER_ACCESS_TOKEN=...    # access token de un usuario del grupo GESTOR (T12 y preparacion)
#   export PROJECT_ID=...              # opcional: proyecto PUBLICADO ya existente para donar
#   bash scripts/acceptance.sh
#
# Comportamiento:
#   - Las pruebas cuyo token no esta definido se informan como SKIPPED; nunca se cuentan como superadas.
#   - Sin PROJECT_ID, si hay MANAGER_ACCESS_TOKEN el script crea y publica un proyecto de prueba
#     (queda en la base de datos del despliegue hasta ejecutar `sam delete`). Sin ambos, T05-T09 quedan SKIPPED.
#   - Los tokens solo se leen de variables de entorno, no se imprimen y se pasan a curl mediante un archivo de
#     cabeceras temporal (permisos 600) para que no aparezcan en la lista de procesos. El script no usa `set -x`.
#   - T10, T13 y T14 no se pueden automatizar solo con curl: se imprime el procedimiento manual y se informan
#     como SKIPPED (manual). Su evidencia debe registrarse en evidence/.
#   - Codigo de salida: 0 si no hay FAIL; 1 si alguna prueba FALLA; 2 si falta configuracion o falla la preparacion.
#
# Como obtener los tokens (sin automatizar el ingreso de credenciales):
#   Los tokens de la SPA viven solo en memoria, por lo que no se pueden leer de localStorage. Hay dos formas seguras;
#   en ambas la contrasena (y el codigo TOTP del gestor) los escribe una persona en el navegador.
#
#   A) Interfaz alojada de Cognito, flujo Authorization Code + PKCE hecho a mano:
#        DOMAIN="<CognitoHostedDomain>"          # salida de la pila, sin https://
#        CLIENT_ID="<CognitoUserPoolClientId>"   # salida de la pila
#        REDIRECT="http://localhost:5173/callback"   # URL de retorno registrada en el app client
#        VERIFIER=$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)
#        CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '=')
#        # 1. Abra en el navegador (inicie sesion como el usuario de prueba):
#        #    https://$DOMAIN/oauth2/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT
#        #      &scope=openid+email+api/projects.write+api/donations.write+api/donations.read+api/audit.read
#        #      &code_challenge=$CHALLENGE&code_challenge_method=S256
#        # 2. Cognito redirige a $REDIRECT?code=...; copie el valor de `code` de la barra de direcciones
#        #    (la pagina puede no cargar si no hay servidor local: no importa).
#        # 3. Intercambie el codigo (el codigo es de un solo uso):
#        read -rs -p "code: " CODE; echo
#        curl -s -X POST "https://$DOMAIN/oauth2/token" \
#          -d grant_type=authorization_code -d client_id="$CLIENT_ID" \
#          -d code="$CODE" -d redirect_uri="$REDIRECT" -d code_verifier="$VERIFIER"
#        # La respuesta contiene access_token, id_token y refresh_token. Asigne access_token e id_token a las
#        # variables de entorno (por ejemplo con `read -rs DONOR_ACCESS_TOKEN`) sin dejarlos en el historial.
#
#   B) Sesion propia en la SPA: inicie sesion en el frontend, abra las herramientas de desarrollo del navegador,
#      pestana Red, seleccione cualquier solicitud a la API y copie el valor de la cabecera Authorization
#      (sin la palabra Bearer). Solo sirve para el access token de su propia sesion.
#
#   El access token vence a los 15 minutos: obtenga los tokens justo antes de ejecutar el script.
#
# Nota sobre T11 (ID token): el requisito CA-03.2 espera 401. Un ID token tiene firma y emisor validos, de modo que
# el rechazo ocurre al exigir el scope de la ruta y API Gateway puede responder 401 o 403. La prueba exige que se
# rechace (401 o 403, nunca 2xx) y muestra el codigo observado para registrarlo en la evidencia.
# -----------------------------------------------------------------------------
set -u -o pipefail

PARALLEL=10

usage() {
  sed -n '3,/^# ----*$/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac

die() { printf 'ERROR: %s\n' "$*" >&2; exit 2; }

command -v curl >/dev/null 2>&1 || die "curl no esta instalado."
[ -n "${API_URL:-}" ] || die "Defina API_URL (salida HttpApiEndpoint de la pila). Use --help para ver el uso."
API_URL="${API_URL%/}"
case "$API_URL" in
  https://*) ;;
  *) printf 'AVISO: API_URL no usa HTTPS (%s).\n' "${API_URL%%/*}" >&2 ;;
esac

HAVE_JQ=0
command -v jq >/dev/null 2>&1 && HAVE_JQ=1

umask 077
WORK=$(mktemp -d 2>/dev/null) || die "No se pudo crear un directorio temporal."
trap 'rm -rf "$WORK"' EXIT

DONOR_ACCESS_TOKEN="${DONOR_ACCESS_TOKEN:-}"
DONOR_ID_TOKEN="${DONOR_ID_TOKEN:-}"
DONOR2_ACCESS_TOKEN="${DONOR2_ACCESS_TOKEN:-}"
MANAGER_ACCESS_TOKEN="${MANAGER_ACCESS_TOKEN:-}"
PROJECT_ID="${PROJECT_ID:-}"

# ---------------------------------------------------------------- utilidades

new_uuid() {
  if [ -r /proc/sys/kernel/random/uuid ]; then
    tr 'A-Z' 'a-z' < /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr 'A-Z' 'a-z'
  else
    local h
    h=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
    printf '%s-%s-4%s-%x%s-%s\n' "${h:0:8}" "${h:8:4}" "${h:13:3}" $(( (0x${h:16:1} & 3) | 8 )) "${h:17:3}" "${h:20:12}"
  fi
}

# Campo escalar de primer nivel de un objeto JSON compacto (cadena o numero).
json_field() {
  if [ "$HAVE_JQ" = 1 ]; then
    printf '%s' "$1" | jq -r --arg k "$2" 'if type=="object" and has($k) and (.[$k]|type)!="null" then .[$k]|tostring else empty end' 2>/dev/null
  else
    printf '%s' "$1" | sed -n -E 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*("([^"\\]*)"|(-?[0-9]+(\.[0-9]+)?)).*/\2\3/p' | head -n1
  fi
}

# Campo de un elemento de `items` identificado por donationId (elementos planos de la API).
item_field() { # json donationId field
  if [ "$HAVE_JQ" = 1 ]; then
    printf '%s' "$1" | jq -r --arg id "$2" --arg f "$3" '.items[]? | select(.donationId==$id) | .[$f] | tostring' 2>/dev/null | head -n1
  else
    printf '%s' "$1" | grep -o '{[^{}]*"donationId":"'"$2"'"[^{}]*}' | head -n1 \
      | sed -n -E 's/.*"'"$3"'":("([^"]*)"|(-?[0-9]+)).*/\2\3/p'
  fi
}

count_occurrences() { # texto patron-literal
  printf '%s' "$1" | grep -o "$2" | wc -l | tr -d ' '
}

tamper_token() {
  local t=$1 head sig c n
  head=${t%.*}
  sig=${t##*.}
  c=${sig:0:1}
  if [ "$c" = "A" ]; then n=B; else n=A; fi
  printf '%s.%s%s' "$head" "$n" "${sig:1}"
}

HTTP_STATUS=""
HTTP_BODY=""

# call METHOD RUTA [TOKEN] [CUERPO] [CABECERA-EXTRA]
call() {
  local method=$1 path=$2 token=${3:-} body=${4:-} extra=${5:-}
  local args=(-sS --max-time 30 -o "$WORK/body" -w '%{http_code}' -X "$method")
  rm -f "$WORK/body"
  if [ -n "$token" ]; then
    printf 'Authorization: Bearer %s\n' "$token" > "$WORK/hdr"
    args+=(-H "@$WORK/hdr")
  fi
  if [ -n "$extra" ]; then args+=(-H "$extra"); fi
  if [ -n "$body" ]; then args+=(-H 'Content-Type: application/json' --data-binary "$body"); fi
  HTTP_STATUS=$(curl "${args[@]}" "$API_URL$path" 2>"$WORK/err") || HTTP_STATUS=000
  HTTP_BODY=$(cat "$WORK/body" 2>/dev/null || true)
}

short_body() { printf '%s' "$HTTP_BODY" | tr -d '\r\n' | cut -c1-160; }

donation_body() { # projectId amountCents
  printf '{"projectId":"%s","amountCents":%s}' "$1" "$2"
}

# ---------------------------------------------------------------- resultados

CA_IDS=("" "CA-01.1, CA-01.2" "CA-03.2" "CA-04.1" "CA-05.2" "CA-05.1" "CA-05.4" "CA-05.4" \
        "CA-06.2, CA-NF04.1" "CA-07.2" "CA-NF03.1" "CA-03.2, CA-NF02.1" "CA-04.2" "CA-03.4" "CA-11.2")
RES_STATUS=()
RES_DETAIL=()
for i in $(seq 1 14); do RES_STATUS[$i]="SKIPPED"; RES_DETAIL[$i]="no ejecutada"; done

set_result() { # n estado detalle
  RES_STATUS[$1]=$2
  RES_DETAIL[$1]=$3
}

skip() { set_result "$1" SKIPPED "$2"; }

# ---------------------------------------------------------------- preparacion

DRAFT_ID=""
if [ -z "$PROJECT_ID" ] && [ -n "$MANAGER_ACCESS_TOKEN" ]; then
  printf 'Preparacion: creando proyecto de prueba como GESTOR...\n'
  call POST /v1/projects "$MANAGER_ACCESS_TOKEN" \
    '{"title":"Proyecto de aceptacion","description":"Proyecto creado por scripts/acceptance.sh para las pruebas T01-T12","purpose":"Pruebas","goalAmountCents":1000000}'
  [ "$HTTP_STATUS" = 201 ] || die "No se pudo crear el proyecto de prueba (HTTP $HTTP_STATUS): $(short_body). Verifique MANAGER_ACCESS_TOKEN (vigencia 15 min, grupo GESTOR)."
  DRAFT_ID=$(json_field "$HTTP_BODY" projectId)
  [ -n "$DRAFT_ID" ] || die "La respuesta de creacion no incluye projectId."
fi

# ---------------------------------------------------------------- T01
run_t01() {
  call GET /v1/projects
  if [ "$HTTP_STATUS" != 200 ]; then set_result 1 FAIL "esperado 200, obtenido $HTTP_STATUS: $(short_body)"; return; fi
  if printf '%s' "$HTTP_BODY" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"BORRADOR"'; then
    set_result 1 FAIL "el catalogo contiene un proyecto en BORRADOR"; return
  fi
  local extra=""
  if [ -n "$DRAFT_ID" ]; then
    if printf '%s' "$HTTP_BODY" | grep -q "\"$DRAFT_ID\""; then
      set_result 1 FAIL "el BORRADOR $DRAFT_ID aparece en el catalogo"; return
    fi
    call GET "/v1/projects/$DRAFT_ID"
    if [ "$HTTP_STATUS" != 404 ]; then
      set_result 1 FAIL "el BORRADOR es visible por id (HTTP $HTTP_STATUS, esperado 404)"; return
    fi
    extra="; borrador ausente del catalogo y 404 por id"
  fi
  set_result 1 PASS "200 sin proyectos BORRADOR$extra"
}

publish_draft() {
  [ -n "$DRAFT_ID" ] || return 0
  call PATCH "/v1/projects/$DRAFT_ID/publish" "$MANAGER_ACCESS_TOKEN"
  [ "$HTTP_STATUS" = 200 ] || die "No se pudo publicar el proyecto de prueba (HTTP $HTTP_STATUS): $(short_body)"
  PROJECT_ID=$DRAFT_ID
}

# ---------------------------------------------------------------- T02
run_t02() {
  call POST /v1/donations "" "$(donation_body prj_sin_token 2500)" "Idempotency-Key: $(new_uuid)"
  if [ "$HTTP_STATUS" = 401 ]; then set_result 2 PASS "401 sin token: $(short_body)"
  else set_result 2 FAIL "esperado 401, obtenido $HTTP_STATUS: $(short_body)"; fi
}

# ---------------------------------------------------------------- T03
run_t03() {
  [ -n "$DONOR_ACCESS_TOKEN" ] || { skip 3 "falta DONOR_ACCESS_TOKEN"; return; }
  call POST /v1/projects "$DONOR_ACCESS_TOKEN" \
    '{"title":"Intento de donante","description":"Un donante no debe poder crear proyectos","purpose":"Prueba","goalAmountCents":100000}'
  if [ "$HTTP_STATUS" = 403 ]; then set_result 3 PASS "403 para DONANTE: $(short_body)"
  else set_result 3 FAIL "esperado 403, obtenido $HTTP_STATUS: $(short_body)"; fi
}

# ---------------------------------------------------------------- T04
run_t04() {
  [ -n "$DONOR_ACCESS_TOKEN" ] || { skip 4 "falta DONOR_ACCESS_TOKEN"; return; }
  local pid=${PROJECT_ID:-prj_validacion} bad="" amount body
  for amount in 0 100001 12.5 '"2500"'; do
    body=$(donation_body "$pid" "$amount")
    call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$body" "Idempotency-Key: $(new_uuid)"
    [ "$HTTP_STATUS" = 400 ] || bad="$bad amountCents=$amount->$HTTP_STATUS"
  done
  # Sin Idempotency-Key tambien debe responder 400 (CA-05.2).
  call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$(donation_body "$pid" 2500)"
  [ "$HTTP_STATUS" = 400 ] || bad="$bad sin-Idempotency-Key->$HTTP_STATUS"
  if [ -z "$bad" ]; then set_result 4 PASS "400 para 0, 100001, 12.5, \"2500\" y ausencia de Idempotency-Key"
  else set_result 4 FAIL "respuestas inesperadas:$bad"; fi
}

# ---------------------------------------------------------------- T05 / T06 / T07
D1_ID=""; D1_KEY=""; D1_AMOUNT=2500; HISTORY_BEFORE=""

history_count() { # imprime N o "?" si hay mas de una pagina
  call GET "/v1/donations/me?limit=100" "$DONOR_ACCESS_TOKEN"
  if [ "$HTTP_STATUS" != 200 ]; then printf '?'; return; fi
  if ! printf '%s' "$HTTP_BODY" | grep -q '"nextToken":null'; then printf '?'; return; fi
  count_occurrences "$HTTP_BODY" '"donationId"'
}

run_t05() {
  [ -n "$DONOR_ACCESS_TOKEN" ] || { skip 5 "falta DONOR_ACCESS_TOKEN"; return; }
  [ -n "$PROJECT_ID" ] || { skip 5 "sin proyecto publicado (defina PROJECT_ID o MANAGER_ACCESS_TOKEN)"; return; }
  HISTORY_BEFORE=$(history_count)
  D1_KEY=$(new_uuid)
  call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$(donation_body "$PROJECT_ID" $D1_AMOUNT)" "Idempotency-Key: $D1_KEY"
  if [ "$HTTP_STATUS" != 201 ]; then set_result 5 FAIL "esperado 201, obtenido $HTTP_STATUS: $(short_body)"; D1_KEY=""; return; fi
  D1_ID=$(json_field "$HTTP_BODY" donationId)
  local st; st=$(json_field "$HTTP_BODY" status)
  if [ -n "$D1_ID" ] && [ "$st" = PENDIENTE_SIMULACION ]; then
    set_result 5 PASS "201, $D1_ID en PENDIENTE_SIMULACION (simulada, sin cobro)"
  else
    set_result 5 FAIL "201 pero estado '$st' (esperado PENDIENTE_SIMULACION): $(short_body)"; D1_ID=""
  fi
}

run_t06() {
  if [ -z "$D1_ID" ]; then skip 6 "depende de T05 (donacion no creada)"; return; fi
  call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$(donation_body "$PROJECT_ID" $D1_AMOUNT)" "Idempotency-Key: $D1_KEY"
  if [ "$HTTP_STATUS" != 201 ]; then set_result 6 FAIL "la repeticion devolvio $HTTP_STATUS (esperado 201 con la respuesta almacenada): $(short_body)"; return; fi
  local again; again=$(json_field "$HTTP_BODY" donationId)
  if [ "$again" != "$D1_ID" ]; then set_result 6 FAIL "donationId distinto en la repeticion ($again vs $D1_ID)"; return; fi
  local after; after=$(history_count)
  if [ "$HISTORY_BEFORE" = "?" ] || [ "$after" = "?" ]; then
    set_result 6 PASS "mismo donationId y misma respuesta; conteo de historial no comprobable (mas de una pagina)"
  elif [ "$after" -eq $(( HISTORY_BEFORE + 1 )) ]; then
    set_result 6 PASS "mismo donationId; el historial crecio en exactamente 1 ($HISTORY_BEFORE -> $after)"
  else
    set_result 6 FAIL "el historial paso de $HISTORY_BEFORE a $after (esperado +1)"
  fi
}

run_t07() {
  if [ -z "$D1_ID" ]; then skip 7 "depende de T05 (donacion no creada)"; return; fi
  call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$(donation_body "$PROJECT_ID" 2600)" "Idempotency-Key: $D1_KEY"
  if [ "$HTTP_STATUS" = 409 ]; then set_result 7 PASS "409 al reutilizar la clave con otro importe: $(short_body)"
  else set_result 7 FAIL "esperado 409, obtenido $HTTP_STATUS: $(short_body)"; fi
}

# ---------------------------------------------------------------- T08
stats_confirmed() { # imprime confirmedAmountCents o vacio
  call GET "/v1/projects/$PROJECT_ID/stats"
  [ "$HTTP_STATUS" = 200 ] && json_field "$HTTP_BODY" confirmedAmountCents
}

run_t08() {
  [ -n "$DONOR_ACCESS_TOKEN" ] || { skip 8 "falta DONOR_ACCESS_TOKEN"; return; }
  [ -n "$PROJECT_ID" ] || { skip 8 "sin proyecto publicado (defina PROJECT_ID o MANAGER_ACCESS_TOKEN)"; return; }
  local amount=1000 key id before after i c ok=0 conflict=0 other=""
  key=$(new_uuid)
  call POST /v1/donations "$DONOR_ACCESS_TOKEN" "$(donation_body "$PROJECT_ID" $amount)" "Idempotency-Key: $key"
  if [ "$HTTP_STATUS" != 201 ]; then set_result 8 FAIL "no se pudo crear la donacion de prueba (HTTP $HTTP_STATUS): $(short_body)"; return; fi
  id=$(json_field "$HTTP_BODY" donationId)
  before=$(stats_confirmed)
  [ -n "$before" ] || { set_result 8 FAIL "no se pudo leer el acumulado previo de /v1/projects/$PROJECT_ID/stats"; return; }

  # Deja que se rellene el cubo de limitacion del stage (10 solicitudes/s, rafaga de 20) antes de la rafaga.
  sleep 2
  printf 'Authorization: Bearer %s\n' "$DONOR_ACCESS_TOKEN" > "$WORK/hdr_par"
  rm -f "$WORK"/par_*
  for i in $(seq 1 "$PARALLEL"); do
    ( curl -sS --max-time 30 -o /dev/null -w '%{http_code}' -X POST \
        -H "@$WORK/hdr_par" -H 'Content-Type: application/json' \
        --data-binary '{"result":"CONFIRMADA_SIMULADA"}' \
        "$API_URL/v1/donations/$id/simulate" > "$WORK/par_$i" 2>/dev/null || printf '000' > "$WORK/par_$i" ) &
  done
  wait
  for i in $(seq 1 "$PARALLEL"); do
    c=$(cat "$WORK/par_$i" 2>/dev/null || printf '000')
    case "$c" in
      200) ok=$(( ok + 1 )) ;;
      409) conflict=$(( conflict + 1 )) ;;
      *) other="$other $c" ;;
    esac
  done
  after=$(stats_confirmed)
  local delta="?"
  [ -n "$after" ] && delta=$(( after - before ))

  if [ "$ok" -eq 1 ] && [ "$conflict" -eq $(( PARALLEL - 1 )) ] && [ "$delta" = "$amount" ]; then
    set_result 8 PASS "$PARALLEL solicitudes paralelas: 1x200 y $conflict x409; acumulado +$delta (un solo incremento)"
  else
    set_result 8 FAIL "200=$ok 409=$conflict otros=[${other# }]; incremento del acumulado=$delta (esperado $amount). Si hay 429, repita la prueba"
  fi
}

# ---------------------------------------------------------------- T09
run_t09() {
  [ -n "$DONOR2_ACCESS_TOKEN" ] || { skip 9 "falta DONOR2_ACCESS_TOKEN"; return; }
  if [ -z "$D1_ID" ]; then skip 9 "depende de T05 (no hay donacion ajena que consultar)"; return; fi
  # La API no ofrece GET por id de donacion: la unica operacion por id es la simulacion, que tambien debe
  # respetar la propiedad (BOLA). El historial de otro usuario no es consultable por diseno (solo /me).
  call POST "/v1/donations/$D1_ID/simulate" "$DONOR2_ACCESS_TOKEN" '{"result":"CONFIRMADA_SIMULADA"}'
  if [ "$HTTP_STATUS" != 403 ] && [ "$HTTP_STATUS" != 404 ]; then
    set_result 9 FAIL "esperado 403/404, obtenido $HTTP_STATUS: $(short_body)"; return
  fi
  if printf '%s' "$HTTP_BODY" | grep -Eq 'amountCents|donorSub|PENDIENTE_SIMULACION'; then
    set_result 9 FAIL "la respuesta $HTTP_STATUS filtra datos de la donacion ajena"; return
  fi
  local code=$HTTP_STATUS
  call GET "/v1/donations/me?limit=100" "$DONOR_ACCESS_TOKEN"
  local st; st=$(item_field "$HTTP_BODY" "$D1_ID" status)
  if [ "$st" = PENDIENTE_SIMULACION ]; then
    set_result 9 PASS "$code sin filtracion; la donacion del propietario sigue en PENDIENTE_SIMULACION"
  else
    set_result 9 FAIL "tras el intento ajeno la donacion esta en '$st' (esperado PENDIENTE_SIMULACION)"
  fi
}

# ---------------------------------------------------------------- T11
run_t11() {
  local problems="" notes=""
  if [ -z "$DONOR_ACCESS_TOKEN" ] && [ -z "$DONOR_ID_TOKEN" ]; then skip 11 "faltan DONOR_ACCESS_TOKEN y DONOR_ID_TOKEN"; return; fi
  if [ -n "$DONOR_ID_TOKEN" ]; then
    call GET /v1/donations/me "$DONOR_ID_TOKEN"
    case "$HTTP_STATUS" in
      401|403) notes="ID token rechazado con $HTTP_STATUS" ;;
      *) problems="ID token aceptado o respuesta inesperada ($HTTP_STATUS)" ;;
    esac
  else
    notes="mitad ID token omitida (falta DONOR_ID_TOKEN)"
  fi
  if [ -n "$DONOR_ACCESS_TOKEN" ]; then
    call GET /v1/donations/me "$(tamper_token "$DONOR_ACCESS_TOKEN")"
    if [ "$HTTP_STATUS" = 401 ]; then notes="$notes; token alterado rechazado con 401"
    else problems="$problems token alterado -> $HTTP_STATUS (esperado 401)"; fi
  else
    notes="$notes; mitad token alterado omitida (falta DONOR_ACCESS_TOKEN)"
  fi
  if [ -n "$problems" ]; then set_result 11 FAIL "${problems# }"
  elif [ -z "$DONOR_ID_TOKEN" ] || [ -z "$DONOR_ACCESS_TOKEN" ]; then set_result 11 PASS "parcial: ${notes#; }"
  else set_result 11 PASS "$notes"; fi
}

# ---------------------------------------------------------------- T12
run_t12() {
  [ -n "$MANAGER_ACCESS_TOKEN" ] || { skip 12 "falta MANAGER_ACCESS_TOKEN"; return; }
  call GET /v1/donations/me "$MANAGER_ACCESS_TOKEN"
  if [ "$HTTP_STATUS" != 403 ] && [ "$HTTP_STATUS" != 404 ]; then
    set_result 12 FAIL "esperado 403/404, obtenido $HTTP_STATUS: $(short_body)"; return
  fi
  if printf '%s' "$HTTP_BODY" | grep -q 'donationId'; then
    set_result 12 FAIL "la respuesta $HTTP_STATUS contiene datos de donaciones"; return
  fi
  set_result 12 PASS "$HTTP_STATUS para GESTOR sin datos de donaciones"
}

# ---------------------------------------------------------------- ejecucion

run_t01
publish_draft
run_t02
run_t03
run_t04
run_t05
run_t06
run_t07
run_t08
run_t09
skip 10 "manual (ver procedimiento al final)"
run_t11
run_t12
skip 13 "manual (ver procedimiento al final)"
skip 14 "manual (ver procedimiento al final)"

# ---------------------------------------------------------------- informe

printf '\n%-5s %-8s %-20s %s\n' "ID" "ESTADO" "TRAZABILIDAD" "DETALLE"
printf '%-5s %-8s %-20s %s\n' "-----" "--------" "--------------------" "-------"
pass=0; fail=0; skipped=0
for i in $(seq 1 14); do
  printf 'T%02d   %-8s %-20s %s\n' "$i" "${RES_STATUS[$i]}" "${CA_IDS[$i]}" "${RES_DETAIL[$i]}"
  case "${RES_STATUS[$i]}" in
    PASS) pass=$(( pass + 1 )) ;;
    FAIL) fail=$(( fail + 1 )) ;;
    *) skipped=$(( skipped + 1 )) ;;
  esac
done
printf '\nResumen: %d PASS, %d FAIL, %d SKIPPED. Una prueba SKIPPED no esta superada.\n' "$pass" "$fail" "$skipped"
if [ "$fail" -gt 0 ]; then
  printf 'Nota: un 401 inesperado en una prueba con token suele indicar que el access token vencio (vigencia de 15 minutos).
'
fi
if [ -n "$DRAFT_ID" ]; then
  printf 'Se creo y publico el proyecto de prueba %s (se elimina con `sam delete`).\n' "$DRAFT_ID"
fi

cat <<'MANUAL'

Procedimientos manuales (no automatizables solo con curl)

T10 (CA-NF03.1) - La funcion de listado no puede escribir en DynamoDB.
  Opcion A, IAM Policy Simulator (consola de IAM) con el rol de ListProjectsFunction.
  Opcion B, con la CLI (solo lectura y simulacion, no modifica nada):
    FN=$(aws cloudformation describe-stack-resource --region us-east-2 \
      --stack-name secure-donations-backend-academic --logical-resource-id ListProjectsFunction \
      --query StackResourceDetail.PhysicalResourceId --output text)
    ROLE_ARN=$(aws lambda get-function-configuration --region us-east-2 --function-name "$FN" \
      --query Role --output text)
    aws iam simulate-principal-policy --policy-source-arn "$ROLE_ARN" \
      --action-names dynamodb:PutItem dynamodb:UpdateItem dynamodb:DeleteItem \
      --resource-arns arn:aws:dynamodb:us-east-2:<account-id>:table/Projects-academic \
      --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
  Esperado: implicitDeny para las tres acciones de escritura. Repita con la accion dynamodb:Query sobre
  .../table/Projects-academic/index/status-createdAt (esperado: allowed) y sobre la tabla (implicitDeny).

T13 (CA-03.4) - Token revocado aceptado hasta expirar.
  1. Obtenga access token y refresh token (opcion A de la cabecera de este script).
  2. GET /v1/donations/me con el access token: 200.
  3. Revoque el refresh token: curl -s -X POST "https://<CognitoHostedDomain>/oauth2/revoke" \
       -d client_id=<CognitoUserPoolClientId> -d token=<refresh_token>
  4. Repita el paso 2 con el MISMO access token antes de que venza (15 min): se espera 200 (limitacion documentada,
     el JWT authorizer valida firma y expiracion localmente).
  5. Repita pasados 15 minutos: se espera 401. Registre las horas UTC de cada llamada.

T14 (CA-11.2) - GESTOR sin segundo factor no obtiene tokens.
  1. Con un GESTOR que ya registro su autenticador (el pool exige MFA TOTP a todos los usuarios), abra la
     interfaz alojada de Cognito, ingrese correo y contrasena y NO ingrese el codigo TOTP.
  2. Compruebe que Cognito no redirige a la URL de retorno con un `code` y que no se emiten tokens.
  3. Capture la pantalla del desafio de codigo (sin datos personales) y guardela en evidence/.
MANUAL

[ "$fail" -eq 0 ] || exit 1
exit 0
