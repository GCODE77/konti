/* 이어 재생 · 긴 음 지속 · 저장된 콘티의 사진 회귀 테스트 (v64) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/live.test.js'); await m.default();

   왜 생겼나. 사용자 신고 셋이다.
     ① *"악기를 추가하거나 빼면 무조건 처음부터 새로 시작하는데, 처음부터 시작하지 말고
        기존 재생하고 있을 때 자연스럽게 이어서 하면 된다"*
        → 설정을 바꿀 때마다 `startPlay()` 를 다시 불렀다. 그건 **처음으로 되돌리기**다.
     ② *"무덤에 머물라 후렴구에서 시·라·레(사셨네) 의 레 부분이 트럼펫이 길게 부는 게
        아니라 너무 짧게 분다! 악보대로 3박 불어야 하는데"*
        → 박자 계산이 아니라 **녹음 길이**였다. GM 샘플은 한 음이 1~2초라 3박을 못 버틴다.
     ③ *"기존에 저장했던 데이터를 불러오니깐 사진은 예전꺼다!"*
        → 저장된 콘티 목록이 **글자만** 담고 있어서, 곡을 바꿔도 앞 곡의 사진이 그대로 떴다.

   ★ 이 테스트는 **사용자의 저장 데이터를 건드리지 않는다.** 목록을 통째로 스냅샷해 두고
     끝나면 그대로 되돌린다(v62에서 테스트가 사용자의 곡을 지운 적이 있다 — CLAUDE.md 38번). */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }

export default async function liveTest(){
  T.length=0; pass=0; fail=0;
  const realSave=window.scheduleSave; window.scheduleSave=()=>{};
  const keep={raw:S.raw,mode:S.mode,semis:S.semis,orig:S.orig,photos:S.photos,
              insts:P.insts,melody:P.melody,accomp:P.accomp,beats:P.beats,bpm:P.bpm};
  let songsSnap=null, lastSnap=null, testIds=[];
  const titleSnap=$('title').value;
  /* ★ 목록뿐 아니라 **자동저장(konti:last)과 제목칸도** 스냅샷한다.
     목록에서 곡을 열어 보는 검사가 제목칸을 바꾸는데, 그대로 두면 나중에
     진짜 자동저장이 돌면서 **사용자의 현재 곡 제목이 테스트 이름으로 바뀜다**
     (실제로 한 번 그래서 잡았다 — CLAUDE.md 38번 항목과 같은 종류의 사고다). */
  try{ songsSnap=localStorage.getItem('konti:songs'); lastSnap=localStorage.getItem('konti:last'); }catch(e){}
  try{
    S.orig=null; S.photos=[]; S.mode='text'; S.semis=0; P.beats=4;
    S.raw=['[Verse]',
      '♪ C4:1 D4:1 E4:1 F4:1 | G4:2 E4:1 C4:1 | E4:3 C4:1 | G4:4',
      '|[C]도레 미파 |[G]솔미 도 |[F]미 도 |[C]솔'].join('\n');
    reparse(); renderAll();

    /* ── 1) 설정을 바꿔도 **그 자리에서 이어서** 친다 ── */
    {
      const ctx=AC();
      ok('오디오를 쓸 수 있다',!!ctx);
      if(ctx){
        P.insts=['piano']; P.melody=true; P.accomp=true;
        startPlay();
        /* 오디오 시계를 앞으로 돌릴 수는 없으니, "2초 전에 시작했다"로 만들어 둔다 */
        P.t0=ctx.currentTime-2.0; P.cursorT=ctx.currentTime;
        const before=ctx.currentTime-P.t0;
        resyncPlay();
        const after=ctx.currentTime-P.t0;
        ok('이어서 친다 — 처음으로 되돌아가지 않는다 ('+before.toFixed(2)+'초 → '+after.toFixed(2)+'초)',
           Math.abs(after-before)<0.3,{before,after});
        ok('이어 칠 때도 재생은 멈추지 않는다',P.playing===true);
        /* 다음에 칠 이벤트가 **지나온 자리 뒤**여야 한다 — 앞으로 돌아가면 같은 마디를 또 친다 */
        const ev=P.evs[P.k];
        ok('다음 이벤트가 지금 자리보다 뒤에 있다',!ev||ev.at>=P.lastAt-1e-6,{at:ev&&ev.at,lastAt:P.lastAt});
        stopPlay();
      }
      /* 재생 중이 아닐 때는 아무 일도 하지 않는다(멈춘 채로 있어야 한다) */
      let threw=false;
      try{ resyncPlay(); }catch(e){ threw=true; }
      ok('멈춰 있을 때 이어 치기를 불러도 조용하다',!threw&&!P.playing);
    }

    /* ── 2) 긴 음에서 샘플이 끊기지 않는다 ── */
    {
      const ctx=AC();
      if(ctx){
        const made=[];
        const real=ctx.createBufferSource.bind(ctx);
        ctx.createBufferSource=()=>{ const n=real(); made.push(n); return n; };
        const mk=sec=>ctx.createBuffer(1,Math.max(1,Math.round(ctx.sampleRate*sec)),ctx.sampleRate);
        const shortBuf=mk(0.8), longBuf=mk(3.2);
        const t0=ctx.currentTime+0.05;
        const last=()=>made[made.length-1];
        try{
          /* 트럼펫(금관)은 지속음이다 — 3박(2.4초)을 샘플 0.8초로 채워야 한다 */
          playSampleVoice(ctx,INSTRUMENTS.brass,shortBuf,0,t0,2.4,0.0005,master);
          ok('금관은 샘플이 모자라면 되풀이해서 끝까지 분다',last().loop===true,last().loop);
          ok('되풀이 구간이 샘플 안쪽이다',
             last().loopStart>0&&last().loopEnd>last().loopStart&&last().loopEnd<=shortBuf.duration,
             [last().loopStart,last().loopEnd]);
          /* 짧은 음이면 되풀이할 이유가 없다 */
          playSampleVoice(ctx,INSTRUMENTS.brass,shortBuf,0,t0,0.4,0.0005,master);
          ok('짧은 음은 되풀이하지 않는다',last().loop!==true,last().loop);
          /* 샘플이 충분히 길면 그대로 */
          playSampleVoice(ctx,INSTRUMENTS.brass,longBuf,0,t0,2.4,0.0005,master);
          ok('샘플이 충분히 길면 그대로 쓴다',last().loop!==true,last().loop);
          /* ★ 피아노·기타처럼 **원래 사라지는 악기**는 되풀이하면 안 된다 — 그건 짧은 게 맞다 */
          playSampleVoice(ctx,INSTRUMENTS.piano,shortBuf,0,t0,2.4,0.0005,master);
          ok('피아노는 긴 음이어도 되풀이하지 않는다',last().loop!==true,last().loop);
          /* 오르간·현악·합창·패드·플루트도 지속음이다 */
          const susOK=['organ','strings','choir','pad','flute','cello'].every(k=>{
            playSampleVoice(ctx,INSTRUMENTS[k],shortBuf,0,t0,2.4,0.0005,master);
            return last().loop===true; });
          ok('오르간·현악·합창·패드·플루트·첼로도 끝까지 끈다',susOK);
        }finally{ ctx.createBufferSource=real; }
      }
    }

    /* ── 3) 저장된 콘티가 사진까지 가지고 다닌다 ── */
    {
      const pic={pages:[{url:'data:image/jpeg;base64,TEST',sys:[{t0:0,t1:1,b0:0,b1:4,w:1,n:'1단'}]}]};
      const id='s_livetest_'+Date.now(); testIds.push(id);
      ok('사진을 곡에 붙여 저장한다',saveOrig(id,pic)===true);
      const back=loadOrig(id);
      ok('저장한 사진이 그대로 돌아온다',
         !!back&&!!back.pages&&back.pages[0].url==='data:image/jpeg;base64,TEST',back);
      /* 사진이 없는 곡은 '없음'으로 저장된다 — 남겨 두면 앞 곡 사진이 따라온다 */
      saveOrig(id,null);
      ok('사진 없는 곡은 사진을 지운다',loadOrig(id)===null);
      /* 목록에서 사라진 곡의 사진은 같이 치운다 */
      saveOrig(id,pic);
      pruneOrig(load());                      // 지금 실제 목록에 이 임시 id 는 없다
      ok('목록에 없는 곡의 사진은 같이 지워진다',loadOrig(id)===null);
    }

    /* ── 4) 목록에서 곡을 열면 사진도 같이 바뀐다 ── */
    {
      const idA='s_livetestA_'+Date.now(), idB='s_livetestB_'+Date.now();
      testIds.push(idA,idB);
      const pic={pages:[{url:'data:image/jpeg;base64,PICA',sys:[{t0:0,t1:1,b0:0,b1:4,w:1,n:'1단'}]}]};
      const base=load();
      const withTest=[{id:idA,title:'테스트A(사진있음)',raw:S.raw,semis:0,at:'2026-01-01 00:00'},
                      {id:idB,title:'테스트B(사진없음)',raw:S.raw,semis:0,at:'2026-01-01 00:00'}].concat(base);
      save(withTest); saveOrig(idA,pic); saveOrig(idB,null);
      openPanel('library');
      const btns=[...document.querySelectorAll('#sheet .rowlist .load')];
      const bA=btns.find(b=>b.textContent.indexOf('테스트A')===0);
      const bB=btns.find(b=>b.textContent.indexOf('테스트B')===0);
      ok('목록에 두 곡이 보인다',!!bA&&!!bB);
      if(bA&&bB){
        ok('사진이 있는 곡은 목록에서 표시된다',bA.textContent.indexOf('사진 있음')>=0,bA.textContent);
        bA.click();
        ok('사진 있는 곡을 열면 사진이 따라온다',
           !!S.orig&&S.orig.pages[0].url==='data:image/jpeg;base64,PICA',S.orig);
        ok('가져오기에도 그 사진이 들어간다',S.photos.length===1,S.photos.length);
        openPanel('library');
        const bB2=[...document.querySelectorAll('#sheet .rowlist .load')]
          .find(b=>b.textContent.indexOf('테스트B')===0);
        bB2.click();
        /* ★ 가장 중요한 성질 — 사진이 없는 곡을 열면 **앞 곡 사진이 남으면 안 된다** */
        ok('사진 없는 곡을 열면 앞 곡 사진이 지워진다',S.orig===null,S.orig);
        ok('가져오기의 사진도 같이 비워진다',S.photos.length===0,S.photos.length);
      }
      closePanel();
    }
  }finally{
    if(P.playing)stopPlay();
    testIds.forEach(id=>{try{localStorage.removeItem('konti:orig:'+id)}catch(e){}});
    if(songsSnap!==null){try{localStorage.setItem('konti:songs',songsSnap)}catch(e){}}
    if(lastSnap!==null){try{localStorage.setItem('konti:last',lastSnap)}catch(e){}}
    $('title').value=titleSnap;
    S.raw=keep.raw; S.mode=keep.mode; S.semis=keep.semis; S.orig=keep.orig; S.photos=keep.photos;
    P.insts=keep.insts; P.melody=keep.melody; P.accomp=keep.accomp; P.beats=keep.beats; P.bpm=keep.bpm;
    window.scheduleSave=realSave;
    reparse(); renderAll(); renderToolbar();
  }
  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log('%c live.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  return {pass,fail,tests:T};
}
if(typeof window!=='undefined')window.liveTest=liveTest;
