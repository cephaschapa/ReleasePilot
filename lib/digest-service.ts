import { randomUUID } from "node:crypto";

import type { Digest as PrismaDigest } from "@prisma/client";

import {
  DigestEntry,
  DigestRunResult,
  DigestStatus,
  HealthMetric,
  ReleaseHighlight,
} from "@/types/digest";
import { mockDigests } from "./mock-data";
import {
  fetchHealthMetrics,
  fetchIncidents,
  fetchReleaseHighlights,
} from "./mcp-client";
import { prisma } from "./prisma";

let hasSeeded = false;

export async function listDigests(limit = 5): Promise<DigestEntry[]> {
  await ensureSeedData();

  const records = await prisma.digest.findMany({
    take: limit,
    orderBy: { date: "desc" },
  });

  return records.map(mapDigest);
}

export async function getLatestDigest(): Promise<DigestEntry | undefined> {
  const digests = await listDigests(1);
  return digests[0];
}

interface TriggerOptions {
  productId: string;
  dryRun?: boolean;
}

export async function triggerDigestRun(
  options: TriggerOptions
): Promise<DigestRunResult> {
  const startedAt = Date.now();

  try {
    const [releases, metrics, incidents] = await Promise.all([
      fetchReleaseHighlights(options.productId),
      fetchHealthMetrics(options.productId),
      fetchIncidents(options.productId),
    ]);

    const status = inferStatus(metrics.payload);
    const summary = createSummary(
      releases.payload,
      metrics.payload,
      incidents.payload,
      status
    );
    const sources = [releases.source, metrics.source, incidents.source];

    if (options.dryRun) {
      return {
        ok: true,
        digest: {
          id: `dg-preview-${Date.now()}`,
          productId: options.productId,
          title: "Launchpad daily release brief",
          summary,
          date: new Date().toISOString(),
          status,
          highlights: releases.payload,
          metrics: metrics.payload,
          incidents: incidents.payload,
          sources,
        },
        sources,
        durationMs: Date.now() - startedAt,
      };
    }

    const digestRecord = await prisma.digest.create({
      data: {
        productId: options.productId,
        title: "Launchpad daily release brief",
        summary,
        date: new Date(),
        status,
        highlights: releases.payload,
        metrics: metrics.payload,
        incidents: incidents.payload,
        sources,
      },
    });

    const digest = mapDigest(digestRecord);

    return {
      ok: true,
      digest,
      sources,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error while running digest",
      durationMs: Date.now() - startedAt,
    };
  }
}

function inferStatus(metrics: HealthMetric[]): DigestStatus {
  if (metrics.some((metric) => metric.status === "critical")) {
    return "critical";
  }
  if (metrics.some((metric) => metric.status === "warning")) {
    return "warning";
  }
  return "healthy";
}

function createSummary(
  highlights: ReleaseHighlight[],
  metrics: HealthMetric[],
  incidents: string[],
  status: DigestStatus
) {
  const topHighlight = highlights[0]?.title ?? "latest release";
  const headlineMetric = metrics[0];
  const incidentNote = incidents.length
    ? `Notable incident: ${incidents[0]}`
    : "No blocking incidents reported.";

  return `Status ${status.toUpperCase()}: ${topHighlight} shipped and ${headlineMetric?.label ?? "key metric"} sits at ${headlineMetric?.value}. ${incidentNote}`;
}

export function draftCustomHighlight(
  title: string,
  owner: string
): ReleaseHighlight {
  return {
    id: randomUUID(),
    title,
    description: "Custom highlight added via chat interface.",
    impact: "TBD",
    shippedAt: new Date().toISOString(),
    owner,
    tags: ["custom"],
  };
}

async function ensureSeedData() {
  if (hasSeeded) {
    return;
  }

  const count = await prisma.digest.count();
  if (count > 0) {
    hasSeeded = true;
    return;
  }

  for (const digest of mockDigests) {
    await prisma.digest.upsert({
      where: { id: digest.id },
      update: {},
      create: {
        id: digest.id,
        productId: digest.productId,
        title: digest.title,
        summary: digest.summary,
        date: new Date(digest.date),
        status: digest.status,
        highlights: digest.highlights,
        metrics: digest.metrics,
        incidents: digest.incidents,
        sources: digest.sources,
      },
    });
  }

  hasSeeded = true;
}

function mapDigest(record: PrismaDigest): DigestEntry {
  return {
    id: record.id,
    productId: record.productId,
    title: record.title,
    summary: record.summary,
    date: record.date.toISOString(),
    status: record.status,
    highlights: record.highlights as ReleaseHighlight[],
    metrics: record.metrics as HealthMetric[],
    incidents: record.incidents as string[],
    sources: record.sources as string[],
  };
}

