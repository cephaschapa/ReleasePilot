# Slack Integration Setup

## Overview
Release Pilot integrates with Slack via the Bolt framework to provide:
- `/digest` slash command for on-demand summaries
- Daily automated digest notifications
- Interactive buttons (Acknowledge, View Details)
- App mentions (@ReleasePilot)

## Setup Steps

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `Release Pilot`
4. Pick your workspace
5. Click **Create App**

### 2. Configure Bot Scopes

Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:

- `chat:write` - Post messages
- `commands` - Use slash commands
- `app_mentions:read` - Respond to @mentions
- `channels:read` - List channels
- `groups:read` - List private channels

### 3. Create Slash Command

Go to **Slash Commands** → **Create New Command**:

- **Command**: `/digest`
- **Request URL**: `https://your-app.vercel.app/api/slack/events`
- **Short Description**: Get the latest release digest
- **Usage Hint**: `[channel]` (optional: post to channel instead of just you)

### 4. Enable Events

Go to **Event Subscriptions** → Enable Events:

- **Request URL**: `https://your-app.vercel.app/api/slack/events`
- Wait for verification ✅

Subscribe to **Bot Events**:
- `app_mention` - Respond when mentioned

### 5. Install to Workspace

Go to **OAuth & Permissions** → Click **Install to Workspace** → **Allow**

Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 6. Get Signing Secret

Go to **Basic Information** → **App Credentials** → Copy **Signing Secret**

### 7. Add to `.env`

```bash
SLACK_BOT_TOKEN="xoxb-your-bot-token-here"
SLACK_SIGNING_SECRET="your-signing-secret-here"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"  # For "View Details" button
```

### 8. Deploy & Test

Deploy to Vercel (or restart local server with ngrok):

```bash
# Local testing with ngrok
ngrok http 3000
# Use ngrok URL as Request URL in Slack app settings
```

Test in Slack:
- `/digest` - Get latest digest (private)
- `/digest channel` - Post digest to channel
- `@ReleasePilot what shipped?` - Ask questions

## Features

### Slash Command Output

```
📊 Launchpad daily release brief
Status: ✅ HEALTHY
Date: 11/21/2025, 8:05 AM

Status HEALTHY: Test Pilot v1 shipped and Crash-free sessions sits at 99.4%

🚀 Release Highlights
• Test Pilot v1 - **Full Changelog**: https://github.com/...

📈 Health Metrics
• Crash-free sessions: 99.4% ↗️ (+0.3pp)
• Deployment success rate: 96% ↘️ (-2pp)

[View Details] [👍 Acknowledged]
```

### Daily Automated Notifications

Add a cron job or scheduled function to post daily:

```typescript
// In your cron handler
import { slackApp } from "@/lib/slack-service";

await slackApp.client.chat.postMessage({
  channel: "C1234567890", // Your channel ID
  blocks: [...digestBlocks],
});
```

## Troubleshooting

### URL Verification Failed
- Make sure server is running and publicly accessible
- Check Slack signing secret is correct in `.env`
- Redeploy and try again

### Commands Not Working
- Verify `/digest` is created with correct Request URL
- Check Bot Token starts with `xoxb-`
- Ensure bot is invited to channels: `/invite @Release Pilot`

### Mentions Not Working
- Add `app_mention` to Event Subscriptions
- Reinstall app to workspace after changes

