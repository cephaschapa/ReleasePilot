import "dotenv/config";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";

import { ChatMessage, DigestEntry, QuickAction } from "@/types/digest";
import { getLatestDigest, listDigests } from "./digest-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT =
  "You are Release Pilot, an MCP-aware assistant that summarizes releases and health metrics for PMs. Keep answers grounded in provided digest data.";

const quickActions: QuickAction[] = [
  {
    id: "latest_digest",
    label: "Today's digest",
    prompt: "Summarize what shipped today.",
    description: "Overview of release highlights and incidents.",
  },
  {
    id: "health_focus",
    label: "Health metrics",
    prompt: "How are key health metrics trending?",
    description: "Crash-free, deployments, adoption.",
  },
  {
    id: "incidents",
    label: "Incidents",
    prompt: "Any incidents I should know about?",
    description: "Summarize open risks or mitigations.",
  },
];

export function getQuickActions() {
  return quickActions;
}

export async function bootstrapMessages(): Promise<ChatMessage[]> {
  const latest = await getLatestDigest();

  return [
    {
      id: randomUUID(),
      role: "system",
      content: SYSTEM_PROMPT,
      timestamp: new Date().toISOString(),
    },
    latest
      ? {
          id: randomUUID(),
          role: "assistant",
          content: `Morning! ${latest.summary}`,
          timestamp: new Date().toISOString(),
        }
      : undefined,
  ].filter(Boolean) as ChatMessage[];
}

interface AskOptions {
  message: string;
  actionId?: string;
}

export async function askDigestBot(
  options: AskOptions
): Promise<{ reply: ChatMessage; references: DigestEntry[] }> {
  const digests = await listDigests();
  const latest = digests[0];

  // If OpenAI is configured, use it; otherwise fall back to canned responses
  let replyContent: string;

  if (process.env.OPENAI_API_KEY) {
    try {
      replyContent = await askOpenAI(options.message, digests);
    } catch (error) {
      console.warn("OpenAI error, falling back to canned response:", error);
      replyContent = buildReply(options, latest, digests);
    }
  } else {
    replyContent = buildReply(options, latest, digests);
  }

  return {
    reply: {
      id: randomUUID(),
      role: "assistant",
      content: replyContent,
      timestamp: new Date().toISOString(),
      actionId: options.actionId,
    },
    references: digests,
  };
}

function buildReply(
  options: AskOptions,
  latest: DigestEntry | undefined,
  digests: DigestEntry[]
) {
  if (!latest) {
    return "I don't have any digests yet, but you can trigger one from the admin panel or Slack.";
  }

  switch (options.actionId) {
    case "latest_digest":
      return summarizeDigest(latest);
    case "health_focus":
      return summarizeMetrics(latest);
    case "incidents":
      return summarizeIncidents(latest);
    default:
      return fallbackSummary(options.message, latest, digests);
  }
}

function summarizeDigest(digest: DigestEntry) {
  const topHighlights = digest.highlights
    .slice(0, 2)
    .map((highlight) => `• ${highlight.title}: ${highlight.impact}`)
    .join("\n");

  return `${digest.summary}\n\nHighlights:\n${topHighlights}`;
}

function summarizeMetrics(digest: DigestEntry) {
  const metrics = digest.metrics
    .map(
      (metric) =>
        `• ${metric.label}: ${metric.value} (${metric.delta}, ${metric.trend}) – ${metric.status}`
    )
    .join("\n");

  return `Here's how health looks for ${digest.title}:\n${metrics}`;
}

function summarizeIncidents(digest: DigestEntry) {
  if (!digest.incidents.length) {
    return "No incidents were reported in the last cycle.";
  }

  return `Incident recap:\n${digest.incidents
    .map((incident) => `• ${incident}`)
    .join("\n")}`;
}

async function askOpenAI(
  message: string,
  digests: DigestEntry[]
): Promise<string> {
  // Build context from recent digests
  const context = digests
    .slice(0, 3)
    .map(
      (d) =>
        `Date: ${new Date(d.date).toLocaleDateString()}
Status: ${d.status}
Summary: ${d.summary}
Highlights: ${d.highlights
          .map((h) => `- ${h.title}: ${h.description}`)
          .join("\n")}
Metrics: ${d.metrics
          .map((m) => `- ${m.label}: ${m.value} (${m.trend})`)
          .join("\n")}
Incidents: ${d.incidents.join("; ")}`
    )
    .join("\n\n---\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are Release Pilot, an AI assistant that helps PMs understand release health and deployment status. 

Be concise and specific. Reference actual data from the digests provided. Use bullet points when listing multiple items. Keep responses under 150 words unless more detail is explicitly requested.

Current context:
${context}`,
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return (
    completion.choices[0]?.message?.content ||
    "I couldn't generate a response. Please try again."
  );
}

function fallbackSummary(
  message: string,
  latest: DigestEntry,
  digests: DigestEntry[]
) {
  if (
    message.toLowerCase().includes("trend") ||
    message.toLowerCase().includes("week")
  ) {
    const trendLine = digests
      .slice(0, 4)
      .map(
        (digest) =>
          `${new Date(digest.date).toLocaleDateString()}: ${digest.status}`
      )
      .join(" → ");
    return `${summarizeMetrics(latest)}\n\n7-day trend: ${trendLine}`;
  }

  if (message.toLowerCase().includes("highlight")) {
    return summarizeDigest(latest);
  }

  return `${latest.summary}\nNeed more detail? Ask for "health metrics" or "incidents".`;
}
