"""konti.ico 를 그린다(앱 머리색 #131A23 바탕에 음표).   python desktop/make_icon.py"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))


def draw(n):
    s = 4  # 크게 그리고 줄여야 가장자리가 매끈하다
    im = Image.new('RGBA', (n * s, n * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    N = n * s
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=N // 5, fill=(19, 26, 35, 255))
    # 오선 다섯 줄
    for i in range(5):
        y = int(N * (0.30 + i * 0.09))
        d.line([(N * 0.12, y), (N * 0.88, y)], fill=(90, 110, 135, 255), width=max(1, N // 64))
    font = ImageFont.truetype(os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'seguisym.ttf'),
                              int(N * 0.78))
    d.text((N * 0.5, N * 0.53), '\u266A', font=font, fill=(255, 196, 64, 255), anchor='mm')
    return im.resize((n, n), Image.LANCZOS)


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
    big.save(os.path.join(HERE, 'konti.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    big.save(os.path.join(HERE, 'build', 'icon_preview.png') if os.path.isdir(os.path.join(HERE, 'build')) else os.path.join(HERE, 'icon_preview.png'))
    print('konti.ico 완료')
