const canvas=document.querySelector('#noodleStage'),ctx=canvas.getContext('2d');
const lengthEl=document.querySelector('#noodleLength'),distanceEl=document.querySelector('#distanceVal'),thicknessEl=document.querySelector('#thicknessVal'),actionEl=document.querySelector('#actionState'),tensionEl=document.querySelector('#tensionVal'),resetBtn=document.querySelector('#resetBtn'),toast=document.querySelector('#toast'),startBtn=document.querySelector('#startBtn');

let dpr=1,w=innerWidth,h=innerHeight,left=null,right=null,targetLeft=null,targetRight=null,stretch=0,velocity=0,lastDistance=null,lastTime=performance.now(),demo=false,demoT=0,wobble=0;
let ropes=[],broken=false,overstretchSince=0,reconnectSince=0,snapFlash=0,breakPoint={x:0,y:0},crumbs=[],audioCtx=null,leftMoveY=0,rightMoveY=0,prevTargetLeft=null,prevTargetRight=null,lastNearBreakToast=0;

// V7: stiffer, springier "Q noodle" tuning.
const STRANDS=8,POINTS=28;
const GRAVITY=.20;
const VELOCITY_DAMPING=.935;
const CONSTRAINT_PASSES=10;
const SHAPE_SPRING=.115;
const BEND_SPRING=.075;
const BREAK_HOLD_MS=760;

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ropes=[];
}
addEventListener('resize',resize);resize();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function toastMsg(text,ms=680){toast.textContent=text;toast.classList.add('show');clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove('show'),ms)}
function ensureAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
startBtn?.addEventListener('click',ensureAudio,{passive:true});
resetBtn?.addEventListener('click',ensureAudio,{passive:true});

function snapSound(){
  if(!audioCtx)return;
  const now=audioCtx.currentTime,length=Math.max(1,Math.floor(audioCtx.sampleRate*.075));
  const buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const fade=1-i/length;data[i]=(Math.random()*2-1)*fade*fade}
  const src=audioCtx.createBufferSource(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();
  filter.type='highpass';filter.frequency.value=1200;
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.28,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+.08);
  src.buffer=buffer;src.connect(filter).connect(gain).connect(audioCtx.destination);src.start(now);
  const osc=audioCtx.createOscillator(),og=audioCtx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(155,now);osc.frequency.exponentialRampToValueAtTime(72,now+.08);
  og.gain.setValueAtTime(.0001,now);og.gain.exponentialRampToValueAtTime(.11,now+.004);og.gain.exponentialRampToValueAtTime(.0001,now+.09);
  osc.connect(og).connect(audioCtx.destination);osc.start(now);osc.stop(now+.1);
}

function pairSorted(a,b){return[a,b].sort((p,q)=>p.x-q.x)}
function getBreakDistance(){return Math.min(w,h)*.98}
function getReconnectDistance(){return Math.min(w,h)*.27}
function tensionFromDistance(d){return clamp(d/getBreakDistance(),0,1.18)}

function updateTelemetry(d){
  const breakDistance=getBreakDistance(),tension=tensionFromDistance(d);
  const norm=clamp((d-Math.min(w,h)*.12)/(breakDistance-Math.min(w,h)*.12),0,1);
  stretch=norm;
  lengthEl.textContent=`${Math.round(stretch*100)}%`;
  distanceEl.textContent=`${Math.round(d)} px`;
  const thick=clamp(16-stretch*6.8,8.2,16);
  thicknessEl.textContent=`${thick.toFixed(1)} px`;
  if(tensionEl)tensionEl.textContent=broken?'已斷':tension>.96?'極限':tension>.84?'緊繃':'Q彈';
  if(broken)actionEl.textContent='麵斷了！雙手靠近接新麵';
  else if(tension>.97)actionEl.textContent='極限拉伸！再撐一下才會斷';
  else if(tension>.84)actionEl.textContent='很Q！正在回彈';
  else if(stretch<.23)actionEl.textContent='靠近';
  else actionEl.textContent='Q彈拉麵中';
}

function setTargets(a,b,now){
  const pair=pairSorted(a,b);targetLeft={...pair[0]};targetRight={...pair[1]};
  if(prevTargetLeft&&prevTargetRight){
    leftMoveY=leftMoveY*.42+(targetLeft.y-prevTargetLeft.y)*.58;
    rightMoveY=rightMoveY*.42+(targetRight.y-prevTargetRight.y)*.58;
  }else leftMoveY=rightMoveY=0;
  prevTargetLeft={...targetLeft};prevTargetRight={...targetRight};

  const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y),dt=Math.max(16,now-lastTime);
  if(lastDistance!==null){
    const dv=(d-lastDistance)/dt;velocity=velocity*.68+dv*.32;
    if(!broken&&velocity>.68&&d>Math.min(w,h)*.42){wobble=Math.min(1.65,wobble+1);toastMsg('Q彈甩麵！')}
  }
  lastDistance=d;lastTime=now;updateTelemetry(d);

  const breakDistance=getBreakDistance();
  if(!broken&&d>breakDistance){
    overstretchSince=overstretchSince||now;
    if(now-overstretchSince>BREAK_HOLD_MS)breakNoodle();
  }else overstretchSince=0;

  if(!broken&&d>breakDistance*.94&&now-lastNearBreakToast>1800){
    lastNearBreakToast=now;toastMsg('已到極限，要再撐一下才會斷！',900);
  }

  if(broken&&d<getReconnectDistance()){
    reconnectSince=reconnectSince||now;
    if(now-reconnectSince>620)reconnectNoodle();
  }else reconnectSince=0;
}

addEventListener('qookey-frame',e=>{
  demo=false;const hands=e.detail?.hands||[],now=e.detail?.now||performance.now();
  if(hands.length>=2)setTargets(hands[0].palm,hands[1].palm,now);
  else{
    targetLeft=targetRight=null;lastDistance=null;prevTargetLeft=prevTargetRight=null;velocity*=.8;
    lengthEl.textContent='0%';distanceEl.textContent='—';thicknessEl.textContent='—';
    if(tensionEl)tensionEl.textContent=broken?'已斷':'—';
    actionEl.textContent=hands.length===1?'再放一隻手':'等待雙手';
  }
});

addEventListener('qookey-demo',()=>{demo=true;demoT=0;broken=false;ropes=[];actionEl.textContent='Demo Q彈拉麵中';lengthEl.textContent='55%';if(tensionEl)tensionEl.textContent='Q彈'});

resetBtn.addEventListener('click',()=>{
  targetLeft=targetRight=left=right=null;prevTargetLeft=prevTargetRight=null;lastDistance=null;
  stretch=0;velocity=0;wobble=0;broken=false;ropes=[];crumbs=[];snapFlash=0;overstretchSince=reconnectSince=0;
  lengthEl.textContent='0%';distanceEl.textContent='—';thicknessEl.textContent='—';if(tensionEl)tensionEl.textContent='—';actionEl.textContent='等待雙手';toastMsg('RESET');
});

function getPerp(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;return{x:-dy/d,y:dx/d}}

function initRopes(a,b){
  const perp=getPerp(a,b);ropes=[];
  for(let s=0;s<STRANDS;s++){
    const off=(s-(STRANDS-1)/2)*4.6,pts=[];
    for(let i=0;i<POINTS;i++){
      const t=i/(POINTS-1),sag=Math.sin(Math.PI*t)*16;
      const x=a.x+(b.x-a.x)*t+perp.x*off,y=a.y+(b.y-a.y)*t+perp.y*off+sag;
      pts.push({x,y,px:x,py:y});
    }
    ropes.push({pts,breakAt:Math.floor((POINTS-1)/2)+(s%3)-1});
  }
}

function pinPoint(p,target){p.x=target.x;p.y=target.y;p.px=target.x;p.py=target.y}

function integrateRopes(now){
  if(!left||!right)return;
  if(!ropes.length)initRopes(left,right);

  const perp=getPerp(left,right),d=Math.hypot(right.x-left.x,right.y-left.y),tension=tensionFromDistance(d);
  // Less spare length = visibly firmer noodle. It still stretches, but snaps back quickly.
  const slack=clamp(42-tension*24,14,42),restTotal=d+slack,seg=restTotal/(POINTS-1);
  const upDownGain=broken?.055:.145;

  for(let s=0;s<ropes.length;s++){
    const rope=ropes[s],pts=rope.pts,off=(s-(STRANDS-1)/2)*4.6;

    for(let i=1;i<POINTS-1;i++){
      const p=pts[i],vx=(p.x-p.px)*VELOCITY_DAMPING,vy=(p.y-p.py)*VELOCITY_DAMPING;
      p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+GRAVITY;

      const t=i/(POINTS-1);
      const handKick=(leftMoveY*(1-t)+rightMoveY*t)*upDownGain;
      p.py-=handKick;

      // Spring back toward a shallow, taut rest curve so it feels Q rather than cloth-like.
      const baseX=left.x+(right.x-left.x)*t+perp.x*off;
      const baseY=left.y+(right.y-left.y)*t+perp.y*off+Math.sin(Math.PI*t)*clamp(23-tension*12,8,23);
      p.x+=(baseX-p.x)*SHAPE_SPRING;
      p.y+=(baseY-p.y)*SHAPE_SPRING;

      const wave=(Math.sin(now*.021+t*19+s*.83)*wobble*2.7+Math.sin(now*.012+t*11+s)*Math.abs(velocity)*3.4)*Math.sin(Math.PI*t);
      p.x+=perp.x*wave;p.y+=perp.y*wave;
    }

    // Small bend spring keeps neighboring points from folding into a soft rope.
    for(let i=1;i<POINTS-1;i++){
      const prev=pts[i-1],p=pts[i],next=pts[i+1];
      p.x+=((prev.x+next.x)*.5-p.x)*BEND_SPRING;
      p.y+=((prev.y+next.y)*.5-p.y)*BEND_SPRING;
    }

    const lTarget={x:left.x+perp.x*off,y:left.y+perp.y*off},rTarget={x:right.x+perp.x*off,y:right.y+perp.y*off};
    pinPoint(pts[0],lTarget);pinPoint(pts[POINTS-1],rTarget);

    for(let pass=0;pass<CONSTRAINT_PASSES;pass++){
      for(let i=0;i<POINTS-1;i++){
        if(broken&&i===rope.breakAt)continue;
        const p1=pts[i],p2=pts[i+1],dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy)||.001,diff=(len-seg)/len*.5,ox=dx*diff,oy=dy*diff;
        if(i!==0){p1.x+=ox;p1.y+=oy}
        if(i+1!==POINTS-1){p2.x-=ox;p2.y-=oy}
      }
      pinPoint(pts[0],lTarget);pinPoint(pts[POINTS-1],rTarget);
    }
  }

  leftMoveY*=.78;rightMoveY*=.78;
}

function drawRopes(){
  if(!ropes.length)return;
  const d=left&&right?Math.hypot(right.x-left.x,right.y-left.y):0,tension=tensionFromDistance(d),baseThickness=clamp(16-stretch*6.8,8.2,16);
  for(let s=0;s<ropes.length;s++){
    const rope=ropes[s],segments=broken?[[0,rope.breakAt],[rope.breakAt+1,POINTS-1]]:[[0,POINTS-1]];
    for(const [start,end] of segments){
      if(end-start<1)continue;ctx.beginPath();
      for(let i=start;i<=end;i++){
        const p=rope.pts[i];
        if(i===start)ctx.moveTo(p.x,p.y);
        else{const prev=rope.pts[i-1],mx=(prev.x+p.x)/2,my=(prev.y+p.y)/2;ctx.quadraticCurveTo(prev.x,prev.y,mx,my)}
      }
      ctx.lineCap='round';ctx.lineJoin='round';
      const hot=clamp((tension-.84)/.16,0,1);
      ctx.strokeStyle=s%2?`rgba(255,${Math.round(231-22*hot)},${Math.round(172-35*hot)},.98)`:`rgba(255,${Math.round(245-30*hot)},${Math.round(207-48*hot)},.99)`;
      ctx.lineWidth=baseThickness*(s%2?.68:.84);
      ctx.shadowColor=hot>.45?'rgba(255,145,76,.32)':'rgba(255,196,99,.26)';ctx.shadowBlur=9+hot*6;ctx.stroke();
    }
  }
  ctx.shadowBlur=0;drawHandle(left);drawHandle(right);
}

function drawHandle(p){
  ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(255,231,168,.18)';ctx.strokeStyle=broken?'rgba(255,179,120,.95)':'rgba(255,222,145,.90)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fillStyle='#fff0bd';ctx.fill();ctx.restore();
}

function spawnCrumbs(x,y){crumbs=[];for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,spd=1.5+Math.random()*5;crumbs.push({x,y,px:x-Math.cos(a)*spd,py:y-Math.sin(a)*spd,r:1.5+Math.random()*2.4,life:1})}}
function updateCrumbs(){for(const p of crumbs){const vx=(p.x-p.px)*.97,vy=(p.y-p.py)*.97;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+.42;p.life*=.955}crumbs=crumbs.filter(p=>p.life>.05&&p.y<h+30)}
function drawCrumbs(){ctx.save();for(const p of crumbs){ctx.globalAlpha=p.life;ctx.fillStyle='#ffe7ad';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.restore()}

function breakNoodle(){
  if(broken||!left||!right)return;broken=true;overstretchSince=0;reconnectSince=0;
  const midRope=ropes[Math.floor(ropes.length/2)],idx=midRope?.breakAt??Math.floor(POINTS/2),mid=midRope?.pts?.[idx]||{x:(left.x+right.x)/2,y:(left.y+right.y)/2};
  breakPoint={x:mid.x,y:mid.y};
  for(const rope of ropes){const i=rope.breakAt,a=rope.pts[i],b=rope.pts[i+1];if(a){a.px=a.x+8;a.py=a.y-12}if(b){b.px=b.x-8;b.py=b.y-12}}
  snapFlash=1;spawnCrumbs(mid.x,mid.y);snapSound();toastMsg('啪！真的拉到極限了 🍜💥',1100);actionEl.textContent='麵斷了！雙手靠近接新麵';if(tensionEl)tensionEl.textContent='已斷';
}

function reconnectNoodle(){if(!broken)return;broken=false;reconnectSince=0;overstretchSince=0;ropes=[];wobble=.35;toastMsg('新Q麵接好了！',820);actionEl.textContent='重新拉麵';if(tensionEl)tensionEl.textContent='Q彈'}

function drawSnapFlash(){
  if(snapFlash<=.02)return;ctx.save();ctx.translate(breakPoint.x,breakPoint.y);ctx.globalAlpha=snapFlash;ctx.strokeStyle='rgba(255,235,176,.95)';ctx.lineWidth=2;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r1=18,r2=34+Math.random()*16;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);ctx.stroke()}
  ctx.restore();snapFlash*=.82;
}

function drawWaiting(){ctx.save();ctx.textAlign='center';ctx.fillStyle='rgba(255,244,220,.62)';ctx.font='600 15px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText(broken?'雙手靠近一點，接一條新Q麵 🍜':'把兩隻手放進畫面 🍜',w/2,h*.52);ctx.restore()}

function render(now){
  ctx.clearRect(0,0,w,h);
  if(demo){
    demoT+=.018;const span=w*(.17+.18*(Math.sin(demoT*.72)*.5+.5)),cy=h*.48+Math.sin(demoT*1.1)*58;
    targetLeft={x:w/2-span,y:cy+Math.sin(demoT*1.8)*52};targetRight={x:w/2+span,y:cy-Math.sin(demoT*1.45)*52};
    if(prevTargetLeft&&prevTargetRight){leftMoveY=targetLeft.y-prevTargetLeft.y;rightMoveY=targetRight.y-prevTargetRight.y}
    prevTargetLeft={...targetLeft};prevTargetRight={...targetRight};
    const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y);updateTelemetry(d);wobble=.42+Math.abs(Math.sin(demoT*1.7))*.55;
  }

  if(targetLeft&&targetRight){
    left=left||{...targetLeft};right=right||{...targetRight};
    left.x+=(targetLeft.x-left.x)*.42;left.y+=(targetLeft.y-left.y)*.70;
    right.x+=(targetRight.x-right.x)*.42;right.y+=(targetRight.y-right.y)*.70;
    integrateRopes(now);drawRopes();drawSnapFlash();updateCrumbs();drawCrumbs();
  }else{ropes=[];left=right=null;drawWaiting()}

  wobble*=.91;velocity*=.90;requestAnimationFrame(render);
}
requestAnimationFrame(render);
