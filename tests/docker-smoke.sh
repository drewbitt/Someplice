#!/usr/bin/env bash
set -euo pipefail

image=${1:-someplice:ci}
name="someplice-smoke-${GITHUB_RUN_ID:-local}-$$"
volume="${name}-data"
restore_volume="${name}-restore"
platform=${DOCKER_PLATFORM:-linux/amd64}
run_options=(--platform "$platform" --read-only --tmpfs /tmp
  --cap-drop ALL --security-opt no-new-privileges)

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    docker inspect --format '{{json .State}}' "$name" >&2 || true
    docker logs "$name" >&2 || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" "$restore_volume" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

start() {
  docker run -d --name "$name" "${run_options[@]}" \
    --mount "type=volume,source=$1,target=/app/data" \
    -e SOMEPLICE_TIMEZONE=UTC -p 127.0.0.1::3000 "$image" >/dev/null
  port=$(docker port "$name" 3000/tcp | cut -d: -f2)
  url="http://127.0.0.1:$port"
  for _ in {1..90}; do
    state=$(docker inspect --format '{{.State.Running}} {{.State.Health.Status}}' "$name")
    case "$state" in
      'true healthy') return ;;
      false*) echo 'Container exited before becoming healthy' >&2; return 1 ;;
    esac
    sleep 2
  done
  echo 'Container did not become healthy' >&2
  return 1
}

check() {
  docker exec -i "$name" node --input-type=module - "$1" < "${BASH_SOURCE[0]%.sh}.mjs"
  for page in today goals journey; do
    curl --fail --silent --show-error "$url/$page" >/dev/null
  done
  curl --fail --silent --show-error "$url/api/trpc/goals.list" | grep -q container-persistence-marker
}

start "$volume"
check seed
docker stop --timeout 35 "$name" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$name")" = 0
docker cp "$name:/app/data/." - | docker run --rm -i "${run_options[@]}" \
  --mount "type=volume,source=$restore_volume,target=/app/data" \
  --entrypoint tar "$image" --no-same-owner -x -C /app/data
docker rm "$name" >/dev/null
start "$restore_volume"
check restore
echo "Container smoke test passed: $platform"
