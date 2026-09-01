const canvas=document.querySelector('#slimeStage'),ctx=canvas.getContext('2d');
const stretchEl=document.querySelector('#slimeStretch'),distanceEl=document.querySelector('#distanceVal'),bodyEl=document.querySelector('#bodyVal'),jiggleEl=document.querySelector('#jiggleVal'),actionEl=document.querySelector('#actionState'),resetBtn=document.querySelector('#resetBtn'),toast=document.querySelector('#toast');

let dpr=1,w=innerWidth,h=innerHeight,left=null,right=null,targetLeft=null,targetRight=null;
let prevTargetLeft=null,prevTargetRight=null,lastDistance=null,lastTime=performance.now(),stretch=0,velocity=0,wobble=0,demo=false,demoT=0,lastSquishToast=0,lastStretchToast=0;
let leftMove={x:0,y:0},rightMove={x:0,y:0};
const POINTS=30,SPRING=.075,LINK=.22,DAMPING=.89,GRAVITY=.05;
let offsets=new Float32Array(POINTS),offsetV=new Float32Array(POINTS);
const bubbles=Array.from({length:12},(_,i)=>({t:.08+Math.random()*.84,side:(Math.random()*2-1)*.58,r:4+Math.random()*9,phase:Math.random()*Math.PI*2,speed:.004+Math.random()*.006,seed:i}));

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize);resize();

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function toastMsg(text,ms=650){toast.textContent=text;toast.classList.add('show');clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove('show'),ms)}
function pairSorted(a,b){return[a,b].sort((p,q)=>p.x-q.x)}
function resetPhysics(){offsets=new Float32Array(POINTS);offsetV=new Float32Array(POINTS);wobble=0;velocity=0}

function updateTelemetry(d){
  const short=Math.min(w,h),minD=short*.12,maxD=short*.95;
  stretch=clamp((d-minD)/(maxD-minD),0,1);
  stretchEl.textContent=`${Math.round(stretch*100)}%`;
  distanceEl.textContent=`${Math.round(d)} px`;
  const body=clamp(118-stretch*70,48,118);
  bodyEl.textContent=`${Math.round(body)} px`;
  const energy=offsetV.reduce((s,v)=>s+Math.abs(v),0)/POINTS+Math.abs(velocity)*6;
  jiggleEl.textContent=energy>3.8?'爆Q':energy>1.8?'很Q':energy>.65?'Q彈':'穩定';
  if(stretch>.93)actionEl.textContent='極限拉伸！';
  else if(stretch>.68)actionEl.textContent='拉長中';
  else if(stretch<.18)actionEl.textContent='縮成一坨';
  else actionEl.textContent='史萊姆拉伸中';
}

function injectHandMotion(){
  const gain=.34;
  for(let i=1;i<5;i++){
    const f=(5-i)/4;
    offsetV[i]+=leftMove.y*gain*f;
    offsetV[POINTS-1-i]+=rightMove.y*gain*f;
  }
  const twist=(leftMove.y-rightMove.y)*.16;
  for(let i=1;i<POINTS-1;i++){
    const t=i/(POINTS-1);
    offsetV[i]+=twist*(.5-t)*Math.sin(Math.PI*t);
  }
}

function setTargets(a,b,now){
  const pair=pairSorted(a,b);targetLeft={...pair[0]};targetRight={...pair[1]};
  if(prevTargetLeft&&prevTargetRight){
    leftMove.x=leftMove.x*.45+(targetLeft.x-prevTargetLeft.x)*.55;
    leftMove.y=leftMove.y*.45+(targetLeft.y-prevTargetLeft.y)*.55;
    rightMove.x=rightMove.x*.45+(targetRight.x-prevTargetRight.x)*.55;
    rightMove.y=rightMove.y*.45+(targetRight.y-prevTargetRight.y)*.55;
  }else{leftMove={x:0,y:0};rightMove={x:0,y:0}}
  prevTargetLeft={...targetLeft};prevTargetRight={...targetRight};

  const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y),dt=Math.max(16,now-lastTime);
  if(lastDistance!==null){
    const dv=(d-lastDistance)/dt;velocity=velocity*.68+dv*.32;
    const verticalEnergy=Math.abs(leftMove.y)+Math.abs(rightMove.y);
    if(verticalEnergy>18){wobble=Math.min(2,wobble+verticalEnergy*.018);injectHandMotion()}
    if(velocity<-.55&&d<Math.min(w,h)*.38&&now-lastSquishToast>900){
      lastSquishToast=now;toastMsg('噗啾！🟢',620);
      for(let i=4;i<POINTS-4;i++)offsetV[i]+=(Math.random()-.5)*5.5;
    }
    if(velocity>.72&&d>Math.min(w,h)*.55&&now-lastStretchToast>1100){
      lastStretchToast=now;toastMsg('拉——長！',650);
    }
  }
  lastDistance=d;lastTime=now;updateTelemetry(d);
}

addEventListener('qookey-frame',e=>{
  demo=false;const hands=e.detail?.hands||[],now=e.detail?.now||performance.now();
  if(hands.length>=2)setTargets(hands[0].palm,hands[1].palm,now);
  else{
    targetLeft=targetRight=null;lastDistance=null;prevTargetLeft=prevTargetRight=null;
    leftMove={x:0,y:0};rightMove={x:0,y:0};
    stretchEl.textContent='0%';distanceEl.textContent='—';bodyEl.textContent='—';jiggleEl.textContent='—';
    actionEl.textContent=hands.length===1?'再放一隻手':'等待雙手';
  }
});

addEventListener('qookey-demo',()=>{
  demo=true;demoT=0;resetPhysics();actionEl.textContent='Demo 史萊姆中';stretchEl.textContent='48%';bodyEl.textContent='84 px';jiggleEl.textContent='Q彈';
});

resetBtn.addEventListener('click',()=>{
  targetLeft=targetRight=left=right=null;prevTargetLeft=prevTargetRight=null;lastDistance=null;stretch=0;
  leftMove={x:0,y:0};rightMove={x:0,y:0};resetPhysics();
  stretchEl.textContent='0%';distanceEl.textContent='—';bodyEl.textContent='—';jiggleEl.textContent='—';actionEl.textContent='等待雙手';toastMsg('RESET');
});

function getFrame(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
  return{tx:dx/d,ty:dy/d,nx:-dy/d,ny:dx/d,d};
}

function updateSoftBody(){
  for(let i=1;i<POINTS-1;i++){
    const neighbor=(offsets[i-1]+offsets[i+1])*.5;
    const force=-offsets[i]*SPRING+(neighbor-offsets[i])*LINK;
    offsetV[i]=(offsetV[i]+force)*DAMPING;
    offsets[i]+=offsetV[i]+GRAVITY;
  }
  offsets[0]=offsets[POINTS-1]=0;offsetV[0]=offsetV[POINTS-1]=0;
  if(wobble>.02){
    const amp=wobble*1.8;
    for(let i=2;i<POINTS-2;i++)offsetV[i]+=Math.sin(i*.78+performance.now()*.014)*amp*Math.sin(Math.PI*i/(POINTS-1))*.08;
  }
}

function buildShape(now){
  const frame=getFrame(left,right),short=Math.min(w,h);
  const midRadius=clamp(120-stretch*72,48,120),endRadius=clamp(48-stretch*14,32,48);
  const centers=[],radii=[],top=[],bottom=[];
  for(let i=0;i<POINTS;i++){
    const t=i/(POINTS-1),bulge=Math.pow(Math.sin(Math.PI*t),.62);
    const wave=Math.sin(now*.006+i*.72)*wobble*1.5*Math.sin(Math.PI*t);
    const sag=Math.sin(Math.PI*t)*clamp(12-stretch*7,3,12);
    const x=left.x+(right.x-left.x)*t+frame.nx*(offsets[i]+wave);
    const y=left.y+(right.y-left.y)*t+frame.ny*(offsets[i]+wave)+sag;
    centers.push({x,y});
    const pulse=Math.sin(now*.009+i*.55)*wobble*1.1;
    radii.push(clamp(endRadius+(midRadius-endRadius)*bulge+pulse,24,132));
  }
  for(let i=0;i<POINTS;i++){
    const p0=centers[Math.max(0,i-1)],p1=centers[Math.min(POINTS-1,i+1)];
    const dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,r=radii[i];
    top.push({x:centers[i].x+nx*r,y:centers[i].y+ny*r});
    bottom.push({x:centers[i].x-nx*r,y:centers[i].y-ny*r});
  }
  return{centers,radii,top,bottom,frame,short};
}

function curveThrough(path,points){
  if(!points.length)return;
  path.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length-1;i++){
    const p=points[i],n=points[i+1],mx=(p.x+n.x)/2,my=(p.y+n.y)/2;
    path.quadraticCurveTo(p.x,p.y,mx,my);
  }
  const last=points[points.length-1];path.lineTo(last.x,last.y);
}

function makeBlobPath(shape){
  const path=new Path2D();
  curveThrough(path,shape.top);
  const rev=[...shape.bottom].reverse();
  path.lineTo(rev[0].x,rev[0].y);
  for(let i=1;i<rev.length-1;i++){
    const p=rev[i],n=rev[i+1],mx=(p.x+n.x)/2,my=(p.y+n.y)/2;
    path.quadraticCurveTo(p.x,p.y,mx,my);
  }
  const last=rev[rev.length-1];path.lineTo(last.x,last.y);path.closePath();
  return path;
}

function drawBubbles(shape,path,now){
  ctx.save();ctx.clip(path);
  for(const b of bubbles){
    const idx=clamp(Math.round(b.t*(POINTS-1)),0,POINTS-1),c=shape.centers[idx],r=shape.radii[idx];
    const phase=b.phase+now*b.speed,ox=Math.cos(phase)*r*b.side*.52,oy=Math.sin(phase*.73)*r*.35;
    const br=b.r*(.8+Math.sin(phase*1.2)*.14);
    const g=ctx.createRadialGradient(c.x+ox-br*.35,c.y+oy-br*.35,1,c.x+ox,c.y+oy,br);
    g.addColorStop(0,'rgba(235,255,220,.72)');g.addColorStop(.38,'rgba(172,255,142,.34)');g.addColorStop(1,'rgba(76,207,92,.03)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x+ox,c.y+oy,br,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawHandles(){
  for(const p of [left,right]){
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle='rgba(138,255,113,.16)';ctx.strokeStyle='rgba(190,255,165,.86)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fillStyle='#dfffd1';ctx.fill();ctx.restore();
  }
}

function drawSlime(now){
  if(!left||!right)return;
  updateSoftBody();
  const shape=buildShape(now),path=makeBlobPath(shape);
  const mx=(left.x+right.x)/2,my=(left.y+right.y)/2,rad=Math.max(shape.frame.d*.62,130);
  const fill=ctx.createRadialGradient(mx-shape.frame.d*.12,my-shape.frame.d*.08,18,mx,my,rad);
  fill.addColorStop(0,'rgba(178,255,112,.97)');
  fill.addColorStop(.46,'rgba(72,225,94,.94)');
  fill.addColorStop(1,'rgba(18,135,83,.92)');
  ctx.save();
  ctx.shadowColor='rgba(90,255,116,.44)';ctx.shadowBlur=26;
  ctx.fillStyle=fill;ctx.fill(path);
  ctx.shadowBlur=0;ctx.lineWidth=3;ctx.strokeStyle='rgba(200,255,170,.45)';ctx.stroke(path);
  ctx.globalCompositeOperation='screen';ctx.lineWidth=6;ctx.strokeStyle='rgba(236,255,220,.16)';ctx.stroke(path);
  ctx.restore();

  drawBubbles(shape,path,now);

  ctx.save();ctx.clip(path);ctx.globalCompositeOperation='screen';
  const hx=mx-shape.frame.nx*shape.radii[Math.floor(POINTS/2)]*.35,hy=my-shape.frame.ny*shape.radii[Math.floor(POINTS/2)]*.35;
  const shine=ctx.createRadialGradient(hx,hy,3,hx,hy,shape.radii[Math.floor(POINTS/2)]*.9);
  shine.addColorStop(0,'rgba(245,255,232,.34)');shine.addColorStop(1,'rgba(245,255,232,0)');
  ctx.fillStyle=shine;ctx.fillRect(0,0,w,h);ctx.restore();

  drawHandles();
}

function drawWaiting(){
  ctx.save();ctx.textAlign='center';ctx.fillStyle='rgba(214,255,204,.62)';
  ctx.font='600 15px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  ctx.fillText('把兩隻手放進畫面，抓住史萊姆 🟢',w/2,h*.52);ctx.restore();
}

function render(now){
  ctx.clearRect(0,0,w,h);
  if(demo){
    demoT+=.018;
    const span=w*(.11+.23*(Math.sin(demoT*.68)*.5+.5)),cy=h*.48+Math.sin(demoT*.9)*42;
    targetLeft={x:w/2-span,y:cy+Math.sin(demoT*1.75)*74};
    targetRight={x:w/2+span,y:cy-Math.sin(demoT*1.32)*70};
    if(prevTargetLeft&&prevTargetRight){
      leftMove.y=targetLeft.y-prevTargetLeft.y;rightMove.y=targetRight.y-prevTargetRight.y;
      leftMove.x=targetLeft.x-prevTargetLeft.x;rightMove.x=targetRight.x-prevTargetRight.x;
      if(Math.abs(leftMove.y)+Math.abs(rightMove.y)>7)injectHandMotion();
    }
    prevTargetLeft={...targetLeft};prevTargetRight={...targetRight};
    const d=Math.hypot(targetRight.x-targetLeft.x,targetRight.y-targetLeft.y);updateTelemetry(d);
    wobble=.35+Math.abs(Math.sin(demoT*1.55))*.75;
  }

  if(targetLeft&&targetRight){
    left=left||{...targetLeft};right=right||{...targetRight};
    left.x+=(targetLeft.x-left.x)*.46;left.y+=(targetLeft.y-left.y)*.68;
    right.x+=(targetRight.x-right.x)*.46;right.y+=(targetRight.y-right.y)*.68;
    drawSlime(now);
  }else{left=right=null;resetPhysics();drawWaiting()}

  wobble*=.925;velocity*=.91;leftMove.x*=.82;leftMove.y*=.82;rightMove.x*=.82;rightMove.y*=.82;
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
