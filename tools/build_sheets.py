"""Génère les spritesheets du jeu : assets/shadow/sheets/<clip>.webp + manifest.json

usage : python3 tools/build_sheets.py [clip ...]
"""
import json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image
import fx, clips

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'shadow', 'sheets')
SCALE = 1.25  # perso ≈ 200 px de haut : net sur mobile (le jeu l'affiche à ~130 px logiques × DPR)

# nom : (durée s, fps, boucle, largeur cellule ×U, hauteur ×U, ancre x ×U, kwargs)
CLIPS = {
    'idle':       (1.5, 12, True, 1.3, 1.55, .6, {}),
    'idle_power': (1.5, 12, True, 1.7, 2.1, .85, {}),
    'walk':       (.8, 10, True, 1.4, 1.5, .62, {}),
    'run':        (.5, 12, True, 2.0, 1.5, 1.15, {}),
    'dash':       (.45, 20, False, 2.7, 1.5, 1.25, {}),
    'jump':       (.9, 15, False, 1.6, 2.1, .7, {}),
    'combo':      (1.35, 15, False, 2.4, 1.9, .75, {}),
    'guard':      (.7, 15, False, 1.7, 1.55, .75, {}),
    'hurt':       (.5, 15, False, 1.6, 1.55, .95, {}),
    'ko':         (1.6, 12, False, 2.5, 1.45, 1.7, {}),
    'kiblast':    (1.0, 15, False, 3.8, 1.6, .65, {}),
    'kiboom':     (.6, 20, False, 1.5, 1.5, .75, {}),
    'transform':  (1.8, 15, False, 2.1, 2.9, 1.05, {}),
    'ultimate':   (3.0, 15, False, 5.2, 2.5, .9, {'beam_len': 4.1}),
    'intro':      (2.2, 15, False, 1.8, 2.1, .9, {}),
    'victory':    (1.6, 12, False, 1.8, 2.1, .9, {}),
}
_A = None

def render(args):
    name, i = args
    global _A
    if _A is None: _A = clips.Actor(SCALE)
    D, fps, loop, cw, ch, ax, kw = CLIPS[name]
    A = _A; U = A.U
    W, H = int(cw * U) // 2 * 2, int(ch * U) // 2 * 2
    A.x, A.y, A.face = ax * U, H - .07 * U, 1
    t = i / fps
    F = clips.Frame(W, H); F.transparent = True
    fn = getattr(clips, name)
    if name in ('idle', 'idle_power', 'walk', 'run'):
        fn(F, t, A, T=D)
    else:
        fn(F, t, A, D, **kw)
    return np.asarray(fx.to_pil(F.done()))

def main(names):
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {'clips': {}}
    U = clips.Actor(SCALE).U
    man['U'] = U
    with Pool(4) as pool:
        for name in names:
            D, fps, loop, cw, ch, ax, kw = CLIPS[name]
            n = max(1, round(D * fps)) + (0 if loop else 1)
            frames = pool.map(render, [(name, i) for i in range(n)])
            fh, fw = frames[0].shape[:2]
            cols = max(1, min(n, 4096 // fw))
            rows = math.ceil(n / cols)
            atlas = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
            for i, f in enumerate(frames):
                atlas.paste(Image.fromarray(f), ((i % cols) * fw, (i // cols) * fh))
            p = os.path.join(OUT, name + '.webp')
            atlas.save(p, 'WEBP', quality=82, alpha_quality=90, method=6)
            man['clips'][name] = {'src': name + '.webp', 'fw': fw, 'fh': fh, 'n': n, 'cols': cols, 'fps': fps, 'loop': loop,
                                  'ax': round(ax * U, 1), 'ay': round(fh - .07 * U, 1)}
            print(f'{name:11s} {n:3d} images {fw}x{fh}  {os.path.getsize(p) / 1024:.0f} Ko', flush=True)
    json.dump(man, open(man_path, 'w'), indent=1)

if __name__ == '__main__':
    main(sys.argv[1:] or list(CLIPS))
