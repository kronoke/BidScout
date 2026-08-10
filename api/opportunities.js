function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function fmtDate(d){return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`}
function stripHtml(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim()}
function addApiKey(url,key){if(!url||url==='null')return null;try{const u=new URL(url);u.searchParams.set('api_key',key);return u.toString()}catch{return null}}
async function fetchDescription(url,key){const keyed=addApiKey(url,key);if(!keyed)return null;try{const r=await fetch(keyed,{headers:{accept:'text/html,text/plain,application/json'}});if(!r.ok)return null;const type=r.headers.get('content-type')||'';let text;if(type.includes('json')){const j=await r.json();text=j.description||j.body||j.content||JSON.stringify(j)}else{text=await r.text()}const clean=stripHtml(text);return clean&&clean.length>8?clean.slice(0,1800):null}catch{return null}}
function scoreOpportunity(o){
  let score=50;const positives=[],risks=[];
  const text=`${o.title||''} ${o.description||''} ${o.type||''} ${o.tags?.join(' ')||''}`.toLowerCase();
  const goods=['printer','computer','laptop','monitor','chair','furniture','office supplies','paper','signage','uniform','equipment','tool','parts','supplies','appliance','battery','toner','cartridge','food','catering'];
  const simpleServices=['cleaning','janitorial','landscaping','grass cutting','snow removal','moving','photography','translation','printing','graphic design','website','pest control','grounds maintenance'];
  const hard=['construction','engineering','architect','asbestos','hazmat','medical','surgical','security clearance','aircraft','weapon','ammunition','nuclear','demolition','roof replacement','electrical installation','plumbing installation'];
  const research=['sources sought','request for information','special notice','presolicitation','intent to sole source','industry day'];
  const award=['award notice','justification','award'];
  if(goods.some(k=>text.includes(k))){score+=16;positives.push('Commercial product sourcing potential')}
  if(simpleServices.some(k=>text.includes(k))){score+=12;positives.push('Relatively straightforward service category')}
  if(hard.some(k=>text.includes(k))){score-=22;risks.push('Specialized or capital-intensive work')}
  if(research.some(k=>text.includes(k))){score-=28;risks.push('May be market research rather than an open bid')}
  if(award.some(k=>String(o.type||'').toLowerCase().includes(k))){score-=40;risks.push('Appears to be an award/post-award notice')}
  if(o.setAside&&/small business/i.test(o.setAside)){score+=8;positives.push('Small-business set-aside')}
  const country=(o.country||'').toUpperCase();
  if(country&&['USA','US','UNITED STATES','UNITED STATES OF AMERICA'].includes(country)){score+=7;positives.push('U.S. place of performance')}
  else if(country){score-=24;risks.push(`Foreign place of performance: ${o.country}`)}
  const days=o.deadline?Math.ceil((new Date(o.deadline)-new Date())/86400000):null;
  if(days!==null){if(days>=10&&days<=45){score+=10;positives.push(`${days} days to respond`)}else if(days>=5){score+=4}else if(days>=0){score-=14;risks.push('Very short response window')}else{score-=45;risks.push('Response deadline has passed')}}else{score-=4;risks.push('No response deadline shown')}
  if(o.description&&o.description.length>140){score+=5;positives.push('Enough detail for initial screening')}else{score-=3;risks.push('Limited description data')}
  if(o.active===false){score-=45;risks.push('Not active')}
  score=clamp(score,0,100);
  const verdict=score>=85?'Exceptional':score>=70?'Strong':score>=55?'Investigate':'Skip';
  const recommendation=score>=85?'High-priority review':score>=70?'Worth reviewing now':score>=55?'Review if it matches your capabilities':'Low-priority / likely skip';
  return{score,verdict,recommendation,positives:positives.slice(0,3),risks:risks.slice(0,3)}
}
const seed=[{id:'seed-1',source:'SAM.gov',title:'Commercial Office Equipment & Supplies',agency:'Federal Agency',postedDate:'2026-08-09',deadline:'2026-08-21',location:'United States',country:'USA',type:'Solicitation',setAside:'Small Business — verify notice',description:'Commercially available office equipment and related supplies. Seed example used until live API is configured.',url:'https://sam.gov/opportunities',value:'Not disclosed',tags:['Product sourcing','Low specialization'],demo:true,active:true}];
async function fetchSam(){
  const apiKey=process.env.SAM_API_KEY;if(!apiKey)return[];
  const now=new Date(),from=new Date(now);from.setDate(from.getDate()-7);
  const p=new URLSearchParams({api_key:apiKey,limit:'50',offset:'0',postedFrom:fmtDate(from),postedTo:fmtDate(now)});
  const r=await fetch(`https://api.sam.gov/opportunities/v2/search?${p}`);if(!r.ok)throw new Error(`SAM.gov API returned ${r.status}`);
  const j=await r.json();const raw=(j.opportunitiesData||[]).slice(0,50);
  return Promise.all(raw.map(async x=>{
    const description=await fetchDescription(x.description,apiKey);
    const pop=x.placeOfPerformance||{};const country=pop.country?.name||pop.country?.code||'';
    const city=pop.city?.name||pop.city||'';const state=pop.state?.code||pop.state||'';
    const location=[city,state,country&&!['USA','US','United States'].includes(country)?country:null].filter(Boolean).join(', ')||country||'See notice';
    const setAside=x.typeOfSetAsideDescription||x.setAside||x.typeOfSetAside||x.setAsideCode||'Not specified';
    const amount=x.award?.amount||x.data?.award?.amount||null;
    return {id:x.noticeId,source:'SAM.gov',title:x.title||'Untitled opportunity',agency:x.fullParentPathName||[x.department,x.subTier,x.office].filter(Boolean).join(' · ')||'Federal agency',postedDate:x.postedDate,deadline:x.responseDeadLine||x.reponseDeadLine||null,location,country,type:x.type||'Opportunity',setAside,description:description||'Description could not be loaded automatically. Open the original solicitation for full requirements.',url:`https://sam.gov/opp/${encodeURIComponent(x.noticeId)}/view`,value:amount?`$${Number(amount).toLocaleString('en-US')}`:'Not disclosed',tags:[x.naicsCode?`NAICS ${x.naicsCode}`:null,x.classificationCode?`PSC ${x.classificationCode}`:null].filter(Boolean),demo:false,active:String(x.active||'Yes').toLowerCase()==='yes'}
  }))
}
module.exports=async function handler(req,res){res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');let live=[],error=null;try{live=await fetchSam()}catch(e){error=e.message}const items=(live.length?live:seed).map(o=>({...o,...scoreOpportunity(o)})).filter(o=>o.active!==false).sort((a,b)=>b.score-a.score);res.status(200).json({mode:live.length?'live':'demo',error,updatedAt:new Date().toISOString(),items})}
