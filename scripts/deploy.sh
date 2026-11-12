#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# scripts/deploy.sh - Despliegue supervisado de la pila y del frontend desde el commit actual de main.
#
# Por que existe: `sam deploy` empaqueta backend/dist tal como esta en disco. Si no se recompila antes, se publica
# codigo antiguo (incidente del 2026-11-12: GET /v1/projects/drafts respondio 500 por un dist desactualizado).
# Este script siempre recompila desde el commit desplegado y muestra el change set antes de aplicarlo.
#
# No es un despliegue automatico: la politica de la organizacion impide federar GitHub Actions con la cuenta (OIDC),
# de modo que el despliegue lo ejecuta una persona con credenciales temporales (`aws login`), segun design.md §10.
#
# Uso:
#   scripts/deploy.sh [--dry-run] [--yes] [--backend-only | --frontend-only] [--allow-branch]
#
# Opciones:
#   --dry-run        compila y crea el change set, lo muestra y lo elimina; no modifica la pila ni el sitio
#   --yes            no pide confirmacion antes de ejecutar el change set
#   --backend-only   despliega solo la pila (backend e infraestructura)
#   --frontend-only  publica solo el frontend
#   --allow-branch   permite desplegar un commit distinto de origin/main (solo para pruebas del equipo)
#   -h, --help       muestra esta ayuda
#
# Variables opcionales:
#   AWS_CMD, SAM_CMD  ejecutables de AWS CLI y SAM CLI si no estan en el PATH (por ejemplo en Git Bash:
#                     SAM_CMD='cmd //c C:\ruta\sam.cmd')
#   REGION            region de la pila (por defecto us-east-2)
#   STACK_NAME        nombre de la pila (por defecto secure-donations-backend-academic)
#
# Seguridad: el script se detiene si el change set reemplaza o elimina un recurso con datos o identidad (user pool,
# cliente y dominio de Cognito, tablas, policy store, bucket). No lee ni escribe archivos .env ni credenciales.
# -----------------------------------------------------------------------------
set -euo pipefail

REGION="${REGION:-us-east-2}"
STACK_NAME="${STACK_NAME:-secure-donations-backend-academic}"
AWS="${AWS_CMD:-aws}"
SAM="${SAM_CMD:-sam}"
DRY_RUN=0
ASSUME_YES=0
DO_BACKEND=1
DO_FRONTEND=1
ALLOW_BRANCH=0

PROTECTED_TYPES="AWS::Cognito::UserPool AWS::Cognito::UserPoolClient AWS::Cognito::UserPoolDomain \
AWS::DynamoDB::Table AWS::VerifiedPermissions::PolicyStore AWS::S3::Bucket"

usage() { sed -n '3,/^# ----*$/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)       DRY_RUN=1; shift ;;
    --yes)           ASSUME_YES=1; shift ;;
    --backend-only)  DO_FRONTEND=0; shift ;;
    --frontend-only) DO_BACKEND=0; shift ;;
    --allow-branch)  ALLOW_BRANCH=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)               die "Opcion desconocida: $1. Use --help para ver el uso." ;;
  esac
done
[ "$DO_BACKEND$DO_FRONTEND" != "00" ] || die "--backend-only y --frontend-only son excluyentes."

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC2086
aws_() { $AWS "$@"; }
# shellcheck disable=SC2086
sam_() { $SAM "$@"; }

stack_output() { # clave
  aws_ cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text | tr -d '\r'
}

# ------------------------------------------------------------ comprobaciones previas
step "Comprobaciones previas"
aws_ sts get-caller-identity --query Account --output text >/dev/null 2>&1 \
  || die "No hay una sesion de AWS activa. Ejecute 'aws login' y vuelva a intentarlo."

[ -z "$(git status --porcelain --untracked-files=no)" ] \
  || die "Hay cambios sin confirmar en archivos versionados. Confirme o descarte los cambios antes de desplegar."

git fetch --quiet origin main
HEAD_SHA="$(git rev-parse HEAD)"
MAIN_SHA="$(git rev-parse origin/main)"
if [ "$HEAD_SHA" != "$MAIN_SHA" ]; then
  [ "$ALLOW_BRANCH" = 1 ] \
    || die "El commit actual ($(git rev-parse --short HEAD)) no es origin/main ($(git rev-parse --short origin/main)). Ejecute 'git checkout main && git pull' o use --allow-branch."
  printf 'AVISO: se despliega %s, que no es origin/main.\n' "$(git rev-parse --short HEAD)"
fi
printf 'Commit: %s\nPila:   %s (%s)\n' "$(git log -1 --format='%h %s')" "$STACK_NAME" "$REGION"

# ------------------------------------------------------------ backend e infraestructura
if [ "$DO_BACKEND" = 1 ]; then
  step "Backend: instalacion limpia y compilacion"
  (cd backend && npm ci --no-audit --no-fund && npm run typecheck && npm run build)

  step "Infraestructura: validacion y change set"
  cd infra
  sam_ validate --lint --region "$REGION"
  SAM_LOG="$(sam_ deploy --no-execute-changeset --no-fail-on-empty-changeset 2>&1)" \
    || { printf '%s\n' "$SAM_LOG" >&2; die "sam deploy no pudo crear el change set."; }
  cd "$ROOT"
  CHANGE_SET="$(printf '%s' "$SAM_LOG" | tr -d '\r' \
    | grep -o 'arn:aws:cloudformation:[^[:space:]]*changeSet/[^[:space:]]*' | tail -n 1 || true)"

  if [ -z "$CHANGE_SET" ]; then
    printf 'La pila ya coincide con el commit: no hay cambios que aplicar.\n'
  else
    aws_ cloudformation describe-change-set --region "$REGION" --change-set-name "$CHANGE_SET" \
      --query "Changes[].ResourceChange.[Action,Replacement,ResourceType,LogicalResourceId]" --output text \
      | tr -d '\r' | awk '{ printf "  %-8s reemplazo=%-12s %-40s %s\n", $1, $2, $3, $4 }'

    BLOCKED="$(aws_ cloudformation describe-change-set --region "$REGION" --change-set-name "$CHANGE_SET" \
      --query "Changes[?ResourceChange.Replacement=='True' || ResourceChange.Replacement=='Conditional' || ResourceChange.Action=='Remove'].ResourceChange.[ResourceType,LogicalResourceId,Action]" \
      --output text | tr -d '\r' | while read -r type logical action; do
        case " $PROTECTED_TYPES " in *" $type "*) printf '%s %s (%s)\n' "$type" "$logical" "$action" ;; esac
      done)"
    if [ -n "$BLOCKED" ]; then
      aws_ cloudformation delete-change-set --region "$REGION" --change-set-name "$CHANGE_SET"
      printf '%s\n' "$BLOCKED" >&2
      die "El change set reemplazaria o eliminaria recursos con datos o identidad. Se elimino sin ejecutar."
    fi

    if [ "$DRY_RUN" = 1 ]; then
      aws_ cloudformation delete-change-set --region "$REGION" --change-set-name "$CHANGE_SET"
      printf 'Simulacion: el change set se elimino sin ejecutar.\n'
    else
      if [ "$ASSUME_YES" != 1 ]; then
        [ -t 0 ] || die "Sin terminal interactiva: use --yes para confirmar el change set."
        read -r -p "Ejecutar este change set? [s/N] " answer
        case "$answer" in
          s|S|si|SI|y|Y) ;;
          *) aws_ cloudformation delete-change-set --region "$REGION" --change-set-name "$CHANGE_SET"
             die "Despliegue cancelado; el change set se elimino." ;;
        esac
      fi
      step "Infraestructura: ejecucion del change set"
      aws_ cloudformation execute-change-set --region "$REGION" --change-set-name "$CHANGE_SET"
      aws_ cloudformation wait stack-update-complete --region "$REGION" --stack-name "$STACK_NAME" \
        || die "La actualizacion de la pila no termino correctamente. Revise los eventos en CloudFormation."
      printf 'Pila actualizada.\n'
    fi
  fi
fi

# ------------------------------------------------------------ frontend
if [ "$DO_FRONTEND" = 1 ]; then
  step "Frontend: compilacion con las salidas de la pila"
  API_URL="$(stack_output HttpApiEndpoint)"
  POOL_ID="$(stack_output CognitoUserPoolId)"
  CLIENT_ID="$(stack_output CognitoUserPoolClientId)"
  DOMAIN="$(stack_output CognitoHostedDomain)"
  BUCKET="$(stack_output FrontendBucketName)"
  DISTRIBUTION="$(stack_output CloudFrontDistributionId)"
  FRONTEND_URL="$(stack_output FrontendUrl)"
  for value in "$API_URL" "$POOL_ID" "$CLIENT_ID" "$DOMAIN" "$BUCKET" "$DISTRIBUTION"; do
    [ -n "$value" ] && [ "$value" != "None" ] || die "Falta una salida de la pila necesaria para el frontend."
  done

  (cd frontend && npm ci --no-audit --no-fund && npm run lint \
    && VITE_API_URL="$API_URL" VITE_COGNITO_USER_POOL_ID="$POOL_ID" \
       VITE_COGNITO_CLIENT_ID="$CLIENT_ID" VITE_COGNITO_DOMAIN="$DOMAIN" npm run build)

  if [ "$DRY_RUN" = 1 ]; then
    printf 'Simulacion: el frontend se compilo pero no se publico.\n'
  else
    step "Frontend: publicacion"
    aws_ s3 sync frontend/dist "s3://$BUCKET" --delete --region "$REGION" --only-show-errors
    MSYS_NO_PATHCONV=1 aws_ cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" \
      --query "Invalidation.Id" --output text
    printf 'Frontend publicado en %s\n' "$FRONTEND_URL"
  fi
fi

# ------------------------------------------------------------ verificacion
if [ "$DRY_RUN" != 1 ]; then
  step "Verificacion"
  API_URL="${API_URL:-$(stack_output HttpApiEndpoint)}"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/v1/projects")"
  [ "$code" = "200" ] || die "GET /v1/projects respondio $code (se esperaba 200)."
  code="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/v1/projects/drafts")"
  [ "$code" = "401" ] || die "GET /v1/projects/drafts sin token respondio $code (se esperaba 401)."
  printf 'API en linea: catalogo 200 y ruta protegida 401 sin token.\n'
  printf 'Las pruebas autenticadas se ejecutan con scripts/acceptance.sh.\n'
fi

printf '\nListo: %s\n' "$(git rev-parse --short HEAD)"
