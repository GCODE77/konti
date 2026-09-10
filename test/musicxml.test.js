/* MusicXML 가져오기(parseMusicXML, mxlToXmlText) 회귀 테스트 — 배포에는 포함되지 않는다.
   쓰는 법: 앱을 http(s) 로 열고 콘솔에서
     const m=await import('./test/musicxml.test.js'); await m.default();
   합성 MusicXML을 코드로 직접 만들어 정답을 공짜로 얻는다(geom.test.js와 같은 방식).

   ★ 반드시 지켜야 할 성질:
     - 음이름·박수는 파일에 적힌 값을 그대로 옮긴다(추정하지 않는다).
     - 이음줄(tie)로 이어진 같은 음은 박수를 더해 하나로 합친다.
     - 목소리(voice)·오선(staff) 번호가 여럿이면 가장 작은 번호(=맨 위 목소리)만 남긴다.
     - 코드는 <kind text="…">가 있으면 그걸 우선하고, 없으면 표준 kind 표를 쓴다.
     - 마디 경계는 텍스트에 '|' 문자로 심는다(withBars()가 이 문자로 마디를 나눈다). */

function u16(n){ return [n&0xff,(n>>8)&0xff]; }
function u32(n){ return [n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]; }
function strBytes(s){ return Array.from(new TextEncoder().encode(s)); }

/* 압축 없는(method 0) zip을 손으로 조립한다 — DecompressionStream 없이도
   mxlToXmlText/readZipEntries 의 zip 해석 자체를 검증하기 위해서다. */
function buildStoredZip(files){
  const chunks=[]; let offset=0;
  const push=arr=>{ const u=new Uint8Array(arr); chunks.push(u); offset+=u.length; };
  const localOffsets=[];
  files.forEach(f=>{
    const nameB=strBytes(f.name), data=Array.from(f.data);
    localOffsets.push(offset);
    push([].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(0),
      u32(data.length),u32(data.length),u16(nameB.length),u16(0),nameB,data));
  });
  const cdStart=offset;
  files.forEach((f,i)=>{
    const nameB=strBytes(f.name), data=Array.from(f.data);
    push([].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(0),
      u32(data.length),u32(data.length),u16(nameB.length),u16(0),u16(0),u16(0),u16(0),u32(0),
      u32(localOffsets[i]),nameB));
  });
  const cdSize=offset-cdStart;
  push([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdSize),u32(cdStart),u16(0)));
  let total=0; chunks.forEach(c=>total+=c.length);
  const out=new Uint8Array(total); let p=0;
  chunks.forEach(c=>{ out.set(c,p); p+=c.length; });
  return out;
}

function xmlNote(o){
  if(o.rest)return '<note><rest/><duration>'+o.dur+'</duration>'
    +(o.voice?'<voice>'+o.voice+'</voice>':'')+(o.staff?'<staff>'+o.staff+'</staff>':'')+'</note>';
  let tie='';
  if(o.tieStart)tie+='<tie type="start"/>';
  if(o.tieStop)tie+='<tie type="stop"/>';
  let lyric='';
  if(o.lyricText)lyric='<lyric><syllable-type>'+(o.lyricType||'single')+'</syllable-type><text>'+o.lyricText+'</text></lyric>';
  return '<note><pitch><step>'+o.step+'</step>'+(o.alter?'<alter>'+o.alter+'</alter>':'')
    +'<octave>'+o.octave+'</octave></pitch><duration>'+o.dur+'</duration>'+tie
    +(o.voice?'<voice>'+o.voice+'</voice>':'')+(o.staff?'<staff>'+o.staff+'</staff>':'')+lyric+'</note>';
}
function xmlHarmony(h){
  return '<harmony><root><root-step>'+h.step+'</root-step>'
    +(h.alter?'<root-alter>'+h.alter+'</root-alter>':'')+'</root>'
    +'<kind'+(h.text?' text="'+h.text+'"':'')+'>'+(h.kind||'major')+'</kind>'
    +(h.bass?'<bass><bass-step>'+h.bass+'</bass-step></bass>':'')+'</harmony>';
}
function buildXML(measures,opts){
  opts=opts||{};
  let out='<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">'
    +'<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>'
    +'<part id="P1">';
  measures.forEach((m,i)=>{
    out+='<measure number="'+(i+1)+'">';
    if(i===0){
      out+='<attributes><divisions>'+(opts.divisions||1)+'</divisions>';
      if(opts.time)out+='<time><beats>'+opts.time[0]+'</beats><beat-type>'+opts.time[1]+'</beat-type></time>';
      out+='</attributes>';
      if(opts.tempo)out+='<direction><sound tempo="'+opts.tempo+'"/></direction>';
    }
    (m.items||[]).forEach(it=>{ out+=it.harmony?xmlHarmony(it.harmony):xmlNote(it); });
    out+='</measure>';
  });
  out+='</part></score-partwise>';
  return out;
}

const CASES=[
  ['온음계 4음 + 코드 하나',
    [{items:[{harmony:{step:'C',kind:'major'}},
      {step:'C',octave:4,dur:1},{step:'D',octave:4,dur:1},{step:'E',octave:4,dur:1},{step:'F',octave:4,dur:1}]}],
    {},
    '♪ C4:1 D4:1 E4:1 F4:1\n[C]'],
  ['가사 낱말 잇기(begin/middle/end/single)',
    [{items:[{harmony:{step:'C',kind:'major'}},
      {step:'C',octave:4,dur:1,lyricType:'begin',lyricText:'하'},
      {step:'D',octave:4,dur:1,lyricType:'middle',lyricText:'나'},
      {step:'E',octave:4,dur:1,lyricType:'end',lyricText:'님'},
      {step:'F',octave:4,dur:1,lyricType:'single',lyricText:'은'}]}],
    {},
    '♪ C4:1 D4:1 E4:1 F4:1\n[C]하나님은'],
  ['마디 경계는 |로, 코드가 바뀌면 새 쌍으로',
    [{items:[{harmony:{step:'C',kind:'major'}},{step:'C',octave:4,dur:1,lyricType:'single',lyricText:'가'}]},
     {items:[{harmony:{step:'G',kind:'major'}},{step:'D',octave:4,dur:1,lyricType:'single',lyricText:'나'}]}],
    {},
    '♪ C4:1 | D4:1\n[C]가|[G]나'],
  ['이음줄로 이어진 같은 음은 박수를 더한다',
    [{items:[{step:'C',octave:4,dur:1,tieStart:true},{step:'C',octave:4,dur:1,tieStop:true},{step:'D',octave:4,dur:2}]}],
    {},
    '♪ C4:2 D4:2'],
  ['쉼표는 이어서 더한다',
    [{items:[{step:'C',octave:4,dur:1},{rest:true,dur:1},{rest:true,dur:1},{step:'D',octave:4,dur:1}]}],
    {},
    '♪ C4:1 r:2 D4:1'],
  ['목소리 번호가 여럿이면 가장 작은 번호만(맨 위 목소리)',
    [{items:[{step:'G',octave:5,dur:1,voice:'2'},{step:'C',octave:4,dur:1,voice:'1'},
      {step:'D',octave:4,dur:1,voice:'1'},{step:'A',octave:5,dur:1,voice:'2'}]}],
    {},
    '♪ C4:1 D4:1'],
  ['코드 종류 매핑(minor)',
    [{items:[{harmony:{step:'A',kind:'minor'}},{step:'A',octave:3,dur:4}]}],
    {},
    '♪ A3:4\n[Am]'],
  ['<kind text> 가 있으면 매핑표보다 우선한다',
    [{items:[{harmony:{step:'G',kind:'dominant-ninth',text:'9sus4'}},{step:'G',octave:3,dur:4}]}],
    {},
    '♪ G3:4\n[G9sus4]'],
  ['베이스 음(분수 코드)',
    [{items:[{harmony:{step:'C',kind:'major',bass:'E'}},{step:'C',octave:4,dur:4}]}],
    {},
    '♪ C4:4\n[C/E]'],
  ['플랫 근음(root-alter=-1)',
    [{items:[{harmony:{step:'B',alter:-1,kind:'major'}},{step:'B',octave:4,alter:-1,dur:4}]}],
    {},
    '♪ Bb4:4\n[Bb]'],
];

export default async function musicxmlTest(){
  const rows=[];
  for(const [label,measures,opts,want] of CASES){
    const xml=buildXML(measures,opts);
    let got=null,err=null;
    try{ got=parseMusicXML(xml).text; }catch(e){ err=String(e); }
    rows.push({label,pass:got===want,want,got:err?('(오류) '+err):got});
  }
  /* .mxl(zip) 컨테이너 경로 — 압축 없는 zip으로 readZipEntries/mxlToXmlText 배관을 검증한다 */
  {
    const score=buildXML(CASES[0][1],CASES[0][2]);
    const container='<?xml version="1.0"?><container><rootfiles>'
      +'<rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>'
      +'</rootfiles></container>';
    const zip=buildStoredZip([
      {name:'META-INF/container.xml',data:new TextEncoder().encode(container)},
      {name:'score.xml',data:new TextEncoder().encode(score)}
    ]);
    let got=null,err=null;
    try{
      const xmlOut=await mxlToXmlText(zip.buffer);
      got=parseMusicXML(xmlOut).text;
    }catch(e){ err=String(e); }
    rows.push({label:'.mxl(zip) 압축 컨테이너에서 꺼내 읽기',pass:got===CASES[0][3],want:CASES[0][3],got:err?('(오류) '+err):got});
  }
  const fails=rows.filter(r=>!r.pass);
  console.table(rows.map(r=>({테스트:r.label,결과:r.pass?'통과':'실패',기대:r.want,실제:r.got})));
  return {passed:rows.length-fails.length,total:rows.length,fails};
}
if(typeof window!=='undefined')window.musicxmlTest=musicxmlTest;
