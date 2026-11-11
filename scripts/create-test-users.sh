#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# scripts/create-test-users.sh - Crea usuarios de prueba en el user pool de Cognito (un usuario por rol)
# y, de forma opcional, exige TOTP a un usuario privilegiado.
#
# Funciona en AWS CloudShell y en Git Bash. Requiere AWS CLI v2 con credenciales temporales ya iniciadas
# (por ejemplo `aws login` o CloudShell); el script nunca solicita ni guarda llaves de acceso.
#
# Uso:
#   scripts/create-test-users.sh [--region REGION] [--stack NOMBRE] \
#       [--donor CORREO] [--donor2 CORREO] [--manager CORREO] [--auditor CORREO] [--prompt-password]
#   scripts/create-test-users.sh [--region REGION] [--stack NOMBRE] --enforce-mfa CORREO
#
# Opciones:
#   --donor CORREO       crea un usuario del grupo DONANTE            (o variable DONOR_EMAIL)
#   --donor2 CORREO      crea un segundo DONANTE (necesario para T09) (o variable DONOR2_EMAIL)
#   --manager CORREO     crea un usuario del grupo GESTOR             (o variable MANAGER_EMAIL)
#   --auditor CORREO     crea un usuario del grupo AUDITOR            (o variable AUDITOR_EMAIL)
#   --enforce-mfa CORREO activa TOTP como segundo factor preferido del usuario (modo independiente; el usuario
#                        debe haber registrado antes una aplicacion autenticadora)
#   --prompt-password    pide por teclado (sin eco) una contrasena temporal y la usa en lugar de la generada por
#                        Cognito. Sin esta opcion Cognito genera la contrasena temporal y la envia por correo.
#   --region REGION      region de la pila y del user pool (por defecto us-east-2)
#   --stack NOMBRE       nombre de la pila (por defecto secure-donations-backend-academic)
#   -h, --help           muestra esta ayuda
#
# Variables opcionales: USER_POOL_ID (omite la consulta a la pila), STACK_NAME.
#
# Seguridad: el script no contiene ni imprime contrasenas. Por defecto no usa --temporary-password ni
# --message-action SUPPRESS, de modo que Cognito envia la contrasena temporal al correo del usuario. Con
# --prompt-password la contrasena se pasa a la AWS CLI como argumento, por lo que es visible en la lista de procesos
# mientras el comando se ejecuta: use esa opcion solo en un equipo propio y para cuentas de prueba.
# Use correos de prueba reales del equipo (por ejemplo con alias +donante); no use datos personales de terceros.
# -----------------------------------------------------------------------------
set -euo pipefail

REGION="us-east-2"
STACK_NAME="${STACK_NAME:-secure-donations-backend-academic}"
DONOR_EMAIL="${DONOR_EMAIL:-}"
DONOR2_EMAIL="${DONOR2_EMAIL:-}"
MANAGER_EMAIL="${MANAGER_EMAIL:-}"
AUDITOR_EMAIL="${AUDITOR_EMAIL:-}"
ENFORCE_MFA_EMAIL=""
PROMPT_PASSWORD=0
USER_POOL_ID="${USER_POOL_ID:-}"

usage() {
  sed -n '3,/^# ----*$/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

need_value() { # opcion valor
  [ -n "${2:-}" ] || die "La opcion $1 requiere un valor. Use --help para ver el uso."
}

while [ $# -gt 0 ]; do
  case "$1" in
    --donor)           need_value "$1" "${2:-}"; DONOR_EMAIL=$2; shift 2 ;;
    --donor2)          need_value "$1" "${2:-}"; DONOR2_EMAIL=$2; shift 2 ;;
    --manager)         need_value "$1" "${2:-}"; MANAGER_EMAIL=$2; shift 2 ;;
    --auditor)         need_value "$1" "${2:-}"; AUDITOR_EMAIL=$2; shift 2 ;;
    --enforce-mfa)     need_value "$1" "${2:-}"; ENFORCE_MFA_EMAIL=$2; shift 2 ;;
    --prompt-password) PROMPT_PASSWORD=1; shift ;;
    --region)          need_value "$1" "${2:-}"; REGION=$2; shift 2 ;;
    --stack)           need_value "$1" "${2:-}"; STACK_NAME=$2; shift 2 ;;
    -h|--help)         usage; exit 0 ;;
    *)                 die "Opcion desconocida: $1. Use --help para ver el uso." ;;
  esac
done

command -v aws >/dev/null 2>&1 || die "No se encontro la AWS CLI. Instale AWS CLI v2 o ejecute el script en AWS CloudShell."

valid_email() {
  case "$1" in
    *" "*|*"	"*) return 1 ;;
  esac
  printf '%s' "$1" | grep -Eq '^[^@]+@[^@]+\.[^@]+$'
}

if [ -z "$ENFORCE_MFA_EMAIL" ] && [ -z "$DONOR_EMAIL$DONOR2_EMAIL$MANAGER_EMAIL$AUDITOR_EMAIL" ]; then
  usage >&2
  die "Indique al menos un usuario (--donor, --donor2, --manager, --auditor) o --enforce-mfa."
fi

for e in "$DONOR_EMAIL" "$DONOR2_EMAIL" "$MANAGER_EMAIL" "$AUDITOR_EMAIL" "$ENFORCE_MFA_EMAIL"; do
  if [ -n "$e" ] && ! valid_email "$e"; then die "Direccion de correo no valida: $e"; fi
done

if [ -n "$ENFORCE_MFA_EMAIL" ] && [ -n "$DONOR_EMAIL$DONOR2_EMAIL$MANAGER_EMAIL$AUDITOR_EMAIL" ]; then
  die "--enforce-mfa es un modo independiente: ejecutelo sin las opciones de creacion de usuarios."
fi

if [ -z "$USER_POOL_ID" ]; then
  printf 'Consultando la salida CognitoUserPoolId de la pila %s (%s)...\n' "$STACK_NAME" "$REGION"
  USER_POOL_ID=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text) \
    || die "No se pudo leer la pila. Verifique la region, el nombre y que la sesion de AWS este activa."
fi
if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
  die "La pila no expone la salida CognitoUserPoolId."
fi

# ------------------------------------------------------------ modo --enforce-mfa
if [ -n "$ENFORCE_MFA_EMAIL" ]; then
  printf 'Activando TOTP como segundo factor preferido para %s...\n' "$ENFORCE_MFA_EMAIL"
  if out=$(aws cognito-idp admin-set-user-mfa-preference --region "$REGION" --user-pool-id "$USER_POOL_ID" \
      --username "$ENFORCE_MFA_EMAIL" --software-token-mfa-settings Enabled=true,PreferredMfa=true 2>&1); then
    printf 'Listo: el usuario debera ingresar un codigo TOTP en cada inicio de sesion.\n'
    printf 'Compruebe el efecto con T14: inicie sesion sin el codigo y verifique que no se emiten tokens.\n'
    exit 0
  fi
  printf '%s\n' "$out" >&2
  printf '\nNo se pudo activar TOTP. La causa habitual es que el usuario aun no registro y verifico una aplicacion\n' >&2
  printf 'autenticadora (ver los pasos al final de la ayuda de creacion de usuarios).\n' >&2
  exit 1
fi

# ------------------------------------------------------------ modo creacion
TEMP_PASSWORD=""
if [ "$PROMPT_PASSWORD" = 1 ]; then
  [ -t 0 ] || die "--prompt-password requiere una terminal interactiva."
  read -r -s -p "Contrasena temporal (no se muestra): " TEMP_PASSWORD; echo
  read -r -s -p "Repita la contrasena: " CONFIRM; echo
  [ "$TEMP_PASSWORD" = "$CONFIRM" ] || die "Las contrasenas no coinciden."
  unset CONFIRM
  [ -n "$TEMP_PASSWORD" ] || die "La contrasena no puede estar vacia."
fi

create_user() { # correo grupo
  local email=$1 group=$2 out
  printf '\n[%s] %s\n' "$group" "$email"

  local args=(cognito-idp admin-create-user --region "$REGION" --user-pool-id "$USER_POOL_ID"
    --username "$email"
    --user-attributes "Name=email,Value=$email" "Name=email_verified,Value=true"
    --desired-delivery-mediums EMAIL)
  if [ -n "$TEMP_PASSWORD" ]; then
    args+=(--temporary-password "$TEMP_PASSWORD" --message-action SUPPRESS)
  fi

  if out=$(aws "${args[@]}" 2>&1); then
    if [ -n "$TEMP_PASSWORD" ]; then
      printf '  usuario creado con la contrasena temporal indicada por el operador (no se envio correo)\n'
    else
      printf '  usuario creado; Cognito envio la contrasena temporal al correo indicado\n'
    fi
  elif printf '%s' "$out" | grep -q 'UsernameExistsException'; then
    printf '  el usuario ya existe; se conserva y solo se verifica su grupo\n'
  else
    printf '%s\n' "$out" >&2
    die "No se pudo crear el usuario $email."
  fi

  aws cognito-idp admin-add-user-to-group --region "$REGION" --user-pool-id "$USER_POOL_ID" \
    --username "$email" --group-name "$group"
  printf '  agregado al grupo %s\n' "$group"
}

[ -z "$DONOR_EMAIL" ]   || create_user "$DONOR_EMAIL" DONANTE
[ -z "$DONOR2_EMAIL" ]  || create_user "$DONOR2_EMAIL" DONANTE
[ -z "$MANAGER_EMAIL" ] || create_user "$MANAGER_EMAIL" GESTOR
[ -z "$AUDITOR_EMAIL" ] || create_user "$AUDITOR_EMAIL" AUDITOR
TEMP_PASSWORD=""

cat <<MENSAJE

Pasos siguientes
  1. Cada usuario inicia sesion en el frontend (URL en la salida FrontendUrl de la pila) con la contrasena temporal
     recibida por correo y define su contrasena definitiva.
  2. Segundo factor (CA-11.1) para GESTOR y AUDITOR. El pool de usuarios tiene MFA opcional con TOTP, por lo que
     el segundo factor se exige por usuario:
       a) El usuario registra una aplicacion autenticadora (TOTP) y verifica el primer codigo. Si la interfaz
          alojada de Cognito no ofrece ese registro con MFA opcional, el usuario puede registrarla con
          'aws cognito-idp associate-software-token' y 'aws cognito-idp verify-software-token', usando su propio
          access token (--access-token); no comparta ese token con terceros.
       b) Un administrador ejecuta, para cada usuario privilegiado:
            scripts/create-test-users.sh --region $REGION --stack $STACK_NAME --enforce-mfa <correo>
          que equivale a:
            aws cognito-idp admin-set-user-mfa-preference --region $REGION --user-pool-id $USER_POOL_ID \\
              --username <correo> --software-token-mfa-settings Enabled=true,PreferredMfa=true
  3. Mientras un usuario privilegiado no tenga TOTP activo, puede iniciar sesion solo con contrasena: confirme el
     paso 2 antes de la demostracion y registre la evidencia de T14.
  4. Para pruebas T09 y T12 necesita dos DONANTE (--donor y --donor2) y un GESTOR (--manager).
MENSAJE
