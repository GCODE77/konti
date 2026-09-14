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
  if(o.lyric){ g.fillStyle='#000'; g.font=Math.round(sp*1.3)+'px sans-serif';
    for(let k=0;k<n;k++)g.fillText('가',x0+dx*(k+0.3),bot+sp*2.2); }
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

  /* 3) 코드 글자 오인 되돌리기 — 실제 Tesseract 출력에서 본 것들만 */
  const C=[['Fim','F#m'],['B71','B7'],['B87','B7'],['EsusdE','Esus4,E'],['EsusiE','Esus4,E'],
           ['A','A'],['D','D'],['A2','A2'],['Esus4','Esus4'],['Bb','Bb'],['G/B','G/B']];
  C.forEach(([raw,want])=>{
    const got=splitChordRun(raw).join(',');
    ok('코드 "'+raw+'" → '+want+' (실제 '+got+')',got===want,got);
  });
  ok('코드가 아닌 것은 버린다',splitChordRun('가나').length===0,splitChordRun('가나'));

  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log((fail?'✗ ':'✓ ')+'score: '+pass+' 통과 / '+fail+' 실패');
  return {pass,fail};
}
if(typeof window!=='undefined')window.scoreTest=scoreTest;
