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

Only pnpm is required — pnpm automatically downloads the pinned Node.js version (`devEngines.runtime`, Node.js >= 24 for `node:sqlite`) if needed.

1. Clone the repository
2. Install dependencies

```bash
cd Someplice
pnpm install
```

3. The first dynamic request (for example, `/today`) initializes the database and starts outcome backfill. `pnpm run db:migrate` is only needed for CI/scripts.

4. Start the application

```bash
pnpm run dev
```

#### Option 2: Docker

The Docker public image build is WIP. For now, you can build the image locally:

```bash
docker build -t someplice .
```

Then run the container. Replace `/host/dataFolder` with the absolute path to the folder where you want to store the database. The `/today` health check initializes the database after each start.

```bash
docker run -v /host/dataFolder:/app/data -p 3000:3000 someplice:latest
```

#### Time zone

Day boundaries use one installation time zone: the stored setting first, then a valid `SOMEPLICE_TIMEZONE`, then UTC. On a fresh installation without an environment override, the first browser visit saves its detected zone. Set `SOMEPLICE_TIMEZONE=America/New_York` (or `docker run -e SOMEPLICE_TIMEZONE=America/New_York ...`) to choose the initial zone explicitly. Server `TZ` does not control application dates.

#### Pre-user database baseline

The schema is a single `001_initial` migration. Databases from earlier development revisions are intentionally not upgraded. To keep old data, back up the database and continue using the earlier revision until an upgrade path is written. For disposable development data, stop the app, back up anything you need, and run `pnpm run db:reset`. This deletes the default `data/db.sqlite` database; never run it on data you want to retain. A custom `DATABASE_PATH` must be reset separately.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Before opening a PR:

```bash
pnpm check        # svelte-check type checking
pnpm lint         # prettier + eslint
pnpm run check:tsgo  # TypeScript native checker
pnpm test:unit --run # Node Vitest tests
pnpm exec playwright install chromium
pnpm test:browser --run # real-Chromium Svelte component tests
pnpm test:e2e        # builds/previews with a disposable database; no dev server needed
pnpm build
```

Browser tests use feature-owned `*.browser.test.ts` files for isolated Svelte behavior with mocked navigation/tRPC; API/database/helper tests stay in the Node project. Playwright covers the built app's real HTTP/database, reload, timezone, and service-worker behavior with a fresh run-owned database, leaving development data untouched.

Both browser runners retain failure traces under `test-results/` in separate `vitest` and `playwright` directories; CI uploads them for seven days. Open a trace with `pnpm exec playwright show-trace path/to/trace.zip`.

The native service worker caches only build/static assets, not pages, SvelteKit data, or API responses. This is not offline data support. Worker updates wait for old tabs to close rather than forcing activation or discarding drafts.

When making database changes, use [kysely-codegen](https://github.com/RobinBlomberg/kysely-codegen) to generate the TypeScript types for the database. `pnpm run db:codegen` regenerates `src/lib/types/data.d.ts` from the migrations (no database file needed); a unit test fails if it is stale.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
