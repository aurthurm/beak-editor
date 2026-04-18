# Publishing to npm

This repo ships `**@amusendame/beakblock-core**`, `**@amusendame/beakblock-react**`, and `**@amusendame/beakblock-vue**` as separate packages. **Core must be published before** the framework packages, because React and Vue depend on the core version you are releasing.

These steps assume the **public npm registry** (`https://registry.npmjs.org`). Each package has `"publishConfig": { "access": "public" }`.

## Prerequisites

1. **Node.js** 18+ and **pnpm** 8+ (see repo `package.json` `engines` and CI).
2. An **npm account** with permission to publish the `**@amusendame`** scope.
3. **Two-factor authentication** enabled on npm (recommended). For `publish`, you may need a one-time password:   `pnpm publish --otp=123456` (or npm will prompt, depending on CLI version).
4. **Login** against the public registry:
  ```bash
   npm login --registry=https://registry.npmjs.org
  ```
   Verify:
5. Optional `**.npmrc**` in your home directory (no need to commit):
  ```ini
   //registry.npmjs.org/:_authToken=${NPM_TOKEN}
  ```
   Or rely on `npm login` stored credentials.

## Pre-release checklist

1. **Changelog** — Add a section for the new version in `[CHANGELOG.md](../CHANGELOG.md)` (Keep a Changelog style).
2. **Versions** — Set the **same semver** on all publishable packages you are shipping:
  - `packages/core/package.json` → `"version"`
  - `packages/react/package.json` → `"version"`
  - `packages/vue/package.json` → `"version"`  
   Examples and the repo root also carry a `version` field for consistency; bump if you keep them aligned with tags.
3. **Lockfile** — After version bumps, from repo root:
  ```bash
   pnpm install
  ```
4. **Build and test**
  ```bash
   pnpm build
   pnpm test
  ```
5. **Git** — Commit the release, then tag (annotated tag matching the version, with a `v` prefix if that is your convention):
  ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
  ```
   Push commits and tags: `git push origin main && git push origin vX.Y.Z`.
6. **GitHub Release** (optional) — Create a release from the tag and paste the changelog section for maintainers and consumers.

## Publish order (manual)

Run from the **repository root**. Use `**--access public`** for scoped packages. `**--no-git-checks`** skips pnpm’s check that the working tree is clean—only use it if you intentionally publish from a state pnpm would otherwise reject (prefer a clean tagged tree).

### 1. Core

```bash
pnpm --filter @amusendame/beakblock-core build
pnpm --filter @amusendame/beakblock-core publish --access public --no-git-checks
```

### 2. React

Ensure `packages/react/package.json` lists a **compatible** dependency on core (typically the same version as the release, or `workspace:`* in-repo; the published tarball should resolve core correctly—verify with `pnpm pack` / tarball inspection if unsure).

```bash
pnpm --filter @amusendame/beakblock-react build
pnpm --filter @amusendame/beakblock-react publish --access public --no-git-checks
```

### 3. Vue

```bash
pnpm --filter @amusendame/beakblock-vue build
pnpm --filter @amusendame/beakblock-vue publish --access public --no-git-checks
```

If npm enforces 2FA for publish:

```bash
pnpm --filter @amusendame/beakblock-core publish --access public --no-git-checks --otp=YOUR_OTP
```

Repeat `--otp` for each publish command if required.

## After publishing

1. Confirm versions on [npm](https://www.npmjs.com/) for each package.
2. In a **clean consumer project**, install and smoke-test:
  ```bash
   pnpm add @amusendame/beakblock-core@X.Y.Z @amusendame/beakblock-react@X.Y.Z
  ```
   (and/or `@amusendame/beakblock-vue@X.Y.Z`).

## CI note (GitHub Packages)

The workflow `[.github/workflows/publish.yml](../.github/workflows/publish.yml)` is configured to publish to `**https://npm.pkg.github.com**` when a **GitHub Release** is published. That is separate from the **public npm** flow above. Maintainers should keep automation and manual registry targets in sync with where consumers are expected to install from (see the root [README](../README.md) **Installation** section).

## Related

- [CHANGELOG](../CHANGELOG.md)
- Root [README](../README.md) — install instructions and documentation index

