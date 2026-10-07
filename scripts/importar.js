// Carga inicial de dados reais a partir de um manifesto privado (fora do Git):
//
//   DATA_DIR=/data bun scripts/importar.js /caminho/manifesto.json
//
// {
//   "documentos": [{ "arquivo": "planejamento.pdf", "titulo": "…", "categoria": "planejamento",
//                    "visibilidade": "autoridades", "descricao": "…", "origem": "…" }],
//   "marcos":     [{ "date": "2026-10-14", "time": "08:00", "title": "…", "detail": "…", "kind": "preparacao" }],
//   "salas":      { "145": "Sala 03" },
//   "convocacoes": [{ "pleito": "3220", "arquivo": "convocacoes.json", "origem": "ELO · Relatório de Mesários" }],
//   "escala":     { "arquivo": "escala-ase.txt", "dias": { "2026-10-14": { "atividade": "…", "horario": "manhã", "observacao": "…" } } },
//   "tarefas":    [{ "titulo": "…", "tipo": "sei", "referencia": "…", "responsavel": "usuario", "apoio": ["usuario"],
//                    "criadaPor": "usuario", "status": "a_fazer", "aguardando": "", "prazo": "", "prioridade": "normal",
//                    "modelo": "justificativas", "itens": ["…"], "descricao": "…", "origem": "Grupo de trabalho · 06/10/2026" }]
// }
// Arquivos são procurados ao lado do manifesto. Itens repetidos são ignorados.
import { dirname, join } from "node:path";
import { createApp } from "../src/app.js";
import { importarConvocacoes } from "../src/eleicao.js";
import { importarEscala } from "../src/escala.js";
import { inserirTarefa, MODELOS } from "../src/tarefas.js";

const manifesto = process.argv[2];
if (!manifesto) {
  console.error("Uso: DATA_DIR=… bun scripts/importar.js manifesto.json");
  process.exit(1);
}
const base = dirname(manifesto);
const carga = await Bun.file(manifesto).json();
const app = createApp({ dataDir: process.env.DATA_DIR || "./local/data" });
const contagem = { documentos: 0, marcos: 0, salas: 0, convocacoes: 0, escalaDias: 0, escalaEntradas: 0, tarefas: 0, ignorados: 0 };

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
for (const lote of carga.convocacoes || []) {
  const registros = await Bun.file(join(base, lote.arquivo)).json();
  const { novos, atualizados } = importarConvocacoes(app.db, String(lote.pleito), registros, lote.origem || "");
  contagem.convocacoes += novos;
  contagem.ignorados += atualizados;
}
if (carga.escala) {
  // A escala do texto manda nos dias que aparecem nele; repetir não duplica.
  if (carga.escala.arquivo) {
    const r = importarEscala(app.db, await Bun.file(join(base, carga.escala.arquivo)).text());
    contagem.escalaDias = r.dias;
    contagem.escalaEntradas = r.incluidas;
    for (const aviso of [...r.avisos, ...r.acima]) console.log(`escala: ${aviso}`);
  }
  for (const [data, dia] of Object.entries(carga.escala.dias || {}))
    app.db
      .query(
        `INSERT INTO escala_dias (data,atividade,horario,observacao,atualizado_em) VALUES (?,?,?,?,?)
         ON CONFLICT(data) DO UPDATE SET atividade=excluded.atividade, horario=excluded.horario, observacao=excluded.observacao`,
      )
      .run(data, dia.atividade || "", dia.horario || "", dia.observacao || "", new Date().toISOString());
}
const usuario = (nome) => (nome ? app.db.query("SELECT id FROM users WHERE username=?").get(nome)?.id || "" : "");
for (const t of carga.tarefas || []) {
  if (app.db.query("SELECT 1 FROM tarefas WHERE titulo=? AND origem=?").get(t.titulo, t.origem || "")) {
    contagem.ignorados++;
    continue;
  }
  const responsavel = usuario(t.responsavel);
  if (t.responsavel && !responsavel) {
    contagem.ignorados++;
    console.log(`tarefa ignorada (usuário ${t.responsavel} não existe): ${t.titulo}`);
    continue;
  }
  const id = inserirTarefa(
    app.db,
    { ...t, responsavel, apoio: (t.apoio || []).map(usuario).filter(Boolean), itens: t.itens || MODELOS[t.modelo]?.itens || [] },
    usuario(t.criadaPor) || responsavel,
  );
  // Passos já cumpridos segundo a origem.
  for (const texto of t.feitos || []) app.db.query("UPDATE tarefa_itens SET feito=1, feito_por=?, feito_em=? WHERE tarefa_id=? AND texto=?").run(responsavel, new Date().toISOString(), id, texto);
  contagem.tarefas++;
}
await app.ready;
app.close();
console.log(JSON.stringify(contagem));
