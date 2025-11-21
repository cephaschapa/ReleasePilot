import { NextRequest } from "next/server";
import { slackApp } from "@/lib/slack-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    // Handle Slack URL verification
    if (headers["content-type"]?.includes("application/json")) {
      const payload = JSON.parse(body);
      if (payload.type === "url_verification") {
        return Response.json({ challenge: payload.challenge });
      }
    }

    // Process Slack events/commands using Bolt's built-in handler
    await slackApp.processEvent({
      body,
      headers,
    });

    return new Response("", { status: 200 });
  } catch (error) {
    console.error("Slack route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

