/* 사진 하이라이트와 재생의 동기 회귀 테스트(v53) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/sync.test.js'); await m.default();

   왜 이 파일이 생겼나. 사용자가 실제로 이렇게 신고했다 —
   *"진행 속도와 표시되는 부분이 전혀 다르다. 악보에서는 A코드를 가리키면서 A코드 소리가
     들려야 하는데 전혀 아니다."* 원인은 두 가지였고, 둘 다 **눈으로 보면 못 잡는 종류**다:

   (가) `sheetProgress` 가 진행도를 **곡 전체 길이(절 반복 포함)** 로 나누고 있었다.
        사진은 한 절치 악보이므로 2절짜리 곡에서 하이라이트가 정확히 **절반 속도**로 갔다.
        1절 끝(31마디)에 사진은 16마디를 가리키고 있었다.
   (나) 단이 곡에서 차지하는 구간을 `sysWeight` 로 **따로 세서 어림**하고 있었다.
        재생 엔진의 계산과 조금만 달라도 단마다 오차가 쌓인다.

   그래서 여기서 지키는 성질은 하나다:
     **모든 마디에 대해, 그 마디가 울리는 동안에는 그 마디가 표시된다.**
   재생을 실제로 돌리지 않고 `buildTimeline` 이 준 마디 시각을 그대로 되짚어 확인하므로
   빠르고, 소리 없는 환경에서도 돈다. */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){
  T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');}
}
const eq=(name,got,want)=>ok(name+'  → '+JSON.stringify(got),
  JSON.stringify(got)===JSON.stringify(want),'got '+JSON.stringify(got)+' want '+JSON.stringify(want));

/* 단(사진 한 줄) 텍스트 — 코드 개수가 단마다 다르게 해 둔다(고르게 나누면 버그가 숨는다) */
const SYS=[
  'A     E/G#   F#m7   E/G#   A     E/G#   F#m7\n내가 누려왔던 모든것들 이 내가 지나왔던 모든시간 이\n2) 내가 이땅에 태어나 사는것 어린 아이시절과 지금까 지',
  'A/C#  D      A/C#   Bm7    E     A      D/E    A\n내가 걸어왔던 모든순간 이 당연 한것아니라 은혜였 소\n2) 숨을 쉬며살며 꿈을꾸는 삶 이',
  'D/E   A      E/G#\n아침 해가뜨고 저녁의노 을\n2) 내가 하나님의 자녀로살 며',
  'A/C#  D      A/C#   Bm7    E     A\n변하 는계절의 모든순간 이 당연 한것 아니라\n2) 복음 을전할수 있는축복 이'
];

/* 사진 대신 쓸 가짜 원본 — 단마다 마디 상자를 코드 개수만큼 만든다(사진에서 잰 것과 같은 모양) */
function fakeOrig(chPer,segPer){
  const cv=document.createElement('canvas'); cv.width=40; cv.height=40;
  const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,40,40);
  const seg=K=>{ const s=[]; for(let j=0;j<K;j++){ const x0=0.06+0.92*j/K, x1=0.06+0.92*(j+1)/K;
      s.push({x0,x1,pb:[0,0.5,1],px:[x0+(x1-x0)*0.1,x0+(x1-x0)*0.55,x1]}); } return s; };
  return {approx:false,pages:[{url:cv.toDataURL('image/png'),
    /* ★ w(예전 어림값)와 b0/b1 을 일부러 **틀리게** 둔다 — 고르게 나눈 값이다.
       이렇게 해야 "타임라인에서 읽었는가"와 "어림으로 나눴는가"를 테스트가 구분한다.
       예전 방식으로 되돌아가면 아래 단 구간 기대값이 곧바로 어긋난다. */
    sys:chPer.map((c,i)=>({t0:i/chPer.length,t1:(i+1)/chPer.length,b0:i/chPer.length,b1:(i+1)/chPer.length,
                           w:10,ch:c,n:(i+1)+'단',seg:seg(segPer[i])}))}]};
}

/* 지금 화면 상태에서 "진행도 p 면 몇째 마디를 표시하는가" — paintSheet 와 같은 규칙 */
function shownAt(p){
  for(const b of document.querySelectorAll('#chart .origsys')){
    const b0=+b.dataset.b0, b1=+b.dataset.b1;
    if(!(p>=b0&&p<b1))continue;
    const f=(b1>b0)?(p-b0)/(b1-b0):0;
    for(const bx of b.querySelectorAll('.origbar')){
      if(bx.dataset.f0===undefined)return null;
      if(f>=+bx.dataset.f0&&f<+bx.dataset.f1)return +bx.dataset.mn;
    }
    return null;
  }
  return null;
}

export default async function syncTest(){
  T.length=0; pass=0; fail=0;
  /* 검사 중에는 자동 저장을 멈춘다 — 가짜 곡이 사용자의 저장본을 덮어쓰면 안 된다 */
  const realSave=window.scheduleSave; window.scheduleSave=()=>{};
  const keep={raw:S.raw,orig:S.orig,mode:S.mode,verse:S.verse,semis:S.semis,beats:P.beats,bpm:P.bpm};
  try{
    S.raw=SYS.join('\n\n'); S.semis=0; S.verse=1; P.beats=4; P.bpm=90; reparse();

    /* 1. 단별 코드 개수의 합이 전역 코드 개수와 같아야 짝지을 수 있다 */
    const chPer=SYS.map(t=>sysChords(t));
    const nch=blocks.reduce((a,b)=>a+(b.k==='pairs'?b.pairs.filter(p=>p.chord).length:0),0);
    eq('단별 코드 개수의 합 = 전역 코드 개수',chPer.reduce((a,b)=>a+b,0),nch);
    eq('단별 코드 개수',chPer,[7,8,3,6]);

    const tl=buildTimeline();
    eq('타임라인 마디 수 = 코드 수(마디선 없는 차트)',tl.bars.length,nch);
    ok('마디마다 첫 코드 번호가 붙어 있다',tl.bars.every((b,i)=>b.idx0===i),tl.bars.map(b=>b.idx0));

    /* 2. 한 절 길이 = 전체 ÷ 절 수. (사진은 한 절치다) */
    eq('절 수',maxVerse(),2);
    ok('passSeconds = songSeconds / 절 수',
       Math.abs(passSeconds()*maxVerse()-songSeconds())<1e-6,[passSeconds(),songSeconds()]);

    /* 3. 단 구간을 타임라인에서 그대로 읽는다 */
    S.orig=fakeOrig(chPer,chPer); S.mode='sheet'; renderAll();
    const EB=origBeats(S.orig);
    ok('origBeats 가 단 수만큼 나온다',!!EB&&EB.length===4,EB&&EB.length);
    /* EB 가 null 이면(=예전 어림 방식으로 되돌아갔다면) 아래 셋이 한꺼번에 실패한다.
       테스트가 터지지 않고 '실패'로 보고하도록 null 을 그대로 받아 비교한다. */
    eq('단 구간이 마디 개수 비율과 맞는다',
       EB?EB.map(e=>Math.round(e.b0*nch)):null,[0,7,15,18]);
    eq('마지막 단은 곡 끝에서 끝난다',EB?+EB[EB.length-1].b1.toFixed(6):null,1);
    eq('단마다 제 마디를 갖는다',EB?EB.map(e=>e.bars.length):null,chPer);

    /* ★ 핵심 성질 — 모든 마디에 대해, 그 마디가 울리는 동안 그 마디가 표시된다.
       마디 안에서 앞·가운데·끝의 세 지점을 본다(경계에서 한 칸 밀리는 실수를 잡으려면
       가운데만 봐서는 안 된다). */
    let bad=[];
    tl.bars.forEach((b,i)=>{
      [0.02,0.5,0.97].forEach(u=>{
        const p=(b.at+b.beats*u)/tl.total;
        const got=shownAt(p);
        if(got!==i+1)bad.push((i+1)+'@'+u+'→'+got);
      });
    });
    eq('모든 마디가 제 시각에 표시된다(어긋난 곳)',bad,[]);

    /* ★ 한 절 안에서의 자리여야 한다(v53에서 고친 버그).
       2절짜리 곡에서 곡 전체 길이로 나누면 1절이 끝날 때 사진이 아직 한가운데를 가리킨다.
       여기서 보는 것: **1절이 끝나는 순간 사진은 처음으로 돌아간다.** */
    const passS=passSeconds(), songS=songSeconds();
    eq('시작 진행도',+sheetProgressAt(0).toFixed(6),0);
    eq('1절 한가운데',+sheetProgressAt(passS*0.5).toFixed(6),0.5);
    eq('1절 끝나는 순간 사진은 처음으로',+sheetProgressAt(passS).toFixed(6),0);
    eq('2절 한가운데도 악보 한가운데',+sheetProgressAt(passS*1.5).toFixed(6),0.5);
    ok('곡 전체 길이로 나누지 않는다',Math.abs(sheetProgressAt(songS*0.5)-0.5)>0.4,
       sheetProgressAt(songS*0.5));
    eq('1절 끝에 마지막 마디를 가리킨다',shownAt(sheetProgressAt(passS*0.999)),nch);

    /* 4. 되돌리기 — 사진에서 누른 자리가 그 마디로 간다 */
    const box=document.querySelectorAll('#chart .origsys')[1];
    const bars=box.querySelectorAll('.origbar');
    let backBad=[];
    bars.forEach((bx,j)=>{
      const xm=(+bx.dataset.x0+ +bx.dataset.x1)/2;
      const f=sysFrac(box,xm);
      const p=+box.dataset.b0+(+box.dataset.b1-+box.dataset.b0)*f;
      const got=shownAt(p);
      if(got!==+bx.dataset.mn)backBad.push(bx.dataset.mn+'→'+got);
    });
    eq('마디를 누르면 그 마디로 간다(어긋난 곳)',backBad,[]);

    /* 5. 안전한 실패 — 코드 개수가 안 맞거나(사용자가 텍스트를 고쳤다) 아예 없으면
       (이 버전 전에 저장한 곡) '정확한 길'을 쓰지 않는다. 대신 어림 경계를 **진짜 마디선에
       붙여** 돌려준다 — 어느 마디에서 단이 바뀌는지는 어림이지만, 단이 바뀌는 순간은
       언제나 마디 첫 박이다. 어긋난 채로 마디를 1:1 로 짝짓는 일만은 하지 않는다. */
    const WB=origBeats(fakeOrig([7,8,3,99],chPer));
    ok('코드 개수가 안 맞으면 정확한 길을 쓰지 않는다',!!WB&&WB.every(e=>!e.exact),WB);
    const noch=fakeOrig(chPer,chPer);
    delete noch.pages[0].sys[2].ch;
    const NB=origBeats(noch);
    ok('옛 저장본(ch 없음)도 구간은 돌려준다',!!NB&&NB.length===4&&NB.every(e=>!e.exact));
    ok('옛 저장본의 단 경계는 마디 첫 박에 붙는다',
       !!NB&&NB.every(e=>e.b0===0||tl.bars.some(b=>Math.abs(b.at/tl.total-e.b0)<1e-9)),
       NB&&NB.map(e=>+(e.b0*tl.total).toFixed(3)));
    const XB=origBeats(S.orig);
    ok('정확한 길일 때는 exact 가 참',!!XB&&XB.every(e=>e.exact),XB);

    /* 6. 코드가 없는 단(멜로디만)은 앞뒤 사이를 나눠 갖는다 — 구간이 무너지지 않아야 한다 */
    const gapOrig=fakeOrig([7,0,11,6],[7,2,11,6]);
    const GB=origBeats(gapOrig);
    ok('코드 없는 단이 있어도 구간이 이어진다',
       !!GB&&GB.every((e,i)=>e.b1>=e.b0&&(i===0||Math.abs(e.b0-GB[i-1].b1)<1e-9)),
       GB&&GB.map(e=>[+e.b0.toFixed(3),+e.b1.toFixed(3)]));

    /* 7. 잰 음높이를 믿어도 되는지 판단 (geomSane) */
    const mk=a=>a.map(s=>({step:s}));
    ok('순차 진행은 믿는다',geomSane(mk([0,1,2,3,4,3,2,1])));
    ok('5도 도약이 섞여도 믿는다',geomSane(mk([0,4,2,6,4,2,0])));
    ok('제멋대로 튀면 안 믿는다',!geomSane(mk([0,14,-9,12,-7,15,1])));
    ok('음이 3개 미만이면 안 믿는다',!geomSane(mk([0,2])));

    /* 8. 채보한 오선보 위의 재생 위치 표시 (v60).
       사용자 요청: *"원본사진으로 안볼때도 지금 진행하는 위치 사진처럼 악보에 표기바람"*.
       사진 하이라이트와 **똑같은 성질**을 지켜야 한다 —
         (가) 재생 엔진이 소리를 예약한 그 음이 화면에서 켜진다(따로 세지 않는다)
         (나) 켜진 음은 **켜진 마디 안에** 있다(마디 음영과 음 표시가 절대 어긋나지 않는다)
       ★ 이 검사가 실제로 깨지는지 확인해 둘 것 — 음표 상자를 반 마디만 밀어도 (나)가 터진다. */
    S.raw=['[Verse]',
      '♪ C4:1 D4:1 E4:1 F4:1 | G4:2 E4:1 C4:1 | D4:1.5 E4:0.5 F4:2 | G4:4',
      '|[C]도레 미파 |[G]솔미 도 |[F]레미 파 |[C]솔'].join('\n');
    S.mode='staff'; S.verse=1; S.semis=0; P.beats=4;
    reparse(); renderAll();
    const tl8=buildTimeline();
    const melEv=tl8.evs.filter(e=>e.type==='m');
    ok('멜로디 이벤트에 음표 자리(bi/ni)가 실려 있다',
       melEv.length>0&&melEv.every(e=>e.bi!==undefined&&e.ni!==undefined),
       melEv.slice(0,3));
    ok('음표마다 표시용 상자가 하나씩 있다 ('+document.querySelectorAll('#chart .nowbox').length+'/'+melEv.length+')',
       document.querySelectorAll('#chart .nowbox').length===melEv.length);
    ok('마디마다 음영 상자가 있다 ('+document.querySelectorAll('#chart .mbox').length+')',
       document.querySelectorAll('#chart .mbox').length===4);
    let bad8=[];
    for(const ev of melEv){
      markNote({bi:ev.bi,ni:ev.ni});
      const nb=document.querySelector('#chart .nowbox.on'), mb=document.querySelector('#chart .mbox.on');
      if(!nb||!mb||nb.ownerSVGElement!==mb.ownerSVGElement){ bad8.push([ev.bi,ev.ni,'없음']); continue; }
      const x=+nb.getAttribute('x')+(+nb.getAttribute('width'))/2;
      const bx=+mb.getAttribute('x'), bw=+mb.getAttribute('width');
      if(!(x>=bx-1&&x<=bx+bw+1))bad8.push([ev.bi,ev.ni,x,bx,bw]);
      /* 켜진 음은 **하나뿐**이어야 한다 — 남아 있으면 지나온 음이 계속 밝다 */
      if(document.querySelectorAll('#chart .nowbox.on').length!==1)bad8.push([ev.bi,ev.ni,'여럿']);
    }
    eq('모든 음이 자기 마디 안에서 켜진다(어긋난 것)',bad8,[]);
    clearStaffNow();
    ok('멈추면 표시가 전부 꺼진다',
       document.querySelectorAll('#chart .nowbox.on,#chart .mbox.on').length===0);
  }finally{
    S.raw=keep.raw; S.orig=keep.orig; S.mode=keep.mode; S.verse=keep.verse; S.semis=keep.semis;
    P.beats=keep.beats; P.bpm=keep.bpm;
    window.scheduleSave=realSave;
    reparse(); renderAll();
  }
  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log((fail?'✗ ':'✓ ')+'sync: '+pass+' 통과 / '+fail+' 실패');
  return {pass,fail};
}
if(typeof window!=='undefined')window.syncTest=syncTest;
