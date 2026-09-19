# Zephyr MD Bot

Zephyr MD is a WhatsApp automation bot with real web-based pairing, owner-aware command routing, and Render-ready persistent sessions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `npm --prefix zephyr-bot start` — run the WhatsApp bot and pairing website
- `npm --prefix zephyr-bot run check` — validate the bot JavaScript
- `npm --prefix zephyr-bot test` — run the lightweight command smoke test
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- API artifact env: `DATABASE_URL` — Postgres connection string
- Bot env: `PORT`, `MAIN_PAIR_SECRET`, `PAIRING_API_KEY`, `OWNER_NUMBERS`, and optional `ZEPHYR_STORAGE_DIR`

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `zephyr-bot/index.js` — bot runtime and same-origin pairing website API
- `zephyr-bot/pair.js` — linked-number sessions and persistence
- `zephyr-bot/menu.js` — command dispatcher for core, v1, group, control, and imported commands
- `zephyr-bot/public/index.html` — connected pairing page
- `render.yaml` — Render service with persistent storage configuration

## Architecture decisions

- The number that completes pairing is stored as an owner identity for that bot session.
- The pairing page uses the server's real WhatsApp pairing-code response; it never displays a fixed code.
- Bot runtime state is redirected to `ZEPHYR_STORAGE_DIR` when persistent storage is mounted.

## Product

The bot supports WhatsApp command routing, group administration, owner/premium controls, linked-number management, and a public page for generating real pairing codes. The requested WhatsApp channel is linked from the site and bot menu.

## User preferences

Keep the pairing API same-origin and rate-limited. Do not commit WhatsApp session credentials, pairing records, or environment secrets.

## Gotchas

- The Baileys package may be blocked in restricted environments; use static checks and the smoke test when local installation is unavailable.
- Render must mount persistent storage and set `ZEPHYR_STORAGE_DIR`, otherwise WhatsApp sessions are lost on restart.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
