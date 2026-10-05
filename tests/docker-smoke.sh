#!/usr/bin/env bash
set -euo pipefail

image=${1:-someplice:ci}
name="someplice-smoke-${GITHUB_RUN_ID:-local}-$$"
volume="${name}-data"
platform=${DOCKER_PLATFORM:-linux/amd64}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    docker logs "$name" || true
    docker inspect "$name" || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker volume create "$volume" >/dev/null
start() {
  docker run -d --name "$name" --platform "$platform" \
    --read-only --cap-drop ALL --security-opt no-new-privileges \
    --mount "type=volume,source=$volume,target=/app/data" \
    -e SOMEPLICE_TIMEZONE=UTC -p 127.0.0.1::3000 "$image" >/dev/null
  port=$(docker port "$name" 3000/tcp | cut -d: -f2)
  url="http://127.0.0.1:$port"
  for _ in {1..90}; do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$name")" = healthy ]; then
      return
    fi
    sleep 2
  done
  echo 'Container did not become healthy' >&2
  return 1
}

start
test "$(docker exec "$name" id -u)" = 1000
for page in today goals journey; do
  curl --fail --silent --show-error "$url/$page" >/dev/null
done
docker exec "$name" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { DatabaseSync } from "node:sqlite";
  const db = new DatabaseSync(process.env.DATABASE_PATH);
  db.function("regexp", { deterministic: true }, (pattern, value) =>
    typeof pattern === "string" && typeof value === "string" && new RegExp(pattern).test(value) ? 1 : 0);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.equal(db.prepare("SELECT count(*) AS n FROM kysely_migration").get().n, 1);
  db.prepare("INSERT INTO goals (active, orderNumber, title, color) VALUES (1, 1, ?, ?)")
    .run("container-persistence-marker", "#ffffff");
  db.close();
'
curl --fail --silent --show-error "$url/api/trpc/goals.list" | grep -q container-persistence-marker
docker stop --timeout 35 "$name" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$name")" = 0
docker rm "$name" >/dev/null
start
curl --fail --silent --show-error "$url/api/trpc/goals.list" | grep -q container-persistence-marker
docker exec "$name" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { DatabaseSync } from "node:sqlite";
  const db = new DatabaseSync(process.env.DATABASE_PATH);
  db.function("regexp", { deterministic: true }, (pattern, value) =>
    typeof pattern === "string" && typeof value === "string" && new RegExp(pattern).test(value) ? 1 : 0);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  db.close();
'
echo "Container smoke test passed: $platform"
