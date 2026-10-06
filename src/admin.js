import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

// Área da equipe: sessão por cookie HttpOnly, senha com Argon2 (Bun.password).
const SESSION_HOURS = 12;
const COOKIE = "z23_session";
export const SETTINGS = {
  hero_kicker: { label: "Linha acima do título", max: 60, value: "Zona 023 · Marechal Hermes" },
  hero_title: { label: "Título principal", max: 60, value: "A Zona 23" },
  hero_highlight: { label: "Destaque amarelo do título", max: 40, value: "tem rosto." },
  hero_lede: {
    label: "Texto de apresentação",
    max: 240,
    value:
      "Ache você e a equipe nas fotos da TRE Marechal Hermes. Tem foto parada no celular? Manda pra cá.",
  },
  zone_names: {
    label: "Variações do nome (separadas por vírgula)",
    max: 200,
    value: "Zona 23, Zon23, Zona 023, TRE Marechal Hermes, 23ª ZE",
  },
  footer_text: {
    label: "Texto do rodapé",
    max: 120,
    value: "Feito pela turma da 23ª ZE, Marechal Hermes.",
  },
};
// Dia no fuso de Brasília (sem horário de verão desde 2019).
export const today = (offsetDays = 0) =>
  new Date(Date.now() - 3 * 3600000 - offsetDays * 86400000).toISOString().slice(0, 10);

export function createAdmin(ctx) {
  const { db, json, InputError, textValue, validDate, normalize, hash, media, secureCookie } =
    ctx;

  if (!db.query("SELECT 1 FROM users LIMIT 1").get()) {
    // Usuário inicial pedido pelo titular; a troca de senha é exigida no primeiro acesso.
    db.query("INSERT INTO users VALUES (?,?,?,1,?)").run(
      crypto.randomUUID(),
      "admin",
      Bun.password.hashSync("admin"),
      new Date().toISOString(),
    );
  }

  const failures = new Map();
  function checkLock(key) {
    const now = Date.now();
    const entry = failures.get(key);
    if (entry && entry.until > now && entry.count >= 8)
      throw new InputError("Muitas tentativas. Espere 15 minutos.", 429);
    if (entry && entry.until <= now) failures.delete(key);
  }
  function fail(key) {
    const entry = failures.get(key) || { count: 0, until: Date.now() + 15 * 60000 };
    entry.count++;
    failures.set(key, entry);
  }

  function cookieValue(req) {
    const match = (req.headers.get("Cookie") || "").match(
      new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`),
    );
    return match?.[1] || "";
  }
  function user(req) {
    const token = cookieValue(req);
    if (!token) return null;
    const row = db
      .query(
        "SELECT u.id,u.username,u.must_change,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",
      )
      .get(hash(token));
    if (!row || row.expires_at < Date.now()) return null;
    return row;
  }
  const cookie = (value, maxAge) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;

  const PHOTO_ADMIN = `f.id,f.title,f.description,f.date,f.author,f.created_at,f.hidden,f.bytes,f.event_id,
    (SELECT name FROM events WHERE id=f.event_id) AS event_name,
    (SELECT COALESCE(SUM(count),0) FROM hits WHERE kind='photo' AND ref=f.id) AS views,
    (SELECT json_group_array(json_object('id',id,'name',name,'reference',reference)) FROM
      (SELECT p.id,p.name,p.reference FROM people p JOIN photo_people pp ON p.id=pp.person_id
       WHERE pp.photo_id=f.id ORDER BY p.normalized)) AS people`;
  const shapeAdmin = (row) => ({
    ...row,
    hidden: Boolean(row.hidden),
    people: JSON.parse(row.people || "[]"),
    thumbnail: `/media/${row.id}.thumb.webp`,
    view: `/media/${row.id}.view.webp`,
  });
  const adminPhoto = (id) => {
    const row = db.query(`SELECT ${PHOTO_ADMIN} FROM photos f WHERE f.id=?`).get(id);
    if (!row) throw new InputError("Foto não encontrada.", 404);
    return shapeAdmin(row);
  };
  function eventId(value) {
    if (value === undefined) return undefined;
    if (value === "" || value === null) return null;
    if (typeof value !== "string" || !db.query("SELECT 1 FROM events WHERE id=?").get(value))
      throw new InputError("Evento não encontrado. Atualize a página.");
    return value;
  }
  async function removePhoto(id) {
    const row = db.query("SELECT filename FROM photos WHERE id=?").get(id);
    if (!row) return false;
    db.query("DELETE FROM photos WHERE id=?").run(id);
    db.query("DELETE FROM hits WHERE kind IN ('photo','download') AND ref=?").run(id);
    await Promise.allSettled(
      [row.filename, `${id}.thumb.webp`, `${id}.view.webp`].map((file) =>
        unlink(join(media, file)),
      ),
    );
    return true;
  }
  function settings() {
    const saved = Object.fromEntries(
      db.query("SELECT key,value FROM settings").all().map((row) => [row.key, row.value]),
    );
    return Object.fromEntries(
      Object.entries(SETTINGS).map(([key, item]) => [key, saved[key] ?? item.value]),
    );
  }

  async function handle(req, url, path) {
    const method = req.method;
    if (path === "/api/admin/login" && method === "POST") {
      const body = await req.json();
      const username = textValue(body.username ?? "", "Usuário", 60, true).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      checkLock("user:" + username);
      const row = db.query("SELECT * FROM users WHERE username=?").get(username);
      const ok = row
        ? await Bun.password.verify(password, row.password_hash)
        : (await Bun.password.verify(password, ctx.dummyHash), false);
      if (!ok) {
        fail("user:" + username);
        throw new InputError("Usuário ou senha não conferem.", 401);
      }
      failures.delete("user:" + username);
      const token = randomBytes(32).toString("hex");
      db.query("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
      db.query("INSERT INTO sessions VALUES (?,?,?)").run(
        hash(token),
        row.id,
        Date.now() + SESSION_HOURS * 3600000,
      );
      const response = json({
        user: { username: row.username, mustChange: Boolean(row.must_change) },
      });
      response.headers.set("Set-Cookie", cookie(token, SESSION_HOURS * 3600));
      return response;
    }
    const me = user(req);
    if (!me) throw new InputError("Entre com seu usuário para continuar.", 401);
    if (path === "/api/admin/logout" && method === "POST") {
      db.query("DELETE FROM sessions WHERE token_hash=?").run(hash(cookieValue(req)));
      const response = json({ ok: true });
      response.headers.set("Set-Cookie", cookie("", 0));
      return response;
    }
    if (path === "/api/admin/me" && method === "GET")
      return json({ user: { username: me.username, mustChange: Boolean(me.must_change) } });
    if (path === "/api/admin/password" && method === "POST") {
      const body = await req.json();
      const row = db.query("SELECT password_hash FROM users WHERE id=?").get(me.id);
      if (!(await Bun.password.verify(String(body.current ?? ""), row.password_hash)))
        throw new InputError("A senha atual não confere.", 400);
      const next = String(body.next ?? "");
      if (next.length < 8 || next.length > 200)
        throw new InputError("A nova senha precisa ter pelo menos 8 caracteres.");
      if (["admin", "admin123", "12345678", "password", "senha123"].includes(next.toLowerCase()))
        throw new InputError("Essa senha é fácil demais. Escolha outra.");
      db.query("UPDATE users SET password_hash=?,must_change=0 WHERE id=?").run(
        await Bun.password.hash(next),
        me.id,
      );
      // Encerra as outras sessões deste usuário.
      db.query("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").run(
        me.id,
        hash(cookieValue(req)),
      );
      return json({ ok: true });
    }
    if (me.must_change)
      throw new InputError("Troque a senha inicial antes de continuar.", 403);

    // ---------- Painel ----------
    if (path === "/api/admin/dashboard" && method === "GET") {
      const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get("days")) || 30));
      const from = today(days - 1);
      const hits = db
        .query(
          "SELECT day,kind,SUM(count) AS count FROM hits WHERE day>=? GROUP BY day,kind",
        )
        .all(from);
      const uploads = db
        .query(
          "SELECT substr(datetime(created_at,'-3 hours'),1,10) AS day, COUNT(*) AS count FROM photos WHERE substr(datetime(created_at,'-3 hours'),1,10)>=? GROUP BY day",
        )
        .all(from);
      const series = Array.from({ length: days }, (_, index) => {
        const day = today(days - 1 - index);
        const pick = (kind) =>
          hits
            .filter((row) => row.day === day && kind.includes(row.kind))
            .reduce((sum, row) => sum + row.count, 0);
        return {
          day,
          pages: pick(["page"]),
          photos: pick(["photo"]),
          downloads: pick(["zip", "download"]),
          uploads: uploads.find((row) => row.day === day)?.count || 0,
        };
      });
      const sum = (key) => series.reduce((total, item) => total + item[key], 0);
      return json({
        totals: {
          ...db
            .query(
              `SELECT COUNT(*) AS photos, SUM(hidden) AS hidden, SUM(date='') AS undated,
                SUM(NOT EXISTS(SELECT 1 FROM photo_people pp WHERE pp.photo_id=photos.id)) AS untagged,
                SUM(event_id IS NULL) AS noEvent, COALESCE(SUM(bytes),0) AS bytes FROM photos`,
            )
            .get(),
          people: db.query("SELECT COUNT(*) AS c FROM people").get().c,
          events: db.query("SELECT COUNT(*) AS c FROM events").get().c,
          pages: sum("pages"),
          photoViews: sum("photos"),
          downloads: sum("downloads"),
          uploads: sum("uploads"),
        },
        series,
        topPhotos: db
          .query(
            `SELECT f.id,f.title,f.date,SUM(h.count) AS views FROM hits h JOIN photos f ON f.id=h.ref
             WHERE h.kind='photo' AND h.day>=? GROUP BY f.id ORDER BY views DESC LIMIT 6`,
          )
          .all(from)
          .map((row) => ({ ...row, thumbnail: `/media/${row.id}.thumb.webp` })),
        topPeople: db
          .query(
            `SELECT p.id,p.name,p.reference,COUNT(pp.photo_id) AS photos FROM people p
             JOIN photo_people pp ON pp.person_id=p.id GROUP BY p.id ORDER BY photos DESC, p.normalized LIMIT 6`,
          )
          .all(),
        recent: db
          .query(
            `SELECT id,title,date,author,created_at FROM photos ORDER BY created_at DESC LIMIT 6`,
          )
          .all()
          .map((row) => ({ ...row, thumbnail: `/media/${row.id}.thumb.webp` })),
      });
    }

    // ---------- Fotos ----------
    if (path === "/api/admin/photos" && method === "GET") {
      const get = (key) => url.searchParams.get(key) || "";
      const q = normalize(get("q")).slice(0, 120);
      const status = get("status");
      const missing = get("missing");
      const event = get("event");
      const where = `WHERE (?='' OR instr(lower(f.title),?)>0 OR instr(lower(f.author),?)>0
          OR EXISTS(SELECT 1 FROM photo_people pp JOIN people p ON p.id=pp.person_id WHERE pp.photo_id=f.id AND instr(p.normalized,?)>0))
        AND (?<>'visible' OR f.hidden=0) AND (?<>'hidden' OR f.hidden=1)
        AND (?<>'date' OR f.date='')
        AND (?<>'people' OR NOT EXISTS(SELECT 1 FROM photo_people pp WHERE pp.photo_id=f.id))
        AND (?<>'event' OR f.event_id IS NULL)
        AND (?='' OR f.event_id=?)`;
      const args = [q, q, q, q, status, status, missing, missing, missing, event, event];
      const offset = Math.max(0, parseInt(get("offset")) || 0);
      const rows = db
        .query(
          `SELECT ${PHOTO_ADMIN} FROM photos f ${where} ORDER BY f.created_at DESC, f.id LIMIT 60 OFFSET ?`,
        )
        .all(...args, offset);
      const total = db.query(`SELECT COUNT(*) AS c FROM photos f ${where}`).get(...args).c;
      return json({
        photos: rows.map(shapeAdmin),
        total,
        nextOffset: offset + rows.length < total ? offset + rows.length : null,
      });
    }
    const photoMatch = path.match(/^\/api\/admin\/photos\/([a-f0-9-]{36})$/);
    if (photoMatch && method === "PATCH") {
      const id = photoMatch[1];
      const current = adminPhoto(id);
      const body = await req.json();
      const title = textValue(body.title ?? current.title, "Título", 160);
      const description = textValue(body.description ?? current.description, "Descrição", 2000);
      const date = textValue(body.date ?? current.date, "Data", 10);
      if (date && !validDate(date)) throw new InputError("Confira a data da foto.");
      const author = textValue(body.author ?? current.author, "Enviada por", 120);
      const event = eventId(body.event_id);
      let people;
      if (body.people !== undefined) {
        if (!Array.isArray(body.people) || body.people.length > 80)
          throw new InputError("Confira as pessoas.");
        people = [...new Set(body.people)];
        for (const person of people)
          if (typeof person !== "string" || !db.query("SELECT 1 FROM people WHERE id=?").get(person))
            throw new InputError("Uma pessoa não está cadastrada. Atualize a lista.");
      }
      db.transaction(() => {
        db.query(
          "UPDATE photos SET title=?,description=?,date=?,author=?,hidden=?,event_id=? WHERE id=?",
        ).run(
          title,
          description,
          date,
          author,
          body.hidden === undefined ? Number(current.hidden) : body.hidden ? 1 : 0,
          event === undefined ? current.event_id : event,
          id,
        );
        if (people) {
          db.query("DELETE FROM photo_people WHERE photo_id=?").run(id);
          for (const person of people)
            db.query("INSERT INTO photo_people VALUES (?,?)").run(id, person);
        }
      })();
      return json({ photo: adminPhoto(id) });
    }
    if (photoMatch && method === "DELETE") {
      if (!(await removePhoto(photoMatch[1]))) throw new InputError("Foto não encontrada.", 404);
      return json({ ok: true });
    }
    if (path === "/api/admin/photos/bulk" && method === "POST") {
      const body = await req.json();
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : [];
      if (!ids.length || ids.length > 500 || ids.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
        throw new InputError("Escolha de 1 a 500 fotos.");
      const action = body.action;
      if (action === "delete") {
        let count = 0;
        for (const id of ids) if (await removePhoto(id)) count++;
        return json({ count });
      }
      const run = (sql, value) =>
        db.transaction(() => {
          let count = 0;
          for (const id of ids) count += db.query(sql).run(value, id).changes;
          return count;
        })();
      if (action === "hide" || action === "show")
        return json({ count: run("UPDATE photos SET hidden=? WHERE id=?", action === "hide" ? 1 : 0) });
      if (action === "event")
        return json({ count: run("UPDATE photos SET event_id=? WHERE id=?", eventId(body.value ?? "")) });
      if (action === "date") {
        const date = String(body.value ?? "");
        if (date && !validDate(date)) throw new InputError("Confira a data.");
        return json({ count: run("UPDATE photos SET date=? WHERE id=?", date) });
      }
      if (action === "person") {
        const person = String(body.value ?? "");
        if (!db.query("SELECT 1 FROM people WHERE id=?").get(person))
          throw new InputError("Pessoa não encontrada.");
        return json({
          count: db.transaction(() => {
            let count = 0;
            for (const id of ids)
              count += db
                .query("INSERT OR IGNORE INTO photo_people SELECT ?,? WHERE EXISTS(SELECT 1 FROM photos WHERE id=?)")
                .run(id, person, id).changes;
            return count;
          })(),
        });
      }
      throw new InputError("Ação desconhecida.");
    }

    // ---------- Eventos ----------
    if (path === "/api/admin/events" && method === "GET")
      return json({
        events: db
          .query(
            `SELECT e.*, (SELECT COUNT(*) FROM photos WHERE event_id=e.id) AS photos,
              (SELECT id FROM photos WHERE event_id=e.id ORDER BY created_at DESC LIMIT 1) AS cover
             FROM events e ORDER BY e.date='' , e.date DESC, e.name`,
          )
          .all()
          .map((row) => ({ ...row, cover: row.cover ? `/media/${row.cover}.thumb.webp` : "" })),
      });
    const eventMatch = path.match(/^\/api\/admin\/events\/([a-f0-9-]{36})$/);
    if ((path === "/api/admin/events" && method === "POST") || (eventMatch && method === "PATCH")) {
      const body = await req.json();
      const name = textValue(body.name ?? "", "Nome do evento", 100, true);
      const date = textValue(body.date ?? "", "Data", 10);
      if (date && !validDate(date)) throw new InputError("Confira a data do evento.");
      const description = textValue(body.description ?? "", "Descrição", 500);
      if (eventMatch) {
        const changed = db
          .query("UPDATE events SET name=?,date=?,description=? WHERE id=?")
          .run(name, date, description, eventMatch[1]).changes;
        if (!changed) throw new InputError("Evento não encontrado.", 404);
        return json({ event: db.query("SELECT * FROM events WHERE id=?").get(eventMatch[1]) });
      }
      const id = crypto.randomUUID();
      db.query("INSERT INTO events VALUES (?,?,?,?,?)").run(
        id,
        name,
        date,
        description,
        new Date().toISOString(),
      );
      return json({ event: db.query("SELECT * FROM events WHERE id=?").get(id) }, 201);
    }
    if (eventMatch && method === "DELETE") {
      db.transaction(() => {
        db.query("UPDATE photos SET event_id=NULL WHERE event_id=?").run(eventMatch[1]);
        db.query("DELETE FROM events WHERE id=?").run(eventMatch[1]);
      })();
      return json({ ok: true });
    }

    // ---------- Pessoas ----------
    if (path === "/api/admin/people" && method === "GET") {
      const q = normalize(url.searchParams.get("q") || "").slice(0, 120);
      return json({
        people: db
          .query(
            `SELECT p.id,p.name,p.reference,p.created_at,COUNT(pp.photo_id) AS photos FROM people p
             LEFT JOIN photo_people pp ON pp.person_id=p.id WHERE instr(p.normalized,?)>0
             GROUP BY p.id ORDER BY p.normalized LIMIT 500`,
          )
          .all(q),
      });
    }
    const personMatch = path.match(/^\/api\/admin\/people\/([a-f0-9-]{36})$/);
    if (personMatch && method === "PATCH") {
      const body = await req.json();
      const name = textValue(body.name ?? "", "Nome", 120, true);
      const reference = textValue(body.reference ?? "", "Identificação", 80);
      const identity = normalize(name) + "|" + normalize(reference);
      const clash = db
        .query("SELECT id FROM people WHERE identity=? AND id<>?")
        .get(identity, personMatch[1]);
      if (clash)
        throw new InputError("Já existe alguém com esse nome e identificação. Use “Juntar”.", 409);
      const changed = db
        .query("UPDATE people SET name=?,reference=?,normalized=?,identity=? WHERE id=?")
        .run(name, reference, normalize(name), identity, personMatch[1]).changes;
      if (!changed) throw new InputError("Pessoa não encontrada.", 404);
      return json({ ok: true });
    }
    if (personMatch && method === "DELETE") {
      db.transaction(() => {
        db.query("DELETE FROM photo_people WHERE person_id=?").run(personMatch[1]);
        db.query("DELETE FROM people WHERE id=?").run(personMatch[1]);
      })();
      return json({ ok: true });
    }
    if (path === "/api/admin/people/merge" && method === "POST") {
      const body = await req.json();
      const from = String(body.from ?? ""),
        to = String(body.to ?? "");
      if (from === to) throw new InputError("Escolha duas pessoas diferentes.");
      for (const id of [from, to])
        if (!db.query("SELECT 1 FROM people WHERE id=?").get(id))
          throw new InputError("Pessoa não encontrada.", 404);
      db.transaction(() => {
        db.query(
          "INSERT OR IGNORE INTO photo_people SELECT photo_id,? FROM photo_people WHERE person_id=?",
        ).run(to, from);
        db.query("DELETE FROM photo_people WHERE person_id=?").run(from);
        db.query("DELETE FROM people WHERE id=?").run(from);
      })();
      return json({ ok: true });
    }

    // ---------- Textos e nomenclatura ----------
    if (path === "/api/admin/settings" && method === "GET")
      return json({
        settings: settings(),
        fields: Object.fromEntries(
          Object.entries(SETTINGS).map(([key, item]) => [
            key,
            { label: item.label, max: item.max, default: item.value },
          ]),
        ),
      });
    if (path === "/api/admin/settings" && method === "PATCH") {
      const body = await req.json();
      db.transaction(() => {
        for (const [key, item] of Object.entries(SETTINGS)) {
          if (body[key] === undefined) continue;
          const value = textValue(body[key], item.label, item.max, true);
          db.query("INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
        }
      })();
      ctx.onSettings?.();
      return json({ settings: settings() });
    }
    throw new InputError("Recurso não encontrado.", 404);
  }

  return { handle, user, settings };
}
