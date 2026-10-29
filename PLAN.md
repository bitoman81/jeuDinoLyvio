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

## Étape 6 - Des objets qui servent à quelque chose

Les fruits et les perles deviennent une monnaie qu'on garde d'un niveau à l'autre, dans le **sac**.

- **Utiliser pendant une énigme** :
  - 5 fruits : afficher un indice (surligner la bonne réponse, comme après 2 erreurs aujourd'hui) ;
  - 10 fruits : retirer une mauvaise réponse.
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

- [ ] Étape 1 - Sauvegarde automatique et points de passage
- [ ] Étape 2 - Difficulté évolutive et score en étoiles
- [ ] Étape 3 - Joystick virtuel sur téléphone
- [ ] Étape 4 - Plus de mots et d'énigmes classiques
- [ ] Étape 5 - Énigmes de type jeu (labyrinthe, puzzles, mémoire...)
- [ ] Étape 6 - Sac, objets utiles et boutique du nid
- [ ] Étape 7 - Plus de niveaux, niveaux bonus et monde final
