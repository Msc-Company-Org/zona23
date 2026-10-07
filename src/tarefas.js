import { GROUPS } from "./auth.js";
import { SECAO_LOCAL } from "./locais.js";

// Tarefas do cartório: delegação (responsável e apoio), checklist, comentários com @menção,
// documentos da biblioteca, histórico de quem mudou o quê e lotes a partir de modelos.
export const TIPOS = {
  sei: "Processo SEI",
  pje: "Processo PJe",
  filia: "FILIA",
  elo: "ELO",
  conseg: "Conseg",
  ti: "Chamado de TI",
  edital: "Edital",
  justificativas: "Justificativas",
  credenciamento: "Credenciamento",
  frequencia: "Frequência e declarações",
  oficio: "Ofício",
  outro: "Outro",
};
export const STATUS = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  aguardando: "Aguardando terceiro",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const ABERTAS = ["a_fazer", "em_andamento", "aguardando"];
const PRIORIDADES = ["normal", "alta", "urgente"];

// Modelos tirados do trabalho real do cartório (grupo de trabalho, set./out. 2026).
export const MODELOS = {
  justificativas: {
    nome: "Justificativas pós-turno",
    tipo: "justificativas",
    titulo: "Justificativas pós-turno",
    descricao: "Autuar um SEI para o lote, analisar as justificativas, minutar o despacho e lançar no ELO.",
    itens: ["Autuar o SEI do lote", "Analisar as justificativas", "Minutar o despacho", "Lançar no ELO", "Concluir e arquivar o SEI"],
    lote: true,
  },
  editais: {
    nome: "Editais de audiências públicas",
    tipo: "edital",
    titulo: "Editais de audiências públicas",
    descricao: "Montar os editais do período conforme o manual de audiências públicas.",
    itens: ["Geração de mídias", "Preparação de urnas", "Conferência visual", "Conferir com o manual de audiências públicas", "Publicar e juntar ao SEI"],
  },
  frequencia: {
    nome: "Frequência e declarações do dia",
    tipo: "frequencia",
    titulo: "Frequência e declarações do dia",
    descricao: "Registro de frequência e declarações de comparecimento do dia, na pasta do Drive.",
    itens: ["Registro de frequência na pasta do dia", "Gerar as declarações", "Juntar em um PDF", "Enviar a quem pediu"],
  },
  credenciamento: {
    nome: "Credenciamento de fiscais e delegados",
    tipo: "credenciamento",
    titulo: "Credenciamento de fiscais e delegados",
    descricao: "Documentação enviada pelos partidos e federações para emissão de credenciais.",
    itens: ["Dar recibo do e-mail ao partido", "Conferir quem está autorizado a credenciar", "Montar o PDF com as assinaturas", "Emitir as credenciais"],
  },
  oficio: {
    nome: "Ofício para ciência do juiz",
    tipo: "oficio",
    titulo: "Ofício para ciência do juiz",
    descricao: "Abrir SEI com o ofício ou e-mail recebido e levar ao conhecimento do juízo.",
    itens: ["Abrir o SEI com o documento recebido", "Minutar o despacho", "Disponibilizar no bloco de assinatura", "Comunicar o resultado"],
  },
  chamado_ti: {
    nome: "Chamado de TI",
    tipo: "ti",
    titulo: "Chamado de TI",
    descricao: "Abrir o chamado explicando em detalhe o que acontece e acompanhar até a solução.",
    itens: ["Abrir o chamado com a descrição detalhada", "Acompanhar o atendimento", "Registrar a solução"],
  },
};
export const CRITERIOS = {
  pares_impares: "Dias pares e ímpares (2 pessoas)",
  secoes: "Faixas de seção",
  pessoas: "Uma tarefa igual para cada pessoa",
};

export function migrateTarefas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id TEXT PRIMARY KEY, numero INTEGER NOT NULL, titulo TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'outro',
      referencia TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '',
      prioridade TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'a_fazer', prazo TEXT NOT NULL DEFAULT '',
      aguardando TEXT NOT NULL DEFAULT '', lote TEXT NOT NULL DEFAULT '', modelo TEXT NOT NULL DEFAULT '',
      origem TEXT NOT NULL DEFAULT '', criada_por TEXT NOT NULL, criada_em TEXT NOT NULL, atualizada_em TEXT NOT NULL,
      concluida_em TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS tarefas_status ON tarefas(status, prazo);
    CREATE TABLE IF NOT EXISTS tarefa_apoio (tarefa_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (tarefa_id, user_id));
    CREATE TABLE IF NOT EXISTS tarefa_itens (
      id TEXT PRIMARY KEY, tarefa_id TEXT NOT NULL, texto TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0,
      feito INTEGER NOT NULL DEFAULT 0, feito_por TEXT NOT NULL DEFAULT '', feito_em TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS tarefa_itens_tarefa ON tarefa_itens(tarefa_id, ordem);
    CREATE TABLE IF NOT EXISTS tarefa_eventos (
      id TEXT PRIMARY KEY, tarefa_id TEXT NOT NULL, user_id TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL,
      texto TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tarefa_eventos_tarefa ON tarefa_eventos(tarefa_id, criado_em);
    CREATE TABLE IF NOT EXISTS tarefa_documentos (tarefa_id TEXT NOT NULL, documento_id TEXT NOT NULL, PRIMARY KEY (tarefa_id, documento_id));
  `);
}

const agora = () => new Date().toISOString();

// Cria tarefas a partir de um registro já validado (usado pela API e pela carga inicial).
export function inserirTarefa(db, t, autor, momento = agora()) {
  const id = crypto.randomUUID();
  const numero = (db.query("SELECT MAX(numero) n FROM tarefas").get().n || 0) + 1;
  db.query(
    `INSERT INTO tarefas (id,numero,titulo,tipo,referencia,descricao,responsavel,prioridade,status,prazo,aguardando,lote,modelo,origem,criada_por,criada_em,atualizada_em,concluida_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    numero,
    t.titulo,
    t.tipo || "outro",
    t.referencia || "",
    t.descricao || "",
    t.responsavel || "",
    t.prioridade || "normal",
    t.status || "a_fazer",
    t.prazo || "",
    t.aguardando || "",
    t.lote || "",
    t.modelo || "",
    t.origem || "",
    autor,
    momento,
    momento,
    t.status === "concluida" ? momento : "",
  );
  for (const userId of new Set(t.apoio || [])) if (userId && userId !== t.responsavel) db.query("INSERT OR IGNORE INTO tarefa_apoio VALUES (?,?)").run(id, userId);
  (t.itens || []).forEach((texto, ordem) =>
    db.query("INSERT INTO tarefa_itens (id,tarefa_id,texto,ordem) VALUES (?,?,?,?)").run(crypto.randomUUID(), id, texto, ordem),
  );
  for (const documentoId of t.documentos || []) db.query("INSERT OR IGNORE INTO tarefa_documentos VALUES (?,?)").run(id, documentoId);
  db.query("INSERT INTO tarefa_eventos (id,tarefa_id,user_id,tipo,texto,criado_em) VALUES (?,?,?,?,?,?)").run(
    crypto.randomUUID(),
    id,
    autor,
    "criada",
    t.origem ? `Criada a partir de: ${t.origem}` : "",
    momento,
  );
  return id;
}

export function createTarefas(ctx) {
  const { db, json, InputError, textValue, validDate, auth, today } = ctx;
  const nome = (id) => db.query("SELECT name, username FROM users WHERE id=?").get(id);
  const pessoa = (id) => {
    const row = id ? db.query("SELECT id, name, username, phone, role FROM users WHERE id=?").get(id) : null;
    return row ? { id: row.id, name: row.name || row.username, username: row.username, phone: row.phone } : null;
  };
  const equipeAtiva = () =>
    db
      .query(`SELECT id, name, username, phone, title, role FROM users WHERE active=1 AND role IN (${GROUPS.cartorio.map(() => "?").join(",")}) ORDER BY name COLLATE NOCASE`)
      .all(...GROUPS.cartorio)
      .map((u) => ({ id: u.id, name: u.name || u.username, username: u.username, phone: u.phone, title: u.title, role: u.role }));
  function membro(id, rotulo) {
    if (!id) return "";
    if (!equipeAtiva().some((u) => u.id === id)) throw new InputError(`${rotulo}: escolha alguém da equipe do cartório.`);
    return id;
  }
  const evento = (tarefaId, userId, tipo, texto = "") =>
    db.query("INSERT INTO tarefa_eventos (id,tarefa_id,user_id,tipo,texto,criado_em) VALUES (?,?,?,?,?,?)").run(crypto.randomUUID(), tarefaId, userId, tipo, texto, agora());
  const nomeCurto = (id) => {
    const u = nome(id);
    return u ? (u.name || u.username) : "—";
  };

  function campos(body, atual = {}) {
    const titulo = textValue(String(body.titulo ?? atual.titulo ?? ""), "Título", 140, true);
    const tipo = body.tipo ?? atual.tipo ?? "outro";
    if (!TIPOS[tipo]) throw new InputError("Escolha o tipo da tarefa.");
    const prioridade = body.prioridade ?? atual.prioridade ?? "normal";
    if (!PRIORIDADES.includes(prioridade)) throw new InputError("Prioridade inválida.");
    const prazo = String(body.prazo ?? atual.prazo ?? "");
    if (prazo && !validDate(prazo)) throw new InputError("Confira o prazo.");
    return {
      titulo,
      tipo,
      prioridade,
      prazo,
      referencia: textValue(String(body.referencia ?? atual.referencia ?? ""), "Referência", 120),
      descricao: textValue(String(body.descricao ?? atual.descricao ?? ""), "Descrição", 2000),
      aguardando: textValue(String(body.aguardando ?? atual.aguardando ?? ""), "Aguardando", 160),
    };
  }
  const listaApoio = (value, responsavel) =>
    [...new Set((Array.isArray(value) ? value : []).map(String))].filter((id) => id && id !== responsavel).map((id) => membro(id, "Apoio"));

  function resumo(row, hoje) {
    const apoio = db.query("SELECT user_id FROM tarefa_apoio WHERE tarefa_id=?").all(row.id).map((r) => pessoa(r.user_id)).filter(Boolean);
    const itens = db.query("SELECT COUNT(*) total, COALESCE(SUM(feito),0) feitos FROM tarefa_itens WHERE tarefa_id=?").get(row.id);
    const comentarios = db.query("SELECT COUNT(*) c FROM tarefa_eventos WHERE tarefa_id=? AND tipo='comentario'").get(row.id).c;
    return {
      id: row.id,
      numero: row.numero,
      titulo: row.titulo,
      tipo: row.tipo,
      tipoNome: TIPOS[row.tipo] || row.tipo,
      referencia: row.referencia,
      descricao: row.descricao,
      prioridade: row.prioridade,
      status: row.status,
      statusNome: STATUS[row.status],
      prazo: row.prazo,
      atrasada: Boolean(row.prazo && row.prazo < hoje && ABERTAS.includes(row.status)),
      aguardando: row.aguardando,
      lote: row.lote,
      modelo: row.modelo,
      origem: row.origem,
      responsavel: pessoa(row.responsavel),
      apoio,
      criadaPor: pessoa(row.criada_por),
      criadaEm: row.criada_em,
      atualizadaEm: row.atualizada_em,
      concluidaEm: row.concluida_em,
      itens: { total: itens.total, feitos: itens.feitos },
      comentarios,
    };
  }
  function tarefa(id) {
    const row = db.query("SELECT * FROM tarefas WHERE id=?").get(id);
    if (!row) throw new InputError("Tarefa não encontrada.", 404);
    return row;
  }
  function detalhe(id) {
    const row = tarefa(id);
    return {
      ...resumo(row, today()),
      lista: db.query("SELECT * FROM tarefa_itens WHERE tarefa_id=? ORDER BY ordem, rowid").all(id).map((i) => ({ id: i.id, texto: i.texto, feito: Boolean(i.feito), feitoPor: i.feito_por ? nomeCurto(i.feito_por) : "", feitoEm: i.feito_em })),
      eventos: db
        .query("SELECT * FROM tarefa_eventos WHERE tarefa_id=? ORDER BY criado_em, rowid")
        .all(id)
        .map((e) => ({ id: e.id, tipo: e.tipo, texto: e.texto, quando: e.criado_em, autor: pessoa(e.user_id) })),
      documentos: db
        .query("SELECT d.id, d.titulo, d.extensao, d.categoria FROM tarefa_documentos td JOIN documentos d ON d.id=td.documento_id WHERE td.tarefa_id=? ORDER BY d.titulo")
        .all(id),
    };
  }
  // @usuario nos comentários chama a pessoa para apoiar a tarefa.
  function mencionar(row, texto, autor) {
    const nomes = [...texto.matchAll(/@([a-z0-9._-]{2,32})/gi)].map((m) => m[1].toLowerCase());
    const chamados = [];
    for (const u of equipeAtiva()) {
      if (!nomes.includes(u.username.toLowerCase()) || u.id === row.responsavel) continue;
      if (db.query("INSERT OR IGNORE INTO tarefa_apoio VALUES (?,?)").run(row.id, u.id).changes) chamados.push(u.name);
    }
    if (chamados.length) evento(row.id, autor, "apoio", `Chamou para apoiar: ${chamados.join(", ")}`);
  }
  const toque = (id) => db.query("UPDATE tarefas SET atualizada_em=? WHERE id=?").run(agora(), id);

  function lote(body, me) {
    const modelo = MODELOS[body.modelo];
    if (!modelo) throw new InputError("Escolha um modelo.");
    const pessoas = [...new Set((Array.isArray(body.pessoas) ? body.pessoas : []).map(String))].map((id) => membro(id, "Pessoas"));
    if (!pessoas.length) throw new InputError("Escolha quem vai executar.");
    const criterio = CRITERIOS[body.criterio] ? body.criterio : "pessoas";
    let partes;
    if (criterio === "pares_impares") {
      if (pessoas.length !== 2) throw new InputError("Para dividir em dias pares e ímpares, escolha duas pessoas.");
      partes = ["dias pares", "dias ímpares"];
    } else if (criterio === "secoes") {
      const secoes = [...SECAO_LOCAL.keys()].sort((a, b) => a - b);
      const tamanho = Math.ceil(secoes.length / pessoas.length);
      partes = pessoas.map((_, i) => {
        const faixa = secoes.slice(i * tamanho, (i + 1) * tamanho);
        return `seções ${String(faixa[0]).padStart(4, "0")} a ${String(faixa.at(-1)).padStart(4, "0")}`;
      });
    } else partes = pessoas.map(() => "");
    const prazo = String(body.prazo || "");
    if (prazo && !validDate(prazo)) throw new InputError("Confira o prazo.");
    const referencia = textValue(String(body.referencia ?? ""), "Referência", 120);
    const grupo = crypto.randomUUID();
    const momento = agora();
    const ids = pessoas.map((responsavel, i) =>
      inserirTarefa(
        db,
        {
          titulo: partes[i] ? `${modelo.titulo} · ${partes[i]}` : modelo.titulo,
          tipo: modelo.tipo,
          descricao: modelo.descricao,
          referencia,
          prazo,
          responsavel,
          itens: modelo.itens,
          lote: grupo,
          modelo: body.modelo,
        },
        me.id,
        momento,
      ),
    );
    auth.audit(me.id, "tarefa_lote", "tarefa", grupo, `${body.modelo}:${ids.length}`);
    return ids;
  }

  async function handle(req, url, path) {
    const method = req.method;
    const me = auth.guard(req, GROUPS.cartorio);
    const gestao = GROUPS.gestao.includes(me.role);
    const hoje = today();

    if (path === "/api/tarefas" && method === "GET") {
      const visao = url.searchParams.get("visao") || "comigo";
      const filtros = {
        comigo: "t.responsavel=$me AND t.status IN ('a_fazer','em_andamento','aguardando')",
        apoio: "EXISTS (SELECT 1 FROM tarefa_apoio a WHERE a.tarefa_id=t.id AND a.user_id=$me) AND t.status IN ('a_fazer','em_andamento','aguardando')",
        equipe: "t.status IN ('a_fazer','em_andamento','aguardando')",
        atrasadas: "t.prazo<>'' AND t.prazo<$hoje AND t.status IN ('a_fazer','em_andamento','aguardando')",
        concluidas: "t.status IN ('concluida','cancelada')",
      };
      if (!filtros[visao]) throw new InputError("Visão desconhecida.");
      const contar = (where) => db.query(`SELECT COUNT(*) c FROM tarefas t WHERE ${where}`).get({ $me: me.id, $hoje: hoje }).c;
      const rows = db
        .query(
          `SELECT * FROM tarefas t WHERE ${filtros[visao]}
           ORDER BY CASE t.status WHEN 'em_andamento' THEN 0 WHEN 'a_fazer' THEN 1 WHEN 'aguardando' THEN 2 ELSE 3 END,
             CASE t.prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END,
             CASE WHEN t.prazo='' THEN '9999' ELSE t.prazo END, ${visao === "concluidas" ? "t.atualizada_em DESC" : "t.numero"} LIMIT 300`,
        )
        .all({ $me: me.id, $hoje: hoje });
      return json({
        hoje,
        visao,
        tipos: TIPOS,
        status: STATUS,
        modelos: Object.fromEntries(Object.entries(MODELOS).map(([key, m]) => [key, { nome: m.nome, tipo: m.tipo, lote: Boolean(m.lote), itens: m.itens }])),
        criterios: CRITERIOS,
        pessoas: equipeAtiva(),
        contagem: Object.fromEntries(Object.entries(filtros).filter(([key]) => key !== "concluidas").map(([key, where]) => [key, contar(where)])),
        tarefas: rows.map((row) => resumo(row, hoje)),
      });
    }
    if (path === "/api/tarefas/resumo" && method === "GET") {
      const abertas = db.query("SELECT * FROM tarefas WHERE status IN ('a_fazer','em_andamento','aguardando')").all();
      const minhas = abertas.filter((t) => t.responsavel === me.id);
      const porPessoa = {};
      for (const t of abertas) {
        const p = (porPessoa[t.responsavel || "-"] ||= { pessoa: pessoa(t.responsavel), abertas: 0, atrasadas: 0 });
        p.abertas++;
        if (t.prazo && t.prazo < hoje) p.atrasadas++;
      }
      return json({
        comigo: minhas.length,
        atrasadas: minhas.filter((t) => t.prazo && t.prazo < hoje).length,
        apoio: db.query("SELECT COUNT(*) c FROM tarefa_apoio a JOIN tarefas t ON t.id=a.tarefa_id WHERE a.user_id=? AND t.status IN ('a_fazer','em_andamento','aguardando')").get(me.id).c,
        equipe: abertas.length,
        equipeAtrasadas: abertas.filter((t) => t.prazo && t.prazo < hoje).length,
        proximas: minhas
          .sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"))
          .slice(0, 4)
          .map((row) => resumo(row, hoje)),
        porPessoa: Object.values(porPessoa).sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas),
      });
    }
    if (path === "/api/tarefas" && method === "POST") {
      const body = await req.json();
      const valor = campos(body);
      const responsavel = membro(String(body.responsavel || me.id), "Responsável");
      const itens = (Array.isArray(body.itens) ? body.itens : []).map((t) => textValue(String(t), "Item do checklist", 200)).filter(Boolean).slice(0, 40);
      const documentos = (Array.isArray(body.documentos) ? body.documentos : []).map(String).filter((id) => db.query("SELECT 1 FROM documentos WHERE id=?").get(id));
      const modelo = MODELOS[body.modelo] ? body.modelo : "";
      const id = inserirTarefa(db, { ...valor, responsavel, apoio: listaApoio(body.apoio, responsavel), itens, documentos, modelo }, me.id);
      if (responsavel !== me.id) evento(id, me.id, "responsavel", `Atribuída a ${nomeCurto(responsavel)}`);
      auth.audit(me.id, "tarefa_create", "tarefa", id, valor.tipo);
      return json({ tarefa: detalhe(id) }, 201);
    }
    if (path === "/api/tarefas/lote" && method === "POST") {
      const ids = lote(await req.json(), me);
      return json({ tarefas: ids.map((id) => resumo(tarefa(id), hoje)) }, 201);
    }

    const match = path.match(/^\/api\/tarefas\/([a-f0-9-]{36})(?:\/(comentarios|itens)(?:\/([a-f0-9-]{36}))?)?$/);
    if (!match) throw new InputError("Recurso não encontrado.", 404);
    const [, id, sub, itemId] = match;
    const atual = tarefa(id);

    if (!sub && method === "GET") return json({ tarefa: detalhe(id) });
    if (!sub && method === "PATCH") {
      const body = await req.json();
      const valor = campos(body, atual);
      const responsavel = body.responsavel === undefined ? atual.responsavel : membro(String(body.responsavel), "Responsável");
      const status = body.status ?? atual.status;
      if (!STATUS[status]) throw new InputError("Situação inválida.");
      if (status === "aguardando" && !valor.aguardando) throw new InputError("Diga de quem a tarefa está aguardando resposta.");
      const now = agora();
      const concluida = status === "concluida" ? atual.concluida_em || now : "";
      db.query(
        "UPDATE tarefas SET titulo=?,tipo=?,referencia=?,descricao=?,prioridade=?,prazo=?,aguardando=?,responsavel=?,status=?,concluida_em=?,atualizada_em=? WHERE id=?",
      ).run(valor.titulo, valor.tipo, valor.referencia, valor.descricao, valor.prioridade, valor.prazo, status === "aguardando" ? valor.aguardando : "", responsavel, status, concluida, now, id);
      if (status !== atual.status) evento(id, me.id, "status", `${STATUS[atual.status]} → ${STATUS[status]}${status === "aguardando" ? ` (${valor.aguardando})` : ""}`);
      if (responsavel !== atual.responsavel) {
        evento(id, me.id, "responsavel", `Passou para ${nomeCurto(responsavel)}`);
        db.query("DELETE FROM tarefa_apoio WHERE tarefa_id=? AND user_id=?").run(id, responsavel);
      }
      if (valor.prazo !== atual.prazo) evento(id, me.id, "prazo", valor.prazo ? `Prazo: ${valor.prazo.split("-").reverse().join("/")}` : "Prazo retirado");
      if (valor.prioridade !== atual.prioridade) evento(id, me.id, "prioridade", `Prioridade: ${valor.prioridade}`);
      const mudouTexto = ["titulo", "tipo", "referencia", "descricao"].filter((key) => valor[key] !== atual[key]);
      if (mudouTexto.length) evento(id, me.id, "edicao", `Alterou ${mudouTexto.map((k) => ({ titulo: "o título", tipo: "o tipo", referencia: "a referência", descricao: "a descrição" })[k]).join(", ")}`);
      if (body.apoio !== undefined) {
        const novos = listaApoio(body.apoio, responsavel);
        const antes = db.query("SELECT user_id FROM tarefa_apoio WHERE tarefa_id=?").all(id).map((r) => r.user_id);
        db.query("DELETE FROM tarefa_apoio WHERE tarefa_id=?").run(id);
        for (const userId of novos) db.query("INSERT OR IGNORE INTO tarefa_apoio VALUES (?,?)").run(id, userId);
        const entrou = novos.filter((x) => !antes.includes(x)).map(nomeCurto);
        const saiu = antes.filter((x) => !novos.includes(x)).map(nomeCurto);
        if (entrou.length || saiu.length)
          evento(id, me.id, "apoio", [entrou.length ? `Apoio: ${entrou.join(", ")}` : "", saiu.length ? `Saiu do apoio: ${saiu.join(", ")}` : ""].filter(Boolean).join(" · "));
      }
      if (body.documentos !== undefined) {
        db.query("DELETE FROM tarefa_documentos WHERE tarefa_id=?").run(id);
        for (const documentoId of (Array.isArray(body.documentos) ? body.documentos : []).map(String))
          if (db.query("SELECT 1 FROM documentos WHERE id=?").get(documentoId)) db.query("INSERT OR IGNORE INTO tarefa_documentos VALUES (?,?)").run(id, documentoId);
      }
      auth.audit(me.id, "tarefa_update", "tarefa", id, status);
      return json({ tarefa: detalhe(id) });
    }
    if (!sub && method === "DELETE") {
      // Apagar é exceção (lançada por engano); no dia a dia a tarefa é cancelada e fica no histórico.
      if (!gestao && atual.criada_por !== me.id) throw new InputError("Só quem criou ou a chefia apaga uma tarefa. Prefira cancelar.", 403);
      for (const tabela of ["tarefa_apoio", "tarefa_itens", "tarefa_eventos", "tarefa_documentos"]) db.query(`DELETE FROM ${tabela} WHERE tarefa_id=?`).run(id);
      db.query("DELETE FROM tarefas WHERE id=?").run(id);
      auth.audit(me.id, "tarefa_delete", "tarefa", id, atual.titulo.slice(0, 80));
      return json({ ok: true });
    }
    if (sub === "comentarios" && method === "POST") {
      const texto = textValue(String((await req.json()).texto ?? ""), "Comentário", 2000, true);
      evento(id, me.id, "comentario", texto);
      mencionar(atual, texto, me.id);
      toque(id);
      return json({ tarefa: detalhe(id) }, 201);
    }
    if (sub === "itens" && !itemId && method === "POST") {
      const texto = textValue(String((await req.json()).texto ?? ""), "Item do checklist", 200, true);
      const ordem = (db.query("SELECT MAX(ordem) o FROM tarefa_itens WHERE tarefa_id=?").get(id).o ?? -1) + 1;
      db.query("INSERT INTO tarefa_itens (id,tarefa_id,texto,ordem) VALUES (?,?,?,?)").run(crypto.randomUUID(), id, texto, ordem);
      toque(id);
      return json({ tarefa: detalhe(id) }, 201);
    }
    if (sub === "itens" && itemId) {
      const item = db.query("SELECT * FROM tarefa_itens WHERE id=? AND tarefa_id=?").get(itemId, id);
      if (!item) throw new InputError("Item não encontrado.", 404);
      if (method === "PATCH") {
        const body = await req.json();
        const feito = body.feito === undefined ? Boolean(item.feito) : Boolean(body.feito);
        const texto = body.texto === undefined ? item.texto : textValue(String(body.texto), "Item do checklist", 200, true);
        db.query("UPDATE tarefa_itens SET texto=?, feito=?, feito_por=?, feito_em=? WHERE id=?").run(texto, feito ? 1 : 0, feito ? item.feito_por || me.id : "", feito ? item.feito_em || agora() : "", itemId);
        if (feito !== Boolean(item.feito)) evento(id, me.id, "item", `${feito ? "Feito" : "Desmarcado"}: ${texto}`);
        // Primeiro item marcado põe a tarefa em andamento.
        if (feito && atual.status === "a_fazer") {
          db.query("UPDATE tarefas SET status='em_andamento' WHERE id=?").run(id);
          evento(id, me.id, "status", `${STATUS.a_fazer} → ${STATUS.em_andamento}`);
        }
        toque(id);
        return json({ tarefa: detalhe(id) });
      }
      if (method === "DELETE") {
        db.query("DELETE FROM tarefa_itens WHERE id=?").run(itemId);
        toque(id);
        return json({ tarefa: detalhe(id) });
      }
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle };
}
