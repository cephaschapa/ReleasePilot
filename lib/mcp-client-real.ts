import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ReleaseHighlight, HealthMetric } from "@/types/digest";

let mcpClient: Client | null = null;
let isConnecting = false;

async function getMcpClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  if (isConnecting) {
    // Wait for existing connection
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getMcpClient();
  }

  isConnecting = true;

  try {
    const client = new Client(
      {
        name: "release-pilot-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: ["./mcp/server.js"],
    });

    await client.connect(transport);
    mcpClient = client;
    isConnecting = false;
    return client;
  } catch (error) {
    isConnecting = false;
    throw error;
  }
}

export async function callMcpTool<T>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await getMcpClient();

  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  if (result.isError) {
    throw new Error(
      `MCP tool error: ${result.content[0]?.text || "Unknown error"}`
    );
  }

  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in MCP response");
  }

  return JSON.parse(textContent.text) as T;
}

export async function fetchReleaseHighlightsMcp(
  repo: string
): Promise<ReleaseHighlight[]> {
  return callMcpTool<ReleaseHighlight[]>("releases_fetchLatest", { repo });
}

export async function fetchHealthMetricsMcp(
  productId: string
): Promise<HealthMetric[]> {
  return callMcpTool<HealthMetric[]>("metrics_getHealth", { productId });
}

export async function fetchIncidentsMcp(productId: string): Promise<string[]> {
  return callMcpTool<string[]>("incidents_listRecent", { productId });
}

// Graceful shutdown
process.on("SIGINT", () => {
  if (mcpClient) {
    void mcpClient.close();
  }
  process.exit(0);
});
