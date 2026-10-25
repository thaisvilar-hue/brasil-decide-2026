// Brasil Decide 2026 — adapter TSE EA20 (presidência, segundo turno).
// Não usa dados simulados nem inventa votos se o esquema mudar.
const BASE='https://resultados.tse.jus.br/oficial/ele2026/6258/dados';
const UFS='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const empty=(message)=>({status:'unavailable',source:'TSE — arquivos oficiais EA20',updatedAt:null,national:null,states:[],municipalities:[],abroad:[],message});
function parseVotes(obj){
  // EA20: cand[] contém número do candidato (n) e votos apurados (vap).
  const groups=[obj?.cand,obj?.abr?.[0]?.cand,obj?.car?.[0]?.cand,obj?.carg?.[0]?.cand].filter(Array.isArray);
  for(const candidates of groups){
    const get=num=>candidates.find(c=>String(c.n??c.nr??c.numero)==num);
    const l=get('13'),f=get('22');if(!l||!f)continue;
    const votes=c=>Number(c.vap??c.votos??c.votacao);
    const lula=votes(l),bolsonaro=votes(f);
    if(Number.isSafeInteger(lula)&&Number.isSafeInteger(bolsonaro)&&lula>=0&&bolsonaro>=0)return {lula,bolsonaro};
  }
  return null;
}
async function load(scope){
  const uf=scope.toLowerCase();const file=`${uf}-c0001-e006258-u.json`;
  const response=await fetch(`${BASE}/${uf}/${file}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(`${scope}: HTTP ${response.status}`);
  return response.json();
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=45, stale-while-revalidate=45');
  try{
    const br=await load('br');const national=parseVotes(br);
    if(!national)return res.status(200).json(empty('Arquivo nacional disponível, mas ainda sem candidatos/votos válidos reconhecidos. Nenhum número será presumido.'));
    const responses=await Promise.allSettled(UFS.map(load));
    const states=responses.flatMap((r,i)=>{if(r.status!=='fulfilled')return [];const v=parseVotes(r.value);return v?[{uf:UFS[i],name:UFS[i],...v,progress:null}]:[]});
    const updatedAt=new Date().toISOString();
    return res.status(200).json({status:'live',source:'TSE — resultado unificado EA20, 2º turno de 2026',updatedAt,national:{...national,progress:null},states,municipalities:[],abroad:[],message:states.length<27?'Algumas UFs ainda não estão disponíveis ou exigem validação do leiaute. Municípios e exterior pendentes de integração.':'Municípios e exterior pendentes de integração.'});
  }catch(e){return res.status(200).json(empty('Não foi possível consultar os arquivos oficiais: '+e.message));}
}
