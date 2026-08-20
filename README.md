# FHFHockey

This repository contains the FHFHockey web application, content studio,
serverless functions, and database assets. There is no root package manifest;
run commands from the owning workspace described below.

## Web quick start

The primary application requires Node 22.11.0 from [`web/.nvmrc`](web/.nvmrc).
For `web/`, npm plus [`web/package-lock.json`](web/package-lock.json) is the sole
package-manager authority.

```bash
cd web
nvm use
npm ci
npm run dev
```

See [`web/README.md`](web/README.md) for the stable watcher fallback, tests,
browser verification, and Supabase CLI workflow.

## Repository boundaries

- [`web/`](web/) — the primary Next.js application, API routes, scripts, unit
  tests, and Playwright tests. Its manifest is [`web/package.json`](web/package.json).
- [`cms/`](cms/) — the Sanity Studio. Its independent manifest provides
  `npm run dev`; see [`cms/README.md`](cms/README.md). It does not share the web
  lockfile.
- [`functions/`](functions/) — the separately deployed Python/Node serverless
  boundary. Its documented local launcher runs from the repository root:
  `yarn vercel dev --cwd functions --listen 3003`. See
  [`functions/README.md`](functions/README.md); this command is intentionally
  separate from the web package-manager contract.
- [`supabase/`](supabase/) — local Supabase configuration and the current
  migration chain. Run the documented CLI wrapper from `web/`; do not apply
  remote migrations as part of setup.
- [`migrations/`](migrations/) and [`sql/`](sql/) — additional SQL assets with
  distinct historical/workflow ownership. Confirm the relevant migration tree
  before using or changing either directory.
- [`.github/workflows/`](.github/workflows/) — CI and scheduled-workflow
  definitions; these are operational configuration, not local setup scripts.

Repository-wide contribution and safety rules live in
[`AGENTS.md`](AGENTS.md). Package-level documentation remains authoritative for
detailed commands so this entrypoint can stay concise.

## Optional editor integrations

The checked-in VS Code MCP configuration is intentionally inert and starts no
shared server. Contributors may configure reviewed MCP tools in their personal
editor settings; package downloads, network access, and credentials remain an
explicit per-contributor trust decision and must not be committed here.
