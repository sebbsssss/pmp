# @pmp/tokenization

Commitment primitives for [PMP — the Portable Memory Protocol](https://portablememoryprotocol.com).

Three things, deterministic and chain-agnostic:

- **Canonical content hashing** — `memoryContentHash(memory)` produces the exact same sha256 across any compliant provider for the same logical memory.
- **Merkle trees over Memory Packs** — `buildPackTree`, `inclusionProof`, `verifyInclusion`.
- **`MintClient` interface** that on-chain implementations conform to, plus a `FakeMintClient` for tests.

Used by `@pmp/sdk` for client-side verification and by provider implementations to construct the commitments they put on-chain.

```bash
npm install @pmp/tokenization
```

## Canonical content hash

The hash is over a strict normalised JSON of the memory's identity-defining fields. **Mutable fields (importance, decay, access count) are deliberately excluded** so lifecycle changes don't invalidate the commitment.

```ts
import { memoryContentHash } from '@pmp/tokenization';

const hash = memoryContentHash({
  content:         'We landed on per-token pricing for Q3.',
  memory_type:     'episodic',
  owner_wallet:    'GsbwXfQGv9...',
  created_at:      '2026-05-15T12:00:00.000Z',
  tags:            ['pricing', 'q3'],
  source:          'chat',
  related_user:    null,
  related_wallet:  null,
});
// → 'a3f5...' (64-char hex sha256)
```

The hash algorithm is versioned (`memory-hash-v1`) and bound into the canonical form, so future revisions don't silently produce different hashes for the same memory.

## Pack Merkle trees

```ts
import { buildPackTree, inclusionProof, verifyInclusion } from '@pmp/tokenization';

const leafHashes = memories.map(memoryContentHash);
const tree       = buildPackTree(leafHashes);
// tree.root, tree.depth, tree.leaves

const proof = inclusionProof(tree, 3);  // proof for the 4th memory
const ok    = verifyInclusion(tree.root, proof);  // → true
```

The tree pairs leaves with `sha256(concat(left, right))` and duplicates odd-out leaves at each level. Inclusion proofs include the algorithm version (`sha256-merkle-v1`) so verifiers know which scheme to apply.

## `MintClient` interface

A chain-side commitment abstraction. `tokenizeMemory` and `tokenizePack` do their work through this interface — providers swap in implementations for Solana / Base / EVM without changing the protocol layer.

```ts
import { type MintClient, FakeMintClient, tokenizeMemory, tokenizePack } from '@pmp/tokenization';

const mint: MintClient = new FakeMintClient();  // or your chain impl

const { contentHash, commitment, patch } = await tokenizeMemory({
  hashId: 'mem-abc',
  content: '...',
  memory_type: 'episodic',
  owner_wallet: 'GsbwXfQGv9...',
  created_at: '2026-05-15T12:00:00.000Z',
  tags: ['x'],
  source: 'chat',
  related_user: null,
  related_wallet: null,
}, mint);

// commitment.chain / .assetId / .txSig / .treeAddress / .leafIndex
// patch is what your provider writes back to the memory row
```

The `FakeMintClient` is in-memory and deterministic — same input always produces the same receipt. Use it in tests so the protocol layer is exercised without touching a chain.

## Public verifier

```ts
import { verifyMemory, verifyPackInclusion } from '@pmp/tokenization';

const result = await verifyMemory(contentHash, mint);
// { verified, reason: 'verified' | 'not_committed', commitment }

const inclusion = await verifyPackInclusion(
  { expectedRoot, contentHash, proof },
  mint,
);
// { verified, reason: 'verified' | 'merkle_mismatch' | 'leaf_mismatch' | 'pack_not_found', packCommitment }
```

## License

MIT.
