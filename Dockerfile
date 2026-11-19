# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
# check=error=true

FROM --platform=$BUILDPLATFORM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Node 26 no longer bundles Corepack; install the project's pinned pnpm version.
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

# Production dependencies are pure JavaScript, so they're installed on the build platform
FROM base AS prod-deps
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --no-runtime --store-dir=/pnpm/store

FROM base AS build
# esbuild ships binaries via optionalDeps; skipping scripts avoids compiling dev-only native deps
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --no-runtime --store-dir=/pnpm/store
COPY . .
RUN node --run build

FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
RUN apk add --no-cache libatomic libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node \
    && install -d -o node -g node /app/data
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/db.sqlite

COPY --from=node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 /usr/local/bin/node /usr/local/bin/
COPY --from=base /usr/local/LICENSE /usr/local/share/doc/node/LICENSE
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --chmod=644 package.json LICENSE ./

USER node
EXPOSE 3000
HEALTHCHECK --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/today',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# The first dynamic request initializes the database and cron
CMD ["node", "build/index.js"]
