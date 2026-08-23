# GRIMOIRE · Anim'Connect

Atelier de création. Trois pages d'accueil, atteignables par les trois icônes de gauche :

| Page | Rôle |
|------|------|
| **Guilde** (icône maison) | Le nexus : sceau de renom, quatre salles (Bibliothèque, Calendrier, Quêtes, Coffre), les deux ailes, cercle des membres et registre |
| **Tour Hourglass** (sablier) | La page des **Histoires** : ses mondes, ses chiffres, son cercle et son registre |
| **Sphère ludique** (sphère) | La page des **Jeux** : ses univers, ses chiffres, son cercle et son registre |

Les trois partagent la même façade — bannière, blason, devise, présentation — et chacune a la sienne,
modifiable depuis le cadre du blason. La bibliothèque garde ses trois branches fixes — **Histoires**,
**Jeux** et **Expo** — avec catégories imbriquées sans limite, projets avec playlist, chronologie
verticale, storyboard par éléments.

Les **personas** forment une seule famille de fiches, réunies sur leur propre page : bande horizontale
d'avatars, portrait, attributs en tuiles, panneaux thématiques et image de fond couvrant toute la fiche. Le rôle — joué par
l'utilisateur, ou tenu par l'IA — se choisit sur la fiche, une fois celle-ci créée.

## Apparence

L'interface suit les principes de Material 3 (Google) : surfaces à tons, accents tonals, coins
généreux, ombres douces, typographie Roboto. Deux thèmes complets, **jour** et **nuit**, au choix :

- **Paramètres → Apparence** propose trois cartes : *automatique*, *jour*, *nuit* ;
- « automatique » suit le réglage jour/nuit du système et réagit à chaud s'il change.

Le choix est retenu dans `localStorage` (clé `ac-theme`) et appliqué avant le premier rendu par un
court script en tête de `index.html` : pas de clignotement au chargement. Toute la palette tient dans
des variables CSS de `css/base.css` — les anciens noms (`--ember`, `--parch`, `--line`…) restent
disponibles comme alias des jetons Material.

### Fond d'écran

Le fond d'écran se charge depuis la **Guilde** : le cadre à gauche du nom ouvre un tiroir qui demande ce
que l'image doit habiller — le **blason**, qui ouvre la fenêtre du blason (nom, devise, présentation,
image et bannière), ou le **fond d'écran**, chargé directement — et permet de retirer l'un ou l'autre.
Une seule image ou vidéo de fond, la même de jour comme de nuit. Le fichier est rangé tel quel dans le
coffre et **occupe tout l'écran, à pleine opacité**, sans voile par-dessus. Une page qui impose déjà son
propre fond — bannière de projet, image d'une fiche — garde la priorité ; le fond d'écran reprend la main
dès qu'on la quitte.

La **page d'accueil est dessinée pour ce fond** : ses cadres n'ont ni couleur de fond ni flou, seulement
un voile très léger et un filet, pour que l'image reste franche. La lisibilité tient au halo posé derrière
les textes de la page (`--halo`), pas à un panneau opaque. Sur une image très contrastée avec le thème
choisi, mieux vaut basculer le thème : fond clair → mode jour, fond sombre → mode nuit.

## Intelligence artificielle (BYOK)

**Paramètres → Intelligence artificielle** branche le grimoire sur le compte d'IA de l'utilisateur :
*apporte ta propre clé*. L'application ne fournit aucun accès et n'ajoute aucun intermédiaire.

1. choisir le fournisseur — Anthropic (Claude), OpenAI, Google (Gemini), Mistral, OpenRouter, ou tout
   service compatible OpenAI dont on donne l'URL de base ;
2. coller sa clé API, puis l'enregistrer ;
3. charger la liste des modèles réellement ouverts à cette clé, et choisir celui à utiliser (ou saisir
   son identifiant à la main) ;
4. envoyer un message d'essai pour vérifier que tout répond.

La clé est rangée dans IndexedDB (magasin `kv`, clé `ai`), sur l'appareil, et n'est envoyée qu'au
fournisseur choisi, dans l'en-tête d'authentification. Elle n'est jamais réaffichée en clair : le champ
ne montre qu'un repère masqué. Changer de fournisseur efface la clé précédente, et « Effacer la clé »
la retire complètement.

`js/ai.js` regroupe les fournisseurs, `listModels()` et `chat()` — les appels passent par `fetch`,
l'application étant servie en modules ES sans étape de build. Un service qui refuse les appels directs
depuis une page web (CORS) renvoie une erreur réseau explicite dans le bloc de résultat.

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
    ├── ai.js             fournisseurs d'IA, clé de l'utilisateur, modèles, échanges
    ├── db.js             IndexedDB, fichiers bruts, arbre de groupes, fiches, guilde
    ├── state.js          état global, branches, familles de fiches, rangs de guilde
    ├── utils.js          formats, sélection de fichiers, sondage de durée
    ├── ui.js             modale, en-tête, scène, médaillons, fragments réutilisables
    ├── player.js         file de lecture assemblée, tête de lecture
    ├── router.js         sélection de vue, retour hiérarchique
    ├── actions.js        table d'actions (délégation de clics)
    ├── modals.js         groupe, projet, événement, élément, piste, jalon, quête, blason
    └── views/
        ├── guild.js      les trois pages d'accueil : Guilde, Hourglass, Sphere
        ├── sheet.js      page des personas : milieux, fiches, rôles
        ├── library.js    branches de projets + page de groupe
        ├── project.js    onglets pistes, éléments, production
        ├── timeline.js   chronologie verticale
        ├── tracker.js    les quatre salles de la Guilde
        └── pages.js      expérience, musique, paramètres (apparence, fonds, IA), coffre
```

## Les champs de choix

Un `select` natif ouvre une liste dessinée par le système : ni le thème, ni les formes, ni les couleurs
du site ne s'y appliquent. Toutes les listes déroulantes passent donc par un **sélecteur maison**
(`pickField()` dans `js/ui.js`) : le champ garde l'allure des autres, et la liste s'ouvre dans une feuille
à nous — options sur deux lignes, coche sur le choix courant, filtre au-delà de huit entrées, insensible
aux accents.

La feuille de choix vit dans sa propre couche (`#pickRoot`), au-dessus des fenêtres : ouvrir une liste
depuis une fenêtre ne détruit pas ce qui y est déjà saisi. Chaque champ garde un `input` caché portant
l'identifiant d'origine, si bien que le code qui relève les valeurs (`document.getElementById('fGroup').value`)
n'a pas changé.

## Modèle de données (IndexedDB `GRIMOIRE_ANIMCONNECT`, version 5)

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
| `personas` | fiches des personas, avec leur rôle, leur milieu d'origine et leurs présences | `milieuId` |
| `milieux`  | Guilde, Hourglass, Sphere et leurs sous-groupes | `parentId` sur les sous-groupes |
| `profiles` | ancien magasin des profils, vidé au premier lancement | — |
| `kv`       | blason des trois maisons (`guild`, `house-hourglass`, `house-sphere`), persona actif, fond d'écran (`wallpaper`), réglages d'IA (`ai`) | `k` |

Au premier lancement en version 5, les anciennes fiches sont reprises : les profils deviennent des
personas de rôle « utilisateur », les personas d'alors gardent le rôle « IA · assistant », et tout le
monde entre dans la Guilde.

Les fichiers sont stockés tels quels : aucun type imposé, aucune conversion, aucune compression.
La seule limite est le quota du navigateur, lisible dans la salle Coffre.

## Repères d'interface

- **Ouverture** : la Guilde, et non plus le calendrier.
- **Guilde** : bannière et blason, sceau de renom calculé sur le contenu réel, quatre plaques vers les
  salles, cercle des profils et personas, registre des jalons, quêtes et projets récents. Le cadre du
  blason, à gauche du nom, est la seule porte vers les images de la guilde : un tiroir mène soit à la
  fenêtre du blason, soit au fond d'écran, avec leurs retraits.
- **Salles** : Bibliothèque, Calendrier, Quêtes et Coffre s'ouvrent depuis le footer et gardent un retour
  vers leur maison.
- **En-tête**, sur une seule ligne : les trois maisons à gauche — Guilde, Hourglass, Sphere — le **titre
  de la page** au centre, en capitales, puis Personas, Musique et Paramètres à droite. Il n'y a plus de
  barre de titre sous le menu. L'icône de la maison reste allumée dans les vues qui en découlent : une
  catégorie d'Histoires garde Hourglass allumé, un jeu garde Sphere.
- **Footer** : les quatre salles de la maison où l'on se trouve — Bibliothèque, Calendrier, Quêtes,
  Coffre. Chaque maison a les siennes : le Calendrier et les Quêtes de Hourglass ne montrent que ce qui
  relève des Histoires, ceux de Sphere que les Jeux, ceux de la Guilde tout. La Bibliothèque d'une maison
  à branche ouvre directement sa branche ; celle de la Guilde ouvre les trois. Le Coffre reste commun —
  les fichiers sont un seul stock.

- **Personas** : une page comme les autres icônes de la barre du haut. Trois bandes — les milieux, leurs
  sous-groupes, puis les fiches — « + » pour en ouvrir une nouvelle, étoile sur la fiche active, puis la
  fiche elle-même. L'icône porte le portrait du persona actif.
- **Paramètres** : apparence (thème jour / nuit) et accès à l'IA de l'utilisateur.

## Les personas

Une seule famille de fiches. Ce n'est plus le type qu'on choisit à la création, mais le **rôle**, sur la
fiche elle-même, et il peut changer à tout moment :

| Rôle | Ce qu'il est |
|------|--------------|
| **Utilisateur** | Contrôlé par toi |
| **IA · assistant** | Assistant de création, à tes côtés |
| **IA · vivant** | Personnage vivant, pour les expériences vécues avec l'utilisateur |

Les deux rôles d'IA ouvrent en plus, sur la fiche, les champs **Voix** et **Moteur** et les panneaux
**Directives** et **Mémoire** — inutiles pour un persona joué par l'utilisateur.

### Les milieux

Les personas se rangent dans des **milieux**, trois racines fixes :

| Milieu | Contenu | Sous-groupes |
|--------|---------|--------------|
| **Guilde** | Les personas de la guilde Anim'Connect | créés librement |
| **Hourglass** | Les personas des mondes racontés | créés, ou repris des **mondes des Histoires** |
| **Sphere** | Les personas des univers de jeu | créés, ou repris des **catégories des Jeux** |

Le « + » de la bande des sous-groupes ouvre un tiroir : créer un sous-groupe de toutes pièces, ou
reprendre un monde ou une catégorie déjà bâtis dans la Bibliothèque — le sous-groupe garde alors le lien
vers son groupe d'origine.

**Un persona n'est pas enfermé dans son milieu.** Sa fiche porte un *milieu d'origine* et une liste
« tient aussi un rôle dans » : il apparaît dans ces milieux-là aussi, marqué d'un ↗, et peut donc être
assistant créateur ici et personnage vivant ailleurs. Supprimer un sous-groupe ne supprime personne : ses
personas remontent au milieu parent.

## La fiche

| Bloc | Contenu |
|------|---------|
| Identité | Rang, Fonction, Origine, Tempérament — plus Voix et Moteur pour les rôles d'IA |
| Constantes | Vitalité, Énergie, Inspiration |
| Attributs | Imagination, Rigueur, Verbe, Rythme, Main, Souffle |
| Panneaux | Traits, Compétences, Équipement, Histoire, Notes — plus Directives et Mémoire pour les rôles d'IA |

Constantes et attributs s'ajoutent et se retirent librement. Le portrait occupe un cadre carré ;
l'image de fond couvre toute la fiche et se prolonge derrière l'application. La couleur d'encre de la
fiche colore ses cadres, ses jauges et son médaillon dans la bande.

Édition : le bouton **Modifier la fiche** transforme chaque cadre en champ, à la même place. La mise en
page de création et la mise en page de lecture sont donc la même. Le rôle et les milieux, eux, se règlent
sans passer par l'édition.

## À faire ensuite

- Page Expérience : entrée du participant, personas en scène, déclenchement des événements.
- Rattacher un persona IA à une branche ou à un projet, et lui ouvrir un journal d'échanges.
