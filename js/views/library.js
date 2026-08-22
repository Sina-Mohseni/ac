import { childGroups, groupProjects, countDeep, groupPath, byIdx, get } from '../db.js';
import { app, setHead, setStage, mediaHTML, tileHTML, crumbs, trackRow } from '../ui.js';
import { esc, fmtT2 } from '../utils.js';
import { S, ROOTS, rootInfo } from '../state.js';
import { PL } from '../player.js';

/* ---------- bibliothèque : les trois branches fixes de projets ---------- */
export async function libraryHTML() {
  const cats = (await Promise.all(ROOTS.map(r => get('groups', r.id)))).filter(Boolean);
  let h = `<div class="card" style="margin-bottom:14px">
    <div class="tiny muted">Choisis une branche de projets. Dans <span style="color:var(--parch)">Histoires</span>,
    <span style="color:var(--parch)">Jeux</span> ou <span style="color:var(--parch)">Expo</span>, tu peux créer autant
    de catégories et sous-catégories que nécessaire, puis ranger chaque projet au niveau voulu.</div></div>`;

  for (const g of cats) {
    const root = rootInfo(g.id);
    const c = await countDeep(g.id);
    h += `<div class="portal root-${root.key}" data-act="openGroup" data-id="${g.id}" role="button" tabindex="0">
      <div class="media">${await mediaHTML(g, false)}</div><div class="glz"></div>
      <div class="body"><div class="rune"><b>${root.rune}</b></div>
      <div style="min-width:0">
        <div class="t">${esc(g.name)}</div>
        ${g.desc ? `<div class="d">${esc(g.desc)}</div>` : ''}
        <div class="count">${c.groups} dossier${c.groups !== 1 ? 's' : ''} · ${c.projects} projet${c.projects !== 1 ? 's' : ''}</div>
      </div></div></div>`;
  }
  return h;
}

export async function viewLibrary() {
  setHead('Bibliothèque', 'Projets · Histoires · Jeux · Expo');
  await setStage(null);
  app().innerHTML = await libraryHTML();
}

/* ---------- page d'un groupe (ou sous-groupe, à toute profondeur) ---------- */
export async function viewGroup() {
  const g = await get('groups', S.groupId);
  if (!g) { S.groupId = null; S.view = 'library'; return viewLibrary(); }
  await setStage(g.id);
  const path = await groupPath(g.id);
  const depth = path.length;
  const isRoot = depth === 1 && !!g.systemRoot;
  const root = rootInfo(path[0] && path[0].id);
  const modeLabel = S.branchMode === 'creation' ? 'Création · ' : '';
  setHead(g.name, modeLabel + (isRoot ? 'Branche de projets' : 'Catégorie · niveau ' + (depth - 1)));

  const subs = await childGroups(g.id);
  const projs = await groupProjects(g.id);
  const trs = (await byIdx('tracks', 'projectId', g.id)).sort((a, b) => a.order - b.order);
  const dur = trs.reduce((a, t) => a + (t.duration || 0), 0);

  let h = crumbs(path.slice(0, -1), g.name);
  h += `<div class="row wrap" style="margin-bottom:12px">
    <button class="btn-sm btn-ghost" data-act="back">‹ Retour</button><div class="sp"></div>
    <button class="btn-sm btn-ghost" data-act="editGroup" data-id="${g.id}">${isRoot ? 'Personnaliser' : 'Réglages'}</button></div>`;

  if (g.desc) h += `<div class="card" style="margin-bottom:12px"><div class="small">${esc(g.desc).replace(/\n/g, '<br>')}</div></div>`;

  h += `<div class="card" style="margin-bottom:14px"><div class="row wrap">
      <div style="flex:1;min-width:150px"><h2 style="margin:0">Playlist d'idées</h2>
      <div class="tiny muted">Les musiques envisagées à ce niveau, avant d'être attribuées à un projet.</div></div>
      <button class="btn-ember btn-sm" data-act="addTracks" data-owner="${g.id}">+ Uploader</button></div>`;
  if (trs.length) {
    h += `<div class="rule"></div><div class="row"><span class="tiny muted">Durée cumulée</span>
      <div class="sp"></div><span class="mono" style="color:var(--ember)">${fmtT2(dur)}</span></div>
      <div style="height:10px"></div>`;
    trs.forEach((t, i) => { h += trackRow(t, i, PL.ownerId === g.id && PL.idx === i, g.id); });
  } else {
    h += `<div class="tiny muted" style="margin-top:10px">Aucune piste d'idée pour l'instant.</div>`;
  }
  h += `</div>`;

  h += `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">${isRoot ? 'Catégories' : 'Sous-catégories'}</h2><div class="sp"></div>
    <button class="btn-sm" data-act="newGroup" data-parent="${g.id}">+ ${isRoot ? 'Catégorie' : 'Sous-catégorie'}</button></div>`;
  if (subs.length) {
    h += '<div class="grid" style="margin-bottom:16px">';
    for (const s of subs) {
      const c = await countDeep(s.id);
      h += await tileHTML(s, 'openGroup', '◇', `${c.groups} sous-cat. · ${c.projects} proj.`, 'wide');
    }
    h += '</div>';
  } else {
    h += `<div class="tiny muted" style="margin-bottom:16px">Aucune ${isRoot ? 'catégorie' : 'sous-catégorie'} à ce niveau.</div>`;
  }

  h += `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">Projets</h2><div class="sp"></div>
    <button class="btn-sm btn-ember" data-act="newProject" data-group="${g.id}" data-root="${root ? root.id : ''}">+ Projet</button></div>`;
  if (projs.length) {
    h += '<div class="grid">';
    for (const p of projs) {
      const pt = await byIdx('tracks', 'projectId', p.id);
      h += await tileHTML(p, 'openProject', pt.length + ' ⨉',
        fmtT2(pt.reduce((a, t) => a + (t.duration || 0), 0)));
    }
    h += '</div>';
  } else {
    h += `<div class="tiny muted">Aucun projet ici. Un projet peut vivre à n'importe quel niveau de l'arbre.</div>`;
  }

  app().innerHTML = h;
}
