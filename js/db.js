import { uid } from './utils.js';
import { ROOTS, MILIEU_ROOTS, MILIEU_GUILDE } from './state.js';

export const DBN = 'GRIMOIRE_ANIMCONNECT';
const DBV = 5;
let DB = null;

export function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DBN, DBV);
    r.onupgradeneeded = () => {
      const d = r.result, up = r.transaction;
      const mk = (n, idx) => {
        const s = d.objectStoreNames.contains(n) ? up.objectStore(n) : d.createObjectStore(n, { keyPath: 'id' });
        (idx || []).forEach(i => { if (!s.indexNames.contains(i)) s.createIndex(i, i); });
      };
      mk('groups', ['parentId']);
      mk('projects', ['groupId']);
      mk('assets');
      mk('tracks', ['projectId']);
      mk('lanes', ['projectId']);
      mk('events', ['projectId']);
      mk('elements', ['projectId']);
      mk('cal', ['date']);
      mk('goals');
      mk('profiles');
      mk('personas', ['milieuId']);
      mk('milieux');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
    };
    r.onsuccess = () => { DB = r.result; res(DB); };
    r.onerror = () => rej(r.error);
  });
}

const store = (s, m = 'readonly') => DB.transaction(s, m).objectStore(s);
const P = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const put = (s, o) => P(store(s, 'readwrite').put(o));
export const del = (s, k) => P(store(s, 'readwrite').delete(k));
export const get = (s, k) => P(store(s).get(k));
export const all = s => P(store(s).getAll());
export const byIdx = (s, i, v) => P(store(s).index(i).getAll(v));

/* ---- branches fixes de la bibliothèque ---- */
export async function ensureRootCategories() {
  for (const r of ROOTS) {
    const old = await get('groups', r.id);
    await put('groups', {
      ...(old || {}),
      id: r.id,
      name: r.name,
      desc: (old && old.desc) || r.desc,
      parentId: '',
      rootType: r.key,
      systemRoot: true,
      at: r.order
    });
  }

  /* Préserve les anciennes catégories racines : elles deviennent des dossiers
     de la branche Histoires au lieu d'être supprimées. */
  const rootIds = new Set(ROOTS.map(r => r.id));
  const groups = await all('groups');
  for (const g of groups) {
    if (!rootIds.has(g.id) && !g.parentId) {
      g.parentId = ROOTS[0].id;
      g.migratedFromRoot = true;
      await put('groups', g);
    }
  }

  const groupIds = new Set((await all('groups')).map(g => g.id));
  for (const p of await all('projects')) {
    if (!p.groupId || !groupIds.has(p.groupId)) {
      p.groupId = ROOTS[0].id;
      p.migratedFromRoot = true;
      await put('projects', p);
    }
  }
}

/* ---- réglages simples (clé / valeur) ---- */
export const getKV = async (k, fallback) => {
  const r = await get('kv', k);
  return r && r.v !== undefined ? r.v : fallback;
};
export const setKV = (k, v) => put('kv', { k, v });

/* ---- fond d'écran : une seule image ou vidéo, jour comme nuit ---- */
export async function getWallpaper() {
  const w = await getKV('wallpaper', null);
  if (w && w.assetId) return w;
  /* Ancienne forme : un fond par thème. On reprend celui qui existe. */
  const old = await getKV('wallpapers', null);
  if (old) {
    if (old.light && old.light.assetId) return old.light;
    if (old.dark && old.dark.assetId) return old.dark;
  }
  return {};
}

export const setWallpaper = (assetId, kind) =>
  setKV('wallpaper', assetId ? { assetId, kind: kind || '' } : {});

/* ---- identité de la guilde ---- */
export const GUILD_DEFAULT = {
  k: 'guild',
  name: "Anim'Connect",
  motto: 'Lire, voir, entendre, vivre, interagir.',
  desc: "Atelier de création ludique : histoires, jeux et expositions. Ici se tiennent les registres, "
      + "les quêtes en cours et le cercle de celles et ceux qui les mènent.",
  rune: 'A',
  crestAssetId: null, crestKind: '',
  bannerAssetId: null, bannerKind: ''
};

export async function ensureGuild() {
  const cur = await get('kv', 'guild');
  if (cur && cur.name) return cur;
  const g = { ...GUILD_DEFAULT, ...(cur || {}), k: 'guild' };
  await put('kv', g);
  return g;
}

export const saveGuild = g => put('kv', { ...g, k: 'guild' });

/* ---- personas ----------------------------------------------------
   Une seule famille de fiches. Le rôle (utilisateur, IA assistante,
   IA vivante) se choisit sur la fiche ; les milieux les rangent.
   ------------------------------------------------------------------ */

export const listPersonas = async milieuId => {
  const all_ = (await all('personas')).sort((a, b) => (a.at || 0) - (b.at || 0));
  return milieuId ? all_.filter(c => (c.milieuId || MILIEU_GUILDE.id) === milieuId) : all_;
};

export const getPersona = id => get('personas', id);
export const putPersona = c => put('personas', c);
export const delPersona = id => del('personas', id);

export const getActivePersona = () => getKV('active-persona', null);
export const setActivePersona = id => setKV('active-persona', id);

/* ---- milieux : les dossiers des personas ----
   Trois racines fixes, et des sous-groupes libres sous chacune. */
export const listMilieux = async () => {
  const stored = await all('milieux');
  const roots = MILIEU_ROOTS.map(r => ({ ...r, ...(stored.find(m => m.id === r.id) || {}), system: true }));
  const subs = stored.filter(m => m.parentId).sort((a, b) => (a.at || 0) - (b.at || 0));
  return [...roots, ...subs];
};

export const listSubMilieux = async parentId =>
  (await all('milieux')).filter(m => m.parentId === parentId).sort((a, b) => (a.at || 0) - (b.at || 0));

export const getMilieu = async id => (await listMilieux()).find(m => m.id === id) || null;
export const putMilieu = m => put('milieux', m);

/* Personas d'un milieu : ceux qui en viennent, et ceux qui y passent.
   Un persona rangé ailleurs peut très bien tenir un rôle ici. */
export async function personasOf(milieuId, withSubs) {
  const subs = withSubs ? (await listSubMilieux(milieuId)).map(m => m.id) : [];
  const ids = [milieuId, ...subs];
  return (await listPersonas()).filter(c =>
    ids.includes(c.milieuId || MILIEU_GUILDE.id) || (c.alsoIn || []).some(x => ids.includes(x)));
}

/* Le persona vient-il d'ici, ou n'y est-il qu'invité ? */
export const isGuestIn = (c, milieuId) => (c.milieuId || MILIEU_GUILDE.id) !== milieuId;

export async function delMilieu(id) {
  if (MILIEU_ROOTS.some(r => r.id === id)) return false;
  const sub = await get('milieux', id);
  const fallback = (sub && sub.parentId) || MILIEU_GUILDE.id;
  for (const c of await listPersonas()) {
    let touched = false;
    if ((c.milieuId || MILIEU_GUILDE.id) === id) { c.milieuId = fallback; touched = true; }
    if ((c.alsoIn || []).includes(id)) { c.alsoIn = c.alsoIn.filter(x => x !== id); touched = true; }
    if (touched) await putPersona(c);
  }
  await del('milieux', id);
  return true;
}

/* Les trois racines existent toujours. */
export async function ensureMilieux() {
  for (const r of MILIEU_ROOTS) {
    const cur = await get('milieux', r.id);
    await put('milieux', { ...r, ...(cur || {}), id: r.id, name: (cur && cur.name) || r.name, system: true });
  }
}

/* Reprise des données d'avant la fusion : les profils rejoignent les
   personas avec le rôle « utilisateur », les personas d'alors gardent
   leur rôle d'assistant, et tout le monde entre dans la Guilde. */
export async function migratePersonas() {
  if (await getKV('personas-fusionnes', false)) return;

  for (const c of await all('profiles')) {
    const { kind, ...rest } = c;
    await put('personas', { ...rest, role: 'user', milieuId: c.milieuId || MILIEU_GUILDE.id });
    await del('profiles', c.id);
  }
  for (const c of await all('personas')) {
    if (c.role && c.milieuId) continue;
    const { kind, ...rest } = c;
    await put('personas', {
      ...rest,
      role: c.role || (c.kind === 'user' ? 'user' : 'ai-assistant'),
      milieuId: c.milieuId || MILIEU_GUILDE.id
    });
  }

  /* Une seule fiche active désormais : l'ancienne IA active, sinon l'ancien profil. */
  if (!(await getKV('active-persona', null))) {
    const ai = await getKV('active-ai', null);
    const user = await getKV('active-user', null);
    const keep = (ai && await get('personas', ai)) ? ai : ((user && await get('personas', user)) ? user : null);
    if (keep) await setKV('active-persona', keep);
  }
  await setKV('personas-fusionnes', true);
}

/* ---- fichiers : conservés tels quels, sans conversion ni compression ---- */
export async function saveAsset(file) {
  const a = {
    id: uid(), name: file.name || 'fichier', type: file.type || 'application/octet-stream',
    size: file.size || 0, blob: file, at: Date.now()
  };
  await put('assets', a);
  return a.id;
}

const urlCache = new Map();
export async function assetURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const a = await get('assets', id);
  if (!a) return null;
  const u = URL.createObjectURL(a.blob);
  urlCache.set(id, u);
  return u;
}

/* ---- arbre de groupes ---- */
export const childGroups = async parentId => (await byIdx('groups', 'parentId', parentId || ''))
  .sort((a, b) => (a.at || 0) - (b.at || 0));

export const groupProjects = async groupId => (await byIdx('projects', 'groupId', groupId || ''))
  .sort((a, b) => (b.at || 0) - (a.at || 0));

export async function groupPath(id) {
  const path = [];
  let cur = id;
  while (cur) {
    const g = await get('groups', cur);
    if (!g) break;
    path.unshift(g);
    cur = g.parentId || null;
    if (path.length > 40) break;
  }
  return path;
}

export async function rootForGroup(id) {
  if (!id) return null;
  const path = await groupPath(id);
  return path.length && ROOTS.some(r => r.id === path[0].id) ? path[0] : null;
}

export async function rootForProject(projectOrId) {
  const p = typeof projectOrId === 'string' ? await get('projects', projectOrId) : projectOrId;
  return p ? rootForGroup(p.groupId) : null;
}

export const isRootGroup = id => ROOTS.some(r => r.id === id);

/* compte récursif : sous-groupes et projets contenus à tous les niveaux */
export async function countDeep(groupId) {
  let groups = 0, projects = (await groupProjects(groupId)).length;
  for (const c of await childGroups(groupId)) {
    groups++;
    const sub = await countDeep(c.id);
    groups += sub.groups;
    projects += sub.projects;
  }
  return { groups, projects };
}

/* supprime un groupe et toute sa descendance ; les projets remontent au parent */
export async function deleteGroupTree(groupId, moveProjectsTo) {
  for (const p of await groupProjects(groupId)) { p.groupId = moveProjectsTo || ''; await put('projects', p); }
  for (const t of await byIdx('tracks', 'projectId', groupId)) await del('tracks', t.id);
  for (const c of await childGroups(groupId)) await deleteGroupTree(c.id, moveProjectsTo);
  await del('groups', groupId);
}

export const getOwner = async id => (await get('projects', id)) || (await get('groups', id)) || null;
export const isProject = async id => !!(await get('projects', id));
