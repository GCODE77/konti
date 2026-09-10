/* AI 없이(무료 한도·키 없음) 멜로디를 만드는 경로 회귀 테스트 — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/nokey.test.js'); await m.default();

   여기서 지키려는 성질은 두 갈래다.

   (가) 429 를 하루 한도로 오해하지 않는다 (quotaKind)
       v50 까지는 429 를 두 번 맞으면 무조건 "하루 한도 소진"으로 단정했다. 그래서
       한도를 거의 안 쓴 사용자가 "무료 한도를 다 썼습니다" 안내와 함께 멜로디 없는
       결과를 받았다. 실제 응답에는 어느 한도인지가 QuotaFailure 에 적혀 있다.
       ★ 판정이 애매하면 **분당으로 본다** — 하루로 잘못 보면 하루치 기능을 잃지만,
         분당으로 잘못 봐도 몇 초 더 기다렸다 다시 시도할 뿐이다.

   (나) 픽셀로 잰 값만으로 ♪ 줄을 만든다 (keySigSet / geomMelodyLine)
       음표 자리를 세는 건 추론이 아니라 측정이므로 AI가 없어도 된다. 다만 두 가지가
       빠지는데 그 한계를 테스트로 못박아 둔다:
         - 조표는 첫 코드에서 추정한다(그 외 방법이 없다). 단조는 나란한 장조로 센다.
         - 쉼표를 잴 수 없으니 마디선은 **확신할 때만** 넣는다(틀린 마디선 < 마디선 없음). */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){
  T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');}
}
const eq=(name,got,want)=>ok(name+'  → '+JSON.stringify(got),JSON.stringify(got)===JSON.stringify(want),
  'got '+JSON.stringify(got)+' want '+JSON.stringify(want));

/* ---------- (가) 429 성격 판정 ---------- */
const qf=(quotaId,retry)=>({error:{code:429,message:'Quota exceeded',details:[
  {'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId,quotaMetric:'generativelanguage.googleapis.com/generate_content_free_tier_requests'}]},
  ...(retry?[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:retry}]:[])
]}});

function testQuota(){
  let q=quotaKind(qf('GenerateRequestsPerMinutePerProjectPerModel-FreeTier','24s'));
  ok('분당 한도를 분당으로 본다',q.perMin&&!q.perDay,q);
  ok('RetryInfo 의 대기 시간을 읽는다(24s)',q.delay===24,q.delay);

  q=quotaKind(qf('GenerateRequestsPerDayPerProjectPerModel-FreeTier'));
  ok('하루 한도를 하루로 본다',q.perDay&&!q.perMin,q);
  ok('하루 한도에는 RetryInfo 가 없어도 된다',q.delay===0,q.delay);

  /* 실제로 본 표기 흔들림 — 밑줄/대소문자가 섞여 온다 */
  q=quotaKind(qf('generate_requests_per_model_per_day'));
  ok('per_day(밑줄 표기)도 하루로 본다',q.perDay&&!q.perMin,q);

  /* details 가 아예 없는 응답 — 기본은 분당(덜 위험한 쪽) */
  q=quotaKind({error:{code:429,message:'Resource has been exhausted (e.g. check quota).'}});
  ok('details 가 없으면 분당으로 본다(안전한 쪽)',q.perMin&&!q.perDay,q);

  q=quotaKind({error:{code:429,message:'You exceeded your current quota: limit 50 per day'}});
  ok('문구에 per day 가 있으면 하루로 본다',q.perDay&&!q.perMin,q);

  q=quotaKind(null);
  ok('빈 응답이어도 터지지 않고 분당으로 본다',q.perMin&&!q.perDay,q);

  /* 둘 다 걸려 오면 분당으로 본다 — 하루라고 단정해 기능을 끄는 쪽이 더 나쁘다 */
  q=quotaKind({error:{details:[{'@type':'x/google.rpc.QuotaFailure',violations:[
    {quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'},
    {quotaId:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}]}]}});
  ok('둘 다 오면 분당으로 본다',q.perMin&&!q.perDay,q);
}

/* ---------- (가-2) 모델 라운드로빈 / 하루 한도 도장 ----------
   사용자의 AI Studio '비율 제한' 화면에서 실제로 확인한 것: 무료 등급은 **모델마다**
   분당 5회·하루 20회를 따로 센다. 그런데 앱은 늘 점수가 가장 높은 한 모델만 써서
   그것만 24/20 으로 넘겼고 나머지 셋은 2/20, 2/20, 4/20 으로 거의 놀고 있었다.
   그래서 요청마다 모델을 옮겨 가며 쓴다 — 이게 곧 하루 한도를 모델 수만큼 곱하는 일이다. */
function testRotate(){
  const M=['a','b','c','d'];
  for(const m of M){ delete GEM_STATE[m]; }
  try{ localStorage.removeItem('konti.gemday'); }catch(e){}
  const saveRR=GEM_RR;

  GEM_RR=0; eq('라운드로빈 0번째',gemOrder(M).order,['a','b','c','d']);
  GEM_RR=1; eq('라운드로빈 1번째는 b 부터',gemOrder(M).order,['b','c','d','a']);
  GEM_RR=2; eq('라운드로빈 2번째는 c 부터',gemOrder(M).order,['c','d','a','b']);
  GEM_RR=5; eq('라운드로빈은 개수로 돌아온다',gemOrder(M).order,['b','c','d','a']);

  /* 하루 한도를 다 쓴 모델에는 아예 요청을 보내지 않는다 — 거절당하는 것도 요청이다 */
  GEM_RR=0; GEM_STATE.a={dayOut:true};
  eq('하루 한도 소진 모델은 빠진다',gemOrder(M).order,['b','c','d']);
  ok('빠진 개수를 알려 준다',gemOrder(M).dead===1,gemOrder(M).dead);

  /* 분당 한도로 잠깐 쉬는 모델은 버리지 않고 맨 뒤로 — 1분이면 풀린다 */
  GEM_STATE.b={until:Date.now()+60000};
  eq('쉬는 모델은 맨 뒤로 미룬다',gemOrder(M).order,['c','d','b']);
  GEM_STATE.b={until:Date.now()-1000};
  eq('쉬는 시간이 지나면 되돌아온다',gemOrder(M).order,['b','c','d']);

  /* 전부 하루 한도면 그래도 한 번은 두드려 본다(도장이 낡았을 수 있다) */
  M.forEach(m=>GEM_STATE[m]={dayOut:true});
  eq('전부 소진이면 그래도 시도는 한다',gemOrder(M).order.length,4);

  /* localStorage 도장은 태평양 날짜 기준이다 */
  M.forEach(m=>{ delete GEM_STATE[m]; });
  gemDayOut('a',true);
  ok('도장을 찍으면 오늘은 소진으로 본다',gemDayOut('a')===true);
  ok('도장 없는 모델은 멀쩡하다',gemDayOut('zzz')===false);
  eq('도장 찍힌 모델은 순서에서 빠진다',gemOrder(M).order,['b','c','d']);

  try{ localStorage.removeItem('konti.gemday'); }catch(e){}
  M.forEach(m=>{ delete GEM_STATE[m]; });
  GEM_RR=saveRR;
}

/* ---------- (가-3) 지수 백오프 대기 시간 ----------
   실제 대기는 geminiScan 안에 있어 직접 부르기 어렵다. 여기서는 같은 식을 그대로 옮겨
   **성질**을 못박아 둔다: 서버가 알려 준 값이 최우선 · 없으면 배로 늘어남 · 상한이 있음. */
const backoff=(tries,serverDelay)=>
  Math.min(75,Math.max(5,Math.ceil(serverDelay?serverDelay+1:5*Math.pow(2,tries-1))));
function testBackoff(){
  eq('1회차 5초',backoff(1),5);
  eq('2회차 10초',backoff(2),10);
  eq('3회차 20초',backoff(3),20);
  eq('4회차 40초',backoff(4),40);
  ok('배로 늘어난다',backoff(3)===backoff(2)*2&&backoff(4)===backoff(3)*2);
  eq('아무리 길어도 75초를 넘지 않는다',backoff(9),75);
  eq('서버가 24초를 알려 주면 그 값을 쓴다(+1초 여유)',backoff(1,24),25);
  eq('서버 값이 지수보다 짧으면 그쪽을 따른다(40초 → 8초)',backoff(4,7),8);
  /* 다만 429 를 본 직후에 5초보다 빨리 다시 두드리지는 않는다 — 서버가 1초라고 해도
     그건 그 한도만의 이야기고, 곧바로 또 걸리면 재시도 횟수만 태운다. */
  eq('서버가 아무리 짧게 불러도 5초 아래로는 안 내려간다',backoff(4,1),5);
}

/* ---------- (나-1) 첫 코드 → 조표 ---------- */
function testSig(){
  const S=t=>keySigSet(parseChord(t));
  eq('C  → 조표 없음',S('C'),{});
  eq('G  → F#',S('G'),{F:'#'});
  eq('D  → F# C#',S('D'),{F:'#',C:'#'});
  eq('F  → Bb',S('F'),{B:'b'});
  eq('Bb → Bb Eb',S('Bb'),{B:'b',E:'b'});
  eq('Eb → Bb Eb Ab',S('Eb'),{B:'b',E:'b',A:'b'});
  /* 단조는 나란한 장조로 센다 — Gm 은 G장조(#1개)가 아니라 Bb장조(b2개) */
  eq('Gm → Bb Eb (G장조 아님)',S('Gm'),{B:'b',E:'b'});
  eq('Am → 조표 없음',S('Am'),{});
  eq('Em → F#',S('Em'),{F:'#'});
  /* maj7 은 단조가 아니다 — m 으로 시작하는 것처럼 보여도 걸리면 안 된다 */
  eq('Fmaj7 → Bb (단조로 오인 금지)',S('Fmaj7'),{B:'b'});
  eq('코드가 없으면 조표 없음',keySigSet(null),{});
}

/* ---------- (나-2) 잰 음표 → ♪ 줄 ---------- */
const g=(notes,durSure)=>({durSure:durSure!==false,
  notes:notes.map(n=>({name:n[0],beats:n[1],sure:durSure!==false}))});

function testMel(){
  /* 조표를 입힌다: Bb 조에서 오선 위 B 자리는 실제로 Bb 소리다 */
  eq('조표를 음이름에 입힌다(Bb조)',
    geomMelodyLine(g([['B4',1],['E4',1],['C5',1],['F4',1]]),4,{B:'b',E:'b'}),
    '♪ Bb4:1 Eb4:1 C5:1 F4:1');
  eq('조표가 없으면 그대로',
    geomMelodyLine(g([['B4',1],['E4',1],['C5',1],['F4',1]]),4,{}),
    '♪ B4:1 E4:1 C5:1 F4:1');

  /* 마디선: 길이를 다 확신하고 합계가 마디에 딱 떨어질 때만 넣는다 */
  eq('4/4 두 마디면 가운데에 마디선이 하나',
    geomMelodyLine(g([['C4',1],['D4',1],['E4',1],['F4',1],['G4',2],['A4',2]]),4,{}),
    '♪ C4:1 D4:1 E4:1 F4:1 | G4:2 A4:2');
  eq('마지막에는 마디선을 붙이지 않는다',
    geomMelodyLine(g([['C4',2],['D4',2],['E4',4]]),4,{}),
    '♪ C4:2 D4:2 | E4:4');
  eq('3/4 도 박자표대로 나눈다',
    geomMelodyLine(g([['C4',1],['D4',1],['E4',1],['F4',1],['G4',1],['A4',1]]),3,{}),
    '♪ C4:1 D4:1 E4:1 | F4:1 G4:1 A4:1');

  /* 길이가 애매하면(sure=false) 마디선을 넣지 않는다 — 쉼표를 못 재서 밀릴 수 있다 */
  eq('길이가 애매하면 마디선 없이 음만 잇는다',
    geomMelodyLine(g([['C4',1],['D4',1],['E4',1],['F4',1]],false),4,{}),
    '♪ C4:1 D4:1 E4:1 F4:1');
  /* 합계가 마디에 안 떨어져도(=쉼표가 빠졌다는 뜻) 마디선을 넣지 않는다 */
  eq('합계가 마디에 안 맞으면 마디선 없음',
    geomMelodyLine(g([['C4',1],['D4',1],['E4',1]]),4,{}),
    '♪ C4:1 D4:1 E4:1');

  eq('음이 3개 미만이면 아예 만들지 않는다',geomMelodyLine(g([['C4',1],['D4',1]]),4,{}),'');
  eq('geo 가 없으면 빈 문자열',geomMelodyLine(null,4,{}),'');

  /* 점음표 길이가 그대로 실린다(headDur 이 재 준 값) */
  eq('점4분음표 1.5 박이 그대로 실린다',
    geomMelodyLine(g([['C4',1.5],['D4',0.5],['E4',1],['F4',1]]),4,{}),
    '♪ C4:1.5 D4:0.5 E4:1 F4:1');
}

/* ---------- (나-3) 만든 ♪ 줄을 파서가 되읽는가 ---------- */
function testRoundTrip(){
  const line=geomMelodyLine(g([['B4',1],['A4',1],['G4',2],['E4',4]]),4,{B:'b'});
  eq('만든 줄',line,'♪ Bb4:1 A4:1 G4:2 | E4:4');
  const nts=parseMelody(line);
  eq('파서가 되읽은 개수(마디선 포함)',nts.length,5);
  const mid=nts.filter(n=>!n.bar).map(n=>n.midi);
  /* Bb4 = 70, A4 = 69, G4 = 67, E4 = 64 */
  eq('되읽은 음높이',mid,[70,69,67,64]);
  eq('되읽은 박수',nts.filter(n=>!n.bar).map(n=>n.beats),[1,1,2,4]);
}

export default async function run(){
  pass=0; fail=0; T.length=0;
  testQuota(); testRotate(); testBackoff(); testSig(); testMel(); testRoundTrip();
  console.log('%c nokey.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  T.filter(t=>!t.cond).forEach(t=>console.log('  ✗ '+t.name));
  return {pass,fail};
}
