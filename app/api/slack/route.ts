import { NextRequest } from "next/server";
import { slackReceiver } from "@/lib/slack-service";

export async function POST(request: NextRequest) {
  // Convert Next.js request to Express-compatible format for Slack Bolt
  const body = await request.text();
  
  // Create Express-like req/res objects
  const req = {
    body: body,
    headers: Object.fromEntries(request.headers.entries()),
    method: "POST",
    url: request.url,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(data: string) {
      this.body = data;
    },
    body: "",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  // Let Slack Bolt handle the request
  await slackReceiver.requestListener(req, res);

  // Return response
  return new Response(res.body, {
    status: res.statusCode,
    headers: res.headers,
  });
}

