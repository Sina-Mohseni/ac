import { all, get, rootForGroup, rootForProject } from '../db.js';
import { app, setHead, setStage, stat } from '../ui.js';
import { fmtSize, esc } from '../utils.js';
import { S, ROOTS, rootInfo } from '../state.js';
import { THEMES, getTheme, resolvedTheme } from '../theme.js';

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
export async function viewSettings() {
  setHead('Paramètres', 'Préférences du grimoire');
  await setStage(null);
  const pref = getTheme();
  app().innerHTML = `<div class="card" style="margin-bottom:12px">
    <h2>Apparence</h2>
    <div class="small muted">Choisis le mode d'affichage. « Automatique » suit le réglage
    jour / nuit de ton appareil — actuellement <b>${resolvedTheme() === 'dark' ? 'nuit' : 'jour'}</b>.</div>
    <div class="row wrap" style="margin-top:14px">` +
    THEMES.map(t => `<span class="chip${pref === t[0] ? ' on' : ''}" data-act="setTheme" data-t="${t[0]}"
      role="button" tabindex="0" title="${esc(t[2])}">${esc(t[1])}</span>`).join('') +
    `</div>
    <div class="tiny muted" style="margin-top:10px">Le bouton en haut à droite fait la même bascule
    depuis n'importe quelle page.</div>
    </div>

    <div class="card">
    <h2>Paramètres</h2>
    <div class="small muted">Cet espace accueillera les préférences générales de l'interface et du
    fonctionnement du Grimoire.</div>
    <div class="rule"></div>
    <div class="tiny muted">Le stockage des fichiers reste consultable dans l'onglet Coffre de la Guilde.</div>
    </div>`;
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
