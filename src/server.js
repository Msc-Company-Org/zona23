import { createApp } from "./app.js";
const app = createApp({
  dataDir: process.env.DATA_DIR || "./local/data",
  publicOrigin: process.env.PUBLIC_ORIGIN || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  maxStorageMB: Number(process.env.MAX_STORAGE_MB || 10240),
});
const hostname = process.env.HOST || "127.0.0.1";
if (
  !["127.0.0.1", "localhost", "::1"].includes(hostname) &&
  !process.env.PUBLIC_ORIGIN
) {
  throw new Error(
    "Configure PUBLIC_ORIGIN antes de disponibilizar o acervo na rede.",
  );
}
const server = Bun.serve({
  hostname,
  port: Number(process.env.PORT || 3023),
  maxRequestBodySize: 25 * 1024 * 1024 + 65536,
  idleTimeout: 60,
  fetch: app.fetch,
});
console.log(`Memória da 23ª Zona Eleitoral: ${server.url}`);
function stop() {
  server.stop(true);
  app.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
