import { NextRequest } from "next/server";

import { listDigests, triggerDigestRun } from "@/lib/digest-service";

export async function GET() {
  const digests = await listDigests();
  return Response.json({ digests });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    dryRun?: boolean;
  };

  const productId = body.productId ?? "launchpad";
  const result = await triggerDigestRun({ productId, dryRun: body.dryRun });

  return Response.json(result, { status: result.ok ? 200 : 500 });
}

