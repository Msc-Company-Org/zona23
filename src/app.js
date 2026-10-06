import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { unlink, rename, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";
import sharp from "sharp";
import { createAdmin, SETTINGS, today } from "./admin.js";
import { createAuth, migrateAuth } from "./auth.js";
import { createEquipe, migrateEquipe } from "./equipe.js";
import { createEleicao, migrateEleicao } from "./eleicao.js";
import { createDocumentos, migrateDocumentos, MAX_DOCUMENTO } from "./documentos.js";

const MAX_FILE = 25 * 1024 * 1024;
const VIEW_SIZE = 1600;
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
  adminBootstrapPassword = "",
  mailer = null,
  androidApp = null,
  totalizacao = false,
  fetchJson = null,
} = {}) {
  if (!Number.isFinite(maxStorageMB) || maxStorageMB < 0)
    throw new Error("MAX_STORAGE_MB deve ser um número válido e não negativo.");
  if (adminBootstrapPassword && (typeof adminBootstrapPassword !== "string" || adminBootstrapPassword.length < 12))
    throw new Error("A senha inicial da equipe precisa ter pelo menos 12 caracteres.");
  // PUBLIC_ORIGIN aceita mais de um endereço separado por vírgula (ex.: domínio novo + antigo).
  const allowedOrigins = publicOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);
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
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS hits (
      day TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(day, kind, ref)
    );
  `);
  // Migração sem perda: colunas novas em bancos já publicados.
  const columns = db.query("PRAGMA table_info(photos)").all().map((row) => row.name);
  if (!columns.includes("hidden"))
    db.exec("ALTER TABLE photos ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  if (!columns.includes("event_id"))
    db.exec(
      "ALTER TABLE photos ADD COLUMN event_id TEXT REFERENCES events(id) ON DELETE SET NULL",
    );
  db.exec("CREATE INDEX IF NOT EXISTS photo_event ON photos(event_id)");
  migrateAuth(db);
  migrateEquipe(db);
  migrateEleicao(db);
  migrateDocumentos(db);
  const countHit = db.query(
    "INSERT INTO hits VALUES (?,?,?,1) ON CONFLICT(day,kind,ref) DO UPDATE SET count=count+1",
  );
  const hit = (kind, ref = "") => countHit.run(today(), kind, ref);
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
  const hitRate = new Map();
  function hitLimit(ip) {
    const now = Date.now();
    if (hitRate.size > 10000) hitRate.clear();
    const bucket = hitRate.get(ip) || { count: 0, until: now + 3600000 };
    if (bucket.until < now) Object.assign(bucket, { count: 0, until: now + 3600000 });
    if (++bucket.count > 3000) throw new InputError("Muitos acessos.", 429);
    hitRate.set(ip, bucket);
  }
  // Fotos e pessoas numa consulta só: a galeria não faz uma ida ao banco por card.
  const PHOTO_COLUMNS = `f.id,f.title,f.description,f.date,f.filename,f.author,f.created_at,f.event_id,
    (SELECT name FROM events WHERE id=f.event_id) AS event_name,
    (SELECT json_group_array(json_object('id',id,'name',name,'reference',reference)) FROM
      (SELECT p.id,p.name,p.reference FROM people p JOIN photo_people pp ON p.id=pp.person_id
       WHERE pp.photo_id=f.id ORDER BY p.normalized)) AS people`;
  const YEAR = "CASE WHEN f.date='' THEN '' ELSE substr(f.date,1,4) END";
  const UUID = /^[a-f0-9-]{36}$/;
  function filters(url, admin = false) {
    const get = (key) => url.searchParams.get(key) || "";
    const q = normalize(get("name")).slice(0, 120);
    const from = get("from"),
      to = get("to"),
      person = get("person"),
      year = get("year"),
      event = get("event");
    const ids = get("ids") ? get("ids").split(",") : [];
    if (
      (from && !validDate(from)) ||
      (to && !validDate(to)) ||
      (from && to && from > to)
    )
      throw new InputError(
        "Confira o período: a data inicial deve vir antes da final.",
      );
    if (year && !/^(\d{4}|sem-data)$/.test(year))
      throw new InputError("Confira o ano.");
    if (event && !UUID.test(event)) throw new InputError("Confira o evento.");
    if (ids.length > 1000 || ids.some((id) => !UUID.test(id)))
      throw new InputError("Confira as fotos escolhidas.");
    const yearValue = year === "sem-data" ? "" : year;
    const where = `WHERE (?='' OR (f.date<>'' AND f.date>=?)) AND (?='' OR (f.date<>'' AND f.date<=?))
          AND (?='' OR EXISTS(SELECT 1 FROM photo_people pp JOIN people p ON p.id=pp.person_id WHERE pp.photo_id=f.id AND instr(p.normalized,?)>0))
          AND (?='' OR EXISTS(SELECT 1 FROM photo_people pp WHERE pp.photo_id=f.id AND pp.person_id=?))
          AND (?=0 OR ${YEAR}=?)
          AND (?='[]' OR f.id IN (SELECT value FROM json_each(?)))
          AND (?='' OR f.event_id=?) AND (?=1 OR f.hidden=0)`;
    const list = JSON.stringify(ids);
    return {
      where,
      args: [
        from, from, to, to, q, q, person, person, year ? 1 : 0, yearValue, list, list,
        event, event, admin ? 1 : 0,
      ],
    };
  }
  function shape(row) {
    row.people = JSON.parse(row.people || "[]");
    row.event = row.event_id ? { id: row.event_id, name: row.event_name } : null;
    delete row.event_id;
    delete row.event_name;
    row.src = `/media/${row.filename}`;
    row.view = `/media/${row.id}.view.webp`;
    row.thumbnail = `/media/${row.id}.thumb.webp`;
    delete row.filename;
    return row;
  }
  function photo(id) {
    const result = db
      .query(`SELECT ${PHOTO_COLUMNS} FROM photos f WHERE f.id=? AND f.hidden=0`)
      .get(id);
    if (!result) throw new InputError("Foto não encontrada.", 404);
    return shape(result);
  }
  function metadata(body) {
    const title = textValue(body.title ?? "", "Título", 160);
    const description = textValue(body.description ?? "", "Descrição", 2000);
    // Data é opcional: foto sem data entra no fim da linha do tempo.
    const date = textValue(body.date ?? "", "Data", 10);
    if (date && !validDate(date))
      throw new InputError("Confira a data da foto ou deixe em branco.");
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
  // HTML, JS e CSS ficam em memória, comprimidos e com hash na URL (cache longo).
  const texts = {};
  function load(file, type) {
    const body = Buffer.from(readFileSync(join(publicRoot, file)));
    return {
      type,
      body,
      gzip: gzipSync(body, { level: 9 }),
      br: brotliCompressSync(body),
      etag: `"${hash(body).slice(0, 16)}"`,
    };
  }
  for (const [file, type] of [
    ["app.js", "text/javascript;charset=utf-8"],
    ["style.css", "text/css;charset=utf-8"],
  ]) {
    const entry = load(file, type);
    entry.version = entry.etag.slice(1, 11);
    entry.immutable = true;
    texts["/" + file] = entry;
  }
  for (const [file, type] of [
    ["admin.js", "text/javascript;charset=utf-8"],
    ["admin.css", "text/css;charset=utf-8"],
    ["equipe.js", "text/javascript;charset=utf-8"],
    ["equipe.css", "text/css;charset=utf-8"],
    ["aplicativo.js", "text/javascript;charset=utf-8"],
  ]) {
    const entry = load(file, type);
    entry.version = entry.etag.slice(1, 11);
    entry.immutable = true;
    texts["/" + file] = entry;
  }
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  function page(file, values = {}, title = "", pathname = "/") {
    let html = readFileSync(join(publicRoot, file), "utf8");
    for (const asset of ["app.js", "style.css", "admin.js", "admin.css", "equipe.js", "equipe.css", "aplicativo.js"])
      html = html.replace(`/${asset}"`, `/${asset}?v=${texts["/" + asset].version}"`);
    if (html.includes("<!--sprite-->"))
      html = html.replace(
        "<!--sprite-->",
        readFileSync(join(publicRoot, "index.html"), "utf8").match(
          /<svg class="sprite"[\s\S]*?<\/svg>/,
        )[0],
      );
    // Trechos marcados com <!--s:chave-->…<!--/s--> vêm dos textos editáveis da equipe.
    html = html.replace(/<!--s:(\w+)-->[\s\S]*?<!--\/s-->/g, (match, key) =>
      key in values ? escapeHtml(values[key]) : match,
    );
    html = html.replace(
      "<!--settings-json-->",
      `<script type="application/json" id="site-settings">${JSON.stringify(values).replace(/</g, "\\u003c")}</script>`,
    );
    html = html.replace("<!--canonical-->", `<link rel="canonical" href="https://zon023.com.br${pathname}" /><meta property="og:url" content="https://zon023.com.br${pathname}" />`);
    if (title) html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${escapeHtml(title)}`);
    const body = Buffer.from(html);
    return {
      type: "text/html;charset=utf-8",
      body,
      gzip: gzipSync(body, { level: 9 }),
      br: brotliCompressSync(body),
      etag: `"${hash(body).slice(0, 16)}"`,
    };
  }
  function text(req, entry) {
    const accept = req.headers.get("Accept-Encoding") || "";
    const encoding = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : "";
    const headers = {
      ...securityHeaders,
      "Content-Type": entry.type,
      ETag: entry.etag,
      Vary: "Accept-Encoding",
      "Cache-Control": entry.immutable
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    };
    if (req.headers.get("If-None-Match") === entry.etag)
      return new Response(null, { status: 304, headers });
    if (encoding) headers["Content-Encoding"] = encoding;
    const body = encoding ? entry[encoding] : entry.body;
    return new Response(req.method === "HEAD" ? null : body, { headers });
  }
  // Um só documento atende a área da equipe; o script decide entre login, link e painel.
  const teamPage = page("admin.html");
  for (const route of ["/", "/equipe", "/admin", "/entrar", "/entrar/link"]) texts[route] = teamPage;
  const dummyHash = Bun.password.hashSync(randomBytes(16).toString("hex"));
  const auth = createAuth({
    db,
    json,
    InputError,
    textValue,
    normalize,
    hash,
    dummyHash,
    mailer,
    origin: allowedOrigins[0] || "",
    bootstrapPassword: adminBootstrapPassword,
    secureCookie: allowedOrigins.some((origin) => origin.startsWith("https:")),
  });
  const admin = createAdmin({
    db,
    json,
    InputError,
    textValue,
    validDate,
    normalize,
    media,
    auth,
    onSettings: renderHome,
  });
  const equipe = createEquipe({
    db,
    json,
    InputError,
    textValue,
    validDate,
    auth,
    today,
    origin: allowedOrigins[0] || "",
  });
  const eleicao = createEleicao({ db, json, InputError, textValue, auth, totalizacao, fetchJson });
  const documentos = createDocumentos({ db, json, InputError, textValue, auth, root, securityHeaders });
  function renderHome() {
    const settings = admin.settings();
    // O acervo de fotos mora em /memorias; a raiz é a entrada da equipe.
    texts["/memorias"] = page("index.html", settings, "", "/memorias");
    texts["/memorias/baixar"] = page("index.html", settings, "Baixar fotos · 023ª Zona Eleitoral", "/memorias/baixar");
    texts["/app"] = page("aplicativo.html", settings, "Aplicativo · 023ª Zona Eleitoral", "/app");
  }
  renderHome();
  {
    const body = Buffer.from(
      JSON.stringify({
        name: "Zona 023 · Equipe da 023ª Zona Eleitoral",
        short_name: "Zona 023",
        description: "Área da equipe do cartório da 023ª Zona Eleitoral e Memórias da Zona 023.",
        lang: "pt-BR",
        id: "/",
        start_url: "/",
        display: "standalone",
        background_color: "#f4f7fc",
        theme_color: "#1b305a",
        icons: [
          { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/assets/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "Área da equipe", short_name: "Equipe", url: "/", icons: [{ src: "/assets/icon-192.png", sizes: "192x192" }] },
          { name: "Memórias da Zona 023", short_name: "Memórias", url: "/memorias", icons: [{ src: "/assets/icon-192.png", sizes: "192x192" }] },
        ],
      }),
    );
    texts["/manifest.webmanifest"] = {
      type: "application/manifest+json",
      body,
      gzip: gzipSync(body),
      br: brotliCompressSync(body),
      etag: `"${hash(body).slice(0, 16)}"`,
    };
  }
  // Ícones PNG para instalar na tela inicial, gerados do SVG da marca (sem depender de fontes).
  const icons = {};
  const iconSvg = readFileSync(join(publicRoot, "assets/icon.svg"));
  const iconsReady = Promise.all(
    [
      ["/assets/favicon-32.png", 32, 0],
      ["/assets/icon-180.png", 180, 0],
      ["/assets/icon-192.png", 192, 0],
      ["/assets/icon-512.png", 512, 0],
      ["/assets/icon-maskable.png", 512, 0.12],
    ].map(async ([route, size, pad]) => {
      const inner = Math.round((size * (1 - pad * 2)) / 2) * 2;
      let image = sharp(iconSvg, { density: 400 }).resize(inner, inner);
      if (pad)
        image = sharp(await image.png().toBuffer()).extend({
          top: (size - inner) / 2,
          bottom: (size - inner) / 2,
          left: (size - inner) / 2,
          right: (size - inner) / 2,
          background: "#1b305a",
        });
      icons[route] = await image.png().toBuffer();
    }),
  ).catch((error) => console.error("Ícones:", error.message));

  // Download em ZIP sem compressão (fotos já são comprimidas): um arquivo por vez na memória.
  let activeDownloads = 0;
  const slug = (value) =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  function download(url) {
    const { where, args } = filters(url);
    const rows = db
      .query(
        `SELECT ${PHOTO_COLUMNS} FROM photos f ${where} ORDER BY f.date='',f.date,f.created_at,f.id LIMIT 1001`,
      )
      .all(...args)
      .map((row) => {
        const file = join(media, row.filename);
        return { ...shape(row), file };
      });
    if (!rows.length) throw new InputError("Nenhuma foto para baixar.", 404);
    if (rows.length > 1000)
      throw new InputError("Escolha até 1000 fotos por download.", 413);
    if (activeDownloads >= 3)
      throw new InputError("Muitos downloads ao mesmo tempo. Tente em instantes.", 429);
    activeDownloads++;
    const now = new Date();
    const dosTime =
      (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate =
      ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const central = [];
    let offset = 0,
      index = 0,
      done = false;
    const csv = [
      "arquivo,data,titulo,descricao,pessoas,enviada_por",
      ...rows.map((row) => {
        row.zipName = `${row.date || "sem-data"}_${slug(row.title) || "zon23"}_${row.id.slice(0, 8)}.${row.src.split(".").pop()}`;
        return [
          row.zipName,
          row.date,
          row.title,
          row.description,
          row.people
            .map((person) => person.name + (person.reference ? ` (${person.reference})` : ""))
            .join("; "),
          row.author,
        ]
          .map(csvCell)
          .join(",");
      }),
    ].join("\r\n");
    const entries = [
      ...rows.map((row) => ({ name: row.zipName, load: () => readFile(row.file) })),
      { name: "fotos.csv", load: async () => Buffer.from("\ufeff" + csv) },
    ];
    function entry(name, data) {
      const nameBytes = Buffer.from(name);
      const crc = Bun.hash.crc32(data) >>> 0;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(0, 8);
      local.writeUInt16LE(dosTime, 10);
      local.writeUInt16LE(dosDate, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50, 0);
      record.writeUInt16LE(20, 4);
      record.writeUInt16LE(20, 6);
      record.writeUInt16LE(0x0800, 8);
      record.writeUInt16LE(dosTime, 12);
      record.writeUInt16LE(dosDate, 14);
      record.writeUInt32LE(crc, 16);
      record.writeUInt32LE(data.length, 20);
      record.writeUInt32LE(data.length, 24);
      record.writeUInt16LE(nameBytes.length, 28);
      record.writeUInt32LE(offset, 42);
      central.push(Buffer.concat([record, nameBytes]));
      offset += 30 + nameBytes.length + data.length;
      return [local, nameBytes, data];
    }
    const finish = () => {
      if (!done) activeDownloads--;
      done = true;
    };
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          if (index < entries.length) {
            const item = entries[index++];
            for (const part of entry(item.name, await item.load()))
              controller.enqueue(part);
            return;
          }
          const directory = Buffer.concat(central);
          const end = Buffer.alloc(22);
          end.writeUInt32LE(0x06054b50, 0);
          end.writeUInt16LE(central.length, 8);
          end.writeUInt16LE(central.length, 10);
          end.writeUInt32LE(directory.length, 12);
          end.writeUInt32LE(offset, 16);
          controller.enqueue(directory);
          controller.enqueue(end);
          controller.close();
          finish();
        } catch (error) {
          finish();
          console.error("Falha no download:", error.message);
          controller.error(error);
        }
      },
      cancel: finish,
    });
    const label = slug(url.searchParams.get("label") || "") || "fotos";
    return new Response(stream, {
      headers: {
        ...securityHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="zon23-${label}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Versão de tela (1600 px) gerada sob demanda: o visualizador não baixa o original de até 25 MB.
  const pendingViews = new Map();
  async function ensureView(id) {
    const target = join(media, `${id}.view.webp`);
    if (await Bun.file(target).exists()) return;
    if (!pendingViews.has(id))
      pendingViews.set(
        id,
        (async () => {
          const row = db.query("SELECT filename FROM photos WHERE id=?").get(id);
          if (!row) return;
          const output = await sharp(join(media, row.filename), {
            limitInputPixels: 40000000,
          })
            .resize(VIEW_SIZE, VIEW_SIZE, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          await Bun.write(target + ".tmp", output);
          await rename(target + ".tmp", target);
        })().finally(() => pendingViews.delete(id)),
      );
    await pendingViews.get(id);
  }
  // APK publicado fora do Git: DATA_DIR/downloads/apk.json descreve o arquivo atual.
  const downloads = join(root, "downloads");
  let apkCache = { at: 0, value: null };
  async function apkInfo() {
    if (Date.now() - apkCache.at < 30000) return apkCache.value;
    let value = null;
    try {
      const info = JSON.parse(await readFile(join(downloads, "apk.json"), "utf8"));
      if (
        /^zona023-[0-9][0-9.]*\.apk$/.test(info.file) &&
        /^[a-f0-9]{64}$/.test(info.sha256) &&
        (await Bun.file(join(downloads, info.file)).exists())
      )
        value = {
          version: String(info.version).slice(0, 20),
          file: info.file,
          url: `/downloads/${info.file}`,
          bytes: Bun.file(join(downloads, info.file)).size,
          sha256: info.sha256,
          updatedAt: String(info.updatedAt || "").slice(0, 10),
        };
    } catch {}
    apkCache = { at: Date.now(), value };
    return value;
  }
  async function fetch(req, server) {
    try {
      const url = new URL(req.url),
        path = url.pathname;
      if (!["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(req.method))
        throw new InputError("Método não permitido.", 405);
      const ip = trustProxy
        ? req.headers.get("X-Real-IP") || server?.requestIP(req)?.address || "local"
        : server?.requestIP(req)?.address || "local";
      if (["POST", "PATCH", "DELETE"].includes(req.method)) {
        const origin = req.headers.get("Origin");
        const expected = allowedOrigins.length ? allowedOrigins : [url.origin];
        if (
          (origin && !expected.includes(origin)) ||
          req.headers.get("Sec-Fetch-Site") === "cross-site"
        )
          throw new InputError("Envie a partir da página do acervo.", 403);
        const documento = path === "/api/documentos";
        if (Number(req.headers.get("Content-Length") || 0) > (documento ? MAX_DOCUMENTO : MAX_FILE) + 65536)
          throw new InputError(documento ? "O arquivo deve ter até 40 MB." : "A foto deve ter até 25 MB.", 413);
        // Equipe logada e contagem de acesso não gastam a cota de envios públicos.
        if (path === "/api/hit") hitLimit(ip);
        else if (!auth.user(req)) rateLimit(ip);
      }
      if (path.startsWith("/api/auth/")) return await auth.handle(req, url, path, ip);
      if (path.startsWith("/api/equipe/")) return await equipe.handle(req, url, path);
      if (path.startsWith("/api/eleicao/")) return await eleicao.handle(req, url, path);
      if (path === "/api/documentos" || path.startsWith("/api/documentos/")) return await documentos.handle(req, url, path);
      if (path.startsWith("/api/admin/")) return await admin.handle(req, url, path, ip);
      if (path === "/api/app" && req.method === "GET") return json({ apk: await apkInfo() });
      if (path === "/api/hit" && req.method === "POST") {
        const body = await req.json();
        if (body.kind === "page" && ["/memorias", "/memorias/baixar", "/app"].includes(body.ref)) hit("page", body.ref);
        else if (
          body.kind === "photo" &&
          UUID.test(body.ref) &&
          db.query("SELECT 1 FROM photos WHERE id=? AND hidden=0").get(body.ref)
        )
          hit("photo", body.ref);
        return new Response(null, { status: 204, headers: securityHeaders });
      }
      if (path === "/api/settings" && req.method === "GET")
        return json({ settings: admin.settings() });
      if (path === "/api/events" && req.method === "GET")
        return json({
          events: db
            .query(
              `SELECT e.id,e.name,e.date,COUNT(f.id) AS photos FROM events e JOIN photos f ON f.event_id=e.id AND f.hidden=0
               GROUP BY e.id ORDER BY e.date='' , e.date DESC, e.name`,
            )
            .all(),
        });
      if (path === "/api/stats" && req.method === "GET") {
        return json({
          ...db
            .query(
              "SELECT COUNT(*) AS photos, COUNT(DISTINCT NULLIF(date,'')) AS dates, MIN(NULLIF(date,'')) AS firstDate, MAX(NULLIF(date,'')) AS lastDate FROM photos WHERE hidden=0",
            )
            .get(),
          people: db.query("SELECT COUNT(*) AS count FROM people").get().count,
          bytes: db.query("SELECT COALESCE(SUM(bytes),0) AS b FROM photos WHERE hidden=0").get().b,
          years: db
            .query(
              `SELECT ${YEAR} AS year, COUNT(*) AS count, SUM(bytes) AS bytes FROM photos f WHERE f.hidden=0 GROUP BY year ORDER BY year='' , year DESC`,
            )
            .all(),
        });
      }
      if (path === "/api/people" && req.method === "GET") {
        const q = normalize(url.searchParams.get("q") || "").slice(0, 160);
        return json({
          people: db
            .query(
              `SELECT p.id,p.name,p.reference,COUNT(f.id) AS photos FROM people p
          LEFT JOIN photo_people pp ON pp.person_id=p.id LEFT JOIN photos f ON f.id=pp.photo_id AND f.hidden=0
          WHERE instr(p.normalized,?)>0 GROUP BY p.id ORDER BY p.normalized LIMIT 100`,
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
      if (path === "/api/download.zip" && req.method === "GET") {
        const response = download(url);
        if (req.method === "GET") hit("zip", url.searchParams.get("label") || "");
        return response;
      }
      if (path === "/api/photos" && req.method === "GET") {
        const { where, args } = filters(url);
        const offset = Math.max(
          0,
          Math.min(
            1000000,
            parseInt(url.searchParams.get("offset") || "0") || 0,
          ),
        );
        const order =
          url.searchParams.get("order") === "oldest" ? "ASC" : "DESC";
        const rows = db
          .query(
            `SELECT ${PHOTO_COLUMNS} FROM photos f ${where} ORDER BY f.date='',f.date ${order},f.created_at ${order},f.id LIMIT 48 OFFSET ?`,
          )
          .all(...args, offset);
        const total = db
          .query(`SELECT COUNT(*) AS count FROM photos f ${where}`)
          .get(...args).count;
        const years =
          offset === 0
            ? db
                .query(
                  `SELECT ${YEAR} AS year, COUNT(*) AS count FROM photos f ${where} GROUP BY year`,
                )
                .all(...args)
            : undefined;
        return json({
          years,
          photos: rows.map(shape),
          total,
          nextOffset: offset + rows.length < total ? offset + rows.length : null,
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
        let original, thumbnail, view, format;
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
          view = await sharp(original)
            .resize(VIEW_SIZE, VIEW_SIZE, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          throw new InputError(
            "Não foi possível ler a imagem. Use uma foto JPG, PNG ou WebP de até 40 megapixels.",
          );
        }
        const id = crypto.randomUUID(),
          key = randomBytes(32).toString("hex"),
          filename = `${id}.${format}`;
        const paths = [
          join(media, filename),
          join(media, `${id}.thumb.webp`),
          join(media, `${id}.view.webp`),
        ];
        const bytes = original.length + thumbnail.length + view.length;
        try {
          await Bun.write(paths[0], original);
          await Bun.write(paths[1], thumbnail);
          await Bun.write(paths[2], view);
          db.transaction(() => {
            const used = db
              .query("SELECT COALESCE(SUM(bytes),0) AS total FROM photos")
              .get().total;
            if (used + bytes > maxStorageMB * 1024 * 1024)
              throw new InputError(
                "O acervo atingiu o limite de armazenamento. Avise a organização.",
                507,
              );
            db.query(
              "INSERT INTO photos (id,title,description,date,filename,bytes,author,edit_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            ).run(
              id,
              values.title,
              values.description,
              values.date,
              filename,
              bytes,
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
      // Endereços antigos do acervo, já compartilhados, continuam funcionando.
      const moved =
        path === "/baixar"
          ? "/memorias/baixar"
          : path === "/" && url.searchParams.has("photo")
            ? "/memorias" + url.search
            : "";
      if (moved)
        return new Response(null, { status: 301, headers: { ...securityHeaders, Location: moved } });
      if (texts[path]) {
        // Páginas internas não entram em buscadores.
        const response = text(req, texts[path]);
        if (texts[path] === teamPage) response.headers.set("X-Robots-Tag", "noindex, nofollow");
        return response;
      }
      if (path === "/.well-known/assetlinks.json" && androidApp?.fingerprints?.length)
        return Response.json(
          [
            {
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: androidApp.package,
                sha256_cert_fingerprints: androidApp.fingerprints,
              },
            },
          ],
          { headers: { ...securityHeaders, "Cache-Control": "public,max-age=3600" } },
        );
      const apkPath = path.match(/^\/downloads\/(zona023-[0-9][0-9.]*\.apk)$/);
      if (apkPath) {
        const info = await apkInfo();
        if (!info || info.file !== apkPath[1]) throw new InputError("Arquivo não encontrado.", 404);
        if (req.method === "GET") hit("apk", info.version);
        return new Response(req.method === "HEAD" ? null : Bun.file(join(downloads, info.file)), {
          headers: {
            ...securityHeaders,
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": `attachment; filename="${info.file}"`,
            "Content-Length": String(info.bytes),
            "Cache-Control": "public,max-age=3600",
          },
        });
      }
      if (icons[path])
        return new Response(req.method === "HEAD" ? null : icons[path], {
          headers: {
            ...securityHeaders,
            "Content-Type": "image/png",
            "Cache-Control": "public,max-age=2592000",
          },
        });
      const view = path.match(/^\/media\/([a-f0-9-]{36})\.view\.webp$/);
      if (view) await ensureView(view[1]);
      let target;
      if (/^\/media\/[a-f0-9-]{36}(\.thumb|\.view)?\.(jpg|png|webp)$/.test(path))
        target = join(media, path.slice(7));
      else if (/^\/assets\/[a-z0-9-]+\.(svg|woff2|jpg)$/.test(path))
        target = join(publicRoot, path.slice(1));
      else throw new InputError("Página não encontrada.", 404);
      const asset = Bun.file(target);
      if (!(await asset.exists()))
        throw new InputError("Arquivo não encontrado.", 404);
      const original = path.match(/^\/media\/([a-f0-9-]{36})\.(jpg|png|webp)$/);
      if (original && req.method === "GET" && !req.headers.get("Range")) hit("download", original[1]);
      return new Response(req.method === "HEAD" ? null : asset, {
        headers: {
          ...securityHeaders,
          "Content-Type": asset.type,
          "Cache-Control": path.startsWith("/media/")
            ? "public,max-age=31536000,immutable"
            : "public,max-age=2592000",
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
  return {
    fetch,
    close: () => {
      eleicao.stop();
      db.close();
    },
    ready: iconsReady,
    auth,
    documentos,
    eleicao,
  };
}
