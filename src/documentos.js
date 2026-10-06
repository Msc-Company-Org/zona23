import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { GROUPS } from "./auth.js";

// Biblioteca de documentos da equipe: planejamento, manuais, avisos, normas e modelos.
// Os arquivos ficam em DATA_DIR/documentos, fora do Git e fora da pasta pública.
export const CATEGORIAS = {
  planejamento: "Planejamento e logística",
  orientacoes: "Orientações e manuais",
  avisos: "Avisos e comunicados",
  normas: "Legislação e normas",
  modelos: "Modelos e formulários",
  listas: "Listas e planilhas",
  outros: "Outros",
};
// Quem vê: só o cartório; cartório e autoridades; ou todos com acesso (inclui pessoal de campo).
export const VISIBILIDADES = {
  cartorio: GROUPS.cartorio,
  autoridades: [...GROUPS.cartorio, ...GROUPS.autoridade],
  todos: [...GROUPS.cartorio, ...GROUPS.autoridade, ...GROUPS.campo],
};
const TIPOS = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};
export const MAX_DOCUMENTO = 40 * 1024 * 1024;

export function migrateDocumentos(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', categoria TEXT NOT NULL,
      visibilidade TEXT NOT NULL, arquivo TEXT NOT NULL, extensao TEXT NOT NULL, bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL, origem TEXT NOT NULL DEFAULT '', enviado_por TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documentos_categoria ON documentos(categoria, criado_em);
  `);
}

export function createDocumentos(ctx) {
  const { db, json, InputError, textValue, auth, root, securityHeaders } = ctx;
  const pasta = join(root, "documentos");
  mkdirSync(pasta, { recursive: true });

  // Usado pela tela e pelo script de importação.
  async function salvar({ bytes, nome, titulo, descricao = "", categoria = "outros", visibilidade = "cartorio", origem = "", enviadoPor = "" }) {
    const extensao = String(nome).split(".").pop().toLowerCase();
    if (!TIPOS[extensao]) throw new InputError("Formato não aceito. Use PDF, Word, Excel, PowerPoint, OpenDocument, CSV, texto ou imagem.");
    if (!bytes.length || bytes.length > MAX_DOCUMENTO) throw new InputError("O arquivo deve ter até 40 MB.", 413);
    if (!CATEGORIAS[categoria]) throw new InputError("Escolha a categoria.");
    if (!VISIBILIDADES[visibilidade]) throw new InputError("Escolha quem pode ver.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const repetido = db.query("SELECT id,titulo FROM documentos WHERE sha256=?").get(sha256);
    if (repetido) throw new InputError(`Este arquivo já está na biblioteca como “${repetido.titulo}”.`, 409);
    const id = crypto.randomUUID();
    const arquivo = `${id}.${extensao}`;
    await Bun.write(join(pasta, arquivo), bytes);
    db.query(
      `INSERT INTO documentos (id,titulo,descricao,categoria,visibilidade,arquivo,extensao,bytes,sha256,origem,enviado_por,criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      textValue(String(titulo || nome.replace(/\.[^.]+$/, "")), "Título", 160, true),
      textValue(String(descricao), "Descrição", 600),
      categoria,
      visibilidade,
      arquivo,
      extensao,
      bytes.length,
      sha256,
      textValue(String(origem), "Origem", 160),
      enviadoPor,
      new Date().toISOString(),
    );
    return db.query("SELECT * FROM documentos WHERE id=?").get(id);
  }
  const visiveis = (role) => Object.keys(VISIBILIDADES).filter((key) => VISIBILIDADES[key].includes(role));
  const shape = (row) => ({ ...row, categoriaNome: CATEGORIAS[row.categoria], url: `/api/documentos/${row.id}/arquivo` });

  async function handle(req, url, path) {
    const method = req.method;
    const me = auth.guard(req);
    const cartorio = GROUPS.cartorio.includes(me.role);
    const permitidas = visiveis(me.role);
    if (path === "/api/documentos" && method === "GET") {
      const rows = db
        .query(
          `SELECT d.*, (SELECT name FROM users WHERE id=d.enviado_por) AS enviado_por_nome FROM documentos d
           WHERE d.visibilidade IN (${permitidas.map(() => "?").join(",")}) ORDER BY d.categoria, d.criado_em DESC`,
        )
        .all(...permitidas);
      return json({ categorias: CATEGORIAS, documentos: rows.map(shape), podeEnviar: cartorio });
    }
    if (path === "/api/documentos" && method === "POST") {
      if (!cartorio) throw new InputError("Só a equipe do cartório envia documentos.", 403);
      const form = await req.formData();
      const file = form.get("arquivo");
      if (!(file instanceof File) || !file.size) throw new InputError("Escolha um arquivo.");
      const row = await salvar({
        bytes: Buffer.from(await file.arrayBuffer()),
        nome: file.name,
        titulo: form.get("titulo") || "",
        descricao: form.get("descricao") || "",
        categoria: form.get("categoria") || "outros",
        visibilidade: form.get("visibilidade") || "cartorio",
        enviadoPor: me.id,
      });
      auth.audit(me.id, "documento_upload", "documento", row.id, row.titulo);
      return json({ documento: shape(row) }, 201);
    }
    const match = path.match(/^\/api\/documentos\/([a-f0-9-]{36})(\/arquivo)?$/);
    if (match) {
      const row = db.query("SELECT * FROM documentos WHERE id=?").get(match[1]);
      if (!row || !permitidas.includes(row.visibilidade)) throw new InputError("Documento não encontrado.", 404);
      if (match[2] && method === "GET") {
        const nome = `${row.titulo.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80) || "documento"}.${row.extensao}`;
        auth.audit(me.id, "documento_download", "documento", row.id);
        return new Response(Bun.file(join(pasta, row.arquivo)), {
          headers: {
            ...securityHeaders,
            "Content-Type": TIPOS[row.extensao],
            "Content-Disposition": `${url.searchParams.has("ver") && row.extensao === "pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (!cartorio) throw new InputError("Só a equipe do cartório altera documentos.", 403);
      if (!match[2] && method === "PATCH") {
        const body = await req.json();
        if (body.categoria && !CATEGORIAS[body.categoria]) throw new InputError("Escolha a categoria.");
        if (body.visibilidade && !VISIBILIDADES[body.visibilidade]) throw new InputError("Escolha quem pode ver.");
        db.query("UPDATE documentos SET titulo=?,descricao=?,categoria=?,visibilidade=? WHERE id=?").run(
          textValue(String(body.titulo ?? row.titulo), "Título", 160, true),
          textValue(String(body.descricao ?? row.descricao), "Descrição", 600),
          body.categoria || row.categoria,
          body.visibilidade || row.visibilidade,
          row.id,
        );
        auth.audit(me.id, "documento_update", "documento", row.id);
        return json({ documento: shape(db.query("SELECT * FROM documentos WHERE id=?").get(row.id)) });
      }
      if (!match[2] && method === "DELETE") {
        db.query("DELETE FROM documentos WHERE id=?").run(row.id);
        await unlink(join(pasta, row.arquivo)).catch(() => {});
        auth.audit(me.id, "documento_delete", "documento", row.id, row.titulo);
        return json({ ok: true });
      }
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle, salvar };
}
