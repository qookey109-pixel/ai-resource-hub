const canvas=document.querySelector('#noodleStage'),ctx=canvas.getContext('2d');
const lengthEl=document.querySelector('#noodleLength'),distanceEl=document.querySelector('#distanceVal'),thicknessEl=document.querySelector('#thicknessVal'),actionEl=document.querySelector('#actionState'),tensionEl=document.querySelector('#tensionVal'),resetBtn=document.querySelector('#resetBtn'),toast=document.querySelector('#toast');

let dpr=1,w=innerWidth,h=innerHeight,left=null,right=null,targetLeft=null,targetRight=null,stretch=0,velocity=0,lastDistance=null,lastTime=performance.now(),demo=false,demoT=0,wobble=0;
let ropes=[],leftMoveY=0,rightMoveY=0,prevTargetLeft=null,prevTargetRight=null;

// V8: keep the firmer Q-noodle physics, but remove snapping entirely.
const STRANDS=8,POINTS=28;
const GRAVITY=.20;
const VELOCITY_DAMPING=.935;
const CONSTRAINT_PASSES=10;
const SHAPE_SPRING=.115;
const BEND_SPRING=.075;
const MAX_TENSION_DISTANCE_RATIO=.98;

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ropes=[];
}
addEventListener('resize',resize);resize();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function toastMsg(text,ms=680){toast.textContent=text;toast.classList.add('show');clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove('show'),ms)}

function pairSorted(a,b){return[a,b].sort((p,q)=>p.x-q.x)}
function getMaxTensionDistance(){return Math.min(w,h)*MAX_TENSION_DISTANCE_RATIO}
function tensionFromDistance(d){return clamp(d/getMaxTensionDistance(),0,1.18)}

function updateTelemetry(d){
  const maxDistance=getMaxTensionDistance(),tension=tensionFromDistance(d);
  const norm=clamp((d-Math.min(w,h)*.12)/(maxDistance-Math.min(w,h)*.12),0,1);
  stretch=norm;
  lengthEl.textContent=`${Math.round(stretch*100)}%`;
  distanceEl.textContent=`${Math.round(d)} px`;
  const thick=clamp(16-stretch*6.8,8.2,16);
  thicknessEl.textContent=`${thick.toFixed(1)} px`;
  if(tensionEl)tensionEl.textContent=tension>.97?'極限Q彈':tension>.84?'緊繃':'Q彈';
  if(tension>.97)actionEl.textContent='極限拉伸！不會斷';
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
    if(velocity>.68&&d>Math.min(w,h)*.42){wobble=Math.min(1.65,wobble+1);toastMsg('Q彈甩麵！')}
  }
  lastDistance=d;lastTime=now;updateTelemetry(d);
}

addEventListener('qookey-frame',e=>{
  demo=false;const hands=e.detail?.hands||[],now=e.detail?.now||performance.now();
  if(hands.length>=2)setTargets(hands[0].palm,hands[1].palm,now);
  else{
    targetLeft=targetRight=null;lastDistance=null;prevTargetLeft=prevTargetRight=null;velocity*=.8;
    lengthEl.textContent='0%';distanceEl.textContent='—';thicknessEl.textContent='—';
    if(tensionEl)tensionEl.textContent='—';
    actionEl.textContent=hands.length===1?'再放一隻手':'等待雙手';
  }
});

addEventListener('qookey-demo',()=>{
  demo=true;demoT=0;ropes=[];
  actionEl.textContent='Demo Q彈拉麵中';lengthEl.textContent='55%';
  if(tensionEl)tensionEl.textContent='Q彈';
});

resetBtn.addEventListener('click',()=>{
  targetLeft=targetRight=left=right=null;prevTargetLeft=prevTargetRight=null;lastDistance=null;
  stretch=0;velocity=0;wobble=0;ropes=[];
  lengthEl.textContent='0%';distanceEl.textContent='—';thicknessEl.textContent='—';
  if(tensionEl)tensionEl.textContent='—';
  actionEl.textContent='等待雙手';toastMsg('RESET');
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
    ropes.push({pts});
  }
}

function pinPoint(p,target){p.x=target.x;p.y=target.y;p.px=target.x;p.py=target.y}

function integrateRopes(now){
  if(!left||!right)return;
  if(!ropes.length)initRopes(left,right);

  const perp=getPerp(left,right),d=Math.hypot(right.x-left.x,right.y-left.y),tension=tensionFromDistance(d);
  const slack=clamp(42-tension*24,14,42),restTotal=d+slack,seg=restTotal/(POINTS-1);
  const upDownGain=.145;

  for(let s=0;s<ropes.length;s++){
    const rope=ropes[s],pts=rope.pts,off=(s-(STRANDS-1)/2)*4.6;

    for(let i=1;i<POINTS-1;i++){
      const p=pts[i],vx=(p.x-p.px)*VELOCITY_DAMPING,vy=(p.y-p.py)*VELOCITY_DAMPING;
      p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+GRAVITY;

      const t=i/(POINTS-1);
      const handKick=(leftMoveY*(1-t)+rightMoveY*t)*upDownGain;
      p.py-=handKick;

      const baseX=left.x+(right.x-left.x)*t+perp.x*off;
      const baseY=left.y+(right.y-left.y)*t+perp.y*off+Math.sin(Math.PI*t)*clamp(23-tension*12,8,23);
      p.x+=(baseX-p.x)*SHAPE_SPRING;
      p.y+=(baseY-p.y)*SHAPE_SPRING;

      const wave=(Math.sin(now*.021+t*19+s*.83)*wobble*2.7+Math.sin(now*.012+t*11+s)*Math.abs(velocity)*3.4)*Math.sin(Math.PI*t);
      p.x+=perp.x*wave;p.y+=perp.y*wave;
    }

    for(let i=1;i<POINTS-1;i++){
      const prev=pts[i-1],p=pts[i],next=pts[i+1];
      p.x+=((prev.x+next.x)*.5-p.x)*BEND_SPRING;
      p.y+=((prev.y+next.y)*.5-p.y)*BEND_SPRING;
    }

    const lTarget={x:left.x+perp.x*off,y:left.y+perp.y*off},rTarget={x:right.x+perp.x*off,y:right.y+perp.y*off};
    pinPoint(pts[0],lTarget);pinPoint(pts[POINTS-1],rTarget);

    for(let pass=0;pass<CONSTRAINT_PASSES;pass++){
      for(let i=0;i<POINTS-1;i++){
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
    const pts=ropes[s].pts;
    ctx.beginPath();
    for(let i=0;i<POINTS;i++){
      const p=pts[i];
      if(i===0)ctx.moveTo(p.x,p.y);
      else{
        const prev=pts[i-1],mx=(prev.x+p.x)/2,my=(prev.y+p.y)/2;
        ctx.quadraticCurveTo(prev.x,prev.y,mx,my);
      }
    }
    ctx.lineCap='round';ctx.lineJoin='round';
    const hot=clamp((tension-.84)/.16,0,1);
    ctx.strokeStyle=s%2?`rgba(255,${Math.round(231-22*hot)},${Math.round(172-35*hot)},.98)`:`rgba(255,${Math.round(245-30*hot)},${Math.round(207-48*hot)},.99)`;
    ctx.lineWidth=baseThickness*(s%2?.68:.84);
    ctx.shadowColor=hot>.45?'rgba(255,145,76,.32)':'rgba(255,196,99,.26)';
    ctx.shadowBlur=9+hot*6;ctx.stroke();
  }
  ctx.shadowBlur=0;drawHandle(left);drawHandle(right);
}

function drawHandle(p){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='rgba(255,231,168,.18)';ctx.strokeStyle='rgba(255,222,145,.90)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fillStyle='#fff0bd';ctx.fill();
  ctx.restore();
}

function drawWaiting(){
  ctx.save();ctx.textAlign='center';ctx.fillStyle='rgba(255,244,220,.62)';
  ctx.font='600 15px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  ctx.fillText('把兩隻手放進畫面 🍜',w/2,h*.52);ctx.restore();
}

function render(now){
  ctx.clearRect(0,0,w,h);
  if(demo){
    demoT+=.018;
    const span=w*(.17+.18*(Math.sin(demoT*.72)*.5+.5)),cy=h*.48+Math.sin(demoT*1.1)*58;
    targetLeft={x:w/2-span,y:cy+Math.sin(demoT*1.8)*52};
    targetRight={x:w/2+span,y:cy-Math.sin(demoT*1.45)*52};
    if(prevTargetLeft&&prevTargetRight){
      leftMoveY=targetLeft.y-prevTargetLeft.y;
      rightMoveY=targetRight.y-prevTargetRight.y;
    }
    prevTargetLeft={...targetLeft};prevTargetRight={...targetRight};
    const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y);
    updateTelemetry(d);wobble=.42+Math.abs(Math.sin(demoT*1.7))*.55;
  }

  if(targetLeft&&targetRight){
    left=left||{...targetLeft};right=right||{...targetRight};
    left.x+=(targetLeft.x-left.x)*.42;left.y+=(targetLeft.y-left.y)*.70;
    right.x+=(targetRight.x-right.x)*.42;right.y+=(targetRight.y-right.y)*.70;
    integrateRopes(now);drawRopes();
  }else{
    ropes=[];left=right=null;drawWaiting();
  }

  wobble*=.91;velocity*=.90;requestAnimationFrame(render);
}
requestAnimationFrame(render);
