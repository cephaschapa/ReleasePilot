import { DigestEntry, HealthMetric, ReleaseHighlight } from "@/types/digest";

const baseHighlights: ReleaseHighlight[] = [
  {
    id: "hl-001",
    title: "Unified release timeline",
    description: "Daily timeline page now links PRs, incidents, and Jira epics.",
    impact: "Gives PMs a single source of truth for release readiness.",
    shippedAt: new Date().toISOString(),
    owner: "Launchpad Core",
    tags: ["release", "visibility", "platform"],
  },
  {
    id: "hl-002",
    title: "Slack acknowledgement workflow",
    description:
      "Stakeholders can acknowledge digests directly from Slack, feeding back to the dashboard.",
    impact: "Improves accountability and provides read receipts for PM leadership.",
    shippedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    owner: "Eng Productivity",
    tags: ["slack", "automation"],
  },
  {
    id: "hl-003",
    title: "Realtime health card API",
    description:
      "New MCP tool queries observability APIs to build per-release health cards.",
    impact: "PMs can spot regression signals without leaving the digest.",
    shippedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    owner: "Telemetry",
    tags: ["mcp", "metrics", "api"],
  },
];

const baseMetrics: HealthMetric[] = [
  {
    id: "mt-001",
    label: "Crash-free sessions",
    value: "99.4%",
    delta: "+0.3pp",
    trend: "up",
    status: "healthy",
    target: "99.0%",
    note: "Spike from mobile beta cohort resolved.",
  },
  {
    id: "mt-002",
    label: "Deployment success rate",
    value: "96%",
    delta: "-2pp",
    trend: "down",
    status: "warning",
    target: "98%",
    note: "Two rollbacks triggered auto-pauses; fix shipping today.",
  },
  {
    id: "mt-003",
    label: "Active workspaces",
    value: "1,240",
    delta: "+4%",
    trend: "up",
    status: "healthy",
    note: "Growth driven by new onboarding flow AB test.",
  },
];

export const mockDigests: DigestEntry[] = [
  {
    id: "dg-2025-11-21",
    productId: "launchpad",
    title: "Launchpad daily release brief",
    summary:
      "Top-line metrics remain healthy while deployment reliability is under watch. Slack acknowledgement workflow is live and adoption is trending up.",
    date: new Date().toISOString(),
    status: "warning",
    highlights: baseHighlights,
    metrics: baseMetrics,
    incidents: [
      "Two deploy rollbacks between 02:00-04:00 UTC due to config drift; auto-pauses cleared.",
    ],
    sources: [
      "mcp://releases/fetch-latest?product=launchpad",
      "mcp://metrics/health-card?product=launchpad",
      "slack://eng-announce/threads/abc123",
    ],
  },
  {
    id: "dg-2025-11-20",
    productId: "launchpad",
    title: "Launchpad daily release brief",
    summary:
      "Feature flags cleaned up across three services and error budget stayed comfortable.",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: "healthy",
    highlights: baseHighlights.slice(0, 2),
    metrics: baseMetrics.map((metric) =>
      metric.id === "mt-002"
        ? { ...metric, value: "98%", delta: "+1pp", trend: "up", status: "healthy" }
        : metric
    ),
    incidents: [],
    sources: [
      "mcp://releases/fetch-latest?product=launchpad&day=-1",
      "pagerduty://incidents/closed?since=24h",
    ],
  },
];

