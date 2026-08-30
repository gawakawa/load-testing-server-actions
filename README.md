# load-testing-server-actions

## Overview

An experimental repository for verifying whether Next.js Server Actions can be load-tested with k6 and Locust.

## Features

## Prerequisites

## Usage

```sh
# enter the dev shell (provides pnpm, node, and k6)
direnv allow # first time only

pnpm install
pnpm build && pnpm start # load test targets a production build, not `pnpm dev`

# in another terminal
k6 run --vus 10 --duration 30s loadtest/server-action.js
```

`BASE_URL` (default `http://localhost:3000`) selects the target.

## Directory Structure

- `app/` — Next.js App Router pages and the Server Action under test
- `loadtest/` — k6 load test scripts
- `docs/DESIGN.md` — Server Action wire-protocol research and the k6 vs Locust decision
- `nix/` — flake modules (dev shell, checks, formatting)
