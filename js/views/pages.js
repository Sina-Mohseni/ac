import { all, get, rootForGroup, rootForProject } from '../db.js';
import { app, setHead, setStage, stat, pickField } from '../ui.js';
import { fmtSize, esc } from '../utils.js';
import { S, ROOTS, rootInfo } from '../state.js';
import { getTheme, resolvedTheme } from '../theme.js';
import { PROVIDERS, providerOf, suggestedModels, getAI, maskKey } from '../ai.js';

/* Les fiches de profil et de persona vivent dans views/sheet.js. */

/* ---------- Expérience à vivre ---------- */
export async function viewExperience() {
  const selected = rootInfo(S.experienceRootId) || ROOTS[0];
  S.activeRootId = selected.id;
  S.branchMode = 'experience';
  let p = S.projectId ? await get('projects', S.projectId) : null;
  let g = !p && S.groupId ? await get('groups', S.groupId) : null;
  const currentRoot = p ? await rootForProject(p) : (g ? await rootForGroup(g.id) : null);
  if (!currentRoot || currentRoot.id !== selected.id) {
    p = null;
    g = await get('groups', selected.id);
  }
  const host = p || g;
  setHead(`Expérience · ${selected.name}`, host ? host.name : selected.name);
  await setStage(host ? host.id : null);

  app().innerHTML = `<div class="card">
    <div class="row"><h2 style="margin:0;flex:1">Vivre un projet ${selected.singular.toLowerCase()}</h2>
      <button class="btn-sm btn-ghost" data-act="branchMode" data-root="${selected.id}">Changer de mode</button></div>
    <div class="rule"></div>
    ${host
      ? `<div class="small muted">Branche : <span style="color:var(--ember)">${esc(selected.name)}</span> · contexte chargé :
         <span style="color:var(--parch)">${esc(host.name)}</span>.
         L'expérience se jouera ici, sur la temporalité du projet.</div>`
      : `<div class="small muted">Aucun contexte disponible dans la branche ${esc(selected.name)}.</div>`}
    <div class="rule"></div>
    <div class="tiny muted">Emplacements prévus : entrée du participant, personas IA en scène,
    déclenchement des événements de la chronologie, et trace de la session.</div>
    <div class="row" style="margin-top:14px">
      <button class="btn-sm btn-ghost" data-act="back">‹ Revenir</button></div>
    </div>`;
}

/* ---------- Musique ---------- */
export async function viewMusic() {
  setHead('Musique', 'Lecteur & playlists');
  await setStage(null);
  app().innerHTML = `<div class="card">
    <h2>Espace musique</h2>
    <div class="small muted">Cette page rassemble l'accès musical du Grimoire. Le lecteur fixe apparaît
    automatiquement dès qu'une playlist de catégorie ou de projet est chargée.</div>
    <div class="rule"></div>
    <div class="tiny muted">Les playlists continuent d'être gérées depuis leur catégorie ou leur projet,
    sans conversion ni compression des fichiers.</div>
    </div>`;
}

/* ---------- Paramètres ---------- */

/* Une carte de choix de thème, avec son aperçu miniature. */
const themeCard = (id, label, desc, cur) => `
  <div class="thopt${cur === id ? ' on' : ''}" data-act="setTheme" data-t="${id}" role="button" tabindex="0"
    aria-pressed="${cur === id}" title="${esc(desc)}">
    <div class="thprev th-${id}"><i class="thbar"></i><i class="thline"></i><i class="thline short"></i></div>
    <div class="thname">${esc(label)}</div>
    <div class="thdesc">${esc(desc)}</div>
  </div>`;

/* Résultat du dernier message d'essai, affiché sous le bloc. */
let AI_OUT = null;
export const setAiOut = (text, error) => { AI_OUT = text ? { text, error: !!error } : null; };

/* Le bloc « intelligence artificielle » : clé de l'utilisateur, puis choix du modèle. */
function aiBlock(cfg) {
  const P = providerOf(cfg.provider);
  const models = (cfg.models || []).length ? cfg.models : suggestedModels(cfg.provider).map(id => ({ id, label: id }));
  const listed = (cfg.models || []).length > 0;
  const state = !cfg.apiKey ? ['Aucune clé enregistrée', 'off']
    : !cfg.model ? ['Clé enregistrée · choisis un modèle', 'wait']
      : [`Prêt · ${P.name} · ${cfg.model}`, 'ok'];

  return `<div class="card" id="aiCard">
    <div class="row wrap aihead">
      <div class="aihead-t">
        <h2 style="margin-bottom:4px">Intelligence artificielle</h2>
        <div class="small muted">Apporte ta propre clé (BYOK) : le grimoire ne fournit aucun accès,
        il utilise le compte que tu indiques ici.</div>
      </div>
      <span class="aistate ${state[1]}">${esc(state[0])}</span>
    </div>

    <div class="rule"></div>

    <label class="lbl">Fournisseur</label>` +
    pickField({
      id: 'aiProvider', value: cfg.provider, act: 'aiProvider',
      options: Object.values(PROVIDERS).map(x =>
        ({ value: x.key, label: x.name, sub: x.keyHint === '…' ? '' : x.keyHint }))
    }) + `
    ${P.note ? `<div class="fnote" style="margin-top:6px">${esc(P.note)}</div>` : ''}

    ${P.custom || cfg.baseUrl ? `<label class="lbl" for="aiBase">URL de base du service</label>
      <input id="aiBase" type="url" spellcheck="false" placeholder="${esc(P.base || 'https://mon-service/v1')}"
        value="${esc(cfg.baseUrl || '')}">` : ''}

    <label class="lbl" for="aiKey">${esc(P.keyLabel)}</label>
    <input id="aiKey" type="password" autocomplete="off" spellcheck="false"
      placeholder="${cfg.apiKey ? esc(maskKey(cfg.apiKey)) + ' — saisis une nouvelle clé pour la remplacer' : esc(P.keyHint)}">
    <div class="row wrap" style="margin-top:10px">
      <button class="btn-ember btn-sm" data-act="aiSaveKey">Enregistrer la clé</button>
      <button class="btn-sm" data-act="aiLoadModels"${cfg.apiKey ? '' : ' disabled'}>Charger les modèles</button>
      ${cfg.apiKey ? `<div class="sp"></div>
        <button class="btn-sm btn-ghost btn-danger" data-act="aiClear">Effacer la clé</button>` : ''}
    </div>
    ${P.keyUrl ? `<div class="fnote" style="margin-top:8px">Créer une clé :
      <a href="${P.keyUrl}" target="_blank" rel="noopener noreferrer">${esc(P.keyUrl)}</a></div>` : ''}

    <div class="rule"></div>

    <label class="lbl">Modèle</label>` +
    pickField({
      id: 'aiModel', value: cfg.model, act: 'aiPickModel', placeholder: 'Choisir un modèle…',
      options: [{ value: '', label: '— aucun modèle —' }]
        .concat(models.map(m => ({ value: m.id, label: m.label || m.id, sub: m.label && m.label !== m.id ? m.id : '' })))
        .concat(cfg.model && !models.some(m => m.id === cfg.model)
          ? [{ value: cfg.model, label: cfg.model, sub: 'saisi à la main' }] : [])
    }) + `
    <div class="fnote" style="margin-top:6px">${listed
      ? `${models.length} modèle(s) proposés par le fournisseur pour cette clé.`
      : 'Suggestions courantes tant que la liste n\'a pas été chargée.'}</div>

    <label class="lbl" for="aiModelFree">Ou saisis l'identifiant exact du modèle</label>
    <div class="row">
      <input id="aiModelFree" spellcheck="false" placeholder="${esc(P.defaultModel || 'identifiant du modèle')}">
      <button class="btn-sm" data-act="aiSetModelFree">Utiliser</button>
    </div>

    <div class="rule"></div>

    <div class="row wrap">
      <button class="btn-sm" data-act="aiTest"${cfg.apiKey && cfg.model ? '' : ' disabled'}>Envoyer un message d'essai</button>
      <div class="sp"></div>
      ${cfg.checkedAt ? `<span class="tiny muted">Dernier échange réussi :
        ${new Date(cfg.checkedAt).toLocaleString('fr-FR')}</span>` : ''}
    </div>
    <div id="aiOut" class="aiout${AI_OUT && AI_OUT.error ? ' err' : ''}"${AI_OUT ? '' : ' hidden'}>${
      AI_OUT ? esc(AI_OUT.text) : ''}</div>

    <div class="fnote" style="margin-top:12px">La clé est rangée sur cet appareil, dans la base du
    navigateur, et n'est envoyée qu'au fournisseur choisi. Sur un appareil partagé, efface-la après usage.
    Un service qui n'autorise pas les appels directs depuis une page web renverra une erreur réseau.</div>
  </div>`;
}

export async function viewSettings() {
  setHead('Paramètres', 'Préférences du grimoire');
  const pref = getTheme();
  const cfg = await getAI();

  app().innerHTML = `<div class="card" style="margin-bottom:12px">
    <h2>Apparence</h2>
    <div class="small muted">Choisis le mode d'affichage. « Automatique » suit le réglage jour / nuit de
    ton appareil — actuellement <b>${resolvedTheme() === 'dark' ? 'nuit' : 'jour'}</b>.</div>
    <div class="thgrid" role="group" aria-label="Thème">
      ${themeCard('auto', 'Automatique', 'Suit le système', pref)}
      ${themeCard('light', 'Jour', 'Fond clair', pref)}
      ${themeCard('dark', 'Nuit', 'Fond sombre', pref)}
    </div>
    <div class="tiny muted" style="margin-top:10px">Le fond d'écran se charge depuis la Guilde :
    appuie sur le cadre à gauche du nom.</div>
  </div>

  ${aiBlock(cfg)}

  <div class="card" style="margin-top:12px">
    <h2>Stockage</h2>
    <div class="small muted">Le détail des fichiers et de l'espace occupé est dans l'onglet Coffre de la Guilde.</div>
  </div>`;

  await setStage(null);
}

/* ---------- Coffre ---------- */
export async function vaultHTML() {
  let txt = 'Estimation indisponible sur ce navigateur.';
  if (navigator.storage && navigator.storage.estimate) {
    const e = await navigator.storage.estimate();
    txt = `${fmtSize(e.usage || 0)} utilisés sur ~${fmtSize(e.quota || 0)} disponibles.`;
  }
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const assets = await all('assets');
  const totalB = assets.reduce((a, x) => a + (x.size || 0), 0);
  const groups = await all('groups');
  const projects = await all('projects');

  return `<div class="card">
    <h2>Contenu</h2>
    <div class="row wrap" style="gap:18px">
      ${stat(groups.length, 'groupes')}${stat(projects.length, 'projets')}
      ${stat(assets.length, 'fichiers')}${stat(fmtSize(totalB), 'poids brut')}</div>
    <div class="rule"></div>
    <div class="small muted">${txt}</div>
    <div class="tiny muted" style="margin-top:6px">Stockage ${persisted ? 'permanent (protégé)' : 'non permanent'}.
    Les fichiers sont conservés tels quels, sans conversion ni compression.</div>
    <div class="row" style="margin-top:14px">
      ${persisted ? '' : '<button class="btn-sm btn-ember" data-act="persist">Rendre permanent</button>'}
      <div class="sp"></div>
      <button class="btn-sm btn-ghost btn-danger" data-act="wipe">Tout effacer</button></div>
    </div>`;
}

export async function viewVault() {
  setHead('Coffre', 'Fichiers bruts et stockage');
  await setStage(null);
  app().innerHTML = await vaultHTML();
}
