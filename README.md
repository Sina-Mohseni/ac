# GRIMOIRE · Anim'Connect

Atelier de création. L'application s'ouvre sur la **Guilde** : bannière, sceau de renom, quatre salles
(Bibliothèque, Calendrier, Quêtes, Coffre), cercle des membres et registre. La bibliothèque garde ses
trois branches fixes — **Histoires**, **Jeux** et **Expo** — avec catégories imbriquées sans limite,
projets avec playlist, chronologie verticale, storyboard par éléments.

Les **Profils** (personas utilisateur) et les **Personas IA** partagent une même fiche : bande
horizontale d'avatars, portrait, attributs en tuiles, panneaux thématiques et image de fond couvrant
toute la fiche.

## Apparence

L'interface suit les principes de Material 3 (Google) : surfaces à tons, accents tonals, coins
généreux, ombres douces, typographie Roboto. Deux thèmes complets, **jour** et **nuit**, au choix :

- le bouton de thème en haut à droite fait défiler *automatique → jour → nuit* ;
- **Paramètres → Apparence** permet de choisir directement ;
- « automatique » suit le réglage jour/nuit du système et réagit à chaud s'il change.

Le choix est retenu dans `localStorage` (clé `ac-theme`) et appliqué avant le premier rendu par un
court script en tête de `index.html` : pas de clignotement au chargement. Toute la palette tient dans
des variables CSS de `css/base.css` — les anciens noms (`--ember`, `--parch`, `--line`…) restent
disponibles comme alias des jetons Material.

## Lancer

Les fichiers JavaScript sont des modules ES : ils exigent un serveur, `file://` ne fonctionnera pas.

```bash
cd animconnect
python -m http.server 8080
```

Puis ouvre `http://localhost:8080` (sur Termux : depuis le navigateur du téléphone).

Au premier lancement, autorise le stockage permanent si le navigateur le propose : sans lui, le système
peut effacer les fichiers quand la mémoire manque.

## Structure

```
animconnect/
├── AUDIT_TECHNIQUE.md   audit complet de l'architecture et des modifications
├── index.html            page unique, barre supérieure, navigation, lecteur, dialogue
├── css/
│   ├── base.css          jetons des deux thèmes, alias, typographie, utilitaires
│   ├── layout.css        barre supérieure, barre de navigation, scène de fond, lecteur
│   ├── components.css    boutons, cartes, portails, tuiles, modale, calendrier
│   ├── timeline.css      chronologie verticale
│   ├── guild.css         bannière, sceau de renom, plaques de la salle, registre
│   └── sheet.css         bande horizontale et fiche de personnage
└── js/
    ├── main.js           démarrage
    ├── theme.js          thème jour / nuit / automatique, mémorisation du choix
    ├── db.js             IndexedDB, fichiers bruts, arbre de groupes, fiches, guilde
    ├── state.js          état global, branches, familles de fiches, rangs de guilde
    ├── utils.js          formats, sélection de fichiers, sondage de durée
    ├── ui.js             modale, en-tête, scène, médaillons, fragments réutilisables
    ├── player.js         file de lecture assemblée, tête de lecture
    ├── router.js         sélection de vue, retour hiérarchique
    ├── actions.js        table d'actions (délégation de clics)
    ├── modals.js         groupe, projet, événement, élément, piste, jalon, quête, blason
    └── views/
        ├── guild.js      page d'accueil : la Guilde
        ├── sheet.js      fiches de personnage : profils et personas IA
        ├── library.js    branches de projets + page de groupe
        ├── project.js    onglets pistes, éléments, production
        ├── timeline.js   chronologie verticale
        ├── tracker.js    les quatre salles de la Guilde
        └── pages.js      expérience, musique, paramètres, coffre
```

## Modèle de données (IndexedDB `GRIMOIRE_ANIMCONNECT`, version 4)

| Magasin    | Contenu | Clés utiles |
|------------|---------|-------------|
| `groups`   | 3 branches fixes + catégories/sous-catégories, profondeur illimitée | `parentId` (`''` = branche racine) |
| `projects` | projets, rattachables à n'importe quel groupe | `groupId` |
| `tracks`   | pistes audio d'un projet **ou** d'un groupe | `projectId` = id du propriétaire |
| `assets`   | fichiers d'origine (Blob intact) | — |
| `lanes`    | pistes scéniques d'un projet | `projectId` |
| `events`   | événements datés, avec éléments placés | `projectId` |
| `elements` | univers, décors, personnages, objets, sons | `projectId` |
| `cal`      | jalons du calendrier | `date` |
| `goals`    | quêtes (étapes ou compteur) | — |
| `profiles` | fiches de personas utilisateur | — |
| `personas` | fiches de personas IA | — |
| `kv`       | blason de la guilde, fiches actives | `k` |

Les fichiers sont stockés tels quels : aucun type imposé, aucune conversion, aucune compression.
La seule limite est le quota du navigateur, lisible dans la salle Coffre.

## Repères d'interface

- **Ouverture** : la Guilde, et non plus le calendrier.
- **Guilde** : bannière et blason, sceau de renom calculé sur le contenu réel, quatre plaques vers les
  salles, cercle des profils et personas, registre des jalons, quêtes et projets récents.
- **Salles** : Bibliothèque, Calendrier, Quêtes et Coffre gardent leur barre d'icônes et un retour Guilde.
- **En-tête** : l'icône Accueil ramène à la Guilde ; Musique et Paramètres à droite.
- **Footer** : profil et persona IA actifs à gauche, avec leur portrait ; Histoires, Jeux, Expo et Personas
  à droite.
- **Profils / Personas IA** : bande horizontale de toutes les fiches, « + » pour en ouvrir une nouvelle,
  étoile sur la fiche active, puis la fiche elle-même.

## La fiche de personnage

Même gabarit pour les deux familles, vocabulaire différent :

| Bloc | Profil utilisateur | Persona IA |
|------|--------------------|------------|
| Identité | Rang, Classe, Lignée, Tempérament | Rang, Fonction, Origine, Voix, Moteur, Tempérament |
| Constantes | Vitalité, Énergie, Inspiration | Charge, Contexte, Affinité |
| Attributs | Imagination, Rigueur, Verbe, Rythme, Main, Souffle | Mémoire, Précision, Style, Intuition, Portée, Constance |
| Panneaux | Traits, Compétences, Équipement, Histoire, Notes | Marqueurs de style, Domaines, Outils & accès, Directives, Mémoire, Histoire, Notes |

Constantes et attributs s'ajoutent et se retirent librement. Le portrait occupe un cadre carré ;
l'image de fond couvre toute la fiche et se prolonge derrière l'application. La couleur d'encre de la
fiche colore ses cadres, ses jauges et son médaillon dans la bande.

Édition : le bouton **Modifier la fiche** transforme chaque cadre en champ, à la même place. La mise en
page de création et la mise en page de lecture sont donc la même.

## À faire ensuite

- Page Expérience : entrée du participant, personas en scène, déclenchement des événements.
- Rattacher un persona IA à une branche ou à un projet, et lui ouvrir un journal d'échanges.
