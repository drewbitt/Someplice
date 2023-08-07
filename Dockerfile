FROM node:latest

WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
COPY tsconfig.json .
COPY svelte.config.js .
COPY vite.config.ts .
COPY src/app.html src/app.html

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm rebuild
# Check if SQLite database exists, if not, run migrations
RUN if [ ! -f /data/db.sqlite ]; then pnpm run db:migrate; fi

RUN pnpm run build

EXPOSE 3000
CMD ["node", "build/index.js"]