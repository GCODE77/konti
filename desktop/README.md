# 콘티 데스크톱판 (윈도)

인터넷 없이 도는 실행 파일. 웹판 `index.html` 을 그대로 쓰고, CDN 에서 받던 것(OCR 엔진·한글
인식 데이터·악기 샘플)을 `vendor/` 에 들고 다닌다. 설계 이유는 `../CLAUDE.md` 83번 항목.

## 만들기

```
python desktop/build.py
```

- `desktop/dist/KontiSetup.exe` — 나눠 줄 파일 하나. 실행하면 `%LOCALAPPDATA%\Programs\Konti` 에
  설치하고 바탕화면·시작 메뉴에 「콘티」 바로가기를 만든다(관리자 권한 필요 없음). 시작 메뉴의
  「콘티 제거」로 지운다. 저장한 곡은 `%LOCALAPPDATA%\Konti` 에 남는다.
- `desktop/dist/Konti/Konti.exe` — 설치 없이 폴더째 쓰는 판.

필요한 것: Python 3 + `pip install pyinstaller pillow`. 처음 한 번은 인터넷이 있어야 한다
(`fetch_vendor.py` 가 npm·GitHub 에서 받는다, 43MB).

## 파일

| 파일 | 하는 일 |
|---|---|
| `konti_desktop.py` | 127.0.0.1:17877 에서 서빙하고 Edge 앱 창을 띄운다. 창을 닫으면 끝난다 |
| `fetch_vendor.py` | `../vendor/` 를 만든다(저장소에는 안 넣는다) |
| `setup_konti.py` | `KontiSetup.exe` 의 본체 — 폴더형을 풀고 바로가기를 만든다 |
| `build.py` | 위 셋을 PyInstaller 로 묶는다 |
| `make_icon.py` | `konti.ico` · `splash.png` 를 그린다 |

★ 포트(17877)를 바꾸면 저장한 곡이 안 보인다(localStorage 는 주소+포트마다 따로다).
