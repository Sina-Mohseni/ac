import { byIdx, get, put } from '../db.js';
import { esc, fmtT, uid } from '../utils.js';
import { S, LANES } from '../state.js';

export async function paneTimeline(pane, p) {
  const ts = (await byIdx('tracks', 'projectId', p.id)).sort((a, b) => a.order - b.order);
  const total = ts.reduce((a, t) => a + (t.duration || 0), 0) || 60;

  let lanes = (await byIdx('lanes', 'projectId', p.id)).sort((a, b) => a.order - b.order);
  if (!lanes.length) {
    lanes = LANES.map((l, i) => ({ id: uid(), projectId: p.id, name: l[0], color: l[1], order: i }));
    for (const l of lanes) await put('lanes', l);
  }
  const laneMap = {};
  lanes.forEach(l => { laneMap[l.id] = l; });

  const evs = await byIdx('events', 'projectId', p.id);
  const els = await byIdx('elements', 'projectId', p.id);
  const elMap = {};
  els.forEach(e => { elMap[e.id] = e; });

  const z = S.vzoom;
  const H = total * z + 40;

  let h = `<div class="row wrap" style="margin-bottom:8px">
      <button class="btn-sm btn-ember" data-act="addEvent">+ Événement</button>
      <button class="btn-sm btn-ghost" data-act="tlMenu">Pistes scéniques</button>
      <div class="sp"></div>
      <span class="chip${S.follow ? ' on' : ''}" data-act="follow">Suivi</span></div>
    <div class="row" style="margin-bottom:8px"><span class="tiny muted">Zoom</span>
      <input id="vzoom" type="range" min="1" max="20" step="0.2" value="${z}" style="flex:1;padding:0"></div>
    <div class="row wrap" style="margin-bottom:8px">
      <span class="chip${!S.laneFilter ? ' on' : ''}" data-act="laneFilter" data-id="">Toutes</span>` +
    lanes.map(l => `<span class="chip${S.laneFilter === l.id ? ' on' : ''}" data-act="laneFilter" data-id="${l.id}"
      style="${S.laneFilter === l.id ? `border-color:${l.color};color:${l.color}` : ''}">${esc(l.name)}</span>`).join('') +
    `</div>
    <div class="tiny muted" style="margin-bottom:8px">Le temps descend. Touche une zone vide pour créer,
     un bloc pour l'ouvrir, glisse-le pour le déplacer, tire son bas pour l'étirer.</div>`;

  h += `<div id="vtl"><div id="vinner" style="height:${H}px" data-act="vtlTap">
    <div class="gut"></div><div id="vhead" style="top:0"></div>`;

  const step = z >= 12 ? 2 : z >= 6 ? 5 : z >= 3 ? 10 : z >= 1.6 ? 30 : 60;
  for (let s = 0; s <= total + step; s += step) {
    h += `<div class="gtick" style="top:${s * z}px"><span class="mono">${fmtT(s)}</span></div>`;
  }
  ts.forEach((t, i) => {
    const off = ts.slice(0, i).reduce((a, x) => a + (x.duration || 0), 0);
    h += `<div class="songband" style="top:${off * z + 1}px;height:${Math.max((t.duration || 0) * z - 2, 3)}px"
      title="${esc(t.name)}"></div>`;
  });

  /* répartition en colonnes pour que les événements simultanés ne se recouvrent pas */
  const shown = evs.filter(e => !S.laneFilter || e.laneId === S.laneFilter).sort((a, b) => a.start - b.start);
  const colEnd = [];
  shown.forEach(e => {
    const dur = Math.max(e.end - e.start, 18 / z);
    let c = 0;
    while (colEnd[c] != null && colEnd[c] > e.start + 0.001) c++;
    colEnd[c] = e.start + dur;
    e._c = c;
  });
  const nc = Math.max(1, colEnd.length);

  shown.forEach(e => {
    const l = laneMap[e.laneId] || { name: '—', color: '#6d6a86' };
    const mom = (e.end - e.start) < 0.35;
    const top = e.start * z;
    const hgt = Math.max((e.end - e.start) * z, 42);
    const names = (e.links || []).map(x => elMap[x.elementId] && elMap[x.elementId].name)
      .filter(Boolean).slice(0, 2).join(' · ');
    const w = `calc((100% - var(--gut) - 12px)/${nc} - 4px)`;
    const left = `calc(var(--gut) + 6px + (100% - var(--gut) - 12px)/${nc} * ${e._c})`;
    h += `<div class="vev${mom ? ' moment' : ''}" data-act="openEvent" data-id="${e.id}"
      style="top:${top}px;height:${hgt}px;left:${left};width:${w};
      background:linear-gradient(160deg,${e.color || l.color},${e.color || l.color}cc)">
      <div class="ct">${esc(e.title || 'Événement')}</div>
      <div class="cs mono">${fmtT(e.start)}${mom ? '' : ' → ' + fmtT(e.end)}</div>
      ${hgt > 58 ? `<div class="cs">${esc(l.name)}${names ? ' · ' + esc(names) : ''}</div>` : ''}
      <div class="vgrab" data-act="vresize" data-id="${e.id}"></div></div>`;
  });
  h += `</div></div>`;

  const sorted = evs.slice().sort((a, b) => a.start - b.start);
  h += `<div style="height:14px"></div><div class="card"><h2>Déroulé</h2>`;
  if (!sorted.length) h += `<div class="tiny muted">Aucun événement pour l'instant.</div>`;
  sorted.forEach(e => {
    const l = laneMap[e.laneId] || { name: '—', color: '#888' };
    h += `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)" data-act="openEvent" data-id="${e.id}">
      <span class="mono tiny" style="width:82px;color:var(--ember)">${fmtT(e.start)}${(e.end - e.start) > 0.35 ? '→' + fmtT(e.end) : ''}</span>
      <span style="width:8px;height:8px;border-radius:50%;background:${e.color || l.color}"></span>
      <span class="small" style="flex:1">${esc(e.title || 'Événement')}<span class="tiny muted"> · ${esc(l.name)}</span></span>
      <span class="tiny muted">${(e.links || []).length || 0}</span></div>`;
  });
  h += `</div>`;

  pane.innerHTML = h;
  document.getElementById('vzoom').oninput = e => { S.vzoom = +e.target.value; import('./project.js').then(m => m.viewProject()); };
  wireVDrag();
}

function wireVDrag() {
  const sc = document.getElementById('vtl');
  if (!sc) return;
  let drag = null;

  sc.addEventListener('pointerdown', async e => {
    const grab = e.target.closest('.vgrab');
    const box = e.target.closest('.vev');
    if (!box) return;
    const ev = await get('events', box.dataset.id || grab.dataset.id);
    if (!ev) return;
    drag = { mode: grab ? 'resize' : 'move', ev, y0: e.clientY, s0: ev.start, e0: ev.end, el: box, moved: false };
    box.setPointerCapture(e.pointerId);
  });

  sc.addEventListener('pointermove', e => {
    if (!drag) return;
    const d = (e.clientY - drag.y0) / S.vzoom;
    if (Math.abs(e.clientY - drag.y0) > 5) drag.moved = true;
    if (drag.mode === 'move') {
      const len = drag.e0 - drag.s0;
      const s = Math.max(0, Math.round((drag.s0 + d) * 4) / 4);
      drag.ev.start = s;
      drag.ev.end = s + len;
    } else {
      drag.ev.end = Math.max(drag.s0, Math.round((drag.e0 + d) * 4) / 4);
    }
    drag.el.style.top = (drag.ev.start * S.vzoom) + 'px';
    drag.el.style.height = Math.max((drag.ev.end - drag.ev.start) * S.vzoom, 34) + 'px';
    e.preventDefault();
  });

  const end = async () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      await put('events', d.ev);
      const m = await import('./project.js');
      m.viewProject();
    }
  };
  sc.addEventListener('pointerup', end);
  sc.addEventListener('pointercancel', end);
}
