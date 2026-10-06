import { randomBytes } from "node:crypto";

// Área da equipe: sessão por cookie HttpOnly, senha com Argon2 (Bun.password)
// e link de acesso de uso único (só o hash do token fica no banco).
const COOKIE = "z23_session";
const HOUR = 3600000;
const SESSION = { short: 12 * HOUR, long: 30 * 24 * HOUR };
// Quem entrou por link pode definir a senha sem informar a atual durante este intervalo.
const LINK_FRESH = 30 * 60000;
export const LINK_TTL = { login: 15 * 60000, invite: 72 * HOUR };
// Perfis de acesso. Cartório: administração do sistema, chefia e equipe; autoridades consultam;
// pessoal de campo (ASE, presidentes de seção e administradores de prédio) vê só o que é seu.
export const GROUPS = {
  gestao: ["admin", "chefe"],
  cartorio: ["admin", "chefe", "equipe"],
  autoridade: ["juiz", "promotor"],
  campo: ["ase", "presidente", "adm_predio"],
};
export const ROLES = [...GROUPS.cartorio, ...GROUPS.autoridade, ...GROUPS.campo];
const EASY = ["admin123", "12345678", "password", "senha123", "zona0230", "zon@0230", "123456789"];

export function migrateAuth(db) {
  const columns = (table) => db.query(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  const add = (table, column, definition) => {
    if (!columns(table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  // A conta criada pelo bootstrap antigo continua administradora.
  add("users", "name", "TEXT NOT NULL DEFAULT ''");
  add("users", "role", "TEXT NOT NULL DEFAULT 'admin'");
  add("users", "phone", "TEXT NOT NULL DEFAULT ''");
  add("users", "email", "TEXT NOT NULL DEFAULT ''");
  add("users", "active", "INTEGER NOT NULL DEFAULT 1");
  add("users", "initial_expires_at", "INTEGER NOT NULL DEFAULT 0");
  add("users", "last_login_at", "TEXT NOT NULL DEFAULT ''");
  add("users", "title", "TEXT NOT NULL DEFAULT ''");
  add("users", "onboarded_at", "TEXT NOT NULL DEFAULT ''");
  add("users", "local_id", "INTEGER");
  add("users", "secao", "INTEGER");
  // Perfil antigo "autoridade" vira juiz ou promotor conforme o cargo.
  db.exec(`UPDATE users SET role = CASE WHEN lower(title) LIKE '%ju_z%' THEN 'juiz' ELSE 'promotor' END WHERE role = 'autoridade'`);
  add("sessions", "created_at", "INTEGER NOT NULL DEFAULT 0");
  add("sessions", "remember", "INTEGER NOT NULL DEFAULT 0");
  add("sessions", "method", "TEXT NOT NULL DEFAULT 'password'");
  add("sessions", "label", "TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS magic_links (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL, entity TEXT NOT NULL DEFAULT '', entity_id TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  `);
}

// "João", " joao " e "JOÃO" chegam ao mesmo usuário.
export const loginName = (normalize, value) =>
  normalize(String(value ?? "")).replace(/[^a-z0-9._-]/g, "").slice(0, 32);

function deviceLabel(agent = "") {
  const system = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad/.test(agent)
      ? "iPhone"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS/.test(agent)
          ? "Mac"
          : /Linux/.test(agent)
            ? "Linux"
            : "Aparelho";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /SamsungBrowser/.test(agent)
      ? "Samsung Internet"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : /Safari\//.test(agent)
            ? "Safari"
            : "navegador";
  return `${system} · ${browser}`;
}

export function createAuth(ctx) {
  const { db, json, InputError, textValue, normalize, hash, secureCookie, dummyHash } = ctx;
  const mailer = ctx.mailer || null;

  const failures = new Map();
  function checkLock(key, limit = 8) {
    const now = Date.now();
    const entry = failures.get(key);
    if (entry && entry.until > now && entry.count >= limit)
      throw new InputError("Muitas tentativas. Espere 15 minutos.", 429);
    if (entry && entry.until <= now) failures.delete(key);
  }
  function fail(key) {
    if (failures.size > 10000) failures.clear();
    const entry = failures.get(key) || { count: 0, until: Date.now() + 15 * 60000 };
    entry.count++;
    failures.set(key, entry);
  }

  function audit(userId, action, entity = "", entityId = "", detail = "") {
    db.query("INSERT INTO audit_log (at,user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?)").run(
      new Date().toISOString(),
      userId || "",
      action,
      entity,
      entityId || "",
      String(detail).slice(0, 300),
    );
  }

  function cookieValue(req) {
    const match = (req.headers.get("Cookie") || "").match(
      new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`),
    );
    return match?.[1] || "";
  }
  const cookie = (value, maxAge) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;

  function user(req) {
    const token = cookieValue(req);
    if (!token) return null;
    const row = db
      .query(
        `SELECT u.id,u.username,u.name,u.role,u.title,u.phone,u.email,u.must_change,u.active,u.onboarded_at,u.local_id,u.secao,
          s.expires_at,s.created_at AS session_created,s.method,s.token_hash
         FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`,
      )
      .get(hash(token));
    if (!row || row.expires_at < Date.now() || !row.active) return null;
    return row;
  }
  const linkFresh = (me) => me.method === "link" && Date.now() - me.session_created < LINK_FRESH;
  const publicUser = (row) => ({
    id: row.id,
    username: row.username,
    name: row.name || row.username,
    role: row.role,
    title: row.title || "",
    localId: row.local_id ?? null,
    secao: row.secao ?? null,
    phone: row.phone || "",
    email: row.email || "",
    mustChange: Boolean(row.must_change),
    onboarded: Boolean(row.onboarded_at),
    linkFresh: row.session_created ? linkFresh(row) : false,
  });

  // Sem sessão: 401. Senha provisória: 403 até criar a própria.
  function guard(req, roles) {
    const me = user(req);
    if (!me) throw new InputError("Entre com seu usuário para continuar.", 401);
    if (me.must_change) throw new InputError("Crie sua senha antes de continuar.", 403);
    if (roles && !roles.includes(me.role))
      throw new InputError("Seu perfil não tem acesso a esta área.", 403);
    return me;
  }

  function startSession(row, req, { remember = false, method = "password" } = {}) {
    const token = randomBytes(32).toString("hex");
    const duration = remember ? SESSION.long : SESSION.short;
    const now = Date.now();
    db.query("DELETE FROM sessions WHERE expires_at<?").run(now);
    db.query(
      "INSERT INTO sessions (token_hash,user_id,expires_at,created_at,remember,method,label) VALUES (?,?,?,?,?,?,?)",
    ).run(hash(token), row.id, now + duration, now, remember ? 1 : 0, method, deviceLabel(req.headers.get("User-Agent") || ""));
    db.query("UPDATE users SET last_login_at=? WHERE id=?").run(new Date().toISOString(), row.id);
    audit(row.id, method === "link" ? "login_link" : "login");
    const response = json({
      user: publicUser({ ...row, method, session_created: now }),
    });
    response.headers.set("Set-Cookie", cookie(token, duration / 1000));
    return response;
  }

  function validatePassword(next) {
    if (typeof next !== "string" || next.length < 8 || next.length > 200)
      throw new InputError("A nova senha precisa ter pelo menos 8 caracteres.");
    if (EASY.includes(next.toLowerCase()) || /^(.)\1+$/.test(next))
      throw new InputError("Essa senha é fácil demais. Escolha outra.");
  }
  function cleanPhone(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (digits && (digits.length < 10 || digits.length > 13))
      throw new InputError("Confira o telefone com DDD.");
    return digits;
  }
  function cleanEmail(value, exceptId = "") {
    const email = textValue(String(value ?? ""), "E-mail", 160).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError("Confira o e-mail.");
    if (email && db.query("SELECT 1 FROM users WHERE email=? AND id<>?").get(email, exceptId))
      throw new InputError("Esse e-mail já está em outra conta.", 409);
    return email;
  }

  // Conta nova sem senha conhecida entra pelo link; com senha inicial, ela expira em `initialDays`.
  function createUser({ username, name = "", title = "", role = "equipe", phone = "", email = "", password = "", initialDays = 7, createdBy = "", localId = null, secao = null }) {
    const handle = loginName(normalize, username);
    if (!/^[a-z][a-z0-9._-]{1,31}$/.test(handle))
      throw new InputError("Usuário: use letras e números, começando por letra.");
    if (!ROLES.includes(role)) throw new InputError("Perfil desconhecido.");
    if (db.query("SELECT 1 FROM users WHERE username=?").get(handle))
      throw new InputError("Já existe alguém com esse usuário.", 409);
    const id = crypto.randomUUID();
    const display = textValue(name || handle[0].toUpperCase() + handle.slice(1), "Nome", 80, true);
    db.query(
      `INSERT INTO users (id,username,password_hash,must_change,created_at,name,title,role,phone,email,active,initial_expires_at)
       VALUES (?,?,?,1,?,?,?,?,?,?,1,?)`,
    ).run(
      id,
      handle,
      Bun.password.hashSync(password || randomBytes(24).toString("hex")),
      new Date().toISOString(),
      display,
      textValue(String(title ?? ""), "Cargo", 60),
      role,
      cleanPhone(phone),
      cleanEmail(email),
      password && initialDays ? Date.now() + initialDays * 24 * HOUR : 0,
    );
    if (localId || secao) db.query("UPDATE users SET local_id=?,secao=? WHERE id=?").run(localId || null, secao || null, id);
    audit(createdBy, "user_create", "user", id, handle);
    return db.query("SELECT * FROM users WHERE id=?").get(id);
  }

  function issueLink(target, purpose, createdBy = "", origin = ctx.origin || "") {
    if (!LINK_TTL[purpose]) throw new InputError("Tipo de link desconhecido.");
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    db.query("DELETE FROM magic_links WHERE expires_at<? OR used_at>0").run(now - 24 * HOUR);
    // Um link novo do mesmo tipo substitui o anterior ainda não usado.
    db.query("DELETE FROM magic_links WHERE user_id=? AND purpose=? AND used_at=0").run(target.id, purpose);
    db.query(
      "INSERT INTO magic_links (token_hash,user_id,purpose,expires_at,created_by,created_at) VALUES (?,?,?,?,?,?)",
    ).run(hash(token), target.id, purpose, now + LINK_TTL[purpose], createdBy, now);
    audit(createdBy || target.id, "link_issue", "user", target.id, purpose);
    // O token vai no fragmento (#): não aparece em logs nem é consumido pela prévia do WhatsApp.
    return { url: `${origin}/entrar/link#t=${token}`, expiresAt: now + LINK_TTL[purpose] };
  }

  // Primeira conta: só com senha forte configurada fora do código.
  if (ctx.bootstrapPassword && !db.query("SELECT 1 FROM users LIMIT 1").get())
    createUser({ username: "admin", name: "Administração", role: "admin", password: ctx.bootstrapPassword });

  async function handle(req, url, path, ip = "local") {
    const method = req.method;
    const origin = ctx.origin || url.origin;
    if (path === "/api/auth/config" && method === "GET")
      return json({
        ready: Boolean(db.query("SELECT 1 FROM users LIMIT 1").get()),
        email: Boolean(mailer),
      });
    if (path === "/api/auth/login" && method === "POST") {
      if (!db.query("SELECT 1 FROM users LIMIT 1").get())
        throw new InputError("A área da equipe ainda está em configuração. O acervo continua disponível.", 503);
      const body = await req.json();
      const username = loginName(normalize, body.username);
      if (!username) throw new InputError("Informe seu usuário.");
      const password = typeof body.password === "string" ? body.password : "";
      checkLock("user:" + username);
      checkLock("ip:" + ip, 30);
      const row = db.query("SELECT * FROM users WHERE username=?").get(username);
      const ok = row
        ? await Bun.password.verify(password, row.password_hash)
        : (await Bun.password.verify(password, dummyHash), false);
      if (!ok || !row.active) {
        fail("user:" + username);
        fail("ip:" + ip);
        throw new InputError("Usuário ou senha não conferem.", 401);
      }
      failures.delete("user:" + username);
      if (row.must_change && row.initial_expires_at && row.initial_expires_at < Date.now())
        throw new InputError("A senha inicial expirou. Peça um link de acesso à equipe.", 401);
      return startSession(row, req, { remember: body.remember === true });
    }
    if (path === "/api/auth/magic" && method === "POST") {
      const body = await req.json();
      const token = String(body.token ?? "");
      checkLock("link:" + ip, 20);
      const row = /^[a-f0-9]{64}$/.test(token)
        ? db.query("SELECT * FROM magic_links WHERE token_hash=?").get(hash(token))
        : null;
      if (!row) {
        fail("link:" + ip);
        throw new InputError("Este link não é válido. Peça um novo à equipe.", 400);
      }
      if (row.used_at) throw new InputError("Este link já foi usado. Peça um novo.", 410);
      if (row.expires_at < Date.now()) throw new InputError("Este link expirou. Peça um novo.", 410);
      const target = db.query("SELECT * FROM users WHERE id=?").get(row.user_id);
      if (!target?.active) throw new InputError("Esta conta está desativada.", 403);
      // Marca como usado antes de abrir a sessão: dois cliques simultâneos não geram duas sessões.
      const claimed = db
        .query("UPDATE magic_links SET used_at=? WHERE token_hash=? AND used_at=0")
        .run(Date.now(), row.token_hash).changes;
      if (!claimed) throw new InputError("Este link já foi usado. Peça um novo.", 410);
      return startSession(target, req, { remember: body.remember !== false, method: "link" });
    }
    if (path === "/api/auth/link-request" && method === "POST") {
      if (!mailer)
        throw new InputError("O envio por e-mail ainda não está ativo. Peça seu link à equipe.", 503);
      const body = await req.json();
      const login = String(body.login ?? "").trim().toLowerCase().slice(0, 160);
      if (!login) throw new InputError("Informe seu usuário ou e-mail.");
      checkLock("mail:" + login, 4);
      checkLock("mail-ip:" + ip, 12);
      fail("mail:" + login);
      fail("mail-ip:" + ip);
      const target = login.includes("@")
        ? db.query("SELECT * FROM users WHERE email=? AND active=1").get(login)
        : db.query("SELECT * FROM users WHERE username=? AND active=1").get(loginName(normalize, login));
      if (target?.email) {
        const link = issueLink(target, "login", "", origin);
        try {
          await mailer.send({
            to: target.email,
            subject: "Seu link de acesso · Zona 023",
            text: `Olá, ${target.name || target.username}!\n\nPara entrar na área da equipe da 023ª Zona Eleitoral, abra o link abaixo. Ele vale por 15 minutos e só pode ser usado uma vez.\n\n${link.url}\n\nSe você não pediu este acesso, ignore esta mensagem.`,
          });
        } catch (error) {
          console.error("Falha no envio do link:", error.message);
          throw new InputError("Não foi possível enviar o e-mail agora. Peça seu link à equipe.", 502);
        }
      }
      // Mesma resposta com ou sem conta: não revela quem está cadastrado.
      return json({ ok: true });
    }

    const me = user(req);
    if (!me) throw new InputError("Entre com seu usuário para continuar.", 401);
    if (path === "/api/auth/logout" && method === "POST") {
      db.query("DELETE FROM sessions WHERE token_hash=?").run(me.token_hash);
      const response = json({ ok: true });
      response.headers.set("Set-Cookie", cookie("", 0));
      return response;
    }
    if (path === "/api/auth/me" && method === "GET") return json({ user: publicUser(me) });
    if (path === "/api/auth/password" && method === "POST") {
      const body = await req.json();
      const row = db.query("SELECT password_hash,must_change FROM users WHERE id=?").get(me.id);
      if (!linkFresh(me) && !(await Bun.password.verify(String(body.current ?? ""), row.password_hash)))
        throw new InputError("A senha atual não confere.", 400);
      const next = body.next;
      validatePassword(next);
      if (row.must_change && (await Bun.password.verify(next, row.password_hash)))
        throw new InputError("Escolha uma senha diferente da inicial.");
      db.query("UPDATE users SET password_hash=?,must_change=0,initial_expires_at=0 WHERE id=?").run(
        await Bun.password.hash(next),
        me.id,
      );
      // Encerra as outras sessões e tira desta a permissão de trocar sem a senha atual.
      db.query("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").run(me.id, me.token_hash);
      db.query("UPDATE sessions SET method='password' WHERE token_hash=?").run(me.token_hash);
      audit(me.id, "password_change");
      return json({ ok: true });
    }
    if (path === "/api/auth/profile" && method === "PATCH") {
      const body = await req.json();
      const name = body.name === undefined ? me.name : textValue(body.name, "Nome", 80, true);
      const phone = body.phone === undefined ? me.phone : cleanPhone(body.phone);
      const email = body.email === undefined ? me.email : cleanEmail(body.email, me.id);
      db.query("UPDATE users SET name=?,phone=?,email=? WHERE id=?").run(name, phone, email, me.id);
      audit(me.id, "profile_update");
      return json({ user: publicUser({ ...me, name, phone, email }) });
    }
    if (path === "/api/auth/onboarded" && method === "POST") {
      db.query("UPDATE users SET onboarded_at=? WHERE id=? AND onboarded_at=''").run(new Date().toISOString(), me.id);
      return json({ ok: true });
    }
    if (path === "/api/auth/sessions" && method === "GET")
      return json({
        sessions: db
          .query(
            "SELECT token_hash,created_at,expires_at,remember,method,label FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC",
          )
          .all(me.id, Date.now())
          .map(({ token_hash, ...row }) => ({ ...row, current: token_hash === me.token_hash })),
      });
    if (path === "/api/auth/sessions" && method === "DELETE") {
      const count = db
        .query("DELETE FROM sessions WHERE user_id=? AND token_hash<>?")
        .run(me.id, me.token_hash).changes;
      audit(me.id, "sessions_revoke", "", "", String(count));
      return json({ count });
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return {
    handle,
    user,
    guard,
    publicUser,
    createUser,
    issueLink,
    audit,
    cleanPhone,
    cleanEmail,
    hasMail: () => Boolean(mailer),
  };
}
