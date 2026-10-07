"""콘티 데스크톱판이 인터넷 없이 돌도록 CDN 에서 받던 파일을 vendor/ 에 내려받는다.

받는 것:
  - Tesseract.js 5.1.1 (OCR 엔진 · 워커 · wasm 코어)       — Apache-2.0
  - 한글·영문 인식 데이터(4.0.0_best_int)                  — Apache-2.0
  - 악기 샘플 11종 (gleitz/midi-js-soundfonts FluidR3_GM)   — CC-BY 3.0 / MIT

한 번만 돌리면 된다. 이미 받은 파일은 건너뛴다.
    python desktop/fetch_vendor.py
vendor/ 는 저장소에 넣지 않는다(.gitignore) — 용량이 크고, 빌드할 때마다 이 스크립트로 다시 만든다.
"""
import io
import os
import sys
import tarfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, 'vendor')

NPM = [
    # (패키지, 버전, [(tar 안 경로, vendor 안 경로)])
    ('tesseract.js', '5.1.1', [
        ('package/dist/tesseract.min.js', 'tesseract/tesseract.min.js'),
        ('package/dist/worker.min.js', 'tesseract/worker.min.js'),
        ('package/LICENSE.md', 'tesseract/LICENSE.md'),
    ]),
    ('tesseract.js-core', '5.1.1', [
        ('package/tesseract-core.wasm.js', 'tesseract/core/tesseract-core.wasm.js'),
        ('package/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'),
        ('package/tesseract-core-simd.wasm.js', 'tesseract/core/tesseract-core-simd.wasm.js'),
        ('package/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'),
    ]),
    ('@tesseract.js-data/eng', '1.0.0', [
        ('package/4.0.0_best_int/eng.traineddata.gz', 'tesseract/lang/eng.traineddata.gz'),
    ]),
    ('@tesseract.js-data/kor', '1.0.0', [
        ('package/4.0.0_best_int/kor.traineddata.gz', 'tesseract/lang/kor.traineddata.gz'),
    ]),
]

# index.html 의 SAMPLE_MAP 과 같아야 한다.
INSTRUMENTS = ['acoustic_grand_piano', 'electric_piano_1', 'drawbar_organ', 'string_ensemble_1',
               'cello', 'trumpet', 'flute', 'choir_aahs', 'pad_2_warm', 'acoustic_guitar_nylon',
               'acoustic_bass',
               # 건반 연주 전용(v93)
               'violin', 'trombone', 'clarinet', 'alto_sax', 'oboe', 'orchestra_harp', 'vibraphone', 'marimba']
FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
SF_BASE = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/'


def get(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:  # 네트워크 흔들림은 다시 시도
            last = e
    raise RuntimeError(f'{url}: {last}')


def fetch_npm():
    for pkg, ver, files in NPM:
        todo = [(src, dst) for src, dst in files if not os.path.exists(os.path.join(VENDOR, dst))]
        if not todo:
            continue
        base = pkg.split('/')[-1]
        url = f'https://registry.npmjs.org/{pkg}/-/{base}-{ver}.tgz'
        print('받는 중', url)
        data = get(url)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tf:
            for src, dst in todo:
                out = os.path.join(VENDOR, dst)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, 'wb') as f:
                    f.write(tf.extractfile(src).read())


def fetch_sample(job):
    inst, name = job
    out = os.path.join(VENDOR, 'soundfonts', f'{inst}-mp3', name)
    if os.path.exists(out) or os.path.exists(out + '.none'):
        return 0
    data = get(SF_BASE + f'{inst}-mp3/{name}')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if data is None:  # 그 악기에 없는 음 — 다음에 또 묻지 않도록 표시만 남긴다
        open(out + '.none', 'w').close()
        return 0
    with open(out, 'wb') as f:
        f.write(data)
    return 1


def fetch_samples():
    jobs = [(i, f'{n}{o}.mp3') for i in INSTRUMENTS for o in range(0, 9) for n in FLAT_NAMES]
    print(f'악기 샘플 {len(INSTRUMENTS)}종 확인 중…')
    with ThreadPoolExecutor(12) as ex:
        got = sum(ex.map(fetch_sample, jobs))
    print(f'  새로 받은 샘플 {got}개')


def main():
    os.makedirs(VENDOR, exist_ok=True)
    fetch_npm()
    fetch_samples()
    with open(os.path.join(VENDOR, 'ok.txt'), 'w', encoding='utf-8') as f:
        f.write('konti vendor ok\n')
    total = sum(os.path.getsize(os.path.join(d, x)) for d, _, fs in os.walk(VENDOR) for x in fs)
    print(f'완료: {VENDOR}  ({total / 1e6:.1f} MB)')


if __name__ == '__main__':
    sys.exit(main())
