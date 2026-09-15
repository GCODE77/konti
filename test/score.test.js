/* 인쇄 악보 한 단을 통째로 읽는 회귀 테스트 (v57) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/score.test.js'); await m.default();

   왜 생겼나. v57 에서 실제 찬송가 한 쪽(966×1366, 오선 간격 10px)을 넣었더니
   눈에 보이는 것과 전혀 다른 결과가 나왔고, 원인이 전부 **한 장면에만 나타나는 것**이었다:
     ① 스캔본은 오선이 **연한 회색으로 번져** 굵은 띠가 된다 → 그 띠가 2분·온음표의
        구멍을 반으로 쪼개 속 빈 머리가 통째로 사라졌다(한 단 11음 중 4음).
     ② 오선 아래쪽 음표의 **위 기둥**은 머리까지 합치면 오선을 위아래로 다 넘는다
        → 기둥이 마디선으로 잡혀 20마디가 29마디가 됐다.
     ③ 음표 **바로 위에 찍힌 코드 글자**가 그 칸의 대표로 뽑혀 진짜 음표를 밀어냈다.
     ④ 기둥 자체가 번져 굵어져서 4분음표가 32분음표로 읽혔다(한 단 합계 16박 → 6.75박).
   합성 그림은 선이 새까맣고 얇아서 이 중 무엇도 재현되지 않는다. 그래서 이 테스트는
   **일부러 스캔본처럼** 그린다: 오선을 연한 회색 굵은 선으로, 낮은 해상도로, JPEG 로.

   ★ 지키는 성질(하나라도 깨지면 사용자가 바로 알아챈다):
     - 그린 음표 수를 그대로 찾는다
     - 마디선 수가 그린 것과 같다(= 마디 수가 악보와 같다)
     - 마디마다 길이 합이 박자표와 같다(= 사진과 소리가 어긋날 수 없다)
     - 조표 개수를 세어 조를 맞춘다 */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }

/* 스캔본 흉내로 한 단을 그린다.
   sp=10 은 실제 사용자 파일에서 잰 값이다(966px 폭의 찬송가 한 쪽).
   오선은 **연한 회색(#9a9a9a) 2.2px** — 이게 이진화되면 6~7px 짜리 띠가 된다. */
export function drawScan(o){
  o=o||{};
  const sp=o.sp||10, W=o.W||960, H=Math.round(sp*16);
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  const top=Math.round(sp*5), bot=top+4*sp;
  g.strokeStyle=o.lineColor||'#a0a0a0'; g.lineWidth=sp*0.28;
  const xEnd=W-sp*4;
  for(let k=0;k<5;k++){ const y=top+k*sp; g.beginPath(); g.moveTo(sp*2,y); g.lineTo(xEnd,y); g.stroke(); }
  /* 자리표 — 실제처럼 **넓은** 모양으로. 얇은 세로 막대로 그리면 그건 자리표가 아니라
     마디선이고, 그러면 검출기가 아니라 그림이 틀린 게 된다. */
  g.strokeStyle='#000'; g.lineWidth=sp*0.3;
  g.beginPath(); g.moveTo(sp*4,top-sp*1.3); g.lineTo(sp*4,bot+sp*1.3); g.stroke();
  g.lineWidth=sp*0.26;
  g.beginPath(); g.arc(sp*4,top+sp*0.6,sp*0.9,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(sp*3.7,bot-sp*0.2,sp*0.7,0,Math.PI*2); g.stroke();
  /* 조표 — # 을 sharps 개 */
  const sharps=o.sharps||0;
  const SHY=[0,1.5,-0.5,1,2.5,2,3.5];        // 높은음자리표 #의 자리(칸 단위, top 기준)
  for(let i=0;i<sharps;i++){
    const x=sp*6+i*sp*1.1, y=top+SHY[i]*sp;
    g.lineWidth=sp*0.14;
    g.beginPath(); g.moveTo(x-sp*0.14,y-sp*1.1); g.lineTo(x-sp*0.14,y+sp*1.0); g.stroke();
    g.beginPath(); g.moveTo(x+sp*0.22,y-sp*1.2); g.lineTo(x+sp*0.22,y+sp*0.9); g.stroke();
    g.lineWidth=sp*0.2;
    g.beginPath(); g.moveTo(x-sp*0.42,y-sp*0.15); g.lineTo(x+sp*0.5,y-sp*0.4); g.stroke();
    g.beginPath(); g.moveTo(x-sp*0.42,y+sp*0.5);  g.lineTo(x+sp*0.5,y+sp*0.25); g.stroke();
  }
  /* 음표 — bars: [[{st,dur}...], ...] */
  const x0=sp*(6+sharps*1.2+3), x1=xEnd;
  const bars=o.bars;
  const n=bars.reduce((a,b)=>a+b.length,0);
  const dx=(x1-x0)/(n+1);
  let i=0;
  const barX=[];
  bars.forEach((bar,bi)=>{
    bar.forEach(nt=>{
      const x=x0+dx*(i+0.5), cy=bot-nt.st*sp/2, hollow=nt.dur>=2;
      /* ★ 덧줄 — 오선 밖 음은 이게 있어야 음표다(검출기도 그 규칙으로 가린다).
         v57 이전에는 관심 창이 오선 아래 1.6칸까지라 **덧줄 음의 머리가 창 밖으로 잘렸다.**
         찬송가 멜로디는 으뜸음 아래로 자주 내려가므로 반드시 그려 넣어야 하는 모양이다. */
      if(nt.st<=-2){
        g.strokeStyle='#000'; g.lineWidth=sp*0.16;
        for(let L=-2;L>=nt.st;L-=2){ const ly=bot-L*sp/2;
          g.beginPath(); g.moveTo(x-sp*0.85,ly); g.lineTo(x+sp*0.85,ly); g.stroke(); }
      }
      g.save(); g.translate(x,cy); g.rotate(-0.3);
      g.beginPath(); g.ellipse(0,0,sp*0.65,sp*0.46,0,0,Math.PI*2);
      if(hollow){ g.lineWidth=sp*(nt.dur>=4?0.3:0.2); g.strokeStyle='#000'; g.stroke(); }
      else { g.fillStyle='#000'; g.fill(); }
      g.restore();
      if(nt.dur<4){
        /* ★ 낮은 음은 기둥이 위로 — 이게 마디선으로 오인되던 모양이다 */
        /* ★ 위로 뻗는 기둥은 **4.1칸**으로 그린다. 실제 조판에서 낮은 음의 기둥은 가운데
           줄까지 끌어올리므로 오선(4칸)을 위아래로 다 넘는데, 바로 그 모양이 v57 이전에
           마디선으로 오인되던 것이다(20마디가 29마디로 늘어났다). 3.5칸으로 그리면 이
           버그가 재현되지 않는다 — 실측으로 확인하고 고른 값이다. */
        const up=nt.st<4, sx=up?x+sp*0.6:x-sp*0.6;
        g.strokeStyle='#000'; g.lineWidth=sp*0.12;
        g.beginPath(); g.moveTo(sx,cy); g.lineTo(sx,up?cy-sp*4.1:cy+sp*3.5); g.stroke();
        nt._sx=sx; nt._tip=up?cy-sp*4.1:cy+sp*3.5;
      }
      i++;
    });
    /* ★ 빔 — 이웃한 두 기둥 끝을 잇는다. 빔과 두 기둥이 둘러싼 **흰 틈**이 v57 이전에
       속 빈 음표 머리로 잡혀, 바로 아래 진짜 음표를 밀어냈다. 이 모양이 없으면 재현되지 않는다. */
    for(let k=0;k+1<bar.length;k++){
      if(!bar[k].beam||!bar[k+1].beam)continue;
      if(bar[k]._sx===undefined||bar[k+1]._sx===undefined)continue;
      g.strokeStyle='#000'; g.lineWidth=sp*0.32;
      g.beginPath(); g.moveTo(bar[k]._sx,bar[k]._tip); g.lineTo(bar[k+1]._sx,bar[k+1]._tip); g.stroke();
    }
    /* 마디선 */
    const bx=(bi+1<bars.length)?x0+dx*(i)+dx*0.0:x1;
    g.strokeStyle='#000'; g.lineWidth=sp*0.13;
    g.beginPath(); g.moveTo(bx,top); g.lineTo(bx,bot); g.stroke();
    barX.push(bx);
  });
  /* ★ 오선 **바로 위**에 코드 글자(빨강) — 음표 칸을 가로채던 모양이다 */
  if(o.chords)o.chords.forEach((t,bi)=>{
    if(!t)return;
    g.fillStyle='#c11'; g.font='700 '+Math.round(sp*1.6)+'px serif';
    g.fillText(t,(bi?barX[bi-1]:x0)+sp*0.4,top-sp*0.8);
  });
  /* 오선 아래 가사(검정) */
  /* ★ lyricY = 가사 글자의 밑줄 자리(칸 단위, 오선 아래쪽 기준).
     찬송가처럼 가사를 **바짝 붙여** 짜는 조판이 흔하다. 그럴 때 오선 아래
     덧줄 음의 **기둥 반대쪽이 가사 글자와 겹친다** — v64 전에는 그 글자 때문에
     기둥을 부정해서 그 음을 통째로 버렸다(실측: 참 반가운 성도여 1단에서 3음). */
  if(o.lyric){ g.fillStyle='#000'; g.font=Math.round(sp*1.3)+'px sans-serif';
    for(let k=0;k<n;k++)g.fillText('가',x0+dx*(k+0.3),bot+sp*(o.lyricY||2.2)); }
  return c.toDataURL('image/jpeg',0.65);   // JPEG 손실까지 넣는다
}

export default async function scoreTest(){
  T.length=0; pass=0; fail=0;

  /* 1) 스캔본 한 단: 2분음표가 **줄 위**에 놓이고, 낮은 음은 기둥이 위로 뻗는다 */
  const BARS=[
    [{st:0,dur:2},{st:2,dur:1},{st:4,dur:1}],     // 줄 위 2분음표 + 4분음표 둘
    [{st:4,dur:1},{st:2,dur:1},{st:0,dur:1},{st:1,dur:1,beam:true},{st:0,dur:1,beam:true}],  // ★ 빔으로 묶은 둘
    [{st:-4,dur:1},{st:-2,dur:1},{st:0,dur:1},{st:3,dur:1}],   // ★ 덧줄 음(오선 아래)
    [{st:6,dur:2},{st:4,dur:4}]                    // ★ 온음표(기둥 없음, 두꺼운 테두리)
  ];
  const nNote=BARS.reduce((a,b)=>a+b.length,0);
  const url=drawScan({sp:10,W:960,sharps:3,bars:BARS,
                      chords:['A','E','E7','A'],lyric:true});
  let geo=null;
  try{
    const parts=await splitSystems(url);
    geo=await staffGeom((parts&&parts.length===1)?parts[0].url:url);
  }catch(e){ console.error(e); }
  ok('스캔본 한 단에서 오선을 잰다',!!geo,geo);
  if(geo){
    ok('음표를 다 찾는다 ('+geo.notes.length+'/'+nNote+')',geo.notes.length===nNote,
       geo.notes.map(n=>n.name+':'+n.beats));
    /* ★ 개수만 세면 안 된다. 관심 창이 좁으면 **덧줄 음의 머리가 잘려** 개수는 맞는데
       가운데가 위로 밀려 한 칸 높게 읽힌다(실측: -4 가 -3 으로). 자리까지 봐야 잡힌다. */
    const want=[].concat.apply([],BARS).map(n=>n.st).join(',');
    const got=geo.notes.map(n=>n.step).join(',');
    ok('음높이(줄·칸)가 그린 것과 같다 ('+got+')',got===want,{want,got});
    /* ★ 기둥이 마디선으로 잡히면 여기서 터진다 — 그린 마디선은 4개(끝 포함)다 */
    ok('마디선을 4개만 찾는다 (실제 '+geo.bars.length+')',geo.bars.length===4,
       geo.bars.map(b=>+(b/geo.w).toFixed(3)));
    ok('조표 #3개를 센다 (실제 '+JSON.stringify(geo.keySig)+')',
       !!geo.keySig&&geo.keySig.n===3&&!geo.keySig.flat,geo.keySig);
    /* 마디마다 4박이 되는가 — 사진·소리 싱크의 근거 */
    const og=origGeomOf(geo);
    ok('마디를 4개로 나눈다 (실제 '+(og&&og.seg?og.seg.length:0)+')',!!(og&&og.seg&&og.seg.length===4),
       og&&og.seg&&og.seg.map(s=>s.cnt));
    if(og&&og.seg){
      fitBeatsToBars(geo,og.seg,4);
      const sums=og.seg.map(sg=>{let s=0;for(let j=sg.i0;j<sg.i0+sg.cnt;j++)s+=geo.notes[j].beats;return +s.toFixed(3);});
      ok('마디마다 길이 합이 4박이다 ('+sums.join(',')+')',sums.every(v=>Math.abs(v-4)<0.02),sums);
    }
  }

  /* 2) 마디 길이 맞추기 — 잰 값이 엉망이어도 박자표에 맞춰 놓는다 */
  ok('맞는 마디는 그대로 둔다',JSON.stringify(fitBarBeats([2,1,1],4))==='[2,1,1]',fitBarBeats([2,1,1],4));
  ok('합이 모자라면 늘려 맞춘다',Math.abs(fitBarBeats([0.5,0.25,0.25],4).reduce((a,b)=>a+b,0)-4)<1e-6,
     fitBarBeats([0.5,0.25,0.25],4));
  ok('간격 비율 1.77:1.16:1.06 → 2,1,1',JSON.stringify(fitBarBeats([1.77,1.16,1.06],4))==='[2,1,1]',
     fitBarBeats([1.77,1.16,1.06],4));
  ok('간격 비율 1.19:1.15:1.66 → 1,1,2',JSON.stringify(fitBarBeats([1.19,1.15,1.66],4))==='[1,1,2]',
     fitBarBeats([1.19,1.15,1.66],4));
  ok('못갖춘마디로 보이면 손대지 않는다',JSON.stringify(fitBarBeats([0.25],4))==='[0.25]',fitBarBeats([0.25],4));

  /* ★★ 2-2) **오선 아래 덧줄 음 + 바로 밑에 붙은 가사** (v64).
     사용자 악보(참 반가운 성도여)에서 찾은 버그다. 덧줄 음은 기둥이 **위로** 뻗는데,
     기둥을 확인할 때 "반대쪽(아래)에 잉크가 없어야 한다"를 오선 **밖까지** 봤다.
     그 자리에 가사 글자가 있으면 기둥이 부정되고, 그러면 "속도 안 비었고 기둥도 없다"로
     그 음이 **통째로 사라졌다**(실측: 사진 1단에서 10개만 찾고 3개를 버렸다).
     ★ 검사 범위를 **오선 안쪽으로** 줌여서 고쳤다 — 걸러내려는 상대(마디선·조표)는
       전부 오선 안에 산다. */
  {
    const LB=[[{st:-2,dur:1},{st:-1,dur:1},{st:0,dur:1},{st:2,dur:1}],
              [{st:-3,dur:1},{st:-1,dur:2},{st:1,dur:1}]];
    /* ★ 속 빈 머리를 **덧줄 위(짝수 자리)**에 두지 않는다 — 거기는 덧줄이 구멍을
       반으로 가르지르기 때문에 아직 못 찾는다(알고 있는 한계 — CLAUDE.md 45번 항목).
       여기서 보려는 것은 '가사 글자 때문에 기둥을 부정하는가'라 칸 자리(-1)에 둔다. */
    const nL=LB.reduce((a,b)=>a+b.length,0);
    const urlL=drawScan({sp:14,W:1200,sharps:3,bars:LB,lyric:true,lyricY:3.2});
    let gL=null;
    try{ const ps=await splitSystems(urlL); gL=await staffGeom((ps&&ps.length===1)?ps[0].url:urlL); }catch(e){}
    ok('가사가 바짝 붙어도 덧줄 음을 다 찾는다 ('+(gL?gL.notes.length:0)+'/'+nL+')',
       !!gL&&gL.notes.length===nL,gL&&gL.notes.map(n=>n.name+':'+n.beats));
    if(gL&&gL.notes.length===nL){
      const wantL=[].concat.apply([],LB).map(n=>n.st).join(',');
      ok('그 음들의 자리도 맞다 ('+gL.notes.map(n=>n.step).join(',')+')',
         gL.notes.map(n=>n.step).join(',')===wantL,wantL);
    }
  }

  /* ★★ 2-3) **단 끝에 걸친 조각 마디는 늘리지 않는다** (v64).
     못갖춘마디로 시작하는 악보는 줄바꿈이 마디 한가운데에서 일어난다 —
     그런 조각을 4박으로 늘리면 압운표 한 음이 온음표가 된다(실측: E4:1 → E4:4). */
  ok('단 끝 조각(한 음 1박)은 그대로 둔다',
     JSON.stringify(fitBarBeats([1],4,null,true,true))==='[1]',fitBarBeats([1],4,null,true,true));
  ok('단 끝 조각(2박+1박=3박)도 그대로 둔다',
     JSON.stringify(fitBarBeats([2,1],4,null,true,true))==='[2,1]',fitBarBeats([2,1],4,null,true,true));
  ok('가운데 마디는 여전히 4박으로 맞춘다',
     Math.abs(fitBarBeats([2,1],4,null,true,false).reduce((a,b)=>a+b,0)-4)<1e-6,
     fitBarBeats([2,1],4,null,true,false));
  ok('한 박만 모자라는 것은 조각이 아니라 잘못 잴 마디다(3.5박 → 4박)',
     Math.abs(fitBarBeats([2,1,0.5],4,null,true,true).reduce((a,b)=>a+b,0)-4)<1e-6,
     fitBarBeats([2,1,0.5],4,null,true,true));
  ok('잴 값이 믿을 만하지 않으면(durSure=false) 조각이라도 맞춘다',
     Math.abs(fitBarBeats([1],4,null,false,true).reduce((a,b)=>a+b,0)-4)<1e-6,
     fitBarBeats([1],4,null,false,true));

  /* 3) 코드 글자 오인 되돌리기 — 실제 Tesseract 출력에서 본 것들만 */
  const C=[['Fim','F#m'],['B71','B7'],['B87','B7'],['EsusdE','Esus4,E'],['EsusiE','Esus4,E'],
           ['A','A'],['D','D'],['A2','A2'],['Esus4','Esus4'],['Bb','Bb'],['G/B','G/B']];
  C.forEach(([raw,want])=>{
    const got=splitChordRun(raw).join(',');
    ok('코드 "'+raw+'" → '+want+' (실제 '+got+')',got===want,got);
  });
  ok('코드가 아닌 것은 버린다',splitChordRun('가나').length===0,splitChordRun('가나'));

  /* 4) 리듬 스냅(v59) — 점음표를 살리고, 악보에 없는 길이를 내보내지 않는다.
     여기 쓰는 숫자는 전부 실제 찬송가 한 쪽(966×1366)에서 쟴 값이다.
     ① 잰 길이는 점을 못 보고 간격은 점을 본다 — 간격 쪽이 이긴다.
     ② 합이 맞는 조합이 여럿이면 **박자리**가 가른다(1박은 정박에서 시작한다). */
  {
    const S1=[0.5,0.5,0.5,0.5,0.5,0.5], G1=[0.946,0.748,0.388,0.953,0.748,0.218];
    const r1=fitBarBeats(S1,4,G1,false);
    ok('간격으로 점8분+16분을 되찾는다 (실제 '+r1.join(' ')+')',
       JSON.stringify(r1)==='[1,0.75,0.25,1,0.75,0.25]',r1);

    /* 잰 길이가 3·0.5·0.5 — **합은 우연히 4박**이라 예전에는 그대로 나갔다.
       잰 길이가 믿을 만하지 않을 때(durSure=false)는 간격이 고쳐야 한다. */
    const r2=fitBarBeats([3,0.5,0.5],4,[3.20,0.63,0.17],false);
    ok('점을 놓쳐 합만 맞는 마디도 고친다 (실제 '+r2.join(' ')+')',
       JSON.stringify(r2)==='[3,0.75,0.25]',r2);
    const r3=fitBarBeats([3,0.5,0.5],4,[3.20,0.63,0.17],true);
    ok('잰 길이가 스스로 맞으면(durSure) 그것을 믿는다',
       JSON.stringify(r3)==='[3,0.5,0.5]',r3);

    /* 옆에 놓고 보면 합은 둘 다 4박이지만, 0.75가 반박자리에서 시작하는 쪽은 조판이 아니다 */
    const r4=snapBeats([0.946,0.748,0.388,0.953,0.748,0.218],4);
    ok('박자리 규칙을 지킨다 (실제 '+(r4||[]).join(' ')+')',
       !!r4&&JSON.stringify(r4)==='[1,0.75,0.25,1,0.75,0.25]',r4);

    /* 어떤 경우에도 악보에 쓸 수 없는 길이(0.875·0.375·2.5)를 내보내지 않는다 */
    const odd=fitBarBeats([0.5,0.25,0.125,1,0.375,1],4,null,false);
    ok('악보에 없는 길이를 만들지 않는다 (실제 '+odd.join(' ')+')',
       odd.every(v=>BEAT_GRID.some(g=>Math.abs(g-v)<1e-9))&&Math.abs(odd.reduce((a,b)=>a+b,0)-4)<1e-6,odd);
  }

  /* 4-2) 간격 → 길이: **고정분을 빼고** 나눠야 한다(v59).
     조판 규칙대로 음표 자리를 직접 만들어 fitBeatsToBars 에 넣는다 — 검출기를 거치지
     않으므로 이 검사는 오로지 ‘간격을 길이로 되짚는 산수’만 본다.
     그릴 쌇의 고정분은 머리 폭(1.3칸)+여백 = **1.45칸**로 두었다. 코드가 쓰는 1.05칸과
     일부러 다르게 잡은 것이다 — 같은 숫자를 쓰면 내 모형을 내가 다시 확인하는 꼴이 된다. */
  {
    const sp=21, W=2000, HEAD=sp*1.45, durs=[1,0.75,0.25,1,0.75,0.25];
    const span=W*0.2;                                  // 한 마디 폭(실제 찬송가와 같은 비율)
    const K=(span-HEAD*durs.length)/durs.reduce((a,b)=>a+b,0);
    const xs=[]; let cx=W*0.1;
    durs.forEach(d=>{ xs.push(cx); cx+=HEAD+K*d; });
    const geo={sp,iw:W,w:W,durSure:false,
      notes:durs.map((d,i)=>({name:'E4',x:xs[i],beats:0.5}))};
    const seg=[{x0:W*0.1/W,x1:cx/W,i0:0,cnt:durs.length},{x0:cx/W,x1:1,i0:-1,cnt:0}];
    fitBeatsToBars(geo,seg,4);
    const got=geo.notes.map(n=>n.beats);
    ok('조판 간격에서 점8분+16분을 되찾는다 (실제 '+got.join(' ')+')',
       JSON.stringify(got)===JSON.stringify(durs),got);
  }

  /* 5) 절 가사 줄은 마디를 만들지 않는다(v59).
     실제 사진에서 읽은 찬송가는 한 단 아래에 가사 줄이 2~3개다. 예전에는 번호 없는
     가사 줄이 저마다 한 마디가 돼서 20마디짜리가 27마디로 불어났다(멜로디도 코드도
     없는 빈 마디). 가사만 있는 차트는 예전 그대로여야 한다. */
  {
    const keep={raw:S.raw,verse:S.verse,semis:S.semis};
    try{
      S.raw=`♪ C4:4 | D4:4
A        | D
1. 가 사
   두 절
   세 절`;
      S.semis=0; S.verse=1; reparse();
      const pr=blocks.filter(b=>b.k==='pairs');
      ok('가사 줄 셋은 블록 하나다 (실제 '+pr.length+')',pr.length===1,pr.length);
      ok('둘째·셋째 줄은 2·3절이 된다',
         !!pr[0]&&JSON.stringify(Object.keys(pr[0].alt||{}))==='["2","3"]',pr[0]&&pr[0].alt);
      /* ★ 블록 하나가 아니라 **차트 전체의 마디 수**를 센다 — 가짜 마디는 다른 블록으로
         생기므로 첫 블록만 보면 놓친다(실제로 이 검사가 무름했다). */
      let N=0, pm=null;
      for(const b of blocks){
        if(b.k==='mel'){ pm=b; continue; }
        if(b.k==='pairs'){ N+=measuresOfBlock(pm,b).N; pm=null; }
      }
      ok('차트 전체가 2마디다 — 가사 줄로 늘지 않는다 (실제 '+N+')',N===2,N);

      /* 코드도 마디선도 없는 가사만의 차트는 줄마다 그대로 남아야 한다 */
      S.raw=`첫째 줄
둘째 줄
셋째 줄`; reparse();
      ok('가사만 있는 차트는 그대로 둔다',blocks.filter(b=>b.k==='pairs').length===3,
         blocks.filter(b=>b.k==='pairs').length);

      /* 절 번호가 가사 줄 맨 앞에 있어도 코드가 밀리지 않는다 */
      S.raw=`D        A
3) 가 나  다  라`; reparse();
      const p2=blocks.find(b=>b.k==='pairs');
      const first=p2&&p2.pairs.find(x=>x.chord);
      ok('절 번호가 코드에 붙지 않는다 (실제 "'+((first&&first.text)||'')+'")',
         !!first&&!/^[)\].]/.test((first.text||'').trim()),first&&first.text);
    }finally{ S.raw=keep.raw; S.verse=keep.verse; S.semis=keep.semis; reparse(); }
  }

  /* ── 5) AI 결과와 **마디 단위로** 맞추기 (v62) ──
     사용자 신고: *"업데이트 된 버전으로 돌려도 같은곳에 파, 미 라고 표기 해야하는데 파(4박)"*.
     실제 악보를 재 보니 `staffGeom` 은 그 마디를 `F4:2 E4:2` 로 **정확히 읽고 있었는데**,
     AI 가 온음표 하나로 읽는 바람에 "개수가 다르면 아무것도 안 한다"는 규칙에 걸려
     **잰 값을 통째로 버리고** AI 의 틀린 값을 내보냈다. 맞추는 단위가 단 전체였던 것이 문제다.
     ★ 지키는 성질(중요도 순):
       - 잰 것이 **더 적은** 마디는 절대 건드리지 않는다(지우면 되돌릴 수 없다)
       - 잰 것이 **더 많은** 마디만 채운다(AI 가 뭉쳐 읽은 것이다)
       - 어느 경우든 그 마디 박수 합이 박자표와 같을 때만 손댄다
       - 마디 수가 다르면 통째로 포기한다(예전 방식으로 되돌아간다) */
  if(geo){
    const acc=geomAccs(geo);
    const right='♪ '+BARS.map(b=>b.map(n=>'A4:'+n.dur).join(' ')).join(' | ');
    /* ① AI 가 마지막 마디의 두 음(2박+4박… 이 그림에서는 2분+온음표)을 하나로 뭉쳐 읽었다 */
    const merged='♪ '+BARS.slice(0,3).map(b=>b.map(n=>'A4:'+n.dur).join(' ')).join(' | ')+' | A4:4';
    const r1=applyGeomBars(merged,geo,acc,4);
    ok('마디 단위로 맞춘다',r1.matched,r1.why);
    ok('AI 가 뭉쳐 읽은 음표를 되찾는다 ('+r1.filled+'개)',r1.filled>=1,r1);
    const lastBar=(r1.text.split('\n')[0].split('|').pop()||'').trim().split(/\s+/).filter(Boolean);
    ok('마지막 마디가 두 음이 된다 ('+lastBar.join(' ')+')',lastBar.length===2,lastBar);
    ok('되찾은 마디의 박수 합이 4박이다',
       Math.abs(lastBar.reduce((a,t)=>a+parseFloat(t.split(':')[1]||1),0)-4)<0.02,lastBar);

    /* ② AI 가 **더 많이** 적었으면(우리가 놓쳤을 수 있다) 그 마디는 손대지 않는다 */
    const extra='♪ '+BARS.slice(0,3).map(b=>b.map(n=>'A4:'+n.dur).join(' ')).join(' | ')
      +' | A4:1 A4:1 A4:1 A4:1 A4:1 A4:1';
    const r2=applyGeomBars(extra,geo,acc,4);
    ok('잰 것이 더 적은 마디는 건드리지 않는다',
       /A4:1 A4:1 A4:1 A4:1 A4:1 A4:1\s*$/.test(r2.text.split('\n')[0]),r2.text.split('\n')[0]);

    /* ③ 마디 수가 다르면 통째로 포기한다 */
    const fewer='♪ A4:4 | A4:4';
    ok('마디 수가 다르면 손대지 않는다',!applyGeomBars(fewer,geo,acc,4).matched,
       applyGeomBars(fewer,geo,acc,4).why);

    /* ④ AI 가 맞게 적었으면 마디 수·음표 수가 그대로 유지된다 */
    const r4=applyGeomBars(right,geo,acc,4);
    const bars4=r4.text.split('\n')[0].split('|').length;
    ok('맞게 적은 줄은 마디 수가 그대로다 ('+bars4+')',bars4===BARS.length,r4.text.split('\n')[0]);
    ok('맞게 적은 줄은 음표 수가 그대로다',
       (r4.text.match(/A4:|[A-G][#b]?\d:/g)||[]).length===nNote,r4.text.split('\n')[0]);
  }

  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log((fail?'✗ ':'✓ ')+'score: '+pass+' 통과 / '+fail+' 실패');
  return {pass,fail};
}
if(typeof window!=='undefined')window.scoreTest=scoreTest;
