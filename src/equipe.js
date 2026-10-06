import { ROLES } from "./auth.js";

// Área interna da equipe do cartório: pessoas da equipe, marcos do calendário e painel inicial.
// Os módulos de eleição (escala, tarefas, convocações…) entram aqui em arquivos próprios.
const MARCO_KINDS = ["eleicao", "preparacao", "reuniao", "prazo", "outro"];

export function migrateEquipe(db) {
  const created = !db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='marcos'").get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS marcos (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'outro',
      created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS marcos_date ON marcos(date);
  `);
  // Datas oficiais e públicas das Eleições 2026; o restante do calendário é lançado pela equipe.
  if (created) {
    const insert = db.query(
      "INSERT INTO marcos (id,date,time,title,detail,kind,created_at) VALUES (?,?,?,?,?,?,?)",
    );
    const now = new Date().toISOString();
    insert.run(crypto.randomUUID(), "2026-10-04", "08:00", "1º turno · Eleições 2026", "Votação das 8h às 17h.", "eleicao", now);
    insert.run(crypto.randomUUID(), "2026-10-25", "08:00", "2º turno · Eleições 2026", "Votação das 8h às 17h.", "eleicao", now);
  }
}

export function createEquipe(ctx) {
  const { db, json, InputError, textValue, validDate, auth, today } = ctx;

  const USER_FIELDS = "id,username,name,title,role,phone,email,active,must_change,onboarded_at,last_login_at,created_at";
  const shapeUser = (row, full) => {
    const base = {
      id: row.id,
      username: row.username,
      name: row.name || row.username,
      title: row.title,
      role: row.role,
      phone: row.phone,
      email: row.email,
    };
    if (!full) return base;
    return {
      ...base,
      active: Boolean(row.active),
      pending: Boolean(row.must_change),
      onboarded: Boolean(row.onboarded_at),
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    };
  };
  const findUser = (id) => {
    const row = db.query(`SELECT ${USER_FIELDS} FROM users WHERE id=?`).get(id);
    if (!row) throw new InputError("Pessoa não encontrada.", 404);
    return row;
  };
  function marco(body, current = {}) {
    const date = textValue(body.date ?? current.date ?? "", "Data", 10, true);
    if (!validDate(date)) throw new InputError("Confira a data.");
    const time = textValue(body.time ?? current.time ?? "", "Horário", 5);
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new InputError("Confira o horário.");
    const kind = body.kind ?? current.kind ?? "outro";
    if (!MARCO_KINDS.includes(kind)) throw new InputError("Confira o tipo do marco.");
    return {
      date,
      time,
      kind,
      title: textValue(body.title ?? current.title ?? "", "Título", 80, true),
      detail: textValue(body.detail ?? current.detail ?? "", "Detalhe", 240),
    };
  }

  async function handle(req, url, path) {
    const method = req.method;
    const me = auth.guard(req);
    const isAdmin = me.role === "admin";
    // Juiz(a) e promotor(a) consultam; quem altera é a equipe do cartório.
    if (me.role === "autoridade" && method !== "GET")
      throw new InputError("Seu perfil consulta as informações; alterações ficam com a equipe do cartório.", 403);

    // ---------- Início ----------
    if (path === "/api/equipe/inicio" && method === "GET") {
      const day = today();
      return json({
        today: day,
        user: auth.publicUser(me),
        team: db
          .query(`SELECT ${USER_FIELDS} FROM users WHERE active=1 ORDER BY name COLLATE NOCASE`)
          .all()
          .map((row) => shapeUser(row, false)),
        marcos: db
          .query("SELECT * FROM marcos WHERE date>=? ORDER BY date,time LIMIT 12")
          .all(day),
        recent: db
          .query("SELECT * FROM marcos WHERE date<? ORDER BY date DESC,time DESC LIMIT 3")
          .all(day),
      });
    }

    // ---------- Pessoas da equipe ----------
    if (path === "/api/equipe/users" && method === "GET")
      return json({
        users: db
          .query(
            `SELECT ${USER_FIELDS} FROM users ${isAdmin ? "" : "WHERE active=1"} ORDER BY active DESC, name COLLATE NOCASE`,
          )
          .all()
          .map((row) => shapeUser(row, isAdmin)),
      });
    const userMatch = path.match(/^\/api\/equipe\/users\/([a-f0-9-]{36})(\/link)?$/);
    if ((path === "/api/equipe/users" && method === "POST") || userMatch) {
      if (!isAdmin) throw new InputError("Só a administração gerencia as contas.", 403);
    }
    if (path === "/api/equipe/users" && method === "POST") {
      const body = await req.json();
      const created = auth.createUser({
        username: body.username,
        name: body.name,
        title: body.title,
        role: body.role || "equipe",
        phone: body.phone,
        email: body.email,
        createdBy: me.id,
      });
      return json({ user: shapeUser(created, true) }, 201);
    }
    if (userMatch && userMatch[2] && method === "POST") {
      const target = findUser(userMatch[1]);
      if (!target.active) throw new InputError("Reative a conta antes de gerar o link.");
      return json({ ...auth.issueLink(target, "invite", me.id, ctx.origin || url.origin), user: shapeUser(target, true) });
    }
    if (userMatch && !userMatch[2] && method === "PATCH") {
      const target = findUser(userMatch[1]);
      const body = await req.json();
      const role = body.role ?? target.role;
      if (!ROLES.includes(role)) throw new InputError("Perfil desconhecido.");
      const active = body.active === undefined ? Boolean(target.active) : Boolean(body.active);
      if (target.id === me.id && (role !== "admin" || !active))
        throw new InputError("Você não pode tirar o próprio acesso de administração.");
      const name = body.name === undefined ? target.name : textValue(body.name, "Nome", 80, true);
      const title = body.title === undefined ? target.title : textValue(String(body.title), "Cargo", 60);
      const phone = body.phone === undefined ? target.phone : auth.cleanPhone(body.phone);
      const email = body.email === undefined ? target.email : auth.cleanEmail(body.email, target.id);
      db.query("UPDATE users SET name=?,title=?,role=?,phone=?,email=?,active=? WHERE id=?").run(
        name,
        title,
        role,
        phone,
        email,
        active ? 1 : 0,
        target.id,
      );
      // Conta desativada perde as sessões abertas e os links pendentes.
      if (!active) {
        db.query("DELETE FROM sessions WHERE user_id=?").run(target.id);
        db.query("DELETE FROM magic_links WHERE user_id=? AND used_at=0").run(target.id);
      }
      auth.audit(me.id, "user_update", "user", target.id, active ? role : "inativo");
      return json({ user: shapeUser(findUser(target.id), true) });
    }

    // ---------- Marcos do calendário ----------
    if (path === "/api/equipe/marcos" && method === "GET") {
      const from = url.searchParams.get("from") || "";
      if (from && !validDate(from)) throw new InputError("Confira a data.");
      return json({
        marcos: db
          .query("SELECT * FROM marcos WHERE (?='' OR date>=?) ORDER BY date,time LIMIT 200")
          .all(from, from),
      });
    }
    if (path === "/api/equipe/marcos" && method === "POST") {
      const value = marco(await req.json());
      const id = crypto.randomUUID();
      db.query(
        "INSERT INTO marcos (id,date,time,title,detail,kind,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).run(id, value.date, value.time, value.title, value.detail, value.kind, me.id, new Date().toISOString());
      auth.audit(me.id, "marco_create", "marco", id, value.title);
      return json({ marco: db.query("SELECT * FROM marcos WHERE id=?").get(id) }, 201);
    }
    const marcoMatch = path.match(/^\/api\/equipe\/marcos\/([a-f0-9-]{36})$/);
    if (marcoMatch && method === "PATCH") {
      const current = db.query("SELECT * FROM marcos WHERE id=?").get(marcoMatch[1]);
      if (!current) throw new InputError("Marco não encontrado.", 404);
      const value = marco(await req.json(), current);
      db.query("UPDATE marcos SET date=?,time=?,title=?,detail=?,kind=? WHERE id=?").run(
        value.date,
        value.time,
        value.title,
        value.detail,
        value.kind,
        current.id,
      );
      auth.audit(me.id, "marco_update", "marco", current.id, value.title);
      return json({ marco: db.query("SELECT * FROM marcos WHERE id=?").get(current.id) });
    }
    if (marcoMatch && method === "DELETE") {
      if (!db.query("DELETE FROM marcos WHERE id=?").run(marcoMatch[1]).changes)
        throw new InputError("Marco não encontrado.", 404);
      auth.audit(me.id, "marco_delete", "marco", marcoMatch[1]);
      return json({ ok: true });
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle };
}
