# SHADOW FIGHTER — pack d'animations

Personnage jouable **SHADOW** (légendaire, offert à tous les joueurs) + cinématique de présentation.
Tout est généré depuis la planche de référence `src/reference.webp`, par les scripts de `tools/`.

## Contenu

```
assets/shadow/
├── src/            poses détourées par IA (isnet-anime) depuis la planche + héros pleine taille
│   ├── idle, walk, run, jump, attack, guard, hurt .png
│   ├── hero.png    illustration pleine taille (plans rapprochés de la cinématique)
│   └── reference.webp
├── sheets/         spritesheets du jeu (WebP avec transparence) + manifest.json
└── video/          cinématique verticale 720×1280, 30 i/s, avec bande-son
    ├── shadow_fighter_cinematic.mp4 / .webm / _poster.jpg / .json (chapitres)
```

### Spritesheets (`sheets/manifest.json`)

| clip | durée | i/s | boucle | usage dans le jeu |
|---|---|---|---|---|
| `intro` | 2,2 s | 15 | non | entrée en combat : sort de la fumée, yeux qui s'allument, révélation |
| `idle` | 1,5 s | 12 | oui | respiration, cheveux/manteau qui ondulent, aura légère, braises |
| `idle_power` | 1,5 s | 12 | oui | idle après transformation (aura pleine, éclairs) |
| `walk` | 0,8 s | 10 | oui | marche |
| `run` | 0,5 s | 12 | oui | course + traînées + poussière |
| `dash` | 0,45 s | 20 | non | élan éclair : étirement, flou, images rémanentes violettes |
| `jump` | 0,9 s | 15 | non | anticipation → saut → réception + onde au sol |
| `combo` | 1,35 s | 15 | non | attaque rapide ×2 + attaque lourde (croissant écarlate) |
| `guard` | 0,7 s | 15 | non | barrière d'énergie + impact |
| `hurt` | 0,5 s | 15 | non | flash blanc, recul, étincelles |
| `ko` | 1,6 s | 12 | non | chute en arrière, rebond, dissolution en fumée |
| `kiblast` | 1,0 s | 15 | non | charge d'une sphère au poing puis tir |
| `kiboom` | 0,6 s | 20 | non | explosion du ki-blast |
| `transform` | 1,8 s | 15 | non | concentration → explosion d'aura → forme éveillée |
| `ultimate` | 3,0 s | 15 | non | **ÉCLIPSE ÉCARLATE** : éclipse chargée au poing levé puis rayon colossal |
| `victory` | 1,6 s | 12 | non | pose de victoire, aura, regard |

Format d'une entrée : `fw/fh` taille d'une image, `cols` colonnes dans l'atlas, `n` images,
`ax/ay` = point d'ancrage (milieu des pieds) dans l'image, `U` = taille du perso en px.
Lecture : image `i` à `((i % cols)·fw, ⌊i / cols⌋·fh)` ; dessiner à `(x − ax, y − ay)`.

### Cinématique (29,5 s)

Héros en contre-plongée → logo → entrée → idle → course/dash/saut → combo → défense/hurt →
ki-blast → transformation → cut-in « ÉCLIPSE ÉCARLATE » → ultime + explosion → pose iconique et citation.
Bouton **▶ Cinématique** dans l'écran Cyborgs quand SHADOW est sélectionné.

## Intégration dans le jeu

- `js/shadow.js` charge le manifest et les atlas, et traduit les poses du moteur (`setPose`, `seq`) en clips (`SH_MAP`).
- `drawCyborg()` délègue à `drawShadow()` quand `v === 'shadow'` (fantômes, aperçus, vignettes compris).
- `playClip(f, 'clip')` force un clip complet (entrée en combat, super). Super : `CINE.shadow` dans `js/fights.js`.
- Service worker : spritesheets mises en cache hors-ligne ; la vidéo est lue en streaming (non mise en cache).

## Régénérer

```bash
pip install rembg onnxruntime opencv-python-headless pillow numpy
python3 tools/extract_sprites.py assets/shadow/src/reference.webp /tmp/cut   # détourage (optionnel)
python3 tools/build_sheets.py            # toutes les spritesheets (≈ 1 min)
python3 tools/build_sheets.py combo ko   # seulement certains clips
python3 tools/build_video.py             # cinématique MP4 + WebM (≈ 15-20 min sur 4 cœurs)
python3 tools/build_video.py --preview 3.3,13.5 aperçu.png
```

`tools/fx.py` = moteur de rendu (compositing prémultiplié, bloom tone-mappé, aura de flammes,
éclairs, ki, rayon, étincelles, fumée, lignes de vitesse) · `tools/clips.py` = chorégraphies ·
`tools/sfx.py` = bande-son synthétisée (aucun sample externe).
Changer une animation = modifier sa fonction dans `clips.py`, puis relancer les deux builds.

## Générateurs vidéo IA (Kling, Runway, PixVerse, Hailuo)

Ces services n'étaient pas accessibles depuis l'environnement de production (réseau bloqué, pas de compte).
Le pack ci-dessus n'en dépend pas. Pour des plans « dessin animé » encore plus riches (cinématique uniquement,
pas les sprites de jeu, que ces outils ne savent pas garder cohérents image par image) :

1. Créer un compte sur **Kling AI** (klingai.com) — le plus fiable pour l'image→vidéo de personnages anime — et acheter des crédits (≈ 10 $ pour une vingtaine de clips de 5 s).
2. Mode **Image to Video**, image de départ : `assets/shadow/src/hero.png` (ou une capture de la cinématique), format **9:16**, 5 s, mode Professional.
3. Prompts (en anglais, les modèles les comprennent mieux) :
   - *Intro* : `dark anime fighter in a black and red coat stands still, crimson aura slowly ignites around him, glowing red eyes, hair and coat flowing in the wind, blood moon behind, cinematic slow push-in, embers floating`
   - *Ultimate* : `anime fighter raises his fist, a black eclipse sphere with a crimson corona grows above it, red lightning, then he fires a massive red energy beam, screen shake, dramatic lighting`
   - Prompt négatif : `extra limbs, deformed hands, text, watermark, color change, different outfit`
4. Déposer les MP4 obtenus dans `assets/shadow/video/` et les monter avec ffmpeg, ou me les donner : je les intègre.

Runway Gen-4 (« References ») marche aussi, PixVerse/Hailuo sont moins chers mais dérivent plus sur le costume.
