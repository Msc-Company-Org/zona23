// Carga inicial de dados reais a partir de um manifesto privado (fora do Git):
//
//   DATA_DIR=/data bun scripts/importar.js /caminho/manifesto.json
//
// {
//   "documentos": [{ "arquivo": "planejamento.pdf", "titulo": "…", "categoria": "planejamento",
//                    "visibilidade": "autoridades", "descricao": "…", "origem": "…" }],
//   "marcos":     [{ "date": "2026-10-14", "time": "08:00", "title": "…", "detail": "…", "kind": "preparacao" }],
//   "salas":      { "145": "Sala 03" }
// }
// Arquivos são procurados ao lado do manifesto. Itens repetidos são ignorados.
import { dirname, join } from "node:path";
import { createApp } from "../src/app.js";

const manifesto = process.argv[2];
if (!manifesto) {
  console.error("Uso: DATA_DIR=… bun scripts/importar.js manifesto.json");
  process.exit(1);
}
const base = dirname(manifesto);
const carga = await Bun.file(manifesto).json();
const app = createApp({ dataDir: process.env.DATA_DIR || "./local/data" });
const contagem = { documentos: 0, marcos: 0, salas: 0, ignorados: 0 };

for (const doc of carga.documentos || []) {
  try {
    const bytes = Buffer.from(await Bun.file(join(base, doc.arquivo)).arrayBuffer());
    await app.documentos.salvar({ ...doc, bytes, nome: doc.arquivo });
    contagem.documentos++;
  } catch (error) {
    contagem.ignorados++;
    console.log(`documento ignorado: ${doc.arquivo} (${error.message})`);
  }
}
for (const marco of carga.marcos || []) {
  const existe = app.db.query("SELECT 1 FROM marcos WHERE date=? AND title=?").get(marco.date, marco.title);
  if (existe) {
    contagem.ignorados++;
    continue;
  }
  app.db
    .query("INSERT INTO marcos (id,date,time,title,detail,kind,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(crypto.randomUUID(), marco.date, marco.time || "", marco.title, marco.detail || "", marco.kind || "outro", new Date().toISOString());
  contagem.marcos++;
}
for (const [secao, sala] of Object.entries(carga.salas || {})) {
  app.db
    .query("INSERT INTO secoes_info (secao,sala,updated_at) VALUES (?,?,?) ON CONFLICT(secao) DO UPDATE SET sala=excluded.sala")
    .run(Number(secao), String(sala).slice(0, 60), new Date().toISOString());
  contagem.salas++;
}
await app.ready;
app.close();
console.log(JSON.stringify(contagem));
