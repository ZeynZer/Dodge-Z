"""Bande-son procédurale de la cinématique (aucun sample externe : tout est synthétisé).

Les repères sont calés sur la TIMELINE de build_video.py.
"""
import math, wave
import numpy as np

SR = 44100

def _t(d): return np.arange(int(d * SR)) / SR

def env(n, a=.005, r=.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))

def lowpass(x, cut):
    # passe-bas 1 pôle (suffisant pour adoucir le bruit)
    k = math.exp(-2 * math.pi * cut / SR)
    y = np.empty_like(x); acc = 0.0
    # vectorisation par filtre IIR via lfilter maison : boucle numpy par blocs
    from itertools import accumulate
    y = np.fromiter(accumulate(x * (1 - k), lambda p, v: p * k + v), float, len(x))
    return y

def noise(d, seed=0): return np.random.default_rng(seed).uniform(-1, 1, int(d * SR))

def boom(d=1.6, f0=70, f1=28, seed=0, nz=.5):
    t = _t(d); f = f1 + (f0 - f1) * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, d * .35)
    s += lowpass(noise(d, seed), 900) * env(len(t), .001, .25) * nz * 3
    return s

def hit(seed=0, big=1.0):
    d = .45 * big
    t = _t(d)
    s = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 30) + 55) / SR) * env(len(t), .001, .12 * big)
    s += noise(d, seed) * env(len(t), .0005, .05) * .9
    s += lowpass(noise(d, seed + 1), 2500) * env(len(t), .001, .12 * big) * 1.5
    return s * .9

def whoosh(d=.35, seed=0, up=True):
    n = noise(d, seed); t = _t(d)
    sweep = np.sin(np.pi * t / d) ** 2
    hp = n - lowpass(n, 400 if up else 200)
    return lowpass(hp, 3000) * sweep * 1.6

def shing(d=.9, f=2400):
    t = _t(d)
    s = sum(np.sin(2 * np.pi * f * m * t) / m for m in (1, 1.5, 2.01, 2.97))
    return s * env(len(t), .002, .25) * .25 + noise(d, 9) * env(len(t), .001, .03) * .3

def riser(d=1.2, f0=60, f1=420, seed=0):
    t = _t(d); f = f0 * (f1 / f0) ** (t / d)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    s = lowpass(saw, 1200) * .35 + lowpass(noise(d, seed), 1500) * (t / d) * .8
    return s * (t / d) ** 1.5

def beam(d=1.4, seed=0):
    t = _t(d)
    saw = 2 * ((t * 55) % 1) - 1 + 2 * ((t * 82.5) % 1) - 1
    s = lowpass(saw, 600) * .5 + lowpass(noise(d, seed), 4000) * .9
    s *= (1 + .3 * np.sin(2 * np.pi * 18 * t))
    return s * np.minimum(1, t / .05) * np.minimum(1, (d - t) / .3)

def crackle(d=.4, seed=0):
    r = np.random.default_rng(seed); s = np.zeros(int(d * SR))
    for _ in range(int(d * 40)):
        i = r.integers(0, len(s) - 400); s[i:i + 400] += noise(400 / SR, int(r.integers(1e6))) * env(400, .0002, .002) * r.uniform(.3, 1)
    return s

def drone(d, seed=0):
    t = _t(d)
    s = np.sin(2 * np.pi * 41.2 * t) * .5 + np.sin(2 * np.pi * 61.8 * t + np.sin(t * .7)) * .3
    s += lowpass(noise(d, seed), 160) * 2.5
    return s * .35

def kick():
    d = .35; t = _t(d)
    return np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-t * 35)) / SR) * env(len(t), .001, .12)

def reverb(x, d=1.6, mix=.25, seed=3):
    ir = noise(d, seed) * np.exp(-np.arange(int(d * SR)) / SR * 4)
    ir = lowpass(ir, 3000)
    n = len(x) + len(ir)
    N = 1 << (n - 1).bit_length()
    w = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]
    w /= (np.abs(w).max() + 1e-9) / (np.abs(x).max() + 1e-9)
    return x * (1 - mix) + w * mix


def render(path, total):
    out = np.zeros(int((total + .5) * SR))
    def at(t, s, g=1.0, pan=0.0):
        i = int(t * SR); j = min(len(out), i + len(s))
        if j > i: out[i:j] += s[:j - i] * g
    # repères (secondes absolues) : hero 0 · logo 4.0 · intro 6.3 · idle 8.7 · course 10.2 · combo 12.6
    # défense 14.5 · ki 15.7 · transfo 17.3 · cut-in 19.9 · ultime 21.2 · final 24.5
    at(0, drone(total, 1) * np.minimum(1, _t(total) / 2.5) * np.minimum(1, (total - _t(total)) / 1.5), .8)
    at(.3, whoosh(2.5, 2), .35)
    at(2.7, shing(1.2, 1900), .7)
    at(3.4, riser(.82, 50, 300, 3), .7)
    at(4.22, boom(2.2, 80, 26, 4), 1.2); at(4.22, shing(.8, 3100), .4)
    at(6.3, whoosh(1.0, 5), .6); at(7.15, shing(.6, 2200), .5); at(7.55, boom(1.2, 90, 35, 6, .8), .8)
    for k in range(int((24.5 - 8.7) * 2)):  # pulsation (120 bpm)
        at(8.7 + k * .5, kick(), .55)
    for k in range(4): at(10.2 + .12 + k * .25, hit(10 + k, .3), .25)
    at(11.2, whoosh(.35, 14), .9)
    at(11.65 + .1, whoosh(.3, 15), .6); at(11.65 + .78, boom(.5, 90, 40, 16, 1.0), .6)
    at(12.6 + .05, whoosh(.15, 17), .5); at(12.6 + .08, hit(18), .9)
    at(12.6 + .35, whoosh(.15, 19), .5); at(12.6 + .38, hit(20, 1.1), .95)
    at(12.6 + .62, whoosh(.3, 21), .7); at(12.6 + .86, hit(22, 2.0), 1.1); at(12.6 + .86, boom(.8, 90, 30, 23), .8)
    at(14.5 + .12, shing(.5, 1300), .8); at(14.5 + .12, hit(24, .6), .6)
    at(14.5 + .7, hit(25, 1.2), 1.0)
    at(15.7, riser(.5, 200, 900, 26), .5); at(15.7 + .5, whoosh(.3, 27), .8); at(15.7 + .5, shing(.3, 1600), .3)
    at(15.7 + .78, boom(1.0, 100, 35, 28), 1.0); at(15.7 + .78, hit(29, 1.5), .7)
    at(17.3, riser(.55, 40, 260, 30), 1.0); at(17.3, crackle(.55, 31), .6)
    at(17.85, boom(2.4, 75, 24, 32), 1.3); at(17.85, whoosh(1.6, 33), .8); at(18.0, crackle(1.2, 34), .5)
    at(19.9, shing(1.0, 2600), .8); at(19.9, boom(.9, 70, 30, 35, .3), .8)
    at(21.2, riser(1.25, 45, 500, 36), 1.0); at(21.2, crackle(1.25, 37), .6)
    at(22.45, boom(1.5, 70, 25, 38), 1.3); at(22.45, beam(1.4, 39), .9)
    at(23.8, boom(3.0, 60, 20, 40, 1.0), 1.5); at(23.8, whoosh(1.5, 41), 1.0)
    at(24.5, boom(3.5, 45, 22, 42, .2), .7); at(26.0, shing(2.0, 1200), .25)
    out = reverb(out, 1.8, .22)
    out = np.tanh(out * 1.1)  # compression douce
    out *= .89 / (np.abs(out).max() + 1e-9)
    st = np.stack([out, np.roll(out, 220) * .96 + out * .04], 1)  # léger élargissement stéréo
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
