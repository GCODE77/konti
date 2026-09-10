/* 음표 길이(박자) 픽셀 측정 회귀 테스트 — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/rhythm.test.js'); await m.default();

   길이를 우리가 정해서 그리므로 정답이 공짜로 나온다(geom.test.js 와 같은 방식).
   ★ 다만 이 방식의 한계를 분명히 알아 둘 것: **내 검출기가 보려는 모양을 내가 그린다**는
     자기충족 위험이 있다. 그래서 꼬리는 곧은 막대가 아니라 실제처럼 **곡선**으로 그리고,
     빔은 두 기둥을 잇는 진짜 빔으로 그린다. 그리고 이 테스트를 통과해도
     **실제 악보 사진 검증을 대신하지 못한다** — real.test.js 쪽을 반드시 함께 볼 것.

   ★ 지켜야 할 성질:
     - 온음표(기둥 없음)=4, 2분(속 빔+기둥)=2, 4분=1, 8분(꼬리1)=0.5, 16분(꼬리2)=0.25
     - 점이 붙으면 ×1.5
     - 기둥 방향(위/아래)은 길이와 무관하다
     - 애매하면 sure=false 를 달아 통째로 포기한다(틀린 박자를 쓰는 것보다 낫다) */

const DUR={4:'온',2:'2분',1:'4분',0.5:'8분',0.25:'16분'};

/* notes: [{st, dur, dot}]  st 0 = 맨 아래 줄(E4), 1칸 = 2 */
function drawR(notes,o){
  o=o||{};
  const sp=o.sp||24, W=o.W||1600, H=o.H||520, y0=100, dx=o.dx||130, x0=o.x0||150;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  const staffTop=y0, bot=y0+4*sp;
  g.strokeStyle='#000'; g.lineWidth=Math.max(2,Math.round(sp*0.11));
  for(let k=0;k<5;k++){ const y=y0+k*sp; g.beginPath(); g.moveTo(10,y); g.lineTo(W-10,y); g.stroke(); }
  g.lineWidth=Math.round(sp*0.35);                       // 자리표 흉내
  g.beginPath(); g.moveTo(34,y0-sp*1.4); g.lineTo(34,bot+sp*1.4); g.stroke();

  const head=(x,cy,hollow)=>{ g.save(); g.translate(x,cy); g.rotate(-0.32);
    g.beginPath(); g.ellipse(0,0,sp*0.62,sp*0.44,0,0,Math.PI*2);
    if(hollow){ g.lineWidth=Math.round(sp*0.16); g.strokeStyle='#000'; g.stroke(); }
    else { g.fillStyle='#000'; g.fill(); } g.restore(); };
  const stemX=(x,up)=>up?x+sp*0.58:x-sp*0.58;
  const stemLen=sp*3.5;
  const stem=(x,cy,up)=>{ g.lineWidth=Math.max(2,Math.round(sp*0.1)); g.strokeStyle='#000';
    g.beginPath(); const sx=stemX(x,up); g.moveTo(sx,cy); g.lineTo(sx,up?cy-stemLen:cy+stemLen); g.stroke(); };
  /* 꼬리는 실제처럼 곧은 막대가 아니라 오른쪽으로 말리는 곡선으로 그린다 */
  const flags=(x,cy,up,n)=>{
    const sx=stemX(x,up), tip=up?cy-stemLen:cy+stemLen, d=up?1:-1;
    g.lineWidth=Math.round(sp*0.26); g.strokeStyle='#000'; g.lineCap='round';
    for(let k=0;k<n;k++){
      const y=tip+d*k*sp*0.62;
      g.beginPath(); g.moveTo(sx,y);
      g.quadraticCurveTo(sx+sp*0.95,y+d*sp*0.25,sx+sp*0.62,y+d*sp*1.0);
      g.stroke();
    }
    g.lineCap='butt';
  };
  const dotAt=(x,cy)=>{ g.fillStyle='#000'; g.beginPath();
    g.arc(x+sp*1.02,cy-(Math.round((bot-cy)/(sp/2))%2===0?sp*0.5:0),sp*0.15,0,7); g.fill(); };

  const xs=notes.map((n,i)=>x0+i*dx);
  /* 빔으로 묶인 음들은 실제 조판에서 기둥 방향이 반드시 같다 — 그렇지 않게 그리면
     오선을 가로지르는 말도 안 되는 빔이 되어, 검출기가 아니라 그림이 틀린 게 된다. */
  const upOf=i=>{
    if(!o.beam)return notes[i].st<4;
    const g0=i-(i%2), avg=(notes[g0].st+(notes[g0+1]?notes[g0+1].st:notes[g0].st))/2;
    return avg<4;
  };
  notes.forEach((n,i)=>{
    const cy=bot-n.st*sp/2, up=upOf(i), x=xs[i];
    head(x,cy,n.dur>=2);
    if(n.dur<4)stem(x,cy,up);
    if(!o.beam){
      if(n.dur===0.5)flags(x,cy,up,1);
      if(n.dur===0.25)flags(x,cy,up,2);
    }
    if(n.dot)dotAt(x,cy);
  });
  /* 빔: 이웃한 두 기둥 끝을 잇는 진짜 빔(꼬리 대신) */
  if(o.beam){
    g.strokeStyle='#000'; g.lineWidth=Math.round(sp*0.34);
    for(let i=0;i+1<notes.length;i+=2){
      const up1=upOf(i);
      const y1=bot-notes[i].st*sp/2+(up1?-stemLen:stemLen);
      const y2=bot-notes[i+1].st*sp/2+(up1?-stemLen:stemLen);
      g.beginPath(); g.moveTo(stemX(xs[i],up1),y1); g.lineTo(stemX(xs[i+1],up1),y2); g.stroke();
      if(notes[i].dur===0.25){                      // 16분: 빔 두 겹
        const off=(up1?1:-1)*sp*0.55;
        g.beginPath(); g.moveTo(stemX(xs[i],up1),y1+off); g.lineTo(stemX(xs[i+1],up1),y2+off); g.stroke();
      }
    }
  }
  if(o.lyric!==false){ g.fillStyle='#000'; g.font=Math.round(sp*1.05)+'px sans-serif';
    xs.forEach(x=>g.fillText('주',x-sp*0.5,bot+sp*2.6)); }
  return c.toDataURL('image/png');
}

const N=(st,dur,dot)=>({st,dur,dot:!!dot});
export {drawR,N};        // 진단용으로 내보낸다(어느 음의 기둥·꼬리를 놓쳤는지 보려면 필요)

const CASES=[
  ['4분음표만',        [N(0,1),N(2,1),N(4,1),N(5,1),N(7,1)], {}],
  ['2분음표(속 빈 머리+기둥)', [N(0,2),N(2,2),N(4,2),N(5,2),N(7,2)], {}],
  ['온음표(기둥 없음)', [N(0,4),N(2,4),N(4,4),N(5,4),N(7,4)], {}],
  ['8분음표(꼬리 1개)', [N(0,0.5),N(2,0.5),N(4,0.5),N(5,0.5),N(7,0.5)], {}],
  ['16분음표(꼬리 2개)',[N(0,0.25),N(2,0.25),N(4,0.25),N(5,0.25),N(7,0.25)], {}],
  ['점4분음표(1.5박)',  [N(0,1,1),N(2,1,1),N(4,1,1),N(5,1,1)], {}],
  ['점2분음표(3박)',    [N(0,2,1),N(2,2,1),N(4,2,1),N(5,2,1)], {}],
  ['빔으로 이은 8분음표',[N(2,0.5),N(4,0.5),N(5,0.5),N(7,0.5),N(5,0.5),N(4,0.5)], {beam:true}],
  ['섞인 리듬',         [N(0,1),N(2,0.5),N(4,0.5),N(5,2),N(7,1),N(5,4)], {}],
  ['기둥이 아래로 뻗는 높은 음', [N(8,1),N(9,0.5),N(10,1),N(8,2),N(9,1)], {}],
  ['저해상도(오선 간격 14px)', [N(0,1),N(2,0.5),N(4,1),N(5,2),N(7,1)],
    {sp:14,W:900,H:300,dx:80,x0:90,lyric:false}]
];

export default async function rhythmTest(){
  const rows=[];
  for(const [label,notes,o] of CASES){
    const url=drawR(notes,o);
    let geo=null,err=null;
    try{ geo=await staffGeom(url); }catch(e){ err=String(e); }
    const want=notes.map(n=>+(n.dur*(n.dot?1.5:1)).toFixed(4)).join(' ');
    const got=geo?geo.notes.map(n=>n.beats).join(' '):'(null)';
    const sure=geo?geo.durSure:false;
    rows.push({label,pass:got===want&&sure,want,got:err?('(오류)'+err):got,sure});
  }
  const fails=rows.filter(r=>!r.pass);
  console.table(rows.map(r=>({테스트:r.label,결과:r.pass?'통과':'실패',기대:r.want,실제:r.got,확신:r.sure})));
  return {passed:rows.length-fails.length,total:rows.length,fails};
}

/* applyGeomDur: "쓰지 말아야 할 때 안 쓰는 것"이 더 중요하다 */
export function applyDurTest(){
  const T=[];
  const mk=(...bs)=>bs.map(b=>({beats:b,sure:true}));
  const t=(label,text,notes,perBar,expect)=>{
    const r=applyGeomDur(text,notes,perBar);
    const got=JSON.stringify({text:r.text,matched:r.matched});
    T.push({label,pass:got===JSON.stringify(expect),got,want:JSON.stringify(expect)});
  };
  t('마디가 딱 맞으면 박자를 덮어쓴다',
    '♪ C4:1 D4:1 E4:1 F4:1',mk(0.5,0.5,1,2),4,
    {text:'♪ C4:0.5 D4:0.5 E4:1 F4:2',matched:true});
  t('쉼표 박수도 합계에 넣는다',
    '♪ C4:1 r:2 D4:1',mk(1,1),4,
    {text:'♪ C4:1 r:2 D4:1',matched:true});
  t('한 음이라도 애매하면 통째로 포기한다',
    '♪ C4:1 D4:1',[{beats:1,sure:true},{beats:1,sure:false}],4,
    {text:'♪ C4:1 D4:1',matched:false});
  t('개수가 다르면 손대지 않는다',
    '♪ C4:1 D4:1',mk(1,1,1),4,
    {text:'♪ C4:1 D4:1',matched:false});
  t('합계가 마디에도 AI에도 안 맞으면 손대지 않는다',
    '♪ C4:1 D4:1 E4:1 F4:1',mk(0.25,0.25,0.25,0.25),4,
    {text:'♪ C4:1 D4:1 E4:1 F4:1',matched:false});
  t('마디에는 안 맞아도 AI 합계와 같으면 쓴다(서로 확인됨)',
    '♪ C4:1 D4:1 E4:1',mk(1.5,1,0.5),4,
    {text:'♪ C4:1.5 D4:1 E4:0.5',matched:true});
  t('♪ 줄이 둘로 쪼개졌으면 정렬 근거가 없다',
    '♪ C4:1\n♪ D4:1',mk(1,1),4,
    {text:'♪ C4:1\n♪ D4:1',matched:false});
  t('3/4 박자표도 마디 배수로 인정한다',
    '♪ C4:1 D4:1 E4:1',mk(1,1,1),3,
    {text:'♪ C4:1 D4:1 E4:1',matched:true});
  console.table(T.map(r=>({테스트:r.label,결과:r.pass?'통과':'실패',실제:r.got})));
  return {passed:T.filter(r=>r.pass).length,total:T.length,fails:T.filter(r=>!r.pass)};
}
if(typeof window!=='undefined'){ window.rhythmTest=rhythmTest; window.applyDurTest=applyDurTest; }
