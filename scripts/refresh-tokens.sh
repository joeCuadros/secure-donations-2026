#!/usr/bin/env bash
# Renueva los tokens de los usuarios de prueba a partir de sus refresh tokens y los exporta
# con los nombres que espera scripts/acceptance.sh.
#
# Los access tokens duran 15 minutos (CA-03.3), poco margen para copiar a mano los de varios
# usuarios. El refresh token dura 1 dia, asi que se copia una sola vez por usuario y este
# script obtiene access tokens nuevos justo antes de ejecutar las pruebas.
#
# Uso (debe cargarse con "source" para que las variables queden en la terminal actual):
#
#   export COGNITO_DOMAIN="<salida CognitoHostedDomain de la pila>"
#   export COGNITO_CLIENT_ID="<salida CognitoUserPoolClientId de la pila>"
#   read -rs DONOR_REFRESH_TOKEN   && export DONOR_REFRESH_TOKEN
#   read -rs DONOR2_REFRESH_TOKEN  && export DONOR2_REFRESH_TOKEN
#   read -rs MANAGER_REFRESH_TOKEN && export MANAGER_REFRESH_TOKEN
#   source scripts/refresh-tokens.sh && bash scripts/acceptance.sh
#
# El refresh token se copia de la respuesta de /oauth2/token en las herramientas de desarrollo
# del navegador (campo "refresh_token"), en la sesion propia de cada usuario de prueba.
# El script nunca imprime tokens. Cerrar sesion en la aplicacion revoca el refresh token.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "ERROR: cargue este script con: source scripts/refresh-tokens.sh" >&2
  exit 2
fi

_rt_fail=0

if [[ -z "${COGNITO_DOMAIN:-}" || -z "${COGNITO_CLIENT_ID:-}" ]]; then
  echo "ERROR: defina COGNITO_DOMAIN y COGNITO_CLIENT_ID (salidas de la pila)." >&2
  _rt_fail=1
fi

_rt_host="${COGNITO_DOMAIN#https://}"
_rt_host="${_rt_host%/}"

# Extrae un campo de texto de una respuesta JSON plana sin depender de jq.
_rt_field() {
  printf '%s' "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

# _rt_refresh <ETIQUETA> <refresh token> <variable access> [variable id]
_rt_refresh() {
  local label="$1" refresh="$2" access_var="$3" id_var="${4:-}" body access id
  # Descarta comillas, comas o espacios copiados por error junto con el token.
  refresh="${refresh//[^A-Za-z0-9._-]/}"
  if [[ -z "$refresh" ]]; then
    echo "$label: sin refresh token, se omite."
    return 0
  fi
  body="$(curl -sS -X POST "https://${_rt_host}/oauth2/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=refresh_token' \
    --data-urlencode "client_id=${COGNITO_CLIENT_ID}" \
    --data-urlencode "refresh_token=${refresh}" 2>/dev/null)"
  access="$(_rt_field "$body" access_token)"
  id="$(_rt_field "$body" id_token)"
  if [[ -z "$access" ]]; then
    echo "$label: ERROR al renovar ($(_rt_field "$body" error)). Copie de nuevo el refresh token." >&2
    _rt_fail=1
    return 0
  fi
  export "$access_var=$access"
  if [[ -n "$id_var" && -n "$id" ]]; then
    export "$id_var=$id"
  fi
  echo "$label: tokens renovados."
}

if [[ "$_rt_fail" -eq 0 ]]; then
  _rt_refresh DONANTE-1 "${DONOR_REFRESH_TOKEN:-}" DONOR_ACCESS_TOKEN DONOR_ID_TOKEN
  _rt_refresh DONANTE-2 "${DONOR2_REFRESH_TOKEN:-}" DONOR2_ACCESS_TOKEN
  _rt_refresh GESTOR "${MANAGER_REFRESH_TOKEN:-}" MANAGER_ACCESS_TOKEN
fi

# Aviso de desfase de reloj: en WSL el reloj puede atrasarse tras suspender el equipo.
_rt_server="$(curl -sI "https://${_rt_host}/" 2>/dev/null | sed -n 's/^[Dd]ate: //p' | tr -d '\r')"
if [[ -n "$_rt_server" ]]; then
  _rt_skew=$(( $(date -u +%s) - $(date -u -d "$_rt_server" +%s 2>/dev/null || date -u +%s) ))
  if [[ "${_rt_skew#-}" -gt 60 ]]; then
    echo "AVISO: el reloj local difiere ${_rt_skew}s del servidor; la vigencia mostrada por otras herramientas puede ser incorrecta." >&2
  fi
fi

_rt_status="$_rt_fail"
unset -f _rt_field _rt_refresh
unset _rt_fail _rt_host _rt_server _rt_skew
return "$_rt_status"
