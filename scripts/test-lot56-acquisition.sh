#!/bin/sh
set -eu

docker run --rm \
  -v "$PWD":/source:ro \
  -w /tmp/project \
  node:22-alpine \
  sh -lc '
    cp -a /source/. .
    npm ci >/dev/null
    npm run typecheck --workspace @mse/api
    npm test --workspace @mse/api -- \
      providerAcquisitionAdapters.test.ts \
      providerContracts.test.ts \
      providerDiscoveryAdapters.test.ts \
      providerHttpQuota.test.ts \
      providerSourceStorage.test.ts \
      securityHardening.test.ts
  '

echo 'Tests Lot 5.6-B acquisition adaptateur sécurisée : OK'
