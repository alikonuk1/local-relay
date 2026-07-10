# Publishing

This maintainer guide covers publishing the `0.1.0` package set.

## Packages

- `@local-relay/core`
- `@local-relay/react`
- `@local-relay/proxy`

## Pre-Publish Checklist

- Review the final diff.
- Confirm npm authentication.
- Confirm license files are present.
- Confirm package metadata is present.
- Confirm package exports and generated declaration files are present.
- Confirm `npm pack --dry-run` includes intended files only.
- Confirm public documentation describes the current API surface.

## Verification

```bash
npm run typecheck
npm run build
npm test
LOCAL_RELAY_TEST_OLLAMA=1 npm test --workspace @local-relay/core
LOCAL_RELAY_TEST_LMSTUDIO=1 npm test --workspace @local-relay/core
npm pack --workspace @local-relay/core --dry-run
npm pack --workspace @local-relay/react --dry-run
npm pack --workspace @local-relay/proxy --dry-run
```

## Publish Order

```bash
npm publish --workspace @local-relay/core
npm publish --workspace @local-relay/react
npm publish --workspace @local-relay/proxy
```

## Tag

```bash
git tag v0.1.0
git push origin v0.1.0
```
