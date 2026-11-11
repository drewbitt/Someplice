# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
# check=error=true

FROM --platform=$BUILDPLATFORM node:26.12.1-slim@sha256:94816674c62774da0d099a947bf4613b9e1972a2733abd0d0cd80e795f8411d0 AS base
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

FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
RUN apk add --no-cache libatomic libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node \
    && install -d -o node -g node /app/data
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/db.sqlite

COPY --from=node:26.12.1-alpine3.24@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 /usr/local/bin/node /usr/local/bin/
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
