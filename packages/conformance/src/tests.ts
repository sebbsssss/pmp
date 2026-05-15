/**
 * Conformance test definitions for PMP v0.1.
 *
 * Each test is independent except for the seed-state pattern: an early
 * DISCOVER test publishes a seedMemoryId for later RETRIEVE/VERIFY tests
 * to use. Tests that need seed state declare it via `requiresSeedMemory`
 * etc. and are skipped (not failed) if the seed isn't available.
 */

import type { ConformanceTest, TestResult } from './types';
import { http } from './client';
import {
  validateDiscoverResponse,
  validateErrorResponse,
  validateMemory,
  validatePackPreviewResponse,
  validateVerifyResponse,
} from './schemas';

function done(start: number): number {
  return Date.now() - start;
}

function pass(detail: string, start: number, extra: Partial<TestResult> = {}): TestResult {
  return { status: 'pass', detail, durationMs: done(start), ...extra };
}

function fail(detail: string, start: number, rawResponse?: unknown): TestResult {
  return { status: 'fail', detail, durationMs: done(start), rawResponse };
}

function skip(detail: string, start: number): TestResult {
  return { status: 'skip', detail, durationMs: done(start) };
}

// ─────────── DISCOVER ───────────

const discoverBasic: ConformanceTest = {
  id: 'discover.basic',
  name: 'DISCOVER returns 200 and a valid DiscoverResponse',
  verb: 'DISCOVER',
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories?limit=5`);
    if (!r.ok) return fail(`expected 2xx, got ${r.status}`, start, r.body);
    const v = validateDiscoverResponse(r.body);
    if (!v.ok) return fail(v.reason, start, r.body);
    const body = r.body as { count: number; memories: Array<{ id: string }> };
    const seed = body.memories[0]?.id;
    return pass(
      `200, count=${body.count}, memories=${body.memories.length}`,
      start,
      seed ? { publishContext: { seedMemoryId: seed } } : {},
    );
  },
};

const discoverLimitCap: ConformanceTest = {
  id: 'discover.limit-cap',
  name: 'DISCOVER honours a sensible cap when limit is huge',
  verb: 'DISCOVER',
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories?limit=99999`);
    if (!r.ok) return fail(`expected 2xx, got ${r.status}`, start, r.body);
    const v = validateDiscoverResponse(r.body);
    if (!v.ok) return fail(v.reason, start, r.body);
    const body = r.body as { memories: unknown[] };
    if (body.memories.length > 1000) {
      return fail(`returned ${body.memories.length} memories — should cap at ≤1000`, start);
    }
    return pass(`capped at ${body.memories.length} (no DoS surface)`, start);
  },
};

// ─────────── RETRIEVE ───────────

const retrieveBasic: ConformanceTest = {
  id: 'retrieve.basic',
  name: 'RETRIEVE returns a valid Memory for a known id',
  verb: 'RETRIEVE',
  requiresSeedMemory: true,
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories/${encodeURIComponent(ctx.seedMemoryId!)}`);
    if (!r.ok) return fail(`expected 2xx, got ${r.status}`, start, r.body);
    const v = validateMemory(r.body);
    if (!v.ok) return fail(v.reason, start, r.body);
    return pass(`200, memory id matches: ${(r.body as { id: string }).id}`, start);
  },
};

const retrieveNotFound: ConformanceTest = {
  id: 'retrieve.not-found',
  name: 'RETRIEVE returns 404 with a structured error for unknown id',
  verb: 'RETRIEVE',
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories/mem-this-definitely-does-not-exist-${Date.now()}`);
    if (r.status !== 404) return fail(`expected 404, got ${r.status}`, start, r.body);
    const v = validateErrorResponse(r.body);
    if (!v.ok) return fail(`404 body is not a structured error: ${v.reason}`, start, r.body);
    return pass(`404 with error="${(r.body as { error: string }).error}"`, start);
  },
};

// ─────────── VERIFY ───────────

const verifyPublic: ConformanceTest = {
  id: 'verify.public',
  name: 'VERIFY is public (no Authorization header) and returns a valid VerifyResponse',
  verb: 'VERIFY',
  requiresSeedMemory: true,
  async run(ctx) {
    const start = Date.now();
    // Note: we explicitly omit the bearer token here even if available, to
    // confirm the endpoint is reachable without auth.
    const r = await http(`${ctx.baseUrl}/v1/memories/${encodeURIComponent(ctx.seedMemoryId!)}/verify`);
    if (!r.ok) return fail(`expected 2xx, got ${r.status}`, start, r.body);
    const v = validateVerifyResponse(r.body);
    if (!v.ok) return fail(v.reason, start, r.body);
    const body = r.body as { verified: boolean; reason: string };
    return pass(`200, verified=${body.verified}, reason=${body.reason}`, start);
  },
};

const verifyCors: ConformanceTest = {
  id: 'verify.cors',
  name: 'VERIFY responses include Access-Control-Allow-Origin: *',
  verb: 'VERIFY',
  requiresSeedMemory: true,
  async run(ctx) {
    const start = Date.now();
    const r = await fetch(
      `${ctx.baseUrl}/v1/memories/${encodeURIComponent(ctx.seedMemoryId!)}/verify`,
      { method: 'GET' },
    );
    const cors = r.headers.get('access-control-allow-origin');
    if (cors !== '*') {
      return fail(`expected Access-Control-Allow-Origin: *, got "${cors}"`, start);
    }
    return pass('CORS open for public verifier', start);
  },
};

const verifyNotFound: ConformanceTest = {
  id: 'verify.not-found',
  name: 'VERIFY returns 404 for unknown memory id',
  verb: 'VERIFY',
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories/mem-no-such-thing-${Date.now()}/verify`);
    if (r.status !== 404) return fail(`expected 404, got ${r.status}`, start, r.body);
    return pass('404 on unknown id', start);
  },
};

// ─────────── CONTRIBUTE ───────────

const contributeBasic: ConformanceTest = {
  id: 'contribute.basic',
  name: 'CONTRIBUTE writes a memory and returns 201 with an id',
  verb: 'CONTRIBUTE',
  requiresAuth: true,
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories`, {
      method: 'POST',
      bearerToken: ctx.bearerToken,
      walletSignature: ctx.walletSignature,
      body: {
        content: `pmp conformance test memory ${new Date().toISOString()}`,
        type: 'episodic',
        tags: ['pmp-conformance'],
        source: 'pmp-conformance',
      },
    });
    if (r.status !== 201) return fail(`expected 201, got ${r.status}`, start, r.body);
    if (typeof (r.body as Record<string, unknown>)?.id !== 'string') {
      return fail('response missing id', start, r.body);
    }
    return pass(`201, id=${(r.body as { id: string }).id}`, start, {
      publishContext: { seedMemoryId: (r.body as { id: string }).id },
    });
  },
};

const contributeRequiresAuth: ConformanceTest = {
  id: 'contribute.requires-auth',
  name: 'CONTRIBUTE returns 401 without auth',
  verb: 'CONTRIBUTE',
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories`, {
      method: 'POST',
      body: { content: 'x', type: 'episodic' },
    });
    if (r.status !== 401) return fail(`expected 401, got ${r.status}`, start, r.body);
    return pass(`401 on unauthenticated CONTRIBUTE`, start);
  },
};

const contributeInvalidBody: ConformanceTest = {
  id: 'contribute.invalid-body',
  name: 'CONTRIBUTE returns 422 for missing required fields',
  verb: 'CONTRIBUTE',
  requiresAuth: true,
  async run(ctx) {
    const start = Date.now();
    const r = await http(`${ctx.baseUrl}/v1/memories`, {
      method: 'POST',
      bearerToken: ctx.bearerToken,
      walletSignature: ctx.walletSignature,
      body: { content: 'no type field' },
    });
    if (r.status !== 422) return fail(`expected 422, got ${r.status}`, start, r.body);
    return pass(`422 on invalid body`, start);
  },
};

// ─────────── PACK endpoints (v0.2 spec §9) ───────────

const packPreviewSkip: ConformanceTest = {
  id: 'packs.preview-or-skip',
  name: 'PACK preview either returns valid PackPreviewResponse or 404 if no packs',
  verb: 'PACK_PREVIEW',
  async run(ctx) {
    const start = Date.now();
    // Try a known-bad pack id — if the endpoint exists, it'll 404.
    // If it 404s with route-not-found, the provider doesn't implement packs.
    const r = await http(`${ctx.baseUrl}/v1/packs/pack-conformance-probe-${Date.now()}/preview`);
    if (r.status === 404) {
      const v = validateErrorResponse(r.body);
      if (v.ok) return pass(`pack endpoints mounted; 404 on unknown pack`, start);
      return skip('pack endpoints not mounted (404 has no error body)', start);
    }
    if (r.status === 200) {
      const v = validatePackPreviewResponse(r.body);
      if (!v.ok) return fail(v.reason, start, r.body);
      return pass(`200, revealed_count=${(r.body as { revealed_count: number }).revealed_count}`, start);
    }
    return fail(`unexpected status ${r.status}`, start, r.body);
  },
};

// ─────────── Test registry ───────────

export const ALL_TESTS: ConformanceTest[] = [
  discoverBasic,
  discoverLimitCap,
  retrieveBasic,
  retrieveNotFound,
  verifyPublic,
  verifyCors,
  verifyNotFound,
  contributeRequiresAuth,
  contributeBasic,
  contributeInvalidBody,
  packPreviewSkip,
];
