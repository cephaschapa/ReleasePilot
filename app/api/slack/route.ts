import { NextRequest } from "next/server";

import { getLatestDigest } from "@/lib/digest-service";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await request.json();

    if (payload.type === "url_verification" && payload.challenge) {
      return Response.json({ challenge: payload.challenge });
    }
  }

  const formData = await request.formData();
  const token = formData.get("token")?.toString();
  const expectedToken = process.env.SLACK_VERIFICATION_TOKEN;

  if (expectedToken && token !== expectedToken) {
    return Response.json({ error: "Verification failed." }, { status: 401 });
  }

  const command = formData.get("command")?.toString() ?? "";
  const text = formData.get("text")?.toString() ?? "";

  const digest = await getLatestDigest();

  const body = digest
    ? buildSlackResponse(command, text, digest.summary, digest.metrics[0]?.value ?? "")
    : "No digest available. Run /digest run to create one.";

  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  });
}

function buildSlackResponse(
  command: string,
  text: string,
  summary: string,
  topMetric: string
) {
  if (command.includes("week") || text.includes("week")) {
    return `Weekly digest: ${summary}\nTop metric: ${topMetric}. View more in Release Pilot.`;
  }

  return `Today: ${summary}\nTop metric: ${topMetric}.`;
}

