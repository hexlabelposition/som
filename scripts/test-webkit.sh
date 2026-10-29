#!/bin/sh
# Runs the browser tests in WebKit inside the Playwright image that CI uses.
# Playwright's WebKit needs Ubuntu's system libraries, which other Linux
# distributions usually lack. The image must match the playwright package and
# the image in .github/workflows/ci.yml (ARCHITECTURE §8).
set -eu

image="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea"

# The user and HOME keep files the tests write, such as node_modules/.vite,
# owned by you. Bun is installed from npm in the version from packageManager,
# as in CI.
exec docker run --rm --ipc=host \
  --user "$(id -u):$(id -g)" --env HOME=/tmp \
  --volume "$PWD:/work" --workdir /work \
  "$image" \
  sh -c 'version=$(node -p "require(\"./package.json\").packageManager.split(\"@\")[1]") &&
    npm install --silent --global --prefix /tmp/bun "bun@$version" &&
    /tmp/bun/bin/bun run test:browser --browser webkit'
