let mpDados = null;
const mpNumero = n => n === null || n === undefined ? 'Sem dados' : n.toLocaleString('pt-BR');
const mpTaxa = n => n === null ? 'Sem dados' : `${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const mpGrupos = {mesarios:'Mesários',ase:'ASE',administradores:'Administradores de prédio',coletores:'Coletores de justificativa',outros:'Outras funções'};
async function loadMapeamento() {
  $('#mp-importar').hidden = !EDITORS.includes(me.role);
  try {
    const pleito = $('#mp-pleito').value;
    mpDados = await api('/api/eleicao/mapeamento' + (pleito ? `?pleito=${encodeURIComponent(pleito)}` : ''));
    $('#mp-pleito').innerHTML = mpDados.pleitos.map(p=>`<option value="${esc(p)}" ${p===mpDados.pleito?'selected':''}>${esc(p)}</option>`).join('') || '<option value="">Sem pleito cadastrado</option>';
    const cargo = $('#mp-cargo').value;
    const cargos = [...new Set(mpDados.locais.flatMap(l=>l.secoes.flatMap(s=>s.resultado?.votos.map(v=>v.cargo)||[])))].sort();
    $('#mp-cargo').innerHTML = '<option value="">Todos</option>' + cargos.map(c=>`<option value="${esc(c)}" ${c===cargo?'selected':''}>${esc(c)}</option>`).join('');
    renderMapeamento();
  } catch(error) { $('#mp-lista').innerHTML = `<p class="error">${esc(error.message)}</p>`; }
}
function mpEquipe(pessoas) {
  const grupo = $('#mp-grupo').value;
  return Object.entries(mpGrupos).filter(([g])=>!grupo||g===grupo).map(([g,label])=>{
    const lista=pessoas.filter(p=>p.grupo===g);
    return `<div class="mp-equipe"><strong>${label} · ${lista.length}</strong>${lista.length?`<ul>${lista.map(p=>`<li>${esc(p.nome)} <small>${esc(p.funcao)}${p.secao?` · seção ${p.secao}`:''}${p.situacao?` · ${esc(p.situacao)}`:''}${p.presenca?` · ${esc(p.presenca)}`:''}</small></li>`).join('')}</ul>`:'<p class="muted">Nenhum registro nesta lista.</p>'}</div>`;
  }).join('');
}
function mpVotosColegio(local,cargo) {
  const somas = new Map();
  for (const s of local.secoes) for (const v of s.resultado?.votos || []) {
    if (cargo && v.cargo !== cargo) continue;
    const k=JSON.stringify([v.cargo,v.candidato,v.numero]);
    const atual=somas.get(k)||{...v,votos:0}; atual.votos+=v.votos; somas.set(k,atual);
  }
  if (!somas.size) return '';
  return `<details><summary>Votos do colégio · seções com dados no filtro</summary><div class="mp-tabela"><table><caption>Totais por cargo; cargos não são somados entre si</caption><thead><tr><th>Cargo</th><th>Candidato / tipo</th><th>Número</th><th>Votos</th></tr></thead><tbody>${[...somas.values()].map(v=>`<tr><td>${esc(v.cargo)}</td><td>${esc(v.candidato)}</td><td>${esc(v.numero)}</td><td>${mpNumero(v.votos)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function renderMapeamento() {
  if (!mpDados) return;
  const q=normalizeText($('#mp-busca').value), cargo=$('#mp-cargo').value;
  const locais=mpDados.locais.map(l=>{
    const localMatch=normalizeText(`${l.nome} ${l.bairro} ${l.endereco}`).includes(q);
    return {...l,secoes:l.secoes.filter(s=>!q||localMatch||String(s.secao)===q||normalizeText(s.resultado?.urna||'').includes(q))};
  }).filter(l=>l.secoes.length);
  const resultados=locais.flatMap(l=>l.secoes.map(s=>s.resultado).filter(Boolean));
  const aptos=resultados.reduce((n,r)=>n+r.aptos,0), comp=resultados.reduce((n,r)=>n+r.comparecimento,0);
  const total=locais.reduce((n,l)=>n+l.secoes.length,0);
  $('#mp-resumo').textContent=`${locais.length} colégios · ${total} seções · ${resultados.length}/${total} seções com resultados · Comparecimento: ${resultados.length?mpNumero(comp):'Sem dados'} · Abstenção: ${resultados.length?mpNumero(aptos-comp):'Sem dados'} (${mpTaxa(aptos?(aptos-comp)/aptos*100:null)}). Taxa calculada apenas sobre seções com dados, ponderada pelos aptos.`;
  $('#mp-lista').innerHTML=locais.map(l=>{
    const equipe=mpDados.equipe.filter(p=>p.local_id===l.id||(!p.local_id&&l.secoes.some(s=>s.secao===p.secao)));
    return `<article class="lc-card mp-card"><header><span class="tt-area">${esc(l.area)}</span><div><strong>${esc(l.nome)}</strong><small>${esc(l.endereco)} · ${esc(l.bairro)}</small></div></header>
      ${mpVotosColegio(l,cargo)}
      <details><summary>Equipes do colégio · ${equipe.length} pessoas</summary>${mpEquipe(equipe)}</details>
      ${l.secoes.map(s=>{
        const r=s.resultado, votos=(r?.votos||[]).filter(v=>!cargo||v.cargo===cargo);
        return `<details class="mp-secao"><summary>Seção ${s.secao} · ${s.sala?esc(s.sala):'Sala não informada'} · Urna: ${r?.urna?esc(r.urna):'Não informada'} · Abstenção: ${mpTaxa(r?.aptos?(r.aptos-r.comparecimento)/r.aptos*100:null)}</summary>
        ${r?`<p>${mpNumero(r.aptos)} aptos · ${mpNumero(r.comparecimento)} comparecimentos · ${mpNumero(r.aptos-r.comparecimento)} abstenções</p><p class="small muted">Fonte: ${esc(r.fonte)} · Atualização: ${esc(new Date(r.atualizado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} (Brasília)</p>${votos.length?`<div class="mp-tabela"><table><caption>Votos agregados da seção ${s.secao}</caption><thead><tr><th>Cargo</th><th>Candidato / tipo</th><th>Número</th><th>Votos</th></tr></thead><tbody>${votos.map(v=>`<tr><td>${esc(v.cargo)}</td><td>${esc(v.candidato)}</td><td>${esc(v.numero)}</td><td>${mpNumero(v.votos)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Sem votos cadastrados para este cargo.</p>'}`:'<p>Resultados ainda não importados para esta seção e pleito.</p>'}
        ${mpEquipe(equipe.filter(p=>p.secao===s.secao))}</details>`;
      }).join('')}</article>`;
  }).join('') || '<p>Nenhum colégio ou seção encontrado.</p>';
  const semLocal=mpDados.equipe.filter(p=>!p.local_id&&!p.secao);
  if (!q) $('#mp-lista').insertAdjacentHTML('beforeend',`<article class="lc-card mp-card"><h2>Equipe sem lotação cadastrada</h2><p>ASE do cadastro da escala e convocados sem vínculo com colégio ou seção. O cadastro ASE não indica a escala do dia.</p>${mpEquipe(semLocal)}</article>`);
}
$('#mp-pleito').addEventListener('change',loadMapeamento);
for(const id of ['mp-busca','mp-cargo','mp-grupo']) $('#'+id).addEventListener(id==='mp-busca'?'input':'change',renderMapeamento);
$('#mp-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('#mp-erro').textContent='';
  const button=event.submitter; button.disabled=true;
  try {
    const body=JSON.parse($('#mp-json').value);
    if (!await confirmBox('Importar resultados?', 'As seções deste lote terão seus resultados substituídos no pleito informado.', 'Importar')) return;
    const data=await api('/api/eleicao/mapeamento',{method:'POST',body});
    $('#mp-pleito').innerHTML=`<option value="${esc(data.pleito)}">${esc(data.pleito)}</option>`;
    toast(`${data.importadas} seções importadas.`); await loadMapeamento();
  } catch(error) { $('#mp-erro').textContent=error.message; }
  finally {button.disabled=false;}
});
