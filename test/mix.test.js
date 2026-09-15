/* 소리 구성(멜로디·반주)·악기 선택·건반 표시 회귀 테스트 (v63) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/mix.test.js'); await m.default();

   왜 생겼나. 사용자 신고 둘이다.
     ① *"내가 멜로디만 선택했을 경우 피아노 건반도 멜로디만 나와야 한다. 반주만 선택했을 때
        반주만 표기 되어야 한다."*
        → 예전에는 **소리만 끄고 건반은 늘 켰다.** 멜로디만 골라도 반주 화음이 건반에서
          켜졌다. 건반을 보고 따라 치는 사람이 틀리게 된다 — 이 앱이 가장 하면 안 되는 일이다.
     ② *"악기 경우 무조건 1개를 선택해야 하는 게 아니라 내가 선택 해제를 다 할 수 있도록
        해야 한다. 모두 선택 해제 시 멜로디만 된다거나 … 모두 선택 해제 시에는 음악 연주가
        없겠지?"*
        → 예전에는 마지막 악기를 못 지웠고(`if(cur.length>1)`), 지워지더라도 instList 가
          몰래 피아노로 되돌려 놨다.

   ★ 지키는 성질 — 한 줄로 줄이면 **"건반은 실제로 울리는 것만 켠다"** 이다:
     - 멜로디만 → 건반에 멜로디 음만, 반주만 → 반주 음만, 둘 다 → 둘 다
     - 악기를 다 끄면 반주는 쉰다(멜로디만 남는다)
     - 악기도 멜로디도 다 끄면 아무 소리도 안 난다(그래도 화면 표시는 돈다)
     - 빈 악기 목록은 저장·복원해도 빈 채로 남는다 */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }

/* startPlay 는 schedule() 을 한 번 바로 돌려서 0.25초 앞까지 예약한다.
   그 안에 첫 박이 들어오므로, P.sound 만 보면 "무엇이 울렸나"를 알 수 있다. */
function soundKinds(){
  const s={};
  for(const sd of (P.sound||[]))s[sd.k]=(s[sd.k]||0)+1;
  return s;
}
function playOnce(){
  P.sound=[];
  startPlay();
  const k=soundKinds();
  stopPlay();
  return k;
}

export default async function mixTest(){
  T.length=0; pass=0; fail=0;
  const realSave=window.scheduleSave; window.scheduleSave=()=>{};
  const keep={raw:S.raw,mode:S.mode,semis:S.semis,orig:S.orig,
              insts:P.insts,melody:P.melody,accomp:P.accomp,beats:P.beats,
              melInst:P.melInst,playBass:P.playBass,piano:P.piano};
  try{
    S.orig=null; S.mode='staff'; S.semis=0; P.beats=4; P.playBass=false; P.piano=true;
    S.raw=['[Verse]',
      '♪ C4:1 D4:1 E4:1 F4:1 | G4:2 E4:1 C4:1',
      '|[C]도레 미파 |[G]솔미 도'].join('\n');
    reparse(); renderAll();

    /* ── 1) 악기 목록은 **빈 채로 둘 수 있다** ── */
    P.insts=[];
    ok('악기를 하나도 안 고를 수 있다',instList().length===0,instList());
    ok('악기가 없으면 반주는 꺼진 것으로 본다',!accompOn());
    P.insts=['piano'];
    ok('악기를 고르면 반주가 켜진다',accompOn());
    P.accomp=false;
    ok('소리 구성에서 반주를 끄면 악기가 있어도 꺼진 것이다',!accompOn());
    P.accomp=true;

    /* ── 2) 건반에 켜지는 것 = 실제로 울리는 것 ── */
    {
      P.insts=['piano']; P.accomp=true; P.melody=true;
      const all=playOnce();
      ok('전체: 건반에 멜로디와 반주가 둘 다 켜진다',all.m>0&&all.c>0,all);

      P.accomp=false; P.melody=true;
      const mel=playOnce();
      ok('멜로디만: 건반에 멜로디만 켜진다',mel.m>0&&!mel.c,mel);

      P.accomp=true; P.melody=false;
      const acc=playOnce();
      ok('반주만: 건반에 반주만 켜진다',acc.c>0&&!acc.m,acc);

      /* ★ 악기를 다 끄는 것은 '반주만 끄기'와 **같은 결과**여야 한다 */
      P.accomp=true; P.melody=true; P.insts=[];
      const none=playOnce();
      ok('악기를 다 끄면 건반에 멜로디만 켜진다',none.m>0&&!none.c,none);

      P.melody=false;
      const silent=playOnce();
      ok('악기도 멜로디도 끄면 건반에 아무것도 안 켜진다',!silent.m&&!silent.c,silent);
      /* 그래도 재생 자체는 돌아간다 — 마디·가사 표시를 보려고 트는 경우가 있다 */
      P.sound=[]; startPlay();
      ok('소리가 없어도 재생은 돌아간다(화면 표시용)',P.playing===true);
      stopPlay();
    }

    /* ── 3) 그리는 음역도 울릴 것만 본다 ── */
    {
      P.insts=['piano']; P.accomp=true; P.melody=true;
      P.evs=buildTimeline().evs;
      const rAll=pianoRange();
      P.accomp=false;
      const rMel=pianoRange();
      ok('멜로디만이면 건반 음역이 좁아진다 ('+(rAll.hi-rAll.lo)+'→'+(rMel.hi-rMel.lo)+')',
         (rMel.hi-rMel.lo)<=(rAll.hi-rAll.lo),{rAll,rMel});
      P.accomp=true;
    }

    /* ── 4) 악기가 없으면 반주 소리를 내지 않는다(터지지도 않는다) ── */
    {
      const ctx=AC(); let err=null;
      if(ctx){
        const ch=parseChord('C');
        try{ strike(ctx,ch,0,[],ctx.currentTime+0.3,1,4,0.7,chordVoicing(ch,0)); }
        catch(e){ err=e.message; }
      }
      ok('빈 악기 목록으로 반주를 쳐도 조용히 지나간다',!err,err);
    }

    /* ── 5) 빈 목록이 저장·복원을 견딘다 ── */
    {
      P.insts=[];
      const rec=JSON.parse(JSON.stringify({insts:P.insts,bpm:P.bpm,melody:P.melody}));
      P.insts=['organ'];                       // 일부러 흐트러뜨린 뒤 되돌린다
      if(Array.isArray(rec.insts))P.insts=rec.insts.filter(k=>INSTRUMENTS[k]);
      ok('빈 악기 목록은 다시 열어도 비어 있다',instList().length===0,instList());
    }
  }finally{
    if(P.playing)stopPlay();
    S.raw=keep.raw; S.mode=keep.mode; S.semis=keep.semis; S.orig=keep.orig;
    P.insts=keep.insts; P.melody=keep.melody; P.accomp=keep.accomp; P.beats=keep.beats;
    P.melInst=keep.melInst; P.playBass=keep.playBass; P.piano=keep.piano;
    window.scheduleSave=realSave;
    reparse(); renderAll(); renderToolbar();
  }
  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log('%c mix.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  return {pass,fail,tests:T};
}
if(typeof window!=='undefined')window.mixTest=mixTest;
