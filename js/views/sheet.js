import {
  getPersona, putPersona, getActivePersona, listMilieux, listSubMilieux,
  personasOf, assetURL
} from '../db.js';
import { app, setHead, charMedallion, milieuMedallion, pickField } from '../ui.js';
import { esc, uid } from '../utils.js';
import { S, PERSONA as K, ROLES, roleOf, identFor, panelsFor, MILIEU_ROOTS, MILIEU_GUILDE, milieuRoot } from '../state.js';

/* Fiche en cours d'affichage ou d'édition, partagée avec actions.js */
export const CH = { draft: null };

/* ---------- fabrique d'une fiche vierge ---------- */
export function blankChar(milieuId) {
  return {
    id: uid(), at: Date.now(),
    role: 'user', milieuId: milieuId || MILIEU_GUILDE.id, alsoIn: [],
    name: '', title: '', color: K.accent,
    portraitAssetId: null, portraitKind: '',
    bgAssetId: null, bgKind: '',
    ident: Object.fromEntries(K.ident.map(f => [f[0], f[0] === 'level' ? '1' : ''])),
    gauges: K.gauges.map(g => ({ label: g[0], cur: g[1], max: g[2] })),
    attrs: K.attrs.map(a => ({ label: a[0], value: a[1] })),
    panels: Object.fromEntries(K.panels.map(p => [p[0], '']))
  };
}

/* ---------- cadre orné ---------- */
const fr = (cls, inner, attrs) =>
  `<div class="fr ${cls || ''}" ${attrs || ''}><i class="cn tl"></i><i class="cn tr"></i>
   <i class="cn bl"></i><i class="cn br"></i><div class="fri">${inner}</div></div>`;

const val = (v, ph, cls) => v
  ? `<span class="${cls || ''}">${esc(v)}</span>`
  : `<span class="phv">${esc(ph)}</span>`;

/* ---------- panneaux : trois rendus selon le type ---------- */
function panelBody(mode, text, ph, edit, id) {
  if (edit) {
    return `<textarea class="fx" id="${id}" rows="${mode === 'prose' ? 5 : 4}"
      placeholder="${esc(ph)}">${esc(text || '')}</textarea>`;
  }
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return `<div class="prose phv">${esc(ph.split('\n')[0])}</div>`;
  if (mode === 'chips') {
    return `<div class="chips">${lines.map(l => `<span class="tr">${esc(l)}</span>`).join('')}</div>`;
  }
  if (mode === 'list') {
    return `<div class="lst">${lines.map(l => {
      const [n, ...rest] = l.split('|');
      const d = rest.join('|').trim();
      return `<div class="li"><span class="mk">◆</span><div><b>${esc(n.trim())}</b>${d ? ` <i>— ${esc(d)}</i>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  return `<div class="prose">${esc(text)}</div>`;
}

/* ---------- la fiche ---------- */
export async function ficheHTML(c, edit, milieux) {
  const acc = c.color || K.accent;
  const R = roleOf(c.role);
  const bgU = await assetURL(c.bgAssetId);
  const poU = await assetURL(c.portraitAssetId);

  const media = (u, k, fallback) => u
    ? ((k || '').startsWith('video')
      ? `<video src="${u}" muted loop autoplay playsinline></video>`
      : `<img src="${u}" alt="">`)
    : fallback;

  let h = `<section class="fiche${edit ? ' editing' : ''}" style="--acc:${esc(acc)}">
    ${bgU ? `<div class="fbg">${media(bgU, c.bgKind, '')}</div>` : ''}
    <div class="fveil"></div>
    <div class="fin">`;

  /* bandeau d'identité : portrait carré + bloc de titres rectangulaire */
  h += `<div class="idband">
    ${fr('portrait', `<div class="pimg">${media(poU, c.portraitKind,
      `<em>${esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</em>`)}</div>
      ${edit ? `<button class="pbtn2" data-act="pickCharPortrait">Portrait</button>` : ''}`)}
    ${fr('nameblock', edit
      ? `<input class="fx big" id="s_name" value="${esc(c.name)}" placeholder="Nom de ${K.one.toLowerCase()}">
         <input class="fx mid" id="s_title" value="${esc(c.title || '')}" placeholder="Épithète — « la gardienne des braises »">
         <div class="row" style="margin-top:6px;gap:8px">
           <input class="fx col" id="s_color" type="color" value="${esc(acc)}" style="flex:0 0 54px">
           <span class="fnote" style="flex:1">Couleur d'encre de la fiche</span></div>`
      : `<div class="fname">${c.name ? esc(c.name) : `<span class="phv">Sans nom</span>`}</div>
         ${c.title ? `<div class="ftitle">${esc(c.title)}</div>` : `<div class="ftitle phv">Sans épithète</div>`}
         <div class="fkind">${esc(R[3])}</div>`)}
  </div>`;

  /* rôle et milieux : réglables à tout moment, sans passer par l'édition */
  const mName = id => {
    const m = (milieux || []).find(x => x.id === id);
    if (!m) return '—';
    const par = m.parentId ? (milieux.find(x => x.id === m.parentId) || {}).name : null;
    return par ? `${par} · ${m.name}` : m.name;
  };
  const home = c.milieuId || MILIEU_GUILDE.id;
  h += fr('', `<div class="frt">Rôle du persona</div>
    <div class="chips" role="group" aria-label="Rôle du persona">` +
    ROLES.map(r => `<span class="chip${c.role === r[0] ? ' on' : ''}" data-act="setRole" data-r="${r[0]}"
      role="button" tabindex="0" title="${esc(r[2])}">${esc(r[1])}</span>`).join('') +
    `</div>
    <div class="fnote" style="margin-top:8px">${esc(R[2])}.</div>

    <label class="lbl">Milieu d'origine</label>` +
    pickField({
      id: 's_milieu', value: home, act: 'setMilieu',
      options: (milieux || []).map(m => ({ value: m.id, label: mName(m.id) }))
    }) + `

    <label class="lbl">Tient aussi un rôle dans</label>
    <div class="chips" role="group" aria-label="Autres milieux">` +
    (milieux || []).filter(m => m.id !== home).map(m =>
      `<span class="chip${(c.alsoIn || []).includes(m.id) ? ' on' : ''}" data-act="toggleAlsoIn" data-id="${m.id}"
        role="button" tabindex="0">${esc(mName(m.id))}</span>`).join('') +
    `</div>
    <div class="fnote" style="margin-top:8px">Un persona rangé ici peut très bien être assistant
    créateur ou personnage vivant ailleurs : choisis les milieux où il doit apparaître.</div>`);

  /* identité secondaire : petits cadres rectangulaires */
  h += `<div class="idgrid">` + identFor(c.role).map(f => fr('idc',
    `<div class="il">${f[1]}</div>` + (edit
      ? `<input class="fx mini" id="s_id_${f[0]}" value="${esc((c.ident || {})[f[0]] || '')}" placeholder="${esc(f[2])}">`
      : `<div class="iv">${val((c.ident || {})[f[0]], f[2])}</div>`))).join('') + `</div>`;

  /* jauges */
  h += fr('', `<div class="frt">Constantes</div>` +
    (c.gauges || []).map((g, i) => {
      const pct = Math.max(0, Math.min(100, (+g.cur || 0) / Math.max(1, +g.max || 1) * 100));
      return `<div class="gg">
        <div class="gl">${edit
          ? `<input class="fx mini" data-gl="${i}" value="${esc(g.label)}" style="flex:1">
             <input class="fx mini" data-gc="${i}" type="number" value="${+g.cur || 0}" style="width:62px">
             <input class="fx mini" data-gm="${i}" type="number" value="${+g.max || 1}" style="width:62px">
             <span class="kill" data-act="delGauge" data-i="${i}" role="button" tabindex="0">✕</span>`
          : `<b>${esc(g.label)}</b><span>${+g.cur || 0} / ${+g.max || 0}</span>`}</div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('') +
    (edit ? `<button class="btn-sm btn-ghost" data-act="addGauge" style="margin-top:9px">+ Constante</button>` : ''));

  /* attributs : la grille de cadres carrés */
  h += fr('', `<div class="frt">Attributs</div><div class="attrs">` +
    (c.attrs || []).map((a, i) => `<div class="fr attr">
      <i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>
      <div class="fri">${edit
        ? `<span class="kill" data-act="delAttr" data-i="${i}" role="button" tabindex="0">✕</span>
           <input class="fx num" data-av="${i}" type="number" value="${+a.value || 0}">
           <input class="fx mini" data-al="${i}" value="${esc(a.label)}" style="text-align:center">`
        : `<span class="av">${+a.value || 0}</span><span class="al">${esc(a.label)}</span>`}</div></div>`).join('') +
    (edit ? `<div class="fr attr" data-act="addAttr" role="button" tabindex="0" style="cursor:pointer">
      <i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>
      <div class="fri"><span class="av">+</span><span class="al">Attribut</span></div></div>` : '') +
    `</div>`);

  /* panneaux rectangulaires */
  for (const p of panelsFor(c.role)) {
    h += fr('', `<div class="frt">${p[1]}</div>` +
      panelBody(p[2], (c.panels || {})[p[0]], p[3], edit, 's_p_' + p[0]));
  }

  if (edit) {
    h += fr('', `<div class="frt">Fond de la fiche</div>
      <div class="row wrap">
        <button class="btn-sm" data-act="pickCharBg">Choisir une image</button>
        ${c.bgAssetId ? `<button class="btn-sm btn-ghost btn-danger" data-act="clearCharBg">Retirer</button>` : ''}
        <span class="fnote" style="flex:1">${c.bgAssetId ? 'Image en place : elle couvre toute la fiche.' : 'Aucune image : la fiche reste sur parchemin sombre.'}</span>
      </div>`);
  }

  h += `</div></section>`;
  return h;
}

/* ---------- page des personas : milieux, sous-groupes, fiches ---------- */
export async function viewPersonas() {
  const milieux = await listMilieux();
  if (!S.milieuRootId || !milieuRoot(S.milieuRootId)) S.milieuRootId = MILIEU_GUILDE.id;
  const root = milieuRoot(S.milieuRootId);
  const subs = await listSubMilieux(root.id);
  if (S.subMilieuId && !subs.some(m => m.id === S.subMilieuId)) S.subMilieuId = null;

  /* milieu courant : le sous-groupe choisi, sinon la racine et tout ce qu'elle contient */
  const scopeId = S.subMilieuId || root.id;
  const list = await personasOf(scopeId, !S.subMilieuId);
  /* Chez lui dans ce milieu, ou invité depuis un autre ? */
  const homeIds = [scopeId, ...(S.subMilieuId ? [] : subs.map(m => m.id))];
  const guest = c => !homeIds.includes(c.milieuId || MILIEU_GUILDE.id);
  const activeId = await getActivePersona();
  const scopeName = S.subMilieuId
    ? `${root.name} · ${(subs.find(m => m.id === S.subMilieuId) || {}).name}`
    : root.name;

  /* fiche ouverte : celle demandée, sinon l'active, sinon la première du milieu */
  let curId = S.personaId;
  if (!curId || !list.some(c => c.id === curId)) {
    curId = (list.some(c => c.id === activeId) ? activeId : (list[0] && list[0].id)) || null;
    S.personaId = curId;
    S.sheetEdit = false;
  }
  const cur = curId ? await getPersona(curId) : null;
  CH.draft = cur;

  setHead(K.title, cur
    ? `${cur.name || K.newName}${cur.id === activeId ? ' · actif' : ''} · ${scopeName}`
    : `${scopeName} · ${K.sub}`);

  /* première bande : les trois milieux */
  let h = `<div class="frt">Milieux</div>
    <div class="roster" aria-label="Milieux des personas">`;
  for (const m of MILIEU_ROOTS) {
    const n = (await personasOf(m.id, true)).length;
    h += await milieuMedallion(m, m.id === root.id, n);
  }
  h += `</div>
    <div class="fnote" style="margin:-6px 0 14px">${esc(root.desc)}</div>`;

  /* deuxième bande : les sous-groupes de la racine choisie */
  {
    h += `<div class="frt">Sous-groupes de ${esc(root.name)}</div>
      <div class="roster" aria-label="Sous-groupes">`;
    h += await milieuMedallion({ id: '', name: 'Tous' }, !S.subMilieuId, 0, 'all');
    for (const m of subs) {
      h += await milieuMedallion(m, m.id === S.subMilieuId, (await personasOf(m.id, false)).length);
    }
    h += await milieuMedallion(null, false, 0);
    h += `</div>`;
    if (S.subMilieuId) {
      h += `<div class="row wrap" style="margin:-4px 0 12px">
        <button class="btn-sm btn-ghost" data-act="editMilieu" data-id="${S.subMilieuId}">Renommer</button>
        <button class="btn-sm btn-ghost btn-danger" data-act="delMilieuAsk" data-id="${S.subMilieuId}">Supprimer</button>
      </div>`;
    }
  }

  /* troisième bande : les personas de ce milieu */
  h += `<div class="frt">Personas · ${esc(scopeName)}</div>
    <div class="roster" style="--acc:${esc(K.accent)}" aria-label="Fiches des personas">`;
  for (const c of list) h += await charMedallion(c, c.id === activeId, false, guest(c));
  h += await charMedallion(null, false, true);
  h += `</div>`;

  if (!cur) {
    app().innerHTML = h + `<div class="empty card"><span class="disp">Aucun persona dans ${esc(scopeName)}</span>
      Touche le « + » de la bande pour ouvrir une première fiche : portrait, rôle, attributs, histoire.</div>`;
    return;
  }

  /* barre d'outils de la fiche */
  h += `<div class="fbarre">
    ${S.sheetEdit
      ? `<button class="btn-sm btn-ember" data-act="saveChar">Enregistrer</button>
         <button class="btn-sm btn-ghost" data-act="cancelChar">Annuler</button>`
      : `<button class="btn-sm btn-ember" data-act="editChar">Modifier la fiche</button>
         <button class="btn-sm btn-ghost" data-act="activateChar" data-id="${cur.id}">
           ${cur.id === activeId ? '★ Fiche active' : 'Rendre active'}</button>`}
    <div class="sp"></div>
    <button class="btn-sm btn-ghost btn-danger" data-act="delCharAsk" data-id="${cur.id}">Supprimer</button>
  </div>`;

  h += await ficheHTML(cur, S.sheetEdit, milieux);
  app().innerHTML = h;
}

/* ---------- relève des champs avant tout re-rendu ---------- */
export function collectCharDraft() {
  const c = CH.draft;
  if (!c) return;
  const q = id => document.getElementById(id);

  if (q('s_name')) c.name = q('s_name').value.trim();
  if (q('s_title')) c.title = q('s_title').value.trim();
  if (q('s_color')) c.color = q('s_color').value;

  c.ident = c.ident || {};
  identFor(c.role).forEach(f => { const el = q('s_id_' + f[0]); if (el) c.ident[f[0]] = el.value.trim(); });

  c.panels = c.panels || {};
  panelsFor(c.role).forEach(p => { const el = q('s_p_' + p[0]); if (el) c.panels[p[0]] = el.value; });

  document.querySelectorAll('[data-gl]').forEach(el => {
    const g = c.gauges[+el.dataset.gl]; if (g) g.label = el.value;
  });
  document.querySelectorAll('[data-gc]').forEach(el => {
    const g = c.gauges[+el.dataset.gc]; if (g) g.cur = +el.value || 0;
  });
  document.querySelectorAll('[data-gm]').forEach(el => {
    const g = c.gauges[+el.dataset.gm]; if (g) g.max = Math.max(1, +el.value || 1);
  });
  document.querySelectorAll('[data-al]').forEach(el => {
    const a = c.attrs[+el.dataset.al]; if (a) a.label = el.value;
  });
  document.querySelectorAll('[data-av]').forEach(el => {
    const a = c.attrs[+el.dataset.av]; if (a) a.value = +el.value || 0;
  });
}

/* Redessine la fiche sans quitter l'édition (ajout d'attribut, upload…). */
export async function refreshSheet() {
  if (!CH.draft) return;
  const host = document.querySelector('.fiche');
  if (!host) return viewPersonas();
  host.outerHTML = await ficheHTML(CH.draft, S.sheetEdit, await listMilieux());
}

/* Sauvegarde du brouillon courant. */
export async function persistDraft() {
  if (!CH.draft) return;
  CH.draft.at = CH.draft.at || Date.now();
  CH.draft.milieuId = CH.draft.milieuId || MILIEU_GUILDE.id;
  CH.draft.alsoIn = CH.draft.alsoIn || [];
  CH.draft.role = CH.draft.role || 'user';
  await putPersona(CH.draft);
}
