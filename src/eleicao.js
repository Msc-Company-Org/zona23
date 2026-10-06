import { GROUPS } from "./auth.js";
import { LOCAIS, SECAO_LOCAL } from "./locais.js";

// Dia da eleição: locais e seções, acompanhamento da totalização (dados públicos do TSE)
// e central de demandas (pedidos de administradores de prédio e presidentes).
const TSE = "https://resultados.tse.jus.br/oficial";
const MUNICIPIO = "60011"; // Rio de Janeiro no cadastro do TSE
const ZONA = "0023";
const TIPOS = {
  localizar_eleitor: "Título, seção ou local de votação",
  material: "Material ou ata",
  urna: "Urna eletrônica",
  mesario: "Mesário ausente ou substituição",
  infraestrutura: "Sala, energia ou estrutura",
  policiamento: "Policiamento",
  filas: "Filas",
  procedimento: "Dúvida de procedimento",
  outro: "Outro",
};
const PRIORIDADES = ["normal", "alta", "urgente"];
const CANAIS = ["sistema", "whatsapp", "telefone", "presencial"];
const DIAS_DADOS_ELEITOR = 7;

export function migrateEleicao(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS locais_info (
      local_id INTEGER PRIMARY KEY, guarda TEXT NOT NULL DEFAULT '', acessibilidade TEXT NOT NULL DEFAULT '',
      observacao TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS secoes_info (
      secao INTEGER PRIMARY KEY, sala TEXT NOT NULL DEFAULT '', observacao TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS totalizacao_pleitos (
      pleito TEXT PRIMARY KEY, data TEXT NOT NULL, rotulo TEXT NOT NULL, publicadas INTEGER NOT NULL DEFAULT 0,
      consultado_em TEXT NOT NULL DEFAULT '', erro TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS totalizacao (
      pleito TEXT NOT NULL, secao INTEGER NOT NULL, status TEXT NOT NULL, recebido TEXT NOT NULL DEFAULT '',
      consultado_em TEXT NOT NULL, PRIMARY KEY (pleito, secao)
    );
    CREATE TABLE IF NOT EXISTS demandas (
      id TEXT PRIMARY KEY, numero INTEGER NOT NULL, tipo TEXT NOT NULL, descricao TEXT NOT NULL,
      local_id INTEGER, secao INTEGER, solicitante TEXT NOT NULL DEFAULT '', canal TEXT NOT NULL DEFAULT 'sistema',
      prioridade TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'aberta',
      dados_eleitor TEXT NOT NULL DEFAULT '', resposta TEXT NOT NULL DEFAULT '',
      aberta_por TEXT NOT NULL, responsavel TEXT NOT NULL DEFAULT '',
      criada_em TEXT NOT NULL, atualizada_em TEXT NOT NULL, assumida_em TEXT NOT NULL DEFAULT '', concluida_em TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS demandas_status ON demandas(status, criada_em);
  `);
}

const agora = () => new Date().toISOString();
// "04/10/2026" + "19:14:29" (horário de Brasília) → "2026-10-04T19:14:29"
const quando = (data, hora) => (data && hora ? `${data.slice(6, 10)}-${data.slice(3, 5)}-${data.slice(0, 2)}T${hora}` : "");

export function createEleicao(ctx) {
  const { db, json, InputError, textValue, auth } = ctx;
  const fetchJson =
    ctx.fetchJson ||
    (async (url) => {
      const response = await fetch(url, {
        headers: { "User-Agent": "zon023.com.br (acompanhamento da 23a ZE)" },
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 403 || response.status === 404) return null;
      if (!response.ok) throw new Error(`TSE respondeu ${response.status}`);
      return response.json();
    });

  // ---------- Totalização ----------
  let syncing = null;
  async function descobrirPleitos() {
    const config = await fetchJson(`${TSE}/comum/config/ele-c.json`);
    for (const pleito of config?.pl || []) {
      const federal = (pleito.e || []).find((e) => /Federal/.test(e.nm || ""));
      if (!federal || !pleito.dt?.endsWith("/2026")) continue;
      const turno = /2º Turno/.test(federal.nm) || pleito.dt === "25/10/2026" ? "2º turno" : "1º turno";
      db.query(
        "INSERT INTO totalizacao_pleitos (pleito,data,rotulo) VALUES (?,?,?) ON CONFLICT(pleito) DO NOTHING",
      ).run(String(pleito.cd), quando(pleito.dt, "00:00:00").slice(0, 10), `${turno} · ${pleito.dt}`);
    }
  }
  async function sincronizarPleito(pleito) {
    const cs = await fetchJson(`${TSE}/ele2026/arquivo-urna/${pleito}/config/rj/rj-p${pleito.padStart(6, "0")}-cs.json`);
    const zona = cs?.abr?.[0]?.mu?.find((mu) => mu.cd === MUNICIPIO)?.zon?.find((z) => z.cd === ZONA);
    const publicadas = (zona?.sec || []).map((s) => Number(s.ns)).filter((n) => SECAO_LOCAL.has(n));
    const prontas = new Set(
      db.query("SELECT secao FROM totalizacao WHERE pleito=? AND status='Totalizada'").all(pleito).map((r) => r.secao),
    );
    const faltam = publicadas.filter((secao) => !prontas.has(secao));
    // Poucas consultas simultâneas: o portal do TSE é público e compartilhado.
    for (let i = 0; i < faltam.length; i += 4) {
      await Promise.all(
        faltam.slice(i, i + 4).map(async (secao) => {
          const n = String(secao).padStart(4, "0");
          const aux = await fetchJson(
            `${TSE}/ele2026/arquivo-urna/${pleito}/dados/rj/${MUNICIPIO}/${ZONA}/${n}/p${pleito.padStart(6, "0")}-rj-m${MUNICIPIO}-z${ZONA}-s${n}-aux.json`,
          ).catch(() => null);
          if (!aux) return;
          const ultimo = (aux.hashes || []).at(-1) || {};
          db.query(
            `INSERT INTO totalizacao VALUES (?,?,?,?,?) ON CONFLICT(pleito,secao)
             DO UPDATE SET status=excluded.status, recebido=excluded.recebido, consultado_em=excluded.consultado_em`,
          ).run(pleito, secao, aux.st || ultimo.st || "Recebida", quando(ultimo.dr, ultimo.hr), agora());
        }),
      );
    }
    db.query("UPDATE totalizacao_pleitos SET publicadas=?, consultado_em=?, erro='' WHERE pleito=?").run(
      publicadas.length,
      agora(),
      pleito,
    );
  }
  async function sincronizar() {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        await descobrirPleitos();
        for (const { pleito } of db.query("SELECT pleito FROM totalizacao_pleitos ORDER BY data").all()) {
          const completo =
            db.query("SELECT COUNT(*) c FROM totalizacao WHERE pleito=? AND status='Totalizada'").get(pleito).c >=
            SECAO_LOCAL.size;
          if (completo) continue;
          try {
            await sincronizarPleito(pleito);
          } catch (error) {
            db.query("UPDATE totalizacao_pleitos SET erro=?, consultado_em=? WHERE pleito=?").run(
              String(error.message).slice(0, 200),
              agora(),
              pleito,
            );
          }
        }
      } catch (error) {
        console.error("Totalização:", error.message);
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }
  let timer = null;
  if (ctx.totalizacao !== false) {
    // A cada 3 minutos; quando todas as seções já constam como totalizadas, a consulta é só a lista de pleitos.
    setTimeout(sincronizar, 5000);
    timer = setInterval(sincronizar, 3 * 60000);
  }
  function painelTotalizacao(pleitoPedido) {
    const pleitos = db.query("SELECT * FROM totalizacao_pleitos ORDER BY data DESC").all();
    const atual = pleitos.find((p) => p.pleito === pleitoPedido) || pleitos[0];
    if (!atual) return { pleitos: [], atual: null };
    const linhas = db.query("SELECT secao,status,recebido FROM totalizacao WHERE pleito=?").all(atual.pleito);
    const porSecao = new Map(linhas.map((linha) => [linha.secao, linha]));
    const totalizadas = linhas.filter((linha) => linha.status === "Totalizada");
    const horas = totalizadas.map((linha) => linha.recebido).filter(Boolean).sort();
    // Acumulado por intervalo de 10 minutos, para o gráfico.
    const serie = [];
    let acumulado = 0;
    for (const [faixa, n] of Object.entries(
      horas.reduce((acc, hora) => ((acc[hora.slice(11, 15) + "0"] = (acc[hora.slice(11, 15) + "0"] || 0) + 1), acc), {}),
    ).sort()) {
      acumulado += n;
      serie.push({ hora: faixa, acumulado });
    }
    return {
      pleitos,
      atual,
      total: SECAO_LOCAL.size,
      totalizadas: totalizadas.length,
      primeira: horas[0] || "",
      ultima: horas.at(-1) || "",
      serie,
      locais: LOCAIS.map((local) => {
        const secoes = local.secoes.map((secao) => ({ secao, ...(porSecao.get(secao) || { status: "Aguardando", recebido: "" }) }));
        const prontas = secoes.filter((s) => s.status === "Totalizada");
        return {
          id: local.id,
          nome: local.nome,
          area: local.area,
          total: secoes.length,
          totalizadas: prontas.length,
          ultima: prontas.map((s) => s.recebido).sort().at(-1) || "",
          secoes,
        };
      }),
    };
  }

  // ---------- Demandas ----------
  const DEMANDA = `d.*, (SELECT name FROM users WHERE id=d.aberta_por) AS aberta_por_nome,
    (SELECT name FROM users WHERE id=d.responsavel) AS responsavel_nome`;
  function limparDadosEleitor() {
    const limite = new Date(Date.now() - DIAS_DADOS_ELEITOR * 86400000).toISOString();
    db.query("UPDATE demandas SET dados_eleitor='' WHERE dados_eleitor<>'' AND status IN ('concluida','cancelada') AND atualizada_em<?").run(limite);
  }
  function shapeDemanda(row) {
    const local = row.local_id ? LOCAIS.find((l) => l.id === row.local_id) : null;
    return { ...row, local: local ? { id: local.id, nome: local.nome, area: local.area } : null, tipoNome: TIPOS[row.tipo] || row.tipo };
  }
  const demanda = (id) => {
    const row = db.query(`SELECT ${DEMANDA} FROM demandas d WHERE d.id=?`).get(id);
    if (!row) throw new InputError("Demanda não encontrada.", 404);
    return row;
  };

  async function handle(req, url, path) {
    const method = req.method;
    const me = auth.guard(req);
    const cartorio = GROUPS.cartorio.includes(me.role);
    const podeAbrir = cartorio || ["presidente", "adm_predio"].includes(me.role);

    // ---------- Locais e seções ----------
    if (path === "/api/eleicao/locais" && method === "GET") {
      const info = new Map(db.query("SELECT * FROM locais_info").all().map((r) => [r.local_id, r]));
      const salas = new Map(db.query("SELECT * FROM secoes_info").all().map((r) => [r.secao, r]));
      const abertas = new Map(
        db.query("SELECT local_id, COUNT(*) c FROM demandas WHERE status IN ('aberta','em_atendimento') GROUP BY local_id").all().map((r) => [r.local_id, r.c]),
      );
      return json({
        total: { locais: LOCAIS.length, secoes: SECAO_LOCAL.size },
        locais: LOCAIS.map((local) => ({
          ...local,
          guarda: info.get(local.id)?.guarda || "",
          acessibilidade: info.get(local.id)?.acessibilidade || "",
          observacao: info.get(local.id)?.observacao || "",
          demandasAbertas: abertas.get(local.id) || 0,
          secoes: local.secoes.map((secao) => ({ secao, sala: salas.get(secao)?.sala || "", observacao: salas.get(secao)?.observacao || "" })),
        })),
      });
    }
    const localMatch = path.match(/^\/api\/eleicao\/locais\/(\d+)$/);
    if (localMatch && method === "PATCH") {
      if (!cartorio) throw new InputError("Só a equipe do cartório altera os locais.", 403);
      const id = Number(localMatch[1]);
      if (!LOCAIS.some((local) => local.id === id)) throw new InputError("Local não encontrado.", 404);
      const body = await req.json();
      const value = (key, label, max) => textValue(String(body[key] ?? ""), label, max);
      db.query(
        `INSERT INTO locais_info VALUES (?,?,?,?,?,?) ON CONFLICT(local_id) DO UPDATE SET guarda=excluded.guarda,
         acessibilidade=excluded.acessibilidade, observacao=excluded.observacao, updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
      ).run(id, value("guarda", "Guarda das urnas", 160), value("acessibilidade", "Acessibilidade", 240), value("observacao", "Observação", 500), me.id, agora());
      auth.audit(me.id, "local_update", "local", String(id));
      return json({ ok: true });
    }
    const secaoMatch = path.match(/^\/api\/eleicao\/secoes\/(\d+)$/);
    if (secaoMatch && method === "PATCH") {
      if (!cartorio) throw new InputError("Só a equipe do cartório altera as seções.", 403);
      const secao = Number(secaoMatch[1]);
      if (!SECAO_LOCAL.has(secao)) throw new InputError("Seção não encontrada na 23ª ZE.", 404);
      const body = await req.json();
      db.query(
        `INSERT INTO secoes_info VALUES (?,?,?,?,?) ON CONFLICT(secao) DO UPDATE SET sala=excluded.sala,
         observacao=excluded.observacao, updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
      ).run(secao, textValue(String(body.sala ?? ""), "Sala", 60), textValue(String(body.observacao ?? ""), "Observação", 240), me.id, agora());
      auth.audit(me.id, "secao_update", "secao", String(secao), String(body.sala ?? ""));
      return json({ ok: true });
    }

    // ---------- Totalização ----------
    if (path === "/api/eleicao/totalizacao" && method === "GET")
      return json(painelTotalizacao(url.searchParams.get("pleito") || ""));
    if (path === "/api/eleicao/totalizacao/atualizar" && method === "POST") {
      if (!cartorio) throw new InputError("Só a equipe do cartório pede atualização.", 403);
      await sincronizar();
      return json(painelTotalizacao(url.searchParams.get("pleito") || ""));
    }

    // ---------- Demandas ----------
    if (path === "/api/eleicao/demandas" && method === "GET") {
      limparDadosEleitor();
      const status = url.searchParams.get("status") || "";
      // Quem é de campo vê só o que abriu; o cartório e as autoridades veem tudo.
      const proprias = GROUPS.campo.includes(me.role);
      const rows = db
        .query(
          `SELECT ${DEMANDA} FROM demandas d WHERE (?='' OR d.status=?) AND (?=0 OR d.aberta_por=?)
           ORDER BY CASE d.status WHEN 'aberta' THEN 0 WHEN 'em_atendimento' THEN 1 ELSE 2 END,
             CASE d.prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END, d.criada_em DESC LIMIT 300`,
        )
        .all(status, status, proprias ? 1 : 0, me.id)
        .map(shapeDemanda);
      const contagem = Object.fromEntries(
        db
          .query(`SELECT status, COUNT(*) c FROM demandas WHERE (?=0 OR aberta_por=?) GROUP BY status`)
          .all(proprias ? 1 : 0, me.id)
          .map((r) => [r.status, r.c]),
      );
      // Autoridades não precisam ver dados de eleitor: só o cartório e quem abriu.
      return json({
        tipos: TIPOS,
        contagem,
        demandas: rows.map((row) => (cartorio || row.aberta_por === me.id ? row : { ...row, dados_eleitor: row.dados_eleitor ? "[restrito]" : "" })),
      });
    }
    if (path === "/api/eleicao/demandas" && method === "POST") {
      if (!podeAbrir) throw new InputError("Seu perfil acompanha as demandas, mas não abre novas.", 403);
      const body = await req.json();
      if (!TIPOS[body.tipo]) throw new InputError("Escolha o tipo da demanda.");
      let secao = body.secao ? Number(body.secao) : null;
      if (secao && !SECAO_LOCAL.has(secao)) throw new InputError("Seção não encontrada na 23ª ZE.");
      let localId = body.localId ? Number(body.localId) : secao ? SECAO_LOCAL.get(secao).id : null;
      // Pessoal de campo abre demandas do próprio local.
      if (!cartorio) {
        localId = me.local_id || (me.secao ? SECAO_LOCAL.get(me.secao)?.id : null) || localId;
        if (me.role === "presidente" && !secao) secao = me.secao || null;
      }
      if (localId && !LOCAIS.some((local) => local.id === localId)) throw new InputError("Local não encontrado.");
      const prioridade = PRIORIDADES.includes(body.prioridade) ? body.prioridade : "normal";
      const canal = cartorio && CANAIS.includes(body.canal) ? body.canal : "sistema";
      const id = crypto.randomUUID();
      const numero = (db.query("SELECT MAX(numero) n FROM demandas").get().n || 0) + 1;
      const now = agora();
      db.query(
        `INSERT INTO demandas (id,numero,tipo,descricao,local_id,secao,solicitante,canal,prioridade,dados_eleitor,aberta_por,criada_em,atualizada_em)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        numero,
        body.tipo,
        textValue(String(body.descricao ?? ""), "Descrição", 1000, true),
        localId,
        secao,
        cartorio ? textValue(String(body.solicitante ?? ""), "Quem pediu", 120) : me.name || me.username,
        canal,
        prioridade,
        textValue(String(body.dadosEleitor ?? ""), "Dados do eleitor", 300),
        me.id,
        now,
        now,
      );
      auth.audit(me.id, "demanda_create", "demanda", id, body.tipo);
      return json({ demanda: shapeDemanda(demanda(id)) }, 201);
    }
    const demandaMatch = path.match(/^\/api\/eleicao\/demandas\/([a-f0-9-]{36})$/);
    if (demandaMatch && method === "PATCH") {
      const atual = demanda(demandaMatch[1]);
      const body = await req.json();
      const acao = body.acao;
      if (!cartorio && !(acao === "cancelar" && atual.aberta_por === me.id && atual.status === "aberta"))
        throw new InputError("Só a equipe do cartório atende as demandas.", 403);
      const now = agora();
      const resposta = body.resposta === undefined ? atual.resposta : textValue(String(body.resposta), "Resposta", 1000);
      const prioridade = PRIORIDADES.includes(body.prioridade) ? body.prioridade : atual.prioridade;
      const transicoes = {
        assumir: () => ["em_atendimento", me.id, now, atual.concluida_em],
        concluir: () => {
          if (!resposta) throw new InputError("Registre a resposta antes de concluir.");
          return ["concluida", atual.responsavel || me.id, atual.assumida_em || now, now];
        },
        reabrir: () => ["aberta", "", "", ""],
        cancelar: () => ["cancelada", atual.responsavel, atual.assumida_em, now],
        atualizar: () => [atual.status, atual.responsavel, atual.assumida_em, atual.concluida_em],
      };
      if (!transicoes[acao]) throw new InputError("Ação desconhecida.");
      const [status, responsavel, assumida, concluida] = transicoes[acao]();
      db.query(
        "UPDATE demandas SET status=?,responsavel=?,assumida_em=?,concluida_em=?,resposta=?,prioridade=?,atualizada_em=? WHERE id=?",
      ).run(status, responsavel, assumida, concluida, resposta, prioridade, now, atual.id);
      auth.audit(me.id, "demanda_" + acao, "demanda", atual.id);
      return json({ demanda: shapeDemanda(demanda(atual.id)) });
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle, sincronizar, stop: () => timer && clearInterval(timer) };
}
