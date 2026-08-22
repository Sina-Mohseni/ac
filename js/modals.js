import { get, all, byIdx, assetURL, childGroups, groupPath, rootForGroup, isRootGroup } from './db.js';
import { modal } from './ui.js';
import { esc, uid, fmtSize, fmtT2 } from './utils.js';
import { S, CATS, ROOTS, rootInfo } from './state.js';
import { globalTime } from './player.js';

/* brouillons courants, partagés avec actions.js */
export const D = {
  group: null, project: null, projectRootId: null,
  event: null, element: null, cal: null, goal: null, guild: null
};

const closeBtn = '<div class="sp"></div><button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button>';

/* ---------- groupe / sous-groupe ---------- */
export async function mGroup(id, parentId) {
  const g = id ? await get('groups', id) : { id: uid(), name: '', desc: '', parentId: parentId || '', at: Date.now() };
  D.group = g;
  const isRoot = !!(g && g.systemRoot && isRootGroup(g.id));
  const cov = await assetURL(g.coverAssetId);
  const bg = await assetURL(g.bgAssetId);
  const path = g.parentId ? await groupPath(g.parentId) : [];
  const level = path.length + 1;

  modal(`<div class="hd"><h2 style="margin:0">${isRoot ? 'Personnaliser la branche' : (id ? 'Réglages' : (level === 2 ? 'Nouvelle catégorie' : 'Nouvelle sous-catégorie'))}</h2>${closeBtn}</div>
    <div class="tiny muted">${path.length ? 'Dans : ' + path.map(x => esc(x.name)).join(' › ') + ' · ' : ''}${isRoot ? 'branche racine fixe' : 'niveau ' + Math.max(1, level - 1)}</div>
    <label class="lbl">Titre</label>
    <input id="gName" value="${esc(g.name)}" placeholder="SAGA COSMOS"${isRoot ? ' readonly' : ''}>
    <label class="lbl">Description</label>
    <textarea id="gDesc" rows="4" placeholder="L'idée commune, le ton, le public visé…">${esc(g.desc || '')}</textarea>
    <label class="lbl">Vignette</label>
    <div class="row"><button class="btn-sm" data-act="pickGCover">Choisir un fichier</button>
    <span class="tiny muted">${cov ? 'définie' : 'aucune'}</span></div>
    <label class="lbl">Fond plein écran</label>
    <div class="row"><button class="btn-sm" data-act="pickGBg">Choisir un fichier</button>
    <span class="tiny muted">${bg ? 'défini' : 'aucun'}</span></div>
    <div class="tiny muted" style="margin-top:6px">${isRoot
      ? 'Le nom et la position de cette branche sont fixes. Son visuel et sa description restent personnalisables.'
      : 'La playlist d\'idées et les projets s\'ajoutent depuis la page de cette catégorie.'}</div>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveGroup" data-new="${id ? 0 : 1}">Enregistrer</button>
    <div class="sp"></div>
    ${id && !isRoot ? `<button class="btn-sm btn-ghost btn-danger" data-act="delGroup" data-id="${g.id}">Supprimer</button>` : ''}</div>`);
}

/* ---------- projet ---------- */
export async function mProject(id, groupId, requestedRootId) {
  const current = id ? await get('projects', id) : null;
  const inferredRoot = current ? await rootForGroup(current.groupId) : await rootForGroup(groupId || requestedRootId);
  const root = rootInfo(requestedRootId) || (inferredRoot && rootInfo(inferredRoot.id)) || ROOTS[0];
  const p = current || {
    id: uid(), name: '', kind: root.singular, groupId: groupId || root.id, at: Date.now(), pipeline: {}
  };
  D.project = p;
  D.projectRootId = root.id;
  const cov = await assetURL(p.coverAssetId);
  const bg = await assetURL(p.bgAssetId);

  /* liste à plat de la branche choisie, indentée par profondeur */
  const flat = [];
  const walk = async (parent, depth) => {
    for (const g of await childGroups(parent)) {
      flat.push({ g, depth });
      await walk(g.id, depth + 1);
    }
  };
  const rootGroup = await get('groups', root.id);
  if (rootGroup) {
    flat.push({ g: rootGroup, depth: 0 });
    await walk(root.id, 1);
  }

  modal(`<div class="hd"><h2 style="margin:0">${id ? 'Réglages du projet' : 'Nouveau projet'}</h2>${closeBtn}</div>
    <div class="tiny muted">Branche : <span style="color:var(--ember)">${esc(root.name)}</span></div>
    <label class="lbl">Titre</label>
    <input id="fName" value="${esc(p.name)}" placeholder="Le Serment du Gardien">
    <label class="lbl">Type</label>
    <input id="fKind" value="${esc(p.kind || '')}" placeholder="Clip · Ciné-spectacle · Saga">
    <label class="lbl">Rattachement</label>
    <select id="fGroup">
    ${flat.map(f => `<option value="${f.g.id}"${f.g.id === p.groupId ? ' selected' : ''}>${'· '.repeat(f.depth)}${esc(f.g.name)}</option>`).join('')}
    </select>
    <label class="lbl">Vignette</label>
    <div class="row"><button class="btn-sm" data-act="pickCover">Choisir un fichier</button>
    <span class="tiny muted">${cov ? 'définie' : 'aucune'}</span></div>
    <label class="lbl">Fond plein écran</label>
    <div class="row"><button class="btn-sm" data-act="pickBg">Choisir un fichier</button>
    <span class="tiny muted">${bg ? 'défini' : 'aucun'}</span></div>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveProject" data-new="${id ? 0 : 1}">Enregistrer</button>
    <div class="sp"></div>
    ${id ? `<button class="btn-sm btn-ghost btn-danger" data-act="delProject" data-id="${p.id}">Supprimer</button>` : ''}</div>`);
}

/* ---------- événement ---------- */
export async function mEvent(id, projectId, presetStart, presetLane) {
  const lanes = (await byIdx('lanes', 'projectId', projectId)).sort((a, b) => a.order - b.order);
  const els = await byIdx('elements', 'projectId', projectId);
  const t0 = presetStart != null ? presetStart : Math.round(globalTime() * 4) / 4;
  const e = id ? await get('events', id) : {
    id: uid(), projectId, laneId: presetLane || S.laneFilter || (lanes[0] && lanes[0].id),
    title: '', desc: '', start: t0, end: t0 + 5, color: (lanes[0] && lanes[0].color) || '#6b5bd6', links: []
  };
  D.event = e;
  const links = e.links || [];

  let h = `<div class="hd"><h2 style="margin:0">${id ? 'Événement' : 'Nouvel événement'}</h2>${closeBtn}</div>
    <label class="lbl">Titre</label>
    <input id="eTitle" value="${esc(e.title)}" placeholder="Le Gardien surgit du cratère">
    <div class="row" style="gap:10px">
      <div style="flex:1"><label class="lbl">Début (s)</label><input id="eStart" type="number" step="0.25" value="${e.start}"></div>
      <div style="flex:1"><label class="lbl">Fin (s)</label><input id="eEnd" type="number" step="0.25" value="${e.end}"></div></div>
    <div class="tiny muted">Fin = début → repère instantané. Fin &gt; début → événement qui dure.</div>
    <label class="lbl">Piste scénique</label>
    <select id="eLane">${lanes.map(l => `<option value="${l.id}"${l.id === e.laneId ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
    <label class="lbl">Couleur</label>
    <input id="eColor" type="color" value="${e.color || '#6b5bd6'}" style="height:42px;padding:4px">
    <label class="lbl">Description / intention</label>
    <textarea id="eDesc" rows="4" placeholder="Ce qu'on voit, ce qu'on entend, l'action…">${esc(e.desc || '')}</textarea>
    <div class="rule"></div>
    <div class="row"><h3 style="flex:1">Éléments placés</h3>
    <button class="btn-sm" data-act="newElement" data-back="${e.id}">+ Créer</button></div>`;

  if (!links.length) h += `<div class="tiny muted" style="margin:6px 0">Aucun élément placé dans cet événement.</div>`;
  for (const lk of links) {
    const el = els.find(x => x.id === lk.elementId);
    if (!el) continue;
    const u = await assetURL(el.imageAssetId);
    h += `<div class="row" style="padding:8px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px">
      <div style="width:38px;height:38px;border-radius:8px;overflow:hidden;background:var(--panel2);flex:0 0 auto">
      ${u ? `<img src="${u}" style="width:100%;height:100%;object-fit:cover">` : ''}</div>
      <div style="flex:1;min-width:0"><div class="small">${esc(el.name)}</div>
      <input class="tiny" data-place="${el.id}" value="${esc(lk.placement || '')}"
        placeholder="Placement : avant-plan gauche, hors-champ…" style="padding:5px 8px;margin-top:3px"></div>
      <button class="btn-sm btn-ghost btn-danger" data-act="unlinkEl" data-id="${el.id}">✕</button></div>`;
  }

  h += `<label class="lbl">Ajouter un élément existant</label><div class="row wrap">` +
    (els.length
      ? els.map(el => `<span class="chip${links.some(l => l.elementId === el.id) ? ' on' : ''}"
          data-act="linkEl" data-id="${el.id}">${esc(el.name)}</span>`).join('')
      : `<span class="tiny muted">Aucun élément créé pour l'instant.</span>`) +
    `</div><div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveEvent">Enregistrer</button>
    <button class="btn-sm btn-ghost" data-act="gotoEvent">Écouter ici</button><div class="sp"></div>
    ${id ? `<button class="btn-sm btn-ghost btn-danger" data-act="delEvent" data-id="${e.id}">Supprimer</button>` : ''}</div>`;
  modal(h);
}

/* ---------- élément ---------- */
export async function mElement(id, projectId, backEvent) {
  const el = id ? await get('elements', id)
    : { id: uid(), projectId, cat: 'Personnages', name: '', desc: '', meta: '' };
  D.element = el;
  const img = await assetURL(el.imageAssetId);
  const snd = await assetURL(el.soundAssetId);

  modal(`<div class="hd"><h2 style="margin:0">${id ? 'Élément' : 'Nouvel élément'}</h2>${closeBtn}</div>
    ${img ? `<img src="${img}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;border:1px solid var(--line)">` : ''}
    <label class="lbl">Nom</label>
    <input id="xName" value="${esc(el.name)}" placeholder="Nébula, gardienne des braises">
    <label class="lbl">Catégorie</label>
    <select id="xCat">${CATS.map(c => `<option${c === el.cat ? ' selected' : ''}>${c}</option>`).join('')}</select>
    <label class="lbl">Description</label>
    <textarea id="xDesc" rows="4" placeholder="Apparence, rôle, matière, comportement…">${esc(el.desc || '')}</textarea>
    <label class="lbl">Fiche technique / notes</label>
    <textarea id="xMeta" rows="3" placeholder="Accessoires, costume, plan, contraintes de tournage…">${esc(el.meta || '')}</textarea>
    <label class="lbl">Image</label>
    <div class="row"><button class="btn-sm" data-act="pickElImg">Choisir un fichier</button>
    <span class="tiny muted">${img ? 'définie' : 'aucune'}</span></div>
    <label class="lbl">Son (bruitage / dialogue)</label>
    <div class="row"><button class="btn-sm" data-act="pickElSnd">Choisir un fichier</button>
    <span class="tiny muted">${snd ? 'défini' : 'aucun'}</span></div>
    ${snd ? `<audio controls src="${snd}" style="width:100%;margin-top:8px"></audio>` : ''}
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveElement" data-back="${backEvent || ''}">Enregistrer</button>
    <div class="sp"></div>
    ${id ? `<button class="btn-sm btn-ghost btn-danger" data-act="delElement" data-id="${el.id}">Supprimer</button>` : ''}</div>`);
}

/* ---------- piste audio ---------- */
export async function mTrack(id) {
  const tr = await get('tracks', id);
  modal(`<div class="hd"><h2 style="margin:0">Piste</h2>${closeBtn}</div>
    <label class="lbl">Nom</label><input id="tName" value="${esc(tr.name)}">
    <label class="lbl">Durée (secondes)</label><input id="tDur" type="number" step="0.01" value="${tr.duration || 0}">
    <div class="tiny muted">Corrige la durée si le format n'a pas pu être analysé. Actuel : ${fmtT2(tr.duration)}</div>
    <div class="tiny muted" style="margin-top:8px">${esc(tr.type || 'type inconnu')} · ${fmtSize(tr.size || 0)}</div>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveTrack" data-id="${tr.id}" data-owner="${tr.projectId}">Enregistrer</button>
    <button class="btn-sm btn-ghost" data-act="dlTrack" data-id="${tr.id}">Télécharger</button><div class="sp"></div>
    <button class="btn-sm btn-ghost btn-danger" data-act="delTrack" data-id="${tr.id}" data-owner="${tr.projectId}">Supprimer</button></div>`);
}

/* ---------- jalon de calendrier ---------- */
export async function mCal(dateOrId, isId) {
  const ps = await all('projects');
  const it = isId ? await get('cal', dateOrId)
    : { id: uid(), date: dateOrId, title: '', notes: '', projectId: '', done: false };
  D.cal = it;
  const others = isId ? [] : (await all('cal')).filter(x => x.date === dateOrId);

  let h = `<div class="hd"><h2 style="margin:0">${it.date}</h2>${closeBtn}</div>`;
  if (others.length) {
    h += `<div style="margin-bottom:10px">` + others.map(o =>
      `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)" data-act="calEdit" data-id="${o.id}">
       <span class="small" style="flex:1">${esc(o.title)}</span><span class="tiny">${o.done ? '✓' : '—'}</span></div>`).join('') + `</div>`;
  }
  h += `<label class="lbl">Intitulé</label>
    <input id="cTitle" value="${esc(it.title)}" placeholder="Tournage séquence 3">
    <label class="lbl">Projet lié</label>
    <select id="cProj"><option value="">—</option>
    ${ps.map(p => `<option value="${p.id}"${p.id === it.projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <label class="lbl">Notes</label><textarea id="cNotes" rows="3">${esc(it.notes || '')}</textarea>
    <label class="lbl">Date</label><input id="cDate" type="date" value="${it.date}">
    <div class="row" style="margin-top:12px"><span class="chip${it.done ? ' on' : ''}" data-act="calDone">Fait</span></div>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveCal">Enregistrer</button><div class="sp"></div>
    ${isId ? `<button class="btn-sm btn-ghost btn-danger" data-act="delCal" data-id="${it.id}">Supprimer</button>` : ''}</div>`;
  modal(h);
}

/* ---------- quête ---------- */
export async function mGoal(id) {
  const ps = await all('projects');
  const g = id ? await get('goals', id)
    : { id: uid(), title: '', type: 'steps', target: 10, current: 0, unit: '', deadline: '', projectId: '', steps: [] };
  D.goal = g;

  let h = `<div class="hd"><h2 style="margin:0">${id ? 'Quête' : 'Nouvelle quête'}</h2>${closeBtn}</div>
    <label class="lbl">Intitulé</label>
    <input id="gTitle" value="${esc(g.title)}" placeholder="Finaliser le clip du Serment">
    <label class="lbl">Type</label>
    <div class="row"><span class="chip${g.type === 'steps' ? ' on' : ''}" data-act="goalType" data-t="steps">Étapes</span>
    <span class="chip${g.type === 'count' ? ' on' : ''}" data-act="goalType" data-t="count">Compteur</span></div>`;

  if (g.type === 'count') {
    h += `<div class="row" style="gap:10px">
      <div style="flex:1"><label class="lbl">Actuel</label><input id="gCur" type="number" value="${g.current || 0}"></div>
      <div style="flex:1"><label class="lbl">Cible</label><input id="gTar" type="number" value="${g.target || 0}"></div>
      <div style="flex:1"><label class="lbl">Unité</label><input id="gUnit" value="${esc(g.unit || '')}" placeholder="plans"></div></div>`;
  } else {
    h += `<label class="lbl">Étapes</label>`;
    (g.steps || []).forEach((s, i) => {
      h += `<div class="row" style="margin-bottom:6px">
        <span class="chip${s.done ? ' on' : ''}" data-act="stepToggle" data-i="${i}">${s.done ? '✓' : '○'}</span>
        <input data-step="${i}" value="${esc(s.t)}" style="flex:1">
        <button class="btn-sm btn-ghost btn-danger" data-act="stepDel" data-i="${i}">✕</button></div>`;
    });
    h += `<button class="btn-sm" data-act="stepAdd">+ Étape</button>`;
  }

  h += `<label class="lbl">Échéance</label><input id="gDead" type="date" value="${g.deadline || ''}">
    <label class="lbl">Projet lié</label>
    <select id="gProj"><option value="">—</option>
    ${ps.map(p => `<option value="${p.id}"${p.id === g.projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveGoal">Enregistrer</button><div class="sp"></div>
    ${id ? `<button class="btn-sm btn-ghost btn-danger" data-act="delGoal" data-id="${g.id}">Supprimer</button>` : ''}</div>`;
  modal(h);
}

export function collectGoalDraft() {
  const g = D.goal;
  if (!g) return;
  const q = s => document.getElementById(s);
  if (q('gTitle')) g.title = q('gTitle').value.trim();
  if (q('gDead')) g.deadline = q('gDead').value;
  if (q('gProj')) g.projectId = q('gProj').value;
  if (g.type === 'count') {
    if (q('gCur')) g.current = +q('gCur').value;
    if (q('gTar')) g.target = +q('gTar').value;
    if (q('gUnit')) g.unit = q('gUnit').value;
  } else {
    document.querySelectorAll('[data-step]').forEach(i => { g.steps[+i.dataset.step].t = i.value; });
  }
}

/* ---------- blason de la guilde ---------- */
export async function mGuild() {
  const { ensureGuild } = await import('./db.js');
  const g = await ensureGuild();
  D.guild = g;
  const crest = await assetURL(g.crestAssetId);
  const banner = await assetURL(g.bannerAssetId);

  modal(`<div class="hd"><h2 style="margin:0">Blason de la guilde</h2>${closeBtn}</div>
    <div class="tiny muted">Le nom, la devise et les images qui ouvrent la Grande Salle.</div>
    <label class="lbl">Nom de la guilde</label>
    <input id="uName" value="${esc(g.name)}" placeholder="ANIM'CONNECT">
    <label class="lbl">Devise</label>
    <input id="uMotto" value="${esc(g.motto || '')}" placeholder="Lire, voir, entendre, vivre, interagir.">
    <label class="lbl">Rune du blason (si aucune image)</label>
    <input id="uRune" value="${esc(g.rune || 'A')}" maxlength="2" placeholder="A">
    <label class="lbl">Présentation</label>
    <textarea id="uDesc" rows="4" placeholder="Ce que fait la guilde, pour qui, avec quoi…">${esc(g.desc || '')}</textarea>
    <label class="lbl">Blason (image du sceau)</label>
    <div class="row"><button class="btn-sm" data-act="pickGuildCrest">Choisir un fichier</button>
    <span class="tiny muted">${crest ? 'défini' : 'aucun'}</span></div>
    <label class="lbl">Bannière (fond de la salle)</label>
    <div class="row"><button class="btn-sm" data-act="pickGuildBanner">Choisir un fichier</button>
    <span class="tiny muted">${banner ? 'définie' : 'aucune'}</span></div>
    <div class="rule"></div>
    <div class="row"><button class="btn-ember" data-act="saveGuildInfo">Enregistrer</button></div>`);
}
