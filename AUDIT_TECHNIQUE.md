# Audit technique — GRIMOIRE · Anim'Connect

## 1. Architecture générale

Application monopage mobile-first en HTML, CSS et JavaScript natifs, sans framework, en modules ES chargés
depuis `index.html`. Le rendu se fait dans `#app` par des fonctions de vues ; les fenêtres partagent une
feuille modale unique et les clics sont centralisés par délégation dans `actions.js`.

Cette architecture a été conservée pour les trois chantiers de cette passe : aucun nouveau moteur de
navigation, aucune bibliothèque d'interface, aucune seconde logique de stockage.

## 2. Ce qui change dans cette version

1. **La Guilde devient une page à part entière et la page d'ouverture.** Le calendrier ne s'ouvre plus au
   démarrage : il redevient une salle parmi quatre, atteinte depuis la Guilde.
2. **Les icônes des quatre salles sont posées dans la page Guilde**, sous la forme de plaques, et non plus
   en tête de l'application.
3. **Les pages Profil et IA reçoivent une bande horizontale** de toutes les fiches, avec bouton de création,
   puis une fiche façon jeu de rôle.

## 3. Répartition des responsabilités

- `index.html` : squelette permanent, header, zone de rendu, footer, lecteur et modale.
- `css/base.css` : palette, typographie et règles globales.
- `css/layout.css` : header, footer, scène de fond, lecteur, portraits actifs du footer.
- `css/components.css` : boutons, portails, tuiles, pistes, formulaires, modale et calendrier.
- `css/timeline.css` : chronologie verticale.
- `css/guild.css` : bannière, blason, sceau de renom, plaques de la salle, registre.
- `css/sheet.css` : bande horizontale des fiches, cadres ornés, fiche de personnage.
- `js/main.js` : initialisation du stockage, de la guilde, des actions, du lecteur et de la première vue.
- `js/state.js` : état de navigation, branches de projets, familles de fiches, rangs de guilde.
- `js/db.js` : IndexedDB, fichiers bruts, arbre de catégories, fiches, réglages clé/valeur, migrations.
- `js/router.js` : choix des vues, retour hiérarchique, rafraîchissement des portraits actifs.
- `js/ui.js` : composants HTML réutilisables, header, scène, médaillons de fiche.
- `js/actions.js` : navigation, création, édition, lecture, suivi, guilde et fiches.
- `js/modals.js` : catégories, projets, événements, éléments, pistes, jalons, quêtes, blason.
- `js/player.js` : playlist assemblée, transport audio, tête de lecture.
- `js/views/` : guilde, fiches, bibliothèque, groupes, projets, chronologie, salles, pages secondaires.

## 4. Données et persistance

IndexedDB `GRIMOIRE_ANIMCONNECT`, **version 4**. La montée de version ajoute deux magasins, `profiles` et
`personas`, sans toucher aux magasins existants : aucune donnée antérieure n'est lue, déplacée ni supprimée
par cette migration. Le magasin `kv`, déjà présent en version 3, accueille le blason de la guilde
(clé `guild`) et les fiches actives (clés `active-user` et `active-ai`).

Les fichiers restent des `Blob` intacts : pas de compression, de conversion ni de filtre de type. Les
catégories utilisent `parentId`, ce qui autorise une profondeur illimitée. Les projets utilisent `groupId`.

Les trois branches racines gardent leurs identifiants stables `root-histoires`, `root-jeux`, `root-expo`,
et leur restauration au démarrage est inchangée.

## 5. La page Guilde

`js/views/guild.js` compose cinq blocs :

1. **Bannière** — image de fond, blason en losange (image ou rune), nom, devise, présentation.
2. **Sceau de renom** — l'élément signature. Le renom se calcule sur le contenu réel :
   `projets ×40 + pistes ×8 + éléments ×4 + quêtes achevées ×60 + jalons faits ×15 + dossiers ×10`.
   Le rang monte lorsque le total franchit `60 × niveau²` ; dix rangs sont nommés, de Braise à Grand Œuvre.
   Rien n'est inventé : une guilde vide affiche rang 1.
3. **Chiffres** — projets, quêtes, membres, fichiers.
4. **La grande salle** — quatre plaques : Bibliothèque, Calendrier, Quêtes, Coffre. Chacune porte son
   compteur utile (projets, jalons à venir, quêtes ouvertes, fichiers) et mène à `tracker` avec son onglet.
5. **Le cercle** — bandes des profils et des personas IA, avec création directe.
6. **Le registre** — prochains jalons, quêtes en cours, derniers projets ouverts, chaque ligne cliquable.

Le blason s'édite par la modale `mGuild` : nom, devise, rune, présentation, image de sceau, image de bannière.

## 6. Les fiches de personnage

`js/state.js` décrit les deux familles dans `KINDS` : `user` (magasin `profiles`) et `ai` (magasin
`personas`). Chaque famille déclare son vocabulaire, ses champs d'identité, ses constantes par défaut, ses
attributs par défaut et ses panneaux. Ajouter un champ à une famille se fait dans cette seule table.

`js/views/sheet.js` produit la même mise en page dans les deux sens :

- **Bande horizontale** — un médaillon par fiche, plus un bouton « + ». Le médaillon ouvert porte un anneau
  de la couleur de la fiche ; la fiche active porte une étoile.
- **Bandeau d'identité** — portrait en cadre carré, nom et épithète en cadre rectangulaire.
- **Identité secondaire** — une grille de petits cadres rectangulaires (rang, classe, lignée, voix…).
- **Constantes** — jauges libellées, ajoutables et supprimables.
- **Attributs** — grille de cadres carrés, ajoutables et supprimables.
- **Panneaux** — cadres rectangulaires rendus en pastilles, en liste `Nom | précision` ou en prose.
- **Fond** — l'image choisie couvre toute la fiche et se prolonge en fond d'application.

L'édition n'ouvre pas d'autre écran : chaque cadre remplace son texte par un champ, à la même place. La
page de création et la page de lecture sont donc littéralement la même mise en page. `collectCharDraft()`
relève les champs avant tout re-rendu, ce qui permet d'ajouter un attribut ou de charger un portrait sans
perdre la saisie en cours.

## 7. Navigation après modification

1. L'application s'ouvre sur la Guilde.
2. Les quatre plaques mènent aux salles ; chaque salle garde sa barre d'icônes et un retour Guilde.
3. Un projet ou un groupe remonte vers son parent, puis vers la salle Bibliothèque, puis vers la Guilde.
4. Les icônes Histoires, Jeux et Expo du footer ouvrent toujours le tiroir Création / Expérience.
5. Les deux boutons de gauche du footer affichent le portrait du profil et du persona IA actifs et mènent
   à leur page.
6. L'icône Personas du footer ouvre toujours le tiroir Profils / Personas.

## 8. Cohérence et protections

- Les noms et positions de Histoires, Jeux et Expo restent fixes ; les branches racines restent indestructibles.
- Un projet ne peut pas être enregistré hors de la branche sélectionnée.
- Les profils et les personas IA vivent dans deux magasins distincts : aucune page ne mélange les deux.
- Supprimer la fiche active en réélit une autre automatiquement, ou remet l'actif à vide.
- Créer une première fiche l'active ; créer les suivantes ne bouscule pas le choix en cours.
- Playlists, chronologie, éléments, production, calendrier, quêtes, coffre et lecteur conservent leurs
  modules et leur logique d'origine.
- Plaques, lignes de registre, médaillons et options de tiroir répondent à Entrée et Espace.

## 9. Vérification

Une passe de tests d'intégration a été exécutée sous jsdom avec `fake-indexeddb` : **80 assertions, 0 échec**.
Elle couvre l'ouverture sur la Guilde, l'absence du calendrier au démarrage, les quatre plaques et leurs
salles, la création et l'enregistrement d'une fiche, l'ajout et le retrait d'attributs et de constantes,
la bascule entre fiches, l'activation, l'étanchéité profils / personas IA, le cercle de la Guilde, les
portraits du footer, l'édition du blason, le calcul du renom, la suppression d'une fiche, et les
régressions sur la bibliothèque, les projets, les quêtes et les jalons.

## 10. Points techniques à connaître

- Le site doit être lancé via un serveur HTTP : les modules ES ne fonctionnent pas en `file://`.
- Le volume de fichiers dépend du quota accordé par le navigateur, lisible dans la salle Coffre.
- La page Expérience et le rattachement des personas IA aux projets restent des emplacements à compléter.
- Les données IndexedDB sont locales au navigateur et à l'adresse depuis laquelle le site est ouvert.
