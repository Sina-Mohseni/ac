/* ============================================================
   SCÉNARIO — la lifeline d'un sujet
   On choisit un sujet créé dans « Sujets », puis on écrit son
   scénario : une suite de moments, dans l'ordre.
   ============================================================ */

import { listSubjects, getSubject, subjectPath, listScenarios, getScenario } from '../db.js';
import { app, setHead, pickField } from '../ui.js';
import { esc } from '../utils.js';
import { S, subjectKind } from '../state.js';

/* Tous les sujets, à plat, avec leur chaîne — pour le choix. */
export async function subjectOptions() {
  const all_ = await listSubjects();
  const byId = {};
  all_.forEach(x => { byId[x.id] = x; });
  /* La chaîne des parents, sans le sujet lui-même. */
  const chain = x => {
    const parts = [];
    let cur = x.parentId ? byId[x.parentId] : null;
    while (cur) { parts.unshift(cur.name); cur = cur.parentId ? byId[cur.parentId] : null; }
    return parts.join(' · ');
  };
  return all_
    .sort((a, b) => chain(a).localeCompare(chain(b)))
    .map(x => ({ value: x.id, label: x.name, sub: `${subjectKind(x.kind).one} · ${chain(x)}` }));
}

export async function viewScenario() {
  const options = await subjectOptions();
  const sc = S.scenarioId ? await getScenario(S.scenarioId) : null;
  if (S.scenarioId && !sc) S.scenarioId = null;

  /* sujet courant : celui du scénario ouvert, sinon le dernier choisi */
  const subjId = sc ? sc.subjectId : S.subjectId;
  const subj = subjId ? await getSubject(subjId) : null;
  setHead('Scénario', sc ? sc.name : (subj ? subj.name : 'Choisis un sujet, écris sa lifeline'));

  if (!options.length) {
    app().innerHTML = `<div class="empty card"><span class="disp">Aucun sujet</span>
      Un scénario se pose sur un sujet. Passe par la salle Sujets pour en créer un.</div>`;
    return;
  }

  let h = `<div class="card" style="margin-bottom:14px">
    <h2>Sujet</h2>
    <div class="small muted" style="margin-bottom:10px">Le scénario raconte la vie de ce sujet.</div>` +
    pickField({ id: 'scSubject', value: subjId || '', act: 'pickScenarioSubject',
      placeholder: 'Choisir un sujet…', options }) + `</div>`;

  if (!subj) { app().innerHTML = h; return; }

  const path = await subjectPath(subj.id);
  const scs = await listScenarios(subj.id);

  h += `<div class="row wrap" style="margin-bottom:12px">
    <div style="flex:1;min-width:160px"><h2 style="margin:0">Scénarios</h2>
    <div class="tiny muted">${esc(path.map(x => x.name).join(' · '))}</div></div>
    <button class="btn-sm btn-ember" data-act="newScenario" data-subject="${subj.id}">+ Scénario</button></div>`;

  if (!scs.length) {
    h += `<div class="empty card"><span class="disp">Aucun scénario</span>
      Écris la lifeline de ${esc(subj.name)} : une suite de moments, dans l'ordre.</div>`;
    app().innerHTML = h;
    return;
  }

  h += `<div class="card" style="margin-bottom:14px">` + scs.map(x =>
    `<div class="reg${sc && sc.id === x.id ? ' on' : ''}" data-act="openScenario" data-id="${x.id}" role="button" tabindex="0">
      <span class="rd">${(x.beats || []).length}</span>
      <span class="rt">${esc(x.name)}</span>
      <span class="rs">${x.beats && x.beats.length ? 'moments' : 'vide'}</span></div>`).join('') + `</div>`;

  if (!sc) { app().innerHTML = h; return; }

  /* la lifeline du scénario ouvert */
  h += `<div class="row wrap" style="margin-bottom:12px">
    <div style="flex:1;min-width:160px"><h2 style="margin:0">${esc(sc.name)}</h2>
    <div class="tiny muted">La lifeline : ce qui arrive, dans l'ordre.</div></div>
    <button class="btn-sm" data-act="editScenario" data-id="${sc.id}">Modifier</button>
    <button class="btn-sm btn-ember" data-act="newBeat" data-id="${sc.id}">+ Moment</button></div>`;

  if (sc.desc) h += `<div class="card" style="margin-bottom:12px"><div class="small">${esc(sc.desc)}</div></div>`;

  if (!(sc.beats || []).length) {
    h += `<div class="empty card"><span class="disp">Lifeline vide</span>
      Pose un premier moment : une scène, une bascule, une rencontre.</div>`;
  } else {
    h += `<div class="life">`;
    sc.beats.forEach((b, i) => {
      h += `<div class="beat">
        <div class="beat-n">${i + 1}</div>
        <div class="beat-b">
          <div class="beat-t">${esc(b.title)}</div>
          ${b.text ? `<div class="beat-d">${esc(b.text)}</div>` : ''}
          <div class="row wrap" style="margin-top:8px">
            <button class="btn-sm btn-ghost" data-act="editBeat" data-id="${sc.id}" data-i="${i}">Modifier</button>
            <button class="btn-sm btn-ghost" data-act="moveBeat" data-id="${sc.id}" data-i="${i}" data-d="-1">▲</button>
            <button class="btn-sm btn-ghost" data-act="moveBeat" data-id="${sc.id}" data-i="${i}" data-d="1">▼</button>
            <div class="sp"></div>
            <button class="btn-sm btn-ghost btn-danger" data-act="delBeat" data-id="${sc.id}" data-i="${i}">Retirer</button>
          </div>
        </div></div>`;
    });
    h += `</div>`;
  }

  h += `<div class="row wrap" style="margin-top:14px">
    <button class="btn-sm btn-ghost" data-act="hall" data-t="gates" data-scenario="${sc.id}">Vivre ce scénario</button>
    <div class="sp"></div>
    <button class="btn-sm btn-ghost btn-danger" data-act="delScenarioAsk" data-id="${sc.id}">Supprimer le scénario</button>
  </div>`;

  app().innerHTML = h;
}
