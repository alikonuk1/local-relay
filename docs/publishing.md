# Publishing Prep

Local Relay is not ready for public publishing until the package metadata, API surface, and release process are reviewed.

## Packages

- `@local-relay/core`
- `@local-relay/react`
- `@local-relay/proxy`

## Pre-Publish Checklist

- Confirm package names are available.
- Add license.
- Add repository URL.
- Add author/maintainer metadata.
- Decide package access policy.
- Run `npm pack --dry-run` for each package.
- Confirm `files` includes only intended build output.
- Confirm `exports` are correct.
- Confirm generated declaration files are included.
- Confirm docs mention alpha status.
- Confirm proxy security notes are reviewed.

## Commands

```bash
npm run typecheck
npm run build
npm test
npm pack --workspace @local-relay/core --dry-run
npm pack --workspace @local-relay/react --dry-run
npm pack --workspace @local-relay/proxy --dry-run
```

## Versioning

Start with `0.1.0` for a public alpha once the API shape is ready for external feedback.

Until then, keep packages at `0.0.0`.
