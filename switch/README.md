# Dino Explorateur sur Nintendo Switch (Atmosphère)

Version Switch du jeu : un homebrew `.nro`, lancé depuis le menu homebrew.

## Comment ça marche

Le jeu est une page web. Le `.nro` contient la page dans sa RomFS (`romfs/webapp`). Au lancement, il la copie sur la carte SD, dans `atmosphere/hbl_html/html-document/dino.htdocs`, où Atmosphère sert les pages des homebrews. Puis il l'ouvre en plein écran dans le moteur web hors ligne de la console. Il n'y a pas de navigateur à installer : le moteur est déjà dans la Switch.

Le moteur web de la console est ancien. `build.mjs` traduit donc le JavaScript du jeu en ES5 (Babel) et ajoute les fonctions récentes qui manquent (core-js).

Pour cette première version, le jeu s'ouvre sur une **page de test**. Elle montre ce qui marche sur la console : boutons des Joy-Con, manette, écran tactile, voix, son, sauvegarde, fluidité. Le bouton « Lancer le jeu » ouvre ensuite le jeu.

## Construire le .nro (sur l'ordinateur)

Il faut Node.js et Docker Desktop (pour les outils devkitPro, sans rien installer d'autre).

```
cd switch
npm install
node build.mjs
docker run --rm -v "${PWD}:/src" -w /src devkitpro/devkita64:20260219 make
```

Le fichier produit est `switch/DinoExplorateur.nro`.

## Installer sur la Switch

1. Copier `DinoExplorateur.nro` sur la carte SD, dans le dossier `switch/`.
2. Lancer le menu homebrew **en mode application** : garder **R** appuyé en lançant un jeu (n'importe lequel), jusqu'à ce que le menu homebrew s'ouvre. Depuis l'album, le moteur web ne s'ouvre pas.
3. Choisir **Dino Explorateur**.

Il faut Atmosphère 0.8.5 ou plus récent, et le système 7.0.0 ou plus récent.
