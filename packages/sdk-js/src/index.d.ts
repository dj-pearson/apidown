export interface APIdownConfig {
  /** Required: SDK key from apidown.net/dashboard */
  key: string;
  /** Ingest endpoint URL (default: https://ingest.apidown.net/v1/signals) */
  endpoint?: string;
  /** Milliseconds between batched sends (default: 30000) */
  flushInterval?: number;
  /** Max signals per batch (default: 100) */
  maxBatchSize?: number;
  /** Only monitor these domains */
  allowlist?: string[];
  /** Never monitor these domains */
  denylist?: string[];
  /** Log to console (default: false) */
  debug?: boolean;
}

export interface APIdown {
  init(config: APIdownConfig): void;
  shutdown(): void;
  record(domain: string, statusCode: number, durationMs: number): void;
}

declare const apidown: APIdown;
export default apidown;
