"""Chorégraphie des animations SHADOW FIGHTER.

Chaque clip est une fonction (F, t, A) qui dessine l'instant t (secondes) dans la frame F.
A = acteur : sprites, position des pieds (x,y), U = taille du perso en px, face (1 = regarde à droite).
Les mêmes clips servent aux spritesheets du jeu (fond transparent) et à la vidéo cinématique.
"""
import math, os
import numpy as np
import fx
from fx import (seg, smooth, ease_out, ease_in, lerp, RED, CRIMSON, MAGENTA, VIOLET, WHITE, PINK)

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'assets', 'shadow', 'src')
POSES = ['idle', 'walk', 'run', 'jump', 'attack', 'guard', 'hurt', 'hero']


class Frame:
    def __init__(self, W, H, bg=None):
        self.W, self.H = W, H
        self.C = bg.copy() if bg is not None else fx.canvas(W, H)
        self.Lb = fx.light(W, H)  # lumière derrière le perso
        self.Lf = fx.light(W, H)  # lumière devant
        self.shake = 0.0; self.flash = 0.0; self.flash_col = (1, 1, 1); self.zoom = 1.0; self.chroma = 0

    def _fade(self, L):
        # sur fond transparent, la lueur doit s'éteindre avant le bord de la cellule (sinon arête visible)
        if not self.transparent: return L
        H, W = L.shape[:2]; m = int(min(W, H) * .1)
        fy = np.clip(np.minimum(np.arange(H), H - 1 - np.arange(H)) / m, 0, 1)
        fxx = np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / m, 0, 1)
        return L * (fy[:, None] * fxx[None, :])[..., None]

    def char(self, layer):
        if self.Lb.any(): fx.add(self.C, self._fade(fx.bloom(self.Lb))); self.Lb[:] = 0
        fx.over(self.C, layer)

    def done(self):
        if self.Lb.any(): fx.add(self.C, self._fade(fx.bloom(self.Lb)))
        if self.Lf.any(): fx.add(self.C, self._fade(fx.bloom(self.Lf)))
        if self.flash > 0:
            a = min(self.flash, 1.0)
            self.C[..., :3] = self.C[..., :3] * (1 - a) + np.array(self.flash_col, np.float32) * a * np.maximum(self.C[..., 3:4], .0 if self.transparent else 1)
        return self.C
    transparent = False


class Actor:
    def __init__(self, scale, x=0, y=0, face=1):
        self.S = {k: fx.Sprite(os.path.join(SRC, k + '.png'), scale * (0.5 if k == 'hero' else 1)) for k in POSES}
        self.U = self.S['idle'].h
        self.x, self.y, self.face = x, y, face
        # points d'intérêt (coordonnées sprite)
        self.hand = {}
        for k in ('attack', 'guard', 'run', 'idle', 'jump', 'walk', 'hurt'):
            a = self.S[k].img[..., 3]
            ys, xs = np.nonzero(a > .5)
            h = self.S[k].h
            if k == 'attack':
                i = np.argmax(xs - .9 * ys)            # poing levé vers l'avant
            else:
                sel = (ys > h * .2) & (ys < h * .55)   # poing avant, à hauteur de buste
                i = np.flatnonzero(sel)[np.argmax(xs[sel])]
            self.hand[k] = (float(xs[i]), float(ys[i]))

    def P(self, dx, dy):
        """offset local (en fraction de U, sens du regard) → écran"""
        return (self.x + dx * self.U * self.face, self.y + dy * self.U)

    def body(self, F, pose, dx=0, dy=0, ph=None, wave=1.0, **kw):
        spr = self.S[pose]
        x, y = self.P(dx, dy)
        rot = kw.pop('rot', 0) * self.face
        L = fx.blit(F.C, spr, x, y, flip=self.face < 0, rot=rot, wave_t=ph, wave_amp=wave, ret_layer=True, **kw)
        return L if L is not None else fx.canvas(F.W, F.H)

    def handpos(self, pose, dx=0, dy=0, **kw):
        spr = self.S[pose]; x, y = self.P(dx, dy)
        return fx.spr_point(spr, *self.hand[pose], x, y, kw.get('sx', 1), kw.get('sy', 1), kw.get('rot', 0) * self.face, self.face < 0)

    def eyes(self, pose, dx=0, dy=0, **kw):
        spr = self.S[pose]; x, y = self.P(dx, dy)
        return fx.spr_point(spr, *spr.eye, x, y, kw.get('sx', 1), kw.get('sy', 1), kw.get('rot', 0) * self.face, self.face < 0)


def eye_glint(F, A, p, k=1.0, streak=1.0):
    """éclat des yeux rouges + traînée horizontale (signature du perso)"""
    if k <= 0: return
    U = A.U
    fx.disc(F.Lf, p, U * .018, PINK, 1.5 * k, soft=1)
    fx.disc(F.Lf, p, U * .05, RED, .9 * k, soft=U * .02)
    if streak > 0:
        fx.poly(F.Lf, [(p[0] - U * .28 * streak, p[1]), (p[0], p[1] - U * .007), (p[0] + U * .28 * streak, p[1]), (p[0], p[1] + U * .007)], RED + WHITE * .3, 1.4 * k, blur=1)


def shadow_blob(F, A, dx=0, k=1.0, w=1.0):
    """ombre au sol (normale, pas additive)"""
    if k <= 0: return
    import cv2
    tmp = np.zeros((F.H, F.W), np.float32)
    x, y = A.P(dx, 0)
    cv2.ellipse(tmp, (int(x), int(y)), (int(A.U * .28 * w), int(A.U * .035)), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    tmp = cv2.GaussianBlur(tmp, (0, 0), A.U * .02) * .55 * k
    fx.over(F.C, np.dstack([tmp * 0, tmp * 0, tmp * 0, tmp]).astype(np.float32))


# ============================================================ clips
def idle(F, t, A, T=1.5, power=.25):
    ph = 2 * math.pi * t / T
    b = math.sin(ph)
    shadow_blob(F, A)
    L = A.body(F, 'idle', dy=0, sy=1 + .012 * b, sx=1 - .006 * b, ph=ph, wave=1.0)
    fx.aura(F.Lb, L, t, power * (0.9 + .1 * math.sin(ph * 3)), period=T)
    F.char(L)
    fx.rim(F.Lf, L, RED, .5, off=(-3 * A.face, -2))
    eye_glint(F, A, A.eyes('idle', sy=1 + .012 * b), .55 + .25 * math.sin(ph * 2), streak=.25)
    x, y = A.P(0, 0)
    fx.embers(F.Lf, t, 11, n=8, rect=(x - A.U * .45, y - A.U * 1.2, x + A.U * .45, y), k=.8, period=T)

def idle_power(F, t, A, T=1.5):
    """idle après transformation : aura pleine + étincelles"""
    ph = 2 * math.pi * t / T
    b = math.sin(ph)
    shadow_blob(F, A)
    L = A.body(F, 'idle', sy=1 + .015 * b, sx=1 - .008 * b, ph=ph * 2, wave=1.8)
    fx.aura(F.Lb, L, t, 1.1, height=1.4, period=T)
    F.char(L)
    fx.rim(F.Lf, L, PINK, .9, off=(-3 * A.face, -2))
    eye_glint(F, A, A.eyes('idle', sy=1 + .015 * b), 1.0, streak=.45)
    i = int(t / T * 6) % 6
    if i in (1, 4):
        x, y = A.P(0, 0)
        r = np.random.default_rng(i)
        p0 = (x + r.uniform(-.25, .25) * A.U, y - r.uniform(.5, .95) * A.U)
        fx.lightning(F.Lf, p0, (p0[0] + r.uniform(-.25, .25) * A.U, p0[1] + r.uniform(.1, .3) * A.U), i * 7, width=max(1, A.U / 140))
    x, y = A.P(0, 0)
    fx.embers(F.Lf, t, 12, n=18, rect=(x - A.U * .55, y - A.U * 1.4, x + A.U * .55, y), k=1.0, period=T, rise=120)

def walk(F, t, A, T=.8):
    ph = 2 * math.pi * t / T
    q = (t / T) % 1
    pose = 'walk' if (q < .25 or .5 <= q < .75) else 'idle'
    bob = -abs(math.sin(ph)) * .025
    shadow_blob(F, A)
    L = A.body(F, pose, dy=bob, rot=1.5, ph=ph, wave=1.2)
    fx.aura(F.Lb, L, t, .2, period=T)
    F.char(L)
    fx.rim(F.Lf, L, RED, .45, off=(-3 * A.face, -2))
    eye_glint(F, A, A.eyes(pose, dy=bob, rot=1.5), .5, streak=.2)

def run(F, t, A, T=.5):
    ph = 2 * math.pi * t / T
    bob = -abs(math.sin(ph)) * .06
    shadow_blob(F, A, w=1.2)
    L = A.body(F, 'run', dy=bob, sx=1.04, sy=.98 + abs(math.sin(ph)) * .04, rot=2 + math.sin(ph) * 2, ph=ph * 2, wave=2.2)
    fx.aura(F.Lb, L, t, .3, period=T)
    F.char(L)
    fx.rim(F.Lf, L, RED, .5, off=(-3 * A.face, -2))
    x, y = A.P(-.35, -.55)
    for i in range(5):  # traînées de vitesse derrière le perso
        yy = y + (i - 2) * A.U * .12 + math.sin(ph + i) * 4
        fx.line(F.Lb, (x - A.face * A.U * (.2 + .25 * ((i * .37 + t / T) % 1)), yy), (x - A.face * A.U * (.6 + .3 * ((i * .37 + t / T) % 1)), yy), max(1, A.U / 160), VIOLET + WHITE * .2, .5)
    fx.dust(F.C, F.Lf, A.P(-.25, 0), (t / T * 2) % 1, 3 + int(t / T * 2) % 2, A.U / 250, n=4)

def dash(F, t, A, D=.45):
    """élan éclair : étirement, flou, images rémanentes violettes"""
    k = seg(t, 0, D)
    dx = lerp(-.6, .6, ease_out(k, 2))
    for i in range(4, 0, -1):
        gk = seg(t - i * .03, 0, D)
        gx = lerp(-.6, .6, ease_out(gk, 2))
        G = A.body(F, 'run', dx=gx, sx=1.25, sy=.9, rot=8, wave=0)
        G[..., :3] = G[..., 3:4] * (VIOLET * .7 + WHITE * .3)
        F.char(G * (.45 - i * .08) * (1 - k * .5))
    L = A.body(F, 'run', dx=dx, sx=1.3 - .3 * k, sy=.9 + .1 * k, rot=8 * (1 - k), blur=18 * (1 - k), blur_dir=(1, 0))
    fx.silhouette_glow(F.Lb, L, VIOLET, 1.2 * (1 - k * .6), s=6)
    F.char(L)
    x, y = A.P(dx, -.5)
    rng = np.random.default_rng(int(t * 30))
    for i in range(9):
        yy = y + rng.uniform(-.45, .45) * A.U
        ln = A.U * rng.uniform(.5, 1.3) * (1 - k * .7)
        fx.line(F.Lf, (x - A.face * A.U * .2, yy), (x - A.face * (A.U * .2 + ln), yy), max(1, A.U / 110), WHITE * .6 + VIOLET * .6, .9 * (1 - k * .5))
    fx.slash_arc(F.Lf, A.P(dx + .15, -.5), A.U * .45, -60 * A.face, 60 * A.face, A.U * .12, RED, .6 * (1 - k))
    if k > .7: fx.dust(F.C, F.Lf, A.P(dx, 0), seg(t, D * .7, D * 1.6), 9, A.U / 220)

def jump(F, t, A, D=.9):
    if t < .12:     # anticipation
        q = smooth(t / .12); shadow_blob(F, A)
        L = A.body(F, 'idle', sy=1 - .1 * q, sx=1 + .06 * q)
        F.char(L); return
    if t >= .76:    # réception
        q = seg(t, .76, D)
        sq = .12 * math.sin(math.pi * min(q * 1.5, 1))
        shadow_blob(F, A)
        L = A.body(F, 'idle', sy=1 - sq, sx=1 + sq * .6)
        F.char(L)
        fx.dust(F.C, F.Lf, A.P(0, 0), q, 21, A.U / 200)
        fx.ring(F.Lf, A.P(0, 0), A.U * (.2 + .5 * ease_out(q)), 3, RED, .6 * (1 - q), sy=.18)
        return
    q = seg(t, .12, .76)
    hgt = 4 * q * (1 - q) * .75
    shadow_blob(F, A, k=1 - hgt, w=1 - hgt * .5)
    st = 1 + .14 * (1 - seg(q, 0, .3)) - .06 * seg(q, .75, 1)
    L = A.body(F, 'jump', dy=-hgt, sy=st, sx=2 - st, rot=-6 + 14 * q, ph=t * 9, wave=1.5)
    fx.aura(F.Lb, L, t, .25)
    F.char(L)
    fx.rim(F.Lf, L, RED, .5)
    if q < .2: fx.dust(F.C, F.Lf, A.P(0, 0), q * 3, 22, A.U / 220, n=6)

def _impact(F, A, p, t, seed, big=1.0):
    """étincelle d'impact : étoile + anneau + éclats"""
    if t < 0 or t > .4: return
    U = A.U
    q = t / .4
    fx.starburst(F.Lf, p, U * .22 * big * (1 - q * .4), seed, RED, spikes=12, k=1.2 * (1 - q) ** 1.5, rot=seed)
    fx.ring(F.Lf, p, U * (.08 + .4 * ease_out(q)) * big, max(1, U / 60 * (1 - q)), PINK, 1.2 * (1 - q))
    fx.sparks(F.Lf, p, t, seed, n=int(14 * big), speed=U * 2.6 * big, life=.35, width=max(1, U / 120), grav=U * 2)

def combo(F, t, A, D=1.35):
    """attaque rapide x2 + attaque lourde (croissant rouge)"""
    hits = []
    if t < .3:      # coup 1
        q = seg(t, 0, .3)
        dx = .18 * ease_out(seg(q, 0, .3)) - .05 * seg(q, .6, 1)
        pose = 'guard' if q < .15 else 'attack'
        hits.append((.08, 1, .7))
    elif t < .6:    # coup 2
        q = seg(t, .3, .6)
        dx = .13 + .2 * ease_out(seg(q, 0, .3))
        pose = 'guard' if q < .2 else 'attack'
        hits.append((.38, 2, .8))
    elif t < .8:    # armé du coup lourd
        q = seg(t, .6, .8)
        dx = .33 - .08 * smooth(q); pose = 'guard'
    else:           # coup lourd
        q = seg(t, .8, D)
        dx = .25 + .35 * ease_out(seg(q, 0, .25)); pose = 'attack'
        hits.append((.86, 3, 1.6))
    rot = {'guard': -4 if t < .8 and t >= .6 else 4, 'attack': 6}[pose]
    sx = 1.08 if pose == 'attack' else 1
    shadow_blob(F, A, dx=dx)
    L = A.body(F, pose, dx=dx, rot=rot, sx=sx, ph=t * 10, wave=1.4)
    pw = .35 + (1.0 * seg(t, .6, .82) * (1 - seg(t, 1.1, D)))
    fx.aura(F.Lb, L, t, pw, height=1.2)
    for th, sd, big in hits:
        if 0 <= t - th < .06: F.flash = .0  # (le flash plein écran est géré par la cinématique)
    if t >= .8:
        q = seg(t, .8, 1.05)
        c = A.P(dx + .05, -.55)
        fx.slash_arc(F.Lb, c, A.U * .62, (150 if A.face > 0 else 30), (-60 if A.face > 0 else 240), A.U * .22, RED, 1.0 * (1 - seg(t, 1.0, D)), prog=ease_out(q, 2))
    F.char(L)
    fx.rim(F.Lf, L, RED, .6)
    eye_glint(F, A, A.eyes(pose, dx=dx, rot=rot, sx=sx), .8, streak=.3 if t > .8 else .15)
    for th, sd, big in hits:
        fpos = A.handpos('attack', dx=dx, rot=6, sx=1.08)
        _impact(F, A, fpos, t - th, sd, big)

def guard(F, t, A, D=.7):
    q = seg(t, 0, D)
    dx = -.12 * ease_out(seg(t, .12, .35))
    shadow_blob(F, A, dx=dx)
    L = A.body(F, 'guard', dx=dx, sy=1 - .03 * math.sin(math.pi * seg(t, .1, .3)), ph=t * 6, wave=.8)
    fx.aura(F.Lb, L, t, .35)
    F.char(L)
    fx.rim(F.Lf, L, RED, .5)
    # barrière d'énergie (arc magenta) devant les poings
    k = smooth(seg(t, 0, .1)) * (1 - seg(t, .5, D))
    c = A.P(dx + .32, -.52)
    import cv2
    tmp = np.zeros((F.H, F.W), np.float32)
    cv2.ellipse(tmp, (int(c[0]), int(c[1])), (int(A.U * .13), int(A.U * .48)), 0, -80, 80, 1.0, max(2, int(A.U / 45)), cv2.LINE_AA)
    if A.face < 0: tmp = tmp  # l'arc est symétrique, la position suffit
    F.Lf[...] += cv2.GaussianBlur(tmp, (0, 0), 2)[..., None] * (MAGENTA * .8 + RED * .6) * 1.4 * k
    _impact(F, A, (c[0] + A.face * A.U * .1, c[1]), t - .12, 4, .7)
    if t > .12: fx.dust(F.C, F.Lf, A.P(dx, 0), seg(t, .12, D), 31, A.U / 260, n=5)

def hurt(F, t, A, D=.5):
    q = seg(t, 0, D)
    dx = -.18 * ease_out(seg(t, 0, .25)) + .05 * smooth(seg(t, .3, D))
    shadow_blob(F, A, dx=dx)
    jit = (math.sin(t * 90) * .012) * (1 - q)
    L = A.body(F, 'hurt', dx=dx + jit, rot=-8 * (1 - smooth(seg(t, .2, D))), flash=1.0 if t < .06 else 0, tint=RED, tint_k=.35 * (1 - seg(t, .06, .3)) if t >= .06 else 0)
    F.char(L)
    _impact(F, A, A.P(dx + .12, -.6), t, 41, .9)

def ko(F, t, A, D=1.6):
    """chute en arrière, rebond, se dissout en fumée"""
    q = seg(t, .1, .55)
    rot = -88 * ease_in(q, 2)
    b = seg(t, .55, .8)
    bounce = math.sin(math.pi * b) * .12
    dx = -.35 * ease_out(seg(t, 0, .8))
    lift = .06 * seg(t, .3, .55) + bounce
    pose = 'hurt'
    shadow_blob(F, A, dx=dx - .3 * q, w=1 + q)
    fade = 1 - seg(t, 1.0, D) * .85
    L = A.body(F, pose, dx=dx, dy=-lift, rot=rot, flash=1.0 if t < .06 else 0, alpha=fade)
    F.char(L)
    if t < .3: _impact(F, A, A.P(.1, -.6), t, 51, 1.1)
    if t > .55:
        fx.dust(F.C, F.Lf, A.P(dx - .45, 0), seg(t, .55, 1.2), 52, A.U / 170)
    if t > .9:
        for i in range(3):
            fx.smoke(F.C, A.P(dx - .2 - .25 * i, -.08), A.U * .25, seg(t, .9 + i * .08, D), 60 + i, alpha=.6)

def kiblast(F, t, A, D=1.0, travel=True):
    """charge d'une sphère rouge au poing puis tir"""
    rel = .5
    recoil = -.07 * math.sin(math.pi * seg(t, rel, rel + .2))
    pose = 'guard' if t < rel else 'attack'
    rot = 0 if t < rel else 10
    dx = recoil
    shadow_blob(F, A, dx=dx)
    L = A.body(F, pose, dx=dx, rot=rot, ph=t * 8, wave=1.2)
    fx.aura(F.Lb, L, t, .3 + .5 * seg(t, .1, rel) * (1 - seg(t, rel, D)))
    F.char(L)
    fx.rim(F.Lf, L, RED, .6)
    h = A.handpos(pose, dx=dx, rot=rot)
    U = A.U
    if t < rel:
        k = seg(t, .05, rel)
        p = (h[0] + A.face * U * .06, h[1])
        r = U * .03 + U * .09 * ease_out(k)
        fx.kiball(F.Lf, p, r, t)
        rng = np.random.default_rng(5)
        for i in range(10):  # particules aspirées
            a = rng.uniform(0, 2 * math.pi); ph = (t * 2.5 + rng.uniform(0, 1)) % 1
            d = U * .5 * (1 - ph)
            fx.line(F.Lf, (p[0] + math.cos(a) * d, p[1] + math.sin(a) * d), (p[0] + math.cos(a) * (d + U * .06), p[1] + math.sin(a) * (d + U * .06)), max(1, U / 150), PINK, .8 * ph)
    else:
        k = seg(t, rel, D)
        sx0 = h[0] + A.face * U * .06
        x = sx0 + A.face * U * 3.2 * ease_in(k, 1.4) if travel else sx0
        p = (x, h[1] + (U * .25 * k if pose == 'attack' else 0))
        fx.kiball(F.Lf, p, U * .12, t)
        for j in range(1, 6):  # traînée
            fx.disc(F.Lf, (p[0] - A.face * U * .07 * j, p[1]), U * .1 * (1 - j / 6), RED, .5 * (1 - j / 6), soft=U * .03)
        if t - rel < .1: fx.starburst(F.Lf, (sx0, h[1]), U * .2, 77, RED, k=1 - (t - rel) / .1)

def kiboom(F, t, A, D=.6):
    """explosion du ki-blast à l'impact (sprite séparé, centré)"""
    U = A.U; p = A.P(0, -.5); q = seg(t, 0, D)
    fx.disc(F.Lf, p, U * (.15 + .35 * ease_out(q)), RED, 1.4 * (1 - q) ** 2, soft=U * .08)
    fx.starburst(F.Lf, p, U * .4 * (1 - q * .3), 9, RED, spikes=16, k=1.4 * (1 - q) ** 2, rot=q)
    fx.ring(F.Lf, p, U * (.1 + .55 * ease_out(q)), max(1, U / 40 * (1 - q)), PINK, 1.3 * (1 - q))
    fx.sparks(F.Lf, p, t, 3, n=22, speed=U * 3, life=.5, width=max(1, U / 110), grav=U * 2)
    fx.smoke(F.C, p, U * .35, q, 4, alpha=.5)

def transform(F, t, A, D=1.8):
    """concentration → explosion d'aura → forme éveillée"""
    U = A.U
    x, y = A.P(0, 0)
    burst = .55
    if t < burst:
        k = seg(t, 0, burst)
        shadow_blob(F, A)
        L = A.body(F, 'guard', sy=1 - .06 * smooth(k), sx=1 + .03 * smooth(k), ph=t * 6, wave=.6 + k)
        fx.aura(F.Lb, L, t, .2 + .5 * k, height=.8)
        F.char(L)
        rng = np.random.default_rng(8)
        for i in range(14):  # énergie qui converge
            a = rng.uniform(0, 2 * math.pi); ph = (t * 2 + rng.uniform(0, 1)) % 1
            d = U * .9 * (1 - ph) + U * .15
            c = (x, y - U * .5)
            fx.line(F.Lf, (c[0] + math.cos(a) * d, c[1] + math.sin(a) * d), (c[0] + math.cos(a) * (d + U * .12), c[1] + math.sin(a) * (d + U * .12)), max(1, U / 140), RED + WHITE * .3, ph)
        if int(t * 20) % 3 == 0:
            fx.lightning(F.Lf, (x - U * .3, y - U * .9), (x + U * .1, y - U * .3), int(t * 20), width=max(1, U / 150), k=k)
        eye_glint(F, A, A.eyes('guard', sy=1 - .06 * smooth(k)), k, streak=k * .5)
    else:
        k = seg(t, burst, D)
        e = 1 - seg(t, burst, burst + .25)
        shadow_blob(F, A)
        ph = t * 9
        L = A.body(F, 'idle', sy=1 + .02 * e, ph=ph, wave=2.0, flash=e * .8)
        fx.aura(F.Lb, L, t, 1.1 + 1.2 * e, height=1.4 + .8 * e)
        # colonne de lumière
        fx.poly(F.Lb, [(x - U * .3 * (1 + e), y), (x + U * .3 * (1 + e), y), (x + U * .12, y - U * 2.5), (x - U * .12, y - U * 2.5)], RED * .6 + MAGENTA * .3, 1.2 * e, blur=U * .06)
        F.char(L)
        fx.rim(F.Lf, L, PINK, 1.0)
        fx.ring(F.Lf, (x, y), U * (.2 + 1.3 * ease_out(seg(t, burst, burst + .5))), max(1, U / 35 * e), PINK, 1.5 * e, sy=.25)
        fx.ring(F.Lf, (x, y - U * .5), U * (.1 + 1.0 * ease_out(seg(t, burst, burst + .35))), max(1, U / 50 * e), WHITE, 1.2 * e)
        rng = np.random.default_rng(int(t * 15))
        for i in range(2):
            p0 = (x + rng.uniform(-.4, .4) * U, y - rng.uniform(.3, 1.1) * U)
            fx.lightning(F.Lf, p0, (p0[0] + rng.uniform(-.3, .3) * U, p0[1] + rng.uniform(.2, .4) * U), int(t * 15) * 3 + i, width=max(1, U / 130))
        # débris qui s'élèvent
        rng = np.random.default_rng(99)
        for i in range(12):
            px = x + rng.uniform(-.7, .7) * U; vy = rng.uniform(.4, 1.1) * U
            py = y - vy * ease_out(k, 2) - rng.uniform(0, .1) * U
            s = U * rng.uniform(.012, .03)
            fx.poly(F.Lb, [(px - s, py), (px, py - s * 1.3), (px + s, py + s * .2)], (.25, .1, .3), 1.0)
        eye_glint(F, A, A.eyes('idle'), 1.0, streak=.6 * e + .4)
        fx.embers(F.Lf, t, 14, n=20, rect=(x - U * .6, y - U * 1.5, x + U * .6, y), rise=140)
        if t < burst + .05: F.flash = max(F.flash, 1 - (t - burst) / .05)

def ultimate(F, t, A, D=3.0, beam_len=4.0):
    """ÉCLIPSE ÉCARLATE : sphère-éclipse chargée au-dessus du poing levé, puis rayon colossal"""
    U = A.U
    fire = 1.25
    if t < fire:
        k = seg(t, 0, fire)
        shadow_blob(F, A)
        L = A.body(F, 'attack', rot=-4, ph=t * 9, wave=1.8)
        fx.aura(F.Lb, L, t, .8 + .6 * k, height=1.3 + .6 * k)
        F.char(L)
        fx.rim(F.Lf, L, PINK, .9)
        h = A.handpos('attack', rot=-4)
        c = (h[0] + A.face * U * .05, h[1] - U * (.2 + .3 * ease_out(k)))
        r = U * (.05 + .35 * ease_out(k, 2))
        # éclipse : halo rouge, couronne, disque noir au centre
        fx.disc(F.Lb, c, r * 2.2, CRIMSON, .8, soft=r * .6)
        fx.kiball(F.Lf, c, r, t, 1.2)
        import cv2
        dark = np.zeros((F.H, F.W), np.float32)
        cv2.circle(dark, (int(c[0]), int(c[1])), max(1, int(r * .62)), 1.0, -1, cv2.LINE_AA)
        dark = cv2.GaussianBlur(dark, (0, 0), max(1, r * .05)) * smooth(seg(k, .3, .7))
        F.Lf *= (1 - dark[..., None] * .97)
        rng = np.random.default_rng(int(t * 18))
        for i in range(3):  # éclairs aspirés vers la sphère
            a = rng.uniform(0, 2 * math.pi); d = U * rng.uniform(.6, 1.1)
            fx.lightning(F.Lf, (c[0] + math.cos(a) * d, c[1] + math.sin(a) * d), c, int(t * 18) * 5 + i, width=max(1, U / 140), k=k)
        eye_glint(F, A, A.eyes('attack', rot=-4), 1.0, streak=.5 + k)
        fx.embers(F.Lf, t, 15, n=24, rect=(A.x - U, A.y - U * 1.8, A.x + U, A.y), rise=180)
        return c
    k = seg(t, fire, D)
    end = seg(t, D - .5, D)
    shadow_blob(F, A, dx=-.08)
    L = A.body(F, 'guard', dx=-.08 * ease_out(seg(t, fire, fire + .15)), sx=1.05, ph=t * 12, wave=2.4)
    fx.aura(F.Lb, L, t, 1.6 * (1 - end * .7), height=1.6)
    F.char(L)
    fx.rim(F.Lf, L, PINK, 1.0)
    h = A.handpos('guard', dx=-.08)
    x0 = h[0] + A.face * U * .05
    grow = ease_out(seg(t, fire, fire + .35), 2)
    thick = U * (.08 + .22 * grow) * (1 - end)
    x1 = x0 + A.face * U * beam_len * grow
    if A.face > 0: fx.beam(F.Lf, x0, h[1], x1, thick, t, 1.2)
    else: fx.beam(F.Lf, x1, h[1], x0, thick, t, 1.2)
    fx.kiball(F.Lf, (x0, h[1]), thick * 1.3, t, 1.3)
    if t - fire < .08: F.flash = max(F.flash, 1 - (t - fire) / .08)
    eye_glint(F, A, A.eyes('guard', dx=-.08), 1.0, streak=1.0)
    return (x1, h[1])

def intro(F, t, A, D=2.2):
    """émerge de l'ombre : colonne de fumée → silhouette noire → yeux → révélation"""
    U = A.U
    x, y = A.P(0, 0)
    k_sil = smooth(seg(t, .25, .9))
    k_col = smooth(seg(t, 1.25, 1.6))
    if t < 1.1:
        for i in range(4):
            fx.smoke(F.C, (x + (i - 1.5) * U * .12, y - U * (.15 + .25 * i)), U * .4, seg(t, i * .08, 1.1 + i * .1), 70 + i, color=(.08, .02, .1), alpha=.95)
    ph = t * 5
    shadow_blob(F, A, k=k_sil)
    L = A.body(F, 'idle', sy=.85 + .15 * ease_out(k_sil), ph=ph, wave=1.5, tint=(.03, .0, .04), tint_k=1 - k_col, alpha=k_sil)
    fx.aura(F.Lb, L, t, .3 + 1.4 * math.sin(math.pi * seg(t, 1.2, 1.9)), height=1.4)
    F.char(L)
    fx.rim(F.Lf, L, RED, .8 * k_sil)
    # yeux qui s'allument dans le noir
    ek = smooth(seg(t, .85, 1.0)) * (1 - .4 * seg(t, 1.4, D))
    eye_glint(F, A, A.eyes('idle', sy=.85 + .15 * ease_out(k_sil)), ek * 1.3, streak=ek * (1.4 - seg(t, 1.0, 1.6)))
    if t > 1.25:
        q = seg(t, 1.25, 1.75)
        fx.ring(F.Lf, (x, y), U * (.2 + 1.0 * ease_out(q)), max(1, U / 40 * (1 - q)), RED, 1.2 * (1 - q), sy=.25)
        fx.embers(F.Lf, t, 16, n=16, rect=(x - U * .6, y - U * 1.3, x + U * .6, y), rise=150, k=1 - q * .5)

def victory(F, t, A, D=1.6):
    U = A.U
    k = seg(t, 0, .4)
    ph = t * 6
    shadow_blob(F, A)
    L = A.body(F, 'idle', sy=1 + .03 * math.sin(math.pi * k), ph=ph, wave=1.6)
    fx.aura(F.Lb, L, t, .3 + .9 * math.sin(math.pi * seg(t, 0, D)), height=1.3)
    F.char(L)
    fx.rim(F.Lf, L, PINK, .8)
    eye_glint(F, A, A.eyes('idle'), 1.2, streak=.3 + .9 * math.sin(math.pi * seg(t, .3, .9)))
    x, y = A.P(0, 0)
    fx.embers(F.Lf, t, 17, n=26, rect=(x - U * .7, y - U * 1.5, x + U * .7, y), rise=120)
