/* Página do aplicativo: mostra o APK publicado e a instalação pelo navegador. */
const $ = (selector) => document.querySelector(selector);
const size = (bytes) => (bytes > 1e6 ? (bytes / 1e6).toFixed(1).replace(".", ",") + " MB" : Math.round(bytes / 1e3) + " KB");
let installPrompt = null;
addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#install-button").hidden = false;
});
$("#install-button").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $("#install-button").hidden = true;
});
fetch("/api/app")
  .then((response) => response.json())
  .then(({ apk }) => {
    if (!apk) return;
    $("#apk-button").href = apk.url;
    $("#apk-button").hidden = false;
    $("#apk-pending").hidden = true;
    $("#apk-meta").hidden = false;
    $("#apk-meta").innerHTML = "";
    const parts = [`Versão ${apk.version}`, size(apk.bytes)];
    if (apk.updatedAt) parts.push(`atualizado em ${apk.updatedAt.split("-").reverse().join("/")}`);
    $("#apk-meta").append(parts.join(" · "));
    const code = document.createElement("code");
    code.textContent = `SHA-256 ${apk.sha256}`;
    $("#apk-meta").append(document.createElement("br"), code);
  })
  .catch(() => {});
try {
  const body = JSON.stringify({ kind: "page", ref: "/app" });
  navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }));
} catch {}
