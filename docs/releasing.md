# Publishing and releases

The image name is **`ghcr.io/drewbitt/someplice`** (lowercase). `gh` manages GitHub
workflows/releases; Docker Buildx builds and pushes the image. Nothing publishes
on a normal branch push or pull request.

## Recommended: GitHub Actions, driven by `gh`

After the publishing workflow has merged into `master`:

```bash
gh workflow run publish.yml --repo drewbitt/Someplice --ref master
gh run list --repo drewbitt/Someplice --workflow publish.yml --limit 5
# Use the run ID printed above:
gh run watch RUN_ID --repo drewbitt/Someplice --exit-status
```

Manual runs accept only `master`, run the full test workflow, then publish `edge`
and `sha-<full commit SHA>`. They never move stable release tags or `latest`.
Publishing uses the repository's `GITHUB_TOKEN` with `packages: write`, not a PAT.
The image includes OCI source/revision/version/license labels, a BuildKit SBOM,
and maximum-mode provenance. These attestations describe the build; they are not
an independently verified signature or a vulnerability scan.

The workflow uses QEMU to publish a combined `linux/amd64` + `linux/arm64` manifest.
The JavaScript build runs on the builder's native platform; production dependencies
and the runtime use the target platform, avoiding emulated frontend compilation.
Both architectures are separately built and smoke-tested on native CI runners
before publishing. Node checks, database migration/seed checks, Chromium component
tests, and Playwright must also pass. The digest is recorded in the run summary;
use `ghcr.io/drewbitt/someplice@sha256:...` to pin it.

### First-publish setup

1. Ensure Actions may write packages. If an existing `someplice` GHCR package was
   created outside Actions, grant this repository write access in its package settings.
2. Run the manual publishing workflow. A new package is **private by default**,
   even if the repository is public.
3. For public distribution, change visibility to public in
   [package settings](https://github.com/users/drewbitt/packages/container/someplice/settings).
   Do this deliberately: public package visibility cannot be changed back to private.
4. Verify an anonymous pull and startup on both supported architectures before
   announcing availability. Do not infer public availability from a successful authenticated push.

## Cutting a release

This is still a pre-user, single-installation application. An initial **0.x
preview** is more appropriate than claiming 1.0 production readiness. Choose the
version and release status explicitly; this workflow does not bump versions or
create releases for you.

1. Set `package.json`'s `version` to the intended SemVer version and update the
   lockfile with `pnpm install --lockfile-only`. Commit via a PR and merge into
   `master` after checks pass.
2. Write release notes stating the unauthenticated/private-network deployment
   boundary, supported architectures, backup instructions, and the incompatible
   pre-user database baseline. GitHub's generated notes are a starting point,
   not a substitute for the schema warning.
3. Create a draft for review. For example, **only if the version is `0.2.0`**:

   ```bash
   gh release create v0.2.0 --repo drewbitt/Someplice --target master \
     --title 'Someplice v0.2.0' --generate-notes --draft
   # Review/edit the notes, then explicitly publish:
   gh release edit v0.2.0 --repo drewbitt/Someplice --draft=false
   ```

   For a prerelease, set a matching version such as `0.2.0-rc.1`, use that exact
   `v`-prefixed tag, and add `--prerelease` when creating the draft.
4. Watch the publishing run and verify the returned digest. A published GitHub
   release triggers image building; its image is not available until that run
   succeeds. Announce it only after a successful pull/smoke test.

Release commits must be reachable from `master`; tags must equal
`v<package.json version>` and the GitHub prerelease flag must match the version.
Build metadata (`+...`) is not accepted because Docker tags cannot contain `+`.
Stable `v0.2.0` publishes `0.2.0`, `0.2`, `latest`, and a full SHA tag. Prereleases
publish only the exact prerelease and SHA tags, never `latest` or a minor alias.
There is deliberately no `0` major alias while 0.x releases may be incompatible.

Keep releases chronological: publishing an older stable release will move its
minor alias and `latest` to that release. Do not move version tags or overwrite
released image versions; deploy by digest where immutability matters. Use GitHub
tag rules to restrict release creation according to the project's access policy.

## Optional: local publishing with a `gh`-managed credential

Prefer Actions so tests and attestations are consistently generated. A local
push bypasses that gate; run all contributing checks and both architecture
container smoke tests first. Use a unique tag, not `latest` or an existing release.

For GHCR, GitHub documents a **classic PAT** with `write:packages` (and SSO
authorization if required). Authenticate `gh` with that credential; a fine-grained
PAT or a token without package permissions is not a substitute. Never print or
commit the token. `gh auth token` below pipes it directly to Docker:

```bash
gh auth token --hostname github.com | \
  docker login ghcr.io --username drewbitt --password-stdin
docker buildx create --name someplice-publisher --driver docker-container --use
docker buildx inspect --bootstrap
# Docker Desktop has emulation; Linux needs arm64 binfmt/QEMU or native builder nodes.
TAG="local-$(git rev-parse HEAD)"
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag "ghcr.io/drewbitt/someplice:$TAG" \
  --label org.opencontainers.image.source=https://github.com/drewbitt/Someplice \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  --label org.opencontainers.image.licenses=MIT \
  --provenance=mode=max --sbom=true --push .
docker buildx imagetools inspect "ghcr.io/drewbitt/someplice:$TAG"
docker logout ghcr.io
```

Use a clean checkout: a commit label does not prove uncommitted files were absent.
Docker may store registry credentials in its config unless a credential helper is
configured. Never pass registry credentials through build arguments; maximum-mode
provenance exposes build arguments.

## Release checklist

- [ ] Choose version and preview/stable status; review user-facing release notes.
- [ ] Full CI is green for the exact release commit, including both container architectures.
- [ ] Scan the final image's OS and application packages; review fixable high/critical findings.
- [ ] Confirm GHCR package access/visibility, anonymous pulls, labels, attestations, and digest.
- [ ] Exercise backup **and restore**, container replacement, and rollback on representative data.
- [ ] Establish a migration/upgrade policy before real users accumulate data; the current
      baseline intentionally rejects earlier development migration histories.
- [ ] Confirm the access boundary: there is no built-in login or per-user isolation.
      Public internet deployment needs authentication and HTTPS outside the app or a separately designed auth feature.
- [ ] Document one writable local data volume and one process per installation; no SQLite-on-NFS or horizontal replicas.
- [ ] Assign a vulnerability/update/support process and define what happens after health-check failure.

The Docker health check exercises `/today`, which triggers migrations and outcome
backfill on first startup; it is not a side-effect-free liveness endpoint. Do not
use it as an unauthenticated public monitoring interface. Container smoke tests
can be rerun with `bash tests/docker-smoke.sh IMAGE`, or
`DOCKER_PLATFORM=linux/arm64 bash tests/docker-smoke.sh IMAGE` on an ARM/emulated host.
