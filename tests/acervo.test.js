import { test, expect } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { createApp } from "../src/app.js";

const base = resolve(import.meta.dir, "../local/tests");
mkdirSync(base, { recursive: true });
const fixture = await sharp({
  create: { width: 80, height: 60, channels: 3, background: "#1b305a" },
})
  .jpeg()
  .toBuffer();
function sandbox(options = {}) {
  const dataDir = join(base, crypto.randomUUID());
  const app = createApp({ dataDir, ...options });
  const request = async (path, method = "GET", body, headers = {}) => {
    const req = new Request("http://localhost" + path, {
      method,
      headers:
        body instanceof FormData
          ? headers
          : { "Content-Type": "application/json", ...headers },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    const response = await app.fetch(req);
    return { status: response.status, data: await response.json() };
  };
  return {
    app,
    request,
    dataDir,
    cleanup() {
      app.close();
      if (resolve(dataDir).startsWith(base + "/"))
        rmSync(dataDir, { recursive: true });
      else if (resolve(dataDir).startsWith(base + "\\"))
        rmSync(dataDir, { recursive: true });
    },
  };
}
function upload(date, people = [], bytes = fixture) {
  const form = new FormData();
  form.set("photo", new File([bytes], "foto.jpg", { type: "image/jpeg" }));
  form.set(
    "metadata",
    JSON.stringify({
      date,
      people,
      title: "Encontro da equipe",
      description: "",
    }),
  );
  form.set("public", "true");
  form.set("author", "Colaborador de teste");
  return form;
}

test("pessoas são persistidas, reutilizadas sem acentos e distinguem homônimos", async () => {
  const s = sandbox();
  try {
    const first = await s.request("/api/people", "POST", {
      name: "  José  da Silva  ",
    });
    expect(first.status).toBe(201);
    const repeated = await s.request("/api/people", "POST", {
      name: "jose da silva",
    });
    expect(repeated.status).toBe(200);
    expect(repeated.data.person.id).toBe(first.data.person.id);
    const homonym = await s.request("/api/people", "POST", {
      name: "José da Silva",
      reference: "Equipe B",
    });
    expect(homonym.data.person.id).not.toBe(first.data.person.id);
    expect((await s.request("/api/people?q=JOSE")).data.people).toHaveLength(2);
    s.app.close();
    const reopened = createApp({ dataDir: s.dataDir });
    expect(
      (
        await (
          await reopened.fetch(
            new Request("http://localhost/api/people?q=jose"),
          )
        ).json()
      ).people,
    ).toHaveLength(2);
    reopened.close();
  } finally {
    s.cleanup();
  }
});

test("busca combina pessoa e datas; foto aceita várias pessoas e guarda os arquivos", async () => {
  const s = sandbox();
  try {
    const ana = (await s.request("/api/people", "POST", { name: "Ana Lúcia" }))
      .data.person.id;
    const bia = (await s.request("/api/people", "POST", { name: "Beatriz" }))
      .data.person.id;
    const old = await s.request(
      "/api/photos",
      "POST",
      upload("2023-05-03", [ana, bia]),
    );
    expect(old.status).toBe(201);
    expect(old.data.photo.people).toHaveLength(2);
    const recent = await s.request(
      "/api/photos",
      "POST",
      upload("2026-10-04", [ana]),
    );
    expect(recent.status).toBe(201);
    expect(
      (
        await s.request(
          "/api/photos?name=ana%20lucia&from=2026-01-01&to=2026-12-31",
        )
      ).data.photos.map((p) => p.id),
    ).toEqual([recent.data.photo.id]);
    expect(
      (await s.request("/api/photos?name=beatriz&from=2026-01-01")).data.total,
    ).toBe(0);
    expect(
      (await s.request("/api/photos?person=" + bia)).data.photos[0].id,
    ).toBe(old.data.photo.id);
    expect(
      (await s.request("/api/photos?order=oldest")).data.photos[0].id,
    ).toBe(old.data.photo.id);
    expect(
      (await s.request("/api/photos?name=%27%20OR%201%3D1--")).data.total,
    ).toBe(0);
    expect((await s.request("/api/stats")).data).toMatchObject({
      photos: 2,
      people: 2,
      dates: 2,
    });
    const media = await s.app.fetch(
      new Request("http://localhost" + recent.data.photo.src),
    );
    expect(media.status).toBe(200);
    expect(media.headers.get("Content-Type")).toContain("image/jpeg");
    const image = await sharp(
      Buffer.from(await media.arrayBuffer()),
    ).metadata();
    expect(image.width).toBe(80);
    expect(image.exif).toBeUndefined();
    expect(
      (
        await s.app.fetch(
          new Request("http://localhost" + recent.data.photo.thumbnail),
        )
      ).status,
    ).toBe(200);
    expect(JSON.stringify((await s.request("/api/photos")).data)).not.toContain(
      "editKey",
    );
  } finally {
    s.cleanup();
  }
});

test("só a chave do envio permite corrigir a foto e o cadastro de pessoas é preservado", async () => {
  const s = sandbox();
  try {
    const person = (
      await s.request("/api/people", "POST", { name: "Pessoa de teste" })
    ).data.person;
    const published = await s.request(
      "/api/photos",
      "POST",
      upload("2026-10-04", [person.id]),
    );
    const path = "/api/photos/" + published.data.photo.id;
    expect(
      (await s.request(path, "PATCH", { date: "2026-10-05", people: [] }))
        .status,
    ).toBe(403);
    const corrected = await s.request(
      path,
      "PATCH",
      { date: "2026-10-05", title: "Correção", people: [] },
      { "X-Edit-Key": published.data.editKey },
    );
    expect(corrected.status).toBe(200);
    expect(corrected.data.photo.date).toBe("2026-10-05");
    expect(corrected.data.photo.people).toHaveLength(0);
    expect((await s.request("/api/people")).data.people).toHaveLength(1);
  } finally {
    s.cleanup();
  }
});

test("dados inválidos, arquivo inseguro e envio entre sites são rejeitados sem criar fotos", async () => {
  const s = sandbox();
  try {
    expect(
      (await s.request("/api/photos", "POST", upload("2026-02-30"))).status,
    ).toBe(400);
    expect(
      (
        await s.request(
          "/api/photos",
          "POST",
          upload("2026-10-04", ["inexistente"]),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await s.request(
          "/api/photos",
          "POST",
          upload(
            "2026-10-04",
            [],
            new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
          ),
        )
      ).status,
    ).toBe(400);
    const noConfirmation = upload("2026-10-04");
    noConfirmation.delete("public");
    expect(
      (await s.request("/api/photos", "POST", noConfirmation)).status,
    ).toBe(400);
    expect(
      (
        await s.request(
          "/api/people",
          "POST",
          { name: "teste" },
          { Origin: "https://outro-site.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await s.request("/api/photos?from=2026-12-01&to=2026-01-01")).status,
    ).toBe(400);
    expect((await s.request("/api/stats")).data.photos).toBe(0);
    expect(
      (await s.app.fetch(new Request("http://localhost/src/app.js"))).status,
    ).toBe(404);
  } finally {
    s.cleanup();
  }
});

test("limite de armazenamento reverte o cadastro e os arquivos de um envio que falha", async () => {
  const s = sandbox({ maxStorageMB: 0 });
  try {
    expect(
      (await s.request("/api/photos", "POST", upload("2026-10-04"))).status,
    ).toBe(507);
    expect((await s.request("/api/stats")).data.photos).toBe(0);
    expect(
      Array.from(new Bun.Glob("*").scanSync(join(s.dataDir, "media"))),
    ).toHaveLength(0);
  } finally {
    s.cleanup();
  }
});

test("paginação não repete nem omite fotos do mesmo dia", async () => {
  const s = sandbox();
  try {
    for (let index = 0; index < 49; index++)
      expect(
        (await s.request("/api/photos", "POST", upload("2026-10-04"))).status,
      ).toBe(201);
    const first = (await s.request("/api/photos")).data;
    expect(first.photos).toHaveLength(48);
    expect(first.nextOffset).toBe(48);
    const second = (await s.request("/api/photos?offset=48")).data;
    expect(second.photos).toHaveLength(1);
    expect(second.nextOffset).toBeNull();
    expect(
      new Set([...first.photos, ...second.photos].map((photo) => photo.id))
        .size,
    ).toBe(49);
  } finally {
    s.cleanup();
  }
});

test("foto sem data é aceita, fica no fim da linha do tempo e fora do filtro por período", async () => {
  const s = sandbox();
  try {
    const undated = await s.request("/api/photos", "POST", upload(""));
    expect(undated.status).toBe(201);
    expect(undated.data.photo.date).toBe("");
    const dated = await s.request("/api/photos", "POST", upload("2024-06-01"));
    for (const order of ["newest", "oldest"])
      expect(
        (await s.request("/api/photos?order=" + order)).data.photos.map((p) => p.id),
      ).toEqual([dated.data.photo.id, undated.data.photo.id]);
    expect((await s.request("/api/photos?from=1900-01-01")).data.total).toBe(1);
    expect((await s.request("/api/photos?to=2030-01-01")).data.total).toBe(1);
    expect((await s.request("/api/stats")).data).toMatchObject({ photos: 2, dates: 1 });
    const fixed = await s.request(
      "/api/photos/" + undated.data.photo.id,
      "PATCH",
      { date: "2022-10-02", people: [] },
      { "X-Edit-Key": undated.data.editKey },
    );
    expect(fixed.data.photo.date).toBe("2022-10-02");
    const cleared = await s.request(
      "/api/photos/" + undated.data.photo.id,
      "PATCH",
      { date: "", people: [] },
      { "X-Edit-Key": undated.data.editKey },
    );
    expect(cleared.data.photo.date).toBe("");
  } finally {
    s.cleanup();
  }
});

test("versão de tela é servida e recriada se faltar; páginas saem comprimidas com cache", async () => {
  const s = sandbox();
  try {
    const sent = (await s.request("/api/photos", "POST", upload("2024-06-01"))).data.photo;
    rmSync(join(s.dataDir, "media", sent.id + ".view.webp"));
    const view = await s.app.fetch(new Request("http://localhost" + sent.view));
    expect(view.status).toBe(200);
    expect((await sharp(Buffer.from(await view.arrayBuffer())).metadata()).format).toBe("webp");
    const home = await s.app.fetch(
      new Request("http://localhost/", { headers: { "Accept-Encoding": "gzip, br" } }),
    );
    expect(home.headers.get("Content-Encoding")).toBe("br");
    const html = await (await s.app.fetch(new Request("http://localhost/"))).text();
    const script = html.match(/\/app\.js\?v=[a-f0-9]+/)[0];
    const asset = await s.app.fetch(new Request("http://localhost" + script));
    expect(asset.headers.get("Cache-Control")).toContain("immutable");
    const again = await s.app.fetch(
      new Request("http://localhost" + script, {
        headers: { "If-None-Match": asset.headers.get("ETag") },
      }),
    );
    expect(again.status).toBe(304);
  } finally {
    s.cleanup();
  }
});
