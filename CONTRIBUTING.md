# Contributing

## Setup

```bash
npm install
```

Node.js >= 20 required. `npm install` builds the `camelmailer` SDK dependency
from source once (see `scripts/ensure-camelmailer-dist.mjs`) — this shim goes
away when the SDK is published to npm.

## Commands

```bash
npm test            # unit tests (vitest, mocked SDK — no network)
npm run test:watch  # watch mode
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/index.js
CAMELMAILER_API_KEY=cm_xxx node dist/index.js   # run the stdio server
```

To run the integration suite against a real instance:

```bash
CAMELMAILER_API_KEY=cm_xxx CAMELMAILER_BASE_URL=https://mail.example.com npm test
```

## Conventions

- Test-driven: every tool has direct handler tests against a fake SDK client
  plus wire-level coverage through an in-memory MCP transport.
- Tools live in `src/tools.ts` as data (name, description, zod shape,
  handler) — the server in `src/server.ts` just registers them.
- Tool results carry the raw API payload as pretty-printed JSON; failures
  return `isError: true` with the stable CamelMailer error code.
- stdout belongs to the MCP protocol — log to stderr only.
- Bump `src/version.ts` together with `package.json`, and keep
  `CHANGELOG.md` (Keep a Changelog) up to date.
