/* 손으로 찍은 사진 경로 회귀 테스트(v55) — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/photo.test.js'); await m.default();

   왜 생겼나. 같은 실수를 세 번 했다 —
   **내가 직접 깨끗하게 잘라 낸 그림으로만 재고 "된다"고 결론 내렸다.**
   실제 사용자 사진에서는 전부 실패하고 있었는데 그걸 못 봤다:
     v53: 보정(대비·밝기) 사본에서 재고 있어서 오선이 통째로 사라짐 → 멜로디 0음
     v55: 책상 여백 + 1.5도 기울기만으로 단 6개가 2개로 떨어지고 측정 전부 실패
   그래서 이 테스트는 **일부러 사진처럼 망가뜨린 그림**을 만들어 넣는다:
     · 종이 둘레에 책상(어두운 배경)
     · 1~3도 기울기
     · 한쪽은 그늘지고 한쪽은 번들거리는 조명
     · JPEG 손실
   그리고 반드시 `prepImage` 부터 태운다 — 앱이 실제로 지나는 길과 같아야 의미가 있다.

   ★ 지키는 성질: **단을 다 찾고, 그 단에서 음표를 잰다.** 개수가 완벽할 필요는 없지만
     0이면 안 된다(0이 곧 "인식이 하나도 안 된다"는 신고다). */

const T=[]; let pass=0, fail=0;
function ok(name,cond,got){
  T.push({name,cond}); if(cond)pass++; else {fail++; console.error('✗ '+name, got!==undefined?got:'');}
}

/* 오선 여러 단이 있는 '악보 한 쪽'을 그린다 */
function drawPage(o){
  o=o||{};
  const sysN=o.sysN||4, sp=o.sp||14, W=o.W||1000;
  const padTop=70, gap=sp*9, H=padTop+gap*sysN+60;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  const steps=[0,2,4,5,7,5,4,2,0,2,4,5];
  for(let s=0;s<sysN;s++){
    const top=padTop+s*gap, bot=top+4*sp;
    g.strokeStyle='#000'; g.lineWidth=Math.max(1,Math.round(sp*0.09));
    for(let k=0;k<5;k++){ const y=top+k*sp; g.beginPath(); g.moveTo(40,y); g.lineTo(W-40,y); g.stroke(); }
    g.lineWidth=Math.round(sp*0.3);                       // 자리표 흉내
    g.beginPath(); g.moveTo(58,top-sp*1.3); g.lineTo(58,bot+sp*1.3); g.stroke();
    const n=10, x0=120, dx=(W-200)/n;
    for(let i=0;i<n;i++){
      const st=steps[(i+s)%steps.length], cy=bot-st*sp/2, x=x0+i*dx;
      g.save(); g.translate(x,cy); g.rotate(-0.32);
      g.beginPath(); g.ellipse(0,0,sp*0.6,sp*0.42,0,0,Math.PI*2); g.fillStyle='#000'; g.fill(); g.restore();
      g.lineWidth=Math.max(1,Math.round(sp*0.1)); g.strokeStyle='#000';
      const up=st<4, sx=up?x+sp*0.56:x-sp*0.56;
      g.beginPath(); g.moveTo(sx,cy); g.lineTo(sx,up?cy-sp*3.5:cy+sp*3.5); g.stroke();
      if(i===4||i===7){ g.lineWidth=Math.max(1,Math.round(sp*0.11));   // 마디선
        g.beginPath(); g.moveTo(x-dx*0.5,top); g.lineTo(x-dx*0.5,bot); g.stroke(); }
    }
    g.fillStyle='#000'; g.font=Math.round(sp*0.95)+'px sans-serif';
    for(let i=0;i<n;i++)g.fillText('은혜',x0+i*dx-sp*0.6,bot+sp*2.4);
    g.font='bold '+Math.round(sp*0.9)+'px serif';
    for(let i=0;i<n;i+=2)g.fillText('C',x0+i*dx,top-sp*0.8);
  }
  return c;
}
/* 그 쪽을 '손으로 찍은 사진'처럼 망가뜨린다 */
function asPhoto(page,o){
  o=o||{};
  const W=Math.round(page.width*1.22), H=Math.round(page.height*1.18);
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle=o.bg||'#6b6257'; g.fillRect(0,0,W,H);          // 책상
  g.save();
  g.translate(W/2,H/2); g.rotate((o.rot||0)*Math.PI/180); g.translate(-page.width/2,-page.height/2);
  g.fillStyle='#fff'; g.fillRect(-16,-16,page.width+32,page.height+32);
  g.drawImage(page,0,0);
  g.restore();
  if(o.light!==false){                                        // 한쪽 그늘 / 한쪽 번들거림
    const gr=g.createLinearGradient(0,0,W,H);
    gr.addColorStop(0,'rgba(0,0,0,0.24)');
    gr.addColorStop(0.5,'rgba(0,0,0,0)');
    gr.addColorStop(1,'rgba(255,255,255,0.22)');
    g.fillStyle=gr; g.fillRect(0,0,W,H);
  }
  return c.toDataURL('image/jpeg',o.q||0.8);
}

const CASES=[
  ['스캔한 것처럼(기울기·조명 없음)', {rot:0,light:false,q:0.95}],
  ['책상 위에 반듯하게',              {rot:0}],
  ['1.5도 기울어짐',                  {rot:1.5}],
  ['-2도 기울어짐 + 조명 얼룩',        {rot:-2,q:0.78}],
  ['3도 기울어짐',                    {rot:3,q:0.8}],
  ['어두운 데서 찍음',                 {rot:1,q:0.72,bg:'#2a2622'}]
];

export default async function photoTest(){
  T.length=0; pass=0; fail=0;
  const keep=S.photos;
  const page=drawPage({sysN:4,sp:14,W:1000});
  try{
    for(const [label,opt] of CASES){
      let sys=0, measured=0, notes=0, err=null;
      try{
        const url=asPhoto(page,opt);
        const blob=await (await fetch(url)).blob();
        /* ★ 반드시 prepImage 부터 — 앱이 지나는 길과 같아야 한다 */
        const ph=await prepImage(new File([blob],'p.jpg',{type:'image/jpeg'}));
        const parts=await splitSystems(ph.hiUrl||ph.url);
        sys=parts?parts.length:0;
        if(parts)for(const pt of parts){
          const geo=await staffGeom(pt.url);
          if(geo){ measured++; notes+=geo.notes.length; }
        }
      }catch(e){ err=String(e); }
      ok(label+' — 단을 4개 찾는다 (실제 '+sys+')',sys===4,{sys,err});
      ok(label+' — 단마다 오선을 잰다 (실제 '+measured+'/4)',measured>=3,{measured,err});
      ok(label+' — 음표를 찾는다 (실제 '+notes+'음)',notes>=20,{notes,err});
    }
    /* 사진을 펴는 단계가 실제로 일을 하는지 — 기울인 그림이 반듯해져야 한다 */
    const tilted=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=asPhoto(page,{rot:2.5});});
    const fixed=await deskewPaper(tilted);
    ok('펴고 나면 배경(책상)이 잘려 나간다',fixed.width<tilted.width*0.95,
       {before:tilted.width,after:fixed.width});
    const angAfter=Math.abs(bestSkew(await imgFrom(fixed.toDataURL('image/jpeg',.95)))*180/Math.PI);
    ok('펴고 나면 남은 기울기가 0.7도 미만 (실제 '+angAfter.toFixed(2)+'도)',angAfter<0.7,angAfter);
  }finally{ S.photos=keep; }
  console.table(T.map(t=>({검사:t.name,결과:t.cond?'통과':'실패'})));
  console.log((fail?'✗ ':'✓ ')+'photo: '+pass+' 통과 / '+fail+' 실패');
  return {pass,fail};
}
if(typeof window!=='undefined')window.photoTest=photoTest;
