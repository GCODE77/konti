/* 임시표(♯·♭·♮) 픽셀 인식 회귀 테스트 (v60) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/accid.test.js'); await m.default();

   왜 생겼나. v59 까지 이 앱은 **임시표를 아예 보지 않았다.** 음이름은 자리로 정확히
   재면서 #/b 는 조표에서만 입혔으니, 조에 없는 음이 전부 제자리음이 됐다.
   사용자가 정확히 이걸 잡아냈다 — *"예수내주에서 레# 인데 샵이 표기가 안되어있다"*
   (A장조 곡의 B7 코드 자리, D♯). 화성의 색이 통째로 사라지는 오류다.

   ★ 지키는 성질 — 순서가 곧 중요도다:
     1. **없는 임시표를 붙이지 않는다.** 아무것도 안 붙은 음은 반드시 '' 여야 한다.
        놓치면 조표대로 울려서 지금까지와 같지만, 잘못 붙이면 없던 음이 생긴다.
     2. ♯·♭·♮ 을 서로 헷갈리지 않는다.
     3. 임시표가 **그 마디 끝까지** 이어진다(조판 규칙). 마디선을 넘으면 풀린다.
     4. 앞 음표의 기둥·점·덧줄, 그리고 **조표**를 임시표로 읽지 않는다. */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){ T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');} }

/* 임시표를 실제 모양대로 그린다. 세 기호의 **판정 근거가 되는 성질**을 정확히 재현해야
   한다 — ♭ 은 세로획 하나 + 아래쪽 동그라미, ♯ 은 세로획 둘 + 양옆으로 삐져나온 가로줄
   둘(거의 정사각), ♮ 은 세로획 둘인데 가로줄이 안 삐져나와 홀쭉하다. */
function drawAcc(g,kind,x,cy,sp){
  g.strokeStyle='#000'; g.fillStyle='#000';
  if(kind==='#'){
    g.lineWidth=sp*0.13;
    g.beginPath(); g.moveTo(x-sp*0.17,cy-sp*1.0); g.lineTo(x-sp*0.17,cy+sp*0.9); g.stroke();
    g.beginPath(); g.moveTo(x+sp*0.24,cy-sp*0.9); g.lineTo(x+sp*0.24,cy+sp*1.0); g.stroke();
    g.lineWidth=sp*0.2;
    g.beginPath(); g.moveTo(x-sp*0.44,cy-sp*0.12); g.lineTo(x+sp*0.5,cy-sp*0.36); g.stroke();
    g.beginPath(); g.moveTo(x-sp*0.44,cy+sp*0.5);  g.lineTo(x+sp*0.5,cy+sp*0.26); g.stroke();
  }else if(kind==='b'){
    g.lineWidth=sp*0.13;
    g.beginPath(); g.moveTo(x-sp*0.22,cy-sp*1.5); g.lineTo(x-sp*0.22,cy+sp*0.5); g.stroke();
    g.lineWidth=sp*0.15;
    g.beginPath();
    g.moveTo(x-sp*0.2,cy-sp*0.3);
    g.quadraticCurveTo(x+sp*0.55,cy-sp*0.5,x+sp*0.3,cy+sp*0.15);
    g.quadraticCurveTo(x+sp*0.1,cy+sp*0.5,x-sp*0.2,cy+sp*0.5);
    g.stroke();
  }else{                                   // ♮ — 세로획 둘이 붙어 있어 홀쭉하다
    g.lineWidth=sp*0.13;
    g.beginPath(); g.moveTo(x-sp*0.2,cy-sp*1.1); g.lineTo(x-sp*0.2,cy+sp*0.55); g.stroke();
    g.beginPath(); g.moveTo(x+sp*0.2,cy-sp*0.55); g.lineTo(x+sp*0.2,cy+sp*1.1); g.stroke();
    g.lineWidth=sp*0.17;
    g.beginPath(); g.moveTo(x-sp*0.2,cy-sp*0.32); g.lineTo(x+sp*0.2,cy-sp*0.52); g.stroke();
    g.beginPath(); g.moveTo(x-sp*0.2,cy+sp*0.52); g.lineTo(x+sp*0.2,cy+sp*0.32); g.stroke();
  }
}

/* 한 단을 그린다. bars: [[{st,dur,acc}...], ...] — acc 는 '#'·'b'·'n' 또는 없음 */
export function drawAccStaff(o){
  o=o||{};
  const sp=o.sp||18, W=o.W||1500, H=Math.round(sp*16);
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  const top=Math.round(sp*5), bot=top+4*sp, xEnd=W-sp*4;
  g.strokeStyle=o.lineColor||'#8f8f8f'; g.lineWidth=sp*0.16;
  for(let k=0;k<5;k++){ const y=top+k*sp; g.beginPath(); g.moveTo(sp*2,y); g.lineTo(xEnd,y); g.stroke(); }
  /* 자리표 */
  g.strokeStyle='#000'; g.lineWidth=sp*0.3;
  g.beginPath(); g.moveTo(sp*4,top-sp*1.3); g.lineTo(sp*4,bot+sp*1.3); g.stroke();
  g.lineWidth=sp*0.26;
  g.beginPath(); g.arc(sp*4,top+sp*0.6,sp*0.9,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(sp*3.7,bot-sp*0.2,sp*0.7,0,Math.PI*2); g.stroke();
  /* 조표 — 여기 있는 # 을 **임시표로 읽으면 안 된다**(이 테스트의 핵심 하나) */
  const sharps=o.sharps||0, SHY=[0,1.5,-0.5,1,2.5,2,3.5];
  for(let i=0;i<sharps;i++)drawAcc(g,'#',sp*6.4+i*sp*1.15,top+SHY[i]*sp,sp);

  const bars=o.bars, x0=sp*(7+sharps*1.2+2), x1=xEnd;
  const n=bars.reduce((a,b)=>a+b.length,0);
  const dx=(x1-x0)/(n+1);
  let i=0;
  bars.forEach((bar,bi)=>{
    bar.forEach(nt=>{
      const x=x0+dx*(i+0.7), cy=bot-nt.st*sp/2;
      if(nt.acc)drawAcc(g,nt.acc,x-sp*1.35,cy,sp);
      if(nt.st<=-2||nt.st>=10){
        g.strokeStyle='#000'; g.lineWidth=sp*0.14;
        const s=nt.st<=-2?-1:1;
        for(let L=(s<0?-2:10);s<0?L>=nt.st:L<=nt.st;L+=s*2){ const ly=bot-L*sp/2;
          g.beginPath(); g.moveTo(x-sp*0.85,ly); g.lineTo(x+sp*0.85,ly); g.stroke(); }
      }
      g.save(); g.translate(x,cy); g.rotate(-0.3);
      g.beginPath(); g.ellipse(0,0,sp*0.65,sp*0.46,0,0,Math.PI*2);
      if(nt.dur>=2){ g.lineWidth=sp*(nt.dur>=4?0.28:0.19); g.strokeStyle='#000'; g.stroke(); }
      else { g.fillStyle='#000'; g.fill(); }
      g.restore();
      if(nt.dur<4){
        const up=nt.st<4, sx=up?x+sp*0.6:x-sp*0.6;
        g.strokeStyle='#000'; g.lineWidth=sp*0.12;
        g.beginPath(); g.moveTo(sx,cy); g.lineTo(sx,up?cy-sp*3.6:cy+sp*3.6); g.stroke();
      }
      i++;
    });
    const bx=(bi+1<bars.length)?x0+dx*i:x1;
    g.strokeStyle='#000'; g.lineWidth=sp*0.13;
    g.beginPath(); g.moveTo(bx,top); g.lineTo(bx,bot); g.stroke();
  });
  return c.toDataURL('image/jpeg',0.8);
}

async function measure(o){
  const url=drawAccStaff(o);
  try{
    const parts=await splitSystems(url);
    return await staffGeom((parts&&parts.length===1)?parts[0].url:url);
  }catch(e){ console.error(e); return null; }
}

export default async function accidTest(){
  T.length=0; pass=0; fail=0;

  /* 1) 임시표가 하나도 없는 단 — **전부 '' 이어야 한다**(가장 중요한 성질).
     기둥·덧줄·조표를 임시표로 읽으면 여기서 터진다. */
  {
    const BARS=[[{st:0,dur:1},{st:2,dur:1},{st:4,dur:1},{st:6,dur:1}],
                [{st:-2,dur:1},{st:1,dur:1},{st:8,dur:1},{st:5,dur:2}]];
    const geo=await measure({sp:18,sharps:3,bars:BARS});
    ok('임시표 없는 단에서 오선을 잰다',!!geo,geo);
    if(geo){
      const got=geo.notes.map(n=>n.acc||'·').join('');
      ok('임시표가 없으면 하나도 붙이지 않는다 ('+got+')',geo.notes.every(n=>!n.acc),
         geo.notes.map(n=>n.name+(n.acc||'')));
    }
  }

  /* 2) ♯·♭·♮ 을 각각 알아본다 */
  {
    const BARS=[[{st:0,dur:1},{st:3,dur:1,acc:'#'},{st:5,dur:1},{st:2,dur:1,acc:'b'}],
                [{st:4,dur:1},{st:3,dur:1,acc:'n'},{st:6,dur:1},{st:1,dur:1,acc:'#'}]];
    const geo=await measure({sp:18,sharps:3,bars:BARS});
    ok('임시표가 섞인 단에서 오선을 잰다',!!geo,geo);
    if(geo&&geo.notes.length===8){
      const want=['','#','','b','','n','','#'];
      const got=geo.notes.map(n=>n.acc||'');
      want.forEach((w,k)=>ok('음 '+(k+1)+'의 임시표 "'+(w||'없음')+'"',got[k]===w,
                             {want:w,got:got[k],name:geo.notes[k].name}));
    }else ok('음표 8개를 다 찾는다 ('+(geo?geo.notes.length:0)+')',false,geo&&geo.notes.map(n=>n.name));
  }

  /* 3) 임시표는 그 마디 끝까지 이어지고 마디선을 넘으면 풀린다 */
  {
    const geo={notes:[{x:10,step:3,acc:'#'},{x:20,step:5,acc:''},{x:30,step:3,acc:''},
                      {x:50,step:3,acc:''},{x:60,step:3,acc:'n'},{x:70,step:3,acc:''}],
               bars:[40,80]};
    const a=geomAccs(geo);
    ok('임시표가 같은 자리 뒤 음에 이어진다',a[2]==='#',a);
    ok('다른 자리에는 옮겨 가지 않는다',a[1]==='',a);
    ok('마디선을 넘으면 풀린다',a[3]==='',a);
    ok('제자리표도 마디 끝까지 이어진다',a[4]==='n'&&a[5]==='n',a);
  }

  /* 4) 최종 음이름: 조표와 임시표를 합친다 */
  {
    const sig={F:'#',C:'#',G:'#'};                 // A장조
    ok('조표만 있으면 조표대로 (F→F#)',geomMidi('F4',sig,'')===66,geomMidi('F4',sig,''));
    ok('임시표 ♯ 이 조표 없는 음에 붙는다 (D→D#)',geomMidi('D5',sig,'#')===75,geomMidi('D5',sig,'#'));
    ok('제자리표가 조표를 이긴다 (F#→F)',geomMidi('F4',sig,'n')===65,geomMidi('F4',sig,'n'));
    ok('♭ 이 붙으면 내린다 (B→Bb)',geomMidi('B4',sig,'b')===70,geomMidi('B4',sig,'b'));
  }

  /* 5) AI 결과 덮어쓰기 — **못 본 자리에서는 AI 것을 그대로 둔다** */
  {
    const t='♪ D5:1 F5:1 A5:1';
    const r1=applyGeomPitch(t,['D5','F5','A5'],['#','','']);
    ok('본 자리만 임시표를 덮어쓴다',/♪ D#5:1 F5:1 A5:1/.test(r1.text),r1.text);
    const r2=applyGeomPitch('♪ D#5:1 F#5:1 A5:1',['D5','F5','A5'],['','','']);
    ok('못 본 자리에서는 AI 임시표를 유지한다',/♪ D#5:1 F#5:1 A5:1/.test(r2.text),r2.text);
    const r3=applyGeomPitch('♪ D#5:1 F5:1 A5:1',['D5','F5','A5'],['n','','']);
    ok('제자리표를 보면 AI 임시표를 뗀다',/♪ D5:1 F5:1 A5:1/.test(r3.text),r3.text);
  }

  /* 6) 화면에 그릴 때 실제로 ♯ 이 보이는가 — 사용자가 본 증상 그대로의 회귀 테스트.
     A장조(♯3개)에서 D♯5 는 조표에 없는 음이므로 반드시 임시표가 그려져야 한다. */
  {
    const sigSet={F:'#',C:'#',G:'#'};
    ok('A장조에서 D#5 는 ♯ 을 그린다',spell(75,'sharp',sigSet).show==='#',spell(75,'sharp',sigSet));
    ok('A장조에서 F#5 는 임시표를 안 그린다',spell(78,'sharp',sigSet).show==='',spell(78,'sharp',sigSet));
    ok('A장조에서 F♮5 는 ♮ 을 그린다',spell(77,'sharp',sigSet).show==='n',spell(77,'sharp',sigSet));
  }

  /* 7) 점음표 모양 — 점8분(0.75)·점4분(1.5)·점2분(3)이 서로 다르게 그려져야 한다 */
  {
    const d8=noteDur(0.75), d4=noteDur(1.5), d2=noteDur(3), s16=noteDur(0.25), w=noteDur(4);
    ok('점8분음표 = 꼬리1 + 점1',d8.flags===1&&d8.dots===1&&!d8.hollow,d8);
    ok('점4분음표 = 꼬리0 + 점1 + 속이 참',d4.flags===0&&d4.dots===1&&!d4.hollow,d4);
    ok('점2분음표 = 속이 빔 + 기둥 + 점1',d2.hollow&&d2.stem&&d2.dots===1,d2);
    ok('16분음표 = 꼬리2 + 점 없음',s16.flags===2&&s16.dots===0,s16);
    ok('온음표 = 속이 빔 + 기둥 없음',w.hollow&&!w.stem&&w.dots===0,w);
    ok('겹점2분음표(3.5박) = 점2',noteDur(3.5).dots===2,noteDur(3.5));
    ok('악보에 없는 길이는 점을 찍지 않는다',noteDur(1.2).dots===0,noteDur(1.2));
  }

  console.log('%c accid.test.js — '+pass+'/'+(pass+fail)+' 통과',
    'font-weight:700;color:'+(fail?'#c00':'#0a0'));
  return {pass,fail,tests:T};
}
