// Cria as contas iniciais da equipe. Nomes e senha vêm da linha de comando e do ambiente,
// nunca do repositório. Contas já existentes são mantidas como estão.
//
//   INITIAL_PASSWORD='…' DATA_DIR=/data bun scripts/seed-equipe.js \
//     "fulano:admin:Fulano:Chefe do Cartório" "beltrana::Beltrana:Servidora do Cartório"
//
// Formato de cada pessoa: usuario[:perfil][:Nome de exibição][:Cargo]; perfil = admin, equipe ou autoridade.
import { createApp } from "../src/app.js";

const password = process.env.INITIAL_PASSWORD || "";
const people = process.argv.slice(2);
if (!password || !people.length) {
  console.error("Uso: INITIAL_PASSWORD=… bun scripts/seed-equipe.js usuario[:perfil][:Nome][:Cargo] …");
  process.exit(1);
}
const app = createApp({ dataDir: process.env.DATA_DIR || "./local/data" });
let created = 0;
for (const entry of people) {
  const [username, role = "", name = "", title = ""] = entry.split(":");
  try {
    app.auth.createUser({ username, role: role || "equipe", name, title, password, initialDays: Number(process.env.INITIAL_DAYS || 7) });
    created++;
    console.log(`criada: ${username}`);
  } catch (error) {
    console.log(`mantida: ${username} (${error.message})`);
  }
}
await app.ready;
app.close();
console.log(`${created} conta(s) criada(s). Cada pessoa troca a senha no primeiro acesso.`);
