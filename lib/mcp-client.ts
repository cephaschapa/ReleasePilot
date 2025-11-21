import "dotenv/config";

import { ReleaseHighlight, HealthMetric } from "@/types/digest";
import { mockDigests } from "./mock-data";

// GitHub API response types
interface GitHubRelease {
  id: number;
  name?: string;
  tag_name: string;
  body?: string;
  prerelease: boolean;
  published_at?: string;
  created_at: string;
  author?: {
    login: string;
  };
}

type ToolName =
  | "releases.fetchLatest"
  | "metrics.getHealth"
  | "incidents.listRecent";

export interface McpInvocation {
  tool: ToolName;
  productId: string;
  timeframe?: string;
}

export interface McpResult<T> {
  source: string;
  capturedAt: string;
  payload: T;
}

// Helper function for making API calls with fallback
async function callApiWithFallback<T>(
  url: string,
  options: RequestInit,
  fallback: () => T,
  source: string
): Promise<McpResult<T>> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      console.warn(`API call failed (${response.status}): ${url}`);
      return {
        source: `${source} (fallback)`,
        capturedAt: new Date().toISOString(),
        payload: fallback(),
      };
    }

    const data = await response.json();
    return {
      source,
      capturedAt: new Date().toISOString(),
      payload: data as T,
    };
  } catch (error) {
    console.warn(`API call error: ${error} for ${url}`);
    return {
      source: `${source} (fallback)`,
      capturedAt: new Date().toISOString(),
      payload: fallback(),
    };
  }
}

export async function fetchReleaseHighlights(productId: string) {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || `${productId}/${productId}`;

  if (!githubToken) {
    console.warn("GITHUB_TOKEN not set, using mock data");
    return {
      source: `mock://releases/fetchLatest?product=${productId}`,
      capturedAt: new Date().toISOString(),
      payload: mockDigests[0].highlights,
    };
  }

  const [owner, repo] = githubRepo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;

  return callApiWithFallback<ReleaseHighlight[]>(
    url,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
    () => mockDigests[0].highlights,
    `github://repos/${owner}/${repo}/releases`
  ).then(async (result) => {
    // Transform GitHub API response to ReleaseHighlight format
    if (result.source.includes("github://")) {
      try {
        const transformed = (result.payload as unknown as GitHubRelease[]).map(
          (release: GitHubRelease): ReleaseHighlight => ({
            id: `gh-${release.id}`,
            title: release.name || release.tag_name,
            description: release.body || "Release notes",
            impact: release.prerelease ? "Beta release" : "Production release",
            shippedAt: release.published_at || release.created_at,
            owner: release.author?.login || "GitHub",
            tags: release.prerelease ? ["prerelease"] : ["production"],
          })
        );
        return {
          ...result,
          payload: transformed,
        };
      } catch (error) {
        console.warn("Failed to transform GitHub releases:", error);
        return {
          ...result,
          payload: mockDigests[0].highlights,
        };
      }
    }
    return result;
  });
}

export async function fetchHealthMetrics(productId: string) {
  const datadogApiKey = process.env.DATADOG_API_KEY;
  const datadogAppKey = process.env.DATADOG_APP_KEY;
  const datadogSite = process.env.DATADOG_SITE || "datadoghq.com";

  if (!datadogApiKey || !datadogAppKey) {
    console.warn("DataDog credentials not configured, using mock data");
    return {
      source: `mock://metrics/getHealth?product=${productId}`,
      capturedAt: new Date().toISOString(),
      payload: mockDigests[0].metrics,
    };
  }

  const baseUrl = `https://api.${datadogSite}`;
  const from = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 24 hours ago
  const to = Math.floor(Date.now() / 1000);

  // Query DataDog for key metrics
  const queries = [
    {
      name: "Crash-free sessions",
      query: `sum:session.crash{env:production,service:${productId}} / sum:session.count{env:production,service:${productId}} * 100`,
      target: "99.0%",
    },
    {
      name: "Deployment success rate",
      query: `avg:kubernetes_state.deployment.replicas_available{kube_deployment:${productId}} / avg:kubernetes_state.deployment.replicas_desired{kube_deployment:${productId}} * 100`,
      target: "98.0%",
    },
    {
      name: "Active workspaces",
      query: `count:trace.servlet.request{env:production,service:${productId}}`,
      target: "1000+",
    },
  ];

  try {
    const metricsPromises = queries.map(async (metricQuery) => {
      const response = await fetch(
        `${baseUrl}/api/v1/query?from=${from}&to=${to}&query=${encodeURIComponent(
          metricQuery.query
        )}`,
        {
          headers: {
            "DD-API-KEY": datadogApiKey,
            "DD-APPLICATION-KEY": datadogAppKey,
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

      // Calculate trend from last few points
      const prevValue =
        pointlist.length > 1
          ? pointlist[pointlist.length - 2][1]
          : currentValue;
      const trend =
        currentValue > prevValue
          ? "up"
          : currentValue < prevValue
          ? "down"
          : "stable";
      const delta = `${(currentValue - prevValue).toFixed(1)}pp`;

      // Determine status based on target
      let status: "healthy" | "warning" | "critical" = "healthy";
      if (metricQuery.name.includes("Crash")) {
        status =
          currentValue >= 99
            ? "healthy"
            : currentValue >= 95
            ? "warning"
            : "critical";
      } else if (metricQuery.name.includes("Deployment")) {
        status =
          currentValue >= 95
            ? "healthy"
            : currentValue >= 90
            ? "warning"
            : "critical";
      }

      return {
        id: `dd-${metricQuery.name.toLowerCase().replace(/\s+/g, "-")}`,
        label: metricQuery.name,
        value:
          currentValue.toFixed(1) +
          (metricQuery.name.includes("rate") ? "%" : ""),
        delta,
        trend,
        status,
        target: metricQuery.target,
        note: `Last 24h average from DataDog`,
      } as HealthMetric;
    });

    const metrics = await Promise.all(metricsPromises);

    return {
      source: `datadog://api.${datadogSite}/query?service=${productId}`,
      capturedAt: new Date().toISOString(),
      payload: metrics,
    };
  } catch (error) {
    console.warn("DataDog API error:", error);
    return {
      source: `mock://metrics/getHealth?product=${productId} (DataDog failed)`,
      capturedAt: new Date().toISOString(),
      payload: mockDigests[0].metrics,
    };
  }
}

export async function fetchIncidents(productId: string) {
  // Placeholder for incident API integration
  // This could be PagerDuty, OpsGenie, or internal incident tracking
  const incidentsApiUrl = process.env.INCIDENTS_API_URL;
  const incidentsApiKey = process.env.INCIDENTS_API_KEY;

  if (!incidentsApiUrl || !incidentsApiKey) {
    console.warn("Incidents API not configured, using mock data");
    return {
      source: `mock://incidents/listRecent?product=${productId}`,
      capturedAt: new Date().toISOString(),
      payload: mockDigests[0].incidents,
    };
  }

  // Placeholder implementation - replace with actual incidents API
  return callApiWithFallback<string[]>(
    `${incidentsApiUrl}/incidents?product=${productId}&status=resolved&limit=5`,
    {
      headers: {
        Authorization: `Bearer ${incidentsApiKey}`,
        "Content-Type": "application/json",
      },
    },
    () => mockDigests[0].incidents,
    `${incidentsApiUrl}/incidents`
  ).then(async (result) => {
    // Transform API response to string array if needed
    if (!Array.isArray(result.payload)) {
      return {
        ...result,
        payload: mockDigests[0].incidents,
      };
    }
    return result;
  });
}
