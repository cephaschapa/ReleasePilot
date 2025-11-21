import { askDigestBot } from "@/lib/chat-service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    actionId?: string;
  };

  if (!body.message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const result = await askDigestBot({
    message: body.message,
    actionId: body.actionId,
  });

  return Response.json(result);
}

