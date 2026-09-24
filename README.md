<a name="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/drewbitt/Someplice">
    <img src="src/lib/assets/someplice-compressed-logo-2023-01-21-no-padding.svg" alt="Logo" width="100" height="100">
  </a>

<h3 align="center">Someplice</h3>

  <p align="center">
    🎯📈 Someplice is a self-hosted application that helps you achieve your goals. Built with SvelteKit and SQLite, it lets you set daily intentions and track your progress effectively.
    <br />
    <a href="https://github.com/drewbitt/Someplice/issues">Report Bug</a>
    ·
    <a href="https://github.com/drewbitt/Someplice/issues">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

- 🎯 Set and manage multiple goals
- 📅 Set daily intentions for each goal
- ✅ Mark intentions as complete
- 🧐 Review and reflect on your past intentions
- ☀️/🌙 Toggle between light and dark mode

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [SvelteKit](https://kit.svelte.dev/)
- SQLite
- [kysely](https://github.com/kysely-org/kysely)
- [TRPC](https://trpc.io/) and [Zod](https://zod.dev/)
- Tailwind & [DaisyUI](https://daisyui.com/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

There are two ways to install Someplice: with pnpm or Docker. Choose the method that best suits your needs.

### Installation

#### Option 1: pnpm

Only pnpm is required — pnpm automatically downloads the pinned Node.js version (`devEngines.runtime`) if needed.

1. Clone the repository
2. Install dependencies

```bash
cd Someplice
pnpm install
```

3. Database migrations run automatically when the app starts. Optionally, they can also be run manually via the CLI:

```bash
pnpm run db:migrate
```

4. Start the application

```bash
pnpm run dev
```

#### Option 2: Docker

The Docker public image build is WIP. For now, you can build the image locally:

```bash
docker build -t someplice .
```

Then run the container. Replace `/host/dataFolder` with the absolute path to the folder where you want to store the database. The container runs any pending migrations automatically on every start.

```bash
docker run -v /host/dataFolder:/app/data -p 3000:3000 someplice:latest
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Before opening a PR:

```bash
pnpm check        # svelte-check type checking
pnpm lint         # prettier + eslint
pnpm test:unit    # vitest unit tests
pnpm test:e2e     # playwright e2e tests (requires the dev server)
pnpm run db:reset # recreate ./data/db.sqlite, migrate, and regenerate types
pnpm run db:seed  # insert fake data into the database
```

When making database changes, use [kysely-codegen](https://github.com/RobinBlomberg/kysely-codegen) to generate the TypeScript types for the database. Run `pnpm run db:codegen` to generate the types. To set up, create an `.env` file with your database connection string:

```bash
# SQLite
DATABASE_URL=YOUR_ABSOLUTE_PATH_TO/Someplice/src/lib/db/
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>
