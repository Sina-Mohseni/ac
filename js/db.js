import { uid } from './utils.js';
import { ROOTS } from './state.js';

export const DBN = 'GRIMOIRE_ANIMCONNECT';
const DBV = 4;
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
      mk('personas');
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

/* ---- fonds d'écran : un pour le jour, un pour la nuit ---- */
export const getWallpapers = async () => ({ light: {}, dark: {}, ...(await getKV('wallpapers', {})) });

export const getWallpaper = async theme => {
  const w = await getWallpapers();
  return w[theme === 'dark' ? 'dark' : 'light'] || {};
};

export async function setWallpaper(theme, assetId, kind) {
  const w = await getWallpapers();
  w[theme === 'dark' ? 'dark' : 'light'] = assetId ? { assetId, kind: kind || '' } : {};
  await setKV('wallpapers', w);
  return w;
}

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

/* ---- fiches de personnage : profils utilisateur et personas IA ---- */
export const charStore = kind => (kind === 'ai' ? 'personas' : 'profiles');

export const listChars = async kind =>
  (await all(charStore(kind))).sort((a, b) => (a.at || 0) - (b.at || 0));

export const getChar = (kind, id) => get(charStore(kind), id);
export const putChar = (kind, c) => put(charStore(kind), c);
export const delChar = (kind, id) => del(charStore(kind), id);

export const activeKey = kind => (kind === 'ai' ? 'active-ai' : 'active-user');
export const getActiveChar = kind => getKV(activeKey(kind), null);
export const setActiveChar = (kind, id) => setKV(activeKey(kind), id);

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
