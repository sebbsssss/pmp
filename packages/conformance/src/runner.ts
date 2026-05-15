/**
 * Conformance suite runner — orchestrates the test list and produces
 * both a human-readable terminal report and a machine-parseable JSON
 * artifact.
 */

import type { ConformanceTest, Report, TestContext, TestResult, TestStatus } from './types';

const ICON: Record<TestStatus, string> = { pass: '✓', fail: '✗', skip: '–' };
const COLOR: Record<TestStatus, string> = {
  pass: '\x1b[32m',
  fail: '\x1b[31m',
  skip: '\x1b[33m',
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function colorize(text: string, color: string, useColor: boolean): string {
  return useColor ? `${color}${text}${RESET}` : text;
}

export interface RunOptions {
  baseUrl: string;
  bearerToken?: string;
  walletSignature?: string;
  verbose?: boolean;
  /** Disable ANSI colors (for CI logs). */
  noColor?: boolean;
  /** Run a specific subset of tests by id. Empty = all. */
  only?: string[];
}

export async function run(opts: RunOptions, tests: ConformanceTest[]): Promise<{ report: Report; results: Array<{ test: ConformanceTest; result: TestResult }> }> {
  const useColor = !opts.noColor && process.stdout.isTTY;
  const ctx: TestContext = {
    baseUrl: opts.baseUrl.replace(/\/+$/, ''),
    bearerToken: opts.bearerToken,
    walletSignature: opts.walletSignature,
    verbose: opts.verbose ?? false,
  };
  const startAll = Date.now();
  const results: Array<{ test: ConformanceTest; result: TestResult }> = [];

  console.log(`PMP conformance v0.1`);
  console.log(`  target:   ${ctx.baseUrl}`);
  console.log(`  auth:     ${opts.bearerToken ? 'bearer token' : 'unauthenticated'}`);
  console.log(`  tests:    ${tests.length}${opts.only?.length ? ` (filtered to ${opts.only.length})` : ''}`);
  console.log('');

  for (const test of tests) {
    if (opts.only && opts.only.length > 0 && !opts.only.includes(test.id)) continue;
    let result: TestResult;
    // Skip logic
    if (test.requiresAuth && !ctx.bearerToken) {
      result = { status: 'skip', detail: 'requires auth (set PMP_BEARER_TOKEN)', durationMs: 0 };
    } else if (test.requiresSeedMemory && !ctx.seedMemoryId) {
      result = { status: 'skip', detail: 'requires a memory in the provider (none discovered)', durationMs: 0 };
    } else if (test.requiresSeedPack && !ctx.seedPackId) {
      result = { status: 'skip', detail: 'requires a pack in the provider (none discovered)', durationMs: 0 };
    } else {
      try {
        result = await test.run(ctx);
      } catch (err) {
        result = {
          status: 'fail',
          detail: `threw: ${err instanceof Error ? err.message : String(err)}`,
          durationMs: 0,
        };
      }
    }
    // Merge any published context
    if (result.publishContext) {
      Object.assign(ctx, result.publishContext);
    }
    results.push({ test, result });
    const icon = colorize(ICON[result.status], COLOR[result.status], useColor);
    const time = result.status === 'pass' ? colorize(` (${result.durationMs}ms)`, DIM, useColor) : '';
    console.log(`  ${icon} ${test.id}  ${test.name}${time}`);
    if (result.status !== 'pass') {
      console.log(`      ${colorize('→', DIM, useColor)} ${result.detail}`);
      if (opts.verbose && result.rawResponse !== undefined) {
        const truncated = JSON.stringify(result.rawResponse, null, 2).slice(0, 500);
        console.log(`      ${colorize(truncated, DIM, useColor)}`);
      }
    }
  }

  const passed = results.filter((r) => r.result.status === 'pass').length;
  const failed = results.filter((r) => r.result.status === 'fail').length;
  const skipped = results.filter((r) => r.result.status === 'skip').length;
  const durationMs = Date.now() - startAll;

  console.log('');
  const summary = `${passed} passed · ${failed} failed · ${skipped} skipped (${durationMs}ms total)`;
  console.log(`  ${colorize(summary, failed > 0 ? COLOR.fail : COLOR.pass, useColor)}`);

  const report: Report = {
    baseUrl: ctx.baseUrl,
    startedAt: new Date(startAll).toISOString(),
    summary: { total: results.length, passed, failed, skipped, durationMs },
    results: results.map(({ test, result }) => ({
      id: test.id,
      name: test.name,
      verb: test.verb,
      status: result.status,
      detail: result.detail,
      durationMs: result.durationMs,
    })),
  };

  return { report, results };
}
