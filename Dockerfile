FROM node:latest

WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
COPY tsconfig.json .
COPY svelte.config.js .
COPY vite.config.ts .
COPY src/app.html ./src/app.html

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --ignore-scripts --prod
# Vite is a dev dependency, but we need it to build the app
# We'll install it globally to make it easier to find
RUN VITE_VERSION=$(awk -F: '/"vite":/ {print $2}' package.json | tr -d ' ",^') && npm install -g vite@$VITE_VERSION 

COPY . .
RUN vite build

EXPOSE 3000
CMD ["node", "build/index.js"]
