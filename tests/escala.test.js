import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { lerEscala, nomeProprio } from "../src/escala.js";

const SENHA = "Inicial@teste";
function sandbox() {
  const dataDir = mkdtempSync(join(tmpdir(), "zona23-escala-test-"));
  const app = createApp({ dataDir });
  const request = async (path, method = "GET", body, cookie = "") => {
    const response = await app.fetch(
      new Request("https://zona23.test" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: response.status, data: await response.json() };
  };
  const pessoa = async (username, role, extra = {}) => {
    const user = app.auth.createUser({ username, role, password: SENHA, ...extra });
    const login = await app.fetch(new Request("https://zona23.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: SENHA }) }));
    const cookie = (login.headers.get("Set-Cookie") || "").split(";")[0];
    await request("/api/auth/password", "POST", { current: SENHA, next: `Senha de ${username} 2026` }, cookie);
    return { cookie, id: user.id };
  };
  return { app, request, pessoa, close() { app.close(); rmSync(dataDir, { recursive: true }); } };
}

// Mesmo formato do grupo do WhatsApp, com nomes fictícios.
const TEXTO = `*🗓️ESCALA ATUALIZADA – AUXILIAR DE SERVIÇOS ELEITORAIS🗓️*

*SEGUNDA, 05/10/2026*

▫️ JOÃOZINHO DA SILVA

▫️ ANA PAULA DE SOUZA

TERÇA, 06/10/2026

▫️ JOÃOZINHO DA SILVA

▫️ JOÃOZINHO DA SILVA

DOMINGO, 25/10/2026

*▫️ TODOS*
`;

test("leitura do texto da escala do WhatsApp", () => {
  const { dias, avisos } = lerEscala(TEXTO);
  expect(dias.map((d) => d.data)).toEqual(["2026-10-05", "2026-10-06", "2026-10-25"]);
  expect(dias[0].nomes).toEqual(["JOÃOZINHO DA SILVA", "ANA PAULA DE SOUZA"]);
  expect(dias[2].todos).toBe(true);
  expect(avisos.length).toBe(1);
  expect(nomeProprio("ANA PAULA DE SOUZA")).toBe("Ana Paula de Souza");
});

test("escala: importação, limite de 10, presença, trocas e a escala de quem é ASE", async () => {
  const s = sandbox();
  try {
    const chefe = await s.pessoa("chefia", "chefe");
    const equipe = await s.pessoa("lucas", "equipe");
    const ase = await s.pessoa("ana", "ase", { name: "Ana Paula de Souza" });
    const juiz = await s.pessoa("juiz1", "juiz");

    expect((await s.request("/api/escala", "GET", undefined, juiz.cookie)).status).toBe(403);
    expect((await s.request("/api/escala", "GET", undefined, ase.cookie)).status).toBe(403);

    // Prévia não grava; aplicar grava.
    const previa = await s.request("/api/escala/importar", "POST", { texto: TEXTO }, equipe.cookie);
    expect(previa.data).toMatchObject({ dias: 3, incluidas: 3, aplicado: false });
    expect((await s.request("/api/escala", "GET", undefined, equipe.cookie)).data.dias).toEqual([]);
    const aplicado = await s.request("/api/escala/importar", "POST", { texto: TEXTO, aplicar: true }, equipe.cookie);
    expect(aplicado.data.pessoasNovas).toEqual(["Joãozinho da Silva", "Ana Paula de Souza"]);

    let painel = (await s.request("/api/escala", "GET", undefined, equipe.cookie)).data;
    expect(painel.dias.length).toBe(3);
    const joao = painel.pessoas.find((p) => p.nome === "Joãozinho da Silva");
    // 2 dias escalados + o domingo de eleição (todos).
    expect(joao.total).toBe(3);

    // Reimportar o mesmo texto não duplica.
    const de_novo = await s.request("/api/escala/importar", "POST", { texto: TEXTO, aplicar: true }, equipe.cookie);
    expect(de_novo.data).toMatchObject({ incluidas: 0, retiradas: 0 });

    // Incluir até o limite: 7 dias novos levam a 10; o 11º é bloqueado.
    for (let dia = 7; dia <= 13; dia++) {
      const r = await s.request(`/api/escala/dias/2026-10-${String(dia).padStart(2, "0")}/pessoas`, "POST", { pessoaId: joao.id }, equipe.cookie);
      expect(r.status).toBe(201);
    }
    const bloqueado = await s.request("/api/escala/dias/2026-10-14/pessoas", "POST", { pessoaId: joao.id }, equipe.cookie);
    expect(bloqueado.status).toBe(400);
    expect(bloqueado.data.error).toContain("limite é 10");
    painel = (await s.request("/api/escala", "GET", undefined, equipe.cookie)).data;
    expect(painel.pessoas.find((p) => p.id === joao.id).situacao).toBe("alerta");

    // Presença e horário do dia.
    const registro = painel.dias.find((d) => d.data === "2026-10-05").pessoas[0];
    expect((await s.request(`/api/escala/registros/${registro.id}`, "PATCH", { presenca: "presente", horario: "08h às 12h" }, equipe.cookie)).status).toBe(200);
    expect((await s.request(`/api/escala/dias/2026-10-05`, "PATCH", { atividade: "Preparação de urnas", horario: "08h" }, equipe.cookie)).status).toBe(200);

    // ASE vê a própria escala (ligada pelo nome) e pede troca; a chefia aprova.
    const minha = await s.request("/api/escala/minha", "GET", undefined, ase.cookie);
    expect(minha.data.pessoa.nome).toBe("Ana Paula de Souza");
    expect(minha.data.dias.map((d) => d.data)).toEqual(["2026-10-05", "2026-10-25"]);
    expect(minha.data.dias[0].atividade).toBe("Preparação de urnas");
    const pedido = await s.request("/api/escala/trocas", "POST", { deData: "2026-10-05", paraData: "2026-10-16", motivo: "Prova na faculdade" }, ase.cookie);
    expect(pedido.status).toBe(201);
    expect((await s.request(`/api/escala/trocas/${pedido.data.troca.id}`, "PATCH", { acao: "aprovar" }, equipe.cookie)).status).toBe(403);
    expect((await s.request(`/api/escala/trocas/${pedido.data.troca.id}`, "PATCH", { acao: "aprovar" }, chefe.cookie)).status).toBe(200);
    const depois = await s.request("/api/escala/minha", "GET", undefined, ase.cookie);
    expect(depois.data.dias.map((d) => d.data)).toEqual(["2026-10-16", "2026-10-25"]);
    expect(depois.data.trocas[0].status).toBe("aprovada");

    const resumo = await s.request("/api/escala/resumo", "GET", undefined, chefe.cookie);
    expect(resumo.data.alerta).toBe(1);
    expect(resumo.data.trocasPendentes).toBe(0);
  } finally {
    s.close();
  }
}, 30000);
