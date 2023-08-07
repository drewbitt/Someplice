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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

There are three ways to install Someplice: with pnpm, nix, or Docker. Choose the method that best suits your needs.

### Installation

#### Option 1: pnpm

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

#### Option 2: Devbox/nix

1. Ensure you have [devbox](https://www.jetpack.io/devbox/docs/installing_devbox/) installed.
2. Clone the repository
3. Run `devbox install` followed by `devbox shell` in the root of the repository. This will open a shell with all the dependencies installed (node and pnpm)
4. Follow pnpm instructions above to install dependencies, run migrations, and start the application

#### Option 3: Docker

Docker is WIP and will not work as expected.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Contributing

When making database changes, use [kysely-codegen](https://github.com/RobinBlomberg/kysely-codegen) to generate the TypeScript types for the database. Run `pnpm run db:codegen` to generate the types. To set up, create an .env file with your database connection string:
yml

```bash
# SQLite
DATABASE_URL=YOUR_ABSOLUTE_PATH_TO/Someplice/src/lib/db/
```


<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
