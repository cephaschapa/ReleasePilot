## Release Pilot

Release Pilot is a MCP-powered daily digest surface that summarizes "what shipped and how it's performing" for PMs and stakeholders. Now with real-time GitHub integration and AI-powered insights! It aggregates release notes, health metrics, and incident context, then distributes the story through a Next.js chat UI and Slack. Digests persist via Prisma to SQLite by default, but you can point `DATABASE_URL` at Supabase/Neon/Postgres and the Prisma Neon adapter will handle the connection automatically.

### Features

- **Digest timeline** – Server-rendered list of recent summaries with status, metrics, incidents, and source trails.
- **Chat assistant** – “Release Pilot” chat with quick actions for latest digest, health metrics, and incidents. Backed by stubbed MCP/LLM logic (ready to swap for a real model).
- **MCP simulation** – `lib/mcp-client.ts` mimics tool calls (`releases.fetchLatest`, `metrics.getHealth`, `incidents.listRecent`) so the UI works before wiring real endpoints.
- **Digest orchestration API** – `/api/digests` exposes GET (list) and POST (trigger) endpoints that the UI, Slack, or scheduled jobs can call.
- **Slack integration** – `/api/slack` handles slash commands and URL verification, responding with the latest digest.
- **Documentation** – `docs/architecture.md` describes the end-to-end system, flow, and next steps (auth, DB, scheduling, true MCP/LLM).

### Getting Started

```bash
npm install
echo DATABASE_URL="file:./prisma/dev.db" > .env  # or set to your Postgres/Neon URL
npx prisma migrate dev
npm run dev
# visit http://localhost:3000
```

### Environment Variables

Create `.env` with:

```
# SQLite (default dev)
DATABASE_URL="file:./prisma/dev.db"

# or Neon / Supabase / Postgres
# DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Slack Integration (see docs/slack-setup.md for full setup)
SLACK_BOT_TOKEN="xoxb-..."                # Slack Bot User OAuth Token
SLACK_SIGNING_SECRET="..."                # Slack App Signing Secret
NEXT_PUBLIC_APP_URL="http://localhost:3000" # Your app URL (for buttons)

## DataDog Setup

To integrate with DataDog for real health metrics:

1. **Create API Keys** in DataDog:
   - Go to [DataDog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
   - Create an **API Key** and **Application Key**

2. **Configure Environment**:
   ```bash
   DATADOG_API_KEY="your-api-key-here"
   DATADOG_APP_KEY="your-app-key-here"
   DATADOG_SITE="datadoghq.com"  # or datadoghq.eu, etc.
   ```

3. **Ensure Metrics Exist**:
   - The integration queries these metrics (customize queries in `lib/mcp-client.ts`):
     - `session.crash` and `session.count` (for crash-free rate)
     - `kubernetes_state.deployment.*` (for deployment success)
     - `trace.servlet.request` (for active usage)

4. **Tag Your Services**:
   - Ensure your services are tagged with `service:your-product-id` in DataDog

### MCP Integration (optional - falls back to mock data)
GITHUB_TOKEN="ghp_..."                    # GitHub Personal Access Token for releases
GITHUB_REPO="owner/repo"                  # GitHub repo (defaults to productId/productId)

# OpenAI for LLM-powered chat (optional - falls back to canned responses)
OPENAI_API_KEY="sk-proj-..."              # OpenAI API key for chat completions

# DataDog Metrics (optional)
DATADOG_API_KEY="..."                     # DataDog API Key
DATADOG_APP_KEY="..."                     # DataDog Application Key
DATADOG_SITE="datadoghq.com"              # DataDog site (datadoghq.com, datadoghq.eu, etc.)

# Alternative Metrics APIs (unimplemented placeholders)
METRICS_API_URL="https://api.datadoghq.com" # Generic metrics API endpoint
METRICS_API_KEY="..."                     # Generic metrics API authentication

# Incidents API (unimplemented placeholder)
INCIDENTS_API_URL="https://api.pagerduty.com" # Incidents API endpoint
INCIDENTS_API_KEY="..."                   # Incidents API authentication
```

### Key Commands

- `npm run dev` – start local development server.
- `npm run build` – production build (Next.js).
- `npm run lint` – lint with `eslint-config-next`.
- `npm run prisma:migrate` – run `prisma migrate dev`.
- `npm run prisma:studio` – open Prisma Studio for data inspection.

### Project Structure

```
app/
  api/
    chat/route.ts      # Chat completion endpoint
    digests/route.ts   # List or trigger digest runs
    slack/route.ts     # Slash command responder
  page.tsx             # Digest timeline + chat layout
components/
  chat-panel.tsx & styles
  digest-card.tsx & styles
lib/
  chat-service.ts      # Quick actions + assistant replies
  digest-service.ts    # Orchestrates MCP + Prisma persistence
  mcp-client.ts        # Simulated MCP tool calls
  mock-data.ts         # Temporary seed data
  prisma.ts            # Prisma client helper
types/
  digest.ts            # Shared domain types
docs/
  architecture.md
```

### Next Steps

- Scale SQLite to Supabase/Postgres for multi-environment deploys.
- Wire MCP client to real tool hosts (e.g., GitHub releases, analytics APIs).
- Add authentication + admin panel for configuring sources/schedules.
- Connect Slack slash commands to OAuth/Bolt and push daily notifications.
- Promote `/api/digests` to a scheduled Vercel Cron or external worker.
