import { all, ensureGuild, assetURL, listChars, getActiveChar } from '../db.js';
import { app, setHead, setStage, charMedallion } from '../ui.js';
import { esc, today } from '../utils.js';
import { S, ROOTS, GUILD_RANKS, KINDS } from '../state.js';

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

export async function viewGuild() {
  const g = await ensureGuild();
  setHead('Guilde', g.name);
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

  const profiles = await listChars('user');
  const personas = await listChars('ai');
  const activeUser = await getActiveChar('user');
  const activeAi = await getActiveChar('ai');

  /* ---------- bannière ---------- */
  const bg = await assetURL(g.bannerAssetId);
  const crest = await assetURL(g.crestAssetId);
  let h = `<section class="ghero">
    ${bg ? `<div class="gbg">${(g.bannerKind || '').startsWith('video')
      ? `<video src="${bg}" muted loop autoplay playsinline></video>` : `<img src="${bg}" alt="">`}</div>` : ''}
    <div class="gveil"></div>
    <div class="gin">
      <div class="row" style="align-items:flex-start;gap:16px">
        <div class="gcrest">${crest
          ? ((g.crestKind || '').startsWith('video')
            ? `<video src="${crest}" muted loop autoplay playsinline></video>` : `<img src="${crest}" alt="">`)
          : `<b>${esc(g.rune || 'A')}</b>`}</div>
        <div style="flex:1;min-width:0">
          <div class="gname">${esc(g.name)}</div>
          ${g.motto ? `<div class="gmotto">« ${esc(g.motto)} »</div>` : ''}
        </div>
      </div>
      ${g.desc ? `<div class="gdesc">${esc(g.desc)}</div>` : ''}
      <div class="gseal">
        <div class="sig">${r.lvl}</div>
        <div style="flex:1;min-width:0">
          <div class="rank">Rang ${r.lvl} · ${esc(r.rank)}</div>
          <div class="xp">${r.xp} / ${r.next} points de renom</div>
          <div class="bar"><i style="width:${r.pct}%"></i></div>
        </div>
        <button class="btn-sm btn-ghost" data-act="editGuild">Blason</button>
      </div>
    </div>
  </section>`;

  /* ---------- chiffres ---------- */
  h += `<div class="gstats">
    <div class="gs"><b>${projects.length}</b><span>Projets</span></div>
    <div class="gs"><b>${goals.length}</b><span>Quêtes</span></div>
    <div class="gs"><b>${profiles.length + personas.length}</b><span>Membres</span></div>
    <div class="gs"><b>${assets.length}</b><span>Fichiers</span></div>
  </div>`;

  /* ---------- les quatre salles ---------- */
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

  /* ---------- le cercle : profils et personas ---------- */
  h += `<div class="ghead"><h2>Le cercle</h2>
    <div class="hint">${profiles.length} profil${profiles.length !== 1 ? 's' : ''} · ${personas.length} persona${personas.length !== 1 ? 's' : ''}</div></div>
    <div class="card" style="margin-bottom:16px">
      <div class="frt">Profils</div>
      <div class="roster" style="--acc:${KINDS.user.accent}">`;
  for (const c of profiles) h += await charMedallion(c, 'user', c.id === activeUser, false);
  h += await charMedallion(null, 'user', false, true);
  h += `</div>
      <div class="frt" style="margin-top:14px">Personas IA</div>
      <div class="roster" style="--acc:${KINDS.ai.accent}">`;
  for (const c of personas) h += await charMedallion(c, 'ai', c.id === activeAi, false);
  h += await charMedallion(null, 'ai', false, true);
  h += `</div></div>`;

  /* ---------- registre ---------- */
  const pMap = {};
  projects.forEach(p => { pMap[p.id] = p; });
  const upcoming = cal.filter(c => c.date >= today() && !c.done)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const openGoals = goals.filter(q => q.type === 'count'
    ? (q.current || 0) < (q.target || 1)
    : !((q.steps || []).length && (q.steps || []).every(s => s.done))).slice(0, 4);
  const recent = projects.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 4);

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

  app().innerHTML = h;
}
