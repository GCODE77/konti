/* 멜로디에서 코드를 짐작하는 경로 회귀 테스트(v54) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/chord.test.js'); await m.default();

   왜 생겼나. 사용자 제안 — *"AI로 굳이 안 읽어도, 네가 마디로 음표 높이를 읽었다고 하면
   코드 못 읽거나 식별 어려운 것은 마디의 음을 보고 무슨 코드가 들어가는지 짐작해서 넣으면
   되잖아!"* 코드 기호를 **글자로 읽는 것**(OCR)은 ♯ 하나에 무너지지만, 코드를 **음에서
   되짚는 것**은 이미 픽셀로 재 놓은 값만 쓴다.

   ★ 여기서 가장 중요한 성질은 "잘 맞히는 것"이 아니라 **"읽어 낸 코드를 짐작이 이기지
     않는 것"** 이다. 짐작은 어디까지나 빈칸을 메우는 일이고, 실제로 읽어 낸 코드를
     덮어쓰기 시작하면 멀쩡하던 반주까지 망가진다. 그래서 그 성질을 여러 각도로 못박는다. */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){
  T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');}
}
const eq=(name,got,want)=>ok(name+'  → '+JSON.stringify(got),
  JSON.stringify(got)===JSON.stringify(want),'got '+JSON.stringify(got)+' want '+JSON.stringify(want));

const b=(...a)=>a.map(m=>({midi:m,beats:1}));
const show=a=>a.map(c=>showChord(c,0,'sharp'));
/* 아짜기 둥지 (C장조) — 교과서 화성이 널리 알려진 곡이라 정답 비교에 쓴다 */
const TWINKLE=[b(60,60,67,67),b(69,69,67),b(65,65,64,64),b(62,62,60),
               b(67,67,65,65),b(64,64,62),b(67,67,65,65),b(64,64,62)];

export default async function chordTest(){
  T.length=0; pass=0; fail=0;

  /* 1. 기본 — 조성 안의 코드만 나오고, 끝은 으뜸화음이다(종지) */
  const g=guessChords(TWINKLE,0,false);
  const names=show(g);
  ok('C장조 8마디 → 8개  '+names.join(' '),g.length===8,names);
  eq('마지막 마디는 으뜸화음',names[7],'C');
  eq('첫 마디도 으뜸화음',names[0],'C');
  const DIA_C=['C','Dm','Em','F','G','Am','G7'];
  ok('전부 그 조의 코드다',names.every(n=>DIA_C.indexOf(n)>=0),names);
  ok('전부 짐작으로 표시된다',g.every(c=>c.guess));

  /* 2. ★ 읽어 낸 코드는 그대로 살아야 한다 — 이 파일에서 제일 중요한 성질 */
  const fx=[parseChord('A'),null,parseChord('E/G#'),null,parseChord('Bm7'),null,null,parseChord('Amaj7')];
  const r=guessChords(TWINKLE,9,false,{fixed:fx});
  const rn=show(r);
  eq('읽은 코드는 글자 그대로 남는다(분수코드·7th 포함)',
     [rn[0],rn[2],rn[4],rn[7]],['A','E/G#','Bm7','Amaj7']);
  eq('읽은 마디는 짐작으로 표시하지 않는다',
     r.map(c=>c.guess),[false,true,false,true,false,true,true,false]);
  ok('빈칸만 그 조의 코드로 채운다',
     [rn[1],rn[3],rn[5],rn[6]].every(n=>['A','Bm','C#m','D','E','F#m','E7'].indexOf(n)>=0),rn);

  /* 3. 읽어 낸 코드는 **닻**이다 — 그 주변 짐작이 따라 좋아져야 한다.
     3·4마디를 교과서 값(C·G7)으로 못 박으면 2마디가 Am → F 로 바뀐다(교과서 화성). */
  const free=show(guessChords(TWINKLE,0,false));
  const anch=show(guessChords(TWINKLE,0,false,{fixed:[null,null,parseChord('C'),parseChord('G7'),null,null,null,null]}));
  ok('닻을 박으면 주변 짐작이 달라진다',JSON.stringify(free)!==JSON.stringify(anch),[free,anch]);
  eq('닻 주변이 교과서 화성이 된다',anch.slice(0,5).join(' '),'C F C G7 G7');

  /* 4. 이조해도 같은 도수가 나와야 한다 — 규칙이 특정 조에 맞춰 구부러져 있지 않다는 증거 */
  const up=TWINKLE.map(bar=>bar.map(n=>({midi:n.midi+5,beats:n.beats})));
  eq('5반음 올려도 도수는 같다',guessChords(up,5,false).map(c=>c.deg),g.map(c=>c.deg));
  const dn=TWINKLE.map(bar=>bar.map(n=>({midi:n.midi-3,beats:n.beats})));
  eq('3반음 내려도 도수는 같다',guessChords(dn,9,false).map(c=>c.deg),g.map(c=>c.deg));

  /* 5. 단조 — 끝은 으뜸단화음이고, 딸림화음은 장3화음(화성단음계)이 나올 수 있어야 한다 */
  const am=guessChords([b(69,72,76),b(77,76,74),b(72,71,69),b(71,68,69)],9,true);
  eq('단조의 마지막은 으뜸단화음',showChord(am[3],0,'sharp'),'Am');
  ok('단조 후보에 장3화음 V(E)가 있다',
     chordCandidates(9,true).some(c=>c.deg===4&&c.sfx===''),chordCandidates(9,true).map(c=>c.deg+c.sfx));

  /* 6. 안 터져야 하는 것들 */
  eq('마디가 없으면 빈 배열',guessChords([],0,false),[]);
  ok('음이 없는 마디도 코드는 나온다',guessChords([[],[],[]],0,false).length===3);
  ok('음이 하나뿐인 마디도 된다',guessChords([b(60)],0,false).length===1);
  ok('조 밖의 음이 섞여도 터지지 않는다',guessChords([b(60,61,66),b(60,64,67)],0,false).length===2);

  /* 7. 화성 밖의 음보다 화성음이 이긴다(마디 점수가 실제로 일을 하는지) */
  const f1=guessChords([b(65,69,72),b(60,64,67)],0,false);
  eq('파라도 마디는 F, 도미솔 마디는 C',show(f1),['F','C']);

  /* 8. 코드를 하나도 못 읽었을 때 멜로디로 조를 어림한다 */
  const cmaj=[60,62,64,65,67,69,71,72,67,64,60].map(m=>({midi:m,beats:1}));
  eq('C장조 음계 → C major',guessKeyFromMelody(cmaj),{pc:0,minor:false});
  const amin=[69,71,72,74,76,77,79,76,72,69].map(m=>({midi:m,beats:1}));
  const k2=guessKeyFromMelody(amin);
  ok('A단조 음계 → A 로 끝나는 조',k2.pc===9,k2);
  eq('음이 없으면 C',guessKeyFromMelody([]),{pc:0,minor:false});

  /* 9. 조성 밖 코드도 도수로 바꿀 수 있어야 한다(이음 점수 계산이 터지지 않게) */
  ok('C조에서 Eb(반음계) 도 도수가 나온다',chordDegree(3,0,false)>=0&&chordDegree(3,0,false)<7,chordDegree(3,0,false));
  eq('C조의 G 는 5도(index 4)',chordDegree(7,0,false),4);
  eq('C조의 C 는 으뜸(index 0)',chordDegree(0,0,false),0);

  /* 10. ♪ 줄의 마디선은 **잰 마디선**을 따른다(음표 길이 합이 아니라).
     길이를 하나 일부러 틀리게 넣어도 마디는 잰 자리에서 끊겨야 한다. */
  const geo={w:1000,durSure:true,notes:[
    {name:'C4',beats:1,x:100},{name:'D4',beats:1,x:200},
    {name:'E4',beats:9,x:600},{name:'F4',beats:1,x:700}]};
  const seg=[{x0:0,x1:0.5,i0:0,cnt:2},{x0:0.5,x1:1,i0:2,cnt:2}];
  eq('잰 마디선대로 끊는다',geomMelodyLine(geo,4,{},seg),'♪ C4:1 D4:1 | E4:9 F4:1');
  ok('seg 가 없으면 예전처럼 박수로 끊는다',geomMelodyLine(geo,4,{}).indexOf('|')>=0);
  eq('조표가 음이름에 입혀진다',geomMelodyLine(geo,4,{C:'#',F:'#'},seg),'♪ C#4:1 D4:1 | E4:9 F#4:1');

  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log((fail?'✗ ':'✓ ')+'chord: '+pass+' 통과 / '+fail+' 실패');
  return {pass,fail};
}
if(typeof window!=='undefined')window.chordTest=chordTest;
