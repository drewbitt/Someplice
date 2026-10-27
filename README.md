# Someplice

<img src="src/lib/assets/someplice-compressed-logo-2023-01-21-no-padding.svg" alt="Someplice logo" width="80" />

A self-hosted app for goals, daily intentions, and progress reviews.

## Run with Docker

Use a published image from `ghcr.io/drewbitt/someplice` (amd64/arm64), or build from a checkout:

```bash
docker build -t someplice .
docker run -d --name someplice --restart unless-stopped --stop-timeout 35 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -v someplice-data:/app/data -p 127.0.0.1:3000:3000 someplice
```

Open <http://localhost:3000>. Published version tags omit the release's `v` prefix, for example `:0.2.0`.

**There is no built-in authentication.** Keep access local or use an authenticated reverse proxy.

Your data is stored in the `someplice-data` volume. If you use a bind mount instead, its directory must be writable by UID/GID 1000.

## Configuration

Pass environment variables with Docker's `-e`, or set them before starting the Node server.

| Variable             | Purpose                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`      | SQLite file; defaults to `./data/db.sqlite`, or `/app/data/db.sqlite` in Docker.                                                  |
| `SOMEPLICE_TIMEZONE` | Initial IANA timezone, e.g. `America/New_York`; otherwise detected on the first browser visit. A stored setting takes precedence. |
| `PORT`               | Node server port; defaults to `3000`.                                                                                             |

The database initializes automatically. Older development databases aren't migrated to the current schema.

## Development

From a checkout with pnpm installed:

```bash
pnpm install
pnpm dev
```

For a production server without Docker, run `pnpm build`, then `NODE_ENV=production pnpm exec node build/index.js`.

See [package.json](package.json) for available scripts and [CI](.github/workflows/test.yml) for validation.

## License

[MIT](LICENSE). [Report an issue](https://github.com/drewbitt/Someplice/issues).
