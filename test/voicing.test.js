/* 반주 화음·타이밍 회귀 테스트 (v62) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/voicing.test.js'); await m.default();

   왜 생겼나. 사용자 신고 두 가지다:
     ① *"다른 악기들을 넣으면 싱크가 안맞다(박자 밀리는 느낌)"*
        → 재생 엔진이 아니라 **악기의 어택**이 원인이었다. 현악 0.24초·합창 0.30초·
          패드 0.45초. 84BPM 에서 한 박이 0.71초이니 패드는 **반 박 넘게** 늦게 들린다.
          화면 표시는 예약 시각 그대로라 "표시는 맞는데 소리가 뒤따라온다"가 된다.
        → 어택만큼 **미리 시작**해서 귀에 들리는 꼭짓점이 박에 오게 한다(`leadOf`).
     ② *"악기를 추가하면 화음이 굉장히 조잡해보이는 별로이다"*
        → 원인 둘. (가) 코드를 늘 기본 위치로만 쳐서 코드마다 통째로 점프했다(성부 진행이
          없다). (나) 악기를 여럿 고르면 **전부 같은 음을 같은 옥타브로** 겹쳐 쳤다.
        → (가) 전위 중에서 앞 코드와 가장 가까운 것을 고른다(`voiceLead`).
          (나) 악기마다 맡을 자리를 나눈다(`layerOf`).

   ★ 지키는 성질:
     - 화음이 바뀔 때 **성부가 조금만 움직인다**(기본 위치로 되돌리면 두 배 넘게 움직인다)
     - 악기를 넷 골라도 **같은 음을 두 악기가 겹쳐 치지 않는다**
     - 어택이 느린 악기는 미리 시작하고, 빠른 악기는 그대로다
     - 미리 시작하는 양이 `startPlay` 가 비워 둔 0.25초를 넘지 않는다(첫 음이 잘린다) */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }

/* 기본 위치로만 쌓는 옛 방식 — 비교 기준으로 쓴다 */
function oldVoicing(chord,semis){
  let iv=[0,4,7]; for(const[re,x] of QUAL) if(re.test(chord.suffix)){iv=x;break;}
  const rp=mod(chord.root+semis);
  return iv.map(i=>60+rp+i);
}
const move=(seq)=>{ let d=0;
  for(let i=1;i<seq.length;i++)
    d+=seq[i].reduce((a,x,k)=>a+Math.abs(x-(seq[i-1][k]===undefined?x:seq[i-1][k])),0);
  return d; };

export default async function voicingTest(){
  T.length=0; pass=0; fail=0;
  const realSave=window.scheduleSave; window.scheduleSave=()=>{};
  const keep={raw:S.raw,semis:S.semis,insts:P.insts,pattern:P.pattern,beats:P.beats,orig:S.orig,mode:S.mode};
  try{
    S.orig=null; S.mode='text'; S.semis=0; P.beats=4;
    /* 흔한 찬양 진행 — C Am F G 를 두 바퀴 */
    S.raw=['[Verse]','|[C]가 |[Am]나 |[F]다 |[G]라 |[C]마 |[F]바 |[G]사 |[C]아'].join('\n');
    reparse();
    const tl=buildTimeline();
    const cev=tl.evs.filter(e=>e.type==='c');
    ok('코드 이벤트 8개',cev.length===8,cev.length);
    ok('이벤트마다 화음 자리가 실려 있다',cev.every(e=>e.v&&e.v.upper&&e.v.upper.length>=3),cev[0]);

    /* ── 1) 성부 진행 — 옛 방식보다 뚜렷하게 덜 움직여야 한다 ── */
    const now=cev.map(e=>e.v.upper), old=cev.map(e=>oldVoicing(e.chord,0));
    const mNow=move(now), mOld=move(old);
    ok('화음이 바뀔 때 덜 움직인다 ('+mNow+' < '+mOld+')',mNow<mOld*0.6,{now,old});
    ok('한 번 바뀔 때 평균 4반음 안쪽',mNow/(now.length-1)<4.5,mNow/(now.length-1));
    /* 공통음은 제자리에 남아야 한다 — C → Am 은 도·미가 그대로다 */
    const cC=now[0].filter(m=>now[1].indexOf(m)>=0);
    ok('C → Am 에서 공통음이 제자리에 남는다 ('+cC.length+'개)',cC.length>=2,{C:now[0],Am:now[1]});
    /* 반주가 멜로디 자리까지 치고 올라가지 않는다 */
    ok('화음이 G3~G5 안에 있다',now.every(v=>v[0]>=53&&v[v.length-1]<=81),now);
    /* 같은 곡을 다시 만들어도 같은 자리여야 한다 — 재생할 때마다 달리 들리면 안 된다 */
    const tl2=buildTimeline();
    ok('두 번 만들어도 같은 자리가 나온다',
       JSON.stringify(tl2.evs.filter(e=>e.type==='c').map(e=>e.v.upper))===JSON.stringify(now));

    /* ── 2) 악기마다 맡는 자리가 다르다 ── */
    {
      const v=cev[0].v;
      const four=['piano','strings','pad','choir'].map((k,ii)=>layerOf(ii,v,4));
      ok('악기가 넷이면 첫 악기가 자리를 내준다',four[0].length<v.upper.length,four);
      ok('둘째 악기는 한 옥타브 아래 두 음(빈 5도)',
         four[1].length===2&&four[1].every(m=>m<v.upper[0]),four[1]);
      ok('둘째 악기는 3도를 깔지 않는다(탁해진다)',
         four[1].every(m=>mod(m-v.rootPc)===0||mod(m-v.rootPc)===7),
         four[1].map(m=>mod(m-v.rootPc)));
      ok('셋째·넷째는 한 음씩만',four[2].length===1&&four[3].length===1,four);
      /* ★ 가장 중요한 성질 — 어느 두 악기도 같은 음을 겹쳐 치지 않는다 */
      const all=[].concat.apply([],four);
      /* ★ 넷까지는 완전히 갈린다. 다섯 이상은 화음 음이 모자라 어쩔 수 없이 겹친다 —
         그건 한계이지 버그가 아니다(그래서 넷까지만 본다). */
      ok('같은 음을 두 악기가 겹쳐 치지 않는다',new Set(all).size===all.length,all);
      /* 악기 하나면 예전 그대로 화음 전체 */
      ok('악기가 하나면 화음 전체를 그대로 친다',
         JSON.stringify(layerOf(0,v,1))===JSON.stringify(v.upper));
      ok('악기가 둘이어도 첫 악기는 화음 전체를 친다',
         JSON.stringify(layerOf(0,v,2))===JSON.stringify(v.upper));
      /* 셋일 때도 겹치지 않아야 한다 */
      const three=[0,1,2].map(ii=>layerOf(ii,v,3));
      const a3=[].concat.apply([],three);
      ok('악기 셋에서도 겹쳐 치지 않는다',new Set(a3).size===a3.length,a3);
    }

    /* ── 3) 어택이 느린 악기는 미리 시작한다 ── */
    {
      const L={};
      for(const k in INSTRUMENTS)L[k]=+leadOf(INSTRUMENTS[k]).toFixed(4);
      ok('피아노는 미리 당기지 않는다 ('+L.piano+'초)',L.piano<0.01,L.piano);
      ok('오르간도 거의 당기지 않는다 ('+L.organ+'초)',L.organ<0.02,L.organ);
      ok('현악은 미리 당긴다 ('+L.strings+'초)',L.strings>0.05,L.strings);
      ok('패드는 가장 많이 당긴다 ('+L.pad+'초)',L.pad>=L.strings&&L.pad>0.1,L);
      /* ★ startPlay 가 첫 음 앞에 0.25초를 비워 둔다 — 그보다 많이 당기면 첫 음이 잘린다 */
      ok('당기는 양이 0.18초를 넘지 않는다',Object.keys(L).every(k=>L[k]<=0.18),L);
      /* 반주로 쓰기에 어택이 너무 느린 악기가 남아 있지 않은지 */
      const slow=Object.keys(INSTRUMENTS).filter(k=>(INSTRUMENTS[k].a||0)>0.3);
      ok('어택이 0.3초를 넘는 악기가 없다',slow.length===0,slow);
      /* 당기고 남는 지연 = 실제로 늦게 들리는 양. 한 박(84BPM=0.71초)의 1/5 안이어야 한다 */
      const worst=Math.max.apply(null,Object.keys(INSTRUMENTS)
        .map(k=>(INSTRUMENTS[k].a||0)-leadOf(INSTRUMENTS[k])));
      ok('가장 느린 악기도 남는 지연이 0.14초 안쪽 ('+worst.toFixed(3)+'초)',worst<0.14,worst);
    }

    /* ── 4) 여러 악기·여러 패턴으로 예약해도 터지지 않는다 ── */
    {
      const ctx=AC();
      let err=null;
      if(ctx){
        const t0=ctx.currentTime+0.4;
        for(const pat of Object.keys(PATTERNS)){
          P.pattern=pat;
          try{ strike(ctx,cev[0].chord,0,['piano','strings','pad','choir','bass'],t0,1,4,0.7,cev[0].v); }
          catch(e){ err=pat+': '+e.message; }
        }
      }
      ok('모든 반주 패턴이 악기 다섯으로도 돈다',!err,err);
    }
  }finally{
    S.raw=keep.raw; S.semis=keep.semis; P.insts=keep.insts; P.pattern=keep.pattern;
    P.beats=keep.beats; S.orig=keep.orig; S.mode=keep.mode;
    window.scheduleSave=realSave;
    reparse(); renderAll();
  }
  console.log('%c voicing.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  return {pass,fail,tests:T};
}
if(typeof window!=='undefined')window.voicingTest=voicingTest;
