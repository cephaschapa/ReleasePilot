export type DigestStatus = "healthy" | "warning" | "critical";

export interface ReleaseHighlight {
  id: string;
  title: string;
  description: string;
  impact: string;
  shippedAt: string;
  owner: string;
  tags: string[];
}

export interface HealthMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  status: DigestStatus;
  target?: string;
  note?: string;
}

export interface DigestEntry {
  id: string;
  productId: string;
  title: string;
  summary: string;
  date: string;
  status: DigestStatus;
  highlights: ReleaseHighlight[];
  metrics: HealthMetric[];
  incidents: string[];
  sources: string[];
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  actionId?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  description: string;
}

export interface DigestRunResult {
  ok: boolean;
  digest?: DigestEntry;
  error?: string;
  sources?: string[];
  durationMs?: number;
}

