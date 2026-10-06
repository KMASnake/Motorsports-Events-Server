# 5.7-P-F — Temporary VPS certification of the bounded runner

Status: **PROTOCOL READY — NOT EXECUTED — NO PROVIDER AUTHORIZATION**

This protocol certifies only the isolated PostgreSQL/Docker fixture. Its
OCBlackTop adapter receives an injected in-process transport and
`globalThis.fetch` is replaced by a function that always fails. It cannot emit
an external provider request and uses only a synthetic encrypted credential.

## 1. Produce and transfer the uncommitted patch

On the trusted local workstation, include tracked and new files in the patch,
then record its digest:

```sh
cd /home/kmasnake/projects/motorsports-events-server
git status --short
git add -N \
  apps/api/src/cli/providerAcquireOnce.ts \
  apps/api/src/providers/providerOneShotRunner.ts \
  apps/api/tests/providerOneShotRunner.test.ts \
  docs/handoff/LOT-5.7-P-F-BOUNDED-PROVIDER-RUNNER.md \
  docs/handoff/LOT-5.7-P-F-BOUNDED-RUNNER-VPS-CERTIFICATION.md \
  scripts/test-lot57pf-bounded-provider-runner.sh \
  scripts/validate-lot57pf-bounded-provider-runner.mjs
git diff --binary --output=/tmp/lot57pf-bounded-runner.patch
git reset -- \
  apps/api/src/cli/providerAcquireOnce.ts \
  apps/api/src/providers/providerOneShotRunner.ts \
  apps/api/tests/providerOneShotRunner.test.ts \
  docs/handoff/LOT-5.7-P-F-BOUNDED-PROVIDER-RUNNER.md \
  docs/handoff/LOT-5.7-P-F-BOUNDED-RUNNER-VPS-CERTIFICATION.md \
  scripts/test-lot57pf-bounded-provider-runner.sh \
  scripts/validate-lot57pf-bounded-provider-runner.mjs
sha256sum /tmp/lot57pf-bounded-runner.patch
scp /tmp/lot57pf-bounded-runner.patch <vps-user>@<vps-host>:/tmp/
```

The prepared local patch must be generated only after new files have been made
visible to `git diff` with intent-to-add (`git add -N`), then the intent-to-add
index entries must be removed. No content is staged or committed.

## 2. Create an isolated detached VPS worktree

Replace `<certified-repository>` with the existing repository path. Do not run
these commands inside the deployed preproduction worktree.

```sh
export CERT_BASE_REPOSITORY=<certified-repository>
export CERT_ROOT=$(mktemp -d /tmp/mse-bounded-runner-cert-XXXXXX)
git -C "$CERT_BASE_REPOSITORY" worktree add --detach "$CERT_ROOT/repository" f4ed3b4f35e24a6c70f0816a0338e370d31bf02c
cd "$CERT_ROOT/repository"
git apply --check /tmp/lot57pf-bounded-runner.patch
git apply --whitespace=error-all /tmp/lot57pf-bounded-runner.patch
git status --short
git diff --check
```

Verify the SHA-256 received on the VPS matches the workstation value before
applying it.

## 3. Run the mocked PostgreSQL certification

```sh
cd "$CERT_ROOT/repository"
./scripts/test-lot57pf-bounded-provider-runner.sh
```

Expected terminal evidence:

```text
A-H bounded runner PostgreSQL certification with injected mock transport: PASS
PROVIDER_CALLS_EXTERNAL=0
PROVIDER_CREDITS=0
```

The script creates a unique Compose project, disposable PostgreSQL volume and
synthetic encrypted secret, applies migrations to head, executes scenarios
A–H, and removes the project and volume on exit.

## 4. Run the required regression matrix

```sh
cd "$CERT_ROOT/repository"
npm run test --workspace @mse/api -- providerOneShotRunner.test.ts runtimeIsolation.test.ts acquisitionOrchestrator.test.ts providerAcquisitionAdapters.test.ts canonicalAcquisitionPublicationService.test.ts normalizationMappingRepository.test.ts
./scripts/test-lot57pf-canonical-handoff.sh
./scripts/test-lot57pf-normalization-mapping-repository.sh
./scripts/test-lot57pf-normalization-mapping.sh
./scripts/test-lot57pf-certification.sh
npm run typecheck --workspace @mse/api
npm run lint --workspace @mse/api
npm run build --workspace @mse/api
./scripts/validate-repository.sh
git diff --check
```

Migration 0030 is exercised by the normalization-mapping recipes. No real
provider validation is part of this protocol.

## 5. Inspect and remove only the temporary worktree

```sh
git -C "$CERT_BASE_REPOSITORY" worktree remove --force "$CERT_ROOT/repository"
rmdir "$CERT_ROOT"
```

Do not delete or modify the deployed preproduction worktree, its environment,
volumes or services. Keep the patch and test output for maintainer audit. A
commit/push decision remains separate and is allowed only after all required
certification results pass.
