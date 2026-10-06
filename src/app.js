import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import sharp from "sharp";

const MAX_FILE = 25 * 1024 * 1024;
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");
class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function textValue(value, label, max, required = false) {
  if (typeof value !== "string")
    throw new InputError(`Confira o campo ${label}.`);
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length > max || (required && !clean))
    throw new InputError(
      `${label}: informe ${required ? "de 1 a" : "até"} ${max} caracteres.`,
    );
  return clean;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1800-01-01") return false;
  const parsed = new Date(value + "T12:00:00Z");
  return !isNaN(parsed) && parsed.toISOString().slice(0, 10) === value;
}
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function createApp({
  dataDir = "./local/data",
  publicOrigin = "",
  trustProxy = false,
  maxStorageMB = 10240,
} = {}) {
  if (!Number.isFinite(maxStorageMB) || maxStorageMB < 0)
    throw new Error("MAX_STORAGE_MB deve ser um número válido e não negativo.");
  const allowedOrigin = publicOrigin ? new URL(publicOrigin).origin : "";
  const root = resolve(dataDir),
    media = join(root, "media");
  const publicRoot = resolve(import.meta.dir, "../public");
  mkdirSync(media, { recursive: true });
  const db = new Database(join(root, "acervo.sqlite"), { create: true });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '',
      normalized TEXT NOT NULL, identity TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      date TEXT NOT NULL, filename TEXT NOT NULL, bytes INTEGER NOT NULL,
      author TEXT NOT NULL, edit_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photo_people (
      photo_id TEXT REFERENCES photos(id) ON DELETE CASCADE,
      person_id TEXT REFERENCES people(id), PRIMARY KEY(photo_id, person_id)
    );
    CREATE INDEX IF NOT EXISTS photo_date ON photos(date DESC);
    CREATE INDEX IF NOT EXISTS people_photo ON photo_people(person_id, photo_id);
  `);
  const rate = new Map();
  function rateLimit(ip) {
    const now = Date.now();
    for (const [key, bucket] of rate) if (bucket.until < now) rate.delete(key);
    const bucket = rate.get(ip) || { count: 0, until: now + 3600000 };
    if (bucket.count >= 120 || (rate.size >= 10000 && !rate.has(ip)))
      throw new InputError(
        "Muitos envios em sequência. Tente novamente mais tarde.",
        429,
      );
    bucket.count++;
    rate.set(ip, bucket);
  }
  function photo(id) {
    const result = db
      .query(
        "SELECT id,title,description,date,filename,author,created_at FROM photos WHERE id=?",
      )
      .get(id);
    if (!result) throw new InputError("Foto não encontrada.", 404);
    result.people = db
      .query(
        "SELECT p.id,p.name,p.reference FROM people p JOIN photo_people pp ON p.id=pp.person_id WHERE pp.photo_id=? ORDER BY p.normalized",
      )
      .all(id);
    result.src = `/media/${result.filename}`;
    result.thumbnail = `/media/${id}.thumb.webp`;
    delete result.filename;
    return result;
  }
  function metadata(body) {
    const title = textValue(body.title ?? "", "Título", 160);
    const description = textValue(body.description ?? "", "Descrição", 2000);
    const date = textValue(body.date ?? "", "Data", 10, true);
    if (!validDate(date))
      throw new InputError("Informe uma data válida para a foto.");
    if (
      !Array.isArray(body.people) ||
      body.people.length > 50 ||
      body.people.some((id) => typeof id !== "string")
    )
      throw new InputError("Confira as pessoas selecionadas.");
    const people = [...new Set(body.people)];
    for (const id of people)
      if (!db.query("SELECT id FROM people WHERE id=?").get(id))
        throw new InputError(
          "Uma pessoa selecionada não está cadastrada. Atualize a lista.",
        );
    return { title, description, date, people };
  }
  const json = (body, status = 200) =>
    Response.json(body, {
      status,
      headers: { ...securityHeaders, "Cache-Control": "no-store" },
    });
  async function fetch(req, server) {
    try {
      const url = new URL(req.url),
        path = url.pathname;
      if (!["GET", "HEAD", "POST", "PATCH"].includes(req.method))
        throw new InputError("Método não permitido.", 405);
      if (["POST", "PATCH"].includes(req.method)) {
        const origin = req.headers.get("Origin");
        const expected = allowedOrigin || url.origin;
        if (
          (origin && origin !== expected) ||
          req.headers.get("Sec-Fetch-Site") === "cross-site"
        )
          throw new InputError("Envie a partir da página do acervo.", 403);
        if (Number(req.headers.get("Content-Length") || 0) > MAX_FILE + 65536)
          throw new InputError("A foto deve ter até 25 MB.", 413);
        const ip = trustProxy
          ? req.headers.get("X-Real-IP") ||
            server?.requestIP(req)?.address ||
            "local"
          : server?.requestIP(req)?.address || "local";
        rateLimit(ip);
      }
      if (path === "/api/stats" && req.method === "GET") {
        return json({
          ...db
            .query(
              "SELECT COUNT(*) AS photos, COUNT(DISTINCT date) AS dates, MIN(date) AS firstDate, MAX(date) AS lastDate FROM photos",
            )
            .get(),
          people: db.query("SELECT COUNT(*) AS count FROM people").get().count,
        });
      }
      if (path === "/api/people" && req.method === "GET") {
        const q = normalize(url.searchParams.get("q") || "").slice(0, 160);
        return json({
          people: db
            .query(
              `SELECT p.id,p.name,p.reference,COUNT(pp.photo_id) AS photos FROM people p
          LEFT JOIN photo_people pp ON pp.person_id=p.id WHERE instr(p.normalized,?)>0 GROUP BY p.id ORDER BY p.normalized LIMIT 100`,
            )
            .all(q),
        });
      }
      if (path === "/api/people" && req.method === "POST") {
        const body = await req.json();
        const name = textValue(body.name, "Nome", 120, true),
          reference = textValue(body.reference ?? "", "Identificação", 80);
        const identity = normalize(name) + "|" + normalize(reference);
        const existing = db
          .query("SELECT id,name,reference FROM people WHERE identity=?")
          .get(identity);
        if (existing) return json({ person: existing, reused: true });
        const id = crypto.randomUUID();
        db.query("INSERT INTO people VALUES (?,?,?,?,?,?)").run(
          id,
          name,
          reference,
          normalize(name),
          identity,
          new Date().toISOString(),
        );
        return json({ person: { id, name, reference }, reused: false }, 201);
      }
      if (path === "/api/photos" && req.method === "GET") {
        const q = normalize(url.searchParams.get("name") || "").slice(0, 120);
        const from = url.searchParams.get("from") || "",
          to = url.searchParams.get("to") || "",
          person = url.searchParams.get("person") || "";
        if (
          (from && !validDate(from)) ||
          (to && !validDate(to)) ||
          (from && to && from > to)
        )
          throw new InputError(
            "Confira o período: a data inicial deve vir antes da final.",
          );
        const where = `WHERE (?='' OR f.date>=?) AND (?='' OR f.date<=?)
          AND (?='' OR EXISTS(SELECT 1 FROM photo_people pp JOIN people p ON p.id=pp.person_id WHERE pp.photo_id=f.id AND instr(p.normalized,?)>0))
          AND (?='' OR EXISTS(SELECT 1 FROM photo_people pp WHERE pp.photo_id=f.id AND pp.person_id=?))`;
        const args = [from, from, to, to, q, q, person, person];
        const offset = Math.max(
          0,
          Math.min(
            1000000,
            parseInt(url.searchParams.get("offset") || "0") || 0,
          ),
        );
        const order =
          url.searchParams.get("order") === "oldest" ? "ASC" : "DESC";
        const ids = db
          .query(
            `SELECT f.id FROM photos f ${where} ORDER BY f.date ${order},f.created_at ${order},f.id LIMIT 48 OFFSET ?`,
          )
          .all(...args, offset);
        const total = db
          .query(`SELECT COUNT(*) AS count FROM photos f ${where}`)
          .get(...args).count;
        return json({
          photos: ids.map((row) => photo(row.id)),
          total,
          nextOffset: offset + ids.length < total ? offset + ids.length : null,
        });
      }
      const detail = path.match(/^\/api\/photos\/([a-f0-9-]{36})$/);
      if (detail && req.method === "GET")
        return json({ photo: photo(detail[1]) });
      if (detail && req.method === "PATCH") {
        const record = db
          .query("SELECT edit_hash FROM photos WHERE id=?")
          .get(detail[1]);
        if (!record) throw new InputError("Foto não encontrada.", 404);
        const key = req.headers.get("X-Edit-Key") || "";
        if (
          !key ||
          !timingSafeEqual(
            Buffer.from(hash(key)),
            Buffer.from(record.edit_hash),
          )
        )
          throw new InputError(
            "A edição fica disponível no aparelho que enviou esta foto.",
            403,
          );
        const value = metadata(await req.json());
        db.transaction(() => {
          db.query(
            "UPDATE photos SET title=?,description=?,date=? WHERE id=?",
          ).run(value.title, value.description, value.date, detail[1]);
          db.query("DELETE FROM photo_people WHERE photo_id=?").run(detail[1]);
          for (const id of value.people)
            db.query("INSERT INTO photo_people VALUES (?,?)").run(
              detail[1],
              id,
            );
        })();
        return json({ photo: photo(detail[1]) });
      }
      if (path === "/api/photos" && req.method === "POST") {
        const form = await req.formData(),
          file = form.get("photo");
        if (!(file instanceof File) || !file.size)
          throw new InputError("Selecione uma foto.");
        if (file.size > MAX_FILE)
          throw new InputError("A foto deve ter até 25 MB.", 413);
        if (form.get("public") !== "true")
          throw new InputError(
            "Confirme que deseja publicar a foto e os nomes no acervo.",
          );
        const values = metadata(JSON.parse(form.get("metadata") || "{}"));
        const author = textValue(form.get("author") || "", "Seu nome", 120);
        let original, thumbnail, format;
        try {
          const input = Buffer.from(await file.arrayBuffer());
          const info = await sharp(input, {
            limitInputPixels: 40000000,
            animated: false,
          }).metadata();
          if (
            !["jpeg", "png", "webp"].includes(info.format) ||
            (info.pages || 1) > 1
          )
            throw new Error("format");
          format = info.format === "jpeg" ? "jpg" : info.format;
          original = await sharp(input, { limitInputPixels: 40000000 })
            .rotate()
            .toBuffer();
          thumbnail = await sharp(original)
            .resize(640, 640, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        } catch {
          throw new InputError(
            "Não foi possível ler a imagem. Use uma foto JPG, PNG ou WebP de até 40 megapixels.",
          );
        }
        const id = crypto.randomUUID(),
          key = randomBytes(32).toString("hex"),
          filename = `${id}.${format}`;
        const paths = [join(media, filename), join(media, `${id}.thumb.webp`)];
        try {
          await Bun.write(paths[0], original);
          await Bun.write(paths[1], thumbnail);
          db.transaction(() => {
            const used = db
              .query("SELECT COALESCE(SUM(bytes),0) AS total FROM photos")
              .get().total;
            if (
              used + original.length + thumbnail.length >
              maxStorageMB * 1024 * 1024
            )
              throw new InputError(
                "O acervo atingiu o limite de armazenamento. Avise a organização.",
                507,
              );
            db.query("INSERT INTO photos VALUES (?,?,?,?,?,?,?,?,?)").run(
              id,
              values.title,
              values.description,
              values.date,
              filename,
              original.length + thumbnail.length,
              author,
              hash(key),
              new Date().toISOString(),
            );
            for (const personId of values.people)
              db.query("INSERT INTO photo_people VALUES (?,?)").run(
                id,
                personId,
              );
          })();
        } catch (error) {
          await Promise.allSettled(paths.map((path) => unlink(path)));
          throw error;
        }
        return json({ photo: photo(id), editKey: key }, 201);
      }
      if (path.startsWith("/api/"))
        throw new InputError("Recurso não encontrado.", 404);
      if (!["GET", "HEAD"].includes(req.method))
        throw new InputError("Método não permitido.", 405);
      let target;
      if (/^\/media\/[a-f0-9-]{36}(\.thumb)?\.(jpg|png|webp)$/.test(path))
        target = join(media, path.slice(7));
      else if (path === "/") target = join(publicRoot, "index.html");
      else if (
        ["/app.js", "/style.css"].includes(path) ||
        /^\/assets\/[a-z0-9-]+\.(svg|woff2)$/.test(path)
      )
        target = join(publicRoot, path.slice(1));
      else throw new InputError("Página não encontrada.", 404);
      const asset = Bun.file(target);
      if (!(await asset.exists()))
        throw new InputError("Arquivo não encontrado.", 404);
      return new Response(req.method === "HEAD" ? null : asset, {
        headers: {
          ...securityHeaders,
          "Content-Type": asset.type,
          "Cache-Control": path.startsWith("/media/")
            ? "public,max-age=31536000,immutable"
            : "no-cache",
        },
      });
    } catch (error) {
      if (error instanceof InputError)
        return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError || error instanceof TypeError)
        return json({ error: "Confira os dados enviados." }, 400);
      console.error("Falha no acervo:", error.message);
      return json(
        { error: "Não foi possível concluir. Tente novamente." },
        500,
      );
    }
  }
  return { fetch, close: () => db.close() };
}
