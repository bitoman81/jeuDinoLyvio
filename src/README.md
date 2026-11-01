# Le code du jeu, en morceaux

Le joueur reçoit toujours un seul fichier, `index.html` (GitHub Pages, l'artefact Claude, la version Switch). Ce fichier est **fabriqué** à partir de ce dossier :

```
node build.mjs           # assemble index.html
node build.mjs --check   # vérifie que index.html est à jour (fait aussi par les tests sur GitHub)
```

**Toujours modifier les fichiers de `src/`, jamais `index.html` directement**, puis lancer `node build.mjs` et ajouter `index.html` au même commit.

Dans `page.html`, chaque ligne `<!-- inclure chemin -->` est remplacée par le fichier correspondant, dans l'ordre. Le code JavaScript reste un seul script : les fichiers se suivent et partagent les mêmes variables, l'ordre compte.

| Fichier | Contenu |
|---|---|
| `page.html` | Le squelette : en-tête, écrans en HTML (menu, énigme, sac, espace parents...), et la liste des fichiers inclus |
| `css/jeu.css` | Toute la mise en page |
| `js/donnees.js` | Constantes, espèces, couleurs, pouvoirs, accessoires, niveaux et endroits |
| `js/images-mots.js` | Images des énigmes (SVG) et listes de mots |
| `js/sauvegarde.js` | Outils, compétences, sauvegarde et nettoyage, les 3 parties |
| `js/son.js` | Bruitages, voix (synthèse vocale), musique |
| `js/dessin.js` | Outils de dessin, morceaux de décor, dinosaures vus de côté, écran |
| `js/etat.js` | État de la partie, interrupteurs, clavier et tactile |
| `js/ennemis.js` | Ennemis, difficulté des endroits, gardien du nid |
| `js/modes/trex.js` | T-Rex : plateformes vues de côté |
| `js/modes/trike.js` | Tricératops : vue de dessus |
| `js/modes/ptero.js` | Ptérodactyle : vol et graines |
| `js/modes/plesio.js` | Plésiosaure : sous l'eau |
| `js/boucle.js` | Boucle du jeu, HUD |
| `js/enigmes.js` | Toutes les énigmes (PUZZLES), aides, étoiles, statistiques par énigme |
| `js/parents.js` | Espace parents, statistiques, résumé de la semaine, codes de sauvegarde, QR code et Wi-Fi |
| `js/menus.js` | Écran des parties, fin d'endroit, menu, sac et boutique, démarrage d'un endroit (startLevel) et du jeu |
