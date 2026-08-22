import { assetURL, getOwner, listChars, getActiveChar, getWallpaper } from './db.js';
import { esc, fmtT2, fmtSize } from './utils.js';
import { S, kindOf } from './state.js';
import { resolvedTheme } from './theme.js';

export const app = () => document.getElementById('app');
const mroot = () => document.getElementById('modalRoot');
const sheet = () => document.getElementById('sheet');

export function modal(html) {
  const root = mroot();
  root.classList.remove('closing');
  sheet().innerHTML = html;
  root.classList.add('on');
}

export function closeModal() {
  const root = mroot();
  if (!root.classList.contains('on')) return Promise.resolve();
  root.classList.add('closing');
  return new Promise(resolve => {
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      root.classList.remove('on', 'closing');
      sheet().innerHTML = '';
      resolve();
    };
    sheet().addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 280);
  });
}

export function setHead(title, sub) {
  document.getElementById('hTitle').textContent = title;
  document.getElementById('hSub').textContent = sub;
  document.title = `${title} · GRIMOIRE`;
}

export function setNav(view) {
  /* La Guilde est la maison : ses quatre salles et tout ce qui en découle
     gardent l'icône d'accueil allumée. */
  const map = {
    library: 'guild', tracker: 'guild', group: 'guild',
    project: 'guild', experience: 'guild', vault: 'guild'
  };
  const active = map[view] || view;
  document.querySelectorAll('.hnav button').forEach(b => b.classList.toggle('on', b.dataset.view === active));
  document.querySelectorAll('.fnav-tools button').forEach(b => b.classList.toggle('on', b.dataset.view === active));
  document.querySelectorAll('.fnav-current button').forEach(b => b.classList.toggle('on', b.dataset.view === active));
  document.querySelectorAll('.fnav-roots button').forEach(b => b.classList.toggle('on', b.dataset.root === S.activeRootId));
}

/* ---- fond plein écran ----------------------------------------
   Deux niveaux : le fond demandé par la vue (bannière d'un projet,
   image d'une fiche) et, à défaut, le fond d'écran choisi dans les
   paramètres pour le thème courant — un pour le jour, un pour la nuit.
   -------------------------------------------------------------- */

let STAGE = { assetId: null, kind: '' };

async function paintStage(assetId, kind) {
  const st = document.getElementById('bgstage');
  const old = st.querySelector('video,img');
  const u = assetId ? await assetURL(assetId) : null;
  if (!u) {
    if (old) old.remove();
    st.classList.remove('on');
    return;
  }
  if (old) {
    if (old.dataset.assetId === assetId) { st.classList.add('on'); return; }
    old.remove();
  }
  let n;
  if ((kind || '').startsWith('video')) {
    n = document.createElement('video');
    n.src = u; n.muted = true; n.loop = true; n.playsInline = true; n.autoplay = true;
  } else { n = document.createElement('img'); n.src = u; n.alt = ''; }
  n.dataset.assetId = assetId;
  st.insertBefore(n, st.firstChild);
  st.classList.add('on');
  if (n.play) n.play().catch(() => {});
}

/* Applique le fond demandé, ou le fond d'écran du thème courant. */
async function refreshStage() {
  if (STAGE.assetId) return paintStage(STAGE.assetId, STAGE.kind);
  const w = await getWallpaper(resolvedTheme());
  return paintStage(w.assetId, w.kind);
}

/* Fond plein écran à partir d'un fichier précis (fiches de personnage). */
export async function setStageAsset(assetId, kind) {
  STAGE = { assetId: assetId || null, kind: kind || '' };
  return refreshStage();
}

export async function setStage(id) {
  const o = id ? await getOwner(id) : null;
  STAGE = o && o.bgAssetId ? { assetId: o.bgAssetId, kind: o.bgKind || '' } : { assetId: null, kind: '' };
  return refreshStage();
}

/* Le fond d'écran suit la bascule jour / nuit. */
window.addEventListener('ac:theme', () => { refreshStage().catch(() => {}); });

/* ---- fragments réutilisables ---- */
export const stat = (v, l) =>
  `<div><div class="mono" style="font-size:22px;color:var(--ember)">${v}</div><div class="tiny muted">${l}</div></div>`;

export const opt = (act, attr, rune, title, sub, cls) =>
  `<div class="bigopt ${cls || ''}" data-act="${act}" ${attr || ''} role="button" tabindex="0"><div class="rune"><b>${rune}</b></div>
   <div><div class="disp" style="font-size:13px;letter-spacing:.08em">${title}</div>
   <div class="tiny muted">${sub}</div></div></div>`;

export async function mediaHTML(owner, preferCover) {
  const id = preferCover ? (owner.coverAssetId || owner.bgAssetId) : (owner.bgAssetId || owner.coverAssetId);
  if (!id) return '';
  const u = await assetURL(id);
  if (!u) return '';
  const kind = id === owner.coverAssetId ? (owner.coverKind || '') : (owner.bgKind || '');
  return kind.startsWith('video')
    ? `<video src="${u}" muted loop autoplay playsinline></video>`
    : `<img src="${u}" alt="">`;
}

export async function tileHTML(o, act, badge, meta, extraClass) {
  return `<div class="tile ${extraClass || ''}" data-act="${act}" data-id="${o.id}" role="button" tabindex="0">
    <div class="media">${await mediaHTML(o, true)}</div><div class="glz"></div>
    ${badge ? `<div class="sigilmark">${badge}</div>` : ''}
    <div class="meta"><div class="t">${esc(o.name)}</div>
    <div class="tiny muted mono">${meta || ''}</div></div></div>`;
}

export const crumbs = (path, current) =>
  `<div class="crumbs"><a data-act="go" data-view="library">Bibliothèque</a>` +
  path.map(g => `<span class="sep">›</span><a data-act="openGroup" data-id="${g.id}">${esc(g.name)}</a>`).join('') +
  (current ? `<span class="sep">›</span><span class="cur">${esc(current)}</span>` : '') + `</div>`;

export const trackRow = (t, i, playing, owner) =>
  `<div class="track${playing ? ' playing' : ''}">
    <span class="n mono">${i + 1}</span>
    <button class="pbtn btn-ghost" data-act="playTrack" data-i="${i}" data-owner="${owner}" aria-label="Lire">
      <svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>
    <div class="nm">${esc(t.name)}<div class="tiny muted mono">${fmtT2(t.duration)} · ${fmtSize(t.size || 0)}</div></div>
    <button class="btn-sm btn-ghost" data-act="mvTrack" data-id="${t.id}" data-owner="${owner}" data-d="-1">▲</button>
    <button class="btn-sm btn-ghost" data-act="mvTrack" data-id="${t.id}" data-owner="${owner}" data-d="1">▼</button>
    <button class="btn-sm btn-ghost" data-act="trackMenu" data-id="${t.id}">⋯</button></div>`;

/* ---- médaillon d'une fiche, utilisé par la bande horizontale ---- */
export async function charMedallion(c, kind, isActive, isAdd) {
  const K = kindOf(kind);
  if (isAdd) {
    return `<button class="rost add" data-act="newChar" data-kind="${K.key}" title="Créer ${K.one.toLowerCase()}">
      <span class="ph"><em>+</em></span><span class="rn">${K.newName.split(' ')[0]}</span></button>`;
  }
  const u = await assetURL(c.portraitAssetId);
  const opened = (kind === 'ai' ? S.personaId : S.profileId) === c.id;
  const media = u
    ? ((c.portraitKind || '').startsWith('video')
      ? `<video src="${u}" muted loop autoplay playsinline></video>`
      : `<img src="${u}" alt="">`)
    : `<em>${esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</em>`;
  return `<button class="rost${opened ? ' on' : ''}" data-act="pickChar" data-kind="${K.key}" data-id="${c.id}"
      style="--acc:${esc(c.color || K.accent)}" title="${esc(c.name || K.one)}">
      <span class="ph">${media}${isActive ? '<span class="crown">★</span>' : ''}</span>
      <span class="rn">${esc(c.name || K.newName)}</span></button>`;
}

/* ---- portraits actifs dans le footer ---- */
export async function refreshCurrents() {
  for (const kind of ['user', 'ai']) {
    const btn = document.getElementById(kind === 'ai' ? 'btnCurAi' : 'btnCurUser');
    if (!btn) continue;
    const K = kindOf(kind);
    const id = await getActiveChar(kind);
    const list = await listChars(kind);
    const c = list.find(x => x.id === id) || null;
    const old = btn.querySelector('.av');
    if (old) old.remove();
    btn.title = c ? `${K.one} actif : ${c.name}` : `${K.one} actuel`;
    btn.setAttribute('aria-label', btn.title);
    btn.classList.toggle('hasav', !!c);
    if (!c) { btn.style.removeProperty('--acc'); continue; }
    btn.style.setProperty('--acc', c.color || K.accent);
    const u = await assetURL(c.portraitAssetId);
    const av = document.createElement('span');
    av.className = 'av';
    av.innerHTML = u ? `<img src="${u}" alt="">`
      : `<i>${esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</i>`;
    btn.appendChild(av);
  }
}
