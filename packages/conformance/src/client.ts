/**
 * Minimal fetch wrapper for the conformance suite. Deliberately tiny —
 * we don't depend on @pmp/sdk because we want to be able to test SDKs
 * against the same spec.
 */

export interface HttpResponse {
  status: number;
  ok: boolean;
  body: unknown;
  rawText: string;
  durationMs: number;
}

export interface HttpOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  bearerToken?: string;
  walletSignature?: string;
  timeoutMs?: number;
}

export async function http(url: string, opts: HttpOptions = {}): Promise<HttpResponse> {
  const start = Date.now();
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.bearerToken) headers['Authorization'] = `Bearer ${opts.bearerToken}`;
  if (opts.walletSignature) headers['X-PMP-Wallet-Signature'] = opts.walletSignature;
  const init: Parameters<typeof fetch>[1] = { method, headers };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  init.signal = controller.signal;
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(url, init);
  } catch (err) {
    clearTimeout(timer);
    return {
      status: 0,
      ok: false,
      body: null,
      rawText: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
  clearTimeout(timer);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return {
    status: res.status,
    ok: res.ok,
    body,
    rawText: text,
    durationMs: Date.now() - start,
  };
}
