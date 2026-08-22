import {
  get, put, del, all, byIdx, saveAsset, assetURL,
  deleteGroupTree, isProject, rootForGroup, rootForProject, isRootGroup,
  saveGuild, putChar, delChar, setActiveChar, getActiveChar, listChars,
  setWallpaper
} from './db.js';
import { S, PIPE, ROOTS, rootInfo } from './state.js';
import { closeModal, modal, opt } from './ui.js';
import { pickFiles, probeDuration, toast, uid, today } from './utils.js';
import { audio, PL, loadQueue, playIndex, seekGlobal, globalTime, stopAll, renderBand } from './player.js';
import { render, goBack } from './router.js';
import { viewProject } from './views/project.js';
import { viewTracker } from './views/tracker.js';
import {
  D, mGroup, mProject, mEvent, mElement, mTrack, mCal, mGoal, mGuild, collectGoalDraft
} from './modals.js';
import {
  CH, blankChar, collectCharDraft, refreshSheet, persistDraft
} from './views/sheet.js';
import { applyTheme, themeLabel } from './theme.js';
import { getAI, saveAI, clearAI, listModels, chat, providerOf } from './ai.js';
import { setAiOut } from './views/pages.js';

function branchDrawer(rootId) {
  const root = rootInfo(rootId) || ROOTS[0];
  modal(`<div class="hd"><h2 style="margin:0">${root.name}</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <div class="tiny muted" style="margin-bottom:12px">Choisis le mode d'ouverture de cette branche.</div>` +
      opt('pickBranchMode', `data-root="${root.id}" data-mode="creation"`, '✦', 'Création',
        `Construire et organiser les projets ${root.name.toLowerCase()}`, `rootpick ${root.key}`) +
      opt('pickBranchMode', `data-root="${root.id}" data-mode="experience"`, '◐', 'Expérience',
        `Vivre et parcourir les projets ${root.name.toLowerCase()}`, `rootpick ${root.key}`));
}

function personaDrawer() {
  modal(`<div class="hd"><h2 style="margin:0">Personas</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <div class="tiny muted" style="margin-bottom:12px">Choisis le type de persona à créer.</div>` +
      opt('pickPersonaMode', 'data-mode="user"', 'U', 'Profils',
        'Création de user · personas utilisateur', 'personapick user') +
      opt('pickPersonaMode', 'data-mode="char"', 'C', 'Personas',
        'Création de char · personas IA', 'personapick char'));
}

const A = {
  /* ---------- navigation ---------- */
  go: t => {
    S.view = t.dataset.view;
    if (t.dataset.tab) S.trackTab = t.dataset.tab;
    if (S.view === 'library') {
      S.trackTab = 'library';
      S.groupId = null; S.projectId = null; S.experienceRootId = null;
      S.activeRootId = null; S.branchMode = null;
    } else if (['guild', 'tracker', 'profiles', 'personas', 'music', 'settings', 'vault'].includes(S.view)) {
      S.activeRootId = null;
      S.branchMode = null;
      if (S.view === 'guild' || S.view === 'tracker') {
        S.groupId = null; S.projectId = null; S.experienceRootId = null;
      }
    }
    return render();
  },
  back: () => goBack(),
  openGroup: async t => {
    const root = await rootForGroup(t.dataset.id);
    S.activeRootId = root ? root.id : null;
    S.branchMode = S.branchMode || 'creation';
    S.groupId = t.dataset.id;
    S.projectId = null;
    S.view = 'group';
    return render();
  },
  openProject: async t => {
    const root = await rootForProject(t.dataset.id);
    S.activeRootId = root ? root.id : null;
    S.branchMode = S.branchMode || 'creation';
    S.projectId = t.dataset.id;
    S.view = 'project';
    S.ptab = 'tracks';
    loadQueue(t.dataset.id, false);
    return render();
  },
  openFromPlayer: async () => {
    if (!PL.ownerId) return;
    if (await isProject(PL.ownerId)) {
      const root = await rootForProject(PL.ownerId);
      S.activeRootId = root ? root.id : null;
      S.branchMode = 'creation';
      S.projectId = PL.ownerId;
      S.view = 'project';
    } else {
      const root = await rootForGroup(PL.ownerId);
      S.activeRootId = root ? root.id : null;
      S.branchMode = 'creation';
      S.groupId = PL.ownerId;
      S.projectId = null;
      S.view = 'group';
    }
    return render();
  },
  ptab: t => { S.ptab = t.dataset.t; return viewProject(); },
  trackTab: t => { S.trackTab = t.dataset.t; return viewTracker(); },
  closeModal,

  /* ---------- modes des branches du footer ---------- */
  branchMode: t => branchDrawer(t.dataset.root),
  pickBranchMode: async t => {
    const rootId = t.dataset.root;
    const mode = t.dataset.mode;
    await closeModal();
    S.activeRootId = rootId;
    S.branchMode = mode;
    S.groupId = rootId;
    S.projectId = null;
    if (mode === 'experience') {
      S.experienceRootId = rootId;
      S.view = 'experience';
    } else {
      S.experienceRootId = null;
      S.view = 'group';
    }
    return render();
  },
  quickCal: () => mCal(today(), false),

  /* ---------- types de personas du footer ---------- */
  personaMode: () => personaDrawer(),
  pickPersonaMode: async t => {
    await closeModal();
    S.activeRootId = null;
    S.branchMode = null;
    S.personaMode = t.dataset.mode;
    S.view = S.personaMode === 'user' ? 'profiles' : 'personas';
    return render();
  },

  /* ---------- groupes ---------- */
  newGroup: t => mGroup(null, (t && t.dataset.parent) || ''),
  editGroup: t => mGroup(t.dataset.id || S.groupId, null),
  pickGCover: () => pickFiles(false, async f => {
    D.group.coverAssetId = await saveAsset(f[0]); D.group.coverKind = f[0].type; toast('Vignette chargée');
  }),
  pickGBg: () => pickFiles(false, async f => {
    D.group.bgAssetId = await saveAsset(f[0]); D.group.bgKind = f[0].type; toast('Fond chargé');
  }),
  saveGroup: async t => {
    const g = D.group;
    if (!g.systemRoot) g.name = document.getElementById('gName').value.trim() || 'Catégorie sans nom';
    g.desc = document.getElementById('gDesc').value;
    g.parentId = g.systemRoot ? '' : (g.parentId || ROOTS[0].id);
    g.at = g.at || Date.now();
    await put('groups', g);
    closeModal();
    if (t.dataset.new === '1') { S.groupId = g.id; S.projectId = null; S.view = 'group'; }
    return render();
  },
  delGroup: async t => {
    const g = await get('groups', t.dataset.id);
    if (!g || g.systemRoot || isRootGroup(g.id)) return toast('Cette branche racine ne peut pas être supprimée');
    if (!confirm('Supprimer cette catégorie et toutes ses sous-catégories ? Les projets sont conservés et remontent d\'un niveau.')) return;
    await deleteGroupTree(g.id, g.parentId || '');
    closeModal();
    S.groupId = g.parentId || null;
    S.view = g.parentId ? 'group' : 'library';
    if (S.view === 'library') { S.activeRootId = null; S.branchMode = null; }
    return render();
  },

  /* ---------- projets ---------- */
  newProject: t => mProject(null,
    (t && t.dataset.group) || (S.view === 'group' ? S.groupId : '') || '',
    (t && t.dataset.root) || ''),
  editProject: () => mProject(S.projectId, null, null),
  pickCover: () => pickFiles(false, async f => {
    D.project.coverAssetId = await saveAsset(f[0]); D.project.coverKind = f[0].type; toast('Vignette chargée');
  }),
  pickBg: () => pickFiles(false, async f => {
    D.project.bgAssetId = await saveAsset(f[0]); D.project.bgKind = f[0].type; toast('Fond chargé');
  }),
  saveProject: async t => {
    const p = D.project;
    p.name = document.getElementById('fName').value.trim() || 'Projet sans nom';
    p.kind = document.getElementById('fKind').value.trim();
    const chosenGroup = document.getElementById('fGroup').value;
    const chosenRoot = await rootForGroup(chosenGroup);
    p.groupId = chosenRoot && chosenRoot.id === D.projectRootId ? chosenGroup : D.projectRootId;
    p.at = p.at || Date.now();
    await put('projects', p);
    closeModal();
    if (t.dataset.new === '1') { S.projectId = p.id; S.view = 'project'; S.ptab = 'tracks'; }
    if (PL.ownerId === p.id) renderBand(p.id);
    return render();
  },
  delProject: async t => {
    if (!confirm('Supprimer ce projet, ses pistes, éléments et événements ?')) return;
    const id = t.dataset.id;
    const p = await get('projects', id);
    for (const s of ['tracks', 'lanes', 'events', 'elements']) {
      for (const o of await byIdx(s, 'projectId', id)) await del(s, o.id);
    }
    await del('projects', id);
    closeModal();
    S.projectId = null;
    if (PL.ownerId === id) stopAll();
    S.groupId = (p && p.groupId) || null;
    S.view = S.groupId ? 'group' : 'library';
    if (S.view === 'library') { S.activeRootId = null; S.branchMode = null; }
    return render();
  },

  /* ---------- pistes audio ---------- */
  addTracks: t => {
    const owner = t.dataset.owner;
    pickFiles(true, async files => {
      toast('Lecture des durées…');
      let order = (await byIdx('tracks', 'projectId', owner)).length;
      for (const f of files) {
        const assetId = await saveAsset(f);
        const duration = await probeDuration(f);
        await put('tracks', {
          id: uid(), projectId: owner, name: f.name, assetId, duration,
          size: f.size, type: f.type, order: order++
        });
      }
      toast(files.length + ' fichier(s) ajouté(s)');
      await loadQueue(owner, false);
      return render();
    });
  },
  playTrack: async t => {
    if (PL.ownerId !== t.dataset.owner) await loadQueue(t.dataset.owner, false);
    await playIndex(+t.dataset.i, true);
    return render();
  },
  mvTrack: async t => {
    const owner = t.dataset.owner;
    const ts = (await byIdx('tracks', 'projectId', owner)).sort((a, b) => a.order - b.order);
    const i = ts.findIndex(x => x.id === t.dataset.id);
    const j = i + (+t.dataset.d);
    if (j < 0 || j >= ts.length) return;
    [ts[i].order, ts[j].order] = [ts[j].order, ts[i].order];
    await put('tracks', ts[i]);
    await put('tracks', ts[j]);
    await loadQueue(owner, false);
    return render();
  },
  trackMenu: t => mTrack(t.dataset.id),
  saveTrack: async t => {
    const tr = await get('tracks', t.dataset.id);
    tr.name = document.getElementById('tName').value.trim() || tr.name;
    tr.duration = +document.getElementById('tDur').value || 0;
    await put('tracks', tr);
    closeModal();
    await loadQueue(t.dataset.owner, false);
    return render();
  },
  dlTrack: async t => {
    const tr = await get('tracks', t.dataset.id);
    const a = document.createElement('a');
    a.href = await assetURL(tr.assetId);
    a.download = tr.name;
    a.click();
  },
  delTrack: async t => {
    if (!confirm('Supprimer cette piste ?')) return;
    const tr = await get('tracks', t.dataset.id);
    await del('tracks', tr.id);
    await del('assets', tr.assetId);
    closeModal();
    await loadQueue(t.dataset.owner, false);
    return render();
  },

  /* ---------- transport ---------- */
  toggle: () => {
    if (!PL.tracks.length) return toast('Aucune piste chargée');
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  },
  prev: () => {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else if (PL.idx > 0) playIndex(PL.idx - 1, !audio.paused);
  },
  next: () => { if (PL.idx < PL.tracks.length - 1) playIndex(PL.idx + 1, !audio.paused); },

  /* ---------- chronologie ---------- */
  follow: () => { S.follow = !S.follow; return viewProject(); },
  laneFilter: t => { S.laneFilter = t.dataset.id || null; return viewProject(); },
  vtlTap: (t, e) => {
    if (e.target.closest('.vev')) return;
    const y = e.clientY - t.getBoundingClientRect().top;
    return mEvent(null, S.projectId, Math.max(0, Math.round(y / S.vzoom * 4) / 4), S.laneFilter);
  },
  addEvent: () => S.projectId ? mEvent(null, S.projectId) : toast('Ouvre un projet d\'abord'),
  openEvent: t => mEvent(t.dataset.id, S.projectId),
  saveEvent: async () => {
    const e = D.event;
    e.title = document.getElementById('eTitle').value.trim() || 'Événement';
    e.start = Math.max(0, +document.getElementById('eStart').value || 0);
    e.end = Math.max(e.start, +document.getElementById('eEnd').value || e.start);
    e.laneId = document.getElementById('eLane').value;
    e.color = document.getElementById('eColor').value;
    e.desc = document.getElementById('eDesc').value;
    document.querySelectorAll('[data-place]').forEach(i => {
      const lk = (e.links || []).find(l => l.elementId === i.dataset.place);
      if (lk) lk.placement = i.value;
    });
    await put('events', e);
    closeModal();
    return viewProject();
  },
  delEvent: async t => {
    if (!confirm('Supprimer cet événement ?')) return;
    await del('events', t.dataset.id);
    closeModal();
    return viewProject();
  },
  gotoEvent: async () => {
    if (PL.ownerId !== S.projectId) await loadQueue(S.projectId, false);
    await seekGlobal(D.event.start);
    audio.play().catch(() => {});
    closeModal();
    return viewProject();
  },
  linkEl: async t => {
    const e = D.event;
    e.links = e.links || [];
    const i = e.links.findIndex(l => l.elementId === t.dataset.id);
    if (i >= 0) e.links.splice(i, 1); else e.links.push({ elementId: t.dataset.id, placement: '' });
    await put('events', e);
    return mEvent(e.id, S.projectId);
  },
  unlinkEl: async t => {
    const e = D.event;
    e.links = (e.links || []).filter(l => l.elementId !== t.dataset.id);
    await put('events', e);
    return mEvent(e.id, S.projectId);
  },

  /* ---------- pistes scéniques ---------- */
  tlMenu: async () => {
    const lanes = (await byIdx('lanes', 'projectId', S.projectId)).sort((a, b) => a.order - b.order);
    modal(`<div class="hd"><h2 style="margin:0">Pistes scéniques</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>` +
      lanes.map(l => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <span style="width:10px;height:10px;border-radius:50%;background:${l.color}"></span>
        <span class="small" style="flex:1">${l.name}</span>
        <button class="btn-sm btn-ghost" data-act="laneEdit" data-id="${l.id}">Modifier</button></div>`).join('') +
      `<div class="rule"></div><button class="btn-ember btn-sm" data-act="addLane">+ Ajouter une piste</button>`);
  },
  addLane: async () => {
    const n = prompt('Nom de la piste scénique', 'Nouvelle piste');
    if (!n) return;
    const ls = await byIdx('lanes', 'projectId', S.projectId);
    await put('lanes', { id: uid(), projectId: S.projectId, name: n, color: '#6d6a86', order: ls.length });
    closeModal();
    return viewProject();
  },
  laneEdit: async t => {
    const l = await get('lanes', t.dataset.id);
    modal(`<div class="hd"><h2 style="margin:0">Piste scénique</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <label class="lbl">Nom</label><input id="lName" value="${l.name}">
      <label class="lbl">Couleur</label><input id="lColor" type="color" value="${l.color}" style="height:42px;padding:4px">
      <div class="rule"></div>
      <div class="row"><button class="btn-ember" data-act="saveLane" data-id="${l.id}">Enregistrer</button>
      <div class="sp"></div>
      <button class="btn-sm btn-ghost btn-danger" data-act="delLane" data-id="${l.id}">Supprimer</button></div>`);
  },
  saveLane: async t => {
    const l = await get('lanes', t.dataset.id);
    l.name = document.getElementById('lName').value;
    l.color = document.getElementById('lColor').value;
    await put('lanes', l);
    closeModal();
    return viewProject();
  },
  delLane: async t => {
    if (!confirm('Supprimer la piste et ses événements ?')) return;
    for (const e of await byIdx('events', 'projectId', S.projectId)) {
      if (e.laneId === t.dataset.id) await del('events', e.id);
    }
    await del('lanes', t.dataset.id);
    if (S.laneFilter === t.dataset.id) S.laneFilter = null;
    closeModal();
    return viewProject();
  },

  /* ---------- éléments ---------- */
  newElement: t => S.projectId
    ? mElement(null, S.projectId, (t && t.dataset.back) || '')
    : toast('Ouvre un projet d\'abord'),
  openElement: t => mElement(t.dataset.id, S.projectId, ''),
  pickElImg: () => pickFiles(false, async f => { D.element.imageAssetId = await saveAsset(f[0]); toast('Image chargée'); }),
  pickElSnd: () => pickFiles(false, async f => { D.element.soundAssetId = await saveAsset(f[0]); toast('Son chargé'); }),
  saveElement: async t => {
    const el = D.element;
    el.name = document.getElementById('xName').value.trim() || 'Élément';
    el.cat = document.getElementById('xCat').value;
    el.desc = document.getElementById('xDesc').value;
    el.meta = document.getElementById('xMeta').value;
    await put('elements', el);
    const back = t.dataset.back;
    if (back) {
      const e = await get('events', back);
      if (e) {
        e.links = e.links || [];
        if (!e.links.some(l => l.elementId === el.id)) e.links.push({ elementId: el.id, placement: '' });
        await put('events', e);
      }
      return mEvent(back, S.projectId);
    }
    closeModal();
    return viewProject();
  },
  delElement: async t => {
    if (!confirm('Supprimer cet élément ?')) return;
    const id = t.dataset.id;
    for (const e of await byIdx('events', 'projectId', S.projectId)) {
      if ((e.links || []).some(l => l.elementId === id)) {
        e.links = e.links.filter(l => l.elementId !== id);
        await put('events', e);
      }
    }
    await del('elements', id);
    closeModal();
    return viewProject();
  },

  /* ---------- production ---------- */
  pipe: async t => {
    const p = await get('projects', S.projectId);
    p.pipeline = p.pipeline || {};
    p.pipeline[t.dataset.k] = !p.pipeline[t.dataset.k];
    await put('projects', p);
    return viewProject();
  },
  saveNotes: async () => {
    const p = await get('projects', S.projectId);
    p.notes = document.getElementById('pnotes').value;
    await put('projects', p);
    toast('Notes enregistrées');
  },
  exportProject: async () => {
    const p = await get('projects', S.projectId);
    const data = {
      projet: p,
      pistes: await byIdx('tracks', 'projectId', p.id),
      pistes_sceniques: await byIdx('lanes', 'projectId', p.id),
      evenements: await byIdx('events', 'projectId', p.id),
      elements: await byIdx('elements', 'projectId', p.id)
    };
    const b = new Blob([JSON.stringify(JSON.parse(JSON.stringify(data)), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = p.name.replace(/\W+/g, '_') + '.json';
    a.click();
  },

  /* ---------- suivi ---------- */
  calMove: t => {
    S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + (+t.dataset.d), 1);
    return viewTracker();
  },
  calDay: t => mCal(t.dataset.date, false),
  calEdit: t => mCal(t.dataset.id, true),
  calDone: t => { D.cal.done = !D.cal.done; t.classList.toggle('on', D.cal.done); },
  saveCal: async () => {
    const it = D.cal;
    it.title = document.getElementById('cTitle').value.trim() || 'Jalon';
    it.notes = document.getElementById('cNotes').value;
    it.projectId = document.getElementById('cProj').value;
    it.date = document.getElementById('cDate').value || it.date;
    await put('cal', it);
    closeModal();
    S.view = 'tracker';
    S.trackTab = 'cal';
    return render();
  },
  delCal: async t => { await del('cal', t.dataset.id); closeModal(); return viewTracker(); },

  newGoal: () => mGoal(null),
  openGoal: t => mGoal(t.dataset.id),
  goalType: async t => { collectGoalDraft(); D.goal.type = t.dataset.t; await put('goals', D.goal); return mGoal(D.goal.id); },
  stepAdd: async () => {
    collectGoalDraft();
    D.goal.steps = D.goal.steps || [];
    D.goal.steps.push({ t: '', done: false });
    await put('goals', D.goal);
    return mGoal(D.goal.id);
  },
  stepDel: async t => { collectGoalDraft(); D.goal.steps.splice(+t.dataset.i, 1); await put('goals', D.goal); return mGoal(D.goal.id); },
  stepToggle: async t => {
    collectGoalDraft();
    const s = D.goal.steps[+t.dataset.i];
    s.done = !s.done;
    await put('goals', D.goal);
    return mGoal(D.goal.id);
  },
  saveGoal: async () => {
    collectGoalDraft();
    D.goal.title = D.goal.title || 'Quête';
    await put('goals', D.goal);
    closeModal();
    S.view = 'tracker';
    S.trackTab = 'goals';
    return render();
  },
  delGoal: async t => {
    if (!confirm('Supprimer cette quête ?')) return;
    await del('goals', t.dataset.id);
    closeModal();
    return viewTracker();
  },

  /* ---------- guilde ---------- */
  editGuild: () => mGuild(),
  /* Le cadre du blason ouvre un tiroir : blason, ou fond d'écran. */
  crestUpload: async () => {
    const { ensureGuild, getWallpaper } = await import('./db.js');
    const g = await ensureGuild();
    const wall = await getWallpaper();
    const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const crestIcon = icon('<path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z"/>');
    const wallIcon = icon('<rect x="3" y="5" width="18" height="14" rx="2"/>'
      + '<circle cx="8.5" cy="10" r="1.5"/><path d="M4 17l5-4 3 2.5 3.5-3.5L20 16"/>');
    modal(`<div class="hd"><h2 style="margin:0">Images de la Guilde</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <div class="tiny muted" style="margin-bottom:12px">Choisis ce que cette image doit habiller.</div>` +
      opt('editGuild', '', crestIcon, 'Blason',
        'Nom, devise, présentation, image du blason et bannière', 'imgpick') +
      opt('pickWall', '', wallIcon, "Fond d'écran",
        wall.assetId ? "Remplacer l'image de fond de l'application" : "Image de fond de toute l'application",
        'imgpick arcane') +
      (g.crestAssetId || wall.assetId
        ? `<div class="row wrap" style="margin-top:14px">
            ${g.crestAssetId ? '<button class="btn-sm btn-ghost btn-danger" data-act="clearCrest">Retirer le blason</button>' : ''}
            ${wall.assetId ? '<button class="btn-sm btn-ghost btn-danger" data-act="clearWall">Retirer le fond d\'écran</button>' : ''}
          </div>`
        : ''));
  },
  clearCrest: async () => {
    const { ensureGuild } = await import('./db.js');
    const g = await ensureGuild();
    g.crestAssetId = null;
    g.crestKind = '';
    await saveGuild(g);
    await closeModal();
    toast('Blason retiré');
    return render();
  },
  pickGuildCrest: () => pickFiles(false, async f => {
    D.guild.crestAssetId = await saveAsset(f[0]); D.guild.crestKind = f[0].type; toast('Blason chargé');
  }),
  pickGuildBanner: () => pickFiles(false, async f => {
    D.guild.bannerAssetId = await saveAsset(f[0]); D.guild.bannerKind = f[0].type; toast('Bannière chargée');
  }),
  saveGuildInfo: async () => {
    const g = D.guild;
    g.name = document.getElementById('uName').value.trim() || "ANIM'CONNECT";
    g.motto = document.getElementById('uMotto').value.trim();
    g.desc = document.getElementById('uDesc').value;
    await saveGuild(g);
    closeModal();
    S.view = 'guild';
    return render();
  },

  /* ---------- fiches : profils utilisateur et personas IA ---------- */
  newChar: async t => {
    const kind = t.dataset.kind || CH.kind || 'user';
    const c = blankChar(kind);
    await putChar(kind, c);
    CH.kind = kind;
    CH.draft = c;
    S[kind === 'ai' ? 'personaId' : 'profileId'] = c.id;
    S.personaMode = kind === 'ai' ? 'char' : 'user';
    S.view = kind === 'ai' ? 'personas' : 'profiles';
    S.sheetEdit = true;
    S.activeRootId = null; S.branchMode = null;
    if (!(await getActiveChar(kind))) await setActiveChar(kind, c.id);
    return render();
  },
  pickChar: t => {
    const kind = t.dataset.kind || 'user';
    CH.kind = kind;
    S[kind === 'ai' ? 'personaId' : 'profileId'] = t.dataset.id;
    S.personaMode = kind === 'ai' ? 'char' : 'user';
    S.view = kind === 'ai' ? 'personas' : 'profiles';
    S.sheetEdit = false;
    S.activeRootId = null; S.branchMode = null;
    return render();
  },
  editChar: () => { S.sheetEdit = true; return render(); },
  cancelChar: () => { S.sheetEdit = false; return render(); },
  saveChar: async () => {
    collectCharDraft();
    if (CH.draft && !CH.draft.name) CH.draft.name = 'Sans nom';
    await persistDraft();
    S.sheetEdit = false;
    toast('Fiche enregistrée');
    return render();
  },
  activateChar: async t => {
    await setActiveChar(CH.kind, t.dataset.id);
    toast('Fiche active');
    return render();
  },
  delCharAsk: async t => {
    const kind = CH.kind;
    if (!confirm('Supprimer cette fiche ? Cette action est définitive.')) return;
    await delChar(kind, t.dataset.id);
    if ((await getActiveChar(kind)) === t.dataset.id) {
      const rest = await listChars(kind);
      await setActiveChar(kind, rest.length ? rest[0].id : null);
    }
    S[kind === 'ai' ? 'personaId' : 'profileId'] = null;
    S.sheetEdit = false;
    return render();
  },
  pickCharPortrait: () => pickFiles(false, async f => {
    collectCharDraft();
    CH.draft.portraitAssetId = await saveAsset(f[0]);
    CH.draft.portraitKind = f[0].type;
    await persistDraft();
    await refreshSheet();
    toast('Portrait chargé');
  }),
  pickCharBg: () => pickFiles(false, async f => {
    collectCharDraft();
    CH.draft.bgAssetId = await saveAsset(f[0]);
    CH.draft.bgKind = f[0].type;
    await persistDraft();
    await refreshSheet();
    const { setStageAsset } = await import('./ui.js');
    await setStageAsset(CH.draft.bgAssetId, CH.draft.bgKind);
    toast('Fond de fiche chargé');
  }),
  clearCharBg: async () => {
    collectCharDraft();
    CH.draft.bgAssetId = null;
    CH.draft.bgKind = '';
    await persistDraft();
    await refreshSheet();
    const { setStageAsset } = await import('./ui.js');
    await setStageAsset(null);
  },
  addAttr: async () => {
    collectCharDraft();
    CH.draft.attrs = CH.draft.attrs || [];
    CH.draft.attrs.push({ label: 'Attribut', value: 10 });
    return refreshSheet();
  },
  delAttr: async t => {
    collectCharDraft();
    CH.draft.attrs.splice(+t.dataset.i, 1);
    return refreshSheet();
  },
  addGauge: async () => {
    collectCharDraft();
    CH.draft.gauges = CH.draft.gauges || [];
    CH.draft.gauges.push({ label: 'Constante', cur: 5, max: 10 });
    return refreshSheet();
  },
  delGauge: async t => {
    collectCharDraft();
    CH.draft.gauges.splice(+t.dataset.i, 1);
    return refreshSheet();
  },

  /* ---------- thème jour / nuit ---------- */
  setTheme: t => {
    toast(`Thème : ${themeLabel(applyTheme(t.dataset.t)).toLowerCase()}`);
    return render();
  },

  /* ---------- fond d'écran ---------- */
  pickWall: () => {
    pickFiles(false, async f => {
      const id = await saveAsset(f[0]);
      await setWallpaper(id, f[0].type);
      toast("Fond d'écran enregistré");
      await render();
    });
    return closeModal();
  },
  clearWall: async () => {
    await setWallpaper(null);
    await closeModal();
    toast("Fond d'écran retiré");
    return render();
  },

  /* ---------- intelligence artificielle (BYOK) ---------- */
  aiProvider: async t => {
    const cfg = await getAI();
    if (t.value === cfg.provider) return;
    /* La clé d'un fournisseur n'a pas de sens chez un autre : on repart à zéro. */
    await saveAI({ provider: t.value, apiKey: '', baseUrl: '', model: '', models: [], checkedAt: 0 });
    setAiOut(null);
    toast(`Fournisseur : ${providerOf(t.value).name}`);
    return render();
  },
  aiSaveKey: async () => {
    const cfg = await getAI();
    const keyField = document.getElementById('aiKey');
    const baseField = document.getElementById('aiBase');
    const typed = keyField ? keyField.value.trim() : '';
    const next = {
      ...cfg,
      apiKey: typed || cfg.apiKey,
      baseUrl: baseField ? baseField.value.trim() : cfg.baseUrl
    };
    if (!next.apiKey) { toast('Saisis une clé API'); return; }
    await saveAI(next);
    if (keyField) keyField.value = '';
    toast('Clé enregistrée sur cet appareil');
    return A.aiLoadModels();
  },
  aiLoadModels: async () => {
    const cfg = await getAI();
    if (!cfg.apiKey) { toast('Aucune clé enregistrée'); return; }
    toast('Chargement des modèles…');
    try {
      const models = await listModels(cfg);
      const keep = models.some(m => m.id === cfg.model) ? cfg.model : '';
      await saveAI({ ...cfg, models, model: keep });
      setAiOut(null);
      toast(`${models.length} modèle(s) disponibles`);
    } catch (err) {
      setAiOut(err.message, true);
    }
    return render();
  },
  aiPickModel: async t => {
    const cfg = await getAI();
    await saveAI({ ...cfg, model: t.value });
    if (t.value) toast(`Modèle : ${t.value}`);
    return render();
  },
  aiSetModelFree: async () => {
    const f = document.getElementById('aiModelFree');
    const v = f ? f.value.trim() : '';
    if (!v) { toast('Saisis un identifiant de modèle'); return; }
    const cfg = await getAI();
    await saveAI({ ...cfg, model: v });
    toast(`Modèle : ${v}`);
    return render();
  },
  aiTest: async () => {
    const cfg = await getAI();
    toast('Essai en cours…');
    try {
      const reply = await chat(cfg, [
        { role: 'system', content: "Tu réponds en français, en une phrase courte." },
        { role: 'user', content: "Présente-toi en une phrase : qui es-tu et quel modèle es-tu ?" }
      ], { maxTokens: 128 });
      setAiOut(reply || '(réponse vide)', false);
      await saveAI({ ...cfg, checkedAt: Date.now() });
      toast('Le modèle a répondu');
    } catch (err) {
      setAiOut(err.message, true);
      toast('Échec de l\'essai');
    }
    return render();
  },
  aiClear: async () => {
    if (!confirm("Effacer la clé API et le modèle choisi de cet appareil ?")) return;
    await clearAI();
    setAiOut(null);
    toast('Clé effacée');
    return render();
  },

  /* ---------- coffre ---------- */
  persist: async () => {
    const ok = await navigator.storage.persist();
    toast(ok ? 'Stockage permanent accordé' : 'Refusé par le navigateur');
    return render();
  },
  wipe: async () => {
    if (!confirm('Effacer TOUTES les données du grimoire ? Irréversible.')) return;
    const { DBN } = await import('./db.js');
    indexedDB.deleteDatabase(DBN);
    location.reload();
  }
};

export function initActions() {
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = A[t.dataset.act];
    if (!fn) return;
    e.stopPropagation();
    try { await fn(t, e); }
    catch (err) { console.error(err); toast('Erreur : ' + err.message); }
  });
  document.addEventListener('change', async e => {
    const t = e.target.closest('[data-change]');
    if (!t) return;
    const fn = A[t.dataset.change];
    if (!fn) return;
    try { await fn(t, e); }
    catch (err) { console.error(err); toast('Erreur : ' + err.message); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[role="button"][data-act]');
    if (!t || t.tagName === 'BUTTON') return;
    e.preventDefault();
    t.click();
  });
}
