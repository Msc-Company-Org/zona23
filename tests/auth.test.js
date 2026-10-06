import { test, expect, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";

// Senhas e nomes fictícios: nenhum dado real da equipe entra nos testes.
const INITIAL = "Inicial@teste";
function sandbox(options = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "zona23-auth-test-"));
  const app = createApp({ dataDir, ...options });
  const request = async (path, method = "GET", body, cookie = "") => {
    const response = await app.fetch(
      new Request("https://zona23.test" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    const type = response.headers.get("Content-Type") || "";
    return {
      status: response.status,
      headers: response.headers,
      data: type.includes("json") ? await response.json() : await response.text(),
      cookie: (response.headers.get("Set-Cookie") || "").split(";")[0],
    };
  };
  const login = async (username, password = INITIAL, extra = {}) => {
    const response = await request("/api/auth/login", "POST", { username, password, ...extra });
    expect(response.status).toBe(200);
    return response;
  };
  return {
    app,
    request,
    login,
    close() {
      setSystemTime();
      app.close();
      rmSync(dataDir, { recursive: true });
    },
  };
}
const seed = (s, username, role = "equipe", title = "", initialDays = 7) =>
  s.app.auth.createUser({ username, role, title, password: INITIAL, initialDays });

test("login por senha: primeiro acesso obrigatório, senha inicial não se repete e sessão lembrada", async () => {
  const s = sandbox();
  try {
    seed(s, "Joãozinho", "admin", "Administração do sistema");
    expect((await s.request("/api/auth/login", "POST", { username: "joaozinho", password: "errada-123" })).status).toBe(401);
    // Nome com acento e maiúsculas chega ao mesmo usuário.
    const first = await s.login("JOÃOZINHO", INITIAL, { remember: true });
    expect(first.data.user).toMatchObject({ username: "joaozinho", role: "admin", mustChange: true, onboarded: false });
    expect(first.headers.get("Set-Cookie")).toContain("Max-Age=2592000");
    expect((await s.request("/api/equipe/inicio", "GET", undefined, first.cookie)).status).toBe(403);
    expect((await s.request("/api/auth/password", "POST", { current: INITIAL, next: INITIAL }, first.cookie)).status).toBe(400);
    expect((await s.request("/api/auth/password", "POST", { current: INITIAL, next: "12345678" }, first.cookie)).status).toBe(400);
    expect((await s.request("/api/auth/password", "POST", { current: INITIAL, next: "Nova senha de teste 1" }, first.cookie)).status).toBe(200);
    const home = await s.request("/api/equipe/inicio", "GET", undefined, first.cookie);
    expect(home.status).toBe(200);
    expect(home.data.marcos.map((marco) => marco.kind)).toContain("eleicao");
    expect((await s.request("/api/auth/onboarded", "POST", {}, first.cookie)).status).toBe(200);
    expect((await s.request("/api/auth/me", "GET", undefined, first.cookie)).data.user.onboarded).toBe(true);
    // A senha inicial deixou de valer.
    expect((await s.request("/api/auth/login", "POST", { username: "joaozinho", password: INITIAL })).status).toBe(401);
    const short = await s.login("joaozinho", "Nova senha de teste 1");
    expect(short.headers.get("Set-Cookie")).toContain("Max-Age=43200");
  } finally {
    s.close();
  }
}, 30000);

test("senha inicial expira e bloqueio após tentativas erradas", async () => {
  const s = sandbox();
  try {
    seed(s, "bia", "equipe", "", -1);
    const expired = await s.request("/api/auth/login", "POST", { username: "bia", password: INITIAL });
    expect(expired.status).toBe(401);
    expect(expired.data.error).toContain("expirou");
    seed(s, "pedro");
    for (let attempt = 0; attempt < 8; attempt++)
      expect((await s.request("/api/auth/login", "POST", { username: "pedro", password: "x" + attempt })).status).toBe(401);
    expect((await s.request("/api/auth/login", "POST", { username: "pedro", password: INITIAL })).status).toBe(429);
  } finally {
    s.close();
  }
}, 30000);

test("link de acesso: GET não consome, uso único, expira e permite criar senha sem a atual", async () => {
  const s = sandbox({ publicOrigin: "https://zona23.test" });
  try {
    seed(s, "chefe", "admin");
    const admin = await s.login("chefe");
    await s.request("/api/auth/password", "POST", { current: INITIAL, next: "Senha da chefia 1" }, admin.cookie);
    const created = await s.request(
      "/api/equipe/users",
      "POST",
      { username: "Ana", name: "Ana", title: "Servidora do Cartório", phone: "(21) 99999-0000" },
      admin.cookie,
    );
    expect(created.status).toBe(201);
    expect(created.data.user).toMatchObject({ username: "ana", phone: "21999990000", pending: true });
    const link = await s.request(`/api/equipe/users/${created.data.user.id}/link`, "POST", {}, admin.cookie);
    expect(link.data.url).toStartWith("https://zona23.test/entrar/link#t=");
    const token = link.data.url.split("#t=")[1];
    // Prévia do WhatsApp: o GET da página não usa o token.
    expect((await s.request("/entrar/link")).status).toBe(200);
    expect((await s.request("/api/auth/magic", "POST", { token: "0".repeat(64) })).status).toBe(400);
    const entered = await s.request("/api/auth/magic", "POST", { token });
    expect(entered.status).toBe(200);
    expect(entered.data.user).toMatchObject({ username: "ana", mustChange: true, linkFresh: true });
    expect((await s.request("/api/auth/magic", "POST", { token })).status).toBe(410);
    expect((await s.request("/api/auth/password", "POST", { next: "Senha da Ana 2026" }, entered.cookie)).status).toBe(200);
    // Depois de criar a senha, trocar de novo exige a atual.
    expect((await s.request("/api/auth/password", "POST", { next: "Outra senha 22" }, entered.cookie)).status).toBe(400);
    // Um link novo vence em 72 horas.
    const late = await s.request(`/api/equipe/users/${created.data.user.id}/link`, "POST", {}, admin.cookie);
    setSystemTime(new Date(Date.now() + 73 * 3600000));
    expect((await s.request("/api/auth/magic", "POST", { token: late.data.url.split("#t=")[1] })).status).toBe(410);
  } finally {
    s.close();
  }
}, 30000);

test("perfis: equipe não gerencia contas, autoridade só consulta e conta desativada perde a sessão", async () => {
  const s = sandbox();
  try {
    seed(s, "admin1", "admin");
    seed(s, "servidor");
    seed(s, "juiz", "autoridade", "Juiz Eleitoral");
    const ready = async (username, next) => {
      const session = await s.login(username);
      await s.request("/api/auth/password", "POST", { current: INITIAL, next }, session.cookie);
      return session.cookie;
    };
    const admin = await ready("admin1", "Senha admin teste 1");
    const team = await ready("servidor", "Senha equipe teste 1");
    const judge = await ready("juiz", "Senha juiz teste 1");
    expect((await s.request("/api/equipe/users", "POST", { username: "novo" }, team)).status).toBe(403);
    expect((await s.request("/api/equipe/marcos", "POST", { title: "Reunião", date: "2026-10-21" }, team)).status).toBe(201);
    expect((await s.request("/api/equipe/marcos", "POST", { title: "Reunião", date: "2026-10-21" }, judge)).status).toBe(403);
    expect((await s.request("/api/equipe/inicio", "GET", undefined, judge)).data.user.title).toBe("Juiz Eleitoral");
    expect((await s.request("/api/admin/dashboard", "GET", undefined, judge)).status).toBe(403);
    expect((await s.request("/api/admin/dashboard", "GET", undefined, team)).status).toBe(200);
    const users = (await s.request("/api/equipe/users", "GET", undefined, admin)).data.users;
    const servidor = users.find((user) => user.username === "servidor");
    const self = users.find((user) => user.username === "admin1");
    expect((await s.request(`/api/equipe/users/${self.id}`, "PATCH", { role: "equipe" }, admin)).status).toBe(400);
    expect((await s.request(`/api/equipe/users/${servidor.id}`, "PATCH", { active: false }, admin)).status).toBe(200);
    expect((await s.request("/api/equipe/inicio", "GET", undefined, team)).status).toBe(401);
  } finally {
    s.close();
  }
}, 40000);

test("sair dos outros aparelhos, link por e-mail opcional e endereços antigos do acervo", async () => {
  const sent = [];
  const s = sandbox({ mailer: { send: async (message) => sent.push(message) } });
  try {
    const user = seed(s, "lucas");
    await s.app.auth.createUser({ username: "semmail", password: INITIAL });
    const one = await s.login("lucas");
    await s.request("/api/auth/password", "POST", { current: INITIAL, next: "Senha do Lucas 1" }, one.cookie);
    const two = await s.login("lucas", "Senha do Lucas 1");
    expect((await s.request("/api/auth/profile", "PATCH", { email: "Lucas@Exemplo.test" }, two.cookie)).data.user.email).toBe("lucas@exemplo.test");
    expect((await s.request("/api/auth/sessions", "DELETE", undefined, two.cookie)).data.count).toBe(1);
    expect((await s.request("/api/auth/me", "GET", undefined, one.cookie)).status).toBe(401);
    expect((await s.request("/api/auth/config")).data).toEqual({ ready: true, email: true });
    expect((await s.request("/api/auth/link-request", "POST", { login: "lucas@exemplo.test" })).status).toBe(200);
    expect((await s.request("/api/auth/link-request", "POST", { login: "ninguem" })).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("lucas@exemplo.test");
    expect(sent[0].text).toContain("/entrar/link#t=");
    expect(user.username).toBe("lucas");
    const moved = await s.request("/baixar");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("Location")).toBe("/memorias/baixar");
    expect((await s.request("/?photo=abc")).headers.get("Location")).toBe("/memorias?photo=abc");
    expect((await s.request("/")).headers.get("X-Robots-Tag")).toContain("noindex");
  } finally {
    s.close();
  }
  const noMail = sandbox();
  try {
    expect((await noMail.request("/api/auth/config")).data).toEqual({ ready: false, email: false });
    expect((await noMail.request("/api/auth/link-request", "POST", { login: "x" })).status).toBe(503);
  } finally {
    noMail.close();
  }
}, 40000);
