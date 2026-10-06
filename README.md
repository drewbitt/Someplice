# Someplice

A self-hosted app for daily intentions, goals, and reviews, built with SvelteKit and SQLite.

- Manage goals and set daily intentions.
- Track completed intentions and review past days.
- Switch between light and dark themes.
- Cache static assets; offline data access is not supported.

## Run locally

Install [pnpm](https://pnpm.io/installation); it downloads the pinned Node.js runtime
(>=24.21.0) if needed.

```bash
git clone https://github.com/drewbitt/Someplice.git
cd Someplice
pnpm install
pnpm dev
```

The first dynamic request, including `/today`, initializes `data/db.sqlite` by default
and starts outcome backfill.

## Docker

Build locally, or use `ghcr.io/drewbitt/someplice:<tag>` once published.
The [publishing workflow](docs/releasing.md) supports amd64 and arm64.

**No authentication or user isolation:** keep the loopback binding below. Remote access
needs an authenticated HTTPS gateway or a trusted private network.

```bash
docker build -t someplice .
docker run -d --name someplice --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --stop-timeout 35 \
  --mount type=volume,source=someplice-data,target=/app/data \
  -p 127.0.0.1:3000:3000 someplice
```

Open <http://localhost:3000>. The named volume preserves the database across container replacements.

- Use one container per database on local storage, not NFS.
- For bind mounts, mount the whole `/app/data` directory and make it writable by UID/GID
  `1000:1000`, including SQLite WAL/SHM files.
- `DATABASE_PATH` defaults to `/app/data/db.sqlite` in Docker; keep overrides in a persistent
  writable mount. The `/today` health check can initialize the database; it is not side-effect-free.

### Time zone

Day boundaries use the stored installation zone, then a valid `SOMEPLICE_TIMEZONE`, then UTC.
Without an override, the first browser visit saves its detected zone. Set
`SOMEPLICE_TIMEZONE=America/New_York` (Docker: `-e SOMEPLICE_TIMEZONE=America/New_York`)
to choose the initial zone. Server `TZ` does not control application dates.

### Data and upgrades

Before upgrading, stop the app and back up the entire data directory, not just a live
`db.sqlite`. For the Docker container above:

```bash
mkdir -p backups
docker stop someplice
docker cp someplice:/app/data/. "backups/someplice-$(date -u +%Y%m%dT%H%M%SZ)"
docker start someplice
```

Test restoring into a new volume. Rollback may require the matching backup, not just an older image.

The single `001_initial` migration **does not upgrade earlier development databases**.
To retain old data, keep the earlier revision until an upgrade path exists.
Stop the app before `pnpm run db:reset`; it deletes the default development database.
Never use it on data you need. A custom `DATABASE_PATH` must be reset separately.

## Contributing

[Report bugs or request features](https://github.com/drewbitt/Someplice/issues). Before opening a PR:

```bash
pnpm check
pnpm run check:tsgo
pnpm lint
pnpm test:unit --run
pnpm exec playwright install chromium
pnpm test:browser --run
pnpm test:e2e
```

Playwright builds the app and uses a disposable database. Browser failure traces are retained
under `test-results/`; open one with `pnpm exec playwright show-trace path/to/trace.zip`.
After schema changes, run `pnpm run db:codegen` to regenerate `src/lib/types/data.d.ts`
from the migrations; a unit test checks it stays current.

## License

[MIT](LICENSE).
