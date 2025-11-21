import { NextRequest } from "next/server";
import { getLatestDigest } from "@/lib/digest-service";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const contentType = request.headers.get("content-type") || "";

    // Handle Slack URL verification
    if (contentType.includes("application/json")) {
      const payload = JSON.parse(rawBody);
      if (payload.type === "url_verification") {
        return Response.json({ challenge: payload.challenge });
      }
    }

    // Handle slash commands (URL-encoded)
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      const command = params.get("command");
      const text = params.get("text") || "";
      const responseUrl = params.get("response_url");

      if (command === "/digest") {
        const digest = await getLatestDigest();

        if (!digest) {
          return Response.json({
            response_type: "ephemeral",
            text: "No digests available yet. Trigger a digest run first!",
          });
        }

        const statusEmoji = digest.status === "healthy" ? "✅" : digest.status === "warning" ? "⚠️" : "🚨";
        
        return Response.json({
          response_type: text.includes("channel") ? "in_channel" : "ephemeral",
          blocks: [
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
                text: `*Status:* ${statusEmoji} ${digest.status.toUpperCase()}\n*Date:* ${new Date(digest.date).toLocaleString()}\n\n${digest.summary}`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*🚀 Release Highlights*\n${digest.highlights.length > 0 ? digest.highlights.map((h) => `• *${h.title}*`).join("\n") : "No highlights"}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*📈 Health Metrics*\n${digest.metrics.map((m) => {
                  const trendEmoji = m.trend === "up" ? "↗️" : m.trend === "down" ? "↘️" : "→";
                  return `• ${m.label}: *${m.value}* ${trendEmoji} (${m.delta})`;
                }).join("\n")}`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View Details",
                  },
                  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                },
              ],
            },
          ],
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Slack route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

