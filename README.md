# Someplice

🎯📈 Someplice is a self-hosted application built with SvelteKit and a SQLite backend for achieving your goals by setting daily intentions and tracking your progress.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Contributing](#contributing)

## Features

- 🎯 Set and manage multiple goals
- 📅 Set daily intentions for each goal
- ✅ Mark intentions as complete
- ☀️/🌙 Toggle between light and dark mode

## Installation

🚀 There are three ways to install Someplice: with pnpm, nix, or Docker. Choose the method that best suits your needs.

### Option 1: pnpm

1. Clone the repository
2. Install dependencies

```bash
cd Someplice
pnpm install
```

3. Run database migrations

```bash
pnpm run db:migrate
```

4. Start the application

```bash
pnpm run dev
```

### Option 2: Devbox/nix

1. Ensure you have [devbox](https://www.jetpack.io/devbox/docs/installing_devbox/) installed.
2. Clone the repository
3. Run `devbox shell` in the root of the repository. This will open a shell with all the dependencies installed (node and pnpm)
4. Follow pnpm instructions above to install dependencies, run migrations, and start the application

### Option 3: Docker

1. Clone the repository
2. Build the Docker image

```bash
docker build -t someplice .
```

3. Run the Docker image

```bash
docker run -p 3000:3000 someplice
```

4. Run migrations to create DB

```bash
docker exec -it someplice pnpm run db:migrate
```

## Contributing

🙌 Contributions are always welcome! If you'd like to contribute to Someplice, please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. When making DB changes, use [kysely-codegen](https://github.com/RobinBlomberg/kysely-codegen) to generate the TypeScript types for the database. Run `pnpm run db:codegen` to generate the types. To setup, create an .env file with your database connection string:

```yml
# SQLite
DATABASE_URL=YOUR_ABSOLUTE_PATH_TO/Someplice/src/lib/db/db.sqlite
```

4. Make your changes and commit them with a descriptive message. Use [lefthook](https://github.com/evilmartians/lefthook) pre-commit formatting (`lefthook install`) with Prettier to ensure consistency, or run `pnpm run format` to format all files.
