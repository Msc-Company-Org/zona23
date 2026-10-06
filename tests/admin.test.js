import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
function sandbox(options={}) {
 const dataDir=mkdtempSync(join(tmpdir(),"zona23-admin-test-"));
 const app=createApp({dataDir,...options});
 const request=(path,method="GET",body,headers={})=>app.fetch(new Request("https://zona23.test"+path,{method,headers:{"Content-Type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body)}));
 return {request,close(){app.close();rmSync(dataDir,{recursive:true});}};
}
test("administracao nao habilita credencial padrao e preserva o acervo publico",async()=>{
 const s=sandbox();try{
  expect((await s.request("/api/admin/login","POST",{username:"admin",password:"admin"})).status).toBe(503);
  expect((await s.request("/api/admin/dashboard")).status).toBe(401);
  expect((await s.request("/api/stats")).status).toBe(200);
  expect((await s.request("/admin")).status).toBe(200);
 }finally{s.close();}
});
test("sessao administrativa exige troca, recusa origem externa e encerra acesso no logout",async()=>{
 const initial="somente-teste-inicial-2026";
 const s=sandbox({adminBootstrapPassword:initial,publicOrigin:"https://zona23.test"});try{
  expect((await s.request("/api/admin/login","POST",{username:"admin",password:"admin"})).status).toBe(401);
  const login=await s.request("/api/admin/login","POST",{username:"admin",password:initial});
  expect(login.status).toBe(200);
  expect((await login.json()).user.mustChange).toBe(true);
  const cookie=login.headers.get("Set-Cookie");
  expect(cookie).toContain("HttpOnly");expect(cookie).toContain("SameSite=Strict");expect(cookie).toContain("Secure");
  const headers={Cookie:cookie.split(";")[0],Origin:"https://zona23.test"};
  expect((await s.request("/api/admin/dashboard","GET",undefined,headers)).status).toBe(403);
  expect((await s.request("/api/admin/password","POST",{current:initial,next:"somente-teste-nova-2026"},{...headers,Origin:"https://externo.test"})).status).toBe(403);
  expect((await s.request("/api/admin/password","POST",{current:initial,next:"somente-teste-nova-2026"},headers)).status).toBe(200);
  expect((await s.request("/api/admin/dashboard","GET",undefined,headers)).status).toBe(200);
  expect((await s.request("/api/admin/events","POST",{name:"Evento de teste",date:"2026-10-06"},headers)).status).toBe(201);
  expect((await s.request("/api/admin/settings","PATCH",{hero_title:"Acervo de teste"},headers)).status).toBe(200);
  const page=await s.request("/memorias");expect(await page.text()).toContain("Acervo de teste");
  expect((await s.request("/api/admin/logout","POST",{},headers)).status).toBe(200);
  expect((await s.request("/api/admin/dashboard","GET",undefined,headers)).status).toBe(401);
 }finally{s.close();}
},20000);
