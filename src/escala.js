import { GROUPS } from "./auth.js";

// Escala dos Auxiliares de Serviços Eleitorais (ASE): dias, horário e atividade, limite de
// convocações nos dois turnos, presença e pedidos de troca com aprovação da chefia.
// A escala chega hoje como texto no WhatsApp ("*SEGUNDA, 17/08/2026*" + "▫️ NOME") e entra colando.
export const LIMITE = 10;
export const ALERTA = 9;
const FIM_1_TURNO = "2026-10-04";
const PRESENCAS = ["", "presente", "faltou", "substituido"];
const SEMANA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

export const chaveNome = (texto) =>
  String(texto).normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
export const nomeProprio = (texto) =>
  String(texto)
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((parte, i) => (i > 0 && PARTICULAS.has(parte) ? parte : parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1)))
    .join(" ");
export const semana = (data) => SEMANA[new Date(data + "T12:00:00Z").getUTCDay()];
const turno = (data) => (data <= FIM_1_TURNO ? 1 : 2);

// Lê o texto do WhatsApp. Aceita o cabeçalho com ou sem asteriscos e os marcadores ▫️, •, - ou *.
export function lerEscala(texto) {
  const dias = new Map();
  const avisos = [];
  let atual = null;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/[*_~]/g, "").trim();
    if (!linha) continue;
    const dia = linha.match(/^(?:SEGUNDA|TER[CÇ]A|QUARTA|QUINTA|SEXTA|S[AÁ]BADO|DOMINGO)[^,]*,\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (dia) {
      const data = `${dia[3]}-${dia[2].padStart(2, "0")}-${dia[1].padStart(2, "0")}`;
      atual = dias.get(data) || { data, todos: false, nomes: [] };
      dias.set(data, atual);
      continue;
    }
    const pessoa = linha.match(/^(?:▫️?|◽️?|▪️?|•|-|–)\s*(.+)$/u);
    if (!pessoa || !atual) continue;
    const nome = pessoa[1].replace(/\s+/g, " ").trim();
    if (/^todos\b/i.test(nome)) {
      atual.todos = true;
      continue;
    }
    if (chaveNome(nome).length < 3) continue;
    if (atual.nomes.some((n) => chaveNome(n) === chaveNome(nome))) {
      avisos.push(`${nomeProprio(nome)} aparece duas vezes em ${atual.data.split("-").reverse().join("/")}.`);
      continue;
    }
    atual.nomes.push(nome);
  }
  return { dias: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)), avisos };
}

export function migrateEscala(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS escala_pessoas (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, chave TEXT NOT NULL UNIQUE, telefone TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '', ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS escala_dias (
      data TEXT PRIMARY KEY, atividade TEXT NOT NULL DEFAULT '', horario TEXT NOT NULL DEFAULT '',
      todos INTEGER NOT NULL DEFAULT 0, observacao TEXT NOT NULL DEFAULT '', atualizado_em TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS escala (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, pessoa_id TEXT NOT NULL, horario TEXT NOT NULL DEFAULT '',
      atividade TEXT NOT NULL DEFAULT '', presenca TEXT NOT NULL DEFAULT '', criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL, atualizado_por TEXT NOT NULL DEFAULT '', UNIQUE (data, pessoa_id)
    );
    CREATE INDEX IF NOT EXISTS escala_pessoa ON escala(pessoa_id, data);
    CREATE TABLE IF NOT EXISTS escala_trocas (
      id TEXT PRIMARY KEY, numero INTEGER NOT NULL, pessoa_id TEXT NOT NULL, de_data TEXT NOT NULL, para_data TEXT NOT NULL,
      motivo TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pendente', pedido_por TEXT NOT NULL,
      pedido_em TEXT NOT NULL, decidido_por TEXT NOT NULL DEFAULT '', decidido_em TEXT NOT NULL DEFAULT '', resposta TEXT NOT NULL DEFAULT ''
    );
  `);
}

const agora = () => new Date().toISOString();

// Grava a escala lida. Os dias presentes no texto ficam exatamente como no texto (quem saiu é retirado,
// quem ficou mantém horário, atividade e presença); os demais dias não mudam.
export function importarEscala(db, texto, autor = "", aplicar = true) {
  const { dias, avisos } = lerEscala(texto);
  if (!dias.length) return { dias: 0, pessoasNovas: [], incluidas: 0, retiradas: 0, avisos: ["Nenhum dia encontrado. Cole o texto com os dias (ex.: *SEGUNDA, 12/10/2026*) e os nomes (▫️ NOME)."], acima: [] };
  const pessoas = new Map(db.query("SELECT * FROM escala_pessoas").all().map((p) => [p.chave, p]));
  const novas = new Map();
  let incluidas = 0,
    retiradas = 0;
  const momento = agora();
  const gravar = db.transaction(() => {
    for (const dia of dias) {
      db.query("INSERT INTO escala_dias (data,todos,atualizado_em) VALUES (?,?,?) ON CONFLICT(data) DO UPDATE SET todos=excluded.todos, atualizado_em=excluded.atualizado_em").run(dia.data, dia.todos ? 1 : 0, momento);
      const ids = dia.nomes.map((nome) => {
        const chave = chaveNome(nome);
        let p = pessoas.get(chave) || novas.get(chave);
        if (!p) {
          p = { id: crypto.randomUUID(), nome: nomeProprio(nome), chave };
          db.query("INSERT INTO escala_pessoas (id,nome,chave,criado_em) VALUES (?,?,?,?)").run(p.id, p.nome, chave, momento);
          novas.set(chave, p);
        }
        return p.id;
      });
      const antes = db.query("SELECT pessoa_id FROM escala WHERE data=?").all(dia.data).map((r) => r.pessoa_id);
      for (const pessoaId of antes.filter((x) => !ids.includes(x))) {
        db.query("DELETE FROM escala WHERE data=? AND pessoa_id=?").run(dia.data, pessoaId);
        retiradas++;
      }
      for (const pessoaId of ids.filter((x) => !antes.includes(x))) {
        db.query("INSERT INTO escala (id,data,pessoa_id,criado_em,atualizado_em,atualizado_por) VALUES (?,?,?,?,?,?)").run(crypto.randomUUID(), dia.data, pessoaId, momento, momento, autor);
        incluidas++;
      }
    }
    if (!aplicar) throw new Previa();
  });
  try {
    gravar();
  } catch (error) {
    if (!(error instanceof Previa)) throw error;
  }
  // Contagem depois da importação (ou como ficaria, na prévia).
  const acima = contarConvocacoes(db, dias, aplicar ? null : { pessoas, novas })
    .filter((c) => c.total > LIMITE)
    .map((c) => `${c.nome}: ${c.total} convocações`);
  return { dias: dias.length, pessoasNovas: [...novas.values()].map((p) => p.nome), incluidas, retiradas, avisos, acima };
}
class Previa extends Error {}

// Na prévia o banco não muda: a contagem é refeita sobre o texto, somando os dias que já existem fora dele.
function contarConvocacoes(db, dias, previa) {
  if (!previa) return contagem(db);
  const datasTexto = new Set(dias.map((d) => d.data));
  const porChave = new Map();
  const somar = (chave, nome, data) => {
    const item = porChave.get(chave) || { nome, datas: new Set() };
    item.datas.add(data);
    porChave.set(chave, item);
  };
  for (const r of db.query("SELECT e.data, p.chave, p.nome FROM escala e JOIN escala_pessoas p ON p.id=e.pessoa_id").all())
    if (!datasTexto.has(r.data)) somar(r.chave, r.nome, r.data);
  for (const dia of dias) for (const nome of dia.nomes) somar(chaveNome(nome), nomeProprio(nome), dia.data);
  const todos = new Set(db.query("SELECT data FROM escala_dias WHERE todos=1").all().map((r) => r.data).filter((d) => !datasTexto.has(d)));
  for (const dia of dias) if (dia.todos) todos.add(dia.data);
  return [...porChave.values()].map((item) => ({ nome: item.nome, total: item.datas.size + [...todos].filter((d) => !item.datas.has(d)).length }));
}

// Convocações por pessoa: dias escalados + dias em que todos trabalham (eleição), nos dois turnos.
export function contagem(db) {
  const todos = db.query("SELECT data FROM escala_dias WHERE todos=1 ORDER BY data").all().map((r) => r.data);
  return db
    .query("SELECT p.*, (SELECT GROUP_CONCAT(data) FROM (SELECT data FROM escala WHERE pessoa_id=p.id ORDER BY data)) AS datas FROM escala_pessoas p WHERE p.ativo=1 ORDER BY p.nome")
    .all()
    .map((p) => {
      const datas = p.datas ? p.datas.split(",") : [];
      const extras = todos.filter((d) => !datas.includes(d));
      const total = datas.length + extras.length;
      return {
        id: p.id,
        nome: p.nome,
        telefone: p.telefone,
        userId: p.user_id,
        datas,
        todos: extras,
        total,
        turno1: [...datas, ...extras].filter((d) => turno(d) === 1).length,
        turno2: [...datas, ...extras].filter((d) => turno(d) === 2).length,
        situacao: total > LIMITE ? "acima" : total >= ALERTA ? "alerta" : "ok",
      };
    });
}

export function createEscala(ctx) {
  const { db, json, InputError, textValue, validDate, auth, today } = ctx;
  const nomeUsuario = (id) => {
    const u = id ? db.query("SELECT name, username FROM users WHERE id=?").get(id) : null;
    return u ? u.name || u.username : "";
  };
  const pessoaPorId = (id) => {
    const p = db.query("SELECT * FROM escala_pessoas WHERE id=?").get(id);
    if (!p) throw new InputError("Pessoa não encontrada na escala.", 404);
    return p;
  };
  const totalDe = (pessoaId) => contagem(db).find((c) => c.id === pessoaId)?.total || 0;
  // ASE com conta: liga pelo vínculo gravado ou pelo nome igual ao da escala.
  function minhaPessoa(me) {
    let p = db.query("SELECT * FROM escala_pessoas WHERE user_id=?").get(me.id);
    if (!p && me.name) {
      p = db.query("SELECT * FROM escala_pessoas WHERE chave=? AND user_id=''").get(chaveNome(me.name));
      if (p) db.query("UPDATE escala_pessoas SET user_id=? WHERE id=?").run(me.id, p.id);
    }
    return p || null;
  }
  const hora = (valor, rotulo) => {
    const v = textValue(String(valor ?? ""), rotulo, 40);
    return v;
  };
  function dataValida(valor, rotulo) {
    const data = String(valor || "");
    if (!validDate(data)) throw new InputError(`Confira ${rotulo}.`);
    return data;
  }
  function shapeTroca(t) {
    const p = db.query("SELECT nome FROM escala_pessoas WHERE id=?").get(t.pessoa_id);
    return {
      id: t.id,
      numero: t.numero,
      pessoaId: t.pessoa_id,
      pessoa: p?.nome || "—",
      deData: t.de_data,
      paraData: t.para_data,
      motivo: t.motivo,
      status: t.status,
      pedidoPor: nomeUsuario(t.pedido_por),
      pedidoEm: t.pedido_em,
      decididoPor: nomeUsuario(t.decidido_por),
      decididoEm: t.decidido_em,
      resposta: t.resposta,
    };
  }
  function painel() {
    const pessoas = contagem(db);
    const nomes = new Map(pessoas.map((p) => [p.id, p]));
    const registros = db.query("SELECT * FROM escala ORDER BY data").all();
    const porDia = new Map();
    for (const r of registros) (porDia.get(r.data) || porDia.set(r.data, []).get(r.data)).push(r);
    const dias = db.query("SELECT * FROM escala_dias ORDER BY data").all();
    for (const data of porDia.keys()) if (!dias.some((d) => d.data === data)) dias.push({ data, atividade: "", horario: "", todos: 0, observacao: "" });
    dias.sort((a, b) => a.data.localeCompare(b.data));
    return {
      hoje: today(),
      limite: LIMITE,
      alerta: ALERTA,
      dias: dias.map((d) => ({
        data: d.data,
        semana: semana(d.data),
        turno: turno(d.data),
        atividade: d.atividade,
        horario: d.horario,
        observacao: d.observacao,
        todos: Boolean(d.todos),
        pessoas: (porDia.get(d.data) || [])
          .map((r) => ({ id: r.id, pessoaId: r.pessoa_id, nome: nomes.get(r.pessoa_id)?.nome || "—", horario: r.horario, atividade: r.atividade, presenca: r.presenca, situacao: nomes.get(r.pessoa_id)?.situacao || "ok" }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      })),
      pessoas: pessoas.map((p) => ({ ...p, conta: Boolean(p.userId) })),
      trocas: db
        .query("SELECT * FROM escala_trocas ORDER BY CASE status WHEN 'pendente' THEN 0 ELSE 1 END, pedido_em DESC LIMIT 100")
        .all()
        .map(shapeTroca),
    };
  }
  function incluir(data, pessoaId, autor, extra = {}) {
    if (db.query("SELECT 1 FROM escala WHERE data=? AND pessoa_id=?").get(data, pessoaId)) throw new InputError("Essa pessoa já está escalada nesse dia.");
    const total = totalDe(pessoaId);
    const todosNoDia = db.query("SELECT todos FROM escala_dias WHERE data=?").get(data)?.todos;
    // Em dia de "todos" a convocação já está contada.
    if (!todosNoDia && total + 1 > LIMITE) throw new InputError(`${pessoaPorId(pessoaId).nome} já tem ${total} convocações; o limite é ${LIMITE} nos dois turnos.`);
    const momento = agora();
    db.query("INSERT INTO escala_dias (data,atualizado_em) VALUES (?,?) ON CONFLICT(data) DO NOTHING").run(data, momento);
    const id = crypto.randomUUID();
    db.query("INSERT INTO escala (id,data,pessoa_id,horario,atividade,criado_em,atualizado_em,atualizado_por) VALUES (?,?,?,?,?,?,?,?)").run(
      id,
      data,
      pessoaId,
      extra.horario || "",
      extra.atividade || "",
      momento,
      momento,
      autor,
    );
    return { id, total: todosNoDia ? total : total + 1 };
  }

  async function handle(req, url, path) {
    const method = req.method;
    const me = auth.guard(req, [...GROUPS.cartorio, "ase"]);
    const cartorio = GROUPS.cartorio.includes(me.role);
    const gestao = GROUPS.gestao.includes(me.role);

    // ---------- ASE: a própria escala ----------
    if (path === "/api/escala/minha" && method === "GET") {
      const p = minhaPessoa(me);
      if (!p) return json({ pessoa: null, limite: LIMITE, hoje: today() });
      const c = contagem(db).find((x) => x.id === p.id);
      const diasInfo = new Map(db.query("SELECT * FROM escala_dias").all().map((d) => [d.data, d]));
      const meus = db.query("SELECT * FROM escala WHERE pessoa_id=? ORDER BY data").all(p.id);
      const lista = [
        ...meus.map((r) => ({ data: r.data, horario: r.horario || diasInfo.get(r.data)?.horario || "", atividade: r.atividade || diasInfo.get(r.data)?.atividade || "", presenca: r.presenca, todos: false })),
        ...(c?.todos || []).map((data) => ({ data, horario: diasInfo.get(data)?.horario || "", atividade: diasInfo.get(data)?.atividade || "Dia da eleição · todos", presenca: "", todos: true })),
      ]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((d) => ({ ...d, semana: semana(d.data), turno: turno(d.data) }));
      return json({
        hoje: today(),
        limite: LIMITE,
        pessoa: { id: p.id, nome: p.nome, total: c?.total || 0, turno1: c?.turno1 || 0, turno2: c?.turno2 || 0, situacao: c?.situacao || "ok" },
        dias: lista,
        trocas: db.query("SELECT * FROM escala_trocas WHERE pessoa_id=? ORDER BY pedido_em DESC").all(p.id).map(shapeTroca),
      });
    }

    if (path === "/api/escala/trocas" && method === "POST") {
      const body = await req.json();
      const pessoa = cartorio ? pessoaPorId(String(body.pessoaId || "")) : minhaPessoa(me);
      if (!pessoa) throw new InputError("Seu nome ainda não está na escala. Fale com o cartório.", 403);
      const deData = dataValida(body.deData, "o dia que você quer trocar");
      const paraData = dataValida(body.paraData, "o dia que você prefere");
      if (deData === paraData) throw new InputError("Escolha um dia diferente.");
      if (!db.query("SELECT 1 FROM escala WHERE data=? AND pessoa_id=?").get(deData, pessoa.id)) throw new InputError("Essa pessoa não está escalada no dia a trocar.");
      if (db.query("SELECT 1 FROM escala WHERE data=? AND pessoa_id=?").get(paraData, pessoa.id)) throw new InputError("Essa pessoa já está escalada no novo dia.");
      if (db.query("SELECT 1 FROM escala_trocas WHERE pessoa_id=? AND de_data=? AND status='pendente'").get(pessoa.id, deData))
        throw new InputError("Já existe um pedido de troca pendente para esse dia.");
      const id = crypto.randomUUID();
      const numero = (db.query("SELECT MAX(numero) n FROM escala_trocas").get().n || 0) + 1;
      db.query("INSERT INTO escala_trocas (id,numero,pessoa_id,de_data,para_data,motivo,pedido_por,pedido_em) VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        numero,
        pessoa.id,
        deData,
        paraData,
        textValue(String(body.motivo ?? ""), "Motivo", 300),
        me.id,
        agora(),
      );
      auth.audit(me.id, "escala_troca_pedido", "escala_troca", id);
      return json({ troca: shapeTroca(db.query("SELECT * FROM escala_trocas WHERE id=?").get(id)) }, 201);
    }
    const trocaMatch = path.match(/^\/api\/escala\/trocas\/([a-f0-9-]{36})$/);
    if (trocaMatch && method === "PATCH") {
      const troca = db.query("SELECT * FROM escala_trocas WHERE id=?").get(trocaMatch[1]);
      if (!troca) throw new InputError("Pedido não encontrado.", 404);
      if (troca.status !== "pendente") throw new InputError("Esse pedido já foi respondido.");
      const body = await req.json();
      const resposta = textValue(String(body.resposta ?? ""), "Resposta", 300);
      if (body.acao === "cancelar") {
        const minha = minhaPessoa(me);
        if (!cartorio && minha?.id !== troca.pessoa_id) throw new InputError("Você só cancela os seus pedidos.", 403);
      } else if (["aprovar", "recusar"].includes(body.acao)) {
        if (!gestao) throw new InputError("Quem aprova ou recusa trocas é a chefia do cartório.", 403);
        if (body.acao === "aprovar") {
          if (db.query("SELECT 1 FROM escala WHERE data=? AND pessoa_id=?").get(troca.para_data, troca.pessoa_id)) throw new InputError("A pessoa já está escalada no novo dia.");
          const mudou = db
            .query("UPDATE escala SET data=?, presenca='', atualizado_em=?, atualizado_por=? WHERE data=? AND pessoa_id=?")
            .run(troca.para_data, agora(), me.id, troca.de_data, troca.pessoa_id).changes;
          if (!mudou) throw new InputError("A pessoa não está mais escalada no dia a trocar.");
          db.query("INSERT INTO escala_dias (data,atualizado_em) VALUES (?,?) ON CONFLICT(data) DO NOTHING").run(troca.para_data, agora());
        }
      } else throw new InputError("Ação desconhecida.");
      const status = { aprovar: "aprovada", recusar: "recusada", cancelar: "cancelada" }[body.acao];
      db.query("UPDATE escala_trocas SET status=?, decidido_por=?, decidido_em=?, resposta=? WHERE id=?").run(status, me.id, agora(), resposta, troca.id);
      auth.audit(me.id, "escala_troca_" + body.acao, "escala_troca", troca.id);
      return json({ troca: shapeTroca(db.query("SELECT * FROM escala_trocas WHERE id=?").get(troca.id)) });
    }

    // ---------- Daqui em diante, só a equipe do cartório ----------
    if (!cartorio) throw new InputError("A escala completa fica com a equipe do cartório.", 403);

    if (path === "/api/escala" && method === "GET") return json(painel());
    if (path === "/api/escala/resumo" && method === "GET") {
      const hoje = today();
      const p = painel();
      const proximos = p.dias.filter((d) => d.data >= hoje && (d.pessoas.length || d.todos)).slice(0, 3);
      return json({
        hoje,
        proximos: proximos.map((d) => ({ data: d.data, semana: d.semana, atividade: d.atividade, horario: d.horario, todos: d.todos, pessoas: d.pessoas.length })),
        trocasPendentes: p.trocas.filter((t) => t.status === "pendente").length,
        alerta: p.pessoas.filter((x) => x.situacao === "alerta").length,
        acima: p.pessoas.filter((x) => x.situacao === "acima").length,
      });
    }
    if (path === "/api/escala/importar" && method === "POST") {
      const body = await req.json();
      const texto = String(body.texto ?? "");
      if (!texto.trim() || texto.length > 60000) throw new InputError("Cole o texto da escala (até 60 mil caracteres).");
      const resultado = importarEscala(db, texto, me.id, Boolean(body.aplicar));
      if (body.aplicar) auth.audit(me.id, "escala_importar", "escala", "", `${resultado.dias} dias`);
      return json({ ...resultado, aplicado: Boolean(body.aplicar) });
    }
    const diaMatch = path.match(/^\/api\/escala\/dias\/(\d{4}-\d{2}-\d{2})(\/pessoas)?$/);
    if (diaMatch && ["PATCH", "POST"].includes(method)) {
      const data = dataValida(diaMatch[1], "a data");
      const body = await req.json();
      if (!diaMatch[2] && method === "PATCH") {
        db.query(
          `INSERT INTO escala_dias (data,atividade,horario,observacao,todos,atualizado_em) VALUES (?,?,?,?,?,?)
           ON CONFLICT(data) DO UPDATE SET atividade=excluded.atividade, horario=excluded.horario, observacao=excluded.observacao, todos=excluded.todos, atualizado_em=excluded.atualizado_em`,
        ).run(data, textValue(String(body.atividade ?? ""), "Atividade", 160), hora(body.horario, "Horário"), textValue(String(body.observacao ?? ""), "Observação", 300), body.todos ? 1 : 0, agora());
        auth.audit(me.id, "escala_dia", "escala_dia", data);
        return json({ ok: true });
      }
      if (diaMatch[2] && method === "POST") {
        let pessoaId = String(body.pessoaId || "");
        if (!pessoaId) {
          const nome = textValue(String(body.nome ?? ""), "Nome", 120, true);
          const chave = chaveNome(nome);
          const existe = db.query("SELECT id FROM escala_pessoas WHERE chave=?").get(chave);
          pessoaId = existe?.id || crypto.randomUUID();
          if (!existe) db.query("INSERT INTO escala_pessoas (id,nome,chave,criado_em) VALUES (?,?,?,?)").run(pessoaId, nomeProprio(nome), chave, agora());
        } else pessoaPorId(pessoaId);
        const r = incluir(data, pessoaId, me.id, { horario: hora(body.horario, "Horário"), atividade: textValue(String(body.atividade ?? ""), "Atividade", 160) });
        auth.audit(me.id, "escala_incluir", "escala", r.id, data);
        return json({ id: r.id, total: r.total, alerta: r.total >= ALERTA }, 201);
      }
    }
    const regMatch = path.match(/^\/api\/escala\/registros\/([a-f0-9-]{36})$/);
    if (regMatch) {
      const reg = db.query("SELECT * FROM escala WHERE id=?").get(regMatch[1]);
      if (!reg) throw new InputError("Registro não encontrado.", 404);
      if (method === "PATCH") {
        const body = await req.json();
        const presenca = body.presenca === undefined ? reg.presenca : String(body.presenca);
        if (!PRESENCAS.includes(presenca)) throw new InputError("Presença inválida.");
        db.query("UPDATE escala SET horario=?, atividade=?, presenca=?, atualizado_em=?, atualizado_por=? WHERE id=?").run(
          body.horario === undefined ? reg.horario : hora(body.horario, "Horário"),
          body.atividade === undefined ? reg.atividade : textValue(String(body.atividade), "Atividade", 160),
          presenca,
          agora(),
          me.id,
          reg.id,
        );
        auth.audit(me.id, "escala_registro", "escala", reg.id, presenca);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        db.query("DELETE FROM escala WHERE id=?").run(reg.id);
        auth.audit(me.id, "escala_retirar", "escala", reg.id, reg.data);
        return json({ ok: true });
      }
    }
    const pessoaMatch = path.match(/^\/api\/escala\/pessoas\/([a-f0-9-]{36})$/);
    if (pessoaMatch && method === "PATCH") {
      const p = pessoaPorId(pessoaMatch[1]);
      const body = await req.json();
      const nome = body.nome === undefined ? p.nome : nomeProprio(textValue(String(body.nome), "Nome", 120, true));
      const chave = chaveNome(nome);
      if (chave !== p.chave && db.query("SELECT 1 FROM escala_pessoas WHERE chave=? AND id<>?").get(chave, p.id)) throw new InputError("Já existe alguém com esse nome na escala.");
      const telefone = body.telefone === undefined ? p.telefone : String(body.telefone).replace(/\D/g, "").slice(0, 13);
      db.query("UPDATE escala_pessoas SET nome=?, chave=?, telefone=?, ativo=? WHERE id=?").run(nome, chave, telefone, body.ativo === undefined ? p.ativo : body.ativo ? 1 : 0, p.id);
      auth.audit(me.id, "escala_pessoa", "escala_pessoa", p.id);
      return json({ ok: true });
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle };
}
