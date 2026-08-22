export const S = {
  view: 'guild',        // guild | tracker | group | project | profiles | personas | music | settings | experience | vault
  groupId: null,
  projectId: null,
  experienceRootId: null,
  activeRootId: null,
  branchMode: null,     // creation | experience
  personaMode: null,    // user | char
  ptab: 'tracks',       // tracks | timeline | elements | prod
  trackTab: 'library',  // library | cal | goals | vault
  calMonth: new Date(),
  vzoom: 3.2,           // pixels par seconde (vertical)
  follow: true,
  laneFilter: null,
  /* fiches de personnage */
  profileId: null,      // fiche utilisateur ouverte
  personaId: null,      // fiche IA ouverte
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

export const CATS = ['Univers', 'Décors', 'Personnages', 'Objets', 'Sons', 'Effets', 'Autres'];

export const LANES = [
  ['Univers', '#4285f4'], ['Décors', '#1e8e3e'], ['Personnages', '#d93025'], ['Objets', '#e37400'],
  ['Actions', '#8e6cf1'], ['Son / Dialogue', '#0097a7'], ['Caméra', '#5f6368']
];

export const PIPE = ['Écriture', 'Storyboard', 'Repérage', 'Tournage', 'Montage',
  'Habillage son', 'Étalonnage', 'Export', 'Diffusion'];

/* ---------- fiches de personnage ---------- */

/* Deux familles de fiches : les profils (personas utilisateur) et les personas IA.
   Même mise en page, vocabulaire et attributs différents. */
export const KINDS = {
  user: {
    key: 'user', store: 'profiles', view: 'profiles',
    title: 'Profils', sub: 'Fiches des personas utilisateur',
    one: 'Profil', newName: 'Nouveau profil', accent: '#1e8e3e', rune: 'U',
    kindLabel: 'Persona utilisateur',
    gauges: [['Vitalité', 8, 10], ['Énergie', 7, 10], ['Inspiration', 6, 10]],
    attrs: [['Imagination', 12], ['Rigueur', 10], ['Verbe', 11], ['Rythme', 9], ['Main', 10], ['Souffle', 8]],
    ident: [
      ['level', 'Rang', '1'],
      ['role', 'Classe', 'Conteur · Scénographe'],
      ['origin', 'Lignée', "Anim'Connect"],
      ['align', 'Tempérament', 'Ardent et méthodique']
    ],
    panels: [
      ['traits', 'Traits', 'chips', "Un trait par ligne\nPatient\nCurieux"],
      ['skills', 'Compétences', 'list', 'Un par ligne — « Nom | précision »\nComposition | piano, orchestration'],
      ['gear', 'Équipement', 'list', 'Un par ligne — « Nom | précision »\nCarnet de croquis | toujours dans le sac'],
      ['bio', 'Histoire', 'prose', "D'où vient ce profil, ce qu'il cherche…"],
      ['notes', 'Notes', 'prose', 'Rappels, préférences, méthode de travail…']
    ]
  },
  ai: {
    key: 'ai', store: 'personas', view: 'personas',
    title: 'Personas', sub: 'Fiches des personas IA',
    one: 'Persona', newName: 'Nouveau persona', accent: '#8e6cf1', rune: 'C',
    kindLabel: 'Persona IA',
    gauges: [['Charge', 3, 10], ['Contexte', 6, 10], ['Affinité', 8, 10]],
    attrs: [['Mémoire', 11], ['Précision', 12], ['Style', 10], ['Intuition', 9], ['Portée', 8], ['Constance', 11]],
    ident: [
      ['level', 'Rang', '1'],
      ['role', 'Fonction', 'Dramaturge'],
      ['origin', 'Origine', 'Extelua'],
      ['voice', 'Voix', 'Grave, posée'],
      ['model', 'Moteur', 'À préciser'],
      ['align', 'Tempérament', 'Franche, exigeante']
    ],
    panels: [
      ['traits', 'Marqueurs de style', 'chips', "Un par ligne\nConcis\nImagé"],
      ['skills', 'Domaines', 'list', 'Un par ligne — « Nom | précision »\nDramaturgie | structure en cinq actes'],
      ['gear', 'Outils & accès', 'list', 'Un par ligne — « Nom | précision »\nBibliothèque | lecture des projets'],
      ['directives', 'Directives', 'prose', 'Ce que ce persona doit toujours faire, et ne jamais faire…'],
      ['memory', 'Mémoire', 'prose', 'Ce qu\'il retient d\'une session à l\'autre…'],
      ['bio', 'Histoire', 'prose', "Son passé, son rôle dans l'univers…"],
      ['notes', 'Notes', 'prose', 'Remarques de conception, essais, réglages…']
    ]
  }
};

export const kindOf = k => KINDS[k] || KINDS.user;

/* Rangs de la guilde, du plus modeste au plus haut. */
export const GUILD_RANKS = [
  'Braise', 'Étincelle', 'Flambeau', 'Fanal', 'Brasier',
  'Forge', 'Phare', 'Aurore', 'Soleil noir', 'Grand Œuvre'
];
