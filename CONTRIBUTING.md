# Contributing to PMP

PMP is an open standard. Contributions to the spec, SDK, tokenization library, and provider registry are welcome.

## Quick orientation

- **`spec/v0.1.md`** — the protocol specification. Frozen for launch; v0.2 changes go to GitHub Discussions first.
- **`packages/sdk/`** — `@pmp/sdk`, the reference TypeScript client.
- **`packages/tokenization/`** — `@pmp/tokenization`, the commitment primitives.
- **`registry/providers.json`** — public list of PMP-compliant providers.

## How to contribute

### Spec changes

1. Open a GitHub Discussion describing the proposed change.
2. After consensus, open a PR against `spec/` referencing the discussion.
3. v0.x changes can be breaking; v1.0+ must be backward-compatible.

### SDK / library code

1. Fork, branch, make your change.
2. Keep PRs focused — one feature or fix per PR.
3. If you touch a public type, update both the source comment and (eventually) the spec.

### Registering as a provider

1. Implement the four v0.1 verbs at `/v1/memories/*` per the spec.
2. Pass the conformance test (suite link forthcoming).
3. Open a PR adding your provider to `registry/providers.json`. Submission guidelines are in that file.

## Style

- **No AI tells.** Don't write "delve into," "leverage," "tapestry," "stands as testament." Sentence rhythm varied. First person where it fits.
- **Specific over generic.** Real numbers, real names, real comparisons.
- **Match existing voice.** Read `spec/v0.1.md` and the `README.md` before opening a doc PR.

## Code of conduct

Be a good colleague. Disagree on substance, not identity. The full CoC will land before public launch.

## Governance

- **Steward:** Sebastien Sim ([@sebbsssss](https://github.com/sebbsssss))
- **License:** MIT for the code, Apache 2.0 forthcoming for the formal spec text.
- **Versioning:** semver. v0.x while breaking changes are allowed; v1.0 freezes the wire format.

## Reach out

- GitHub Discussions for protocol questions.
- GitHub Issues for SDK / library bugs.
- Email: sebastien@clude.io for partner / framework-maintainer conversations.
