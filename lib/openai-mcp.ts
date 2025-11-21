import "dotenv/config";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DigestEntry } from "@/types/digest";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let mcpClient: Client | null = null;

async function getMcpClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  const client = new Client(
    {
      name: "release-pilot-openai",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "./mcp/server.ts"],
  });

  await client.connect(transport);
  mcpClient = client;
  return client;
}

export async function askWithMcp(
  message: string,
  digests: DigestEntry[]
): Promise<string> {
  const client = await getMcpClient();

  // Get available tools from MCP server
  const toolsResponse = await client.listTools();
  const mcpTools = toolsResponse.tools;

  // Convert MCP tools to OpenAI function format
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = mcpTools.map(
    (tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema,
      },
    })
  );

  // Build context from recent digests
  const context = digests
    .slice(0, 3)
    .map(
      (d) =>
        `Date: ${new Date(d.date).toLocaleDateString()}
Status: ${d.status}
Summary: ${d.summary}
Recent Highlights: ${d.highlights.length} releases tracked
Recent Metrics: ${d.metrics.length} metrics monitored`
    )
    .join("\n\n");

  // First LLM call - let it decide which tools to use
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are Release Pilot, an AI assistant with access to real-time release and metrics data via MCP tools.

Use the available tools to answer questions about:
- Recent releases (use releases_fetchLatest)
- Health metrics (use metrics_getHealth)
- Incidents (use incidents_listRecent)

Current digest context:
${context}

Be concise and specific. Use tool data to ground your responses.`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
  });

  let assistantMessage = response.choices[0].message;
  messages.push(assistantMessage);

  // Handle tool calls if LLM wants to use them
  while (
    assistantMessage.tool_calls &&
    assistantMessage.tool_calls.length > 0
  ) {
    // Execute all tool calls
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        try {
          // Call MCP tool
          const result = await client.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          const textContent = result.content.find((c) => c.type === "text");
          return {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content:
              textContent && textContent.type === "text"
                ? textContent.text
                : "No data",
          };
        } catch (error) {
          return {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: `Error calling ${toolName}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      })
    );

    // Add tool results to conversation
    messages.push(...toolResults);

    // Get final response from LLM with tool results
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);
  }

  return assistantMessage.content || "I couldn't generate a response.";
}

// Cleanup on exit
process.on("SIGINT", async () => {
  if (mcpClient) {
    await mcpClient.close();
  }
  process.exit(0);
});
