# Publishing PMP packages to npm

Three packages ship under the `@pmp` scope:

| Order | Package | Why this order |
|---|---|---|
| 1 | `@pmp/tokenization` | No dependencies on other `@pmp/*` packages. |
| 2 | `@pmp/sdk` | Depends on `@pmp/tokenization@0.1.0-alpha.0` — must be published first. |
| 3 | `@pmp/conformance` | Standalone CLI + library, no `@pmp/*` deps. |

## One-time setup

1. **Create the `@pmp` npm org** (skip if it already exists):
   ```bash
   # via the npm web UI: https://www.npmjs.com/org/create
   # name: pmp
   # plan: free (public packages only — that's all we need)
   ```

2. **Sign in locally**:
   ```bash
   npm login --scope=@pmp --auth-type=web
   # email: sebastien@clude.io (or whichever you tied to the org)
   ```

3. **Enable 2FA for publishes** (strongly recommended):
   ```bash
   npm profile enable-2fa auth-and-writes
   # Each `npm publish` will prompt for an OTP.
   ```

4. **Verify org membership**:
   ```bash
   npm org ls pmp
   # → you should see your username with role "owner"
   ```

## Publishing

The easiest path is the convenience script in this repo. It builds each package fresh, packs, and publishes in dependency order. It pauses between packages so npm has time to propagate the new version.

```bash
./scripts/publish-all.sh
```

You'll be prompted for an OTP three times (once per package).

### Or, manually, package by package

```bash
# 1. @pmp/tokenization
cd packages/tokenization
npm install                    # one-time, gets typescript + @types/node
npm publish                    # prepublishOnly rebuilds dist for you
                               # enter OTP when prompted

# wait ~30s for npm to propagate, then:

# 2. @pmp/sdk
cd ../sdk
npm install                    # now resolves @pmp/tokenization@0.1.0-alpha.0 from npm
npm publish

# 3. @pmp/conformance
cd ../conformance
npm install
npm publish
```

## Verify

```bash
npm view @pmp/tokenization version
npm view @pmp/sdk version
npm view @pmp/conformance version
```

All three should report `0.1.0-alpha.0`.

A quick smoke test against the live conformance suite:

```bash
npx @pmp/conformance https://clude.io
# should print 9 passed · 0 failed · 2 skipped
```

## Versioning

We're using `0.1.0-alpha.X` pre-release tags during the launch window. The progression:

- `0.1.0-alpha.0` — first published, current spec v0.1
- `0.1.0-alpha.1+` — bugfixes, additive changes
- `0.1.0` — public launch (2026-05-25), spec frozen
- `0.1.1+` — patch releases with backward-compatible fixes
- `0.2.0` — adds `ATTEST` and `SUBSCRIBE` verbs (breaking-compatible, but new surface)
- `1.0.0` — wire format frozen with the standards-body submission

Bump versions in lockstep across all three packages — `@pmp/sdk` always pins `@pmp/tokenization` to the same version. The publish script reads version numbers from each `package.json` so updating them is a normal git change, then run the script.

## Troubleshooting

**`403 Forbidden — You do not have permission to publish "@pmp/...".`**
You haven't been added to the `pmp` npm org, or you're not logged in. Run `npm whoami` to check the active user; run `npm org ls pmp` to verify membership.

**`402 Payment Required — You must pay for private packages.`**
The package was published as private. Verify `"publishConfig": { "access": "public" }` in `package.json` (already set in this repo, but worth double-checking).

**`EPUBLISHCONFLICT — version already exists`**
You tried to publish a version that already exists on npm. Bump the version in `package.json` and try again. npm doesn't allow overwriting published versions, even alpha ones.

**The package depends on `@pmp/tokenization` and `npm install` 404s**
You're trying to install `@pmp/sdk` before publishing `@pmp/tokenization`. Publish tokenization first; wait 30s for npm propagation; then install + publish sdk.

**The conformance CLI binary isn't executable**
The `prepublishOnly` script does `chmod 755 dist/index.js` after build. If you're publishing manually without it, run `chmod 755 dist/index.js` yourself before `npm publish`.
