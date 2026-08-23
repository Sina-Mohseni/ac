/* ============================================================
   EYE et GATES — vivre un scénario
   Gates : on choisit le scénario. Eye : le sort le choisit.
   Dans les deux cas, on entre avec un persona joué par soi et un
   ou plusieurs personas tenus par l'IA — pris parmi les personas
   de la guilde et parmi les sujets de la Tour.
   ============================================================ */

import {
  listScenarios, getScenario, getSubject, subjectPath, listSubjects,
  listPersonas, getActivePersona, putSession, getSession
} from '../db.js';
import { app, setHead, pickField } from '../ui.js';
import { esc } from '../utils.js';
import { S, subjectKind, roleOf, isAI } from '../state.js';

/* Les figures jouables : les personas de la guilde, et les éléments
   de la Tour — un élément peut très bien tenir un rôle. */
export async function castOptions() {
  const personas = await listPersonas();
  const els = await listSubjects('element');
  const byId = {};
  (await listSubjects()).forEach(x => { byId[x.id] = x; });
  /* La chaîne des parents, sans le sujet lui-même. */
  const chain = x => {
    const parts = [];
    let cur = x.parentId ? byId[x.parentId] : null;
    while (cur) { parts.unshift(cur.name); cur = cur.parentId ? byId[cur.parentId] : null; }
    return parts.join(' · ');
  };
  return [
    ...personas.map(c => ({
      value: 'p:' + c.id, label: c.name || 'Sans nom',
      sub: roleOf(c.role)[3], kind: 'persona', role: c.role
    })),
    ...els.map(x => ({
      value: 's:' + x.id, label: x.name,
      sub: `${subjectKind(x.kind).one} · ${chain(x)}`, kind: 'sujet'
    }))
  ];
}

export const castLabel = (opts, value) => {
  const o = opts.find(x => x.value === value);
  return o ? o.label : '—';
};

/* ---------- l'écran d'entrée, commun à Eye et Gates ---------- */
export async function viewLive(mode) {
  const isEye = mode === 'eye';
  const all_ = await listScenarios();
  const playable = all_.filter(sc => (sc.beats || []).length);
  const opts = await castOptions();

  setHead(isEye ? 'Eye' : 'Gates',
    isEye ? 'Un scénario tiré au sort' : 'Le scénario de ton choix');

  if (!playable.length) {
    app().innerHTML = `<div class="empty card"><span class="disp">Aucun scénario à vivre</span>
      Un scénario se vit dès qu'il porte au moins un moment. Passe par la salle Scénario pour en écrire un.</div>`;
    return;
  }
  if (!opts.length) {
    app().innerHTML = `<div class="empty card"><span class="disp">Personne pour entrer en scène</span>
      Crée un persona dans la page Personas, ou un élément dans la salle Sujets.</div>`;
    return;
  }

  /* scénario retenu */
  let scId = S.liveScenarioId;
  if (isEye && !S.liveScenarioId) scId = null;
  if (scId && !playable.some(x => x.id === scId)) scId = null;
  const sc = scId ? await getScenario(scId) : null;

  const subj = sc ? await getSubject(sc.subjectId) : null;
  const path = subj ? await subjectPath(subj.id) : [];

  let h = '';

  if (isEye) {
    h += `<div class="card" style="margin-bottom:14px">
      <h2>Le sort choisit</h2>
      <div class="small muted">Eye ouvre un scénario au hasard parmi ceux qui portent des moments.
      ${playable.length} scénario${playable.length !== 1 ? 's' : ''} en jeu.</div>
      <div class="row wrap" style="margin-top:12px">
        <button class="btn-sm btn-ember" data-act="rollScenario">${sc ? 'Retirer au sort' : 'Tirer un scénario'}</button>
        ${sc ? `<button class="btn-sm btn-ghost" data-act="clearLiveScenario">Effacer</button>` : ''}
      </div></div>`;
  } else {
    h += `<div class="card" style="margin-bottom:14px">
      <h2>Scénario</h2>
      <div class="small muted" style="margin-bottom:10px">Choisis celui que tu veux vivre.</div>` +
      pickField({
        id: 'liveScenario', value: scId || '', act: 'pickLiveScenario', placeholder: 'Choisir un scénario…',
        options: await Promise.all(playable.map(async x => {
          const s2 = await getSubject(x.subjectId);
          return { value: x.id, label: x.name, sub: s2 ? s2.name : '' };
        }))
      }) + `</div>`;
  }

  if (!sc) { app().innerHTML = h; return; }

  h += `<div class="card" style="margin-bottom:14px">
    <div class="frt">Scénario retenu</div>
    <h2 style="margin:0 0 4px">${esc(sc.name)}</h2>
    <div class="tiny muted">${esc(path.map(x => x.name).join(' · ') || '—')} ·
      ${(sc.beats || []).length} moment${(sc.beats || []).length !== 1 ? 's' : ''}</div>
    ${sc.desc ? `<div class="small" style="margin-top:8px">${esc(sc.desc)}</div>` : ''}</div>`;

  /* la distribution */
  const cast = S.liveCast || { user: '', ai: [] };
  h += `<div class="card" style="margin-bottom:14px">
    <h2>Qui entre en scène</h2>
    <div class="small muted" style="margin-bottom:10px">Toi d'abord, puis celles et ceux que l'IA tiendra.
    Personas de la guilde et éléments de la Tour sont ouverts aux deux.</div>

    <label class="lbl">Ton persona</label>` +
    pickField({
      id: 'liveUser', value: cast.user || '', act: 'pickLiveUser',
      placeholder: 'Choisir ta figure…', options: opts
    }) + `

    <label class="lbl">Tenus par l'IA</label>
    <div class="chips" role="group" aria-label="Personas tenus par l'IA">` +
    opts.filter(o => o.value !== cast.user).map(o =>
      `<span class="chip${(cast.ai || []).includes(o.value) ? ' on' : ''}" data-act="toggleLiveAi" data-v="${o.value}"
        role="button" tabindex="0" title="${esc(o.sub)}">${esc(o.label)}</span>`).join('') +
    `</div>
    <div class="fnote" style="margin-top:8px">Plusieurs peuvent tenir la scène en même temps.</div>
    </div>`;

  const ready = cast.user && (cast.ai || []).length;
  h += `<div class="row wrap">
    <button class="btn-ember" data-act="startLive" data-mode="${mode}"${ready ? '' : ' disabled'}>Entrer en scène</button>
    <div class="sp"></div>
    ${ready ? '' : `<span class="tiny muted">Choisis ta figure et au moins un persona tenu par l'IA.</span>`}
  </div>`;

  app().innerHTML = h;
}

/* ---------- la scène elle-même ---------- */
export async function viewSession() {
  const ses = S.sessionId ? await getSession(S.sessionId) : null;
  if (!ses) { S.view = 'gates'; return viewLive('gates'); }
  const sc = await getScenario(ses.scenarioId);
  const opts = await castOptions();
  setHead(ses.mode === 'eye' ? 'Eye' : 'Gates', sc ? sc.name : 'Scène');

  const beats = (sc && sc.beats) || [];
  const at = Math.min(ses.beat || 0, Math.max(0, beats.length - 1));

  let h = `<div class="row wrap" style="margin-bottom:12px">
    <button class="btn-sm btn-ghost" data-act="hall" data-t="${ses.mode}">‹ Sortir</button>
    <div class="sp"></div>
    <span class="tiny muted">${esc(castLabel(opts, ses.user))} ·
      ${(ses.ai || []).map(v => esc(castLabel(opts, v))).join(', ')}</span></div>`;

  h += `<div class="card" style="margin-bottom:14px">
    <div class="frt">Moment ${at + 1} sur ${beats.length}</div>
    <h2 style="margin:0 0 6px">${esc(beats[at] ? beats[at].title : '—')}</h2>
    ${beats[at] && beats[at].text ? `<div class="small">${esc(beats[at].text)}</div>` : ''}
    <div class="row wrap" style="margin-top:14px">
      <button class="btn-sm btn-ghost" data-act="liveStep" data-d="-1"${at ? '' : ' disabled'}>‹ Moment</button>
      <button class="btn-sm btn-ghost" data-act="liveStep" data-d="1"${at < beats.length - 1 ? '' : ' disabled'}>Moment ›</button>
    </div></div>`;

  /* le fil de la scène */
  h += `<div class="card" style="margin-bottom:14px"><div class="frt">La scène</div>`;
  if (!(ses.log || []).length) {
    h += `<div class="fnote">Rien encore. Écris ce que fait ou dit ${esc(castLabel(opts, ses.user))} :
      les personas tenus par l'IA répondront, s'ils ont un moteur configuré dans les Paramètres.</div>`;
  } else {
    h += `<div class="scene">` + ses.log.map(l =>
      `<div class="line ${l.who === 'user' ? 'me' : 'them'}">
        <div class="line-w">${esc(l.name)}</div>
        <div class="line-t">${esc(l.text)}</div></div>`).join('') + `</div>`;
  }
  h += `</div>`;

  h += `<div class="card">
    <label class="lbl" for="liveSay">Ce que tu fais, ce que tu dis</label>
    <textarea id="liveSay" rows="3" placeholder="J'ouvre la porte, la voix basse…"></textarea>
    <div class="row wrap" style="margin-top:10px">
      <button class="btn-sm btn-ember" data-act="liveSay">Jouer</button>
      <div class="sp"></div>
      <button class="btn-sm btn-ghost btn-danger" data-act="endLive">Clore la scène</button>
    </div></div>`;

  app().innerHTML = h;
}

export const viewEye = () => viewLive('eye');
export const viewGates = () => viewLive('gates');
