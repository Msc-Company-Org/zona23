import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";

const SENHA = "Inicial@teste";
function sandbox() {
  const dataDir = mkdtempSync(join(tmpdir(), "zona23-tarefas-test-"));
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

test("tarefas: delegar, apoio por @menção, checklist, histórico e visões", async () => {
  const s = sandbox();
  try {
    const chefe = await s.pessoa("chefia", "chefe", { name: "Ana Chefia" });
    const lucas = await s.pessoa("lucas", "equipe", { name: "Lucas Teste" });
    const bia = await s.pessoa("bia", "equipe", { name: "Bia Teste" });
    const juiz = await s.pessoa("juiz1", "juiz");
    const ase = await s.pessoa("ase1", "ase");

    // Só o cartório vê e cria tarefas.
    expect((await s.request("/api/tarefas", "GET", undefined, juiz.cookie)).status).toBe(403);
    expect((await s.request("/api/tarefas", "GET", undefined, ase.cookie)).status).toBe(403);
    expect((await s.request("/api/tarefas", "POST", { titulo: "x", responsavel: juiz.id }, chefe.cookie)).status).toBe(400);

    const criada = await s.request(
      "/api/tarefas",
      "POST",
      { titulo: "Dar andamento ao SEI de teste", tipo: "sei", referencia: "SEI 0000.0.000000-0", responsavel: lucas.id, prazo: "2026-10-01", prioridade: "alta", itens: ["Ler o processo", "Minutar despacho"] },
      chefe.cookie,
    );
    expect(criada.status).toBe(201);
    const id = criada.data.tarefa.id;
    expect(criada.data.tarefa.numero).toBe(1);
    expect(criada.data.tarefa.responsavel.id).toBe(lucas.id);
    expect(criada.data.tarefa.lista.length).toBe(2);

    // Visões: comigo (Lucas), atrasada (prazo passado) e equipe.
    const doLucas = await s.request("/api/tarefas?visao=comigo", "GET", undefined, lucas.cookie);
    expect(doLucas.data.tarefas.map((t) => t.id)).toEqual([id]);
    expect(doLucas.data.tarefas[0].atrasada).toBe(true);
    expect(doLucas.data.contagem.atrasadas).toBe(1);
    expect((await s.request("/api/tarefas?visao=comigo", "GET", undefined, bia.cookie)).data.tarefas).toEqual([]);

    // Comentário com @bia chama a Bia para apoiar.
    const comentario = await s.request(`/api/tarefas/${id}/comentarios`, "POST", { texto: "@bia confere a certidão no ELO?" }, lucas.cookie);
    expect(comentario.status).toBe(201);
    expect(comentario.data.tarefa.apoio.map((p) => p.id)).toEqual([bia.id]);
    expect((await s.request("/api/tarefas?visao=apoio", "GET", undefined, bia.cookie)).data.tarefas.length).toBe(1);

    // Marcar o primeiro item põe a tarefa em andamento.
    const item = comentario.data.tarefa.lista[0].id;
    const marcado = await s.request(`/api/tarefas/${id}/itens/${item}`, "PATCH", { feito: true }, bia.cookie);
    expect(marcado.data.tarefa.status).toBe("em_andamento");
    expect(marcado.data.tarefa.itens).toEqual({ total: 2, feitos: 1 });

    // Aguardando terceiro exige dizer de quem.
    expect((await s.request(`/api/tarefas/${id}`, "PATCH", { status: "aguardando" }, lucas.cookie)).status).toBe(400);
    const aguardando = await s.request(`/api/tarefas/${id}`, "PATCH", { status: "aguardando", aguardando: "Central de Mandados" }, lucas.cookie);
    expect(aguardando.data.tarefa.statusNome).toBe("Aguardando terceiro");

    // Passar adiante registra no histórico e tira a pessoa do apoio.
    const passada = await s.request(`/api/tarefas/${id}`, "PATCH", { responsavel: bia.id, status: "concluida" }, lucas.cookie);
    expect(passada.data.tarefa.responsavel.id).toBe(bia.id);
    expect(passada.data.tarefa.apoio).toEqual([]);
    expect(passada.data.tarefa.concluidaEm).not.toBe("");
    const tipos = passada.data.tarefa.eventos.map((e) => e.tipo);
    expect(tipos).toContain("criada");
    expect(tipos).toContain("comentario");
    expect(tipos).toContain("responsavel");
    expect(passada.data.tarefa.eventos.filter((e) => e.tipo === "status").length).toBe(3);
    expect((await s.request("/api/tarefas?visao=concluidas", "GET", undefined, chefe.cookie)).data.tarefas.length).toBe(1);

    // Só quem criou ou a chefia apaga.
    expect((await s.request(`/api/tarefas/${id}`, "DELETE", undefined, lucas.cookie)).status).toBe(403);
    expect((await s.request(`/api/tarefas/${id}`, "DELETE", undefined, chefe.cookie)).status).toBe(200);
    expect((await s.request(`/api/tarefas/${id}`, "GET", undefined, chefe.cookie)).status).toBe(404);
  } finally {
    s.close();
  }
}, 30000);

test("tarefas em lote: justificativas por dias pares e ímpares e por faixas de seção", async () => {
  const s = sandbox();
  try {
    const chefe = await s.pessoa("chefia", "chefe");
    const a = await s.pessoa("pedro", "equipe", { name: "Pedro" });
    const b = await s.pessoa("joaozinho", "equipe", { name: "Joãozinho" });
    const c = await s.pessoa("ana", "equipe", { name: "Ana" });

    expect((await s.request("/api/tarefas/lote", "POST", { modelo: "justificativas", criterio: "pares_impares", pessoas: [a.id] }, chefe.cookie)).status).toBe(400);
    const pares = await s.request("/api/tarefas/lote", "POST", { modelo: "justificativas", criterio: "pares_impares", pessoas: [a.id, b.id], prazo: "2026-10-09" }, chefe.cookie);
    expect(pares.status).toBe(201);
    expect(pares.data.tarefas.map((t) => t.titulo)).toEqual(["Justificativas pós-turno · dias pares", "Justificativas pós-turno · dias ímpares"]);
    expect(pares.data.tarefas[0].itens.total).toBe(5);
    expect(new Set(pares.data.tarefas.map((t) => t.lote)).size).toBe(1);

    const faixas = await s.request("/api/tarefas/lote", "POST", { modelo: "justificativas", criterio: "secoes", pessoas: [a.id, b.id, c.id] }, chefe.cookie);
    const titulos = faixas.data.tarefas.map((t) => t.titulo);
    expect(titulos.length).toBe(3);
    expect(titulos[0]).toMatch(/seções 0\d{3} a 0\d{3}$/);

    const resumo = await s.request("/api/tarefas/resumo", "GET", undefined, chefe.cookie);
    expect(resumo.data.equipe).toBe(5);
    expect(resumo.data.porPessoa.length).toBe(3);
    const doPedro = await s.request("/api/tarefas/resumo", "GET", undefined, a.cookie);
    expect(doPedro.data.comigo).toBe(2);
  } finally {
    s.close();
  }
}, 30000);
