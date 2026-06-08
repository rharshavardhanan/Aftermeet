#!/usr/bin/env bash
# Aftermeet — starter / bootstrap script.
# Gets a fresh clone from zero to a running dev server.
#
#   ./start.sh           install deps, ensure .env, generate Prisma client, run dev
#   ./start.sh build     install + production build (next build)
#   ./start.sh db        install + push schema to the database (prisma db push)
#
# The Next.js app (frontend + backend) is one npm package under frontend/web/;
# the Prisma schema lives in backend/prisma/ and is wired via package.json.
set -euo pipefail

# Always run relative to this script's location, regardless of caller's cwd.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$ROOT/frontend/web"

cd "$WEB"

# 1. Env file — create from the example on first run so the app can boot.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ Created frontend/web/.env from .env.example — fill in DATABASE_URL / DIRECT_URL (+ optional keys)."
fi

# 2. Dependencies (skip the reinstall if node_modules already exists).
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies…"
  npm install
fi

# 3. Generate the Prisma client from backend/prisma/schema.prisma.
echo "→ Generating Prisma client…"
npm run db:generate

# 4. Dispatch on the requested mode.
case "${1:-dev}" in
  dev)
    echo "→ Starting dev server on http://localhost:4000 …"
    exec npm run dev
    ;;
  build)
    echo "→ Building for production…"
    exec npm run build
    ;;
  db)
    echo "→ Pushing schema to the database…"
    exec npm run db:push
    ;;
  *)
    echo "Unknown mode: ${1}. Use: dev | build | db" >&2
    exit 1
    ;;
esac
