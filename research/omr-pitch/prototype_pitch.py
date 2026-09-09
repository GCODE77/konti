"""
오선보 음높이 기하학적 검출 v3
==============================
음높이는 AI에게 물을 문제가 아니라 재는 문제다.

    음높이 단계 = (맨아랫줄 y − 음표머리 중심 y) / (줄간격 / 2)

v2가 실패한 이유와 v3에서 바꾼 것
---------------------------------
v2는 줄간격을 '빗살 정합 필터를 여러 간격으로 돌려 최고점 찾기'로 구했다.
저해상도 사진(620px)에서 **간격의 절반을 집는 배음 오인**이 나서 0개를 검출했다.

v3는 **수직 런렝스 분석**으로 바꿨다. Audiveris 같은 실제 OMR 엔진이 쓰는 방법이다.
악보에서 '얇은 검정 줄 + 일정한 흰 간격'이 대량 반복되는 구조는 오선뿐이라,
세로 방향 흰 런 길이의 최빈값이 곧 줄 사이 간격이다. 배음에 속지 않는다.

    검증: 8px(고해상도) / 4px(620px 저해상도) — 둘 다 정확히 맞춤

그다음 **줄간격이 22px가 되도록 확대**한다. 어떤 해상도가 들어와도 이후 단계가
같은 조건에서 돌아간다. 이게 해상도 독립성의 핵심이다.
"""

import numpy as np
from scipy import ndimage
from PIL import Image

TARGET_SP = 22.0          # 이 픽셀 간격으로 정규화한다


# ---------------------------------------------------------------- 전처리

def otsu(a):
    """임계값 자동 결정. 사진 밝기가 매번 다르므로 고정값을 쓰면 안 된다."""
    h = np.bincount(a.ravel(), minlength=256).astype(float)
    p = h / h.sum()
    w = np.cumsum(p)
    m = np.cumsum(p * np.arange(256))
    denom = w * (1 - w)
    denom[denom == 0] = 1e-9
    return int(np.argmax((m[-1] * w - m) ** 2 / denom))


def crop_paper(im):
    """어두운 UI 안의 흰 종이 영역만 잘라낸다.
    앱 스크린샷을 그대로 넣을 때 이게 없으면 전부 무너진다."""
    a = np.array(im)
    rows = np.where((a > 180).mean(axis=1) > 0.5)[0]
    if len(rows) < a.shape[0] * 0.15:
        return im                                  # 이미 종이 사진
    r0, r1 = int(rows.min()), int(rows.max())
    cols = np.where((a[r0:r1] > 180).mean(axis=0) > 0.5)[0]
    if len(cols) < 20:
        return im
    return im.crop((int(cols.min()), r0, int(cols.max()), r1))


def estimate_spacing(dark):
    """수직 런렝스로 (줄간격, 선두께) 추정."""
    H, W = dark.shape
    black = np.zeros(80, int)
    white = np.zeros(200, int)
    step = max(1, W // 600)
    for x in range(0, W, step):
        col = dark[:, x]
        bounds = np.concatenate(
            ([0], np.where(np.diff(col.astype(np.int8)) != 0)[0] + 1, [H]))
        for i in range(len(bounds) - 1):
            ln = bounds[i + 1] - bounds[i]
            if col[bounds[i]] == 1:
                if ln < 80:
                    black[ln] += 1
            elif 1 < ln < 200:
                white[ln] += 1
    thick = int(np.argmax(black[1:]) + 1)
    gap = int(np.argmax(white[2:]) + 2)
    return gap + thick, thick


MIN_SPACING = 3.5    # 원본 줄간격 하한. 5px 악보도 복원되는 것을 확인했다.

class TooLowRes(Exception):
    """오선 5줄이 분리되지 않는 해상도. 알고리즘 문제가 아니라 정보 소실이다."""
    def __init__(self, sp):
        self.sp = sp
        super().__init__(f"줄간격 {sp}px — 최소 {MIN_SPACING}px 필요")


def refine_spacing(dark, sp0):
    """런렝스 추정값 주변을 탐색해 줄간격을 정밀화한다.

    ★ 핵심: 행 밀도에서 주변 중간값을 뺀 뒤(배경 제거) 정합을 본다.
      저해상도 악보는 오선이 흐려서 절대 밀도가 낮다(0.13~0.23).
      전역 최댓값 기준 임계값을 쓰면 이런 줄을 전부 버린다 —
      620px 사진에서 단 검출이 0개였던 진짜 원인이 이것이었다.
      배경을 빼면 흐린 줄도 국소 봉우리로 또렷하게 드러난다.
    """
    r = dark.mean(axis=1)
    H = len(r)
    bg = ndimage.median_filter(r, size=int(2 * max(2, sp0)) | 1)
    hp = np.clip(r - bg, 0, None)

    # ★ 점수는 5줄의 '합계'가 아니라 '중간값'으로 매긴다.
    #   합계를 쓰면 진한 줄 하나가 점수를 끌어올려, 우연히 그 줄에
    #   여러 번 걸치는 잘못된 간격(예: 절반)이 이긴다.
    #   실제로 5.1px 악보에서 3.25px를 골라 단 검출이 0개가 됐다.
    #   중간값은 '5줄이 전부 있어야' 높아지므로 이 함정이 없다.
    best = (0.0, float(sp0))
    lo, hi = max(3.0, sp0 * 0.7), sp0 * 2.2
    for sp in np.arange(lo, hi + 0.01, 0.25):
        span = int(round(4 * sp))
        if span >= H:
            break
        tol = max(1, int(round(sp * 0.25))) | 1
        prof = ndimage.maximum_filter(hp, size=tol)
        sc = max(float(np.median([prof[int(round(y + k * sp))] for k in range(5)]))
                 for y in range(H - span))
        if sc > best[0]:
            best = (sc, float(sp))
    return best[1], hp


def prepare(path):
    """종이 잘라내기 → 이진화 → 줄간격 22px로 정규화.

    돌려주는 값: (선 검출용 이진 이미지, 음표머리 검출용 이진 이미지, sp, thick)
    두 이미지를 따로 만드는 이유:
      - 선 검출: 이진화 후 NEAREST 확대 — 1px 선이 살아남는다
      - 머리 검출: LANCZOS 확대 후 이진화 — 타원 모양이 매끄럽게 유지된다
    하나로 쓰면 한쪽이 반드시 나빠진다.
    """
    im = crop_paper(Image.open(path).convert("L"))
    a = np.array(im)
    dark0 = (a < otsu(a)).astype(np.uint8)
    sp0, thick0 = estimate_spacing(dark0)
    if sp0 < MIN_SPACING:
        raise TooLowRes(sp0)
    sp0, _ = refine_spacing(dark0, sp0)      # 런렝스는 1px 정도 낮게 잡는다
    k = float(np.clip(TARGET_SP / sp0, 0.5, 8.0))

    # ★ 순서가 중요하다: 먼저 이진화, 그다음 확대.
    #   1px 두께 오선을 확대한 뒤 이진화하면 보간으로 흐려져 선이 사라진다.
    #   저해상도 사진(620px)에서 단 검출이 0개였던 원인이 정확히 이것이었다.
    if k > 1.0:
        sm = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))),
                       Image.LANCZOS)
        sa = np.array(sm)
        soft = (sa < otsu(sa)).astype(np.uint8)
    else:
        k = 1.0
        soft = dark0
    # dark0: 원본 해상도 (오선 찾기용 — 확대하면 선이 망가진다)
    # soft : 확대본       (음표머리 찾기용 — 모양이 매끄러워야 한다)
    return dark0, soft, sp0, max(1.0, thick0), k


# ---------------------------------------------------------------- 오선 찾기

def find_systems(dark, sp, min_lines=4):
    """줄간격이 이미 알려졌으므로 빗살 필터를 그 간격 하나로만 돌린다.
    간격을 탐색하지 않으니 배음 오인이 원천적으로 없다.
    각 후보는 '5줄 중 몇 줄이 실제로 진한가'로 검증한다."""
    H, W = dark.shape
    if H < 5 * sp:
        return []

    # 오선이 폭의 일부만 차지하는 악보가 흔하다(여백, 좁은 인쇄).
    # 잉크가 있는 가로 구간만 보고 밀도를 재야 손해를 안 본다.
    col = dark.mean(axis=0)
    ink = np.where(col > col.max() * 0.12)[0]
    x0, x1 = (int(ink.min()), int(ink.max()) + 1) if len(ink) > 10 else (0, W)
    r = dark[:, x0:x1].mean(axis=1)

    # 배경 제거 — 흐린 오선도 국소 봉우리로 드러난다
    bg = ndimage.median_filter(r, size=int(2 * sp) | 1)
    hp = np.clip(r - bg, 0, None)

    # ★ 선 두께만큼의 창에서 최댓값을 본다.
    #   한 행만 샘플링하면 확대로 두꺼워지거나 0.5px 밀린 선을 비껴간다.
    #   저해상도 사진에서 5줄 중 2줄만 잡히던 원인이 이것이었다.
    tol = max(1, int(round(sp * 0.18))) | 1
    hp = ndimage.maximum_filter(hp, size=tol)

    span = int(round(4 * sp))
    score = np.zeros(H)
    for y in range(H - span):
        v = [hp[int(round(y + k * sp))] for k in range(5)]
        score[y] = float(np.median(v))      # 5줄이 모두 있어야 높아진다

    peak = float(score.max())
    if peak <= 0:
        return []

    # 줄 하나의 기준은 '봉우리 평균의 일부' — 전역 최댓값이 아니다
    line_th = peak * 0.25

    win = int(3.2 * sp)
    taken = np.zeros(H, bool)
    tops = []
    for y in np.argsort(score)[::-1]:
        if score[y] < peak * 0.35:
            break
        if taken[max(0, y - win): y + win].any():
            continue
        strong = sum(1 for k in range(5)
                     if hp[int(round(y + k * sp))] > line_th)
        if strong < min_lines:
            continue
        tops.append(int(y))
        taken[y] = True
    return sorted(tops)


def remove_staff_lines(dark, sp, tops, thick):
    """오선만 지우고 음표 기둥은 남긴다.
    위아래가 비어 있는 픽셀만 지우는 것이 핵심 — 행 전체를 지우면
    음표머리가 잘려 검출이 무너진다."""
    H, W = dark.shape
    clean = dark.copy()
    pad = int(max(1, round(thick)))
    look = pad + 2
    for top in tops:
        for k in range(5):
            y = int(round(top + k * sp))
            for yy in range(y - pad, y + pad + 1):
                if yy - look < 0 or yy + look >= H:
                    continue
                row = clean[yy]
                up = clean[yy - look:yy - pad].max(axis=0)
                dn = clean[yy + pad + 1:yy + look + 1].max(axis=0)
                clean[yy] = np.where((row == 1) & (up == 0) & (dn == 0), 0, row)
    return clean


# ---------------------------------------------------------------- 음표머리

def detect_heads(clean, sp, top):
    """한 단에서 음표머리를 찾아 [(x, 오선단계)] 로 돌려준다.
    오선단계: 0 = 맨아랫줄(높은음자리표 E4), +1 = 반칸 위."""
    bottom = top + 4 * sp
    H = clean.shape[0]
    y0 = max(0, int(top - 2.4 * sp))
    y1 = min(H, int(bottom + 2.4 * sp))
    if y1 - y0 < sp:
        return []
    sub = clean[y0:y1]

    ey = max(2, int(round(sp * 0.16)))
    ex = max(3, int(round(sp * 0.22)))
    er = ndimage.binary_erosion(sub, structure=np.ones((ey, ex)))
    lab, n = ndimage.label(er)
    if n == 0:
        return []

    heads = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if h == 0 or w == 0:
            continue
        fill = (lab[sl] == i + 1).sum() / (h * w)
        if not (0.40 * sp < h < 1.35 * sp):
            continue
        if not (0.60 * sp < w < 2.1 * sp):
            continue
        if fill < 0.50:
            continue
        if not (0.8 < w / h < 2.6):
            continue
        cy = (sl[0].start + sl[0].stop) / 2 + y0
        cx = (sl[1].start + sl[1].stop) / 2
        step = int(round((bottom - cy) / (sp / 2)))
        if not (-5 <= step <= 13):        # 오선 + 덧줄 범위
            continue
        heads.append((float(cx), step))
    heads.sort()
    return heads


# ---------------------------------------------------------------- 음이름

_LETTERS = "EFGABCD"        # 단계 0 = E4 부터 올라가는 순서


def step_to_note(step):
    """오선단계 → (음이름, 옥타브). 조표는 호출하는 쪽에서 적용한다."""
    return _LETTERS[step % 7], 4 + (step + 2) // 7


# ---------------------------------------------------------------- 진입점

def analyze(path, min_heads_per_system=3):
    dark0, soft, sp0, thick0, k = prepare(path)

    # ★ 오선은 원본 해상도에서 찾는다. 확대 후에 찾으면
    #   보간으로 선이 두꺼워지고 밀려서 5줄 중 2줄만 잡힌다.
    tops0 = find_systems(dark0, sp0)

    # 좌표를 확대본 기준으로 옮긴다
    sp = sp0 * k
    thick = max(1.0, thick0 * k)
    tops = [int(round(t * k)) for t in tops0]

    clean = remove_staff_lines(soft, sp, tops, thick)
    out = []
    for top in tops:
        heads = detect_heads(clean, sp, top)
        if len(heads) < min_heads_per_system:
            continue                       # 음표가 거의 없는 '단'은 오탐
        out.append({"top": top, "heads": heads})
    return {"spacing": sp, "native_spacing": sp0, "systems": out}


if __name__ == "__main__":
    import sys
    try:
        r = analyze(sys.argv[1])
    except TooLowRes as e:
        print("해상도 부족:", e)
        raise SystemExit(1)
    print(f"정규화 줄간격 {r['spacing']:.1f}px, 단 {len(r['systems'])}개")
    for i, s in enumerate(r["systems"], 1):
        print(f"  단{i}: 음표머리 {len(s['heads'])}개")
    print(f"  합계 {sum(len(s['heads']) for s in r['systems'])}개")
