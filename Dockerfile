# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
# check=error=true

FROM --platform=$BUILDPLATFORM node:24.21.0-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Production dependencies are pure JavaScript, so they're installed on the build platform
FROM base AS prod-deps
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --no-runtime --store-dir=/pnpm/store

FROM base AS build
# esbuild ships binaries via optionalDeps; skipping scripts avoids compiling dev-only native deps
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --no-runtime --store-dir=/pnpm/store
COPY . .
RUN pnpm run build

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk add --no-cache libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node \
    && install -d -o node -g node /app/data
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/db.sqlite

COPY --from=node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 /usr/local/bin/node /usr/local/bin/
COPY --from=base /usr/local/LICENSE /usr/local/share/doc/node/LICENSE
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json LICENSE ./

USER node
EXPOSE 3000
HEALTHCHECK --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/today',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# The first dynamic request initializes the database and cron
CMD ["node", "build/index.js"]
