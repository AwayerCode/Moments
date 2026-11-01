"""Generate tileable procedural PBR maps (albedo / normal / roughness) for the Moments room.
Original work, no third-party assets. Run: python3 scripts/gen_textures.py"""
import numpy as np
from PIL import Image
import os
OUT=os.path.join(os.path.dirname(__file__),'..','assets','reference','legacy')
rng=np.random.default_rng(7)
def fnoise(n,lo,hi,seed):
    """Tileable band-limited noise via FFT filtering, normalised to 0..1."""
    r=np.random.default_rng(seed);w=r.standard_normal((n,n))
    f=np.fft.fftfreq(n)*n;fx,fy=np.meshgrid(f,f);k=np.sqrt(fx**2+fy**2)+1e-6
    filt=np.exp(-(k/hi)**2)*(1-np.exp(-(k/lo)**2))/k**0.6
    v=np.real(np.fft.ifft2(np.fft.fft2(w)*filt));v-=v.min();return v/v.max()
def normal_from_height(h,strength):
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*strength;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*strength
    n=np.dstack([-dx,dy,np.ones_like(h)]);n/=np.linalg.norm(n,axis=2,keepdims=True)
    return ((n*.5+.5)*255).astype(np.uint8)
def save(a,name,q=86):
    Image.fromarray(a).save(os.path.join(OUT,name),quality=q,optimize=True);print(name)
def rgb(base,v,amp):
    return np.clip(np.dstack([base[i]+(v-.5)*amp[i] for i in range(3)]),0,255).astype(np.uint8)
N=2048
# Plaster wall: soft trowel swirls + fine sand grain.
h=.55*fnoise(N,2,40,1)+.3*fnoise(N,30,260,2)+.15*fnoise(N,300,1024,3)
save(rgb((246,240,234),h,(14,14,16)),'plaster_albedo.jpg')
hn=.65*fnoise(N,2,40,1)+.35*fnoise(N,30,260,2)
save(np.array(Image.fromarray(normal_from_height(hn,30)).resize((1024,1024),Image.LANCZOS)),'plaster_normal.jpg',82)
save((np.clip(.86+(h-.5)*.16,0,1)*255).astype(np.uint8),'plaster_rough.jpg')
# Light oak floor: 8 planks per tile, stretched grain noise, staggered seams.
y,x=np.mgrid[0:N,0:N]/N
plank=np.floor(y*8).astype(int)
g=fnoise(N,1,60,6)
# anisotropic grain: average noise along x to stretch it
k=64;ga=np.cumsum(np.concatenate([g[:,-k:],g],1),1);ga=(ga[:,k:]-ga[:,:-k])/k
ga=(ga-ga.min())/(ga.max()-ga.min())
tone=np.array([.92,1.04,.97,1.08,.95,1.0,1.06,.9])[plank%8]
offset=(np.array([0,.37,.71,.18,.55,.83,.29,.64])[plank%8])
seamx=np.abs(((x+offset)%.5)-.25)>.2485
seamy=(y*8%1<.004)|(y*8%1>.996)
v=ga*tone
col=rgb((226,200,170),v,(38,34,30))
col=(col*np.where(seamx|seamy,.72,1)[...,None]).astype(np.uint8)
save(col,'oak_albedo.jpg')
hw=ga*.6-np.where(seamx|seamy,1.,0)
save(normal_from_height(hw,6),'oak_normal.jpg')
save((np.clip(.58+(ga-.5)*.2+np.where(seamx|seamy,.25,0),0,1)*255).astype(np.uint8),'oak_rough.jpg')
# Fine polymer grain for the camera shell (normal map, 512).
gh=fnoise(512,40,256,8)
save(normal_from_height(gh,3),'grain_normal.jpg',90)
