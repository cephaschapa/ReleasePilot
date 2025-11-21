# MCP Architecture Options for Release Pilot

## Current Implementation (MCP-Inspired)

**Status**: API-based with MCP naming conventions

### How It Works:
```
User Question
    ↓
OpenAI Chat API (with context from digests)
    ↓
Direct API Calls (GitHub, DataDog)
    ↓
Response to User
```

**Pros**: 
- Simple, no extra servers
- Fast, direct API calls
- Easy to deploy (serverless)

**Cons**:
- Not using actual MCP protocol
- LLM can't dynamically choose tools
- Limited to pre-defined data flows

## True MCP Implementation

**Status**: Not implemented (can be added)

### Architecture:
```
User Question
    ↓
OpenAI with Function Calling
    ↓
MCP Client (stdio/HTTP)
    ↓
MCP Server(s) - GitHub, DataDog, PagerDuty
    ↓
Structured Tool Responses
    ↓
LLM Synthesizes Answer
```

### What Would Change:

1. **Add MCP Server Package**
```typescript
// mcp/server.ts
import { MCPServer } from '@modelcontextprotocol/sdk/server';

const server = new MCPServer({
  name: 'release-pilot-mcp',
  version: '1.0.0',
});

// Register tools
server.tool('releases.fetchLatest', async (params) => {
  const releases = await fetchFromGitHub(params.productId);
  return { content: releases };
});

server.tool('metrics.getHealth', async (params) => {
  const metrics = await fetchFromDataDog(params.productId);
  return { content: metrics };
});
```

2. **MCP Client in Chat Service**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpClient = new Client({
  name: 'release-pilot-client',
  version: '1.0.0',
});

// Connect to MCP server
await mcpClient.connect(new StdioClientTransport({
  command: 'node',
  args: ['./mcp/server.js'],
}));

// List available tools
const tools = await mcpClient.listTools();

// Call a tool
const result = await mcpClient.callTool({
  name: 'releases.fetchLatest',
  arguments: { productId: 'ReleasePilot' },
});
```

3. **OpenAI with Function Calling**
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  })),
  tool_choice: 'auto',
});

// If LLM wants to call a tool
if (completion.choices[0].message.tool_calls) {
  const toolCall = completion.choices[0].message.tool_calls[0];
  const result = await mcpClient.callTool({
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments),
  });
  // Send result back to LLM for final response
}
```

## Hybrid Approach (Recommended)

**Best of both worlds**: Keep current API calls, add MCP for advanced features

### Use MCP For:
- Complex data aggregation (LLM chooses what to fetch)
- Multi-step workflows (compare releases, analyze trends)
- Custom PM questions requiring multiple data sources

### Keep Direct APIs For:
- Scheduled digest generation (faster)
- Simple slash commands (lower latency)
- Cron jobs (no LLM needed)

## Implementation Steps (If Desired)

1. Install MCP SDK: `npm install @modelcontextprotocol/sdk`
2. Create MCP server process (separate file)
3. Define tools matching your current functions
4. Update OpenAI integration to use function calling
5. Connect MCP client in chat service
6. Deploy MCP server (could be same Vercel app or separate)

## When to Use True MCP

**Good reasons:**
- Need LLM to dynamically choose data sources
- Complex multi-step analysis
- Multiple MCP servers (GitHub, DataDog, internal tools)
- Reusable tools across different LLM applications

**Not needed if:**
- Simple, predictable data flows (current use case)
- Performance/latency critical
- Want simplest deployment

## Current State: Good Enough?

Your current setup works well for **"what shipped and how it's performing"** because:
- GitHub releases are fetched automatically ✓
- OpenAI answers questions intelligently ✓
- Slack notifications work ✓
- Fast and simple ✓

**Recommendation**: Keep current architecture unless you need dynamic tool selection or complex multi-step queries.

