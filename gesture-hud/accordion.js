const canvas=document.querySelector('#accordionStage'),ctx=canvas.getContext('2d');
const stretchEl=document.querySelector('#accordionStretch'),distanceEl=document.querySelector('#distanceVal'),noteEl=document.querySelector('#noteVal'),volumeEl=document.querySelector('#volumeVal'),actionEl=document.querySelector('#actionState'),resetBtn=document.querySelector('#resetBtn'),toast=document.querySelector('#toast'),startBtn=document.querySelector('#startBtn');

let dpr=1,w=innerWidth,h=innerHeight,left=null,right=null,targetLeft=null,targetRight=null;
let prevLeft=null,prevRight=null,lastDistance=null,lastTime=performance.now(),stretch=0,speed=0,demo=false,demoT=0,bounce=0;
let audioCtx=null,master=null,oscillators=[],currentFreq=220,lastNote='A3';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SCALE=[
  {name:'C3',f:130.81},{name:'D3',f:146.83},{name:'E3',f:164.81},{name:'G3',f:196.00},{name:'A3',f:220.00},
  {name:'C4',f:261.63},{name:'D4',f:293.66},{name:'E4',f:329.63},{name:'G4',f:392.00},{name:'A4',f:440.00},{name:'C5',f:523.25}
];

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize);resize();

function toastMsg(text,ms=650){toast.textContent=text;toast.classList.add('show');clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove('show'),ms)}
function pairSorted(a,b){return[a,b].sort((p,q)=>p.x-q.x)}

function initAudio(){
  if(audioCtx)return;
  try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    master=audioCtx.createGain();master.gain.value=0;
    const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;filter.Q.value=.7;
    master.connect(filter).connect(audioCtx.destination);
    const defs=[['sawtooth',1,.18],['square',2,.055],['triangle',.5,.09]];
    oscillators=defs.map(([type,mul,g])=>{
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type=type;osc.frequency.value=currentFreq*mul;gain.gain.value=g;osc.connect(gain).connect(master);osc.start();
      return{osc,gain,mul};
    });
  }catch{}
}
function wakeAudio(){initAudio();if(audioCtx?.state==='suspended')audioCtx.resume()}
startBtn?.addEventListener('click',wakeAudio,{passive:true});
resetBtn?.addEventListener('click',wakeAudio,{passive:true});

function setAudio(freq,level){
  if(!audioCtx||!master)return;
  const t=audioCtx.currentTime;
  currentFreq=freq;
  for(const o of oscillators)o.osc.frequency.setTargetAtTime(freq*o.mul,t,.035);
  master.gain.setTargetAtTime(clamp(level,0,.22),t,.045);
}
function silence(){if(audioCtx&&master)master.gain.setTargetAtTime(0,audioCtx.currentTime,.08)}

function noteForStretch(v){const idx=clamp(Math.round(v*(SCALE.length-1)),0,SCALE.length-1);return SCALE[idx]}

function updateTelemetry(d,now){
  const short=Math.min(w,h),minD=short*.18,maxD=short*.90;
  stretch=clamp((d-minD)/(maxD-minD),0,1);
  const dt=Math.max(16,now-lastTime);
  if(lastDistance!==null)speed=speed*.72+((d-lastDistance)/dt)*.28;
  lastDistance=d;lastTime=now;

  const note=noteForStretch(stretch);lastNote=note.name;
  const motion=clamp(Math.abs(speed)*4.8,0,1);
  const volume=clamp(.025+motion*.19+(stretch>.1?.018:0),0,.22);
  setAudio(note.f,volume);

  stretchEl.textContent=`${Math.round(stretch*100)}%`;
  distanceEl.textContent=`${Math.round(d)} px`;
  noteEl.textContent=note.name;
  volumeEl.textContent=`${Math.round(volume/.22*100)}%`;
  if(speed>.18)actionEl.textContent='拉開 ♪';
  else if(speed<-.18)actionEl.textContent='壓回 ♪';
  else if(stretch<.14)actionEl.textContent='收合';
  else actionEl.textContent='持續演奏';
}

function setTargets(a,b,now){
  const pair=pairSorted(a,b);targetLeft={...pair[0]};targetRight={...pair[1]};
  if(prevLeft&&prevRight){
    const vy=(Math.abs(targetLeft.y-prevLeft.y)+Math.abs(targetRight.y-prevRight.y))*.5;
    bounce=clamp(bounce+vy*.018,0,1.4);
  }
  prevLeft={...targetLeft};prevRight={...targetRight};
  const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y);
  updateTelemetry(d,now);
}

addEventListener('qookey-frame',e=>{
  demo=false;const hands=e.detail?.hands||[],now=e.detail?.now||performance.now();
  if(hands.length>=2)setTargets(hands[0].palm,hands[1].palm,now);
  else{
    targetLeft=targetRight=null;left=right=null;prevLeft=prevRight=null;lastDistance=null;speed=0;silence();
    stretchEl.textContent='0%';distanceEl.textContent='—';noteEl.textContent='—';volumeEl.textContent='0%';
    actionEl.textContent=hands.length===1?'再放一隻手':'等待雙手';
  }
});

addEventListener('qookey-demo',()=>{
  wakeAudio();demo=true;demoT=0;lastDistance=null;speed=0;bounce=.25;toastMsg('DEMO 🪗');
});

resetBtn.addEventListener('click',()=>{
  targetLeft=targetRight=left=right=null;prevLeft=prevRight=null;lastDistance=null;stretch=0;speed=0;bounce=0;silence();
  stretchEl.textContent='0%';distanceEl.textContent='—';noteEl.textContent='—';volumeEl.textContent='0%';actionEl.textContent='等待雙手';toastMsg('RESET');
});

function frame(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;return{dx,dy,d,ang:Math.atan2(dy,dx)}}

function roundedRect(x,y,width,height,r){
  const rr=Math.min(r,width/2,height/2);ctx.beginPath();ctx.roundRect(x,y,width,height,rr);
}

function drawEndBox(x,y,flip=false){
  const bw=82,bh=154;
  ctx.save();ctx.translate(x,y);
  const g=ctx.createLinearGradient(-bw/2,0,bw/2,0);g.addColorStop(0,'#4a180f');g.addColorStop(.45,'#8d3e22');g.addColorStop(1,'#3b120d');
  ctx.shadowColor='rgba(255,174,92,.28)';ctx.shadowBlur=18;ctx.fillStyle=g;ctx.strokeStyle='rgba(255,218,157,.62)';ctx.lineWidth=2;
  roundedRect(-bw/2,-bh/2,bw,bh,17);ctx.fill();ctx.stroke();ctx.shadowBlur=0;

  ctx.fillStyle='rgba(26,8,5,.78)';roundedRect(-bw*.31,-bh*.36,bw*.62,bh*.72,11);ctx.fill();
  ctx.fillStyle='#f2dfbd';
  if(!flip){
    for(let i=0;i<7;i++){const yy=-48+i*16;roundedRect(-18,yy,36,9,4);ctx.fill()}
  }else{
    for(let r=0;r<4;r++)for(let c=0;c<3;c++){ctx.beginPath();ctx.arc(-18+c*18,-36+r*24,5.2,0,Math.PI*2);ctx.fill()}
  }
  ctx.strokeStyle='rgba(255,225,170,.26)';ctx.lineWidth=1;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-31,-55+i*36);ctx.lineTo(31,-55+i*36);ctx.stroke()}
  ctx.restore();
}

function drawBellows(d){
  const leftEdge=41,rightEdge=Math.max(42,d-41),span=Math.max(1,rightEdge-leftEdge);
  const folds=Math.round(7+stretch*10),step=span/folds,halfH=55+Math.sin(performance.now()*.009)*bounce*5;
  const squeeze=1-stretch;
  ctx.save();
  ctx.fillStyle='rgba(51,12,16,.96)';ctx.strokeStyle='rgba(246,184,116,.55)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(leftEdge,-halfH);
  for(let i=0;i<=folds;i++){const x=leftEdge+i*step,zig=(i%2?7:-7)*(1+squeeze*.45);ctx.lineTo(x,-halfH+zig)}
  ctx.lineTo(rightEdge,halfH);
  for(let i=folds;i>=0;i--){const x=leftEdge+i*step,zig=(i%2?7:-7)*(1+squeeze*.45);ctx.lineTo(x,halfH-zig)}
  ctx.closePath();ctx.fill();ctx.stroke();

  for(let i=0;i<=folds;i++){
    const x=leftEdge+i*step,alpha=.24+.35*(i%2);
    ctx.strokeStyle=`rgba(255,214,145,${alpha})`;ctx.beginPath();ctx.moveTo(x,-halfH+5);ctx.lineTo(x,halfH-5);ctx.stroke();
  }
  const shine=ctx.createLinearGradient(leftEdge,-halfH,rightEdge,halfH);shine.addColorStop(0,'rgba(255,230,181,.12)');shine.addColorStop(.5,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(255,183,108,.10)');ctx.fillStyle=shine;ctx.fillRect(leftEdge,-halfH,span,halfH*2);
  ctx.restore();
}

function drawNotes(midX,midY,now){
  if(Math.abs(speed)<.08)return;
  ctx.save();ctx.font='700 19px Georgia,serif';ctx.textAlign='center';
  const count=3;for(let i=0;i<count;i++){
    const phase=now*.002+i*1.7,life=(Math.sin(phase)*.5+.5),x=midX+Math.cos(phase*1.8+i)*38,y=midY-65-i*22-life*18;
    ctx.globalAlpha=.22+life*.48;ctx.fillStyle='#ffd99a';ctx.fillText(i%2?'♪':'♫',x,y);
  }ctx.restore();
}

function drawAccordion(now){
  if(!left||!right)return;
  const f=frame(left,right),midX=(left.x+right.x)/2,midY=(left.y+right.y)/2;
  ctx.save();ctx.translate(left.x,left.y);ctx.rotate(f.ang);
  const bob=Math.sin(now*.015)*bounce*4;ctx.translate(0,bob);
  drawBellows(f.d);drawEndBox(0,0,true);drawEndBox(f.d,0,false);
  ctx.restore();
  drawNotes(midX,midY,now);
}

function drawWaiting(){ctx.save();ctx.textAlign='center';ctx.fillStyle='rgba(255,232,195,.64)';ctx.font='600 15px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText('把兩隻手放進畫面，開始拉手風琴 🪗',w/2,h*.52);ctx.restore()}

function render(now){
  ctx.clearRect(0,0,w,h);
  if(demo){
    demoT+=.018;const span=w*(.12+.19*(Math.sin(demoT*.82)*.5+.5)),cy=h*.49+Math.sin(demoT*.7)*28;
    targetLeft={x:w/2-span,y:cy+Math.sin(demoT*1.25)*24};targetRight={x:w/2+span,y:cy-Math.sin(demoT*1.12)*24};
    const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y);updateTelemetry(d,now);bounce=.45+Math.abs(Math.sin(demoT*1.5))*.35;
  }
  if(targetLeft&&targetRight){
    left=left||{...targetLeft};right=right||{...targetRight};
    left.x+=(targetLeft.x-left.x)*.42;left.y+=(targetLeft.y-left.y)*.56;
    right.x+=(targetRight.x-right.x)*.42;right.y+=(targetRight.y-right.y)*.56;
    drawAccordion(now);
  }else drawWaiting();
  bounce*=.92;requestAnimationFrame(render);
}
requestAnimationFrame(render);
