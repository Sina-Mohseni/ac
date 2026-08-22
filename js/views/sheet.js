import {
  listChars, getChar, putChar, getActiveChar, assetURL
} from '../db.js';
import { app, setHead, setStageAsset, charMedallion } from '../ui.js';
import { esc, uid } from '../utils.js';
import { S, kindOf } from '../state.js';

/* Fiche en cours d'affichage ou d'édition, partagée avec actions.js */
export const CH = { kind: 'user', draft: null };

/* ---------- fabrique d'une fiche vierge ---------- */
export function blankChar(kind) {
  const K = kindOf(kind);
  return {
    id: uid(), kind: K.key, at: Date.now(),
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
export async function ficheHTML(c, kind, edit) {
  const K = kindOf(kind);
  const acc = c.color || K.accent;
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
         <div class="fkind">${K.kindLabel}</div>`)}
  </div>`;

  /* identité secondaire : petits cadres rectangulaires */
  h += `<div class="idgrid">` + K.ident.map(f => fr('idc',
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
  for (const p of K.panels) {
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

/* ---------- vue complète : bande + fiche ---------- */
async function viewChars(kind) {
  const K = kindOf(kind);
  CH.kind = K.key;
  const list = await listChars(K.key);
  const activeId = await getActiveChar(K.key);

  /* fiche ouverte : celle demandée, sinon l'active, sinon la première */
  const key = K.key === 'ai' ? 'personaId' : 'profileId';
  let curId = S[key];
  if (!curId || !list.some(c => c.id === curId)) {
    curId = (list.some(c => c.id === activeId) ? activeId : (list[0] && list[0].id)) || null;
    S[key] = curId;
    S.sheetEdit = false;
  }
  const cur = curId ? await getChar(K.key, curId) : null;
  CH.draft = cur;

  setHead(K.title, cur ? `${cur.name || K.newName}${cur.id === activeId ? ' · actif' : ''}` : K.sub);
  await setStageAsset(cur && cur.bgAssetId, cur && cur.bgKind);

  /* bande horizontale de toutes les fiches + création */
  let h = `<div class="roster" style="--acc:${esc(K.accent)}" aria-label="Fiches ${K.title.toLowerCase()}">`;
  for (const c of list) h += await charMedallion(c, K.key, c.id === activeId, false);
  h += await charMedallion(null, K.key, false, true);
  h += `</div>`;

  if (!cur) {
    app().innerHTML = h + `<div class="empty card"><span class="disp">Aucun ${K.one.toLowerCase()}</span>
      Touche le « + » de la bande pour ouvrir une première fiche : portrait, attributs, histoire.</div>`;
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

  h += await ficheHTML(cur, K.key, S.sheetEdit);
  app().innerHTML = h;
}

export const viewProfiles = () => viewChars('user');
export const viewPersonas = () => viewChars('ai');

/* ---------- relève des champs avant tout re-rendu ---------- */
export function collectCharDraft() {
  const c = CH.draft;
  if (!c) return;
  const K = kindOf(CH.kind);
  const q = id => document.getElementById(id);

  if (q('s_name')) c.name = q('s_name').value.trim();
  if (q('s_title')) c.title = q('s_title').value.trim();
  if (q('s_color')) c.color = q('s_color').value;

  c.ident = c.ident || {};
  K.ident.forEach(f => { const el = q('s_id_' + f[0]); if (el) c.ident[f[0]] = el.value.trim(); });

  c.panels = c.panels || {};
  K.panels.forEach(p => { const el = q('s_p_' + p[0]); if (el) c.panels[p[0]] = el.value; });

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
  const K = kindOf(CH.kind);
  if (!CH.draft) return;
  const host = document.querySelector('.fiche');
  if (!host) return viewChars(K.key);
  host.outerHTML = await ficheHTML(CH.draft, K.key, S.sheetEdit);
}

export { viewChars };

/* Sauvegarde du brouillon courant. */
export async function persistDraft() {
  if (!CH.draft) return;
  CH.draft.kind = CH.kind;
  CH.draft.at = CH.draft.at || Date.now();
  await putChar(CH.kind, CH.draft);
}
