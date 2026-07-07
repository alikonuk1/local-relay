#!/usr/bin/env node
import { createLocalRelayProxy, parseCliOptions } from "./index.js";

const proxy = createLocalRelayProxy(parseCliOptions());

process.on("SIGINT", () => {
  void proxy.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void proxy.stop().finally(() => process.exit(0));
});

await proxy.start();

console.log(`Local Relay proxy listening at ${proxy.url}`);
console.log("Forwarding is restricted to localhost providers by default.");
