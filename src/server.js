import { createApp } from "./app.js";
import { mailerFromEnv } from "./mailer.js";
const app = createApp({
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD || "",
  dataDir: process.env.DATA_DIR || "./local/data",
  publicOrigin: process.env.PUBLIC_ORIGIN || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  maxStorageMB: Number(process.env.MAX_STORAGE_MB || 10240),
  mailer: mailerFromEnv(),
  // Acompanha a totalização da 23ª ZE no portal público do TSE (desligue com TOTALIZACAO=false).
  totalizacao: process.env.TOTALIZACAO !== "false",
  // Impressões digitais SHA-256 do certificado que assina o APK (separadas por vírgula).
  androidApp: process.env.ANDROID_CERT_SHA256
    ? {
        package: process.env.ANDROID_PACKAGE || "br.com.zon023.app",
        fingerprints: process.env.ANDROID_CERT_SHA256.split(",").map((value) => value.trim()).filter(Boolean),
      }
    : null,
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
  maxRequestBodySize: 40 * 1024 * 1024 + 65536,
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
