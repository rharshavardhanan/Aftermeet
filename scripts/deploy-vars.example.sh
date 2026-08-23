# Copy to scripts/deploy-vars.sh (gitignored), fill in, then:
#
#   set -a; source scripts/deploy-vars.sh; set +a
#   ./scripts/deploy.sh
#
# Nothing in here is ever committed or transmitted anywhere except to the
# provider it belongs to.

# ── Required ───────────────────────────────────────────────────

# Supabase personal access token — https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=""

# Postgres password for the project. If SUPABASE_PROJECT_REF below is empty the
# script creates a project with this password; if it is set, this must be that
# project's existing password. Keep it — the script stores no secrets, so a
# re-run needs it again.
export SUPABASE_DB_PASSWORD=""

# Render API key — Account Settings → API Keys
export RENDER_API_KEY=""

# Vercel token — https://vercel.com/account/tokens
export VERCEL_TOKEN=""

# Groq key — https://console.groq.com/keys  (free)
export GROQ_API_KEY=""

# Google OAuth client. Console → APIs & Services → Credentials → OAuth client
# ID (Web application). Leave the redirect URI blank for now; the script prints
# the exact one to add once Vercel assigns a URL.
export GOOGLE_CLIENT_ID=""
export GOOGLE_CLIENT_SECRET=""

# ── Optional: reuse existing infrastructure ────────────────────

# Set to skip project creation and use a Supabase project you already have.
export SUPABASE_PROJECT_REF=""
# Only needed if your account has more than one organization.
export SUPABASE_ORG_ID=""

# ── Optional: overrides (sensible defaults if unset) ───────────

# export SUPABASE_REGION="us-west-1"     # keep close to RENDER_REGION
# export RENDER_REGION="oregon"
# export RENDER_PLAN="free"              # "starter" avoids cold-start spin-down
# export RENDER_SERVICE_NAME="aftermeet-api"
# export VERCEL_PROJECT="aftermeet"
# export GIT_REPO="https://github.com/rharshavardhanan/Aftermeet"
# export GIT_BRANCH="main"

# Generated fresh on first run if unset. Set them to keep values stable across
# re-runs — changing API_JWT_SECRET invalidates every issued token, and changing
# NEXTAUTH_SECRET signs everyone out.
# export API_JWT_SECRET=""
# export NEXTAUTH_SECRET=""

# ── Optional: features that stay off unless configured ─────────

# Transcription fallbacks. Groq alone is enough.
# export GEMINI_API_KEY=""
# export OPENAI_API_KEY=""

# Billing. Without these the upgrade button stays disabled.
# export STRIPE_SECRET_KEY=""
# export STRIPE_WEBHOOK_SECRET=""
# export STRIPE_PRICE_PRO_MONTHLY=""
