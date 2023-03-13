FROM node:lts-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "build/index.js"]
