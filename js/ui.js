import { assetURL, getOwner, listPersonas, getActivePersona, getWallpaper } from './db.js';
import { esc, fmtT2, fmtSize } from './utils.js';
import { S, PERSONA, HOUSES, houseByKey, HALLS_BY_HOUSE } from './state.js';

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

/* Le titre vit dans la barre du haut, entre les maisons et les outils.
   Le sous-titre n'a plus de ligne à lui : il devient l'infobulle. */
export function setHead(title, sub) {
  const el = document.getElementById('hTitle');
  el.textContent = title;
  if (sub) el.title = sub; else el.removeAttribute('title');
  document.title = `${title} · GRIMOIRE`;
}

/* ---- les salles, identiques pour les trois maisons, indépendantes ---- */
export const HALL_ICONS = {
  library: '<path d="M4 5h4v14H4zM10 5h4v14h-4zM17 5l3-1 2 14-3 .6z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  goals: '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 4v3M12 17v3"/>',
  /* les quatre salles de la Tour Hourglass */
  subjects: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  scenario: '<path d="M4 6h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  gates: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-7a3 3 0 0 1 6 0v7"/><path d="M2 21h20"/>'
};

export const HALL_LABELS = {
  library: 'Bibliothèque', cal: 'Calendrier', goals: 'Quêtes', vault: 'Coffre',
  subjects: 'Sujets', scenario: 'Scénario', eye: 'Eye', gates: 'Gates'
};

/* Le pied de page porte les salles de la maison où l'on se trouve. */
export function renderFooter() {
  const bar = document.getElementById('fbar');
  if (!bar) return;
  const H = houseByKey(S.houseKey);
  const halls = HALLS_BY_HOUSE[H.key] || HALLS_BY_HOUSE.guild;
  const cur = S.view === 'tracker' ? S.trackTab
    : (halls.includes(S.view) ? S.view : (S.view === 'session' ? 'gates' : null));
  bar.innerHTML = `<nav class="fnav fnav-halls" aria-label="Salles · ${H.nav}">` +
    halls.map(k =>
      `<button data-act="hall" data-t="${k}" class="${cur === k ? 'on' : ''}"
         aria-label="${HALL_LABELS[k]} · ${H.nav}" title="${HALL_LABELS[k]} · ${H.nav}">
        <svg viewBox="0 0 24 24">${HALL_ICONS[k]}</svg></button>`).join('') +
    `</nav>`;
}

export function setNav(view) {
  /* La maison courante suit la page ouverte, et ses salles. */
  const houseView = HOUSES.find(h => h.view === view);
  if (houseView) S.houseKey = houseView.key;
  else if ((HALLS_BY_HOUSE.hourglass || []).includes(view) || view === 'session') S.houseKey = 'hourglass';
  /* La Guilde est la maison : ses quatre salles et tout ce qui en découle
     gardent l'icône d'accueil allumée. */
  /* Les vues qui découlent d'une maison gardent son icône allumée. */
  const byRoot = { 'root-histoires': 'hourglass', 'root-jeux': 'sphere' };
  const inner = ['library', 'tracker', 'group', 'project', 'experience', 'vault',
    'subjects', 'scenario', 'eye', 'gates', 'session'];
  const active = inner.includes(view)
    ? (byRoot[S.activeRootId] || houseByKey(S.houseKey).view)
    : view;
  document.querySelectorAll('.hnav button').forEach(b => b.classList.toggle('on', b.dataset.view === active));

  const persona = document.getElementById('btnCurPersona');
  if (persona) persona.classList.toggle('on', view === 'personas');

}

/* ---- fond plein écran ----------------------------------------
   Deux niveaux : le fond demandé par la vue (bannière d'un projet,
   image d'une fiche) et, à défaut, le fond d'écran choisi dans les
   paramètres — le même de jour comme de nuit. Le média occupe tout
   l'écran, sans voile ni transparence.
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

/* Applique le fond demandé, ou le fond d'écran des paramètres. */
async function refreshStage() {
  if (STAGE.assetId) return paintStage(STAGE.assetId, STAGE.kind);
  const w = await getWallpaper();
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

/* ---- sélecteur maison ----------------------------------------
   Un « select » natif ouvre une liste dessinée par le système : elle
   ne suit ni le thème ni les formes du site. On garde donc un champ
   caché — pour que le code qui relève les valeurs ne change pas — et
   on ouvre une liste à nous, par-dessus tout le reste.
   -------------------------------------------------------------- */

const PICKS = new Map();

/* options : [{ value, label, sub }] ; act : action à jouer au choix. */
export function pickField({ id, value, options, act, placeholder }) {
  PICKS.set(id, { options, act });
  const cur = options.find(o => String(o.value) === String(value === undefined ? '' : value));
  return `<div class="pick">
    <input type="hidden" id="${id}" value="${esc(value == null ? '' : value)}">
    <button type="button" class="pickbtn" data-act="openPick" data-id="${id}"
      aria-haspopup="listbox">
      <span class="pickval${cur ? '' : ' phv'}">${esc(cur ? cur.label : (placeholder || 'Choisir…'))}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button></div>`;
}

export const pickOf = id => PICKS.get(id) || null;

/* La liste, dessinée comme le reste du site. */
export function openPickList(id, filter) {
  const P = PICKS.get(id);
  if (!P) return;
  const field = document.getElementById(id);
  const cur = field ? field.value : '';
  /* Le filtre ignore la casse et les accents : « ele » trouve « Modèle ». */
  const flat = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = flat(filter).trim();
  const shown = q
    ? P.options.filter(o => flat(o.label + ' ' + (o.sub || '')).includes(q))
    : P.options;
  const root = document.getElementById('pickRoot');
  const sheet = document.getElementById('pickSheet');
  sheet.innerHTML = `${P.options.length > 8
    ? `<div class="picksearch"><input id="pickQ" data-input="filterPick" data-id="${id}"
        value="${esc(filter || '')}" placeholder="Filtrer…" autocomplete="off" spellcheck="false"></div>`
    : ''}
    <div class="picklist" role="listbox">` +
    (shown.length ? shown.map(o => `<button type="button" class="pickrow${String(o.value) === String(cur) ? ' on' : ''}"
        data-act="choosePick" data-id="${id}" data-v="${esc(o.value)}" role="option">
        <span class="pickrow-t">${esc(o.label)}${o.sub ? `<i>${esc(o.sub)}</i>` : ''}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>
      </button>`).join('')
      : `<div class="fnote" style="padding:14px">Aucune correspondance.</div>`) +
    `</div>`;
  root.classList.add('on');
  const qEl = document.getElementById('pickQ');
  if (qEl && filter !== undefined) { qEl.focus(); qEl.setSelectionRange(qEl.value.length, qEl.value.length); }
}

export function closePickList() {
  const root = document.getElementById('pickRoot');
  if (root) root.classList.remove('on');
}

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

/* ---- médaillon d'un persona, pour la bande horizontale ---- */
export async function charMedallion(c, isActive, isAdd, isGuest) {
  if (isAdd) {
    return `<button class="rost add" data-act="newChar" title="Créer un persona">
      <span class="ph"><em>+</em></span><span class="rn">Nouveau</span></button>`;
  }
  const u = await assetURL(c.portraitAssetId);
  const opened = S.personaId === c.id;
  const media = u
    ? ((c.portraitKind || '').startsWith('video')
      ? `<video src="${u}" muted loop autoplay playsinline></video>`
      : `<img src="${u}" alt="">`)
    : `<em>${esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</em>`;
  return `<button class="rost${opened ? ' on' : ''}" data-act="pickChar" data-id="${c.id}"
      style="--acc:${esc(c.color || PERSONA.accent)}" title="${esc(c.name || PERSONA.one)}">
      <span class="ph">${media}${isActive ? '<span class="crown">★</span>' : ''}
      ${isGuest ? '<span class="guest" title="Invité dans ce milieu">↗</span>' : ''}</span>
      <span class="rn">${esc(c.name || PERSONA.newName)}</span></button>`;
}

/* ---- médaillon d'un milieu : le dossier où vivent les personas ---- */
export async function milieuMedallion(m, isCurrent, count, mode) {
  if (!m) {
    return `<button class="rost add mil" data-act="newMilieu" title="Ajouter un sous-groupe">
      <span class="ph"><em>+</em></span><span class="rn">Ajouter</span></button>`;
  }
  /* « Tous » et les sous-groupes changent de portée ; les racines changent de milieu. */
  const act = m.parentId || mode === 'all' ? 'pickSubMilieu' : 'pickMilieu';
  return `<button class="rost mil${isCurrent ? ' on' : ''}" data-act="${act}" data-id="${m.id}"
      title="${esc(m.name)}">
      <span class="ph"><em>${esc((m.name || '?').trim().charAt(0).toUpperCase() || '?')}</em>
      ${count ? `<span class="cnt">${count}</span>` : ''}</span>
      <span class="rn">${esc(m.name)}</span></button>`;
}

/* ---- portrait du persona actif dans la barre du bas ---- */
export async function refreshCurrents() {
  const btn = document.getElementById('btnCurPersona');
  if (!btn) return;
  const id = await getActivePersona();
  const list = await listPersonas();
  const c = list.find(x => x.id === id) || null;
  const old = btn.querySelector('.av');
  if (old) old.remove();
  btn.title = c ? `Persona actif : ${c.name}` : 'Personas';
  btn.setAttribute('aria-label', btn.title);
  btn.classList.toggle('hasav', !!c);
  if (!c) { btn.style.removeProperty('--acc'); return; }
  btn.style.setProperty('--acc', c.color || PERSONA.accent);
  const u = await assetURL(c.portraitAssetId);
  const av = document.createElement('span');
  av.className = 'av';
  av.innerHTML = u ? `<img src="${u}" alt="">`
    : `<i>${esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</i>`;
  btn.appendChild(av);
}
