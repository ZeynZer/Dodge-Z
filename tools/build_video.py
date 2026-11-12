"""Cinématique de présentation SHADOW FIGHTER (portrait 720x1280, 30 i/s) → MP4 + WebM + poster.

usage : python3 tools/build_video.py [--preview t1,t2,...]
"""
import math, os, subprocess, sys, json
from multiprocessing import Pool
import numpy as np, cv2
from PIL import Image
import fx, clips
from fx import seg, smooth, ease_out, ease_in, lerp, RED, CRIMSON, MAGENTA, VIOLET, WHITE, PINK

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'shadow', 'video')
W, H, FPS = 720, 1280, 30
GROUND = 1090
SCALE = 2.2


# ------------------------------------------------------------------ décor
def build_bg():
    r = np.random.default_rng(4)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top, mid, hor = np.array([.03, .015, .06]), np.array([.1, .03, .1]), np.array([.24, .05, .14])
    sky = np.where(yy < .45, lerp(top, mid, yy / .45), lerp(mid, hor, np.clip((yy - .45) / .35, 0, 1))) * np.ones((1, W, 1))
    sky = sky.astype(np.float32)
    # lune de sang
    L = fx.light(W, H)
    mc, mr = (480, 360), 165
    fx.disc(L, mc, mr * 3.2, CRIMSON * .25, 1, soft=90)
    moon = np.zeros((H, W), np.float32); cv2.circle(moon, mc, mr, 1, -1, cv2.LINE_AA)
    tex = fx.sample_noise(H, W, 0, 0, 1.4, seed=21)
    mcol = (np.array([.85, .12, .14]) * (.75 + .5 * tex[..., None]))
    sky = sky * (1 - moon[..., None]) + mcol * moon[..., None]
    sky += 1 - np.exp(-fx.bloom(L))
    # nuages sombres qui barrent la lune
    n = fx.sample_noise(H, W, 50, 0, .5, seed=22)
    band = np.exp(-((yy[..., 0] - .3) / .06) ** 2) + .7 * np.exp(-((yy[..., 0] - .42) / .04) ** 2)
    cl = np.clip((n - .45) * 3, 0, 1) * band
    sky = sky * (1 - cl[..., None] * .8) + np.array([.09, .03, .1]) * cl[..., None] * .8
    C = np.dstack([sky, np.ones((H, W, 1), np.float32)]).astype(np.float32)
    # silhouettes : ville lointaine, château, ville proche, torii
    def layer(col, y0, n, wmin, wmax, hmin, hmax, spire=.4, win=0.0, seed=0):
        rg = np.random.default_rng(seed)
        m = np.zeros((H, W), np.float32); Lw = fx.light(W, H)
        x = -20
        while x < W + 20:
            w = rg.uniform(wmin, wmax); h = rg.uniform(hmin, hmax)
            cv2.rectangle(m, (int(x), int(y0 - h)), (int(x + w), H), 1, -1)
            if rg.random() < spire:
                cv2.fillPoly(m, [np.array([(int(x), int(y0 - h)), (int(x + w / 2), int(y0 - h - w * rg.uniform(.8, 2.2))), (int(x + w), int(y0 - h))])], 1, cv2.LINE_AA)
            if win:
                for _ in range(int(h * w / 900 * win)):
                    fx.disc(Lw, (x + rg.uniform(3, w - 3), y0 - rg.uniform(5, h)), 1.3, RED, rg.uniform(.4, 1.2))
            x += w + rg.uniform(-5, 12)
        S = np.dstack([m * col[0], m * col[1], m * col[2], m]).astype(np.float32)
        fx.over(C, S); fx.add(C, fx.bloom(Lw, (2, 6, 14)))
    layer((.16, .06, .16), 760, 0, 30, 70, 40, 160, .5, .4, 1)
    # château central
    m = np.zeros((H, W), np.float32)
    for (cx, w, h) in ((360, 70, 470), (300, 45, 360), (425, 45, 380), (250, 30, 280), (480, 32, 300), (360, 160, 250)):
        cv2.rectangle(m, (cx - w // 2, 800 - h), (cx + w // 2, H), 1, -1)
        cv2.fillPoly(m, [np.array([(cx - w // 2, 800 - h), (cx, 800 - h - int(w * 1.6)), (cx + w // 2, 800 - h)])], 1, cv2.LINE_AA)
    S = np.dstack([m * .1, m * .035, m * .1, m]).astype(np.float32); fx.over(C, S)
    Lw = fx.light(W, H)
    for (x, y) in ((360, 420), (300, 520), (425, 500), (360, 600), (338, 640), (382, 640)):
        fx.disc(Lw, (x, y), 4, RED, 1.2); fx.disc(Lw, (x, y), 14, VIOLET * .5, .6, soft=6)
    fx.add(C, fx.bloom(Lw))
    layer((.07, .025, .08), 900, 0, 50, 110, 60, 260, .35, .7, 2)
    # torii au premier plan gauche
    m = np.zeros((H, W), np.float32)
    for x in (40, 230): cv2.rectangle(m, (x, 760), (x + 24, 1000), 1, -1)
    cv2.fillPoly(m, [np.array([(-10, 745), (310, 745), (300, 765), (0, 765)])], 1, cv2.LINE_AA)
    cv2.fillPoly(m, [np.array([(-30, 715), (330, 715), (340, 700), (320, 735), (-20, 735), (-40, 700)])], 1, cv2.LINE_AA)
    cv2.rectangle(m, (10, 790), (280, 805), 1, -1)
    S = np.dstack([m * .03, m * .01, m * .035, m]).astype(np.float32); fx.over(C, S)
    # sol mouillé : reflet flou et assombri du décor
    hz = 1000
    refl = C[hz - (H - hz):hz][::-1].copy()
    refl = cv2.GaussianBlur(refl, (0, 0), 3)
    refl = cv2.resize(cv2.GaussianBlur(cv2.resize(refl, (W, H - hz)), (1, 0), sigmaX=1, sigmaY=6), (W, H - hz))
    k = np.linspace(.55, .15, H - hz, dtype=np.float32)[:, None, None]
    floor = refl * k + np.array([.03, .015, .04, 1], np.float32) * (1 - k)
    floor[..., 3] = 1
    C[hz:] = floor
    # reflet de la lune (traînée verticale)
    Lr = fx.light(W, H)
    fx.poly(Lr, [(470, hz), (490, hz), (500, H), (460, H)], CRIMSON, .35, blur=10)
    fx.line(Lr, (0, hz), (W, hz), 2, CRIMSON, .25)
    fx.add(C, fx.bloom(Lr))
    return C

BG = None
def stage(t, dark=0.0):
    """décor animé : brouillard qui dérive + braises"""
    C = BG.copy()
    fog = fx.sample_noise(220, W, t * 30, 0, .8, seed=31)
    f = np.clip((fog - .35) * 1.6, 0, 1) * .35
    f *= np.sin(np.linspace(0, math.pi, 220))[:, None]
    y0 = 880
    C[y0:y0 + 220, :, :3] = C[y0:y0 + 220, :, :3] * (1 - f[..., None]) + np.array([.28, .12, .3]) * f[..., None]
    if dark: C[..., :3] *= (1 - dark)
    return C


# ------------------------------------------------------------------ éléments graphiques
LOGO = None
def build_logo():
    ref = Image.open(os.path.join(ROOT, 'assets', 'shadow', 'src', 'reference.webp')).convert('RGB')
    im = np.asarray(ref.crop((6, 8, 292, 168)), np.float32) / 255
    mx = im.max(2)
    a = np.clip((mx - .3) / .25, 0, 1)
    a = cv2.GaussianBlur(a, (0, 0), .6)
    rgb = np.clip(im * 1.15, 0, 1)
    P = np.dstack([rgb * a[..., None], a]).astype(np.float32)
    P = cv2.resize(P, None, fx=2.3, fy=2.3, interpolation=cv2.INTER_CUBIC)
    return np.clip(P, 0, 1)

def paste(C, S, x, y, scale=1.0, alpha=1.0):
    """colle une image prémultipliée centrée en (x,y)"""
    if scale != 1.0:
        S = cv2.resize(S, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
    h, w = S.shape[:2]
    x0, y0 = int(x - w / 2), int(y - h / 2)
    xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + w, C.shape[1]), min(y0 + h, C.shape[0])
    if xb <= xa or yb <= ya: return
    fx.over(C[ya:yb, xa:xb], S[ya - y0:yb - y0, xa - x0:xb - x0], alpha)

def label(C, txt, t, sub=None, y=1190):
    """étiquette de compétence (panneau incliné en bas à gauche)"""
    k = ease_out(seg(t, 0, .25))
    if k <= 0: return
    x = lerp(-380, 0, k)
    L = fx.canvas(W, H)
    pts = np.array([(x - 10, y - 46), (x + 440, y - 46), (x + 410, y + 20), (x - 10, y + 20)], np.int32)
    m = np.zeros((H, W), np.float32); cv2.fillPoly(m, [pts], 1, cv2.LINE_AA)
    fx.over(L, np.dstack([m * .02, m * .0, m * .03, m * .78]).astype(np.float32))
    m2 = np.zeros((H, W), np.float32); cv2.fillPoly(m2, [np.array([(x - 10, y + 14), (x + 412, y + 14), (x + 409, y + 20), (x - 10, y + 20)], np.int32)], 1, cv2.LINE_AA)
    fx.over(L, np.dstack([m2 * 1, m2 * .12, m2 * .22, m2]).astype(np.float32))
    fx.over(L, fx.text_layer(W, H, txt, 46, (x + 30, y - 12), anchor='lm'))
    if sub: fx.over(L, fx.text_layer(W, H, sub, 20, (x + 32, y - 60), color=(1, .45, .55), anchor='lm'))
    fx.over(C, L)

def caption(C, txt, t, y, size=34, color=(1, 1, 1), dur=99, fade=.4, red=None):
    k = smooth(seg(t, 0, fade)) * (1 - smooth(seg(t, dur - fade, dur)))
    if k <= 0: return
    T = fx.text_layer(W, H, txt, size, (W / 2, y + 10 * (1 - k)), color=color, stroke=3, stroke_col=(0, 0, 0))
    fx.over(C, T, k)


# ------------------------------------------------------------------ plans
A = None; HERO = None

def hero_shot(F, t, D):
    """plan 1 : contre-plongée sur le héros, des bottes aux yeux"""
    F.C = stage(t, dark=.55)
    k = smooth(seg(t, 0, 3.2))
    s = HERO
    y = lerp(H + s.h * .35, H * .97 + s.h * .02, k)  # remonte : on découvre le corps jusqu'au visage
    y = lerp(H + 120, s.h * .98, k)
    reveal = smooth(seg(t, .2, 2.2))
    L = fx.blit(F.C, s, W * .5, y, wave_t=t * 3, wave_amp=.6, tint=(.02, 0, .03), tint_k=1 - reveal * .9, ret_layer=True)
    fx.aura(F.Lb, L, t, .5 + .5 * seg(t, 2.6, 3.4), height=1.2)
    F.char(L)
    fx.rim(F.Lf, L, RED, 1.0, off=(-4, -3))
    e = fx.spr_point(s, *s.eye, W * .5, y)
    ek = smooth(seg(t, 2.7, 2.9))
    if ek > 0:
        fx.disc(F.Lf, e, 10, PINK, 1.6 * ek, soft=2)
        fx.disc(F.Lf, e, 50, RED, 1.0 * ek, soft=18)
        st = 1.0 + 2 * math.sin(math.pi * seg(t, 2.7, 3.6))
        fx.poly(F.Lf, [(e[0] - 260 * st, e[1]), (e[0], e[1] - 3), (e[0] + 260 * st, e[1]), (e[0], e[1] + 3)], RED + WHITE * .4, 1.4 * ek, blur=1.5)
    for i in range(3):
        fx.smoke(F.C, (W * (.2 + .3 * i), H * .9), 260, (t / D + i * .2) % 1, 90 + i, color=(.05, .01, .07), alpha=.7)
    fx.embers(F.Lf, t, 41, n=60, rise=90)
    F.after = lambda C: (caption(C, 'BORN FROM THE SHADOWS.', t - .8, 1080, 38, dur=3.4),
                         caption(C, 'FIGHT FOR A NEW DAWN.', t - 1.8, 1130, 30, color=(1, .3, .4), dur=2.4))

def logo_shot(F, t, D):
    F.C = stage(t, dark=.65)
    k = ease_out(seg(t, 0, .22), 4)
    sc = lerp(2.2, 1.0, k)
    L = fx.canvas(W, H)
    imp = t - .22
    fx.speedlines(F.Lb, t, 5, n=50, horizontal=False, color=RED, k=.5 * (1 - seg(t, .3, 1.5)), inner=.25)
    paste(L, LOGO, W / 2, 560, sc, alpha=k)
    F.char(L)
    if imp >= 0:
        q = seg(imp, 0, .6)
        fx.ring(F.Lf, (W / 2, 560), 80 + 600 * ease_out(q), 14 * (1 - q) + 1, RED, 1.4 * (1 - q))
        fx.slash_arc(F.Lf, (W / 2 + 40, 900), 760, 200, 300, 60, RED, 1 - seg(imp, .2, .7), prog=ease_out(seg(imp, 0, .2)))
        fx.sparks(F.Lf, (W / 2, 560), imp, 7, n=40, speed=1400, life=.6, width=3, grav=900)
        F.flash = max(0, 1 - imp / .12) * .9
        F.shake = 26 * max(0, 1 - imp / .5)
    fx.embers(F.Lf, t, 42, n=50, rise=90)
    F.after = lambda C: caption(C, 'LE PACK D\'ANIMATION', t - .9, 760, 24, color=(.75, .7, .8), dur=D - .8)

def actor_shot(fn, label_txt=None, sub=None, x=W * .45, face=1, zoom=1.0, **kw):
    def shot(F, t, D):
        F.C = stage(t)
        A.x, A.y, A.face = x, GROUND, face
        fn(F, t, A, **kw)
        F.zoom = zoom; F.cx, F.cy = x, GROUND - A.U * .6
        if label_txt: F.after = lambda C: label(C, label_txt, t, sub)
    return shot

def run_dash_jump(F, t, D):
    F.C = stage(t)
    A.face = 1; A.y = GROUND
    if t < 1.0:
        A.x = lerp(-A.U * .6, W * .15, t / 1.0)
        clips.run(F, t, A); lab = ('COURSE', 'DÉPLACEMENT')
    elif t < 1.45:
        A.x = W * .15 + A.U * .6
        clips.dash(F, t - 1.0, A); lab = ('DASH', 'ÉLAN ÉCLAIR')
        if t - 1.0 < .25: F.Lf += 0; fx.speedlines(F.Lb, t, 9, n=30, color=VIOLET + WHITE * .3, k=.6)
    else:
        A.x = W * .15 + A.U * 1.2
        clips.jump(F, min(t - 1.45, .9), A); lab = ('SAUT', 'ESQUIVE AÉRIENNE')
    F.after = lambda C: label(C, lab[0], .3, lab[1])

def combo_shot(F, t, D):
    F.C = stage(t)
    A.x, A.y, A.face = W * .3, GROUND, 1
    if t < 1.35:
        clips.combo(F, t, A)
        for th, z in ((.08, .06), (.38, .08), (.86, .16)):
            q = t - th
            if 0 <= q < .35:
                F.zoom = 1 + z * (1 - q / .35); F.shake = 30 * z / .16 * (1 - q / .35)
            if 0 <= q < .05: F.flash = .5 if z < .1 else .85; F.flash_col = (1, .85, .9)
        lab = ('ATTAQUE RAPIDE', 'COMBO') if t < .62 else ('ATTAQUE LOURDE', 'COMBO FINAL')
    else:
        clips.idle(F, t - 1.35, A, power=.5); lab = ('ATTAQUE LOURDE', 'COMBO FINAL')
    F.cx, F.cy = A.x + A.U * .3, GROUND - A.U * .55
    F.after = lambda C: label(C, lab[0], .3, lab[1])

def defense_shot(F, t, D):
    F.C = stage(t)
    A.x, A.y, A.face = W * .45, GROUND, 1
    if t < .7:
        clips.guard(F, t, A); lab = ('DÉFENSE', 'BARRIÈRE')
        if .12 <= t < .3: F.shake = 14 * (1 - (t - .12) / .18)
    else:
        clips.hurt(F, t - .7, A); lab = ('HURT', 'RÉACTION')
        if t - .7 < .25: F.shake = 18 * (1 - (t - .7) / .25)
    F.after = lambda C: label(C, lab[0], .3, lab[1])

def ki_shot(F, t, D):
    F.C = stage(t)
    A.x, A.y, A.face = W * .2, GROUND, 1
    clips.kiblast(F, min(t, 1.0), A)
    hit = .78
    if t > hit:  # le ki-blast explose au fond à droite
        B = clips.Actor.__new__(clips.Actor); B.U = A.U; B.x, B.y, B.face = W * .9, GROUND - A.U * .22, 1
        clips.kiboom(F, t - hit, B)
        if t - hit < .3: F.shake = 20 * (1 - (t - hit) / .3)
    F.after = lambda C: label(C, 'KI BLAST', .3, 'PROJECTILE')

def transform_shot(F, t, D):
    F.C = stage(t, dark=.25 * smooth(seg(t, 0, .5)))
    A.x, A.y, A.face = W * .5, GROUND, 1
    if t < 1.8: clips.transform(F, t, A)
    else: clips.idle_power(F, t - 1.8, A)
    b = t - .55
    F.cx, F.cy = A.x, GROUND - A.U * .6
    F.zoom = 1 + .18 * smooth(seg(t, 0, .55)) - .1 * smooth(seg(t, .55, 1.2))
    if 0 <= b < .6: F.shake = 26 * (1 - b / .6)
    F.after = lambda C: label(C, 'TRANSFORMATION', .3, 'ÉVEIL ÉCARLATE')

def cutin_shot(F, t, D):
    """bandeau « cut-in » façon jeux de combat : regard du héros + nom de l'ultime"""
    F.C = stage(t, dark=.85)
    fx.speedlines(F.Lb, t, 13, n=70, horizontal=False, color=RED, k=.7, inner=.15)
    k = ease_out(seg(t, 0, .2), 3); out = ease_in(seg(t, D - .2, D), 2)
    band_h = 300
    yc = 560
    s = HERO
    # bande inclinée contenant les yeux du héros
    L = fx.canvas(W, H)
    scale = 2.4
    sub_h = int(band_h / scale)
    ey = int(s.eye[1])
    crop = s.img[max(0, ey - sub_h // 2): ey + sub_h // 2]
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    off = lerp(-W, 0, k) + lerp(0, W * 1.2, out) + t * 30
    ex = s.eye[0] * scale
    ch, cw = crop.shape[:2]
    x0 = int(W / 2 - ex + off)
    bg = np.zeros((H, W), np.float32)
    pts = np.array([(0, yc - band_h / 2 + 40), (W, yc - band_h / 2 - 40), (W, yc + band_h / 2 - 40), (0, yc + band_h / 2 + 40)], np.int32)
    cv2.fillPoly(bg, [pts], 1, cv2.LINE_AA)
    redbg = np.dstack([bg * .55, bg * .02, bg * .08, bg]).astype(np.float32)
    fx.over(L, redbg, min(1, k * 1.5) * (1 - out))
    xa, xb = max(x0, 0), min(x0 + cw, W)
    ya = yc - ch // 2
    if xb > xa:
        seg_ = crop[:, xa - x0:xb - x0] * bg[ya:ya + ch, xa:xb, None]
        fx.over(L[ya:ya + ch, xa:xb], seg_, 1 - out)
    F.char(L)
    e = (W / 2 + off, yc)
    fx.poly(F.Lf, [(e[0] - 400, e[1]), (e[0], e[1] - 4), (e[0] + 400, e[1]), (e[0], e[1] + 4)], RED + WHITE * .4, 1.2 * k * (1 - out), blur=1.5)
    F.after = lambda C: (caption(C, 'ULTIME', t - .25, 780, 26, color=(1, .4, .5), dur=D - .25, fade=.15),
                         caption(C, 'ÉCLIPSE ÉCARLATE', t - .3, 840, 56, dur=D - .3, fade=.15))

def ult_shot(F, t, D):
    F.C = stage(t, dark=.35)
    A.x, A.y, A.face = W * .22, GROUND, 1
    end = clips.ultimate(F, min(t, 3.0), A, D=3.0, beam_len=4.0)
    fire = 1.25
    F.cx, F.cy = W * .4, GROUND - A.U * .7
    F.zoom = 1 + .12 * smooth(seg(t, 0, fire)) - .12 * smooth(seg(t, fire, fire + .3))
    if t < fire: F.shake = 6 * seg(t, .3, fire)
    else: F.shake = 22 * (1 - seg(t, fire, 3.0) * .7)
    if t > fire:
        fx.speedlines(F.Lb, t, 17, n=40, color=RED, k=.4)
    # explosion finale (blanc → rouge)
    ex = t - 2.6
    if ex > 0:
        q = seg(ex, 0, .7)
        fx.disc(F.Lf, (W * .75, GROUND - A.U * .5), 120 + 900 * ease_out(q), RED, 1.6, soft=80)
        fx.disc(F.Lf, (W * .75, GROUND - A.U * .5), 60 + 600 * ease_out(q), WHITE, 1.8, soft=60)
        F.flash = smooth(seg(ex, .2, .6)); F.flash_col = (1, .95, .97)
    F.after = lambda C: label(C, 'ÉCLIPSE ÉCARLATE', .3, 'ULTIME')

def final_shot(F, t, D):
    """pose iconique : héros pleine taille devant la lune, citation"""
    F.C = stage(t, dark=.2)
    wf = 1 - smooth(seg(t, 0, .5))  # sortie du blanc
    s = HERO2
    x, y = W * .46, H * .985
    L = fx.blit(F.C, s, x, y, wave_t=t * 2.5, wave_amp=.8, sy=1 + .006 * math.sin(t * 2), ret_layer=True)
    fx.aura(F.Lb, L, t, .6 + .2 * math.sin(t * 3), height=1.2)
    F.char(L)
    fx.rim(F.Lf, L, RED, 1.0, off=(-4, -3))
    e = fx.spr_point(s, *s.eye, x, y)
    pulse = .7 + .3 * math.sin(t * 4)
    fx.disc(F.Lf, e, 7, PINK, 1.4 * pulse, soft=2); fx.disc(F.Lf, e, 34, RED, .8 * pulse, soft=12)
    fx.embers(F.Lf, t, 43, n=70, rise=80)
    F.flash = wf; F.flash_col = (1, .95, .97)
    fade = smooth(seg(t, D - .7, D))
    def after(C):
        paste(C, LOGO, W / 2, 112, .5, alpha=smooth(seg(t, .6, 1.2)))
        caption(C, '« I DON\'T FIGHT FOR GLORY...', t - 1.4, 1110, 30, dur=99)
        caption(C, 'I FIGHT TO SURVIVE. »', t - 2.2, 1155, 34, color=(1, .25, .35), dur=99)
        if fade > 0: C[..., :3] *= (1 - fade)
    F.after = after

TIMELINE = [  # (durée, plan)
    (4.0, hero_shot),
    (2.3, logo_shot),
    (2.4, actor_shot(clips.intro, 'ENTRÉE', 'APPARITION')),
    (1.5, actor_shot(lambda F, t, A: clips.idle(F, t, A, power=.35), 'IDLE', 'AU REPOS', zoom=1.15)),
    (2.4, run_dash_jump),
    (1.9, combo_shot),
    (1.2, defense_shot),
    (1.6, ki_shot),
    (2.6, transform_shot),
    (1.3, cutin_shot),
    (3.3, ult_shot),
    (5.0, final_shot),
]
TOTAL = sum(d for d, _ in TIMELINE)


def init():
    global A, HERO, HERO2, BG, LOGO
    A = clips.Actor(SCALE)
    HERO = fx.Sprite(os.path.join(clips.SRC, 'hero.png'), 2.7)
    HERO2 = fx.Sprite(os.path.join(clips.SRC, 'hero.png'), 1.78)
    BG = build_bg(); LOGO = build_logo()

def frame(i):
    if A is None: init()
    t = i / FPS
    for d, fn in TIMELINE:
        if t < d: break
        t -= d
    F = clips.Frame(W, H)
    F.after = None; F.cx, F.cy = W / 2, H / 2
    fn(F, t, d)
    C = F.done()
    img = C[..., :3]
    if F.shake: F.zoom = max(F.zoom, 1 + F.shake * 2.2 / W)  # le tremblement ne doit jamais montrer le bord
    if F.zoom != 1 or F.shake:
        r = np.random.default_rng(i)
        img = fx.zoom(img, F.zoom, F.cx, F.cy, r.uniform(-1, 1) * F.shake, r.uniform(-1, 1) * F.shake)
    img = fx.chroma(img, F.shake * .25)
    img = fx.grade(img)
    if F.after:
        C2 = np.dstack([img, np.ones((H, W, 1), np.float32)])
        F.after(C2); img = C2[..., :3]
    return (np.clip(img, 0, 1) * 255 + .5).astype(np.uint8)

def main():
    os.makedirs(OUT, exist_ok=True)
    if '--preview' in sys.argv:
        ts = [float(x) for x in sys.argv[sys.argv.index('--preview') + 1].split(',')]
        with Pool(4) as p: fr = p.map(frame, [int(t * FPS) for t in ts])
        sh = [Image.fromarray(f).resize((W // 2, H // 2)) for f in fr]
        o = Image.new('RGB', (W // 2 * len(sh), H // 2))
        for k, s in enumerate(sh): o.paste(s, (k * W // 2, 0))
        o.save(sys.argv[-1]); return
    n = int(TOTAL * FPS)
    raw = os.path.join(OUT, '_frames.rgb')
    with open(raw, 'wb') as fh, Pool(4) as p:
        for k, f in enumerate(p.imap(frame, range(n), chunksize=4)):
            fh.write(f.tobytes())
            if k % 60 == 0: print(f'{k}/{n}', flush=True)
    audio = os.path.join(OUT, '_sfx.wav')
    import sfx; sfx.render(audio, TOTAL)
    base = os.path.join(OUT, 'shadow_fighter_cinematic')
    src = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', raw, '-i', audio]
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', base + '.mp4'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *src, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1',
                    '-c:a', 'libopus', '-b:a', '96k', '-shortest', base + '.webm'], check=True)
    Image.fromarray(frame(int((TOTAL - 1.5) * FPS))).save(base + '_poster.jpg', quality=85)
    os.remove(raw); os.remove(audio)
    json.dump({'duration': TOTAL, 'fps': FPS, 'size': [W, H],
               'chapters': [[round(sum(d for d, _ in TIMELINE[:k]), 2), fn.__name__] for k, (d, fn) in enumerate(TIMELINE)]},
              open(base + '.json', 'w'), indent=1)
    for e in ('.mp4', '.webm'): print(base + e, os.path.getsize(base + e) // 1024, 'Ko')

if __name__ == '__main__':
    main()
