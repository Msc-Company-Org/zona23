import { GROUPS } from './auth.js';
import { LOCAIS, SECAO_LOCAL } from './locais.js';

export function migrateMapeamento(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS resultados_secoes (
    pleito TEXT NOT NULL, secao INTEGER NOT NULL, urna TEXT NOT NULL DEFAULT '',
    aptos INTEGER NOT NULL, comparecimento INTEGER NOT NULL, votos TEXT NOT NULL,
    fonte TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (pleito,secao)
  )`);
}
const normal = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function grupoFuncao(funcao) {
  const f = normal(funcao);
  if (/justific/.test(f)) return 'coletores';
  if (/administr.*pred|adm.*pred/.test(f)) return 'administradores';
  if (/auxiliar.*servic.*eleitor|\base\b/.test(f)) return 'ase';
  if (/mesari|presidente|secretari/.test(f)) return 'mesarios';
  return 'outros';
}
export function resumoResultados(rows) {
  const aptos = rows.reduce((s,r) => s + r.aptos, 0);
  const comparecimento = rows.reduce((s,r) => s + r.comparecimento, 0);
  return { secoesComDados: rows.length, aptos, comparecimento, abstencao: aptos - comparecimento,
    taxaAbstencao: aptos ? (aptos - comparecimento) / aptos * 100 : null };
}
export function createMapeamento({db,json,InputError,textValue,auth}) {
  function read(pleito) {
    const pleitos = [...new Set([...db.query('SELECT pleito FROM totalizacao_pleitos ORDER BY data DESC').all().map(r=>r.pleito),
      ...db.query('SELECT DISTINCT pleito FROM resultados_secoes ORDER BY pleito DESC').all().map(r=>r.pleito),
      ...db.query('SELECT DISTINCT pleito FROM convocacoes ORDER BY pleito DESC').all().map(r=>r.pleito)])];
    pleito ||= pleitos[0] || '';
    const rows = db.query('SELECT * FROM resultados_secoes WHERE pleito=? ORDER BY secao').all(pleito)
      .map(r=>({...r,votos:JSON.parse(r.votos)}));
    const porSecao = new Map(rows.map(r=>[r.secao,r]));
    const salas = new Map(db.query('SELECT secao,sala FROM secoes_info').all().map(r=>[r.secao,r.sala]));
    const convocados = db.query('SELECT id,nome,funcao,local_id,secao,presenca,situacao FROM convocacoes WHERE pleito=? ORDER BY nome').all(pleito)
      .map(r=>({...r,grupo:grupoFuncao(r.funcao)}));
    const ase = db.query('SELECT id,nome FROM escala_pessoas WHERE ativo=1 ORDER BY nome').all()
      .map(r=>({...r,funcao:'ASE · cadastro da escala',grupo:'ase',local_id:null,secao:null,presenca:'',origem:'escala'}));
    // A escala não contém lotação: não atribuir um ASE a um colégio por suposição.
    const equipe = [...convocados,...ase.filter(a=>!convocados.some(c=>c.grupo==='ase' && normal(c.nome)===normal(a.nome)))];
    return {pleito,pleitos,resumo:resumoResultados(rows),equipe,
      locais:LOCAIS.map(l=>({...l,resumo:resumoResultados(rows.filter(r=>SECAO_LOCAL.get(r.secao)?.id===l.id)),
        secoes:l.secoes.map(secao=>({secao,sala:salas.get(secao)||'',resultado:porSecao.get(secao)||null}))}))};
  }
  async function handle(req,url) {
    const me = auth.guard(req);
    if (![...GROUPS.cartorio,...GROUPS.autoridade].includes(me.role)) throw new InputError('Mapeamento e listas ficam com o cartório e as autoridades.',403);
    if (req.method==='GET') return json(read(url.searchParams.get('pleito')||''));
    if (req.method!=='POST') throw new InputError('Método não permitido.',405);
    if (!GROUPS.cartorio.includes(me.role)) throw new InputError('Só o cartório importa resultados.',403);
    const body = await req.json();
    if (!body || typeof body !== 'object') throw new InputError('Informe um objeto JSON.');
    const pleito = textValue(String(body.pleito??''),'Pleito',40,true);
    const fonte = textValue(String(body.fonte??''),'Fonte dos resultados',500,true);
    if (!Array.isArray(body.secoes) || !body.secoes.length || body.secoes.length>SECAO_LOCAL.size) throw new InputError('Informe as seções do lote.');
    const seen = new Set();
    const inteiro = (n,label) => { if (!Number.isSafeInteger(n)||n<0) throw new InputError(`${label}: informe um inteiro não negativo.`); return n; };
    const rows = body.secoes.map(r=>{
      if (!r || !SECAO_LOCAL.has(r.secao)||seen.has(r.secao)) throw new InputError('Seção desconhecida ou repetida no lote.');
      seen.add(r.secao);
      const aptos = inteiro(r.aptos,'Aptos'), comparecimento = inteiro(r.comparecimento,'Comparecimento');
      if(comparecimento>aptos) throw new InputError('Comparecimento não pode superar aptos.');
      if(!Array.isArray(r.votos)||r.votos.length>2000) throw new InputError('Informe a lista de votos por cargo.');
      const chaves = new Set();
      const votos = r.votos.map(v=>{
        if (!v || typeof v !== 'object') throw new InputError('Voto inválido.');
        const cargo=textValue(String(v.cargo??''),'Cargo',80,true);
        const candidato=textValue(String(v.candidato??''),'Candidato, legenda, branco ou nulo',160,true);
        const numero=textValue(String(v.numero??''),'Número',20);
        const chave=JSON.stringify([cargo,candidato,numero]);
        if(chaves.has(chave)) throw new InputError('Resultado de votação repetido.');
        chaves.add(chave);
        return {cargo,candidato,numero,votos:inteiro(v.votos,'Votos')};
      });
      return {secao:r.secao,urna:textValue(String(r.urna??''),'Identificação da urna',80),aptos,comparecimento,votos};
    });
    const now=new Date().toISOString();
    db.transaction(()=>{
      const put=db.query(`INSERT INTO resultados_secoes VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(pleito,secao)
        DO UPDATE SET urna=excluded.urna,aptos=excluded.aptos,comparecimento=excluded.comparecimento,votos=excluded.votos,fonte=excluded.fonte,atualizado_em=excluded.atualizado_em`);
      for(const r of rows) put.run(pleito,r.secao,r.urna,r.aptos,r.comparecimento,JSON.stringify(r.votos),fonte,now);
      auth.audit(me.id,'resultados_import','pleito',pleito,`${rows.length} seções`);
    })();
    return json({importadas:rows.length,...read(pleito)});
  }
  return {handle};
}
