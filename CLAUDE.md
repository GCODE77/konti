# 콘티 — 교회 찬양팀 악보 앱

**현재 상태:** `index.html` 하나. v36. `https://gcode77.github.io/konti/` 에 배포됨.
**저장소:** `github.com/GCODE77/konti` (public), 브랜치 `main`, 파일명 반드시 `index.html`.

## 지금 당장 할 것

1. 이 폴더를 열고 `index.html`을 그대로 브라우저로 열어 동작 확인
   (사진 인식은 https 환경에서만 됨 — CORS. 로컬 파일로 열면 그 기능만 막힘)
2. **분리 작업 시작.** 2184줄 단일 `<script>`를 아래 "분리 계획"대로 쪼갤 것
3. 분리 후에도 **GitHub Pages 배포는 `index.html` 파일 하나 여야 함** — 빌드 스텝을
   넣는다면 반드시 결과물을 `index.html`로 다시 합치는 빌드 파이프라인을 구성할 것.
   합치지 않고 여러 파일로 쪼갠 채로 두면 Pages가 그대로 서빙하지 못함(모듈 로더 없음).

## 이게 뭔가

교회 반주자가 **종이 악보(코드 차트 또는 오선보) 사진을 찍으면**:
- 코드·가사·멜로디를 텍스트로 변환 (Gemini 무료 API 또는 Claude 유료 API)
- 키를 자유롭게 조옮김 (코드+멜로디 동시)
- 장르별 반주로 재생 (관현악 합성 엔진, 11개 악기 동시 연주 가능)
- 악보 형태(오선보+코드+가사)로 화면에 표시, 음표를 눌러 직접 수정
- PDF/PNG/TXT로 내보내기, 인쇄
- 서버 없이 GitHub Pages 정적 호스팅 하나로 전부 동작

## 왜 이런 구조인가 — 바꾸기 전에 읽을 것

1. **오선보 OMR을 하지 않고 코드 차트 변환에 집중했다가, 결국 오선보까지 갔다.**
   처음엔 "코드는 규칙 연산이라 정확도 100%"라는 이유로 코드 차트만 다뤘다.
   그런데 사용자가 실제로 필요한 게 오선보(멜로디 포함)였고, Gemini Vision이
   생각보다 오선보를 잘 읽어서 멜로디까지 확장했다. **다만 멜로디 음높이 인식은
   여전히 부정확할 수 있다** — 그래서 오선보 편집 UI(음표 클릭→반음/옥타브 수정)가
   핵심 기능이 됐다. 인식이 완벽할 거라 기대하지 말 것.

2. **서버를 두지 않기로 결정했다.** 사용자가 배포/서버 운영에 익숙하지 않아
   GitHub Pages(정적 호스팅, 무료) + Gemini API(무료 티어) 조합으로 감. 이 구조를
   깨고 백엔드를 넣으려면 사용자에게 새로 설명해야 함 — 가볍게 결정하지 말 것.

3. **Gemini가 기본, Claude는 옵션.** 사용자가 "유료면 절대 안 된다"고 명시했다.
   Gemini 무료 티어(하루 한도 있음, 태평양 시간 자정 리셋)가 기본 엔진.
   `thinkingConfig:{thinkingBudget:0}` 필수 — 안 넣으면 내부 추론에 출력 토큰을
   다 써서 결과가 잘린다. 실제로 겪은 버그.

4. **경쟁자는 CCLI SongSelect.** 이미 한국 진출했고 조옮김·코드차트를 제공함.
   이 앱의 존재 이유는 "SongSelect 카탈로그에 없는 종이 악보"를 다루는 것.
   저작권: 은혜(손경민 작곡) 등 실제 곡 가사/멜로디를 AI가 대신 옮겨 적어주는 건
   하지 않기로 함 — 사용자의 악보 업로드→변환은 괜찮지만, 어시스턴트가 곡을
   직접 받아 적는 건 별개 문제로 선을 그었다.

5. **PDF는 이미지 기반.** 외부 라이브러리 없이 캔버스→JPEG→PDF 바이트를 직접
   조립한다. 텍스트 검색은 안 되지만 한글 폰트 임베딩 문제를 피함.

## 실제로 겪은 버그들 (재발 방지용 메모)

- **오디오 엔진 핵심부(`AC()`, `mtof`, `pluckBuf`, 리버브 초기화, `PATTERNS` 반주
  패턴표)를 통째로 실수로 지운 적 있음.** 문법 오류 없이 "재생 버튼이 눌리는데
  아무것도 안 남" 형태로 나타났다 — 문법 검사만으로는 못 잡음.
  **반드시 실제 DOM/AudioContext를 흉내낸 스텁으로 주요 함수(togglePlay,
  openPanel 각 패널, saveSong, seekTo 등)를 실행까지 해보고 배포할 것.**
  이 저장소에는 그런 테스트 스크립트가 없다 — 새로 만들어 CI에 넣을 것을 권장.
- **`[Chorus]`, `[Bridge]` 같은 구간 이름이 코드로 오인식된 적 있음** (C+horus).
  코드 접미사 허용 문자를 화이트리스트로 제한해서 해결(`SUFFIX_RE`).
- **가사에 쉼표 기호 `r`이 새어 들어간 적 있음.** 정리 함수(`cleanLyric`)를 만들고도
  결과를 안 쓰고 원본을 그대로 쓰는 실수를 한 번 더 함 — 데이터 흐름을 끝까지
  추적할 것.
- **멜로디가 코드와 타이밍이 안 맞은 적 있음.** 원인은 못갖춘마디(pickup measure)와
  단위 오차 누적. 마디 단위로 재동기화하고, 마디 길이에 강제로 맞추는
  옵션(`melFit`)을 추가해 해결.

## 코드 구조 (분리 전 현재 상태)

`<script>` 안에 전부 있음. 대략적인 영역 순서:
1. 음악 이론 (파싱, 코드 표기, 조표, `spell()` 오선 위치 계산)
2. 차트 파서 (`parseChart`, `parseMelody`, 절 분리 `pairsForVerse`)
3. 오디오 엔진 (`AC`, `INSTRUMENTS` 11종, `PATTERNS` 반주 8종, `voice`, `strike`)
4. 시퀀서 (`buildTimeline`, `schedule`, 재생/절 자동 진행)
5. 오선보 렌더링 (`leadLineSVGs`, `renderStaff`, `spell`, `keySig`)
6. OCR (Tesseract.js, 키 없이 코드/가사만) — 오선보에는 정확도 낮음, 폴백용
7. Gemini/Claude 비전 API 호출 (`geminiScan`, `runScan`)
8. UI 렌더링 (`renderChart`, `renderToolbar`, 패널 7개: scan/input/library/
   export/view/diag/play)
9. 저장/복원 (`localStorage`, 자동 저장 `scheduleSave`)

## 분리 계획 (권장)

```
src/
  lib/
    music.js       — 음이론 상수, parseChord, showChord, keySig, spell
    parseChart.js  — parseChart, parseMelody, detectKey, pairsForVerse
    audio.js        — AC, INSTRUMENTS, PATTERNS, voice, strike, tapChord
    sequencer.js    — buildTimeline, schedule, startPlay/stopPlay, seekTo
    staff.js        — leadLineSVGs, renderStaff (SVG 오선보)
    ocr.js          — Tesseract 경로 (stripStaff, wordsToChart)
    vision.js       — geminiScan, runScan, makePrompt
    pdf.js          — buildPdf, canvasToPdfBytes, chartCanvas
    store.js        — localStorage 래퍼, 자동 저장/복원
  components/       — 패널 7개, 도구막대, 헤더
  main.js
index.html
```

**테스트부터 넣을 것.** `lib/music.js`와 `lib/parseChart.js`가 이 앱의 유일한
"정확도 100%" 주장(코드 이조)이 걸린 부분. 최소 케이스: 슬래시 코드, 이명동음
왕복, 12반음 왕복, sus/add/maj7, 마이너 감지, 마디선/못갖춘마디, 구간명이
코드로 오인되지 않는지.

## 검증해야 할 것 (코드보다 중요, 이전 세션에서 넘어온 과제)

- 반주자 3~5명 실사용 테스트 — 아직 안 됨
- 사진 변환 손익분기 (몇 곡 만에 손으로 고치는 게 빠른가)
- 주간 재사용률 — 유일한 진짜 성공 지표
- CCLI 코리아 라이선스 경로 문의 — 안 함
- Gemini 무료 티어 하루 한도가 실사용에 얼마나 자주 걸리는지

## 배포

```bash
# GitHub 저장소에 index.html 하나만 올리면 Pages가 자동 서빙.
# Settings → Pages → Branch: main / (root) 로 이미 설정됨.
```
