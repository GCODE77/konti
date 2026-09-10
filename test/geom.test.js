/* 오선 자리 측정(staffGeom) 회귀 테스트 — 배포에는 포함되지 않는 파일이다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에 아래 한 줄을 붙여 넣는다.
     await (await import('./test/geom.test.js')).default()
   또는 script 태그로 불러온 뒤  await geomTest()

   왜 합성 이미지로 재나: 실제 악보 사진은 정답(음이름)을 사람이 일일이 적어 줘야 하고
   한 장으로는 경계 조건을 못 덮는다. 여기서는 "몇째 줄에 그렸는지"를 우리가 알고 그리므로
   정답이 공짜로 나온다. 실제 사진 검증은 이 테스트를 대신하지 못하니 따로 해야 한다.

   ★ 반드시 지켜야 할 성질(테스트가 지키는 것):
     - 줄 위에 놓인 음(step 짝수)이 빠지지 않는다 — 오선 줄을 지우는 단계에서 음표 머리를
       같이 깎으면 이게 먼저 깨진다.
     - 쉼표·점·마디선·가사 글자를 음표로 세지 않는다 — 하나라도 더 세면 개수가 어긋나
       applyGeomPitch 가 아무 일도 하지 않게 된다(그게 안전한 실패다).
     - SATB 화음에서는 맨 위(소프라노)만 고른다.
     - 그랜드 스태프에서는 위 오선(높은음자리표)만 고른다.
     - 사진이 3도 안쪽으로 기울어도 되돌려 읽는다. 반듯한 사진을 괜히 돌리지 않는다. */
const L=['C','D','E','F','G','A','B'];
const nm=st=>{ const a=4*7+2+st; return L[((a%7)+7)%7]+Math.floor(a/7); };

/* 오선 한 단을 그린다. step 0 = 맨 아래 줄(E4), 1칸 = step 2 */
function draw(o){
  o=o||{};
  const sp=o.sp||24, W=o.W||1600, H=o.H||520, y0=100;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  if(o.rot){ g.translate(W/2,H/2); g.rotate(o.rot); g.translate(-W/2,-H/2); }
  const staff=top=>{ g.strokeStyle='#000'; g.lineWidth=Math.max(2,Math.round(sp*0.11));
    for(let k=0;k<5;k++){ const y=top+k*sp; g.beginPath(); g.moveTo(10,y); g.lineTo(W-10,y); g.stroke(); } };
  staff(y0);
  const bot=y0+4*sp;
  if(o.grand)staff(bot+sp*7);
  g.lineWidth=Math.round(sp*0.35);                       // 자리표 흉내: 오선 위아래로 넘게 뻗은 획
  g.beginPath(); g.moveTo(34,y0-sp*1.4); g.lineTo(34,bot+sp*1.4); g.stroke();
  const head=(x,cy,hollow)=>{ g.save(); g.translate(x,cy); g.rotate(-0.32);
    g.beginPath(); g.ellipse(0,0,sp*0.62,sp*0.44,0,0,Math.PI*2);
    if(hollow){ g.lineWidth=Math.round(sp*0.16); g.strokeStyle='#000'; g.stroke(); }
    else { g.fillStyle='#000'; g.fill(); } g.restore(); };
  const stem=(x,cy,up,len)=>{ g.lineWidth=Math.max(2,Math.round(sp*0.1)); g.strokeStyle='#000';
    g.beginPath(); const sx=up?x+sp*0.58:x-sp*0.58; g.moveTo(sx,cy); g.lineTo(sx,up?cy-len:cy+len); g.stroke(); };
  const xs=o.sopr.map((s,i)=>(o.x0||150)+i*(o.dx||90));
  o.sopr.forEach((st,i)=>{
    const cy=bot-st*sp/2;
    head(xs[i],cy,(o.hollowAt||[]).indexOf(i)>=0);
    stem(xs[i],cy,st<4,sp*3.5);
    if(o.alto){ const ay=bot-o.alto[i]*sp/2; head(xs[i],ay,false); stem(xs[i],ay,false,sp*3.2); }
    if(st<0||st>8){                                      // 덧줄
      const n=st<0?Math.floor(-st/2):Math.floor((st-8)/2);
      for(let k=1;k<=n;k++){ const ly=st<0?bot+k*sp:y0-k*sp;
        g.lineWidth=Math.max(2,Math.round(sp*0.11)); g.beginPath();
        g.moveTo(xs[i]-sp*0.95,ly); g.lineTo(xs[i]+sp*0.95,ly); g.stroke(); } }
  });
  if(o.beam){ g.lineWidth=Math.round(sp*0.34); g.strokeStyle='#000';
    for(let i=0;i+1<o.sopr.length;i+=2){
      const y1=bot-o.sopr[i]*sp/2-sp*3.5, y2=bot-o.sopr[i+1]*sp/2-sp*3.5;
      g.beginPath(); g.moveTo(xs[i]+sp*0.58,y1); g.lineTo(xs[i+1]+sp*0.58,y2); g.stroke(); } }
  if(o.rest){ g.fillStyle='#000'; g.fillRect(xs[xs.length-1]+sp*2.2,y0+sp*1.5,sp*1.1,sp*0.5); }
  if(o.dot){ g.fillStyle='#000'; xs.forEach((x,i)=>{ if(i%2)return;
    g.beginPath(); g.arc(x+sp*1.05,bot-o.sopr[i]*sp/2,sp*0.14,0,7); g.fill(); }); }
  if(o.bar){ g.strokeStyle='#000'; g.lineWidth=Math.max(2,Math.round(sp*0.12));
    [4,8].forEach(k=>{ const x=(o.x0||150)+(k-0.5)*(o.dx||90);
      g.beginPath(); g.moveTo(x,y0); g.lineTo(x,bot); g.stroke(); }); }
  if(o.lyric!==false){ g.fillStyle='#000'; g.font=Math.round(sp*1.05)+'px sans-serif';
    xs.forEach(x=>g.fillText('오영이미하',x-sp*0.5,bot+sp*2.6)); }
  return c.toDataURL('image/png');
}

const CASES=[
  ['온음계 8음(줄·칸 번갈아)',      {sopr:[0,1,2,3,4,5,6,7]}],
  ['속 빈 머리(2분음표) 섞임',      {sopr:[0,2,4,5,7,5,4,2],hollowAt:[1,4,7]}],
  ['덧줄 위·아래',                  {sopr:[-2,-1,0,4,8,9,10,11],hollowAt:[3]}],
  ['같은 음 반복',                  {sopr:[4,4,4,4,2,2,2,2]}],
  ['SATB 화음 — 소프라노만',        {sopr:[4,5,7,5,4,2,4,5],alto:[0,1,2,1,0,-1,0,1]}],
  ['빔으로 이은 8분음표',           {sopr:[2,4,5,7,5,4,2,0],beam:true,dx:70}],
  ['그랜드 스태프 — 위 오선만',      {sopr:[0,2,4,5,7,5,4,2],grand:true,H:640}],
  ['2분쉼표를 음표로 세지 않기',     {sopr:[4,2,0,2,4,5,7],rest:true}],
  ['점을 음표로 세지 않기',          {sopr:[4,2,0,2,4,5,7,5],dot:true}],
  ['마디선을 음표로 세지 않기',      {sopr:[0,2,4,5,7,5,4,2],bar:true}],
  ['1.5도 기울어진 사진',            {sopr:[0,2,4,5,7,5,4,2],rot:0.026}],
  ['-2.5도 기울어진 사진',           {sopr:[0,2,4,5,7,5,4,2],rot:-0.044}],
  ['저해상도(오선 간격 8px)',        {sopr:[0,2,4,5,7,5,4,2],sp:8,W:600,H:200,dx:40,x0:70,lyric:false}]
];

export default async function geomTest(){
  const rows=[];
  for(const [label,o] of CASES){
    const url=draw(o);
    let geo=null,err=null;
    try{ geo=await staffGeom(url); }catch(e){ err=String(e); }
    const want=o.sopr.map(nm).join(' ');
    const got=geo?geo.notes.map(n=>n.name).join(' '):'(null)';
    rows.push({label,pass:got===want,want,got,err});
  }
  const fails=rows.filter(r=>!r.pass);
  console.table(rows.map(r=>({테스트:r.label,결과:r.pass?'통과':'실패',기대:r.want,실제:r.got})));
  return {passed:rows.length-fails.length,total:rows.length,fails};
}
if(typeof window!=='undefined')window.geomTest=geomTest;

/* ── applyGeomPitch: 개수가 맞을 때만 덮어써야 한다 ─────────────────────────
   이 함수가 잘못 정렬하면 그 단의 멜로디가 통째로 밀린다 — "안 하는 것"이 기본이다. */
export function applyTest(){
  const T=[];
  const t=(label,text,names,expect)=>{
    const r=applyGeomPitch(text,names);
    const got=JSON.stringify({text:r.text,matched:r.matched});
    T.push({label,pass:got===JSON.stringify(expect),got,want:JSON.stringify(expect)});
  };
  t('개수가 같으면 음이름을 덮어쓴다',
    '♪ C4:1 D4:1 E4:1\n[C]가사',['E4','F4','G4'],
    {text:'♪ E4:1 F4:1 G4:1\n[C]가사',matched:true});
  t('쉼표·마디선은 세지 않고 그대로 둔다',
    '♪ C4:1 r:1 | D4:0.5',['E4','G4'],
    {text:'♪ E4:1 r:1 | G4:0.5',matched:true});
  t('개수가 다르면 아무것도 하지 않는다',
    '♪ C4:1 D4:1',['E4','F4','G4'],
    {text:'♪ C4:1 D4:1',matched:false});
  t('음이름이 그대로면 AI가 붙인 임시표를 유지한다',
    '♪ Bb4:1 F#4:1',['B4','F4'],
    {text:'♪ Bb4:1 F#4:1',matched:true});
  t('음이름이 바뀌면 그 임시표는 다른 음 것이므로 뗀다',
    '♪ Bb4:1',['C5'],
    {text:'♪ C5:1',matched:true});
  t('♪ 줄이 두 개로 쪼개졌으면 정렬 근거가 없으므로 손대지 않는다',
    '♪ C4:1 D4:1\n♪ E4:1',['E4','F4','G4'],
    {text:'♪ C4:1 D4:1\n♪ E4:1',matched:false});
  t('♫ 낮은음자리표 줄은 건드리지 않는다',
    '♫ G2:1 G2:1',['A2','B2'],
    {text:'♫ G2:1 G2:1',matched:false});
  t('잰 결과가 없으면 손대지 않는다',
    '♪ C4:1',null,
    {text:'♪ C4:1',matched:false});
  console.table(T.map(r=>({테스트:r.label,결과:r.pass?'통과':'실패',실제:r.got})));
  return {passed:T.filter(r=>r.pass).length,total:T.length,fails:T.filter(r=>!r.pass)};
}
if(typeof window!=='undefined')window.applyTest=applyTest;
