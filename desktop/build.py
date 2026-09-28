"""콘티 데스크톱판을 만든다.   python desktop/build.py

만드는 것 (desktop/dist/):
  KontiSetup.exe   나눠 줄 파일 하나. 실행하면 설치하고 바탕화면·시작 메뉴에 바로가기를 만든다.
  Konti/Konti.exe  설치하지 않고 바로 쓰는 폴더형(폴더째 옮기면 된다).

순서:
  1. vendor/ 가 없으면 받아 온다(fetch_vendor.py) — OCR 엔진·한글 데이터·악기 샘플.
  2. vendor/ 를 무압축 zip 하나로 묶는다. 파일 천 개를 그대로 넣으면 켤 때마다 백신이 하나씩 검사한다.
  3. PyInstaller 폴더형(onedir)으로 Konti.exe 를 만든다. ★ 한 파일형(onefile)으로 만들면 켤 때마다
     42MB 를 풀어서 창이 뜨기까지 25초가 걸렸다(폴더형은 3초, 실측) — setup_konti.py 참고.
  4. 그 폴더를 통째로 KontiSetup.exe(한 파일형) 안에 넣는다.
"""
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(HERE, 'build')
DIST = os.path.join(HERE, 'dist')
SEP = os.pathsep  # 윈도에서는 ';'


def zip_dir(src, dst):
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_STORED) as z:
        for d, _, fs in os.walk(src):
            for f in fs:
                if f.endswith('.none'):
                    continue
                full = os.path.join(d, f)
                z.write(full, os.path.relpath(full, src).replace(os.sep, '/'))


def pyinstaller(*args):
    subprocess.check_call([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--windowed',
                           '--workpath', os.path.join(BUILD, 'work'), '--specpath', BUILD, *args], cwd=HERE)


def main():
    if not os.path.exists(os.path.join(ROOT, 'vendor', 'ok.txt')):
        subprocess.check_call([sys.executable, os.path.join(HERE, 'fetch_vendor.py')])
    if not os.path.exists(os.path.join(HERE, 'konti.ico')) or not os.path.exists(os.path.join(HERE, 'splash.png')):
        subprocess.check_call([sys.executable, os.path.join(HERE, 'make_icon.py')])
    os.makedirs(BUILD, exist_ok=True)
    icon = os.path.join(HERE, 'konti.ico')

    vz = os.path.join(BUILD, 'vendor.zip')
    zip_dir(os.path.join(ROOT, 'vendor'), vz)

    shutil.rmtree(os.path.join(DIST, 'Konti'), ignore_errors=True)
    pyinstaller('--onedir', '--name', 'Konti', '--icon', icon, '--distpath', DIST,
                '--add-data', f'{os.path.join(ROOT, "index.html")}{SEP}.',
                '--add-data', f'{vz}{SEP}.',
                os.path.join(HERE, 'konti_desktop.py'))

    app_zip = os.path.join(BUILD, 'Konti_app.zip')
    zip_dir(os.path.join(DIST, 'Konti'), app_zip)
    pyinstaller('--onefile', '--name', 'KontiSetup', '--icon', icon, '--distpath', DIST,
                '--splash', os.path.join(HERE, 'splash.png'),
                '--add-data', f'{app_zip}{SEP}.',
                os.path.join(HERE, 'setup_konti.py'))

    for f in ('KontiSetup.exe', os.path.join('Konti', 'Konti.exe')):
        p = os.path.join(DIST, f)
        print(f'완료: {p}  ({os.path.getsize(p) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
