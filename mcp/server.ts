#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import our existing API clients
import { HealthMetric, ReleaseHighlight } from "../types/digest.js";

// GitHub API client
async function fetchGitHubReleases(repo: string): Promise<ReleaseHighlight[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  const [owner, repoName] = repo.split("/");
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const releases = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return releases.map((release: any) => ({
    id: `gh-${release.id}`,
    title: release.name || release.tag_name,
    description: release.body || "Release notes",
    impact: release.prerelease ? "Beta release" : "Production release",
    shippedAt: release.published_at || release.created_at,
    owner: release.author?.login || "GitHub",
    tags: release.prerelease ? ["prerelease"] : ["production"],
  }));
}

// DataDog API client
async function fetchDataDogMetrics(productId: string): Promise<HealthMetric[]> {
  const apiKey = process.env.DATADOG_API_KEY;
  const appKey = process.env.DATADOG_APP_KEY;
  const site = process.env.DATADOG_SITE || "datadoghq.com";

  if (!apiKey || !appKey) {
    throw new Error("DataDog credentials not configured");
  }

  const baseUrl = `https://api.${site}`;
  const from = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const to = Math.floor(Date.now() / 1000);

  const queries = [
    {
      name: "Crash-free sessions",
      query: `sum:session.crash{env:production,service:${productId}}`,
      target: "99.0%",
    },
    {
      name: "Deployment success rate",
      query: `avg:kubernetes_state.deployment.replicas_available{kube_deployment:${productId}}`,
      target: "98.0%",
    },
  ];

  const metricsPromises = queries.map(async (metricQuery) => {
    const response = await fetch(
      `${baseUrl}/api/v1/query?from=${from}&to=${to}&query=${encodeURIComponent(
        metricQuery.query
      )}`,
      {
        headers: {
          "DD-API-KEY": apiKey,
          "DD-APPLICATION-KEY": appKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DataDog API error: ${response.status}`);
    }

    const data = await response.json();
    const pointlist = data.series?.[0]?.pointlist || [];
    const latestPoint = pointlist[pointlist.length - 1];
    const currentValue = latestPoint ? latestPoint[1] : 0;

    const prevValue =
      pointlist.length > 1 ? pointlist[pointlist.length - 2][1] : currentValue;
    const trend =
      currentValue > prevValue
        ? "up"
        : currentValue < prevValue
        ? "down"
        : "stable";
    const delta = `${(currentValue - prevValue).toFixed(1)}pp`;

    const status: "healthy" | "warning" | "critical" =
      currentValue >= 95
        ? "healthy"
        : currentValue >= 90
        ? "warning"
        : "critical";

    return {
      id: `dd-${metricQuery.name.toLowerCase().replace(/\s+/g, "-")}`,
      label: metricQuery.name,
      value: currentValue.toFixed(1) + "%",
      delta,
      trend,
      status,
      target: metricQuery.target,
      note: `Last 24h average from DataDog`,
    };
  });

  return await Promise.all(metricsPromises);
}

// Incidents placeholder
async function fetchIncidents(_productId: string): Promise<string[]> {
  // Placeholder for PagerDuty/OpsGenie integration
  return ["No active incidents"];
}

// Create MCP server
const server = new Server(
  {
    name: "release-pilot-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "releases_fetchLatest",
        description: "Fetch the latest releases from a GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "GitHub repository in format 'owner/repo'",
            },
          },
          required: ["repo"],
        },
      },
      {
        name: "metrics_getHealth",
        description: "Get health metrics for a product from DataDog",
        inputSchema: {
          type: "object",
          properties: {
            productId: {
              type: "string",
              description: "Product identifier to fetch metrics for",
            },
          },
          required: ["productId"],
        },
      },
      {
        name: "incidents_listRecent",
        description: "List recent incidents for a product",
        inputSchema: {
          type: "object",
          properties: {
            productId: {
              type: "string",
              description: "Product identifier to fetch incidents for",
            },
          },
          required: ["productId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "releases_fetchLatest": {
        const releases = await fetchGitHubReleases(args.repo as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(releases, null, 2),
            },
          ],
        };
      }

      case "metrics_getHealth": {
        const metrics = await fetchDataDogMetrics(args.productId as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(metrics, null, 2),
            },
          ],
        };
      }

      case "incidents_listRecent": {
        const incidents = await fetchIncidents(args.productId as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(incidents, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Release Pilot MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
