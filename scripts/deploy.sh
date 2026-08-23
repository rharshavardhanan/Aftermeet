#!/usr/bin/env bash
# Aftermeet — provision Supabase, deploy the API to Render and the web app to
# Vercel, and wire the three together.
#
#   set -a; source scripts/deploy-vars.sh; set +a
#   ./scripts/deploy.sh
#
# Re-runnable. Existing resources are reused, not duplicated. Reads every
# credential from the environment and writes none of them to disk.
#
# One step it cannot do: creating the Google OAuth client. Google gates OAuth
# consent configuration behind its console. The script prints the exact
# redirect URI to paste in once Vercel has assigned a URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.deploy-state.json"

SUPABASE_REGION="${SUPABASE_REGION:-us-west-1}"
RENDER_REGION="${RENDER_REGION:-oregon}"
RENDER_PLAN="${RENDER_PLAN:-free}"
RENDER_SERVICE_NAME="${RENDER_SERVICE_NAME:-aftermeet-api}"
VERCEL_PROJECT="${VERCEL_PROJECT:-aftermeet}"
GIT_REPO="${GIT_REPO:-https://github.com/rharshavardhanan/Aftermeet}"
GIT_BRANCH="${GIT_BRANCH:-main}"

RENDER_API="https://api.render.com/v1"
SUPABASE_API="https://api.supabase.com/v1"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

# Persist only non-secret identifiers, so a re-run is cheap and nothing
# sensitive lands on disk.
save_state() {
  jq -n --arg ref "${SUPABASE_PROJECT_REF:-}" \
    --arg svc "${RENDER_SERVICE_ID:-}" \
    --arg api "${API_URL:-}" \
    --arg web "${WEB_URL:-}" \
    '{supabaseRef:$ref, renderServiceId:$svc, apiUrl:$api, webUrl:$web}' >"$STATE"
}

render_api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" "$RENDER_API$path"
    -H "Authorization: Bearer $RENDER_API_KEY"
    -H "Accept: application/json")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}"
}

supabase_cli() { npx --yes supabase@2 "$@"; }
vercel_cli() { npx --yes vercel@59 "$@" --token "$VERCEL_TOKEN"; }

# ── 1. Preflight ──────────────────────────────────────────────────────────────
step "Preflight"

missing=()
for v in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD RENDER_API_KEY \
  VERCEL_TOKEN GROQ_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  [ -z "${!v:-}" ] && missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  printf '\n\033[31m✗ Missing required variables:\033[0m\n' >&2
  printf '    %s\n' "${missing[@]}" >&2
  printf '\n  Copy scripts/deploy-vars.example.sh to scripts/deploy-vars.sh,\n' >&2
  printf '  fill it in, then:  set -a; source scripts/deploy-vars.sh; set +a\n\n' >&2
  exit 1
fi

for c in jq curl node npx psql; do
  command -v "$c" >/dev/null || die "$c is required but not installed."
done
info "credentials present, tooling available"

# Stable across re-runs only if the operator pins them; otherwise regenerated,
# which invalidates existing tokens and sessions.
if [ -z "${API_JWT_SECRET:-}" ]; then
  API_JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')"
  warn "generated a new API_JWT_SECRET — pin it in deploy-vars.sh to keep it stable"
fi
if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  NEXTAUTH_SECRET="$(openssl rand -base64 32)"
  warn "generated a new NEXTAUTH_SECRET — pinning it avoids signing everyone out on re-run"
fi

# ── 2. Supabase project ───────────────────────────────────────────────────────
step "Supabase"

export SUPABASE_ACCESS_TOKEN
if [ -z "${SUPABASE_PROJECT_REF:-}" ] && [ -f "$STATE" ]; then
  SUPABASE_PROJECT_REF="$(jq -r '.supabaseRef // ""' "$STATE")"
fi

if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  info "reusing project $SUPABASE_PROJECT_REF"
else
  ORG="${SUPABASE_ORG_ID:-}"
  if [ -z "$ORG" ]; then
    orgs="$(curl -sS "$SUPABASE_API/organizations" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")"
    count="$(echo "$orgs" | jq 'length')"
    [ "$count" = "0" ] && die "No Supabase organizations found for this token."
    if [ "$count" != "1" ]; then
      echo "$orgs" | jq -r '.[] | "    \(.id)  \(.name)"' >&2
      die "Multiple organizations. Set SUPABASE_ORG_ID to one of the above."
    fi
    ORG="$(echo "$orgs" | jq -r '.[0].id')"
  fi

  info "creating project 'aftermeet' in org $ORG ($SUPABASE_REGION)"
  created="$(curl -sS -X POST "$SUPABASE_API/projects" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg n aftermeet --arg o "$ORG" \
      --arg p "$SUPABASE_DB_PASSWORD" --arg r "$SUPABASE_REGION" \
      '{name:$n, organization_id:$o, db_pass:$p, region:$r, plan:"free"}')")"
  SUPABASE_PROJECT_REF="$(echo "$created" | jq -r '.id // .ref // ""')"
  [ -z "$SUPABASE_PROJECT_REF" ] && die "Project creation failed: $created"
  info "created $SUPABASE_PROJECT_REF — waiting for it to come up"

  for _ in $(seq 1 60); do
    status="$(curl -sS "$SUPABASE_API/projects/$SUPABASE_PROJECT_REF" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" |
      jq -r '.status // "UNKNOWN"')"
    [ "$status" = "ACTIVE_HEALTHY" ] && break
    sleep 10
  done
  [ "$status" = "ACTIVE_HEALTHY" ] || die "Project never became healthy (last status: $status)."
fi
save_state

# ── 3. Connection strings ─────────────────────────────────────────────────────
# Supabase does not expose the pooler hostname through an endpoint this can rely
# on, and the prefix varies. Derive candidates and prove one actually connects
# rather than assuming.
step "Database connection"

ENC_PW="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$SUPABASE_DB_PASSWORD")"
DATABASE_URL=""
for host in "aws-0-$SUPABASE_REGION.pooler.supabase.com" \
  "aws-1-$SUPABASE_REGION.pooler.supabase.com"; do
  cand="postgresql://postgres.$SUPABASE_PROJECT_REF:$ENC_PW@$host:6543/postgres"
  if psql "$cand" -c 'select 1' >/dev/null 2>&1; then
    DATABASE_URL="$cand?pgbouncer=true"
    DIRECT_URL="postgresql://postgres.$SUPABASE_PROJECT_REF:$ENC_PW@$host:5432/postgres"
    info "verified pooler host $host"
    break
  fi
done

if [ -z "$DATABASE_URL" ]; then
  cat >&2 <<EOF

✗ Could not connect to the database on any derived hostname.

  This usually means the region differs from SUPABASE_REGION ($SUPABASE_REGION),
  or the password is wrong. Copy the exact strings from
    https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/settings/database
  and re-run with DATABASE_URL and DIRECT_URL exported directly.
EOF
  exit 1
fi

step "Schema"
(
  cd "$ROOT/frontend/web"
  [ -d node_modules ] || npm install --silent
  DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" \
    npx prisma db push --skip-generate
) || die "prisma db push failed."
info "schema applied"

# ── 4. Render (backend) ───────────────────────────────────────────────────────
step "Render — backend API"

OWNER_ID="$(render_api GET /owners | jq -r '.[0].owner.id // ""')"
[ -z "$OWNER_ID" ] && die "Could not read a Render owner id. Is RENDER_API_KEY valid?"

RENDER_SERVICE_ID="$(render_api GET "/services?name=$RENDER_SERVICE_NAME&type=web_service&limit=1" |
  jq -r '.[0].service.id // ""')"

api_env_json() {
  # $1 = CORS origin, $2 = web app URL. Optional vars are omitted when empty so
  # Render does not store empty strings that read as "configured".
  jq -n \
    --arg db "$DATABASE_URL" --arg direct "$DIRECT_URL" \
    --arg jwt "$API_JWT_SECRET" --arg cors "$1" --arg web "$2" \
    --arg groq "$GROQ_API_KEY" \
    --arg gem "${GEMINI_API_KEY:-}" --arg oai "${OPENAI_API_KEY:-}" \
    --arg gid "$GOOGLE_CLIENT_ID" --arg gsec "$GOOGLE_CLIENT_SECRET" \
    --arg sk "${STRIPE_SECRET_KEY:-}" --arg swh "${STRIPE_WEBHOOK_SECRET:-}" \
    --arg spr "${STRIPE_PRICE_PRO_MONTHLY:-}" \
    '[
       {key:"DATABASE_URL",            value:$db},
       {key:"DIRECT_URL",              value:$direct},
       {key:"API_JWT_SECRET",          value:$jwt},
       {key:"CORS_ORIGINS",            value:$cors},
       {key:"WEB_APP_URL",             value:$web},
       {key:"GROQ_API_KEY",            value:$groq},
       {key:"GROQ_MODEL",              value:"llama-3.3-70b-versatile"},
       {key:"GROQ_STT_MODEL",          value:"whisper-large-v3-turbo"},
       {key:"GEMINI_MODEL",            value:"gemini-2.0-flash"},
       {key:"OPENAI_MODEL",            value:"gpt-4o-2024-11-20"},
       {key:"OPENAI_TRANSCRIBE_MODEL", value:"whisper-1"},
       {key:"GOOGLE_CLIENT_ID",        value:$gid},
       {key:"GOOGLE_CLIENT_SECRET",    value:$gsec},
       {key:"GEMINI_API_KEY",          value:$gem},
       {key:"OPENAI_API_KEY",          value:$oai},
       {key:"STRIPE_SECRET_KEY",       value:$sk},
       {key:"STRIPE_WEBHOOK_SECRET",   value:$swh},
       {key:"STRIPE_PRICE_PRO_MONTHLY",value:$spr}
     ] | map(select(.value != ""))'
}

if [ -z "$RENDER_SERVICE_ID" ]; then
  info "creating service $RENDER_SERVICE_NAME"
  body="$(jq -n \
    --arg name "$RENDER_SERVICE_NAME" --arg owner "$OWNER_ID" \
    --arg repo "$GIT_REPO" --arg branch "$GIT_BRANCH" \
    --arg region "$RENDER_REGION" --arg plan "$RENDER_PLAN" \
    --argjson env "$(api_env_json 'http://localhost:4000' 'http://localhost:4000')" \
    '{type:"web_service", name:$name, ownerId:$owner, repo:$repo,
      branch:$branch, rootDir:"backend/api",
      serviceDetails:{
        runtime:"node", plan:$plan, region:$region, healthCheckPath:"/health",
        envSpecificDetails:{buildCommand:"npm install && npm run build",
                            startCommand:"npm run start:prod"}},
      envVars:$env}')"
  created="$(render_api POST /services "$body")"
  RENDER_SERVICE_ID="$(echo "$created" | jq -r '.service.id // ""')"
  [ -z "$RENDER_SERVICE_ID" ] && die "Render service creation failed: $created"
  info "created $RENDER_SERVICE_ID"
else
  info "reusing service $RENDER_SERVICE_ID"
  render_api PUT "/services/$RENDER_SERVICE_ID/env-vars" \
    "$(api_env_json 'http://localhost:4000' 'http://localhost:4000')" >/dev/null
fi

API_URL="$(render_api GET "/services/$RENDER_SERVICE_ID" | jq -r '.serviceDetails.url // ""')"
[ -z "$API_URL" ] && API_URL="https://$RENDER_SERVICE_NAME.onrender.com"
info "backend URL: $API_URL"
save_state

# ── 5. Vercel (frontend) ──────────────────────────────────────────────────────
# Built locally on purpose: a CLI deploy uploads only files under frontend/web,
# and the Prisma schema lives at backend/prisma, outside it. Building here means
# the whole repo is present; only .vercel/output is shipped.
step "Vercel — web app"

cd "$ROOT/frontend/web"
vercel_cli link --yes --project "$VERCEL_PROJECT" >/dev/null
info "linked project $VERCEL_PROJECT"

# A required variable that silently fails to set surfaces much later as a
# confusing runtime error, so fail here instead. Pass "optional" to skip when
# the value is empty.
set_vercel_env() {
  local key="$1" val="$2" optional="${3:-}"
  if [ -z "$val" ]; then
    [ -n "$optional" ] || die "$key is required but has no value."
    return 0
  fi
  printf '%s' "$val" | vercel_cli env add "$key" production --force >/dev/null 2>&1 ||
    die "Could not set $key on Vercel. Is the token valid and project '$VERCEL_PROJECT' reachable?"
}

# NEXTAUTH_URL and NEXT_PUBLIC_APP_URL need the final domain, which Vercel only
# assigns on first deploy. Seeded from the conventional name, corrected below.
WEB_URL_GUESS="https://$VERCEL_PROJECT.vercel.app"
set_vercel_env DATABASE_URL "$DATABASE_URL"
set_vercel_env DIRECT_URL "$DIRECT_URL"
set_vercel_env NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
set_vercel_env NEXTAUTH_URL "$WEB_URL_GUESS"
set_vercel_env NEXT_PUBLIC_APP_URL "$WEB_URL_GUESS"
set_vercel_env GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
set_vercel_env GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
set_vercel_env API_JWT_SECRET "$API_JWT_SECRET"
set_vercel_env NEXT_PUBLIC_API_BASE_URL "$API_URL"
set_vercel_env NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY "${STRIPE_PRICE_PRO_MONTHLY:-}" optional
info "environment set"

vercel_cli pull --yes --environment=production >/dev/null
vercel_cli build --prod >/dev/null || die "Local Vercel build failed."
WEB_URL="$(vercel_cli deploy --prebuilt --prod --yes 2>/dev/null | tail -1)"
[ -z "$WEB_URL" ] && die "Vercel deploy produced no URL."
info "web URL: $WEB_URL"
save_state

# The assigned domain may differ from the guess; correct the two URL vars and
# rebuild so NEXT_PUBLIC_APP_URL is inlined correctly.
if [ "$WEB_URL" != "$WEB_URL_GUESS" ]; then
  info "assigned domain differs from the default — correcting and redeploying"
  set_vercel_env NEXTAUTH_URL "$WEB_URL"
  set_vercel_env NEXT_PUBLIC_APP_URL "$WEB_URL"
  vercel_cli pull --yes --environment=production >/dev/null
  vercel_cli build --prod >/dev/null
  WEB_URL="$(vercel_cli deploy --prebuilt --prod --yes 2>/dev/null | tail -1)"
fi

# ── 6. Close the loop ─────────────────────────────────────────────────────────
step "Wiring Render to the Vercel origin"

render_api PUT "/services/$RENDER_SERVICE_ID/env-vars" \
  "$(api_env_json "$WEB_URL" "$WEB_URL")" >/dev/null
render_api POST "/services/$RENDER_SERVICE_ID/deploys" '{"clearCache":"do_not_clear"}' >/dev/null
info "CORS_ORIGINS and WEB_APP_URL set to $WEB_URL; redeploy triggered"

# ── 7. Verify ─────────────────────────────────────────────────────────────────
step "Verifying"

info "waiting for the backend (a cold free instance can take ~1 minute)"
health=""
for _ in $(seq 1 40); do
  health="$(curl -sS --max-time 20 "$API_URL/health" 2>/dev/null || true)"
  echo "$health" | jq -e '.status == "ok"' >/dev/null 2>&1 && break
  sleep 15
done

if echo "$health" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  db="$(echo "$health" | jq -r .db)"
  ai="$(echo "$health" | jq -r .ai)"
  info "health: db=$db ai=$ai"
  [ "$db" != "up" ] && warn "database unreachable from Render — check DATABASE_URL"
  [ "$ai" != "up" ] && warn "no AI provider on Render — transcription will run in demo mode"
else
  warn "backend did not report healthy in time. Check the Render logs."
fi

save_state

cat <<EOF

──────────────────────────────────────────────────────────────
  Web       $WEB_URL
  API       $API_URL
  Database  $SUPABASE_PROJECT_REF ($SUPABASE_REGION)

  One step left, and it has to be done by hand — Google does not
  expose OAuth consent configuration through an API.

  Google Cloud Console → APIs & Services → Credentials
    → your OAuth client → Authorized redirect URIs → add:

      $WEB_URL/api/auth/callback/google

  Sign-in will fail with redirect_uri_mismatch until that is saved.
  It can take a few minutes to take effect.

  Then open $WEB_URL, sign in, and upload a meeting recording.
──────────────────────────────────────────────────────────────
EOF
