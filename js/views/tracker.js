import { all, groupTreeIds } from '../db.js';
import { app, setHead, setStage } from '../ui.js';
import { esc, today } from '../utils.js';
import { S, houseByKey } from '../state.js';
import { vaultHTML } from './pages.js';
import { libraryHTML } from './library.js';

const TABS = {
  library: ['Bibliothèque', 'Histoires · Jeux · Expo'],
  cal: ['Calendrier', 'Jalons et échéances'],
  goals: ['Quêtes', 'Objectifs en cours'],
  vault: ['Coffre', 'Fichiers bruts et stockage']
};

/* Les salles d'une maison ne montrent que ce qui la concerne : les jalons
   et les quêtes de sa branche. Le Coffre reste commun — les fichiers sont
   un seul stock. */
export async function houseScope() {
  const H = houseByKey(S.houseKey);
  if (!H.rootId) return { H, ids: null };
  const groups = await groupTreeIds(H.rootId);
  const projects = (await all('projects')).filter(p => groups.includes(p.groupId)).map(p => p.id);
  return { H, ids: projects };
}

export const inScope = (x, ids) => !ids || (x.projectId && ids.includes(x.projectId));

export async function viewTracker() {
  const meta = TABS[S.trackTab] || TABS.library;
  const H = houseByKey(S.houseKey);
  setHead(meta[0], `${H.nav} · ${meta[1]}`);
  await setStage(null);

  let h = `<div class="row wrap" style="margin-bottom:12px">
      <button class="btn-sm btn-ghost" data-act="go" data-view="${H.view}">‹ ${esc(H.nav)}</button>
      <div class="sp"></div>
      <span class="tiny muted">${esc(meta[1])}</span></div>`;
  h += S.trackTab === 'library' ? await libraryHTML()
    : (S.trackTab === 'cal' ? await htmlCal() : (S.trackTab === 'goals' ? await htmlGoals() : await vaultHTML()));
  app().innerHTML = h;
}

async function htmlCal() {
  const d = S.calMonth, y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));

  const { ids } = await houseScope();
  const items = (await all('cal')).filter(x => inScope(x, ids));
  const projects = await all('projects');
  const pMap = {};
  projects.forEach(p => { pMap[p.id] = p; });

  const MN = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
    'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  let h = `<div class="row" style="margin-bottom:10px">
      <button class="btn-sm btn-ghost" data-act="calMove" data-d="-1">‹</button>
      <h2 style="margin:0;flex:1;text-align:center">${MN[m]} ${y}</h2>
      <button class="btn-sm btn-ghost" data-act="calMove" data-d="1">›</button></div>
    <div class="card"><div class="cal">` +
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="dow">${x}</div>`).join('');

  const now = new Date().toDateString();
  for (let i = 0; i < 42; i++) {
    const c = new Date(start);
    c.setDate(start.getDate() + i);
    const key = c.toISOString().slice(0, 10);
    const dayItems = items.filter(x => x.date === key);
    h += `<div class="day${c.getMonth() !== m ? ' out' : ''}${c.toDateString() === now ? ' today' : ''}"
      data-act="calDay" data-date="${key}">${c.getDate()}
      <div class="dots">${dayItems.slice(0, 6).map(x =>
        `<span class="dot" style="background:${x.done ? 'var(--ok)' : 'var(--ember)'}"></span>`).join('')}</div></div>`;
  }
  h += `</div></div><div style="height:12px"></div>`;

  const up = items.filter(x => x.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  h += `<div class="card"><h2>À venir</h2>`;
  if (!up.length) h += `<div class="tiny muted">Rien de prévu. Touche un jour pour poser un jalon.</div>`;
  up.forEach(x => {
    h += `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)" data-act="calEdit" data-id="${x.id}">
      <span class="mono tiny" style="width:70px;color:var(--ember)">${x.date.slice(8)}/${x.date.slice(5, 7)}</span>
      <span class="small" style="flex:1">${esc(x.title)}${x.projectId && pMap[x.projectId]
        ? `<span class="tiny muted"> · ${esc(pMap[x.projectId].name)}</span>` : ''}</span>
      <span class="tiny">${x.done ? '✓' : ''}</span></div>`;
  });
  return h + `</div>`;
}

async function htmlGoals() {
  const { ids } = await houseScope();
  const gs = (await all('goals')).filter(x => inScope(x, ids))
    .sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
  const ps = await all('projects');
  const pMap = {};
  ps.forEach(p => { pMap[p.id] = p; });

  let h = `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">Quêtes</h2><div class="sp"></div>
    <button class="btn-ember btn-sm" data-act="newGoal">+ Quête</button></div>`;
  if (!gs.length) {
    h += `<div class="empty card"><span class="disp">Aucune quête</span>
      Fixe un objectif chiffré ou une liste d'étapes, et suis ta progression.</div>`;
  }
  gs.forEach(g => {
    const pct = g.type === 'steps'
      ? ((g.steps && g.steps.length) ? g.steps.filter(s => s.done).length / g.steps.length * 100 : 0)
      : Math.min(100, (g.current || 0) / (g.target || 1) * 100);
    h += `<div class="card" style="margin-bottom:10px" data-act="openGoal" data-id="${g.id}">
      <div class="row"><h3 style="flex:1">${esc(g.title)}</h3>
      <span class="mono tiny" style="color:var(--ember)">${Math.round(pct)}%</span></div>
      <div class="tiny muted" style="margin:2px 0 8px">
      ${g.projectId && pMap[g.projectId] ? esc(pMap[g.projectId].name) + ' · ' : ''}
      ${g.deadline ? 'échéance ' + g.deadline : 'sans échéance'}
      ${g.type === 'count'
        ? ` · ${g.current || 0}/${g.target || 0} ${esc(g.unit || '')}`
        : ` · ${(g.steps || []).filter(s => s.done).length}/${(g.steps || []).length} étapes`}
      </div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  });
  return h;
}
