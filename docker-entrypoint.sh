#!/bin/sh
set -e

# Migrations are idempotent: runs pending ones, no-ops when the database is current.
node ./src/lib/db/migrate-to-latest.ts

exec node build/index.js
