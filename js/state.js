export const S = {
  view: 'guild',        // guild | hourglass | sphere | personas | tracker | group | project | music | settings | experience | vault
  houseKey: 'guild',    // maison dont on parcourt les salles
  groupId: null,
  projectId: null,
  experienceRootId: null,
  activeRootId: null,
  branchMode: null,     // creation | experience
  ptab: 'tracks',       // tracks | timeline | elements | prod
  trackTab: 'library',  // library | cal | goals | vault
  calMonth: new Date(),
  vzoom: 3.2,           // pixels par seconde (vertical)
  follow: true,
  laneFilter: null,
  /* Tour Hourglass */
  subjectId: null,      // sujet ouvert dans la salle Sujets
  scenarioId: null,     // scénario ouvert dans la salle Scénario
  liveScenarioId: null, // scénario retenu dans Eye ou Gates
  liveCast: null,       // { user, ai: [] }
  sessionId: null,      // scène en cours
  /* personas */
  personaGroupId: null, // groupe de personas ouvert, ou null pour « tous »
  personaId: null,      // fiche ouverte
  sheetEdit: false      // la fiche affichée est en édition
};

/* Les trois branches fixes de la bibliothèque. Les catégories créées par
   l'utilisateur vivent toujours sous l'une d'elles, comme des dossiers. */
export const ROOTS = [
  {
    id: 'root-histoires', key: 'histoires', name: 'Histoires', singular: 'Histoire', rune: 'H', order: 1,
    desc: 'Récits linéaires, interactifs, audio, vidéo et transmédias.'
  },
  {
    id: 'root-jeux', key: 'jeux', name: 'Jeux', singular: 'Jeu', rune: 'J', order: 2,
    desc: 'Jeux de plateau, de cartes, numériques et expériences grandeur nature.'
  },
  {
    id: 'root-expo', key: 'expo', name: 'Expo', singular: 'Exposition', rune: 'E', order: 3,
    desc: 'Expositions, galeries, collections et parcours de découverte.'
  }
];

export const rootInfo = id => ROOTS.find(r => r.id === id) || null;

/* ---------- les trois maisons ----------
   Trois pages d'accueil : la Guilde en est le nexus, la Tour Hourglass
   ouvre les Histoires, la Sphère ludique ouvre les Jeux. Chacune a sa
   bannière, ses chiffres, son cercle de personas et son registre. */
export const HOUSES = [
  {
    key: 'guild', view: 'guild', kv: 'guild', name: 'Guilde', title: 'Guilde', nav: 'Guilde',
    sub: 'Le nexus de l\'atelier', milieuId: 'milieu-guilde', rootId: null,
    motto: 'Lire, voir, entendre, vivre, interagir.',
    desc: "Atelier de création ludique : histoires, jeux et expositions. Ici se tiennent les registres, "
        + "les quêtes en cours et le cercle de celles et ceux qui les mènent."
  },
  {
    key: 'hourglass', view: 'hourglass', kv: 'house-hourglass', name: 'Hourglass',
    title: 'Tour Hourglass', nav: 'Hourglass', sub: 'Les Histoires', milieuId: 'milieu-hourglass', rootId: 'root-histoires',
    motto: 'Le temps se raconte, grain après grain.',
    desc: "La tour des récits : mondes, personnages et chronologies. On y range les histoires "
        + "linéaires, interactives, audio, vidéo et transmédias."
  },
  {
    key: 'sphere', view: 'sphere', kv: 'house-sphere', name: 'Sphere',
    title: 'Sphère ludique', nav: 'Sphère', sub: 'Les Jeux', milieuId: 'milieu-sphere', rootId: 'root-jeux',
    motto: 'Tout tourne autour du jeu.',
    desc: "La sphère des jeux : plateaux, cartes, expériences numériques et grandeur nature. "
        + "On y range les univers jouables et leurs règles."
  }
];

export const houseOf = view => HOUSES.find(h => h.view === view) || HOUSES[0];

/* ---------- les salles, propres à chaque maison ---------- */
export const HALLS_BY_HOUSE = {
  guild: ['library', 'cal', 'goals', 'vault'],
  hourglass: ['subjects', 'scenario', 'eye', 'gates'],
  sphere: ['library', 'cal', 'goals', 'vault']
};

/* ---------- la chaîne des sujets, dans la Tour Hourglass ----------
   Chaque maillon dépend du précédent : un monde tient à son univers,
   une ère à son monde, une époque à son ère, une saga à son époque.
   L'élément, lui, se pose sur une époque et peut traverser plusieurs
   sagas — en parallèle ou en série. */
export const SUBJECT_KINDS = [
  { key: 'univers', one: 'Univers', many: 'Univers', parent: null,
    desc: "Le tout : les lois, la matière, ce qui existe." },
  { key: 'monde', one: 'Monde', many: 'Mondes', parent: 'univers',
    desc: "Un lieu du monde : une planète, un royaume, une cité." },
  { key: 'ere', one: 'Ère', many: 'Ères', parent: 'monde',
    desc: "Un grand âge de ce monde." },
  { key: 'epoque', one: 'Époque', many: 'Époques', parent: 'ere',
    desc: "Un temps précis dans cette ère." },
  { key: 'saga', one: 'Saga', many: 'Sagas', parent: 'epoque',
    desc: "Un fil d'histoires qui traverse cette époque." },
  { key: 'element', one: 'Élément', many: 'Éléments', parent: 'epoque', multi: 'saga',
    desc: "Personnage, lieu, objet, fait. Il tient à son époque et peut courir sur plusieurs sagas." }
];

export const subjectKind = k => SUBJECT_KINDS.find(x => x.key === k) || SUBJECT_KINDS[0];
export const childKind = k => SUBJECT_KINDS.find(x => x.parent === k && x.key !== 'element') || null;
export const houseByKey = key => HOUSES.find(h => h.key === key) || HOUSES[0];

export const CATS = ['Univers', 'Décors', 'Personnages', 'Objets', 'Sons', 'Effets', 'Autres'];

export const LANES = [
  ['Univers', '#4285f4'], ['Décors', '#1e8e3e'], ['Personnages', '#d93025'], ['Objets', '#e37400'],
  ['Actions', '#8e6cf1'], ['Son / Dialogue', '#0097a7'], ['Caméra', '#5f6368']
];

export const PIPE = ['Écriture', 'Storyboard', 'Repérage', 'Tournage', 'Montage',
  'Habillage son', 'Étalonnage', 'Export', 'Diffusion'];

/* ---------- personas ---------- */

/* Un persona est d'abord une fiche ; son rôle se choisit ensuite, sur la
   fiche elle-même. Trois rôles, dont deux pour l'IA. */
export const ROLES = [
  ['user', 'Utilisateur', 'Contrôlé par toi', 'Persona utilisateur'],
  ['ai-assistant', 'IA · assistant', 'Assistant de création, à tes côtés', 'Persona IA · assistant créateur'],
  ['ai-living', 'IA · vivant', 'Personnage vivant, pour les expériences', 'Persona IA · vivant']
];

export const roleOf = r => ROLES.find(x => x[0] === r) || ROLES[0];
export const isAI = r => String(r || '').startsWith('ai');

/* Les personas de la guilde se rangent dans des groupes libres :
   « ceux qui y travaillent », « les membres », « le conseil »… Un seul
   niveau, entièrement personnalisable. */
export const GROUP_DEFAULT = { id: 'grp-membres', name: 'Membres', at: 0 };

/* Gabarit d'une fiche. Les entrées marquées « ai » n'apparaissent que
   pour les personas tenus par l'IA. */
export const PERSONA = {
  title: 'Personas', sub: 'Fiches des personas',
  one: 'Persona', newName: 'Nouveau persona', accent: '#8e6cf1',
  gauges: [['Vitalité', 8, 10], ['Énergie', 7, 10], ['Inspiration', 6, 10]],
  attrs: [['Imagination', 12], ['Rigueur', 10], ['Verbe', 11], ['Rythme', 9], ['Main', 10], ['Souffle', 8]],
  ident: [
    ['level', 'Rang', '1', 'all'],
    ['role', 'Fonction', 'Conteur · Scénographe', 'all'],
    ['origin', 'Origine', "Anim'Connect", 'all'],
    ['align', 'Tempérament', 'Ardent et méthodique', 'all'],
    ['voice', 'Voix', 'Grave, posée', 'ai'],
    ['model', 'Moteur', 'À préciser', 'ai']
  ],
  panels: [
    ['traits', 'Traits', 'chips', 'Un trait par ligne\nPatient\nCurieux', 'all'],
    ['skills', 'Compétences', 'list', 'Un par ligne — « Nom | précision »\nComposition | piano, orchestration', 'all'],
    ['gear', 'Équipement', 'list', 'Un par ligne — « Nom | précision »\nCarnet de croquis | toujours dans le sac', 'all'],
    ['directives', 'Directives', 'prose', 'Ce que ce persona doit toujours faire, et ne jamais faire…', 'ai'],
    ['memory', 'Mémoire', 'prose', "Ce qu'il retient d'une session à l'autre…", 'ai'],
    ['bio', 'Histoire', 'prose', "D'où vient ce persona, ce qu'il cherche…", 'all'],
    ['notes', 'Notes', 'prose', 'Rappels, préférences, méthode de travail…', 'all']
  ]
};

/* Champs et panneaux retenus pour un rôle donné. */
export const identFor = role => PERSONA.ident.filter(f => f[3] === 'all' || isAI(role));
export const panelsFor = role => PERSONA.panels.filter(p => p[4] === 'all' || isAI(role));

/* Rangs de la guilde, du plus modeste au plus haut. */
export const GUILD_RANKS = [
  'Braise', 'Étincelle', 'Flambeau', 'Fanal', 'Brasier',
  'Forge', 'Phare', 'Aurore', 'Soleil noir', 'Grand Œuvre'
];
