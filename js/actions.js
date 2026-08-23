import {
  get, put, del, all, byIdx, saveAsset, assetURL,
  deleteGroupTree, isProject, rootForGroup, rootForProject, isRootGroup,
  saveHouse, putPersona, delPersona, setActivePersona, getActivePersona, listPersonas,
  listMilieux, listSubMilieux, putMilieu, delMilieu, setWallpaper
} from './db.js';
import { S, PIPE, ROOTS, rootInfo, MILIEU_ROOTS, MILIEU_GUILDE, milieuRoot, houseOf, houseByKey } from './state.js';
import { closeModal, modal, opt, pickOf, openPickList, closePickList } from './ui.js';
import { pickFiles, probeDuration, toast, uid, today, esc } from './utils.js';
import { audio, PL, loadQueue, playIndex, seekGlobal, globalTime, stopAll, renderBand } from './player.js';
import { render, goBack } from './router.js';
import { viewProject } from './views/project.js';
import { viewTracker } from './views/tracker.js';
import {
  D, mGroup, mProject, mEvent, mElement, mTrack, mCal, mGoal, mGuild, mMilieu, collectGoalDraft
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

  /* ---------- sélecteur maison ---------- */
  openPick: t => openPickList(t.dataset.id),
  closePick: () => closePickList(),
  filterPick: t => openPickList(t.dataset.id, t.value),
  choosePick: async t => {
    const id = t.dataset.id;
    const field = document.getElementById(id);
    const P = pickOf(id);
    if (field) field.value = t.dataset.v;
    closePickList();
    /* Le champ affiche la valeur choisie, même sans nouveau rendu. */
    const btn = document.querySelector(`.pickbtn[data-id="${id}"] .pickval`);
    const opt_ = P && P.options.find(o => String(o.value) === String(t.dataset.v));
    if (btn && opt_) { btn.textContent = opt_.label; btn.classList.remove('phv'); }
    if (P && P.act && A[P.act]) return A[P.act]({ value: t.dataset.v, dataset: {} });
  },
  /* Une salle de la maison où l'on se trouve. La Bibliothèque d'une maison
     à branche ouvre directement cette branche. */
  hall: async t => {
    const H = houseByKey(S.houseKey);
    S.trackTab = t.dataset.t;
    if (t.dataset.t === 'library' && H.rootId) {
      S.activeRootId = H.rootId;
      S.branchMode = S.branchMode || 'creation';
      S.groupId = H.rootId;
      S.projectId = null;
      S.view = 'group';
      return render();
    }
    if (t.dataset.t === 'library') { S.activeRootId = null; S.branchMode = null; S.groupId = null; S.projectId = null; }
    S.view = 'tracker';
    return render();
  },
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
  editGuild: () => mGuild(houseOf(S.view).key),
  /* Le cadre du blason ouvre un tiroir : blason, ou fond d'écran. */
  crestUpload: async () => {
    const { ensureHouse, getWallpaper } = await import('./db.js');
    const H = houseOf(S.view);
    const g = await ensureHouse(H.key);
    const wall = await getWallpaper();
    const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const crestIcon = icon('<path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z"/>');
    const wallIcon = icon('<rect x="3" y="5" width="18" height="14" rx="2"/>'
      + '<circle cx="8.5" cy="10" r="1.5"/><path d="M4 17l5-4 3 2.5 3.5-3.5L20 16"/>');
    modal(`<div class="hd"><h2 style="margin:0">Images de la Guilde</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <div class="tiny muted" style="margin-bottom:12px">Choisis ce que cette image doit habiller.</div>` +
      opt('editGuild', '', crestIcon, `Blason · ${esc(H.title)}`,
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
    const { ensureHouse } = await import('./db.js');
    const H = houseOf(S.view);
    const g = await ensureHouse(H.key);
    g.crestAssetId = null;
    g.crestKind = '';
    await saveHouse(H.key, g);
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
    const key = D.houseKey || 'guild';
    g.name = document.getElementById('uName').value.trim() || houseByKey(key).name;
    g.motto = document.getElementById('uMotto').value.trim();
    g.desc = document.getElementById('uDesc').value;
    await saveHouse(key, g);
    closeModal();
    return render();
  },

  /* ---------- fiches : profils utilisateur et personas IA ---------- */
  newChar: async () => {
    const c = blankChar(S.subMilieuId || S.milieuRootId || MILIEU_GUILDE.id);
    await putPersona(c);
    CH.draft = c;
    S.personaId = c.id;
    S.view = 'personas';
    S.sheetEdit = true;
    S.activeRootId = null; S.branchMode = null;
    if (!(await getActivePersona())) await setActivePersona(c.id);
    return render();
  },
  pickChar: t => {
    S.personaId = t.dataset.id;
    S.view = 'personas';
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
    await setActivePersona(t.dataset.id);
    toast('Fiche active');
    return render();
  },
  delCharAsk: async t => {
    if (!confirm('Supprimer cette fiche ? Cette action est définitive.')) return;
    await delPersona(t.dataset.id);
    if ((await getActivePersona()) === t.dataset.id) {
      const rest = await listPersonas();
      await setActivePersona(rest.length ? rest[0].id : null);
    }
    S.personaId = null;
    S.sheetEdit = false;
    return render();
  },

  /* ---------- rôle et milieu d'un persona ---------- */
  setRole: async t => {
    collectCharDraft();
    if (!CH.draft) return;
    CH.draft.role = t.dataset.r;
    await persistDraft();
    return render();
  },
  setMilieu: async t => {
    collectCharDraft();
    if (!CH.draft) return;
    CH.draft.milieuId = t.value;
    CH.draft.alsoIn = (CH.draft.alsoIn || []).filter(x => x !== t.value);
    await persistDraft();
    toast('Milieu d\'origine mis à jour');
    return render();
  },
  toggleAlsoIn: async t => {
    collectCharDraft();
    if (!CH.draft) return;
    const id = t.dataset.id;
    const cur = CH.draft.alsoIn || [];
    CH.draft.alsoIn = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    await persistDraft();
    return render();
  },

  /* ---------- milieux ---------- */
  pickMilieu: t => {
    S.milieuRootId = t.dataset.id;
    S.subMilieuId = null;
    S.personaId = null;
    S.sheetEdit = false;
    S.view = 'personas';
    return render();
  },
  pickSubMilieu: t => {
    S.subMilieuId = t.dataset.id || null;
    S.personaId = null;
    S.sheetEdit = false;
    S.view = 'personas';
    return render();
  },
  /* Un sous-groupe se crée de toutes pièces, ou se reprend d'un monde
     ou d'une catégorie de jeu déjà bâtis dans la Bibliothèque. */
  newMilieu: async () => {
    const root = milieuRoot(S.milieuRootId) || MILIEU_GUILDE;
    if (!root.sourceRoot) return mMilieu(null, root.id);
    const groups = (await all('groups')).filter(g => g.parentId === root.sourceRoot);
    const taken = (await listSubMilieux(root.id)).map(m => m.sourceGroupId).filter(Boolean);
    const free = groups.filter(g => !taken.includes(g.id));
    const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    modal(`<div class="hd"><h2 style="margin:0">Sous-groupe de ${esc(root.name)}</h2><div class="sp"></div>
      <button class="btn-sm btn-ghost" data-act="closeModal">Fermer</button></div>
      <div class="tiny muted" style="margin-bottom:12px">${esc(root.desc)}</div>` +
      opt('newMilieuFree', `data-parent="${root.id}"`,
        icon('<path d="M12 5v14M5 12h14"/>'), 'Créer un sous-groupe',
        `Un ${esc(root.sourceOne)} qui n'existe pas encore dans la Bibliothèque`, 'imgpick') +
      (free.length
        ? `<div class="frt" style="margin:16px 0 8px">Reprendre des ${esc(root.sourceMany)}</div>` +
          free.map(g => opt('addMilieuFromGroup', `data-parent="${root.id}" data-id="${g.id}"`,
            icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
            esc(g.name), esc(g.desc || `Reprendre ce ${root.sourceOne} comme milieu`), 'imgpick arcane')).join('')
        : `<div class="fnote" style="margin-top:14px">Aucun ${esc(root.sourceOne)} disponible dans la
           Bibliothèque : tous sont déjà repris, ou il n'y en a pas encore.</div>`));
  },
  newMilieuFree: async t => {
    await closeModal();
    return mMilieu(null, t.dataset.parent);
  },
  addMilieuFromGroup: async t => {
    const g = await get('groups', t.dataset.id);
    if (!g) return;
    const id = uid();
    await putMilieu({ id, name: g.name, parentId: t.dataset.parent, sourceGroupId: g.id, at: Date.now() });
    await closeModal();
    S.milieuRootId = t.dataset.parent;
    S.subMilieuId = id;
    S.personaId = null;
    S.view = 'personas';
    toast(`« ${g.name} » ajouté aux milieux`);
    return render();
  },
  editMilieu: t => mMilieu(t.dataset.id || S.subMilieuId, null),
  saveMilieu: async t => {
    const id = t.dataset.id || uid();
    const name = document.getElementById('mName').value.trim() || 'Milieu sans nom';
    const old = (await listMilieux()).find(m => m.id === id);
    await putMilieu({
      ...(old || {}), id, name,
      parentId: (old && old.parentId) || t.dataset.parent || MILIEU_GUILDE.id,
      at: (old && old.at) || Date.now()
    });
    await closeModal();
    S.milieuRootId = (old && old.parentId) || t.dataset.parent || S.milieuRootId;
    S.subMilieuId = id;
    S.personaId = null;
    S.view = 'personas';
    toast('Milieu enregistré');
    return render();
  },
  delMilieuAsk: async t => {
    if (MILIEU_ROOTS.some(r => r.id === t.dataset.id)) { toast('Ce milieu ne se supprime pas'); return; }
    if (!confirm('Supprimer ce sous-groupe ? Ses personas remontent au milieu parent.')) return;
    await delMilieu(t.dataset.id);
    S.subMilieuId = null;
    S.personaId = null;
    toast('Sous-groupe supprimé');
    return render();
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
  document.addEventListener('input', async e => {
    const t = e.target.closest('[data-input]');
    if (!t) return;
    const fn = A[t.dataset.input];
    if (!fn) return;
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
