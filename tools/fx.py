"""Moteur de rendu 2D pour les animations SHADOW FIGHTER.

Toutes les images sont des tableaux float32 [0,1] en alpha prémultiplié (H,W,4).
Les effets lumineux se dessinent dans une couche « lumière » RGB (H,W,3) ajoutée en mode additif.
"""
import math, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'ChakraPetch-BoldItalic.ttf')

# palette de la planche de référence
RED = np.array([1.0, .12, .22], np.float32)
CRIMSON = np.array([.85, .02, .12], np.float32)
MAGENTA = np.array([.95, .25, .75], np.float32)
VIOLET = np.array([.45, .2, .85], np.float32)
WHITE = np.array([1, 1, 1], np.float32)
PINK = np.array([1, .6, .75], np.float32)


def smooth(t):
    t = min(max(t, 0.0), 1.0); return t * t * (3 - 2 * t)
def ease_out(t, p=3):
    t = min(max(t, 0.0), 1.0); return 1 - (1 - t) ** p
def ease_in(t, p=3):
    t = min(max(t, 0.0), 1.0); return t ** p
def lerp(a, b, k): return a + (b - a) * k
def seg(t, a, b):
    """progression 0→1 de t entre a et b"""
    return min(max((t - a) / (b - a), 0.0), 1.0)


# ---------------------------------------------------------------- canvas
def canvas(w, h): return np.zeros((h, w, 4), np.float32)
def light(w, h): return np.zeros((h, w, 3), np.float32)

def over(C, S, alpha=1.0):
    if alpha != 1.0: S = S * alpha
    C[..., :3] = S[..., :3] + C[..., :3] * (1 - S[..., 3:4])
    C[..., 3] = S[..., 3] + C[..., 3] * (1 - S[..., 3])

def add(C, L, k=1.0):
    """lumière additive ; l'alpha monte pour que la lueur reste visible sur fond transparent"""
    L = L * k
    C[..., :3] += L
    C[..., 3] = np.maximum(C[..., 3], np.clip(L.max(2), 0, 1))
    np.clip(C, 0, 1, out=C)
    C[..., :3] = np.minimum(C[..., :3], C[..., 3:4])

def bloom(L, sig=(3, 10, 28), w=(.55, .35, .25)):
    out = L.copy()
    for s, k in zip(sig, w):
        out += cv2.GaussianBlur(L, (0, 0), s) * k
    return 1 - np.exp(-out * 1.1)  # tone-mapping : la lumière garde sa teinte au lieu de virer au blanc

def from_pil(im):
    a = np.asarray(im.convert('RGBA'), np.float32) / 255
    a[..., :3] *= a[..., 3:4]
    return a

def to_pil(C, bg=None):
    C = np.clip(C, 0, 1)
    if bg is not None:  # aplatit sur une couleur
        out = C[..., :3] + np.array(bg, np.float32) * (1 - C[..., 3:4])
        return Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGB')
    a = C[..., 3:4]
    rgb = np.where(a > 1e-4, C[..., :3] / np.maximum(a, 1e-4), 0)
    return Image.fromarray((np.concatenate([rgb, a], 2) * 255 + .5).astype(np.uint8), 'RGBA')


# ---------------------------------------------------------------- sprites
class Sprite:
    """Pose détourée + point d'ancrage (milieu des pieds)."""
    def __init__(self, path, scale):
        im = Image.open(path).convert('RGBA')
        bb = im.getbbox(); im = im.crop(bb)
        w, h = im.size
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        self.img = from_pil(im)
        a = self.img[..., 3]
        rows = np.nonzero(a.max(1) > .5)[0]
        bot = rows[-1]
        band = a[max(0, bot - int(.06 * a.shape[0])):bot + 1]
        xs = np.nonzero(band.max(0) > .5)[0]
        self.ax, self.ay = float((xs[0] + xs[-1]) / 2), float(bot)
        self.h, self.w = a.shape
        # yeux : pixels rouges vifs dans le haut du sprite (servent aux reflets/flashs des yeux)
        rgb = np.asarray(im, np.float32)
        top = int(self.h * .32)
        m = (rgb[:top, :, 0] > 180) & (rgb[:top, :, 1] < 90) & (rgb[:top, :, 3] > 200)
        ys, xs2 = np.nonzero(m)
        self.eye = (float(np.mean(xs2)), float(np.mean(ys))) if len(xs2) > 3 else (self.ax, self.h * .12)
        self._noise = None

    def wave(self, ph, amp=1.0):
        """ondulation cheveux / manteau : déplacement nul aux pieds, maximal aux extrémités"""
        if amp <= 0: return self.img
        h, w = self.h, self.w
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        ny = yy / h
        wt_hair = np.clip((.3 - ny) / .3, 0, 1) ** 1.5
        wt_coat = np.clip((ny - .35) / .4, 0, 1) * np.clip((.92 - ny) / .1, 0, 1) * np.clip(np.abs(xx - self.ax) / (w * .35), 0, 1)
        dx = (np.sin(ph * 2 + ny * 9) * wt_hair * 2.2 + np.sin(ph + ny * 7 + xx / w * 3) * wt_coat * 4.5) * amp * w / 120
        dy = np.cos(ph * 2 + xx / w * 6) * wt_hair * 1.2 * amp * w / 120
        return cv2.remap(self.img, xx - dx, yy - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def blit(C, spr, x, y, sx=1.0, sy=1.0, rot=0.0, flip=False, alpha=1.0, flash=0.0, tint=None, tint_k=0.0,
         wave_t=None, wave_amp=1.0, blur=0.0, blur_dir=(1, 0), ret_layer=False):
    """Dessine un Sprite ancré aux pieds en (x,y). rot en degrés. Renvoie le calque si ret_layer."""
    img = spr.wave(wave_t, wave_amp) if wave_t is not None else spr.img
    H, W = C.shape[:2]
    fx = -1 if flip else 1
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    # matrice sprite → écran : translation ancre, échelle, rotation, translation (x,y)
    A = np.array([[c * sx * fx, -s * sy], [s * sx * fx, c * sy]], np.float32)
    t = np.array([x, y], np.float32) - A @ np.array([spr.ax, spr.ay], np.float32)
    corners = np.array([[0, 0], [spr.w, 0], [0, spr.h], [spr.w, spr.h]], np.float32) @ A.T + t
    x0, y0 = np.floor(corners.min(0)).astype(int) - 2
    x1, y1 = np.ceil(corners.max(0)).astype(int) + 2
    x0c, y0c, x1c, y1c = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    if x1c <= x0c or y1c <= y0c: return None
    M = np.hstack([A, (t - [x0c, y0c])[:, None]])
    L = cv2.warpAffine(img, M, (x1c - x0c, y1c - y0c), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    if blur > 0:
        k = int(blur) * 2 + 1
        ker = np.zeros((k, k), np.float32)
        d = np.array(blur_dir, np.float32); d /= np.linalg.norm(d) + 1e-6
        for i in range(k):
            o = (i - k // 2)
            ker[int(round(k // 2 + o * d[1])), int(round(k // 2 + o * d[0]))] = 1
        L = cv2.filter2D(L, -1, ker / ker.sum())
    if tint is not None and tint_k > 0:
        L[..., :3] = L[..., :3] * (1 - tint_k) + np.array(tint, np.float32) * L[..., 3:4] * tint_k
    if flash > 0:
        L[..., :3] += (L[..., 3:4] - L[..., :3]) * flash
    L *= alpha
    if ret_layer:
        full = canvas(W, H); full[y0c:y1c, x0c:x1c] = L; return full
    sub = C[y0c:y1c, x0c:x1c]
    over(sub, L)
    return (x0c, y0c, x1c, y1c)


def spr_point(spr, px, py, x, y, sx=1.0, sy=1.0, rot=0.0, flip=False):
    """position écran d'un point du sprite (même transformation que blit)"""
    fx = -1 if flip else 1
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    dx, dy = (px - spr.ax) * sx * fx, (py - spr.ay) * sy
    return (x + c * dx - s * dy, y + s * dx + c * dy)


# ---------------------------------------------------------------- bruit
_NOISE = {}
def noise(size=512, seed=1):
    if (size, seed) in _NOISE: return _NOISE[(size, seed)]
    r = np.random.default_rng(seed)
    n = np.zeros((size, size), np.float32)
    for s, w in ((48, 1), (20, .5), (8, .25)):
        f = r.standard_normal((size, size)).astype(np.float32)
        P = int(s * 2)  # flou périodique (bruit raccordable) : padding en mode « wrap »
        f = cv2.GaussianBlur(np.pad(f, P, mode='wrap'), (0, 0), s / 3)[P:-P, P:-P]
        n += f / (f.std() + 1e-6) * w
    n = (n - n.min()) / (n.max() - n.min())
    _NOISE[(size, seed)] = n
    return n

def sample_noise(h, w, ox, oy, scale=1.0, seed=1):
    n = noise(512, seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    mx = ((xx * scale + ox) % 512).astype(np.float32)
    my = ((yy * scale + oy) % 512).astype(np.float32)
    return cv2.remap(n, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)


# ---------------------------------------------------------------- effets
def col(c, k=1.0): return tuple(float(v) * k for v in c)

def aura(L, layer, t, power=1.0, color=RED, core=PINK, height=1.0, period=None):
    """Aura de flammes qui épouse la silhouette (comme dans les jeux de combat anime)."""
    if power <= 0: return
    a = layer[..., 3]
    ys, xs = np.nonzero(a > .3)
    if len(xs) == 0: return
    H, W = a.shape
    pad = int(60 * height * power) + 30
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, W)
    y0, y1 = max(ys.min() - pad * 2, 0), min(ys.max() + 20, H)
    sub = a[y0:y1, x0:x1]
    h, w = sub.shape
    if h < 2 or w < 2: return
    d = int(10 * power) + 3
    m = cv2.dilate(sub, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d)))
    m = cv2.GaussianBlur(m, (0, 0), 4 + 3 * power)
    # flammes : on étire vers le haut avec un bruit qui défile
    v1, v2 = 260, 520
    if period:  # le bruit est cyclique sur 512 px : vitesse multiple de 512/période → boucle parfaite
        v1 = 512 / period * max(1, round(260 * period / 512)); v2 = 512 / period * max(1, round(520 * period / 512))
    n = sample_noise(h, w, 0, (t * v1) % 512, .7, seed=3)
    n2 = sample_noise(h, w, 100, (t * v2) % 512, 1.6, seed=5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lift = (n * 1.0 + n2 * .6) * 46 * power * height
    flame = cv2.remap(m, xx + (n2 - .5) * 10, yy + lift, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    flame = np.clip(flame * (0.55 + n2 * .9) - sub * .25, 0, 1)
    inner = np.clip(flame * 1.6 - .55, 0, 1)
    out = flame[..., None] * color * min(1.3, .9 * power + .3) + inner[..., None] * core * min(.8, .5 * power)
    L[y0:y1, x0:x1] += out

def rim(L, layer, color=RED, k=1.0, off=(-3, -2)):
    """liseré lumineux autour du personnage (contre-jour)"""
    a = layer[..., 3]
    sh = np.roll(np.roll(a, off[1], 0), off[0], 1)
    edge = np.clip(a - sh, 0, 1)
    L += cv2.GaussianBlur(edge, (0, 0), 1.2)[..., None] * color * k

def silhouette_glow(L, layer, color, k=1.0, s=12):
    L += cv2.GaussianBlur(layer[..., 3], (0, 0), s)[..., None] * color * k

def disc(L, c, r, color, k=1.0, soft=0.0):
    if r <= 0: return
    tmp = np.zeros(L.shape[:2], np.float32)
    cv2.circle(tmp, (int(c[0]), int(c[1])), max(1, int(r)), 1.0, -1, cv2.LINE_AA)
    if soft: tmp = cv2.GaussianBlur(tmp, (0, 0), soft)
    L += tmp[..., None] * np.array(color, np.float32) * k

def ring(L, c, r, width, color, k=1.0, sy=1.0):
    if r <= 0 or width <= 0: return
    tmp = np.zeros(L.shape[:2], np.float32)
    cv2.ellipse(tmp, (int(c[0]), int(c[1])), (int(r), max(1, int(r * sy))), 0, 0, 360, 1.0, max(1, int(width)), cv2.LINE_AA)
    tmp = cv2.GaussianBlur(tmp, (0, 0), 1 + width * .15)
    L += tmp[..., None] * np.array(color, np.float32) * k

def poly(L, pts, color, k=1.0, blur=0.0):
    tmp = np.zeros(L.shape[:2], np.float32)
    cv2.fillPoly(tmp, [np.round(np.array(pts)).astype(np.int32)], 1.0, cv2.LINE_AA)
    if blur: tmp = cv2.GaussianBlur(tmp, (0, 0), blur)
    L += tmp[..., None] * np.array(color, np.float32) * k

def line(L, p0, p1, width, color, k=1.0):
    tmp = np.zeros(L.shape[:2], np.float32)
    cv2.line(tmp, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), 1.0, max(1, int(width)), cv2.LINE_AA)
    L += tmp[..., None] * np.array(color, np.float32) * k

def bolt_pts(p0, p1, rng, depth=5, rough=.35):
    pts = [np.array(p0, np.float32), np.array(p1, np.float32)]
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            m = (a + b) / 2
            d = b - a; n = np.array([-d[1], d[0]])
            new += [m + n * rng.uniform(-rough, rough), b]
        pts = new; rough *= .55
    return pts

def lightning(L, p0, p1, seed, color=RED, width=3, k=1.0, branches=2):
    rng = np.random.default_rng(seed)
    pts = bolt_pts(p0, p1, rng)
    tmp = np.zeros(L.shape[:2], np.float32)
    P = np.round(np.array(pts)).astype(np.int32)
    cv2.polylines(tmp, [P], False, 1.0, max(1, int(width)), cv2.LINE_AA)
    for _ in range(branches):
        i = rng.integers(1, len(pts) - 1)
        a = pts[i]; d = (np.array(p1) - np.array(p0)) * rng.uniform(.2, .45)
        ang = rng.uniform(-.9, .9); c, s = math.cos(ang), math.sin(ang)
        b = a + np.array([d[0] * c - d[1] * s, d[0] * s + d[1] * c])
        Q = np.round(np.array(bolt_pts(a, b, rng, 4, .3))).astype(np.int32)
        cv2.polylines(tmp, [Q], False, .8, max(1, int(width * .6)), cv2.LINE_AA)
    L += (tmp[..., None] * WHITE * 1.2 + cv2.GaussianBlur(tmp, (0, 0), width * 2.5)[..., None] * np.array(color) * 3) * k

def starburst(L, c, r, seed, color=RED, spikes=14, k=1.0, inner=.35, rot=0.0):
    rng = np.random.default_rng(seed)
    pts = []
    for i in range(spikes * 2):
        a = rot + i / (spikes * 2) * 2 * math.pi
        rr = r * (rng.uniform(.6, 1.15) if i % 2 == 0 else inner * rng.uniform(.7, 1.1))
        pts.append((c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr))
    poly(L, pts, color, k * 1.2, blur=1)
    pts2 = [(c[0] + (x - c[0]) * .55, c[1] + (y - c[1]) * .55) for x, y in pts]
    poly(L, pts2, WHITE, k * 1.3, blur=1)

def sparks(L, c, t, seed, n=18, speed=520, life=.45, color=RED, width=2, k=1.0, grav=600, spread=math.pi * 2, dir_=0.0):
    rng = np.random.default_rng(seed)
    for _ in range(n):
        a = dir_ + rng.uniform(-spread / 2, spread / 2)
        v = speed * rng.uniform(.4, 1.1)
        lf = life * rng.uniform(.6, 1.2)
        if t > lf or t < 0: continue
        q = t / lf
        x = c[0] + math.cos(a) * v * t; y = c[1] + math.sin(a) * v * t + grav * t * t * .5
        tl = .035
        x2 = c[0] + math.cos(a) * v * max(t - tl, 0); y2 = c[1] + math.sin(a) * v * max(t - tl, 0) + grav * max(t - tl, 0) ** 2 * .5
        line(L, (x2, y2), (x, y), width * (1 - q) + 1, np.array(color) * 1.5 + WHITE * .5 * (1 - q), k * (1 - q * .7))

def slash_arc(L, c, r, a0, a1, thick, color=RED, k=1.0, prog=1.0, fade=1.0):
    """croissant effilé (traînée d'attaque) de l'angle a0 à a1 (degrés)"""
    n = 40
    a_end = lerp(a0, a1, prog)
    outer, inner = [], []
    for i in range(n + 1):
        u = i / n
        a = math.radians(lerp(a0, a_end, u))
        th = thick * math.sin(math.pi * min(1, u * 1.15)) ** .7
        outer.append((c[0] + math.cos(a) * r, c[1] + math.sin(a) * r))
        inner.append((c[0] + math.cos(a) * (r - th), c[1] + math.sin(a) * (r - th)))
    pts = outer + inner[::-1]
    poly(L, pts, color, 1.6 * k * fade, blur=2)
    inner2 = [(c[0] + math.cos(math.radians(lerp(a0, a_end, i / n))) * (r - thick * .18), c[1] + math.sin(math.radians(lerp(a0, a_end, i / n))) * (r - thick * .18)) for i in range(n + 1)]
    poly(L, outer + inner2[::-1], WHITE, 1.4 * k * fade, blur=1)

def kiball(L, c, r, t, k=1.0, color=RED):
    if r <= 1: return
    disc(L, c, r * 2.4, np.array(color) * .35, k, soft=r * .9)
    disc(L, c, r * 1.25, color, 1.3 * k, soft=r * .25)
    disc(L, c, r * .9, PINK, 1.2 * k, soft=r * .15)
    disc(L, c, r * .55, WHITE, 1.6 * k, soft=r * .1)
    for i in range(3):  # arcs d'énergie qui tournent
        tmp = np.zeros(L.shape[:2], np.float32)
        ang = t * 540 + i * 120
        cv2.ellipse(tmp, (int(c[0]), int(c[1])), (int(r * 1.3), int(r * .5)), ang, 0, 160, .7, max(1, int(min(r * .07, 4))), cv2.LINE_AA)
        L += cv2.GaussianBlur(tmp, (0, 0), 1.5)[..., None] * (PINK * .9 + WHITE * .3) * k

def beam(L, x0, y, x1, thick, t, k=1.0):
    """Rayon de l'ultime : bords turbulents, cœur blanc, halo rouge/magenta"""
    H, W = L.shape[:2]
    if x1 <= x0: return
    xa, xb = int(max(x0, 0)), int(min(x1, W))
    if xb <= xa: return
    hh = int(thick * 2.2)
    ya, yb = max(int(y - hh), 0), min(int(y + hh), H)
    h, w = yb - ya, xb - xa
    if h < 2 or w < 2: return
    yy = np.mgrid[ya:yb, xa:xb][0].astype(np.float32) - y
    n = sample_noise(h, w, xa * .6 - t * 900, ya * .6, .6, seed=7)
    n2 = sample_noise(h, w, xa * 1.5 - t * 1600, ya * 1.5, 1.5, seed=9)
    xs = np.arange(xa, xb, dtype=np.float32)[None, :]
    taper = np.clip((xs - x0) / 60, 0, 1) * np.clip((x1 - xs) / 40, 0, 1) ** .5
    th = thick * taper * (0.85 + n * .35)
    d = np.abs(yy) / np.maximum(th, 1)
    core = np.clip(1.6 - d * 2.2, 0, 1)
    body = np.clip(1.2 - d, 0, 1) ** 1.2
    halo = np.exp(-np.maximum(d - .6, 0) ** 2 * 1.8) * (0.6 + n2 * .6)
    out = halo[..., None] * CRIMSON * 1.4 + body[..., None] * (MAGENTA * .6 + RED * .8) + core[..., None] * WHITE * 1.6
    L[ya:yb, xa:xb] += out * k

def speedlines(L, t, seed, n=40, horizontal=True, color=WHITE, k=.6, center=None, inner=0.35):
    H, W = L.shape[:2]
    rng = np.random.default_rng(seed + int(t * 24))  # renouvelées à chaque image (style anime)
    tmp = np.zeros((H, W), np.float32)
    cx, cy = center or (W / 2, H / 2)
    for _ in range(n):
        if horizontal:
            y = rng.uniform(0, H); x = rng.uniform(-W * .2, W); ln = rng.uniform(W * .2, W * .7)
            cv2.line(tmp, (int(x), int(y)), (int(x + ln), int(y)), rng.uniform(.3, 1), int(rng.integers(1, 4)), cv2.LINE_AA)
        else:
            a = rng.uniform(0, 2 * math.pi); R = max(W, H)
            r0 = R * rng.uniform(inner, inner + .25)
            p0 = (cx + math.cos(a) * r0, cy + math.sin(a) * r0); p1 = (cx + math.cos(a) * R, cy + math.sin(a) * R)
            w0 = int(rng.integers(2, 7))
            pts = [p0, (p1[0] - math.sin(a) * w0 * 3, p1[1] + math.cos(a) * w0 * 3), (p1[0] + math.sin(a) * w0 * 3, p1[1] - math.cos(a) * w0 * 3)]
            cv2.fillPoly(tmp, [np.round(np.array(pts)).astype(np.int32)], rng.uniform(.4, 1), cv2.LINE_AA)
    L += tmp[..., None] * np.array(color) * k

def smoke(C, c, r, t, seed, color=(.12, .05, .16), alpha=.8, n=10):
    """fumée sombre (normale, pas additive)"""
    rng = np.random.default_rng(seed)
    H, W = C.shape[:2]
    tmp = np.zeros((H, W), np.float32)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi); d = rng.uniform(0, r) * (0.4 + t)
        rr = r * rng.uniform(.25, .55) * (0.5 + t)
        cv2.circle(tmp, (int(c[0] + math.cos(a) * d), int(c[1] + math.sin(a) * d * .5 - t * r * .4)), max(1, int(rr)), 1.0, -1, cv2.LINE_AA)
    tmp = cv2.GaussianBlur(tmp, (0, 0), r * .15 + 2) * alpha * max(0, 1 - t) ** 1.2
    tmp = np.clip(tmp, 0, 1)
    S = np.dstack([tmp * color[0], tmp * color[1], tmp * color[2], tmp]).astype(np.float32)
    over(C, S)

def dust(C, L, c, t, seed, scale=1.0, n=9):
    """poussière + éclats au sol (atterrissage, glissade)"""
    rng = np.random.default_rng(seed)
    H, W = C.shape[:2]
    tmp = np.zeros((H, W), np.float32)
    for _ in range(n):
        side = rng.choice([-1, 1]); v = rng.uniform(60, 220) * scale
        x = c[0] + side * v * ease_out(t * 1.4) ; y = c[1] - rng.uniform(0, 30) * scale * ease_out(t)
        rr = (8 + rng.uniform(4, 16) * t * 2) * scale
        cv2.circle(tmp, (int(x), int(y)), max(1, int(rr)), 1.0, -1, cv2.LINE_AA)
    tmp = cv2.GaussianBlur(tmp, (0, 0), 3 * scale) * .55 * max(0, 1 - t) ** 1.5
    S = np.dstack([tmp * .32, tmp * .22, tmp * .34, tmp]).astype(np.float32)
    over(C, np.clip(S, 0, 1))

def embers(L, t, seed, n=60, rect=None, color=RED, k=1.0, rise=60, period=None):
    H, W = L.shape[:2]
    x0, y0, x1, y1 = rect or (0, 0, W, H)
    rng = np.random.default_rng(seed)
    for _ in range(n):
        sx = rng.uniform(x0, x1); sy = rng.uniform(y0, y1); ph = rng.uniform(0, 10); sp = rng.uniform(.5, 1.5)
        v = rise * sp * 3; w1, w2 = 1.3 * sp, 7 * sp
        if period:
            v = (y1 - y0) / period * max(1, round(v * period / (y1 - y0)))
            w1 = 2 * math.pi / period * max(1, round(w1 * period / (2 * math.pi)))
            w2 = 2 * math.pi / period * max(1, round(w2 * period / (2 * math.pi)))
        y = y1 - ((y1 - sy) + t * v) % (y1 - y0)
        x = sx + math.sin(t * w1 + ph) * 14
        fl = .5 + .5 * math.sin(t * w2 + ph)
        disc(L, (x, y), rng.uniform(1, 2.6), np.array(color) * (0.8 + fl), k)


# ---------------------------------------------------------------- texte
def text_layer(W, H, txt, size, xy, color=(1, 1, 1), anchor='mm', stroke=0, stroke_col=(0, 0, 0), skew=-0.0):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, size)
    d.text(xy, txt, font=f, fill=tuple(int(c * 255) for c in color) + (255,), anchor=anchor,
           stroke_width=stroke, stroke_fill=tuple(int(c * 255) for c in stroke_col) + (255,))
    return from_pil(im)


# ---------------------------------------------------------------- écran
def grade(img, vignette=.55, contrast=1.08, lift=(.02, .0, .03)):
    """étalonnage final : contraste, teinte violette dans les ombres, vignette"""
    H, W = img.shape[:2]
    out = (img - .5) * contrast + .5
    out += np.array(lift, np.float32) * (1 - out)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * .6)) ** 2 + ((yy - H / 2) / (H * .6)) ** 2)
    out *= (1 - vignette * np.clip(r - .45, 0, 1) ** 1.5)[..., None]
    return np.clip(out, 0, 1)

def chroma(img, px):
    if px < 1: return img
    out = img.copy()
    out[..., 0] = np.roll(img[..., 0], int(px), 1)
    out[..., 2] = np.roll(img[..., 2], -int(px), 1)
    return out

def zoom(img, z, cx, cy, sx=0, sy=0):
    """caméra : zoom autour de (cx,cy) + tremblement"""
    H, W = img.shape[:2]
    M = np.array([[z, 0, W / 2 - cx * z + sx], [0, z, H / 2 - cy * z + sy]], np.float32)
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
