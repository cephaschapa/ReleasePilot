import "dotenv/config";
import { App } from "@slack/bolt";
import { getLatestDigest } from "./digest-service";

export const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});

// Slash command: /digest
slackApp.command("/digest", async ({ command, ack, respond }) => {
  await ack();

  const digest = await getLatestDigest();

  if (!digest) {
    await respond({
      text: "No digests available yet. Trigger a digest run first!",
      response_type: "ephemeral",
    });
    return;
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 ${digest.title}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Status:* ${getStatusEmoji(digest.status)} ${digest.status.toUpperCase()}\n*Date:* ${new Date(digest.date).toLocaleString()}\n\n${digest.summary}`,
      },
    },
    {
      type: "divider",
    },
  ];

  // Add highlights
  if (digest.highlights.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🚀 Release Highlights*\n${digest.highlights
          .map((h) => `• *${h.title}* - ${h.description.substring(0, 100)}`)
          .join("\n")}`,
      },
    });
  }

  // Add metrics
  if (digest.metrics.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📈 Health Metrics*\n${digest.metrics
          .map(
            (m) =>
              `• ${m.label}: *${m.value}* ${getTrendEmoji(m.trend)} (${m.delta})`
          )
          .join("\n")}`,
      },
    });
  }

  // Add incidents if any
  if (digest.incidents.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*⚠️ Incidents*\n${digest.incidents
          .map((i) => `• ${i}`)
          .join("\n")}`,
      },
    });
  }

  // Add action buttons
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Details",
        },
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        action_id: "view_details",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "👍 Acknowledged",
        },
        action_id: "acknowledge_digest",
        value: digest.id,
      },
    ],
  });

  await respond({
    blocks,
    response_type: command.text.includes("channel") ? "in_channel" : "ephemeral",
  });
});

// Button interaction: Acknowledge
slackApp.action("acknowledge_digest", async ({ ack, respond, body }) => {
  await ack();

  await respond({
    text: `✅ ${body.user.name} acknowledged the digest!`,
    response_type: "in_channel",
    replace_original: false,
  });
});

// App mention: @ReleasePilot
slackApp.event("app_mention", async ({ event, say }) => {
  const digest = await getLatestDigest();

  if (!digest) {
    await say({
      text: "No digest data available yet!",
      thread_ts: event.ts,
    });
    return;
  }

  await say({
    text: `Hey <@${event.user}>! ${digest.summary}`,
    thread_ts: event.ts,
  });
});

function getStatusEmoji(status: string): string {
  switch (status) {
    case "healthy":
      return "✅";
    case "warning":
      return "⚠️";
    case "critical":
      return "🚨";
    default:
      return "ℹ️";
  }
}

function getTrendEmoji(trend: string): string {
  switch (trend) {
    case "up":
      return "↗️";
    case "down":
      return "↘️";
    default:
      return "→";
  }
}

