# @pmp/conformance

PMP conformance test suite. Point this at any HTTP endpoint claiming to implement PMP v0.1 and it tells you exactly where your implementation diverges from the spec.

## Install + run

```bash
npx @pmp/conformance https://your-provider.example
```

Or with a Privy JWT to exercise CONTRIBUTE-class tests:

```bash
npx @pmp/conformance https://your-provider.example --bearer $PRIVY_JWT
```

Or run a specific subset:

```bash
npx @pmp/conformance https://your-provider.example --only discover.basic,verify.cors
```

## What it tests

| Test | Verb | Checks |
|---|---|---|
| `discover.basic` | DISCOVER | 200 + `DiscoverResponse` shape; seeds a memory id for downstream tests |
| `discover.limit-cap` | DISCOVER | Provider doesn't blindly honour huge limits (≤1000 cap) |
| `retrieve.basic` | RETRIEVE | 200 + `Memory` shape against the seeded id |
| `retrieve.not-found` | RETRIEVE | 404 + structured error body for unknown id |
| `verify.public` | VERIFY | Reachable without `Authorization`; returns `VerifyResponse` |
| `verify.cors` | VERIFY | Includes `Access-Control-Allow-Origin: *` header |
| `verify.not-found` | VERIFY | 404 on unknown memory id |
| `contribute.basic` | CONTRIBUTE | 201 + id; requires `--bearer` |
| `contribute.requires-auth` | CONTRIBUTE | 401 without auth |
| `contribute.invalid-body` | CONTRIBUTE | 422 on missing required fields |
| `packs.preview-or-skip` | PACK_PREVIEW | If implemented: valid `PackPreviewResponse` or structured 404 |

The Pack endpoints are spec-reserved for v0.2 — the suite skips Pack tests gracefully when not implemented.

## Output

Human-readable in terminal:

```
PMP conformance v0.1
  target:   https://your-provider.example
  auth:     bearer token
  tests:    11

  ✓ discover.basic   DISCOVER returns 200 and a valid DiscoverResponse (143ms)
  ✓ discover.limit-cap   DISCOVER honours a sensible cap when limit is huge (89ms)
  ✓ retrieve.basic   RETRIEVE returns a valid Memory for a known id (76ms)
  ✗ verify.cors   VERIFY responses include Access-Control-Allow-Origin: *
      → expected Access-Control-Allow-Origin: *, got null
  – contribute.basic   CONTRIBUTE writes a memory and returns 201 with an id
      → requires auth (set PMP_BEARER_TOKEN)
  ...

  9 passed · 1 failed · 1 skipped (1840ms total)
```

Machine-parseable JSON report with `--json`:

```bash
npx @pmp/conformance https://api.example.com --json report.json
```

## Exit codes

- `0` — all tests passed (skips don't count as failures)
- `1` — at least one test failed
- `2` — invocation error (missing url, etc.)

Suitable for CI:

```yaml
- name: PMP conformance
  run: npx @pmp/conformance ${{ env.PROVIDER_URL }} --bearer ${{ secrets.PMP_TOKEN }}
```

## How tests get added

The suite is a single TypeScript array in [`src/tests.ts`](src/tests.ts). PRs welcome — keep each test small and deterministic, and document what spec section it enforces.

Tests can declare:
- `requiresAuth: true` — skipped without `--bearer`
- `requiresSeedMemory: true` — skipped if no memory is available from DISCOVER
- `requiresSeedPack: true` — skipped if no pack is available

The runner walks the array in order and threads seed-state forward via `publishContext`.

## License

MIT.
