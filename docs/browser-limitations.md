# Browser Limitations

Local Relay intentionally treats browser-to-localhost behavior as a first-class design constraint.

## CORS

Ollama, LM Studio, and other local runtimes may reject browser requests from a different origin. When that happens, Local Relay surfaces a provider/network error with a suggestion to use a proxy or configure the provider.

## HTTPS Apps Calling HTTP Localhost

Hosted HTTPS apps may have trouble calling plain HTTP localhost endpoints. Browser behavior varies by context, browser, and policy settings.

The recommended mitigation is the optional local proxy. It exposes a stable localhost endpoint and forwards only to allowed local providers.

See [proxy.md](./proxy.md) for proxy setup and the browser-safe proxy client.

## Localhost Probing

Provider detection should be explicit and limited. Local Relay should check known provider URLs, not scan arbitrary local ports.

Default provider URLs:

- Ollama: `http://localhost:11434`
- Ollama OpenAI-compatible: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`

## Security Defaults

Local Relay defaults are designed to:

- Avoid telemetry by default.
- Avoid prompt logging by default.
- Warn when a provider URL is not localhost.
- Keep automatic probing limited to configured providers.
