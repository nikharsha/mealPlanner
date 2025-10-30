// v5.1 — robust CSV load + logging
const MEAL_ORDER = ['Early Morning','Breakfast','Mid-Morning','Lunch','Evening Snack','Dinner','Bedtime'];
const MEAL_EMOJI = new Map([['Early Morning','🌅'],['Breakfast','🍳'],['Mid-Morning','🥛'],['Lunch','🍲'],['Evening Snack','🍎'],['Dinner','🥗'],['Bedtime','🌙']]);
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TARGET = { kcalMin:1650,kcalMax:1700,P:80,C:170,F:50 };
const state = { all:[], byType:new Map(), week:new Map() };
const $ = s => document.querySelector(s);

function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const parts=line.split(',').map(s=>s.trim());
    const r={}; headers.forEach((h,i)=> r[h]=parts[i]);
    r.Protein=+r.Protein; r.Carbs=+r.Carbs; r.Fat=+r.Fat;
    r.Kcal = r.Protein*4 + r.Carbs*4 + r.Fat*9;
    return r;
  });
}
async function loadMeals(){
  const url=new URL('meals.csv', window.location.href);
  const res=await fetch(url);
  if(!res.ok){ console.error('❌ meals.csv failed', res.status, res.statusText); return; }
  const t=await res.text();
  const rows=parseCSV(t);
  state.all=rows;
  state.byType=new Map();
  for(const r of rows){ if(!state.byType.has(r.MealType)) state.byType.set(r.MealType, []); state.byType.get(r.MealType).push(r); }
  console.log(`✅ Loaded ${rows.length} rows across ${state.byType.size} meal types.`);
}
function pick(a){ return a[Math.floor(Math.random()*a.length)] }
function randomDay(){ const m=new Map(); for(const mt of MEAL_ORDER){ const o=state.byType.get(mt)||[]; if(o.length) m.set(mt,pick(o)); } return m; }
function totals(dm){ let P=0,C=0,F=0,K=0; for(const mt of MEAL_ORDER){ const it=dm.get(mt); if(!it) continue; P+=it.Protein; C+=it.Carbs; F+=it.Fat; K+=it.Kcal; } return {P,C,F,K}; }
function persist(){ const o={}; for(const d of DAYS){ const dm=state.week.get(d); o[d]={}; for(const mt of MEAL_ORDER) o[d][mt]=dm.get(mt)?.Name||null; } localStorage.setItem('week-v5_1', JSON.stringify(o)); }
function tryLoad(){ const raw=localStorage.getItem('week-v5_1'); if(!raw) return false; try{ const o=JSON.parse(raw); state.week=new Map(); for(const d of DAYS){ const dm=new Map(); for(const mt of MEAL_ORDER){ const name=o?.[d]?.[mt]; const found=(state.byType.get(mt)||[]).find(x=>x.Name===name) || (state.byType.get(mt)||[])[0]; if(found) dm.set(mt,found);} state.week.set(d,dm);} return true; }catch(e){ return false; } }
function regenWeek(){ state.week=new Map(); for(const d of DAYS) state.week.set(d, randomDay()); renderAll(); persist(); }

function dayBar(day,T){ const pct=Math.min(100, Math.round(100*T.K/TARGET.kcalMax)); const div=document.createElement('div'); div.className='dayBar'; div.innerHTML=`<div class="head"><span>${day}</span><span>${Math.round(T.K)} kcal</span></div><div class="progress"><span style="width:${pct}%"></span></div><div class="metaRow"><span>P ${Math.round(T.P)}g</span><span>C ${Math.round(T.C)}g</span><span>F ${Math.round(T.F)}g</span></div>`; return div; }
function renderDailyBars(){ const root=$('#dailyBars'); root.innerHTML=''; for(const d of DAYS){ const T=totals(state.week.get(d)); root.appendChild(dayBar(d,T)); } }

function mealRow(day,mt,it){ const d=document.createElement('div'); d.className='meal'; const r1=document.createElement('div'); r1.className='row1'; r1.innerHTML=`<div class="mTitle">${MEAL_EMOJI.get(mt)||'•'} <span>${mt}</span></div>`; const edit=document.createElement('button'); edit.className='iconBtn edit'; edit.textContent='✏️'; edit.onclick=(e)=>openPicker(day,mt,it,e); r1.appendChild(edit); const dish=document.createElement('div'); dish.className='dish'; dish.textContent=it.Name; const mac=document.createElement('div'); mac.className='mac'; mac.textContent=`${Math.round(it.Kcal)} kcal • P ${Math.round(it.Protein)}g • C ${Math.round(it.Carbs)}g • F ${Math.round(it.Fat)}g`; d.append(r1,dish,mac); return d; }
function dayCard(day){ const dm=state.week.get(day); const card=document.createElement('div'); card.className='day'; const h=document.createElement('div'); h.className='dayHeader'; h.textContent=day.toUpperCase(); card.appendChild(h); for(const mt of MEAL_ORDER){ const it=dm.get(mt); if(it) card.appendChild(mealRow(day,mt,it)); } const t=totals(dm); const f=document.createElement('div'); f.className='dayFooter'; f.textContent=`${Math.round(t.K)} kcal • P ${Math.round(t.P)}g • C ${Math.round(t.C)}g • F ${Math.round(t.F)}g`; card.appendChild(f); return card; }
function renderWeek(){ const root=$('#week'); root.innerHTML=''; for(const d of DAYS) root.appendChild(dayCard(d)); }

function renderIngredients(){ const buckets=new Map([['Breakfast',new Map()],['Lunch',new Map()],['Dinner',new Map()],['Snacks',new Map()]]); for(const d of DAYS){ const dm=state.week.get(d); for(const mt of MEAL_ORDER){ const it=dm.get(mt); if(!it) continue; const b=(mt==='Breakfast'||mt==='Lunch'||mt==='Dinner')?mt:'Snacks'; (it.Ingredients||'').split(';').map(s=>s.trim()).filter(Boolean).forEach(tok=>{ const m=buckets.get(b); m.set(tok,(m.get(tok)||0)+1); }); }} const root=$('#ingBuckets'); root.innerHTML=''; for(const [bucket,map] of buckets.entries()){ const div=document.createElement('div'); div.className='bucket'; const h=document.createElement('h3'); h.textContent=bucket; div.appendChild(h); const ul=document.createElement('ul'); for(const [name,count] of Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]))){ const li=document.createElement('li'); li.textContent=count>1?`${name} ×${count}`:name; ul.appendChild(li); } div.appendChild(ul); root.appendChild(div); } }

/* Picker */
let currentPick={day:null, mealType:null};
function openPicker(day,mt,it,evt){ currentPick={day,mealType:mt}; const list=$('#pickerList'), search=$('#pickerSearch'); const opts=(state.byType.get(mt)||[]); const renderList=(q='')=>{ list.innerHTML=''; opts.filter(o=>o.Name.toLowerCase().includes(q.toLowerCase())).forEach(o=>{ const li=document.createElement('li'); li.textContent=`${o.Name} — ${Math.round(o.Kcal)} kcal`; li.onclick=()=>{ const dm=state.week.get(day); dm.set(mt,o); closePicker(); renderAll(); persist(); }; list.appendChild(li); }); }; renderList(); search.value=''; search.oninput=()=>renderList(search.value); const picker=$('#picker'); picker.classList.remove('hidden'); $('#pickerClose').onclick=closePicker; picker.onclick=(e)=>{ if(e.target===picker) closePicker(); }; setTimeout(()=>search.focus(), 50); }
function closePicker(){ $('#picker').classList.add('hidden'); currentPick={day:null, mealType:null}; }

/* Theme */
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme-v5_1', t); $('#themeToggle').textContent=(t==='dark'?'🌙':'☀️'); }
function initTheme(){ const t=localStorage.getItem('theme-v5_1') || (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); applyTheme(t); }
function toggleTheme(){ const cur=document.documentElement.getAttribute('data-theme'); applyTheme(cur==='dark'?'light':'dark'); }

function renderAll(){ renderDailyBars(); renderWeek(); renderIngredients(); }

document.addEventListener('DOMContentLoaded', ()=>{ $('#printBtn').onclick=()=>window.print(); $('#regenBtn').onclick=()=>{ localStorage.removeItem('week-v5_1'); regenWeek(); }; $('#themeToggle').onclick=toggleTheme; initTheme(); });

(async function main(){ await loadMeals(); if(!state.all.length){ console.error('No meals available — check meals.csv'); return; } if(!tryLoad()) regenWeek(); else renderAll(); })();