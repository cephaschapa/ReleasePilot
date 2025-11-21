## Release Pilot Architecture

### Overview

Release Pilot is a Next.js (App Router) application deployed on Vercel that generates daily “what shipped and how it’s performing” digests using Model Context Protocol (MCP) tools. It delivers the summaries through a web chat interface and Slack.

### Components

1. **Web App (Next.js)**
   - `app/page.tsx` shows the digest timeline and embeds a chat surface.
   - Client-side `ChatPanel` streams questions to `/api/chat`.
   - Minimal styling matches the profile-navigation aesthetic for consistency.

2. **Digest Orchestrator**
   - `app/api/digests/route.ts` exposes GET (list digests) and POST (trigger run) endpoints.
   - `lib/digest-service.ts` calls MCP shims and persists digests via Prisma to SQLite (seeded with `lib/mock-data.ts` for local dev).
   - `lib/mcp-client.ts` represents MCP tool invocations (`releases.fetchLatest`, `metrics.getHealth`, `incidents.listRecent`).

3. **Chat & MCP Summaries**
   - `lib/chat-service.ts` builds quick actions, bootstraps system messages, and crafts grounded replies from digest data.
   - `/api/chat` returns assistant messages and references for the UI.

4. **Slack Integration**
   - `/api/slack` handles slash commands or event verification, replying with the latest digest summary.
   - Uses `SLACK_VERIFICATION_TOKEN` for simple validation; extend with OAuth/Bolt if needed.

5. **Admin & Scheduling (next steps)**
   - `Trigger digest` button placeholder in layout; wire to POST `/api/digests`.
   - Vercel Cron or external worker should call `/api/digests` daily to refresh data.

### Data Flow

1. Cron hits `/api/digests` (POST) with `{ productId }`.
2. `triggerDigestRun` calls MCP tools → composes `DigestEntry` → stores snapshot.
3. Web page fetches `listDigests()` server-side and renders timeline + incidents + sources.
4. Chat panel seeds system + greeting messages, exposes quick actions.
5. `/api/chat` answers questions using stored digests (LLM placeholder) and returns citations.
6. Slack slash commands query `/api/slack`; response summarizes latest digest for channels.

### Extensibility

- Swap SQLite for Postgres/Supabase via Prisma when deploying to shared environments.
- Swap `askDigestBot` implementation for real LLM calls (OpenAI, Anthropic) with MCP function calling.
- Add user auth (NextAuth/Supabase) and RBAC for admin routes.
- Implement webhook ingestion for CI/CD to push release metadata into the digest pipeline.
- Add alerting by reusing `triggerDigestRun` logic inside metric breach monitors.

