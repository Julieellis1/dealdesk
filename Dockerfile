# DealDesk on Dokploy
# Build:  docker build -t dealdesk .
# Run:    docker run -p 3001:3001 -v dealdesk-data:/app/data --env-file .env dealdesk
# NOTE: must stay on Node 24+. better-sqlite3 v13's prebuilt binary is compiled
# with NAPI_VERSION=10, which does not exist on Node 20/22 -> the process
# segfaults (exit 139) the moment the database module loads. Verified 2026-10-08.
FROM node:24-bookworm-slim

# Build tools as a fallback so better-sqlite3 can compile from source
# even if its prebuilt binary download is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build && npm prune --omit=dev

# Fail the build loudly if the native sqlite binding can't load,
# instead of crash-looping (exit 139) at runtime with no logs.
RUN node -e "const db=require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE t(a)'); if (db.prepare('SELECT 1+1 AS x').get().x !== 2) process.exit(1); console.log('sqlite binding OK');"

# SQLite database + auto-generated encryption key live here.
# Mount a persistent volume on /app/data in Dokploy or the data is lost on redeploy.
VOLUME ["/app/data"]

ENV HOST=0.0.0.0 PORT=3001 NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
