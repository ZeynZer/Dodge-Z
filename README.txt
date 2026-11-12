DODGE ZERO — version PWA
========================
Contenu : index.html, manifest.webmanifest, sw.js, icons/, js/
Aucun outil de build : ce sont des fichiers statiques.

Tester en local :   python3 -m http.server 8000   puis ouvrir http://localhost:8000
Mettre en ligne (HTTPS obligatoire pour l'installation) :
  - Netlify Drop (app.netlify.com/drop) : glisser le dossier
  - GitHub Pages / Cloudflare Pages / Vercel : pousser le dossier tel quel
Installer sur le téléphone :
  - Android (Chrome) : bouton « Installer l'application » dans le jeu, ou menu ⋮ > Installer
  - iPhone (Safari)  : Partager > Sur l'écran d'accueil
Après la première visite, le jeu fonctionne hors-ligne.
Pour publier une mise à jour : changer VERSION dans sw.js.
