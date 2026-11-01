# Plan d'évolution - Dino Explorateur

Plan de travail pour la version 2 du jeu. Chaque étape peut être publiée seule sur GitHub Pages, dans l'ordre ci-dessous.

## État actuel (version 1)

| Sujet | Aujourd'hui | Problème |
|---|---|---|
| Difficulté | Choisie dans le menu (`prog.diff` : petit, grand, expert), fixe pendant toute la partie | Ne s'adapte pas à l'enfant |
| Niveaux | 13 au total : T-Rex 4, Tricératops 3, Ptérodactyle 3, Plésiosaure 3 (`WORLDS`) | Vite terminé |
| Énigmes | 10 types (`PUZZLES` : count, add, sub, mult, compare, sequence, first, missing, hangman, order), toutes en « choisis la bonne réponse » | Répétitif |
| Mots | 6 mots Petit, 9 mots Grand (`WORDS_PETIT`, `WORDS_GRAND`) | Les mêmes mots reviennent sans arrêt |
| Téléphone | 3 boutons (gauche, droite, saut) pour le T-Rex seulement ; pour les autres animaux, on touche l'écran là où l'animal doit aller | Le doigt cache l'animal ; les boutons cachent le bas de l'écran |
| Objets ramassés | Fruits et perles comptés (`fruitCount`), remis à zéro à chaque niveau | Ne servent à rien |
| Sauvegarde | `localStorage`, enregistrée seulement à chaque œuf et en fin de niveau | Si on quitte en plein niveau, on recommence le niveau au début |

## Étape 1 - Sauvegarde automatique

C'est la base des autres étapes : la difficulté évolutive, le sac à objets et les nouveaux niveaux ont besoin de données enregistrées.

- Nouveau format de sauvegarde `dino-explorateur-v2`, avec un numéro de version et la reprise automatique de la sauvegarde v1 (comme c'est déjà fait pour l'ancienne progression du T-Rex).
- Données enregistrées : progression par monde, niveau d'énigme par compétence (étape 2), sac à objets (étape 6), mots déjà vus, réglages.
- **Points de passage** : chaque pierre magique ouverte devient un point de reprise. On garde le niveau en cours, les pierres ouvertes, les objets ramassés et la position.
- Quand enregistrer : à chaque événement (pierre, objet, fin de niveau), toutes les 10 secondes pendant le jeu, et au moment où l'on quitte la page (`visibilitychange` et `pagehide`, c'est indispensable sur téléphone).
- Au menu, un bouton **Continuer** reprend la partie là où elle s'était arrêtée.
- Espace parents : **code de sauvegarde** à copier et coller, pour passer la progression d'un appareil à l'autre (le `localStorage` est propre à chaque appareil).
- Petit indicateur discret « Sauvegardé » dans le HUD.

## Étape 2 - Difficulté évolutive

- Les niveaux Petit, Grand et Expert du menu deviennent le **point de départ**. Ensuite, le jeu s'adapte tout seul.
- Chaque compétence a son propre niveau, de 1 à 10 : compter, additionner, soustraire, multiplier, comparer, suites, lettres, mots, logique (puzzle, labyrinthe).
- Règles proposées :
  - réussite du premier coup : +1 à la série ;
  - **3 réussites du premier coup de suite** : la compétence monte d'un cran ;
  - 2 énigmes de suite avec au moins 2 erreurs : la compétence baisse d'un cran ;
  - les changements restent petits (un seul cran à la fois), pour ne jamais décourager.
- Ce qui change à chaque cran : taille des nombres (jusqu'à 5, puis 10, 20, 50, 100), nombre de choix (3, puis 4), longueur des mots, aide visuelle (œufs à compter) d'abord affichée puis retirée, taille des puzzles et des labyrinthes.
- **Score et étoiles** : 3 étoiles pour une réussite du premier coup, 2 étoiles après une erreur, 1 étoile ensuite. Chaque niveau garde son meilleur score. Message spécial quand une compétence monte : « Tu deviens fort en additions ! ».
- Espace parents : tableau simple du niveau de chaque compétence, avec la possibilité de le fixer à la main.

## Étape 3 - Joystick virtuel sur téléphone

- **Joystick flottant** en bas à gauche : il apparaît là où le pouce touche l'écran, dans la moitié gauche, et disparaît quand on lâche. Rien n'est affiché en permanence.
- **Bouton d'action** en bas à droite : sauter (T-Rex), foncer (Tricératops), lancer une graine (Ptérodactyle), petite accélération (Plésiosaure).
- Même joystick pour les 4 animaux. Le mode « je touche là où je veux aller » reste disponible pour les plus petits (option dans le menu).
- **Ne pas cacher les personnages** :
  - joystick et bouton semi-transparents (opacité d'environ 0,5, qui monte quand on les touche) ;
  - la caméra garde l'animal dans la partie centrale et haute de l'écran, au-dessus de la zone des commandes. On décale `L.oy` et le suivi de caméra (`follow`) quand les commandes tactiles sont actives ;
  - en vue du dessus et sous l'eau, les objets et les ennemis qui passent sous le pouce s'affichent avec un contour visible.
- Le joystick lit sa direction dans `inputDir()`, à la place des touches, donc les modes de jeu n'ont presque pas à changer.
- Tester sur un téléphone en mode paysage, de petite et de grande taille, avec les zones de sécurité (`safe-area-inset`).

## Étape 4 - Plus de mots et d'énigmes classiques

- **Mots** : passer à environ 40 mots Petit (3 ou 4 lettres) et 80 mots Grand (5 à 8 lettres), rangés par thème (animaux, nature, maison, nourriture, dinosaures).
  - Les mots les plus utiles reçoivent une image SVG dans `ICON`. Les autres sont lus à voix haute, comme une dictée (ce que fait déjà l'espace parents).
  - Un mot ne revient pas avant d'avoir vu tous les autres mots de la liste (aujourd'hui, seuls les 3 derniers mots sont écartés).
- **Nouvelles variantes simples** :
  - trouver l'intrus (« lequel n'est pas un animal ? ») ;
  - compléter la suite de nombres (2, 4, 6, ?) ;
  - lire l'heure (heures pleines, puis demi-heures) ;
  - compter les pièces de monnaie ;
  - nombre pair ou impair ;
  - syllabe manquante (« PA _ _ ON ») ;
  - associer un mot et son image.
- Le tirage évite d'enchaîner deux fois de suite le même type d'énigme.

## Étape 5 - Nouvelles énigmes de type jeu

Une nouvelle famille d'énigmes « logique », qui se joue avec les doigts et pas seulement en choisissant une réponse :

| Énigme | Principe | Comment elle devient plus difficile |
|---|---|---|
| **Labyrinthe** | Guider le bébé dino jusqu'à l'œuf, au doigt ou avec les flèches | 5x5, puis 7x7 et 9x9, avec des fruits à ramasser en chemin |
| **Puzzle à glisser** (taquin) | Remettre en ordre une image de dinosaure | 2x2, puis 3x3 |
| **Puzzle à pièces** | Glisser 4 à 9 pièces à leur place | Nombre de pièces, pièces tournées |
| **Mémoire** | Retourner des cartes pour trouver les paires | 4 paires, puis 6 et 8 |
| **Relier les points** | Relier les nombres dans l'ordre pour faire apparaître un dessin | Jusqu'à 10, puis 20, ou de 2 en 2 |
| **Ombres** | Trouver l'ombre qui correspond à l'animal | Ombres qui se ressemblent de plus en plus |
| **Symétrie** | Colorier la moitié qui manque d'un dessin sur une grille | Taille de la grille |
| **Sudoku des dinos** | Grille 4x4 avec des images (niveau Expert) | Nombre de cases déjà remplies |

- Ces énigmes s'ouvrent dans la même fenêtre que les énigmes actuelles (`openPuzzle`, puis `solved` et `oops`), donc elles marchent dans les 4 modes de jeu.
- Score : étoiles selon le temps mis ou le nombre de coups, et non selon le nombre d'erreurs.

**Fait (fin de l'étape) :** le puzzle à pièces (4 pièces avec le dessin en pâle, puis 6, puis 9, puis des pièces tournées qu'on tourne en les touchant) et le miroir (colorier l'autre moitié d'un dessin : grille 4 x 4, puis 6 x 5 et 8 x 6, puis deux couleurs). On touche une pièce puis sa place, ou une case à colorier ; une mauvaise case ne se colorie pas. Aide : 5 trésors pour poser une pièce ou colorier une case, 10 pour faire briller la place ; après 2 erreurs, le jeu pose une pièce ou colorie une case gratuitement.

## Étape 6 - Des objets qui servent à quelque chose

Les fruits et les perles deviennent une monnaie qu'on garde d'un niveau à l'autre, dans le **sac**.

- **Utiliser pendant une énigme** :
  - 5 fruits : afficher un indice (surligner la bonne réponse, comme après 2 erreurs aujourd'hui) ;
  - 10 fruits : retirer une mauvaise réponse.
  - mots cachés et lettres à remettre dans l'ordre : 5 trésors pour recevoir une lettre, 10 pour faire briller les lettres une à une ;
  - **éviter la frustration** : dans ces énigmes de mots, le jeu offre gratuitement une lettre toutes les 2 erreurs.
- **Utiliser pendant le jeu** :
  - un bouclier contre les méduses et les cailloux ;
  - un aimant qui attire les fruits proches ;
  - un super saut pour le T-Rex.
- **Nouveaux objets à trouver** dans les niveaux :
  - clé dorée : ouvre un niveau bonus caché ;
  - morceau de carte : en réunissant 4 morceaux, on débloque un nouveau monde ;
  - fossile rare : collection à compléter dans un album.
- **Boutique du nid**, depuis le menu : chapeaux et couleurs pour les dinos, décorations du nid. On n'y achète qu'avec les fruits et les perles du jeu, jamais avec de l'argent réel.
- Les bébés nés en fin de niveau rejoignent un **nid** visible depuis le menu, qui se remplit au fil des parties.

## Étape 7 - Plus de niveaux

- Passer de 3 ou 4 niveaux à **6 niveaux par animal**, soit 24 au total. Exemples :
  - T-Rex : la grotte, le marais, la nuit ;
  - Tricératops : le désert, la neige ;
  - Ptérodactyle : l'orage, le coucher de soleil ;
  - Plésiosaure : le récif de corail, l'épave.
- Nouveaux éléments de jeu, ajoutés petit à petit : plateformes qui tombent, vent, courants marins, interrupteurs.
- Un **niveau bonus** par animal, qui s'ouvre avec la clé dorée (étape 6).
- Un **monde final** qui réunit les 4 animaux, débloqué avec les 4 morceaux de carte.
- Les niveaux restent décrits dans `WORLDS` : une nouvelle entrée suffit pour ajouter un niveau, sans toucher au code des modes de jeu.

**Fait :**
- 6 endroits par animal (24 au total) : le marais et la nuit (T-Rex), le désert, la neige et le canyon (Tricératops), le coucher de soleil, l'orage et les montagnes enneigées (Ptérodactyle), le récif de corail, l'épave et les grands fonds (Plésiosaure).
- Nouveaux éléments : rondins qui tombent (T-Rex), glace qui glisse (Tricératops), vent et orage (Ptérodactyle), courants marins et grands fonds sombres (Plésiosaure).
- Interrupteurs, dans 2 endroits par animal (3e et 6e) : un gros bouton rouge ouvre une porte plus loin (porte en bois, barrière, mur de lianes, grille sous l'eau). Devant la porte fermée, la voix explique, une flèche montre le bouton, et au bout de 15 secondes la porte s'ouvre toute seule. Le bouton appuyé est gardé dans la sauvegarde.
- Une clé dorée cachée au 4e endroit de chaque animal. Elle ouvre l'endroit secret de l'animal : la grotte secrète, le jardin secret, l'arc-en-ciel, la baie aux perles.
- Chaque endroit secret terminé donne un morceau de la carte au trésor. Avec les 4 morceaux, l'île secrète s'ouvre dans le menu : 4 endroits à la suite, un par animal, et un bébé de chaque famille à la fin.
- Les anciennes sauvegardes ouvrent directement l'endroit qui suit le dernier terminé.

## Étape 8 - Statistiques pour les parents

Dans l'espace parents, pour suivre les progrès de l'enfant.

- **Tableau par famille d'énigmes** (une ligne par compétence : compter, additions, lettres, heure…) :
  - niveau actuel, de 1 à 10 ;
  - nombre d'énigmes faites ;
  - part des réussites du premier coup ;
  - nombre moyen d'erreurs ;
  - dernière fois jouée ;
  - tendance sur les 7 derniers jours : monte, stable ou descend.
- **Courbe d'évolution du niveau** : une ligne par compétence, le niveau de 1 à 10 en hauteur et les jours en largeur. On peut afficher toutes les compétences ou une seule, sur 7 jours, 30 jours ou depuis le début. La courbe est dessinée par le jeu lui-même, sans bibliothèque.
- **Données enregistrées** : un résumé par jour et par compétence (énigmes faites, réussites du premier coup, erreurs, niveau en fin de journée), pour rester léger dans la mémoire du navigateur. Ce résumé fait partie du code de sauvegarde.
- **Faire l'enregistrement le plus tôt possible**, même avant l'écran des statistiques, pour avoir déjà de l'historique à afficher.

**Fait :** dans l'espace parents, un tableau (niveau, énigmes faites, part du premier coup, erreurs par énigme, dernière fois, tendance sur 7 jours) et une courbe dessinée par le jeu : toutes les compétences ou une seule, sur 7 jours, 30 jours ou depuis le début. Un jour sans énigme garde le niveau de la veille. Le tableau défile dans son cadre sur téléphone.

## Étape 9 - Version Nintendo Switch (Atmosphère)

**But final : jouer sur une Switch avec Atmosphère**, comme une appli homebrew lancée depuis le menu homebrew (hbmenu).

**Deux versions, faites à partir du même jeu :**
- **la version PC**, celle d'aujourd'hui sur GitHub Pages : souris, clavier, manette branchée, grand écran (elle marche aussi sur téléphone et tablette) ;
- **la version Switch**, faite **à la fin**, une fois les étapes 7 et 8 terminées : Joy-Con, écran de la console, fichier `.nro`.

On garde un seul code. Un script de build produit la version Switch à partir de la version PC, et le jeu adapte son affichage et ses commandes selon l'endroit où il tourne.

### Les deux façons de faire

| | A. Navigateur intégré de la Switch | B. nx.js |
|---|---|---|
| Principe | Le jeu est rangé dans un fichier `.nro`. Atmosphère l'ouvre dans le navigateur intégré de la Switch, hors ligne (modèle : le projet nx-spa) | Moteur JavaScript fait pour la Switch : dessin sur canvas, manettes, écran tactile, son |
| Ce qu'on garde du jeu | Presque tout : le jeu est une page web | Le dessin du jeu (canvas). Les menus, énigmes et espace parents (en HTML) sont à refaire en canvas |
| Manettes | Pas documenté : à tester sur la console | Prévu par nx.js (boutons, tactile, mouvements) |
| Travail | Faible à moyen | Gros (réécriture de l'interface) |

**Recommandation : commencer par A**, et passer à B seulement si le test sur la console montre que les manettes ou le son ne marchent pas dans le navigateur.

### Ce qu'on sait déjà (route A)
- Il faut Atmosphère 0.8.5 ou plus récent (redirection des pages HTML homebrew vers `sdmc:/atmosphere/hbl_html`) et le système 7.0.0 ou plus récent. Avec le système 21.0.0 ou plus, il faut compiler avec libnx 4.10.0 ou plus.
- Il faut lancer le menu homebrew **en mode application**, en gardant R appuyé en lançant un jeu. Depuis l'album, le navigateur ne s'ouvre pas de façon fiable.
- Le moteur JavaScript du navigateur est ancien. Il refuse `const` en mode strict, donc il faudra une version du jeu traduite en ES5 par un outil de compilation (Babel par exemple).
- Le navigateur de la Switch est basé sur WebKit et se présente comme `Nintendo Switch; WebApplet`. Le jeu peut donc savoir qu'il tourne sur la Switch.
- La page peut parler au programme natif par `window.nx` (messages JSON). Ça servira pour la sauvegarde sur la carte SD si la mémoire du navigateur ne tient pas.

### Ce qu'il faut tester sur la console (prototype d'abord)
Une petite page de test, empaquetée comme nx-spa, qui vérifie :
1. les Joy-Con et la manette Pro : touches du clavier, API Gamepad, ou seulement un curseur au stick ;
2. l'écran tactile en mode portable ;
3. la lecture à voix haute (`speechSynthesis`) : probablement absente, il faudra alors des fichiers son enregistrés à l'avance pour les consignes ;
4. les sons du jeu (Web Audio) ;
5. si `localStorage` est gardé entre deux lancements, sinon sauvegarde sur la carte SD par `window.nx` ;
6. la fluidité du canvas (60 images par seconde ?).

### À préparer dans le jeu dès maintenant (utile aussi sur ordinateur)
- **Tout jouer à la manette ou au clavier**, sans souris ni doigt : se déplacer dans les menus, les énigmes et l'espace parents avec la croix, valider avec A, revenir avec B. Les manettes branchées sur un ordinateur passent par l'API Gamepad.
- **Une seule couche pour la sauvegarde**, pour pouvoir changer d'endroit (navigateur ou carte SD) sans toucher au reste.
- **La voix** : si la lecture à voix haute manque, utiliser des fichiers son préparés à l'avance.
- **Le build** : un script qui produit la version Switch (ES5, fichiers dans `romfs:/webapp`) et le `.nro`.

### Essais sur la console (31 octobre 2026)
- **Route A abandonnée.** Le navigateur intégré marche (touches et tactile OK), mais : pas de voix, pas de Web Audio, `localStorage` refusé (SecurityError), et la console garde la main sur certains boutons (X ferme le navigateur). Ce n'est pas un vrai jeu. Le code de cet essai reste dans l'historique Git (branche `etape9-switch`).
- **Route B choisie : nx.js**, un vrai homebrew sans navigateur. Canvas, Joy-Con, tactile, Web Audio et sauvegarde dans un fichier de la carte SD (`switch/dino-explorateur/sauvegarde.json`). Pas de synthèse vocale : il faudra des phrases enregistrées à l'avance (les voix françaises de Windows, Hortense, Julie ou Paul, peuvent les produire).
- Un seul code de jeu : `switch/build.mjs` met dans un même module un faux DOM (`switch/src/dom.js`), le code du jeu tiré tel quel de `index.html`, et la couche Switch (`switch/src/switch.js`). Le `.nro` se fabrique avec `nxjs-nro --fat`, sans autre outil que Node.js.

### Étapes de la version Switch (nx.js)
Le code de la version Switch est maintenant dans son propre dépôt (privé) : https://github.com/bitoman81/dino-explorateur-switch (31 octobre 2026). Le dossier `switch/` d'ici y a été déplacé avec son historique ; les chemins `switch/src/...` ci-dessous y sont à la racine (`src/...`). Ce dépôt garde une copie du jeu dans `jeu/index.html`, à mettre à jour quand `index.html` change.

- [x] 1. Prototype du T-Rex : les 6 endroits, stick ou croix pour marcher, A ou B pour sauter, joystick tactile ; les pierres s'ouvrent seules. Test dans Chrome en imitant nx.js (`switch/test/test-switch.mjs`). Lancé sur la console le 31 octobre 2026, après trois corrections : JIT coupé (`nxjs.ini`, bug nx.js n° 424 ; remplacé à l'étape 2 par le JIT sans Sparkplug), sauvegarde dans un fichier au lieu du localStorage de nx.js (son choix du profil bloquait), et plus de `\p{L}` ni de `toLocale...` (le moteur n'a pas les tables Unicode ; `build.mjs` les refuse). En cas de souci : `switch/nxjs-debug.log` et `switch/dino-journal.txt` sur la carte SD.
- [x] 2. Menu et choix du dino, à la manette et au doigt : écran titre, les 4 animaux et l'île secrète, les endroits (œufs, étoiles, cadenas, clé dorée), − pour revenir au menu, écran Bravo. Essayé sur la console le 31 octobre 2026. Fluidité : JIT automatique sans Sparkplug (`flags = --no-sparkplug` dans `nxjs.ini`), à lancer en gardant R sur un jeu. Capture d'écran avec ZL + ZR dans `switch/dino-captures/`. Les coins arrondis sont tracés avec `arc` (avec `arcTo`, nx.js dessinait une boucle en trop).
- [ ] 3. Énigmes dessinées dans le jeu, à la manette et au doigt.
  - [x] Énigmes à choix (15 types) : le code des énigmes tourne tel quel, `switch/src/puzzle.js` relit le titre, l'image et les boutons, les dessine (petit lecteur HTML et SVG) et renvoie les choix au jeu. A répondre, X et Y les aides payantes, B retour. Essayé sur la console le 31 octobre 2026.
  - [ ] Mots à écrire (mot caché, lettres dans l'ordre) et énigmes-jeux (labyrinthe, taquin, mémoire, points, sudoku, puzzle à pièces, miroir) : faits le 31 octobre 2026, à essayer sur la console. Le faux DOM (`switch/src/dom.js`) est devenu un petit DOM : innerHTML construit un arbre d'éléments avec classes, data-*, onclick et querySelectorAll, si bien que le code de ces jeux tourne tel quel. La Switch dessine l'arbre ; la croix va d'une case à la case voisine, A clique, le doigt touche ; dans le labyrinthe, la croix déplace le bébé.
- [x] 4. Voix et sons enregistrés. nx.js n'a ni synthèse vocale ni oscillateur : les bruitages sont calculés au démarrage, et la voix est enregistrée à l'avance par Eloise, voix naturelle de Microsoft Edge (les voix de Windows, Hortense, Julie et Paul, étaient trop robotiques). 1266 morceaux en MP3 (phrases entières, morceaux autour des nombres, nombres de 0 à 100), joués à la suite. Voix essayée sur la console le 1er novembre 2026, fusionnée le même jour.
- [x] 5. Les 4 animaux, sauvegarde, sac et boutique. Le sac s'ouvre avec Y dans le menu (pouvoirs, couleurs de chaque animal avec L / R, fossiles). Icône du menu homebrew : le T-Rex du jeu (`icon.jpg`). Le fichier s'appelle `dino.nro` ; un raccourci sphaira garde l'icône de sa première version (cache de la Switch), d'où un nouveau nom. Essayé sur la console et fusionné le 1er novembre 2026.
- [ ] 6. Espace parents, avec le clavier de la Switch.

### Si la route A ne suffit pas
Route B avec nx.js, ou Brewser (un moteur web pour Switch construit sur nx.js). Les menus seraient alors redessinés sur le canvas.

Sources : projet nx-spa (github.com/BernardoGiordano/nx-spa), nx.js (github.com/TooTallNate/nx.js), documentation libnx du navigateur (switchbrew.github.io/libnx), wiki Switchbrew.

## Organisation technique

- Le jeu tient en un seul fichier, `index.html`, d'environ 119 Ko. Avec tout ce contenu, il passera à environ 300 Ko. Deux solutions :
  - garder un seul fichier, découpé en sections bien commentées (c'est plus simple, et le README le promet : « sans installation ») ;
  - ou séparer `data/mots.js`, `data/niveaux.js` et `puzzles/*.js`, ce qui fonctionne aussi sur GitHub Pages sans rien installer.
  Recommandation : garder un seul fichier jusqu'à l'étape 4, puis décider.
- Une branche par étape, fusionnée dans `main` une fois testée sur ordinateur et sur téléphone.
- À tester à chaque étape :
  - l'ancienne sauvegarde v1 est bien reprise ;
  - le jeu marche en mode portrait et en mode paysage ;
  - la lecture à voix haute marche sur Android et sur iPhone ;
  - le jeu marche sans son.

## Suivi

- [x] Étape 1 - Sauvegarde automatique et points de passage
- [x] Étape 2 - Difficulté évolutive et score en étoiles
- [x] Étape 3 - Joystick virtuel sur téléphone
- [x] Étape 4 - Plus de mots et d'énigmes classiques
- [x] Étape 5 - Énigmes de type jeu (labyrinthe, taquin, mémoire, points, sudoku, ombres, puzzle à pièces, miroir)
- [x] Étape 6 - Sac, objets utiles et boutique du nid (clé dorée et morceaux de carte avec l'étape 7)
- [x] Étape 7 - Plus de niveaux, endroits secrets, île secrète et interrupteurs
- [x] Étape 8 - Statistiques pour les parents : tableau par compétence et courbe du niveau
- [ ] Étape 9 - Version Nintendo Switch avec Atmosphère (prototype sur la console d'abord)
