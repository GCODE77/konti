"""KontiSetup.exe — 콘티를 이 컴퓨터에 설치한다(관리자 권한 필요 없음).

왜 설치 파일이 따로 있나.
  실행 파일 '하나'(PyInstaller onefile)로만 만들면 켤 때마다 42MB 를 임시 폴더에 풀고,
  백신이 그걸 매번 새로 검사해서 창이 뜨기까지 **25초**가 걸렸다(실측, 세 번 재도 같았다).
  폴더형(onedir)으로 한 번 깔아 두면 **3초**다. 그래서 나눠 줄 때는 이 파일 하나를 주고,
  이게 폴더형을 %LOCALAPPDATA%\\Programs\\Konti 에 풀고 바탕화면·시작 메뉴에 바로가기를 만든다.

저장한 곡은 %LOCALAPPDATA%\\Konti\\browser(브라우저 프로필)에 있다 — 설치 폴더와 따로라
다시 설치하거나 지워도 곡은 남는다.

    KontiSetup.exe            창을 띄워 설치하고 콘티를 켠다
    KontiSetup.exe /S         조용히 설치만(시험용)
"""
import os
import shutil
import subprocess
import sys
import threading
import zipfile

APP = 'Konti'
TITLE = '하모닉스'   # 화면에 보이는 이름(v103). 폴더·exe·저장 위치는 옛 이름 Konti 를 그대로 둔다 — 저장한 곡이 안 사라지게
LOCAL = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
TARGET = os.path.join(LOCAL, 'Programs', APP)


def payload():
    base = sys._MEIPASS if getattr(sys, 'frozen', False) else os.path.join(os.path.dirname(__file__), 'build')
    return os.path.join(base, 'Konti_app.zip')


def ps(script):
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
                   creationflags=0x08000000, check=False)  # CREATE_NO_WINDOW


def make_shortcuts():
    exe = os.path.join(TARGET, 'Konti.exe')
    unin = os.path.join(TARGET, 'uninstall.ps1')
    with open(unin, 'w', encoding='utf-8-sig') as f:
        f.write(f"""# 하모닉스 제거 — 프로그램 폴더와 바로가기만 지운다. 저장한 곡(%LOCALAPPDATA%\\Konti)은 남긴다.
Get-Process -Name Konti -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$d=[Environment]::GetFolderPath('Desktop'); $s=[Environment]::GetFolderPath('Programs')
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $d '{TITLE}.lnk'), (Join-Path $s '{TITLE}.lnk'), (Join-Path $s '{TITLE} 제거.lnk'), (Join-Path $d '콘티.lnk'), (Join-Path $s '콘티.lnk'), (Join-Path $s '콘티 제거.lnk')
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue '{TARGET}'
""")
    ps(f"""
$w=New-Object -ComObject WScript.Shell
$d=[Environment]::GetFolderPath('Desktop'); $s=[Environment]::GetFolderPath('Programs')
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $d '콘티.lnk'), (Join-Path $s '콘티.lnk'), (Join-Path $s '콘티 제거.lnk')   # 옛 이름 바로가기 정리
foreach($p in @((Join-Path $d '{TITLE}.lnk'),(Join-Path $s '{TITLE}.lnk'))){{
  $l=$w.CreateShortcut($p); $l.TargetPath='{exe}'; $l.WorkingDirectory='{TARGET}'
  $l.IconLocation='{exe},0'; $l.Description='하모닉스 — 악보·건반·튜너·메트로놈'; $l.Save() }}
$u=$w.CreateShortcut((Join-Path $s '{TITLE} 제거.lnk')); $u.TargetPath='powershell.exe'
$u.Arguments='-NoProfile -ExecutionPolicy Bypass -File "{unin}"'; $u.Save()
""")


def install(say):
    if not os.path.exists(payload()):
        raise RuntimeError('설치 파일이 손상되었습니다(Konti_app.zip 없음).')
    say('실행 중인 하모닉스를 닫는 중…')
    subprocess.run(['taskkill', '/IM', 'Konti.exe', '/F'], capture_output=True, creationflags=0x08000000)
    say('파일을 푸는 중…')
    tmp = TARGET + '.new'
    shutil.rmtree(tmp, ignore_errors=True)
    with zipfile.ZipFile(payload()) as z:
        z.extractall(tmp)
    if os.path.exists(TARGET):
        old = TARGET + '.old'
        shutil.rmtree(old, ignore_errors=True)
        try:
            os.replace(TARGET, old)
        except OSError:
            raise RuntimeError('하모닉스가 아직 켜져 있어 바꿀 수 없습니다. 하모닉스 창을 모두 닫고 다시 실행해 주세요.')
        shutil.rmtree(old, ignore_errors=True)
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    os.replace(tmp, TARGET)
    say('바로가기를 만드는 중…')
    make_shortcuts()


def main():
    try:  # 설치 파일이 스스로를 푸는 동안 떠 있던 그림(build.py 의 --splash)을 닫는다
        import pyi_splash
        pyi_splash.close()
    except Exception:
        pass
    silent = any(a.lower() in ('/s', '--silent') for a in sys.argv[1:])
    if silent:
        install(print)
        return
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.title(f'{TITLE} 설치')
    root.resizable(False, False)
    msg = tk.StringVar(value='설치를 준비하는 중…')
    tk.Label(root, text=f'{TITLE}을(를) 이 컴퓨터에 설치합니다', font=('Malgun Gothic', 12, 'bold'),
             padx=28, pady=12).pack()
    tk.Label(root, textvariable=msg, font=('Malgun Gothic', 10), padx=28, pady=6).pack()
    tk.Label(root, text=f'설치 위치: {TARGET}', font=('Malgun Gothic', 8), fg='#666', padx=28, pady=10).pack()
    result = {}

    def work():
        try:
            install(lambda s: root.after(0, msg.set, s))
            result['ok'] = True
        except Exception as e:
            result['err'] = str(e)
        root.after(0, done)

    def done():
        if 'err' in result:
            messagebox.showerror(f'{TITLE} 설치', result['err'])
        else:
            messagebox.showinfo(f'{TITLE} 설치', '설치를 마쳤습니다.\n바탕화면의 「하모닉스」 아이콘으로 켜면 됩니다.\n\n지금 콘티를 켭니다.')
            subprocess.Popen([os.path.join(TARGET, 'Konti.exe')], cwd=TARGET)
        root.destroy()

    root.after(200, lambda: threading.Thread(target=work, daemon=True).start())
    root.mainloop()


if __name__ == '__main__':
    main()
