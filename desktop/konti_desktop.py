"""콘티 데스크톱판 — 인터넷 없이 도는 실행 파일(Konti.exe)의 본체.

하는 일은 둘뿐이다.
  1. index.html 과 vendor/(OCR 엔진·한글 데이터·악기 샘플)를 127.0.0.1 에서 서빙한다.
     사진 인식은 file:// 로 열면 막히므로(CORS·워커) 로컬 서버가 꼭 있어야 한다.
  2. Edge(없으면 Chrome)를 '앱 창'으로 띄운다 — 주소창·탭 없이 프로그램처럼 보인다.
     창을 닫으면 서버도 같이 끝난다.

★ 포트를 고정한다(17877). 저장한 곡은 브라우저 localStorage 에 들어가는데, localStorage 는
  주소+포트마다 따로라 포트가 바뀌면 저장한 곡이 전부 사라진 것처럼 보인다.
★ 브라우저 프로필도 따로 쓴다(%LOCALAPPDATA%\\Konti\\browser). 평소 쓰는 Edge 와 섞이지 않고,
  이미 Edge 가 떠 있어도 창이 닫히는 순간을 알 수 있다(같은 프로필이면 새 창이 기존 프로세스에
  붙고 곧장 끝나 버린다).
"""
import http.server
import io
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import zipfile

PORT = 17877
HOST = '127.0.0.1'
APP_NAME = 'Konti'


def base_dir():
    # PyInstaller 로 묶이면 파일들이 _MEIPASS 에 풀린다. 개발 중에는 저장소 루트.
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
    '.wasm': 'application/wasm', '.gz': 'application/gzip', '.mp3': 'audio/mpeg',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8',
}


# ★ 실행 파일에서는 vendor/ 를 zip 하나(무압축)로 들고 다닌다. 파일 천 개를 풀어 놓으면 켤 때마다
#   백신이 하나하나 검사해서 창이 뜨기까지 40초가 걸렸다(실측). zip 하나면 몇 초다.
#   개발 중(저장소에서 바로 실행)에는 vendor/ 폴더를 그대로 쓴다.
_VZIP = None
_VZIP_LOCK = threading.Lock()


def vendor_zip():
    global _VZIP
    if _VZIP is None:
        path = os.path.join(base_dir(), 'vendor.zip')
        _VZIP = zipfile.ZipFile(path) if os.path.exists(path) else False
    return _VZIP


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=base_dir(), **kw)

    def send_head(self):
        z = vendor_zip()
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        if z and path.startswith('/vendor/'):
            name = urllib.parse.unquote(path[len('/vendor/'):])
            try:
                with _VZIP_LOCK:
                    data = z.read(name)
            except KeyError:
                self.send_error(404)
                return None
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(name))
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()

    def guess_type(self, path):
        # 윈도의 레지스트리 MIME 표는 .js 를 text/plain 으로 주는 일이 있다 — 그러면 워커가 안 뜬다.
        return MIME.get(os.path.splitext(path)[1].lower()) or super().guess_type(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *a):
        pass


def already_running():
    try:
        with urllib.request.urlopen(f'http://{HOST}:{PORT}/vendor/ok.txt', timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def start_server():
    srv = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def find_browser():
    cands = []
    for env in ('PROGRAMFILES(X86)', 'PROGRAMFILES', 'LOCALAPPDATA'):
        root = os.environ.get(env)
        if not root:
            continue
        cands += [os.path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                  os.path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')]
    for c in cands:
        if os.path.exists(c):
            return c
    return shutil.which('msedge') or shutil.which('chrome')


def open_window(url):
    """앱 창을 띄우고, 창이 닫힐 때까지 기다린다. 브라우저를 못 찾으면 False."""
    exe = find_browser()
    if not exe:
        return False
    prof = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), APP_NAME, 'browser')
    os.makedirs(prof, exist_ok=True)
    args = [exe, f'--app={url}', f'--user-data-dir={prof}', '--no-first-run',
            '--no-default-browser-check', '--disable-features=Translate', '--window-size=1280,900']
    p = subprocess.Popen(args)
    p.wait()
    return True


def wait_forever_with_notice(url):
    # 브라우저를 못 찾았을 때 — 기본 브라우저로 열고, 작은 창으로 '닫으면 끝난다'를 알린다.
    import webbrowser
    webbrowser.open(url)
    try:
        import tkinter as tk
        root = tk.Tk()
        root.title('하모닉스')
        tk.Label(root, text=f'하모닉스가 실행 중입니다.\n{url}\n\n이 창을 닫으면 종료됩니다.',
                 padx=24, pady=18, font=('Malgun Gothic', 11)).pack()
        root.mainloop()
    except Exception:
        while True:
            time.sleep(3600)


def main():
    url = f'http://{HOST}:{PORT}/index.html'
    if already_running():
        # 이미 켜져 있으면 창만 하나 더 연다(서버는 먼저 켠 쪽이 들고 있다).
        open_window(url) or wait_forever_with_notice(url)
        return
    try:
        start_server()
    except OSError:
        # 포트를 다른 프로그램이 쓰고 있다 — 포트를 바꾸면 저장한 곡이 안 보이므로 알리고 끝낸다.
        try:
            import tkinter.messagebox as mb
            mb.showerror('하모닉스', f'포트 {PORT} 를 다른 프로그램이 쓰고 있어 시작할 수 없습니다.')
        except Exception:
            pass
        return
    if not open_window(url):
        wait_forever_with_notice(url)


if __name__ == '__main__':
    main()
