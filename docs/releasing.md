# Publishing

[The publishing workflow](../.github/workflows/publish.yml) runs the full test suite before
pushing `ghcr.io/drewbitt/someplice` for amd64 and arm64, with an SBOM and provenance.
Normal pushes and pull requests do not publish images.

## First publish

New GHCR packages are private by default. After publishing, enable public visibility in
[package settings](https://github.com/users/drewbitt/packages/container/someplice/settings)
if anonymous pulls are intended; **this cannot be reversed**. For an existing package,
grant the repository Actions write access. The workflow uses `GITHUB_TOKEN`, not a PAT.

## Publish an edge build

After the workflow is merged into `master`:

```bash
gh workflow run publish.yml --repo drewbitt/Someplice --ref master
gh run watch --repo drewbitt/Someplice --exit-status
```

Select the publishing run when prompted. Manual runs accept only `master` and publish
`edge`, never `latest`. Every published image also gets a `sha-<full commit SHA>` tag.

## Publish a release

1. Set the `version` in `package.json` to the intended SemVer (without `+` build metadata)
   and merge the change into `master` after CI passes.
2. Review release notes, including the [deployment and database limitations](../README.md#option-2-docker).
3. Create a draft, then publish it after review. For version `0.2.0`:

   ```bash
   gh release create v0.2.0 --repo drewbitt/Someplice --target master --generate-notes --draft
   gh release edit v0.2.0 --repo drewbitt/Someplice --draft=false
   ```

   For a version such as `0.2.0-rc.1`, use the matching tag and add `--prerelease` to
   `gh release create`.

4. Watch the publishing run and verify a pull before announcing availability.
   A published GitHub release does not mean its image build has finished.

The tag must equal `v<package.json version>`, its commit must be reachable from `master`,
and the GitHub prerelease flag must match the version.

| Release                  | Image tags (plus SHA tag) |
| ------------------------ | ------------------------- |
| Stable `v0.2.0`          | `0.2.0`, `0.2`, `latest`  |
| Prerelease `v0.2.0-rc.1` | `0.2.0-rc.1` only         |

Publish stable releases in order: an older release can move `latest` and its minor alias
backward. Do not reuse released versions. The run summary records the digest; pin
deployments with `ghcr.io/drewbitt/someplice@sha256:...` when reproducibility matters.

## Before announcing a release

- [ ] CI passes for the release commit, including both container architectures and their
      high/critical vulnerability scans.
- [ ] Verify package visibility, anonymous pulls (if public), digest, and attestations.
- [ ] Test [backup, restore, and rollback](../README.md#data-and-upgrades) on representative data.
