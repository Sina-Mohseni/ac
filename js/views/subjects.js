/* ============================================================
   SUJETS — la matière de la Tour Hourglass
   Univers → Monde → Ère → Époque → Saga, chaque maillon tenant au
   précédent. L'élément se pose sur une époque et peut courir sur
   plusieurs sagas, en parallèle ou en série.
   ============================================================ */

import { listSubjects, getSubject, subjectPath, listScenarios } from '../db.js';
import { app, setHead } from '../ui.js';
import { esc } from '../utils.js';
import { S, SUBJECT_KINDS, subjectKind, childKind } from '../state.js';

const KIND_ICONS = {
  univers: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/>',
  monde: '<circle cx="12" cy="12" r="8"/><path d="M4.5 9h15M4.5 15h15"/><ellipse cx="12" cy="12" rx="4" ry="8"/>',
  ere: '<path d="M12 3v9l6 3"/><circle cx="12" cy="12" r="9"/>',
  epoque: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  saga: '<path d="M4 6h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"/>',
  element: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'
};

const icon = k => `<svg viewBox="0 0 24 24">${KIND_ICONS[k] || KIND_ICONS.element}</svg>`;

/* Fil d'Ariane de la chaîne ouverte. */
function trail(path) {
  return `<div class="crumbs"><a data-act="openSubject" data-id="">Sujets</a>` +
    path.map(x => `<span class="sep">›</span><a data-act="openSubject" data-id="${x.id}">${esc(x.name)}</a>`).join('') +
    `</div>`;
}

async function card(x, count, extra) {
  const K = subjectKind(x.kind);
  return `<div class="subj" data-act="openSubject" data-id="${x.id}" role="button" tabindex="0">
    <div class="subj-i">${icon(x.kind)}</div>
    <div class="subj-b">
      <div class="subj-k">${esc(K.one)}</div>
      <div class="subj-t">${esc(x.name)}</div>
      ${x.desc ? `<div class="subj-d">${esc(x.desc)}</div>` : ''}
      ${extra || ''}
    </div>
    ${count ? `<span class="subj-n">${count}</span>` : ''}
  </div>`;
}

export async function viewSubjects() {
  const cur = S.subjectId ? await getSubject(S.subjectId) : null;
  if (S.subjectId && !cur) S.subjectId = null;
  const path = cur ? await subjectPath(cur.id) : [];
  setHead('Sujets', cur ? path.map(x => x.name).join(' · ') : 'Univers, mondes, ères, époques, sagas, éléments');

  let h = trail(path);

  if (!cur) {
    /* racine : les univers */
    const univers = await listSubjects('univers', '');
    h += `<div class="row wrap" style="margin-bottom:12px">
      <div style="flex:1;min-width:160px"><h2 style="margin:0">Univers</h2>
      <div class="tiny muted">Le premier maillon : tout le reste en dépend.</div></div>
      <button class="btn-sm btn-ember" data-act="newSubject" data-kind="univers" data-parent="">+ Univers</button></div>`;
    if (!univers.length) {
      h += `<div class="empty card"><span class="disp">Aucun univers</span>
        Commence par un univers : ses mondes, leurs ères, leurs époques et leurs sagas viendront s'y accrocher.</div>`;
    } else {
      h += `<div class="subjlist">`;
      for (const x of univers) h += await card(x, (await listSubjects('monde', x.id)).length);
      h += `</div>`;
    }
    app().innerHTML = h;
    return;
  }

  const K = subjectKind(cur.kind);
  const next = childKind(cur.kind);

  /* la fiche du sujet ouvert */
  h += `<div class="card" style="margin-bottom:14px">
    <div class="row" style="align-items:flex-start;gap:14px">
      <div class="subj-i big">${icon(cur.kind)}</div>
      <div style="flex:1;min-width:0">
        <div class="subj-k">${esc(K.one)}</div>
        <h2 style="margin:2px 0 0;font-size:20px">${esc(cur.name)}</h2>
        ${cur.desc ? `<div class="small muted" style="margin-top:6px">${esc(cur.desc)}</div>` : ''}
      </div>
    </div>
    <div class="row wrap" style="margin-top:14px">
      <button class="btn-sm" data-act="editSubject" data-id="${cur.id}">Modifier</button>
      <button class="btn-sm btn-ghost" data-act="hall" data-t="scenario" data-subject="${cur.id}">Scénarios</button>
      <div class="sp"></div>
      <button class="btn-sm btn-ghost btn-danger" data-act="delSubjectAsk" data-id="${cur.id}">Supprimer</button>
    </div></div>`;

  /* le maillon suivant */
  if (next) {
    const kids = await listSubjects(next.key, cur.id);
    h += `<div class="row wrap" style="margin-bottom:12px">
      <div style="flex:1;min-width:160px"><h2 style="margin:0">${esc(next.many)}</h2>
      <div class="tiny muted">${esc(next.desc)}</div></div>
      <button class="btn-sm btn-ember" data-act="newSubject" data-kind="${next.key}" data-parent="${cur.id}">+ ${esc(next.one)}</button></div>`;
    if (kids.length) {
      h += `<div class="subjlist" style="margin-bottom:16px">`;
      for (const x of kids) {
        const after = childKind(x.kind);
        h += await card(x, after ? (await listSubjects(after.key, x.id)).length : 0);
      }
      h += `</div>`;
    } else {
      h += `<div class="card" style="margin-bottom:16px"><div class="small muted">Rien encore à ce niveau.</div></div>`;
    }
  }

  /* les éléments : ils se posent sur une époque, et courent sur des sagas */
  if (cur.kind === 'epoque' || cur.kind === 'saga') {
    const all_ = await listSubjects('element');
    const els = cur.kind === 'epoque'
      ? all_.filter(x => x.parentId === cur.id)
      : all_.filter(x => (x.sagaIds || []).includes(cur.id));
    const sagas = cur.kind === 'epoque' ? await listSubjects('saga', cur.id) : [];
    h += `<div class="row wrap" style="margin-bottom:12px">
      <div style="flex:1;min-width:160px"><h2 style="margin:0">Éléments</h2>
      <div class="tiny muted">${cur.kind === 'epoque'
        ? 'Posés sur cette époque ; chacun peut courir sur plusieurs sagas.'
        : 'Ceux qui traversent cette saga.'}</div></div>
      ${cur.kind === 'epoque'
        ? `<button class="btn-sm btn-ember" data-act="newSubject" data-kind="element" data-parent="${cur.id}">+ Élément</button>`
        : ''}</div>`;
    if (els.length) {
      h += `<div class="subjlist">`;
      for (const x of els) {
        const names = (x.sagaIds || []).length
          ? `<div class="subj-s">${(x.sagaIds || []).map(id => {
              const sg = sagas.find(y => y.id === id);
              return esc(sg ? sg.name : '');
            }).filter(Boolean).join(' · ')}</div>`
          : '';
        h += await card(x, 0, names);
      }
      h += `</div>`;
    } else {
      h += `<div class="card"><div class="small muted">Aucun élément ${cur.kind === 'epoque' ? 'sur cette époque' : 'dans cette saga'}.</div></div>`;
    }
  }

  /* les scénarios écrits pour ce sujet */
  const scs = await listScenarios(cur.id);
  if (scs.length) {
    h += `<div class="row" style="margin:16px 0 10px"><h2 style="margin:0">Scénarios</h2></div>
      <div class="card">` + scs.map(sc =>
      `<div class="reg" data-act="openScenario" data-id="${sc.id}" role="button" tabindex="0">
        <span class="rd">${(sc.beats || []).length}</span>
        <span class="rt">${esc(sc.name)}</span><span class="rs">›</span></div>`).join('') + `</div>`;
  }

  app().innerHTML = h;
}

export { SUBJECT_KINDS };
