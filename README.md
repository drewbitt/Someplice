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

## Installation

🚀 To install Someplice, please follow these steps:

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

## Contributing

🙌 Contributions are always welcome! If you'd like to contribute to Someplice, please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with a descriptive message. Use [Lefthook](https://github.com/evilmartians/lefthook) pre-commit formatting (`lefthook install`) with Prettier to ensure consistency, or run `pnpm run format` to format all files.
