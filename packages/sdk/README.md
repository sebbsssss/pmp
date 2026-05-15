# @pmp/sdk

Reference TypeScript SDK for [PMP — the Portable Memory Protocol](https://portablememoryprotocol.com).

Tiny wrappers over the four verbs (DISCOVER, RETRIEVE, VERIFY, CONTRIBUTE) plus a client-side hash verifier, LangChain adapter, and cross-provider discovery. Zero dependencies except `@pmp/tokenization`.

```bash
npm install @pmp/sdk
```

## Quick start

```ts
import { PmpClient } from '@pmp/sdk';

const pmp = new PmpClient({
  baseUrl: 'https://clude.io',                       // any PMP provider
  auth:    { bearer: process.env.PMP_BEARER_TOKEN }, // optional
});

const found  = await pmp.discover({ query: 'pricing', limit: 5 });
const memory = await pmp.retrieve(found.memories[0].id);
const proof  = await pmp.verify(memory.id);          // public, no auth
const result = await pmp.contribute({ content: '...', type: 'episodic' });
```

## Typed errors

Every non-2xx response throws a `PmpError`. Use it to drive the right UX — payment flows, retries, revoked-memory messaging.

```ts
import { PmpClient, PmpError } from '@pmp/sdk';

try {
  await pmp.retrieve('mem-gated');
} catch (e) {
  if (e instanceof PmpError) {
    if (e.isPaymentRequired) /* hand e.x402 to your x402 client */;
    if (e.isRevoked)         /* show e.hint, e.g. "superseded_by:mem-new" */;
    if (e.isRetryable)       /* 429 / 5xx — backoff + retry */;
  }
}
```

| `e.status` | `e.code` | When |
|---|---|---|
| 401 | `unauthenticated` | Missing or invalid auth |
| 402 | `payment_required` | Memory is gated; `e.x402` carries the payload |
| 403 | `forbidden` | Authenticated but not authorised |
| 404 | `not_found` | Memory id doesn't exist |
| 410 | `revoked` | Memory was compacted; check `e.hint` |
| 422 | `invalid_body` / `invalid_id` | Schema validation failed |
| 429 | `rate_limited` | Backoff + retry |
| 500+ | `<verb>_failed` | Transient, retry |

## Client-side verification

Recompute a memory's canonical hash locally and compare to the attestation — useful for caching, offline audit, or cross-provider checks.

```ts
import { verifyMemoryHashClientSide } from '@pmp/sdk';

const memory = await pmp.retrieve('mem-abc');
const { recomputedHash, attestedHash, hashesMatch } = verifyMemoryHashClientSide(memory);

if (!hashesMatch) {
  // The provider's attestation doesn't match the canonical hash of the
  // returned content. Drift, tampering, or a buggy provider — don't trust it.
}
```

Combine with an on-chain RPC lookup (or the provider's `/verify` endpoint) for full trustless verification.

## LangChain adapter

`@pmp/sdk/langchain` provides a duck-typed memory store — no `langchain` dependency, slots into any version.

```ts
import { PmpClient } from '@pmp/sdk';
import { PmpMemoryStore } from '@pmp/sdk/langchain';

const client = new PmpClient({ baseUrl: 'https://clude.io', auth: { bearer: token } });
const memory = new PmpMemoryStore(client, { defaultType: 'episodic', k: 8 });

// Retrieval-augmented prompt construction
const docs = await memory.getRelevantDocuments('what did we decide about pricing?');

// Persist a new memory mid-conversation
await memory.addDocuments([{
  pageContent: 'We landed on per-token pricing for Q3.',
  metadata:    { tags: ['pricing', 'q3'], importance: 0.8 },
}]);
```

Each returned document carries the memory's `attestation` in its `metadata` so downstream tooling can render a "verified" badge or click through to the verifier URL.

## Cross-provider discovery

Fan out a DISCOVER call to every provider in the public registry (or your own list). Per-provider failures don't abort the call.

```ts
import { discoverAcrossProviders } from '@pmp/sdk';

const result = await discoverAcrossProviders({
  registryUrl: 'https://portablememoryprotocol.com/registry.json',
  query:       'q3 roadmap',
  limit:       10,
});

// result.memories  — tagged with `.provider`
// result.errors    — per-provider failures, doesn't abort
// result.perProvider  — { clude: 7, partnerX: 3 }
```

## API surface

| Symbol | What |
|---|---|
| `PmpClient` | Fetch wrapper over the 4 verbs |
| `PmpError` | Typed error with `status`, `code`, `reason`, `hint`, `x402` |
| `verifyMemoryHashClientSide` | Recompute + compare hashes locally |
| `discoverAcrossProviders` | Fan-out helper over a registry |
| `PmpMemoryStore` *(@pmp/sdk/langchain)* | LangChain-shaped memory store |

Full wire format and error semantics are in the [spec](https://github.com/sebbsssss/pmp/blob/main/spec/v0.1.md).

## License

MIT.
