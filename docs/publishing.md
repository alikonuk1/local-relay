# Publishing

This guide is for maintainers publishing the `0.1.0` alpha package set. Publish only after the final diff is reviewed and npm authentication is confirmed.

## Packages

- `@local-relay/core`
- `@local-relay/react`
- `@local-relay/proxy`

## Pre-Publish Checklist

- Package names are available. Checked on 2026-07-07: npm returned 404 for all three scoped package names.
- License files are present.
- Repository, homepage, bugs, author, keywords, engine, and public access metadata are present.
- `npm pack --dry-run` includes only intended package contents: `dist`, package metadata, README, and license.
- Package exports and generated declaration files are present.
- Docs mention alpha status.
- Proxy security notes are reviewed; see `docs/security.md`.
- API stability notes are reviewed; see `docs/api-review.md`.

## Commands

```bash
npm run typecheck
npm run build
npm test
LOCAL_RELAY_TEST_OLLAMA=1 npm test --workspace @local-relay/core
npm pack --workspace @local-relay/core --dry-run
npm pack --workspace @local-relay/react --dry-run
npm pack --workspace @local-relay/proxy --dry-run
```

Publish order:

```bash
npm publish --workspace @local-relay/core
npm publish --workspace @local-relay/react
npm publish --workspace @local-relay/proxy
```

## Versioning

The publishable packages are currently versioned as `0.1.0` for a public alpha candidate.

Keep future breaking API changes in `0.x` until the developer-facing contracts settle.
