"""Étape 1 du pipeline : détoure chaque pose de la planche de référence (IA isnet-anime)."""
import sys, os
from PIL import Image, ImageOps
import numpy as np, cv2
from rembg import new_session, remove
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
ref = Image.open(src).convert('RGB')
# (nom, boîte x0,y0,x1,y1) dans la planche 1672x941
BOX = {
 'idle':(10,700,135,878),'walk':(135,700,265,878),'run':(262,725,430,866),'jump':(430,700,600,842),
 'attack':(595,705,745,867),'guard':(740,720,870,867),'hurt':(885,710,1010,878),
 'hero':(110,45,520,625),
}
s = new_session('isnet-anime')
only = sys.argv[3:]  # optionnel : ne régénérer que certaines poses
for k,b in BOX.items():
    if only and k not in only: continue
    im = ref.crop(b)
    P = 60
    pad = Image.new('RGB',(im.width+2*P,im.height+2*P),im.getpixel((2,2)))
    pad.paste(im,(P,P))  # marge : le modèle détoure mieux un sujet qui ne touche pas le bord
    # l'art est sombre sur fond sombre : on éclaircit pour le modèle, le masque est appliqué à l'original.
    # Le modèle est instable selon le cadrage : on fusionne (max) plusieurs cadrages.
    br = ImageOps.autocontrast(pad.point(lambda v:int(255*(v/255)**0.5)), cutoff=1)
    a = np.zeros((pad.height,pad.width),np.float32)
    for q in (0,20,40):
        sub = br.crop((q,q,pad.width-q,pad.height-q))
        a[q:pad.height-q,q:pad.width-q] = np.maximum(a[q:pad.height-q,q:pad.width-q], np.array(remove(sub,session=s,only_mask=True),np.float32))
    a = np.clip((a-50)*2.2,0,255).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats((a>0).astype(np.uint8))
    keep = [i for i in range(1,n) if st[i,4] > 0.02*st[1:,4].max()]  # vire les miettes
    a = np.where(np.isin(lab, keep), a, 0).astype(np.uint8)
    # opacifie l'intérieur de la silhouette (le modèle laisse des zones semi-transparentes)
    sol = cv2.morphologyEx((a>100).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5,5),np.uint8))
    ff = sol.copy(); cv2.floodFill(ff, np.zeros((ff.shape[0]+2,ff.shape[1]+2),np.uint8), (0,0), 1)
    sol = sol | (1-ff)  # bouche les trous
    a = np.maximum(a, cv2.erode(sol, np.ones((3,3),np.uint8))*255)
    # sol de la planche (gris-magenta) resté entre/sous les pieds : chroma-key sur la bande basse
    c = np.array(pad).astype(int); r_,g_,b_ = c[...,0],c[...,1],c[...,2]
    floor = (r_-g_>14)&(b_-g_>14)&(b_>0.75*r_)&(r_>55)
    ys = np.nonzero(a.max(1))[0]
    if len(ys): floor[:ys[0]+int(0.72*(ys[-1]-ys[0]))] = False
    a[floor] = 0
    a = a * cv2.morphologyEx((a>0).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3,3),np.uint8))  # traits isolés de 1 px
    m = pad.convert('RGBA'); m.putalpha(Image.fromarray(a))
    bb = m.getbbox()
    (m.crop(bb) if bb else m).save(f'{out}/{k}.png')
    print(k, m.size, bb)
