# Little Library

A basic shared library demonstration using Supabase to store and retrieve books.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon/public key, never service-role).
- Run the SQL displayed in the app's setup view in the target Supabase SQL Editor once, then retry connection.
- `pnpm --filter @workspace/library run dev` — frontend (use the managed workflow).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- App data: external Supabase REST API; the preconfigured Replit database is not used.
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/library`
- API contract: `lib/api-spec/openapi.yaml`
- Library routes: `artifacts/api-server/src/routes/books.ts`
- Supabase setup SQL: `artifacts/api-server/src/lib/library-setup.ts`

## Architecture decisions

- Supabase is explicitly requested; do not substitute the managed database or local browser storage.
- No authentication for this demonstration. Shared public access is intentional; do not use private or sensitive data. Add authentication and per-user policies before private use.
- The anon key cannot create tables; schema setup is run by the user in Supabase, not during app startup or publishing.

## Product

Add, browse, search, and delete books, with live connection status and setup instructions.

## User preferences

Keep this a basic demonstration site.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
