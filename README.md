# PMP — Portable Memory Protocol

**Open standard for AI agent memory.** Portable across providers, frameworks, and chains.

```
MCP   gave agents context.
A2A   gave them communication.
x402  gave them payments.
PMP   gives them memory.
```

## What it is

PMP is the missing fourth layer of the AI agent stack. Today, every agent framework rolls its own memory layer (Letta, Mem0, Zep, LangGraph, OpenAI memory, Clude). None of them interoperate. Switch tools and your agent's memory is gone — you don't own it, you can't take it with you, you can't verify it.

PMP closes that gap with four HTTP verbs:

| Verb | What it does |
|---|---|
| **DISCOVER** | Find memories matching a query across one or many providers |
| **RETRIEVE** | Fetch a memory by id. Composes with [x402](https://x402.org) for payment-gating. |
| **VERIFY** | Prove a memory is real, authored, timestamped, unchanged — anyone, no auth. |
| **CONTRIBUTE** | Write a new memory and get an on-chain receipt. |

v0.2 will add `ATTEST` (zero-knowledge compliance proofs) and `SUBSCRIBE` (push streams).

## How it works

Three layers. Content stays off-chain encrypted in the provider's database; commitments go on-chain so anyone can verify.

- **Asset layer.** Each memory becomes a compressed NFT on Solana (~$0.0001 per mint via Light Protocol). Memory Packs — curated bundles — become transferable NFTs. EVM equivalents on Base (ERC-721 / ERC-1155) coming in the multi-chain rollout.
- **Commitment layer.** A canonical sha256 hash of the memory's identity-defining fields (content, type, owner, timestamp, tags, source) lands on-chain. The data stays where it belongs.
- **Proof layer.** Merkle inclusion proofs over Pack contents enable selective disclosure — preview one memory in a 100-memory Pack and prove the others exist without revealing them. zkVM attestations land in v0.2.

The spec is at [`spec/v0.1.md`](spec/v0.1.md). Read it.

## Quick start

```ts
import { PmpClient } from '@pmp/sdk';

const pmp = new PmpClient({ baseUrl: 'https://api.portablememoryprotocol.com' });

const found = await pmp.discover({ query: 'pricing', limit: 5 });
const memory = await pmp.retrieve(found.memories[0].id);
const proof  = await pmp.verify(memory.id);   // public, no auth
```

LangChain agents:

```ts
import { PmpClient } from '@pmp/sdk';
import { PmpMemoryStore } from '@pmp/sdk/langchain';

const client = new PmpClient({ baseUrl: 'https://api.portablememoryprotocol.com', auth: { bearer: token } });
const memory = new PmpMemoryStore(client, { defaultType: 'episodic' });

const docs = await memory.getRelevantDocuments('what did we decide about pricing?');
await memory.addDocuments([{ pageContent: '...', metadata: { tags: ['pricing'] } }]);
```

## Repo layout

```
spec/v0.1.md                The protocol specification
packages/sdk/               @pmp/sdk — TypeScript SDK (4 verbs + verifier + LangChain adapter)
packages/tokenization/      @pmp/tokenization — commitment primitives (canonical hashing, Merkle trees)
registry/providers.json     Public registry of compliant PMP providers
examples/                   Working integration examples
```

## Reference implementation

[Clude](https://clude.io) ships the Solana reference implementation. Endpoints at `api.clude.io` (will become `api.portablememoryprotocol.com` post-launch).

Public benchmark: **80.4% on LongMemEval-S**, above the theoretical oracle ceiling of 76.4%. The memory architecture is real and production-tested before being protocolised.

## Become a provider

Implement the four verbs at `/v1/memories/*` and `/v1/packs/*` per the spec, then open a PR adding your provider to [`registry/providers.json`](registry/providers.json). Submission guidelines are in the registry file itself.

## Governance

- **Steward:** Sebastien Sim (@sebbsssss)
- **License:** MIT (this repo). Apache 2.0 forthcoming for the formal spec text.
- **RFC process:** GitHub Discussions for proposals, PRs against `spec/` for accepted changes.
- **Versioning:** semver. v0.x while breaking changes are allowed; v1.0 freezes the wire format.

## Status

- **2026-05-14:** v0.1 spec frozen, reference implementation live on Solana.
- **2026-05-25:** Public launch target.
- **Roadmap:** Multi-chain (Base) by week 12. Compliance ATTEST + zkVM by week 16.

## Links

- Landing: https://portablememoryprotocol.com
- Spec: [`spec/v0.1.md`](spec/v0.1.md)
- Discussions: https://github.com/sebbsssss/pmp/discussions
- Reference implementation: https://clude.io

## License

MIT — see [`LICENSE`](LICENSE).
