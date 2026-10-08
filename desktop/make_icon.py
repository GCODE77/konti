"""konti.ico 를 그린다(앱 머리색 #131A23 바탕에 음표).   python desktop/make_icon.py"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))


import math
BG = (19, 26, 35, 255); GOLD = (255, 196, 64, 255); CREAM = (247, 244, 236, 255); MINT = (127, 200, 169, 255); RED = (217, 103, 79, 255)
S=4
def base(n):
    N=n*S; im=Image.new('RGBA',(N,N),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,N-1,N-1],radius=N//4.5,fill=BG); return im,d,N
def note(d,N,cx,cy,sc,col=GOLD):
    # eighth note: head ellipse, stem, flag
    hw,hh=0.13*N*sc,0.095*N*sc
    ang=-0.35
    pts=[(cx+hw*math.cos(t)*math.cos(ang)-hh*math.sin(t)*math.sin(ang), cy+hw*math.cos(t)*math.sin(ang)+hh*math.sin(t)*math.cos(ang)) for t in [i*math.pi/30 for i in range(61)]]
    d.polygon(pts,fill=col)
    sx=cx+hw*0.88; top=cy-0.52*N*sc
    d.rectangle([sx-0.022*N*sc,top,sx+0.022*N*sc,cy],fill=col)
    flag=[(sx+0.02*N*sc,top),(sx+0.22*N*sc,top+0.16*N*sc),(sx+0.2*N*sc,top+0.34*N*sc),(sx+0.1*N*sc,top+0.22*N*sc),(sx+0.02*N*sc,top+0.2*N*sc)]
    d.polygon(flag,fill=col)


def draw(n):  # 4 feature tiles: note / keys / mic wave / metronome
    im,d,N=base(n)
    m=N*0.12; g=N*0.05; t=(N-2*m-g)/2
    def tile(i,j,col):
        x=m+i*(t+g); y=m+j*(t+g); d.rounded_rectangle([x,y,x+t,y+t],radius=N*0.06,fill=col); return x,y
    x,y=tile(0,0,(32,42,56,255)); note(d,N,x+t*0.36,y+t*0.74,0.44)
    x,y=tile(1,0,(32,42,56,255))
    for i in range(4): d.rectangle([x+t*0.14+i*t*0.19,y+t*0.28,x+t*0.14+i*t*0.19+t*0.15,y+t*0.82],fill=CREAM)
    for i in [0,1,2]: d.rectangle([x+t*0.14+i*t*0.19+t*0.11,y+t*0.28,x+t*0.14+i*t*0.19+t*0.23,y+t*0.58],fill=(19,26,35,255))
    x,y=tile(0,1,(32,42,56,255))
    xs=[0.16,0.28,0.4,0.52,0.64,0.76]; hs=[0.12,0.3,0.46,0.3,0.2,0.1]
    for a,h in zip(xs,hs): d.rounded_rectangle([x+t*a,y+t*(0.5-h),x+t*a+t*0.07,y+t*(0.5+h)],radius=t*0.03,fill=MINT)
    x,y=tile(1,1,(32,42,56,255))
    d.polygon([(x+t*0.5,y+t*0.14),(x+t*0.78,y+t*0.86),(x+t*0.22,y+t*0.86)],outline=GOLD,width=max(2,N//50))
    d.line([(x+t*0.5,y+t*0.74),(x+t*0.7,y+t*0.28)],fill=RED,width=max(2,N//60))
    return im.resize((n,n),Image.LANCZOS)


def splash():
    """설치 파일이 스스로를 푸는 동안(20초 남짓) 띄우는 그림 — 없으면 아무것도 안 떠서 멈춘 것처럼 보인다."""
    W, H = 520, 200
    im = Image.new('RGB', (W, H), (19, 26, 35))
    d = ImageDraw.Draw(im)
    fonts = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
    im.paste(draw(120), (36, 40), draw(120))
    d.text((180, 62), '콘티', font=ImageFont.truetype(os.path.join(fonts, 'malgunbd.ttf'), 40), fill=(255, 255, 255))
    d.text((182, 122), '설치를 준비하는 중입니다… 잠시만 기다려 주세요', font=ImageFont.truetype(os.path.join(fonts, 'malgun.ttf'), 15), fill=(170, 185, 205))
    return im


if __name__ == '__main__':
    splash().save(os.path.join(HERE, 'splash.png'))
    big = draw(256)
    # 웹·폰용 그림(v102)
    root = os.path.dirname(HERE)
    for n, nm in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (32, 'favicon.png')]:
        draw(n).save(os.path.join(root, nm))
    big.save(os.path.join(HERE, 'konti.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    big.save(os.path.join(HERE, 'build', 'icon_preview.png') if os.path.isdir(os.path.join(HERE, 'build')) else os.path.join(HERE, 'icon_preview.png'))
    print('konti.ico 완료')
