import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";

// TSE simulado: duas seções publicadas no pleito fictício 9999.
const tse = async (url) => {
  if (url.endsWith("/comum/config/ele-c.json"))
    return { pl: [{ cd: "9999", dt: "04/10/2026", e: [{ cd: "1", nm: "Eleição Ordinária Federal - 2026 1º Turno" }] }] };
  if (url.includes("/config/rj/"))
    return { abr: [{ mu: [{ cd: "60011", zon: [{ cd: "0023", sec: [{ ns: "0145" }, { ns: "0478" }, { ns: "9999" }] }] }] }] };
  if (url.includes("-s0145-aux.json")) return { st: "Totalizada", hashes: [{ dr: "04/10/2026", hr: "18:42:10", st: "Totalizado" }] };
  if (url.includes("-s0478-aux.json")) return { st: "Recebida", hashes: [{ dr: "04/10/2026", hr: "19:01:00" }] };
  return null;
};
const SENHA = "Inicial@teste";
function sandbox() {
  const dataDir = mkdtempSync(join(tmpdir(), "zona23-eleicao-test-"));
  const app = createApp({ dataDir, fetchJson: tse });
  const request = async (path, method = "GET", body, cookie = "") => {
    const isForm = body instanceof FormData;
    const response = await app.fetch(
      new Request("https://zona23.test" + path, {
        method,
        headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      }),
    );
    const type = response.headers.get("Content-Type") || "";
    return { status: response.status, headers: response.headers, data: type.includes("json") ? await response.json() : await response.arrayBuffer() };
  };
  const pessoa = async (username, role, extra = {}) => {
    app.auth.createUser({ username, role, password: SENHA, ...extra });
    const login = await app.fetch(new Request("https://zona23.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: SENHA }) }));
    const cookie = (login.headers.get("Set-Cookie") || "").split(";")[0];
    await request("/api/auth/password", "POST", { current: SENHA, next: `Senha de ${username} 2026` }, cookie);
    return cookie;
  };
  return { app, request, pessoa, close() { app.close(); rmSync(dataDir, { recursive: true }); } };
}

test("locais e seções: 32 locais, 225 seções e edição só pelo cartório", async () => {
  const s = sandbox();
  try {
    const equipe = await s.pessoa("servidora", "equipe");
    const presidente = await s.pessoa("presidente1", "presidente", { secao: 145 });
    const locais = await s.request("/api/eleicao/locais", "GET", undefined, presidente);
    expect(locais.data.total).toEqual({ locais: 32, secoes: 225, eleitores: 79560 });
    expect((await s.request("/api/eleicao/secoes/145", "PATCH", { sala: "Sala 03" }, presidente)).status).toBe(403);
    expect((await s.request("/api/eleicao/secoes/145", "PATCH", { sala: "Sala 03" }, equipe)).status).toBe(200);
    expect((await s.request("/api/eleicao/secoes/999", "PATCH", { sala: "x" }, equipe)).status).toBe(404);
    const joel = (await s.request("/api/eleicao/locais", "GET", undefined, equipe)).data.locais.find((l) => l.secoes.some((x) => x.secao === 145));
    expect(joel.secoes.find((x) => x.secao === 145).sala).toBe("Sala 03");
    // Presidente vê o próprio local no Início.
    expect((await s.request("/api/equipe/inicio", "GET", undefined, presidente)).data.local.nome).toBe(joel.nome);
  } finally {
    s.close();
  }
}, 30000);

test("totalização: lê o TSE, conta só seções da zona e separa recebidas de totalizadas", async () => {
  const s = sandbox();
  try {
    const juiz = await s.pessoa("juiz1", "juiz", { title: "Juiz Eleitoral" });
    const equipe = await s.pessoa("servidor", "equipe");
    expect((await s.request("/api/eleicao/totalizacao/atualizar", "POST", {}, juiz)).status).toBe(403);
    const painel = (await s.request("/api/eleicao/totalizacao/atualizar", "POST", {}, equipe)).data;
    expect(painel.atual.publicadas).toBe(2);
    expect(painel.totalizadas).toBe(1);
    expect(painel.primeira).toBe("2026-10-04T18:42:10");
    expect(painel.serie).toEqual([{ hora: "18:40", acumulado: 1 }]);
    const local = painel.locais.find((l) => l.secoes.some((x) => x.secao === 478));
    expect(local.secoes.find((x) => x.secao === 478).status).toBe("Recebida");
    expect((await s.request("/api/eleicao/totalizacao", "GET", undefined, juiz)).data.totalizadas).toBe(1);
  } finally {
    s.close();
  }
}, 30000);

test("demandas: administrador de prédio abre, cartório assume e conclui, autoridade não vê dados de eleitor", async () => {
  const s = sandbox();
  try {
    const adm = await s.pessoa("adm1", "adm_predio", { localId: 2 });
    const outroAdm = await s.pessoa("adm2", "adm_predio", { localId: 3 });
    const equipe = await s.pessoa("servidor", "equipe");
    const promotora = await s.pessoa("promo", "promotor");
    const aberta = await s.request("/api/eleicao/demandas", "POST", { tipo: "localizar_eleitor", descricao: "Eleitor não consta no caderno", dadosEleitor: "Título 0000 0000 0000" }, adm);
    expect(aberta.status).toBe(201);
    expect(aberta.data.demanda).toMatchObject({ numero: 1, status: "aberta", local_id: 2, canal: "sistema" });
    const id = aberta.data.demanda.id;
    expect((await s.request("/api/eleicao/demandas", "POST", { tipo: "urna", descricao: "x" }, promotora)).status).toBe(403);
    expect((await s.request("/api/eleicao/demandas", "GET", undefined, outroAdm)).data.demandas).toHaveLength(0);
    expect((await s.request("/api/eleicao/demandas", "GET", undefined, promotora)).data.demandas[0].dados_eleitor).toBe("[restrito]");
    expect((await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "assumir" }, adm)).status).toBe(403);
    expect((await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "assumir" }, equipe)).data.demanda.status).toBe("em_atendimento");
    expect((await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "concluir" }, equipe)).status).toBe(400);
    const concluida = await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "concluir", resposta: "Vota na seção 587" }, equipe);
    expect(concluida.data.demanda).toMatchObject({ status: "concluida", resposta: "Vota na seção 587" });
    const visao = (await s.request("/api/eleicao/demandas", "GET", undefined, adm)).data;
    expect(visao.demandas[0].resposta).toBe("Vota na seção 587");
    expect(visao.contagem).toEqual({ concluida: 1 });
  } finally {
    s.close();
  }
}, 30000);

test("documentos: upload pelo cartório, download conforme a visibilidade e sem duplicados", async () => {
  const s = sandbox();
  try {
    const equipe = await s.pessoa("servidor", "equipe");
    const ase = await s.pessoa("ase1", "ase");
    const juiz = await s.pessoa("juiz1", "juiz");
    const envio = (titulo, visibilidade, conteudo) => {
      const form = new FormData();
      form.set("arquivo", new File([conteudo], "orientacoes.pdf", { type: "application/pdf" }));
      form.set("titulo", titulo);
      form.set("categoria", "orientacoes");
      form.set("visibilidade", visibilidade);
      return form;
    };
    expect((await s.request("/api/documentos", "POST", envio("Guia", "todos", "%PDF-1 a"), ase)).status).toBe(403);
    const publico = await s.request("/api/documentos", "POST", envio("Guia do mesário", "todos", "%PDF-1 guia"), equipe);
    expect(publico.status).toBe(201);
    expect((await s.request("/api/documentos", "POST", envio("Repetido", "todos", "%PDF-1 guia"), equipe)).status).toBe(409);
    const interno = await s.request("/api/documentos", "POST", envio("Planejamento interno", "autoridades", "%PDF-1 interno"), equipe);
    const exe = new FormData();
    exe.set("arquivo", new File(["MZ"], "programa.exe"));
    exe.set("categoria", "outros");
    expect((await s.request("/api/documentos", "POST", exe, equipe)).status).toBe(400);
    expect((await s.request("/api/documentos", "GET", undefined, ase)).data.documentos.map((d) => d.titulo)).toEqual(["Guia do mesário"]);
    expect((await s.request("/api/documentos", "GET", undefined, juiz)).data.documentos).toHaveLength(2);
    expect((await s.request(`/api/documentos/${interno.data.documento.id}/arquivo`, "GET", undefined, ase)).status).toBe(404);
    const baixado = await s.request(`/api/documentos/${publico.data.documento.id}/arquivo`, "GET", undefined, ase);
    expect(baixado.status).toBe(200);
    expect(new TextDecoder().decode(baixado.data)).toBe("%PDF-1 guia");
    expect(baixado.headers.get("Content-Disposition")).toContain("attachment");
    expect((await s.request(`/api/documentos/${publico.data.documento.id}`, "DELETE", undefined, equipe)).status).toBe(200);
  } finally {
    s.close();
  }
}, 40000);

test("convocações: importação sem título, repetição atualiza e presença só pelo cartório", async () => {
  const { importarConvocacoes } = await import("../src/eleicao.js");
  const s = sandbox();
  try {
    const registros = [
      { local_codigo: "1660", funcao_codigo: "13", funcao: "Coletor de Justificativa", situacao: "Nomeado", nome: "Pessoa Fictícia Um", resposta: "Confirmado", edital: "0022/2026" },
      { local_codigo: "1660", funcao_codigo: "13", funcao: "Coletor de Justificativa", situacao: "Dispensado", nome: "Pessoa Fictícia Dois", resposta: "Pedido de dispensa", edital: "0022/2026" },
    ];
    expect(importarConvocacoes(s.app.db, "3220", registros)).toEqual({ novos: 2, atualizados: 0 });
    expect(importarConvocacoes(s.app.db, "3220", registros)).toEqual({ novos: 0, atualizados: 2 });
    const equipe = await s.pessoa("servidor", "equipe");
    const adm = await s.pessoa("adm1", "adm_predio", { localId: 26 });
    const juiz = await s.pessoa("juiz1", "juiz");
    expect((await s.request("/api/eleicao/convocacoes", "GET", undefined, adm)).status).toBe(403);
    const lista = (await s.request("/api/eleicao/convocacoes", "GET", undefined, juiz)).data;
    expect(lista.resumo).toMatchObject({ total: 2, situacao: { Nomeado: 1, Dispensado: 1 } });
    expect(lista.convocacoes[0].local.nome).toBe("Centro Educacional Triângulo");
    expect(JSON.stringify(lista)).not.toContain("chave");
    const id = lista.convocacoes.find((c) => c.situacao === "Nomeado").id;
    expect((await s.request(`/api/eleicao/convocacoes/${id}`, "PATCH", { presenca: "faltou" }, juiz)).status).toBe(403);
    expect((await s.request(`/api/eleicao/convocacoes/${id}`, "PATCH", { presenca: "talvez" }, equipe)).status).toBe(400);
    expect((await s.request(`/api/eleicao/convocacoes/${id}`, "PATCH", { presenca: "faltou" }, equipe)).status).toBe(200);
    importarConvocacoes(s.app.db, "3220", registros);
    expect((await s.request("/api/eleicao/convocacoes", "GET", undefined, equipe)).data.resumo.presenca.faltou).toBe(1);
    // Locais trazem aptos e acessibilidade do ELO.
    const locais = (await s.request("/api/eleicao/locais", "GET", undefined, equipe)).data;
    expect(locais.total.eleitores).toBe(79560);
    expect(locais.locais.find((l) => l.codigo === "1368").nome).toContain("Elite");
  } finally {
    s.close();
  }
}, 30000);

test("demandas: título e CPF mascarados para todos; só o cartório revela, com auditoria", async () => {
  const s = sandbox();
  try {
    const equipe = await s.pessoa("servidor", "equipe");
    const adm = await s.pessoa("adm1", "adm_predio", { localId: 2 });
    const criada = await s.request("/api/eleicao/demandas", "POST", { tipo: "localizar_eleitor", descricao: "CPF 123.456.789-01 não consta", dadosEleitor: "Título 1234 5678 0353" }, adm);
    expect(criada.data.demanda.dados_eleitor).toBe("Título •••• •••• 0353");
    expect(criada.data.demanda.descricao).toBe("CPF •••.•••.•••-01 não consta");
    const id = criada.data.demanda.id;
    expect((await s.request(`/api/eleicao/demandas/${id}/revelar`, "POST", {}, adm)).status).toBe(403);
    const revelado = await s.request(`/api/eleicao/demandas/${id}/revelar`, "POST", {}, equipe);
    expect(revelado.data.dados_eleitor).toBe("Título 1234 5678 0353");
    expect(s.app.db.query("SELECT COUNT(*) c FROM audit_log WHERE action='demanda_revelar'").get().c).toBe(1);
    // Concluir sem reenviar a resposta não grava a versão mascarada.
    await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "atualizar", resposta: "Título 1234 5678 0353 vota na 587" }, equipe);
    await s.request(`/api/eleicao/demandas/${id}`, "PATCH", { acao: "concluir" }, equipe);
    expect(s.app.db.query("SELECT resposta FROM demandas WHERE id=?").get(id).resposta).toBe("Título 1234 5678 0353 vota na 587");
  } finally {
    s.close();
  }
}, 30000);
