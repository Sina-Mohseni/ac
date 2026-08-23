import {
  all, ensureHouse, assetURL, listPersonas, getActivePersona, listMilieux,
  childGroups, countDeep, personasOf, groupTreeIds
} from '../db.js';
import { app, setHead, setStage, charMedallion, mediaHTML } from '../ui.js';
import { esc, today } from '../utils.js';
import { S, ROOTS, GUILD_RANKS, PERSONA, HOUSES, houseByKey } from '../state.js';

/* Les icônes des trois maisons : le foyer, le sablier, la sphère. */
export const HOUSE_ICONS = {
  guild: '<path d="M4 10l8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  hourglass: '<path d="M6 3h12M6 21h12"/>'
    + '<path d="M8 3v3.6c0 2 4 3.4 4 5.4s-4 3.4-4 5.4V21"/>'
    + '<path d="M16 3v3.6c0 2-4 3.4-4 5.4s4 3.4 4 5.4V21"/>',
  sphere: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.2 12h17.6"/>'
};

/* Les quatre salles de la guilde. Ce sont les icônes réclamées :
   elles vivent ici, dans la page, et non plus en tête de l'application. */
export const HALLS = [
  ['library', 'Bibliothèque', 'Histoires, Jeux, Expo',
    '<path d="M4 5h4v14H4zM10 5h4v14h-4zM17 5l3-1 2 14-3 .6z"/>'],
  ['cal', 'Calendrier', 'Jalons et échéances',
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['goals', 'Quêtes', 'Objectifs en cours',
    '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'],
  ['vault', 'Coffre', 'Fichiers et stockage',
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 4v3M12 17v3"/>']
];

/* Le renom se calcule à partir de ce qui a réellement été bâti. */
export function renown(n) {
  const xp = n.projects * 40 + n.tracks * 8 + n.elements * 4
    + n.goalsDone * 60 + n.milestonesDone * 15 + n.groups * 10;
  let lvl = 1;
  while (lvl < GUILD_RANKS.length && xp >= 60 * lvl * lvl) lvl++;
  const floor = 60 * (lvl - 1) * (lvl - 1);
  const ceil = 60 * lvl * lvl;
  return {
    xp, lvl,
    rank: GUILD_RANKS[Math.min(lvl, GUILD_RANKS.length) - 1],
    pct: Math.max(0, Math.min(100, (xp - floor) / Math.max(1, ceil - floor) * 100)),
    next: ceil
  };
}

/* La Guilde, la Tour Hourglass et la Sphère ludique partagent cette page :
   bannière, chiffres, accès de la maison, cercle des personas, registre. */
export async function viewHouse(key) {
  const H = houseByKey(key);
  const g = await ensureHouse(H.key);
  setHead(H.nav, `${H.title} · ${g.name}`);
  await setStage(null);

  const [projects, groups, tracks, elements, goals, cal, assets] = await Promise.all([
    all('projects'), all('groups'), all('tracks'), all('elements'), all('goals'), all('cal'), all('assets')
  ]);
  const goalsDone = goals.filter(q => q.type === 'count'
    ? (q.current || 0) >= (q.target || 1)
    : (q.steps || []).length && (q.steps || []).every(s => s.done)).length;
  const milestonesDone = cal.filter(c => c.done).length;
  const r = renown({
    projects: projects.length, tracks: tracks.length, elements: elements.length,
    goalsDone, milestonesDone, groups: Math.max(0, groups.length - ROOTS.length)
  });

  const personas = await listPersonas();
  const milieux = await listMilieux();
  const activePersona = await getActivePersona();

  /* ---------- bannière ---------- */
  const bg = await assetURL(g.bannerAssetId);
  const crest = await assetURL(g.crestAssetId);
  let h = `<section class="ghero">
    ${bg ? `<div class="gbg">${(g.bannerKind || '').startsWith('video')
      ? `<video src="${bg}" muted loop autoplay playsinline></video>` : `<img src="${bg}" alt="">`}</div>` : ''}
    <div class="gveil"></div>
    <div class="gin">
      <div class="row" style="align-items:flex-start;gap:16px">
        <div class="gcrest${crest ? ' has' : ''}" data-act="crestUpload" role="button" tabindex="0"
          title="${crest ? "Remplacer l'image du blason" : "Ajouter une image de blason"}"
          aria-label="${crest ? "Remplacer l'image du blason" : "Ajouter une image de blason"}">
          ${crest
            ? ((g.crestKind || '').startsWith('video')
              ? `<video src="${crest}" muted loop autoplay playsinline></video>` : `<img src="${crest}" alt="">`)
            : ''}
          <span class="crestup">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V6M8.5 9.5L12 6l3.5 3.5"/>
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
            <b>${crest ? 'Changer' : 'Image'}</b></span>
        </div>
        <div style="flex:1;min-width:0">
          <div class="gname">${esc(g.name)}</div>
          ${g.motto ? `<div class="gmotto">« ${esc(g.motto)} »</div>` : ''}
        </div>
      </div>
      ${g.desc ? `<div class="gdesc">${esc(g.desc)}</div>` : ''}
      ${H.key !== 'guild' ? '' : `<div class="gseal">
        <div class="sig">${r.lvl}</div>
        <div style="flex:1;min-width:0">
          <div class="rank">Rang ${r.lvl} · ${esc(r.rank)}</div>
          <div class="xp">${r.xp} / ${r.next} points de renom</div>
          <div class="bar"><i style="width:${r.pct}%"></i></div>
        </div>
      </div>`}
    </div>
  </section>`;

  /* ---------- chiffres ---------- */
  const branchGroups = H.rootId ? await childGroups(H.rootId) : [];
  const branchCount = H.rootId ? await countDeep(H.rootId) : null;
  const houseFolk = await personasOf(H.milieuId, true);

  h += `<div class="gstats">` + (H.rootId
    ? `<div class="gs"><b>${branchCount.projects}</b><span>Projets</span></div>
       <div class="gs"><b>${branchGroups.length}</b><span>${H.key === 'hourglass' ? 'Mondes' : 'Univers'}</span></div>
       <div class="gs"><b>${branchCount.groups}</b><span>Dossiers</span></div>
       <div class="gs"><b>${houseFolk.length}</b><span>Personas</span></div>`
    : `<div class="gs"><b>${projects.length}</b><span>Projets</span></div>
       <div class="gs"><b>${goals.length}</b><span>Quêtes</span></div>
       <div class="gs"><b>${personas.length}</b><span>Membres</span></div>
       <div class="gs"><b>${assets.length}</b><span>Fichiers</span></div>`) + `</div>`;

  if (!H.rootId) {
    /* ---------- la Guilde : les quatre salles ---------- */
    const counts = {
      library: projects.length,
      cal: cal.filter(c => c.date >= today() && !c.done).length,
      goals: goals.length - goalsDone,
      vault: assets.length
    };
    h += `<div class="ghead"><h2>La grande salle</h2>
      <div class="hint">Quatre portes, quatre registres</div></div>
      <div class="hall" style="margin-bottom:16px">` + HALLS.map(t =>
      `<div class="plaque" data-act="go" data-view="tracker" data-tab="${t[0]}" role="button" tabindex="0"
         aria-label="${t[1]}">
        ${counts[t[0]] ? `<span class="pn">${counts[t[0]]}</span>` : ''}
        <div class="rune"><svg viewBox="0 0 24 24">${t[3]}</svg></div>
        <div class="pt">${t[1]}</div><div class="pd">${t[2]}</div></div>`).join('') + `</div>`;

    /* les deux autres maisons, en portes voisines */
    h += `<div class="ghead"><h2>Les deux ailes</h2>
      <div class="hint">Les histoires, les jeux</div></div>
      <div class="hall" style="margin-bottom:16px;grid-template-columns:repeat(2,1fr)">` +
      HOUSES.filter(x => x.rootId).map(x =>
      `<div class="plaque" data-act="go" data-view="${x.view}" role="button" tabindex="0" aria-label="${x.title}">
        <div class="rune"><svg viewBox="0 0 24 24">${HOUSE_ICONS[x.key]}</svg></div>
        <div class="pt">${esc(x.title)}</div><div class="pd">${esc(x.sub)}</div></div>`).join('') + `</div>`;
  } else {
    /* ---------- Hourglass, Sphere : les catégories de la branche ---------- */
    const label = H.key === 'hourglass' ? 'monde' : 'univers';
    h += `<div class="ghead"><h2>${H.key === 'hourglass' ? 'Les mondes' : 'Les univers'}</h2>
      <div class="hint">${branchGroups.length} ${label}${branchGroups.length !== 1 ? 's' : ''}</div></div>`;
    if (branchGroups.length) {
      h += `<div class="grid" style="margin-bottom:14px">`;
      for (const gr of branchGroups) {
        const c = await countDeep(gr.id);
        h += `<div class="tile wide" data-act="openGroup" data-id="${gr.id}" role="button" tabindex="0">
          <div class="media">${await mediaHTML(gr, true)}</div><div class="glz"></div>
          <div class="meta"><div class="t">${esc(gr.name)}</div>
          <div class="tiny muted mono">${c.groups} dossier${c.groups !== 1 ? 's' : ''} · ${c.projects} projet${c.projects !== 1 ? 's' : ''}</div></div></div>`;
      }
      h += `</div>`;
    } else {
      h += `<div class="card" style="margin-bottom:14px"><div class="small muted">Aucun ${label} pour
        l'instant. Ouvre la branche pour en créer un.</div></div>`;
    }
    h += `<div class="row wrap" style="margin-bottom:18px">
      <button class="btn-sm btn-ember" data-act="newGroup" data-parent="${H.rootId}">+ ${H.key === 'hourglass' ? 'Monde' : 'Univers'}</button>
      <button class="btn-sm" data-act="openGroup" data-id="${H.rootId}">Ouvrir la branche</button>
      <button class="btn-sm btn-ghost" data-act="branchMode" data-root="${H.rootId}">Mode</button>
    </div>`;
  }

  /* ---------- le cercle : les personas de la maison ---------- */
  const houseMilieux = milieux.filter(m => m.id === H.milieuId || m.parentId === H.milieuId);
  h += `<div class="ghead"><h2>Le cercle</h2>
    <div class="hint">${houseFolk.length} persona${houseFolk.length !== 1 ? 's' : ''} ·
    ${houseMilieux.length} milieu${houseMilieux.length !== 1 ? 'x' : ''}</div></div>
    <div class="card" style="margin-bottom:16px">`;
  for (const m of houseMilieux) {
    const list = await personasOf(m.id, false);
    if (!list.length && m.id !== H.milieuId) continue;
    h += `<div class="frt">${esc(m.name)}</div>
      <div class="roster" style="--acc:${PERSONA.accent}">`;
    for (const c of list) h += await charMedallion(c, c.id === activePersona, false);
    h += await charMedallion(null, false, true);
    h += `</div>`;
  }
  h += `</div>`;

  /* ---------- registre : global à la Guilde, limité à la branche ailleurs ---------- */
  const branchIds = H.rootId ? await groupTreeIds(H.rootId) : null;
  const scoped = branchIds ? projects.filter(p => branchIds.includes(p.groupId)) : projects;
  const scopedIds = scoped.map(p => p.id);
  const inScope = x => !branchIds || (x.projectId && scopedIds.includes(x.projectId));

  const pMap = {};
  scoped.forEach(p => { pMap[p.id] = p; });
  const upcoming = cal.filter(c => c.date >= today() && !c.done && inScope(c))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const openGoals = goals.filter(q => inScope(q) && (q.type === 'count'
    ? (q.current || 0) < (q.target || 1)
    : !((q.steps || []).length && (q.steps || []).every(s => s.done)))).slice(0, 4);
  const recent = scoped.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 4);

  h += `<div class="ghead"><h2>Le registre</h2>
    <div class="hint">Ce qui vient, ce qui court, ce qui s'ouvre</div></div>
    <div class="card" style="margin-bottom:12px">
      <div class="frt">Prochains jalons</div>`;
  h += upcoming.length ? upcoming.map(c =>
    `<div class="reg" data-act="calEdit" data-id="${c.id}" role="button" tabindex="0">
      <span class="rd">${c.date.slice(8)}/${c.date.slice(5, 7)}</span>
      <span class="rt">${esc(c.title)}</span>
      <span class="rs">${c.projectId && pMap[c.projectId] ? esc(pMap[c.projectId].name) : '—'}</span></div>`).join('')
    : `<div class="fnote">Aucun jalon à venir. Ouvre le Calendrier pour en poser un.</div>`;
  h += `</div>

    <div class="card" style="margin-bottom:12px">
      <div class="frt">Quêtes en cours</div>`;
  h += openGoals.length ? openGoals.map(q => {
    const pct = q.type === 'steps'
      ? ((q.steps && q.steps.length) ? q.steps.filter(s => s.done).length / q.steps.length * 100 : 0)
      : Math.min(100, (q.current || 0) / (q.target || 1) * 100);
    return `<div class="reg" data-act="openGoal" data-id="${q.id}" role="button" tabindex="0">
      <span class="rd">${Math.round(pct)}%</span>
      <span class="rt">${esc(q.title)}</span>
      <span class="rs">${q.deadline || '—'}</span></div>`;
  }).join('') : `<div class="fnote">Aucune quête ouverte. La salle des Quêtes attend un objectif.</div>`;
  h += `</div>

    <div class="card">
      <div class="frt">Derniers projets ouverts</div>`;
  h += recent.length ? recent.map(p =>
    `<div class="reg" data-act="openProject" data-id="${p.id}" role="button" tabindex="0">
      <span class="rd">${esc((p.kind || '·').slice(0, 6))}</span>
      <span class="rt">${esc(p.name)}</span>
      <span class="rs">›</span></div>`).join('')
    : `<div class="fnote">Rien encore. Passe par la Bibliothèque pour fonder un premier projet.</div>`;
  h += `</div>`;

  app().innerHTML = `<div class="guildpage">${h}</div>`;
}

/* Les trois pages d'accueil. */
export const viewGuild = () => viewHouse('guild');
export const viewHourglass = () => viewHouse('hourglass');
export const viewSphere = () => viewHouse('sphere');
