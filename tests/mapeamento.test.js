import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { importarConvocacoes } from "../src/eleicao.js";
import { LOCAIS } from "../src/locais.js";
import { grupoFuncao, resumoResultados } from "../src/mapeamento.js";
const SENHA = "Inicial@teste";
function sandbox() {
  const dataDir = mkdtempSync(join(tmpdir(), "zona23-eleicao-test-"));
  const app = createApp({ dataDir, fetchJson: async () => null });
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


test("mapeamento: anonimato, perfis, importação atômica e substituição por pleito", async () => {
  const s=sandbox();
  try {
    const equipe=await s.pessoa('operador','equipe');
    const juiz=await s.pessoa('juizo','juiz');
    const campo=await s.pessoa('apoio','ase');
    const url='/api/eleicao/mapeamento';
    importarConvocacoes(s.app.db,'teste-1',[
      {nome:'Mesária sintética',funcao:'Presidente de seção',local_codigo:LOCAIS[0].codigo,secao:145},
      {nome:'Administradora sintética',funcao:'Administrador de prédio',local_codigo:LOCAIS[0].codigo},
      {nome:'Coletora sintética',funcao:'Coletor de justificativa',local_codigo:LOCAIS[0].codigo}
    ]);
    s.app.db.query("INSERT INTO escala_pessoas (id,nome,chave,criado_em) VALUES ('ase-teste','ASE sintético','ASE TESTE',?)").run(new Date().toISOString());
    expect((await s.request(url)).status).toBe(401);
    expect((await s.request(url,'GET',undefined,campo)).status).toBe(403);
    const lote={pleito:'teste-1',fonte:'Boletim sintético de teste',secoes:[{secao:145,urna:'TESTE-145',aptos:100,comparecimento:80,votos:[{cargo:'Presidente',candidato:'Exemplo',numero:'00',votos:70}]}]};
    expect((await s.request(url,'POST',lote,juiz)).status).toBe(403);
    const salvo=await s.request(url,'POST',lote,equipe);
    expect(salvo.status).toBe(200);
    expect(salvo.data.equipe.map(p=>p.grupo).sort()).toEqual(['administradores','ase','coletores','mesarios']);
    expect(salvo.data.equipe.find(p=>p.grupo==='ase').local_id).toBeNull();
    expect(salvo.data.resumo).toMatchObject({secoesComDados:1,abstencao:20,taxaAbstencao:20});
    expect((await s.request(url+'?pleito=teste-1','GET',undefined,juiz)).data.locais.flatMap(l=>l.secoes).find(s=>s.secao===145).resultado.urna).toBe('TESTE-145');
    const invalido={...lote,secoes:[{...lote.secoes[0],comparecimento:50},{...lote.secoes[0],secao:478,comparecimento:101}]};
    expect((await s.request(url,'POST',invalido,equipe)).status).toBe(400);
    expect((await s.request(url+'?pleito=teste-1','GET',undefined,equipe)).data.resumo.comparecimento).toBe(80);
    expect((await s.request(url,'POST',{...lote,secoes:[lote.secoes[0],lote.secoes[0]]},equipe)).status).toBe(400);
    await s.request(url,'POST',{...lote,pleito:'teste-2'},equipe);
    await s.request(url,'POST',{...lote,secoes:[{...lote.secoes[0],comparecimento:90}]},equipe);
    expect((await s.request(url+'?pleito=teste-1','GET',undefined,equipe)).data.resumo.comparecimento).toBe(90);
    expect((await s.request(url+'?pleito=teste-2','GET',undefined,equipe)).data.resumo.comparecimento).toBe(80);
  } finally {s.close();}
},30000);

test("abstenção ponderada, ausência de denominador e classificação de equipes",()=>{
  expect(resumoResultados([{aptos:100,comparecimento:50},{aptos:900,comparecimento:810}]).taxaAbstencao).toBeCloseTo(14);
  expect(resumoResultados([]).taxaAbstencao).toBeNull();
  expect(grupoFuncao('Coletor de justificativa')).toBe('coletores');
  expect(grupoFuncao('Administrador de prédio')).toBe('administradores');
  expect(grupoFuncao('Auxiliar de Serviços Eleitorais')).toBe('ase');
  expect(grupoFuncao('Presidente de seção')).toBe('mesarios');
  expect(grupoFuncao('Apoio não classificado')).toBe('outros');
});
