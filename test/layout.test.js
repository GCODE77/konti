/* 줄바꿈·음표 누락 검산·음표 편집 회귀 테스트 (v61) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/layout.test.js'); await m.default();

   왜 생겼나. 사용자 신고 셋을 그대로 옮긴 것이다:
     ① *"12마디는 왜 자기 혼자만 1마디가 한줄 다 차지 하는가? 원본사진 악보를 보면
        4마디씩 한줄이면 사진과 동일하게 나타내야한다"*
        → 원본 단을 따라가는 규칙과 "폭이 모자라면 잘라 넣는다" 규칙이 부딪혀,
          9·10·11 을 넣고 12가 밀려난 뒤 단 끝 강제 줄바꿈이 와서 12마디가 혼자 남았다.
     ② *"예수 내 구주. 파, 미 인데 파만 나왔다!"*
        → 한 마디에 가사 음절이 둘인데 음표가 하나. **박수 검사로는 절대 못 잡는다**
          (온음표 하나나 2분음표 둘이나 합은 똑같이 4박이다).
     ③ *"내가 추가하려는 추가버튼이 따로 없네?"*
        → 인식이 음표를 빠뜨리면 여태 고칠 방법이 아예 없었다(높이만 바꿀 수 있었다).

   ★ 지키는 성질:
     - 원본 사진의 단은 **절대 쪼개지지 않는다**(마디 하나만 남는 줄이 생기지 않는다)
     - 가사 음절보다 음표가 적은 마디를 세되, **한 절만 깨진 경우에는 세지 않는다**
     - 음표를 넣고 지우고 길이를 바꾼 것이 원문(♪ 줄)에 그대로 써진다 */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }
const eq=(name,got,want)=>ok(name+'  → '+JSON.stringify(got),
  JSON.stringify(got)===JSON.stringify(want),'got '+JSON.stringify(got)+' want '+JSON.stringify(want));

/* 사진 대신 쓸 가짜 원본 — 단마다 마디 상자를 segPer[i] 개 만든다(사진에서 잰 것과 같은 모양) */
function fakeOrig(segPer){
  const cv=document.createElement('canvas'); cv.width=40; cv.height=40;
  const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,40,40);
  const url=cv.toDataURL('image/png');
  const sys=segPer.map((K,i)=>{
    const seg=[]; for(let j=0;j<K;j++)seg.push({x0:0.06+0.92*j/K,x1:0.06+0.92*(j+1)/K});
    return {t0:i/segPer.length,t1:(i+1)/segPer.length,b0:i/segPer.length,b1:(i+1)/segPer.length,seg,n:i+1};
  });
  return {pages:[{url,sys}],total:1};
}
/* 마디 한 개치 텍스트를 만든다: 코드 하나 + 음표 nn개 + 가사 syl개 */
function bar(chord,nn,syl){
  const mel=[]; for(let i=0;i<nn;i++)mel.push('A4:'+(4/nn));
  const ly=[]; for(let i=0;i<syl;i++)ly.push('가');
  return {mel:mel.join(' '),ch:'|['+chord+']'+ly.join(' ')};
}
function build(bars){
  const mel='♪ '+bars.map(b=>b.mel).join(' | ');
  const line=bars.map(b=>b.ch).join('');
  return '[Verse]\n'+mel+'\n'+line;
}
/* 지금 화면에 그려진 줄별 마디 번호 */
function rowsOnScreen(){
  return [...document.querySelectorAll('#chart .staffline svg')]
    .map(s=>[...s.querySelectorAll('.mbox')].map(b=>+b.dataset.m));
}

export default async function layoutTest(){
  T.length=0; pass=0; fail=0;
  /* ★ 검사 중에는 자동 저장을 멈춘다. 이걸 안 했다가 **저장돼 있던 곡의 원본 사진을
     통째로 날렸다** — renderAll 이 scheduleSave 를 부르고, 검사용 가짜 곡이 그대로
     localStorage 에 덮여 쓰였다. 검사는 사용자의 데이터를 건드리면 안 된다. */
  const realSave=window.scheduleSave; window.scheduleSave=()=>{};
  const keep={raw:S.raw,orig:S.orig,mode:S.mode,verse:S.verse,semis:S.semis,sel:S.selNote,
              beats:P.beats,font:S.font,scale:S.staffScale};
  try{
    S.semis=0; S.verse=1; S.mode='staff'; P.beats=4; S.selNote=null;

    /* ── 1) 원본 단을 그대로 따라간다. 4마디짜리 단은 4마디 한 줄이다 ── */
    {
      /* 일부러 **폭을 많이 먹는** 마디를 섞는다 — v60에서 12마디가 혼자 남게 만든 조건이다
         (음표가 많고 가사가 긴 마디 뒤에 마디 하나가 더 붙는 모양). */
      const bars=[];
      for(let m=0;m<12;m++)bars.push(bar('A',(m%4===2)?8:3,(m%4===2)?8:3));
      S.raw=build(bars); S.orig=fakeOrig([4,4,4]);
      reparse(); renderAll();
      const brk=staffBreaks();
      ok('사진 단 수와 채보 마디 수가 맞아 원본을 따라간다',!!brk,brk&&[...brk]);
      const rows=rowsOnScreen();
      eq('줄마다 마디 수',rows.map(r=>r.length),[4,4,4]);
      eq('첫 줄 마디 번호',rows[0],[1,2,3,4]);
      eq('셋째 줄 마디 번호',rows[2],[9,10,11,12]);
      ok('마디 하나만 있는 줄이 없다',rows.every(r=>r.length>1),rows.map(r=>r.length));
    }

    /* ── 2) 좁은 화면에서도 단이 쪼개지지 않는다(줄여 맞추거나 가로로 넘긴다) ── */
    {
      const el=$('chart'), old=el.style.maxWidth;
      el.style.maxWidth='300px'; renderAll();
      const rows=rowsOnScreen();
      eq('좁은 화면에서도 줄마다 4마디',rows.map(r=>r.length),[4,4,4]);
      ok('폭이 모자라면 논리 폭을 넓힌다(가로 스크롤)',
         [...document.querySelectorAll('#chart .staffline svg')].every(s=>+s.getAttribute('viewBox').split(' ')[2]>0));
      el.style.maxWidth=old; renderAll();
    }

    /* ── 3) 사진이 없으면 예전대로 폭에 맞춰 넣는다(한 줄 최대 4마디) ── */
    {
      S.orig=null; reparse(); renderAll();
      const rows=rowsOnScreen();
      ok('사진이 없으면 한 줄에 4마디를 넘지 않는다',rows.every(r=>r.length<=4),rows.map(r=>r.length));
      ok('마디 수 합은 그대로다',rows.reduce((a,r)=>a+r.length,0)===12,rows);
    }

    /* ── 4) 음표 누락 검산 — 가사 음절이 음표보다 많은 마디를 센다 ── */
    {
      S.orig=null;
      /* 2마디: 앞은 음표 4·음절 4(정상), 뒤는 음표 1·음절 2(사용자가 신고한 "구 주" 모양) */
      S.raw=build([bar('A',4,4),bar('E',1,2)]);
      reparse(); renderAll();
      ok('음표가 모자란 마디를 1개 센다 (실제 '+LACK+')',LACK===1,LACK);
      ok('화면에 ⚠음표 모자람 이라고 적는다',
         /⚠음표 1개/.test($('chart').textContent),$('chart').textContent.slice(0,120));
      /* 박수는 둘 다 4박으로 맞다 — 박수 검사로는 절대 못 잡는 종류라는 증거 */
      ok('박수 경고는 뜨지 않는다(합은 맞기 때문)',!/⚠4박|⚠3박|⚠2박/.test($('chart').textContent));

      S.raw=build([bar('A',4,4),bar('E',2,2)]);
      reparse(); renderAll();
      ok('음표와 음절 수가 같으면 세지 않는다',LACK===0,LACK);

      /* 음표가 더 많은 것(이음줄로 한 음절을 여러 음에 붙인 경우)은 잘못이 아니다 */
      S.raw=build([bar('A',4,2),bar('E',4,2)]);
      reparse(); renderAll();
      ok('음표가 음절보다 많은 것은 세지 않는다',LACK===0,LACK);

      /* ★ 한 절만 깨졌을 때는 세지 않는다 — 가사는 글자 인식이라 한 절이 깨지는 일이 흔하다.
         모든 절이 한목소리로 모자랄 때만 경고해야 곧 무시하게 되지 않는다. */
      S.raw='[Verse]\n♪ A4:2 A4:2\n|[A]가 나\n2) 가 나 다 라';
      reparse(); renderAll();
      ok('한 절만 음절이 많으면 세지 않는다',LACK===0,LACK);
    }

    /* ── 5) 음표 넣기·지우기·길이 바꾸기 ── */
    {
      S.orig=null;
      S.raw='[Verse]\n♪ A4:2 A4:2\n|[A]가 나';
      reparse(); renderAll();
      const mel=blocks.find(b=>b.k==='mel');
      const n0=mel.notes.filter(n=>!n.bar).length;
      S.selNote={bi:mel._bi,ni:0}; openPanel('staff');

      $('n-ins-after').click();
      ok('뒤에 넣기: 음표가 하나 늘어난다',
         blocks.find(b=>b.k==='mel').notes.filter(n=>!n.bar).length===n0+1);
      ok('넣은 음이 원문 ♪ 줄에 써진다',(S.raw.match(/A4:/g)||[]).length===3,S.raw.split('\n')[1]);
      ok('넣은 음이 바로 골라져 있다',S.selNote&&S.selNote.ni===1,S.selNote);

      $('n-long').click();
      const b=blocks.find(x=>x.k==='mel').notes[1].beats;
      ok('길게: 악보에 쓰는 다음 길이로 간다 ('+b+')',b===3,b);
      $('n-dot').click();
      ok('점 빼기: 점이 없는 길이로 돌아온다',blocks.find(x=>x.k==='mel').notes[1].beats===2,
         blocks.find(x=>x.k==='mel').notes[1].beats);
      $('n-dot').click();
      ok('점 붙이기: 1.5배가 된다',blocks.find(x=>x.k==='mel').notes[1].beats===3,
         blocks.find(x=>x.k==='mel').notes[1].beats);

      /* 두 음을 하나로 읽은 경우 — 쪼개면 박수 합은 그대로다(마디가 어긋나지 않는다) */
      {
        const mel2=blocks.find(x=>x.k==='mel');
        const sum0=mel2.notes.filter(n=>!n.bar).reduce((a,n)=>a+n.beats,0);
        const cnt0=mel2.notes.filter(n=>!n.bar).length;
        $('n-split').click();
        const mel3=blocks.find(x=>x.k==='mel');
        const sum1=mel3.notes.filter(n=>!n.bar).reduce((a,n)=>a+n.beats,0);
        ok('쪼개기: 음표가 하나 늘어난다',mel3.notes.filter(n=>!n.bar).length===cnt0+1);
        ok('쪼개기: 박수 합이 그대로다 ('+sum0+'→'+sum1+')',Math.abs(sum0-sum1)<1e-6,[sum0,sum1]);
        ok('쪼갠 두 음은 같은 높이다',mel3.notes[1].midi===mel3.notes[2].midi,
           [mel3.notes[1],mel3.notes[2]]);
        ok('쪼갠 뒤 것이 골라져 있다',S.selNote&&S.selNote.ni===2,S.selNote);
      }

      $('n-ins-rest').click();
      ok('쉼표를 넣으면 원문에 r 로 써진다',/\br:/.test(S.raw),S.raw.split('\n')[1]);

      const before=blocks.find(x=>x.k==='mel').notes.length;
      $('n-del').click();
      ok('지우기: 하나 줄어든다',blocks.find(x=>x.k==='mel').notes.length===before-1);

      /* ★ 마지막 한 음까지 지우게 두면 안 된다 — 멜로디 줄이 통째로 사라져 되돌릴 수 없다 */
      let guard=0;
      while(blocks.find(x=>x.k==='mel').notes.filter(n=>!n.bar).length>1&&guard++<20){
        const mm=blocks.find(x=>x.k==='mel');
        S.selNote={bi:mm._bi,ni:mm.notes.findIndex(n=>!n.bar)};
        openPanel('staff'); $('n-del').click();
      }
      const mm=blocks.find(x=>x.k==='mel');
      S.selNote={bi:mm._bi,ni:mm.notes.findIndex(n=>!n.bar)};
      openPanel('staff'); $('n-del').click();
      ok('마지막 한 음은 지워지지 않는다',
         blocks.find(x=>x.k==='mel').notes.filter(n=>!n.bar).length===1,
         blocks.find(x=>x.k==='mel').notes);
      closePanel();
    }
  }finally{
    S.raw=keep.raw; S.orig=keep.orig; S.mode=keep.mode; S.verse=keep.verse; S.semis=keep.semis;
    S.selNote=keep.sel; P.beats=keep.beats; S.font=keep.font; S.staffScale=keep.scale;
    window.scheduleSave=realSave;
    reparse(); renderAll();
  }
  console.log('%c layout.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  return {pass,fail,tests:T};
}
if(typeof window!=='undefined')window.layoutTest=layoutTest;
