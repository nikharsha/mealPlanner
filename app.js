// === Weekly Planner v5.2 — Adds Consumed Checkboxes + Per-Day Macro Bars ===

// constants
const MEAL_ORDER = ['Early Morning','Breakfast','Mid-Morning','Lunch','Evening Snack','Dinner','Bedtime'];
const MEAL_EMOJI = new Map([
  ['Early Morning','🌅'],['Breakfast','🍳'],['Mid-Morning','🥛'],
  ['Lunch','🍲'],['Evening Snack','🍎'],['Dinner','🥗'],['Bedtime','🌙']
]);
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TARGET = { kcalMax:1650, P:80, C:170, F:50 };

const state = { all:[], byType:new Map(), week:new Map() };
const $ = s => document.querySelector(s);

// parse csv
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

// load meals
async function loadMeals(){
  const url=new URL('meals.csv', window.location.href);
  const res=await fetch(url);
  const t=await res.text();
  const rows=parseCSV(t);
  state.all=rows;
  state.byType=new Map();
  for(const r of rows){
    if(!state.byType.has(r.MealType)) state.byType.set(r.MealType,[]);
    state.byType.get(r.MealType).push(r);
  }
  console.log(`✅ Loaded ${rows.length} meals across ${state.byType.size} types.`);
}

// helpers
function pick(a){ return a[Math.floor(Math.random()*a.length)] }
function randomDay(){
  const m=new Map();
  for(const mt of MEAL_ORDER){
    const opts=state.byType.get(mt)||[];
    if(opts.length) m.set(mt, { item: pick(opts), consumed: false });
  }
  return m;
}
function totals(dm){
  let P=0,C=0,F=0,K=0;
  for(const mt of MEAL_ORDER){
    const obj=dm.get(mt);
    if(!obj) continue;
    const it=obj.item;
    if(!it) continue;
    P+=it.Protein; C+=it.Carbs; F+=it.Fat; K+=it.Kcal;
  }
  return {P,C,F,K};
}
function consumedTotals(dm){
  let P=0,C=0,F=0,K=0;
  for(const mt of MEAL_ORDER){
    const obj=dm.get(mt);
    if(!obj || !obj.consumed) continue;
    const it=obj.item;
    P+=it.Protein; C+=it.Carbs; F+=it.Fat; K+=it.Kcal;
  }
  return {P,C,F,K};
}

function renderDailyBars() {
  const root = $('#dailyBars');
  if (!root) return;
  root.innerHTML = '';

  for (const d of DAYS) {
    const dm = state.week.get(d);
    if (!dm) continue;

    const plan = totals(dm);
    const done = consumedTotals(dm);

    const div = document.createElement('div');
    div.className = 'daySummaryTile cardStyle';
    div.innerHTML = `
      <div class="daySummaryHeader">
        <strong>${d}</strong>
        <span>${Math.round(done.K)} / ${Math.round(plan.K)} kcal</span>
      </div>
      <div class="macroBarsWrap">
        <div class="macroBar calories">
          <div class="macroLabel">Calories: ${Math.round(done.K)} / ${Math.round(plan.K)} kcal</div>
          <div class="progress"><span style="width:${Math.min(100, (done.K/(plan.K||1))*100)}%"></span></div>
        </div>
        <div class="macroBar protein">
          <div class="macroLabel">Protein: ${Math.round(done.P)} / ${Math.round(plan.P)} g</div>
          <div class="progress"><span style="width:${Math.min(100, (done.P/(plan.P||1))*100)}%"></span></div>
        </div>
        <div class="macroBar carbs">
          <div class="macroLabel">Carbs: ${Math.round(done.C)} / ${Math.round(plan.C)} g</div>
          <div class="progress"><span style="width:${Math.min(100, (done.C/(plan.C||1))*100)}%"></span></div>
        </div>
        <div class="macroBar fats">
          <div class="macroLabel">Fat: ${Math.round(done.F)} / ${Math.round(plan.F)} g</div>
          <div class="progress"><span style="width:${Math.min(100, (done.F/(plan.F||1))*100)}%"></span></div>
        </div>
      </div>
    `;
    root.appendChild(div);
  }
}


function persist(){
  const o={};
  for(const d of DAYS){
    const dm=state.week.get(d);
    o[d]={};
    for(const mt of MEAL_ORDER){
      const obj=dm.get(mt)||{};
      o[d][mt]={ name:obj.item?.Name||null, consumed:!!obj.consumed };
    }
  }
  localStorage.setItem('week-v5_2', JSON.stringify(o));
}
function tryLoad(){
  const raw=localStorage.getItem('week-v5_2'); if(!raw) return false;
  try{
    const o=JSON.parse(raw); state.week=new Map();
    for(const d of DAYS){
      const dm=new Map();
      for(const mt of MEAL_ORDER){
        const name=o?.[d]?.[mt]?.name;
        const consumed=o?.[d]?.[mt]?.consumed;
        const found=(state.byType.get(mt)||[]).find(x=>x.Name===name) || (state.byType.get(mt)||[])[0];
        if(found) dm.set(mt,{item:found,consumed});
      }
      state.week.set(d,dm);
    }
    return true;
  }catch(e){ console.warn('restore failed',e); return false; }
}
function regenWeek(){
  state.week=new Map();
  for(const d of DAYS) state.week.set(d, randomDay());
  renderAll(); persist();
}

// ===== Rendering =====

function makeBar(label, val, max, colorVar){
  const pct=Math.min(100,(val/max)*100);
  const div=document.createElement('div');
  div.className='macroBar';
  div.innerHTML=`
    <div class="macroLabel">${label}: ${Math.round(val)} / ${max}${label==='Calories'?' kcal':' g'}</div>
    <div class="progress" style="background:var(--bar-bg)">
      <span style="width:${pct}%;background:var(${colorVar})"></span>
    </div>`;
  return div;
}

function dayBars(dayMap){
  const plan=totals(dayMap);
  const done=consumedTotals(dayMap);
  const wrap=document.createElement('div');
  wrap.className='macroBarsWrap';
  wrap.appendChild(makeBar('Calories',done.K,plan.K||TARGET.kcalMax,'--k'));
  wrap.appendChild(makeBar('Protein',done.P,plan.P||TARGET.P,'--p'));
  wrap.appendChild(makeBar('Carbs',done.C,plan.C||TARGET.C,'--c'));
  wrap.appendChild(makeBar('Fat',done.F,plan.F||TARGET.F,'--f'));
  return wrap;
}

function mealRow(day, mt, obj){
  const it=obj.item;
  const d=document.createElement('div');
  d.className='meal';
  const r1=document.createElement('div');
  r1.className='row1';

  // checkbox
  const cb=document.createElement('input');
  cb.type='checkbox';
  cb.checked=!!obj.consumed;
  cb.className='consumeBox';
  cb.onchange=()=>{
    obj.consumed=cb.checked;
    renderAll();
    persist();
  };

  // title
  const title=document.createElement('div');
  title.className='mTitle';
  title.innerHTML=`${MEAL_EMOJI.get(mt)||'•'} <span>${mt}</span>`;

  // edit
  const edit=document.createElement('button');
  edit.className='iconBtn edit';
  edit.textContent='✏️';
  edit.onclick=(e)=>openPicker(day,mt,it,e);

  r1.append(cb,title,edit);
  const dish=document.createElement('div'); dish.className='dish'; dish.textContent=it.Name;
  const mac=document.createElement('div'); mac.className='mac';
  mac.textContent=`${Math.round(it.Kcal)} kcal • P ${Math.round(it.Protein)}g • C ${Math.round(it.Carbs)}g • F ${Math.round(it.Fat)}g`;
  d.append(r1,dish,mac);
  return d;
}

function dayCard(day){
  const dm=state.week.get(day);
  const card=document.createElement('div');
  card.className='day';
  const h=document.createElement('div');
  h.className='dayHeader'; h.textContent=day.toUpperCase();
  card.appendChild(h);

  // macro bars
  //card.appendChild(dayBars(dm));

  for(const mt of MEAL_ORDER){
    const obj=dm.get(mt); if(obj) card.appendChild(mealRow(day,mt,obj));
  }
  const t=totals(dm);
  const f=document.createElement('div');
  f.className='dayFooter';
  f.textContent=`${Math.round(t.K)} kcal • P ${Math.round(t.P)}g • C ${Math.round(t.C)}g • F ${Math.round(t.F)}g`;
  card.appendChild(f);
  return card;
}

function renderWeek(){
  const root=$('#week'); root.innerHTML='';
  for(const d of DAYS) root.appendChild(dayCard(d));
}

function renderIngredients() {
  const buckets = new Map([
    ['Breakfast', new Map()],
    ['Lunch', new Map()],
    ['Dinner', new Map()],
    ['Snacks', new Map()],
  ]);

  for (const d of DAYS) {
    const dm = state.week.get(d);
    if (!dm) continue;

    for (const mt of MEAL_ORDER) {
      const obj = dm.get(mt);
      if (!obj || !obj.item) continue;
      const it = obj.item;

      // classify buckets
      let bucket = 'Snacks';
      if (mt === 'Breakfast') bucket = 'Breakfast';
      else if (mt === 'Lunch') bucket = 'Lunch';
      else if (mt === 'Dinner') bucket = 'Dinner';

      (it.Ingredients || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(tok => {
          const m = buckets.get(bucket);
          m.set(tok, (m.get(tok) || 0) + 1);
        });
    }
  }

  const root = $('#ingBuckets');
  root.innerHTML = '';

  for (const [bucket, map] of buckets.entries()) {
    const div = document.createElement('div');
    div.className = 'bucket';
    const h = document.createElement('h3');
    h.textContent = bucket;
    div.appendChild(h);

    const ul = document.createElement('ul');
    for (const [name, count] of Array.from(map.entries()).sort(
      (a, b) => a[0].localeCompare(b[0])
    )) {
      const li = document.createElement('li');
      li.textContent = count > 1 ? `${name} ×${count}` : name;
      ul.appendChild(li);
    }

    div.appendChild(ul);
    root.appendChild(div);
  }
}


// picker unchanged
let currentPick={day:null,mealType:null};
function openPicker(day,mt,it,evt){
  currentPick={day,mealType:mt};
  const list=$('#pickerList'); const search=$('#pickerSearch');
  list.innerHTML=''; search.value='';
  const opts=(state.byType.get(mt)||[]);
  const renderList=(q='')=>{
    list.innerHTML='';
    opts.filter(o=>o.Name.toLowerCase().includes(q.toLowerCase())).forEach(o=>{
      const li=document.createElement('li');
      li.textContent=`${o.Name} — ${Math.round(o.Kcal)} kcal`;
      li.onclick=()=>{
        const dm=state.week.get(day);
        dm.set(mt,{item:o,consumed:false});
        closePicker(); renderAll(); persist();
      };
      list.appendChild(li);
    });
  };
  renderList();
  search.oninput=()=>renderList(search.value);
  const picker=$('#picker'); picker.classList.remove('hidden');
  $('#pickerClose').onclick=closePicker;
  picker.onclick=(e)=>{ if(e.target===picker) closePicker(); };
  setTimeout(()=>search.focus(),50);
}
function closePicker(){ $('#picker').classList.add('hidden'); currentPick={day:null,mealType:null}; }

// theme toggle unchanged
function applyTheme(t){ document.documentElement.setAttribute('data-theme',t); localStorage.setItem('theme-v5_2-theme',t); $('#themeToggle').textContent=(t==='dark'?'🌙':'☀️'); }
function initTheme(){ const t=localStorage.getItem('theme-v5_2-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); applyTheme(t); }
function toggleTheme(){ const cur=document.documentElement.getAttribute('data-theme'); applyTheme(cur==='dark'?'light':'dark'); }

function renderAll() {
  renderDailyBars();   // ✅ add this back
  renderWeek();
  renderIngredients();
}

document.addEventListener('DOMContentLoaded',()=>{
  $('#printBtn').onclick=()=>window.print();
  $('#regenBtn').onclick=()=>{ localStorage.removeItem('week-v5_2'); regenWeek(); };
  $('#themeToggle').onclick=toggleTheme;
  initTheme();
});

(async function main(){
  await loadMeals();
  if(!state.all.length){ console.error('No meals available'); return; }
  if(!tryLoad()) regenWeek(); else renderAll();
})();
