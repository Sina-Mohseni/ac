import { get, byIdx, assetURL, groupPath } from '../db.js';
import { app, setHead, setStage, crumbs, trackRow, stat } from '../ui.js';
import { esc, fmtT2 } from '../utils.js';
import { S, CATS, PIPE } from '../state.js';
import { PL } from '../player.js';
import { paneTimeline } from './timeline.js';

export async function viewProject() {
  const p = await get('projects', S.projectId);
  if (!p) { S.projectId = null; S.view = 'library'; return; }
  await setStage(p.id);
  setHead(p.name, `${S.branchMode === 'creation' ? 'Création · ' : ''}${p.kind || 'Projet'}`);

  const path = p.groupId ? await groupPath(p.groupId) : [];
  const tabs = [['tracks', 'Pistes'], ['timeline', 'Chronologie'], ['elements', 'Éléments'], ['prod', 'Production']];

  let h = crumbs(path, p.name);
  h += `<div class="row" style="margin-bottom:12px">
    <button class="btn-sm btn-ghost" data-act="back">‹ Retour</button><div class="sp"></div>
    <button class="btn-sm btn-ghost" data-act="editProject">Réglages</button></div>
    <div class="row wrap" style="margin-bottom:12px">` +
    tabs.map(t => `<span class="chip${S.ptab === t[0] ? ' on' : ''}" data-act="ptab" data-t="${t[0]}">${t[1]}</span>`).join('') +
    `</div><div id="pane"></div>`;
  app().innerHTML = h;

  const pane = document.getElementById('pane');
  if (S.ptab === 'tracks') await paneTracks(pane, p);
  else if (S.ptab === 'timeline') await paneTimeline(pane, p);
  else if (S.ptab === 'elements') await paneElements(pane, p);
  else await paneProd(pane, p);
}

async function paneTracks(pane, p) {
  const ts = (await byIdx('tracks', 'projectId', p.id)).sort((a, b) => a.order - b.order);
  const total = ts.reduce((a, t) => a + (t.duration || 0), 0);
  let h = `<div class="card"><div class="row wrap">
      <div style="flex:1;min-width:150px"><h2 style="margin:0">Pistes du projet</h2>
      <div class="tiny muted">Fichiers stockés bruts : aucun type imposé, aucune compression.</div></div>
      <button class="btn-ember btn-sm" data-act="addTracks" data-owner="${p.id}">+ Uploader</button></div>
      <div class="rule"></div><div class="row"><span class="tiny muted">Durée totale assemblée</span>
      <div class="sp"></div><span class="mono" style="color:var(--ember);font-size:18px">${fmtT2(total)}</span>
      </div></div><div style="height:12px"></div>`;
  if (!ts.length) {
    h += `<div class="empty card"><span class="disp">Aucune musique</span>
      Uploade tes morceaux : leur durée cumulée définit la temporalité du projet.</div>`;
  }
  ts.forEach((t, i) => { h += trackRow(t, i, PL.ownerId === p.id && PL.idx === i, p.id); });
  pane.innerHTML = h;
}

async function paneElements(pane, p) {
  const els = (await byIdx('elements', 'projectId', p.id)).sort((a, b) => (a.cat + a.name).localeCompare(b.cat + b.name));
  let h = `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">Éléments</h2><div class="sp"></div>
    <button class="btn-ember btn-sm" data-act="newElement">+ Créer</button></div>
    <div class="tiny muted" style="margin-bottom:12px">Univers, décors, personnages, objets, bruitages, dialogues —
    chacun avec son image, son son, son titre et sa description.</div>`;
  if (!els.length) {
    h += `<div class="empty card"><span class="disp">Aucun élément</span>
      Crée un univers, un décor ou un personnage, puis place-le dans un événement.</div>`;
  }
  for (const c of CATS) {
    const list = els.filter(e => e.cat === c);
    if (!list.length) continue;
    h += `<div class="card" style="margin-bottom:10px"><h3 style="color:var(--ember);margin-bottom:8px">${c}</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(104px,1fr))">`;
    for (const e of list) {
      const u = await assetURL(e.imageAssetId);
      h += `<div class="tile" style="aspect-ratio:3/4" data-act="openElement" data-id="${e.id}">
        <div class="media">${u ? `<img src="${u}" alt="">` : ''}</div><div class="glz"></div>
        <div class="meta"><div class="t" style="font-size:11px">${esc(e.name)}</div>
        ${e.soundAssetId ? '<div class="tiny" style="color:var(--ember)">♪ son</div>' : ''}</div></div>`;
    }
    h += `</div></div>`;
  }
  pane.innerHTML = h;
}

async function paneProd(pane, p) {
  const st = p.pipeline || {};
  const trs = await byIdx('tracks', 'projectId', p.id);
  const evs = await byIdx('events', 'projectId', p.id);
  const els = await byIdx('elements', 'projectId', p.id);
  const done = PIPE.filter(k => st[k]).length;
  pane.innerHTML = `<div class="card"><h2>Chaîne de production</h2>
    <div class="bar" style="margin:6px 0 12px"><i style="width:${done / PIPE.length * 100}%"></i></div>
    <div class="row wrap">${PIPE.map(k => `<span class="chip${st[k] ? ' on' : ''}" data-act="pipe" data-k="${k}">${k}</span>`).join('')}</div></div>
    <div style="height:12px"></div>
    <div class="card"><h2>Relevé</h2><div class="row wrap" style="gap:18px">
    ${stat(trs.length, 'morceaux')}${stat(fmtT2(trs.reduce((a, t) => a + (t.duration || 0), 0)), 'durée')}
    ${stat(evs.length, 'événements')}${stat(els.length, 'éléments')}</div></div>
    <div style="height:12px"></div>
    <div class="card"><h2>Notes de réalisation</h2>
    <textarea id="pnotes" rows="8" placeholder="Intentions, références, plan de tournage, matériel, lieux…">${esc(p.notes || '')}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn-sm btn-ember" data-act="saveNotes">Enregistrer</button>
    <div class="sp"></div><button class="btn-sm btn-ghost" data-act="exportProject">Exporter la fiche</button></div></div>`;
}
