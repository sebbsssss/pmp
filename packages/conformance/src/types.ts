/**
 * Shared types for the PMP conformance suite.
 */

export type Verb =
  | 'DISCOVER'
  | 'RETRIEVE'
  | 'VERIFY'
  | 'CONTRIBUTE'
  | 'PACK_GET'
  | 'PACK_PREVIEW'
  | 'PACK_VERIFY'
  | 'PACK_UNLOCK';

export interface TestContext {
  baseUrl: string;
  bearerToken?: string;
  walletSignature?: string;
  /** A memory id discovered during the suite, used by downstream tests. */
  seedMemoryId?: string;
  /** A pack id discovered during the suite, used by downstream tests. */
  seedPackId?: string;
  /** Verbose logging. */
  verbose: boolean;
}

export type TestStatus = 'pass' | 'fail' | 'skip';

export interface TestResult {
  status: TestStatus;
  /** Human-readable explanation of what was checked. */
  detail: string;
  /** Time the test took. */
  durationMs: number;
  /** State to merge into the context for subsequent tests. */
  publishContext?: Partial<TestContext>;
  /** Raw response body on failure, for debugging. */
  rawResponse?: unknown;
}

export interface ConformanceTest {
  /** Stable identifier (e.g. 'discover.basic'). Used in the report. */
  id: string;
  /** Short human-readable description. */
  name: string;
  /** Which verb this exercises. */
  verb: Verb;
  /** If true, test is skipped when no auth is provided. */
  requiresAuth?: boolean;
  /** If true, test depends on context.seedMemoryId being populated. */
  requiresSeedMemory?: boolean;
  /** If true, test depends on context.seedPackId being populated. */
  requiresSeedPack?: boolean;
  run(ctx: TestContext): Promise<TestResult>;
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface Report {
  baseUrl: string;
  startedAt: string;
  summary: ReportSummary;
  results: Array<{ id: string; name: string; verb: Verb; status: TestStatus; detail: string; durationMs: number }>;
}
