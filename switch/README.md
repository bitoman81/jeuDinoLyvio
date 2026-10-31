# Dino Explorateur sur Nintendo Switch (nx.js)

Version Switch du jeu : un vrai homebrew `.nro`, sans navigateur, lancé depuis le menu homebrew d'Atmosphère.

## Comment ça marche

Le jeu tourne avec [nx.js](https://github.com/TooTallNate/nx.js), un moteur JavaScript fait pour la Switch : dessin sur l'écran (Canvas), Joy-Con et manette Pro, écran tactile, sons (Web Audio) et sauvegarde dans la mémoire de sauvegarde de la Switch (localStorage).

On garde un seul code de jeu. `build.mjs` fabrique `romfs/main.js`, un seul module qui contient :
1. `src/dom.js` : un faux DOM. nx.js n'a pas de HTML ; les éléments du jeu (menus, énigmes) existent mais n'affichent rien ;
2. le code du jeu, tiré tel quel de `../index.html` ;
3. `src/switch.js` : la couche Switch (manette, tactile, écrans dessinés sur la console).

## État : prototype du T-Rex

- Les 6 endroits du T-Rex se jouent : stick gauche ou croix pour marcher, A ou B pour sauter, + pour quitter.
- Écran tactile : le pouce gauche fait un joystick, la moitié droite de l'écran fait sauter.
- Les énigmes ne sont pas encore dessinées : la pierre s'ouvre toute seule.
- Pas de voix pour l'instant (pas de synthèse vocale sur la console : il faudra des phrases enregistrées).

## Construire le .nro (sur l'ordinateur)

Il faut seulement Node.js.

```
cd switch
npm install
npm run build
npm run nro
```

Le fichier produit est `switch/dino-explorateur.nro` (environ 54 Mo : il contient le moteur nx.js, il marche donc sans Internet).

Test sur ordinateur, dans Chrome, en imitant nx.js : `node test/test-switch.mjs`.

## Installer sur la Switch

1. Copier `dino-explorateur.nro` sur la carte SD, dans le dossier `switch/`.
2. Lancer le menu homebrew, de préférence en mode application (garder R appuyé en lançant un jeu) : le jeu a alors toute la mémoire.
3. Choisir **Dino Explorateur**. Au premier lancement, la Switch demande quel profil utiliser : c'est là que la sauvegarde est rangée.
