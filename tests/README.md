# Tests automatiques

Chaque fichier lance Chrome sans fenêtre (protocole DevTools, sans dépendance) et vérifie une étape du plan.

```
node tests/test-save.mjs index.html    # étape 1 : sauvegarde
node tests/test-step2.mjs index.html   # étape 2 : difficulté évolutive, étoiles
node tests/test-step3.mjs index.html   # étape 3 : joystick
node tests/test-step4.mjs index.html   # étape 4 : mots et énigmes
node tests/test-step5.mjs index.html   # étape 5 : jeux de réflexion, statistiques
node tests/test-step6.mjs index.html   # étape 6 : sac, aide, pouvoirs, fossiles, couleurs
node tests/test-step7.mjs index.html   # étape 7 : nouveaux endroits, clé dorée, carte, île secrète
node tests/test-step8.mjs index.html   # étape 8 : statistiques pour les parents
```

Il faut Node 22 ou plus récent (WebSocket intégré) et Google Chrome installé dans `C:/Program Files/Google/Chrome/Application/chrome.exe` (constante `CHROME` en haut de chaque fichier). Chaque fichier affiche `Tous les tests passent` ou la liste des échecs.
