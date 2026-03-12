# ChatGPT Calories AI (Next.js)

A Next.js ChatGPT App with:

- MCP server on `/mcp` (Apps SDK + MCP SDK)
- Calorie dashboard widget UI rendered in ChatGPT
- Dashboard tools:
  - `open_calorie_dashboard`
  - `load_day_snapshot`
- Supabase scaffolding for phase 2 (service-role model), while phase 1 uses mock data

## Stack

- Next.js 16
- React 19
- `@modelcontextprotocol/sdk`
- `@modelcontextprotocol/ext-apps`
- `@supabase/supabase-js` (scaffolded)

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Optional: copy env scaffold:

```bash
cp .env.example .env.local
```

3. Run dev server:

```bash
pnpm dev
```

4. MCP endpoint:

```text
http://localhost:3000/mcp
```

## Build and run

```bash
pnpm build
pnpm start
```

## ChatGPT app connection

1. Ensure your MCP endpoint is public HTTPS (deploy or tunnel localhost).
2. In ChatGPT: **Settings → Apps & Connectors → Advanced settings → Developer mode**.
3. In **Apps & Connectors**, create an app with MCP URL ending in `/mcp`.
4. After MCP tool metadata changes, open app settings and click **Refresh**.

## Tool contract

Both tools return structured content in this shape:

```ts
{
  kind: "dashboard",
  dashboard: DashboardSnapshot
}
```

`DashboardSnapshot` includes summary, meal groups, and weekly trend so the widget can stay mounted and swap days via tool calls.

## Supabase phase boundary

Current behavior uses a mock repository.

Supabase integration scaffolding is already in place:

- client factory: `app/mcp/supabase/client.ts`
- repository boundary: `app/mcp/repositories/types.ts`
- swap point: `createDashboardRepository()` in `app/mcp/repositories/index.ts`

Phase 2 should replace the fallback in `SupabaseDashboardRepository` with real queries.
