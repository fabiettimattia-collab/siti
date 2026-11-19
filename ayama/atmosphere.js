/* AYAMA vineyard breeze: vine leaves, olive leaves, grapes and tendrils on a wind of their own.
   Pulling the goggles draws the air in round the leopard; their landing bursts it outwards. */
(() => {
  'use strict';
  const home=document.querySelector('#home');
  if(!home||home.querySelector('.ay-atmosphere'))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const controller=new AbortController(),signal=controller.signal;
  const layer=document.createElement('div');
  layer.className='ay-atmosphere';layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<div class="ay-atmosphere__base"></div><div class="ay-atmosphere__light"></div><div class="ay-atmosphere__vignette"></div><div class="ay-atmosphere__grain"></div>';
  const effects=document.createElement('div');
  effects.className='ay-atmosphere-effects';effects.setAttribute('aria-hidden','true');
  effects.innerHTML='<canvas class="ay-atmosphere__canvas"></canvas><div class="ay-atmosphere__flash"></div><div class="ay-atmosphere__sweep"></div>';
  home.prepend(layer);home.append(effects);
  const canvas=effects.querySelector('canvas'),context=canvas.getContext('2d',{alpha:true});
  if(!context){layer.remove();effects.remove();return;}
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const between=(a,b)=>a+Math.random()*(b-a);
  const tau=Math.PI*2;
  const palette=[{fill:'#7c9c69',edge:'#c4d49b'},{fill:'#b39950',edge:'#ebd99b'},{fill:'#446d55',edge:'#91b69b'}];
  let seed=1685;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  let width=1,height=1,extent=1,dpr=1,time=0,last=0,frame=0,visible=true,dead=false;
  let field=[],flights=[],sprites=[],mote=null,opened=false,impactAt=-100,wake=0,flashTimer=0,faceMoved=0;
  // Where the drawn face sits for the camera, as fractions of the hero, and how much of its height a
  // scene unit spans there. The mascot sends it ('ayama:frame'); until then, the intro framing.
  const face={x:.5,y:.5,unit:.14};
  const pull={energy:0,target:0,active:false,turn:1};
  let pointer={x:0,y:0},pointerTarget={x:0,y:0};

  function vineLeaf(g,paint){
    // Five sharply lobed leaf blades and radiating veins, as on an engraved wine label.
    const outline=[[0,.79],[.2,.49],[.49,.59],[.43,.31],[.78,.22],[.61,.02],[.9,-.26],[.48,-.3],[.48,-.69],[.17,-.48],[0,-1],[-.17,-.48],[-.48,-.69],[-.48,-.3],[-.9,-.26],[-.61,.02],[-.78,.22],[-.43,.31],[-.49,.59],[-.2,.49]];
    g.beginPath();outline.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    g.fillStyle=paint.fill;g.fill();g.strokeStyle=paint.edge;g.lineWidth=.018;g.stroke();
    g.globalAlpha=.78;g.lineWidth=.013;g.beginPath();g.moveTo(0,1.08);g.quadraticCurveTo(.07,.45,0,-.84);
    for(const [x,y]of [[.4,-.58],[-.4,-.58],[.76,-.23],[-.76,-.23],[.63,.2],[-.63,.2],[.39,.47],[-.39,.47]]){g.moveTo(0,.42);g.quadraticCurveTo(x*.32,y*.25,x,y);}
    for(let side=-1;side<=1;side+=2){for(let i=0;i<3;i++){const y=-.6+i*.29;g.moveTo(0,y+.18);g.lineTo(side*(.13+i*.05),y);}}
    g.stroke();g.globalAlpha=1;
  }

  function oliveLeaf(g,paint){
    g.fillStyle=paint.fill;g.strokeStyle=paint.edge;g.lineWidth=.018;
    g.beginPath();g.moveTo(0,-1);g.bezierCurveTo(.44,-.35,.35,.53,0,.95);g.bezierCurveTo(-.31,.4,-.39,-.42,0,-1);g.closePath();g.fill();g.stroke();
    g.globalAlpha=.8;g.beginPath();g.moveTo(0,1.12);g.quadraticCurveTo(.06,.13,0,-.82);g.stroke();g.globalAlpha=1;
  }

  function grapeCluster(g,paint,index){
    const red=index===1;
    g.strokeStyle=paint.edge;g.lineWidth=.035;g.beginPath();g.moveTo(-.08,-.64);g.quadraticCurveTo(-.02,-.95,.27,-.96);g.stroke();
    g.save();g.translate(.28,-.7);g.rotate(.7);g.scale(.32,.32);vineLeaf(g,paint);g.restore();
    const grapes=[[-.26,-.38],[.23,-.37],[0,-.06],[-.42,.02],[.42,.02],[-.23,.33],[.22,.33],[0,.65]];
    for(const [x,y]of grapes){
      const glow=g.createRadialGradient(x-.065,y-.08,.01,x,y,.22);
      glow.addColorStop(0,red?'#c39498':'#c7bd76');glow.addColorStop(.48,red?'#87596d':'#8b9b5c');glow.addColorStop(1,red?'#4f3448':'#435b3d');
      g.fillStyle=glow;g.beginPath();g.arc(x,y,.215,0,tau);g.fill();g.strokeStyle=red?'#cb9a9c':'#c8cf94';g.lineWidth=.012;g.stroke();
    }
  }

  function mix(from,to,amount){
    const a=parseInt(from.slice(1),16),b=parseInt(to.slice(1),16),channel=shift=>Math.round(lerp(a>>shift&255,b>>shift&255,amount));
    return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  }

  function makeSprites(){
    const paint=(kind,colours,index,blur=0)=>{
      const c=document.createElement('canvas');c.width=c.height=128;
      const g=c.getContext('2d');if(blur)g.filter=`blur(${blur}px)`;g.translate(64,64);g.scale(48,48);g.lineJoin='round';
      if(kind===0)vineLeaf(g,colours);else if(kind===1)oliveLeaf(g,colours);else grapeCluster(g,colours,index);
      return c;
    };
    // Every leaf has a paler, silvery underside that flashes as it turns over (an olive leaf almost
    // white), and a softened copy for the far layer, out of focus behind the leopard.
    sprites=palette.map((colours,index)=>[0,1,2].map(kind=>({
      front:paint(kind,colours,index),soft:paint(kind,colours,index,5),
      back:kind===2?null:paint(kind,{fill:mix(colours.fill,'#dfe3cf',kind?.52:.36),edge:mix(colours.edge,'#f4f2e2',.3)},index)
    })));
    mote=document.createElement('canvas');mote.width=mote.height=32;
    const g=mote.getContext('2d'),glow=g.createRadialGradient(16,16,0,16,16,16);
    glow.addColorStop(0,'rgba(255,247,218,1)');glow.addColorStop(.28,'rgba(242,214,140,.6)');glow.addColorStop(1,'rgba(214,176,96,0)');
    g.fillStyle=glow;g.fillRect(0,0,32,32);
  }

  // A leaf or a grape cluster. Depth q runs from far behind (0: small, soft and slow) to just
  // behind the leopard (1).
  function specimen(next,q){
    const choice=next(),kind=choice<.62?0:choice<.87?1:2;
    return {x:0,y:0,vx:0,vy:0,q,kind,color:Math.floor(next()*palette.length),seed:next(),
      size:(kind===2?6:7)+q*(kind===2?10:14)+next()*5,angle:next()*tau,spin:0,idleSpin:(next()-.5)*.5,
      tumble:next()*tau,turnover:(.3+next()*.6)*(next()<.5?-1:1),flutter:next()*tau,beat:1+next()*1.5,sway:3+next()*7,
      drag:1.2+next()*1.2,fall:0,born:0,life:Infinity,calm:true,entered:-10,kickAt:0,kx:0,ky:0,kspin:0,frame:null};
  }

  // The leaves in the air: a quiet few that are always there, and more that wake round the edges
  // while the goggles are pulled and stay up for a while after the burst.
  function populate(){
    seed=1685;const small=width<720,quiet=small?12:20,stirred=small?16:28;
    field=Array.from({length:quiet+stirred},(_,i)=>{
      const p=specimen(rand,i<quiet?rand()*.6:.3+rand()*.7);p.calm=i<quiet;
      if(p.calm){p.x=rand()*width;p.y=rand()*height;}else{p.size*=1.15;border(p,rand);}
      return p;
    }).sort((a,b)=>a.q-b.q);
  }
  function border(p,next=Math.random){
    const inset=next()*extent*.16,along=next(),side=Math.floor(next()*4);
    p.x=side<2?along*width:side===2?inset:width-inset;p.y=side<2?(side?height-inset:inset):along*height;p.vx=p.vy=0;
  }

  function resize(){
    const rect=home.getBoundingClientRect(),rebuild=!field.length||(rect.width<720)!==(width<720);
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);extent=Math.min(width,height);
    dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    if(rebuild)populate();
    measureCopy();render();
  }

  // The breeze: a slow drift east plus the curl of two travelling waves, so it turns in soft eddies
  // yet never piles the leaves up anywhere (it has no sources or sinks).
  const air={x:0,y:0};
  function flow(x,y,strength){
    const u=x/extent,v=y/extent,a=1.7*u+time*.07,b=2.3*v-time*.05,c=1.1*u+1.6*v+time*.09;
    air.x=extent*(.009+(1.38*Math.sin(a)*Math.cos(b)+.8*Math.cos(c))*strength);
    air.y=-extent*(1.02*Math.cos(a)*Math.sin(b)+.55*Math.cos(c))*strength;
    return air;
  }

  // A burst keeps its leaves relative to where it went off. Those near the leopard's depth ride the
  // camera when it pulls back after the landing, the farther ones less, so the burst keeps its depth.
  const spot={x:0,y:0,scale:1};
  function place(p){
    const f=p.frame,follow=.45+.55*p.q,scale=lerp(1,face.unit/f.unit,follow);
    spot.x=f.x+(face.x-f.fx)*width*follow+p.x*scale;spot.y=f.y+(face.y-f.fy)*height*follow+p.y*scale;spot.scale=scale;
    return spot;
  }

  function step(dt){
    time+=dt;
    pull.energy=lerp(pull.energy,pull.target,1-Math.exp(-dt*(pull.target>pull.energy?3.4:2.4)));
    wake=Math.max(0,wake-dt*.22);
    pointer.x=lerp(pointer.x,pointerTarget.x,1-Math.exp(-dt*3));pointer.y=lerp(pointer.y,pointerTarget.y,1-Math.exp(-dt*3));
    const energy=pull.energy,gust=.018+.03*energy,cx=face.x*width,cy=(face.y+face.unit*.4)*height;
    for(const p of field){
      const depth=.45+.55*p.q;flow(p.x,p.y,gust);let ax=air.x*depth,ay=air.y*depth;
      if(energy>.003){
        // A pull draws the air in: each leaf spirals towards the face along a line of its own,
        // whatever the goggles are doing.
        const dx=cx-p.x,dy=cy-p.y,draw=energy*extent*(.045+.07*p.seed)*depth/(Math.hypot(dx,dy)||1);
        ax+=(dx+dy*.8*pull.turn)*draw;ay+=(dy-dx*.8*pull.turn)*draw;
      }
      const k=1-Math.exp(-dt*p.drag);p.vx+=(ax-p.vx)*k;p.vy+=(ay-p.vy)*k;
      if(p.kickAt&&time>=p.kickAt){p.vx+=p.kx;p.vy+=p.ky;p.spin+=p.kspin;p.kickAt=0;}
      p.flutter+=dt*p.beat*(1+energy);
      p.x+=(p.vx+Math.cos(p.flutter)*p.sway)*dt;p.y+=(p.vy+Math.sin(p.flutter*1.6)*p.sway*.35)*dt;
      p.spin=lerp(p.spin,p.idleSpin,1-Math.exp(-dt*.7));p.angle+=p.spin*dt;
      p.tumble+=p.turnover*dt*(1+energy*2.5+Math.hypot(p.vx,p.vy)/extent*4);
      // Out at one edge, in again at the opposite one, fading up instead of streaking across.
      const margin=40+p.size*1.5;
      if(p.x<-margin||p.x>width+margin||p.y<-margin||p.y>height+margin){
        p.x=p.x<-margin?p.x+width+margin*2:p.x>width+margin?p.x-width-margin*2:p.x;
        p.y=p.y<-margin?p.y+height+margin*2:p.y>height+margin?p.y-height-margin*2:p.y;
        p.vx=ax;p.vy=ay;p.entered=time;
      }
    }
    for(let i=flights.length-1;i>=0;i--){
      const p=flights[i],age=time-p.born;
      if(age<0)continue;
      if(age>p.life){flights[i]=flights[flights.length-1];flights.pop();continue;}
      const at=place(p);flow(at.x,at.y,gust);
      const k=1-Math.exp(-dt*p.drag);p.vx+=(air.x*.8-p.vx)*k;p.vy+=(air.y*.8-p.vy)*k+p.fall*dt;
      // Thrown out fast and spinning, a leaf slows into the side-to-side flutter of a falling one.
      const settle=1-clamp(Math.hypot(p.vx,p.vy)/(extent*.3));
      p.flutter+=dt*p.beat;p.x+=(p.vx+Math.cos(p.flutter)*p.sway*settle)*dt;p.y+=p.vy*dt;
      p.spin=lerp(p.spin,p.idleSpin,1-Math.exp(-dt*1.2));p.angle+=p.spin*dt;
      p.tumble+=p.turnover*dt*(.35+(1-settle)*2.2);
    }
  }

  function burst(x,y,power){
    const small=width<720,frame={x,y,fx:face.x,fy:face.y,unit:face.unit},speed=extent*(.8+.45*power),head=face.unit*height*2.1;
    // Each piece starts somewhere over the head's disc (filled, never a ring), already on its way
    // out: those past the silhouette show at once, the rest come out from behind it.
    const launch=(p,s,lift,reach)=>{
      const a=Math.random()*tau,r=head*reach*Math.sqrt(Math.random());
      p.frame=frame;p.calm=false;p.x=Math.cos(a)*r;p.y=Math.sin(a)*r;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s*.85-extent*lift;
      flights.push(p);return p;
    };
    // Out in every direction, a little upwards and never all at one instant: spinning leaves,
    // a few tendrils uncurling as they fly, and pollen catching the flash.
    for(let i=Math.round((small?44:88)*(.7+.3*power));i>0;i--){
      const p=launch(specimen(Math.random,.3+Math.random()*.7),speed*(.35+1.4*Math.random()**1.6),.17,1.15);
      p.size=(p.kind===2?8:9)+p.q*(p.kind===2?16:21)+Math.random()*6;p.born=time+Math.random()**2*.16;p.life=3+Math.random()*3.4;
      p.spin=between(-8,8);p.turnover*=between(6,12);p.sway*=2.4;
      p.drag=p.kind===2?1.5:p.kind===1?1.7+Math.random()*.8:2.1+Math.random()*1.3;p.fall=extent*(p.kind===2?.24:.03+Math.random()*.05);
    }
    for(let i=small?3:6;i>0;i--){
      const p=launch(specimen(Math.random,.5+Math.random()*.5),speed*between(.5,1.1),.12,.9);
      Object.assign(p,{kind:3,born:time+Math.random()*.08,life:2+Math.random()*1.4,spin:between(-3,3),drag:2.4,fall:extent*.03,size:extent*between(.07,.12)});
    }
    for(let i=small?30:56;i>0;i--){
      const p=launch(specimen(Math.random,Math.random()),speed*(.6+1.6*Math.random()**1.4),.1,1);
      Object.assign(p,{kind:4,born:time+Math.random()*.1,life:1.1+Math.random()*1.7,drag:3.2+Math.random()*1.8,fall:-extent*.025,size:1.4+Math.random()*2.4,sway:2+Math.random()*4});
    }
    if(flights.length>420)flights.splice(0,flights.length-420);
    // The shock runs out through the leaves already in the air, the nearest first.
    for(const p of field){
      const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy)||1,reach=Math.max(0,1-d/(extent*1.6)),a=Math.atan2(dy,dx)+between(-.4,.4);
      const s=extent*(.18+1.15*reach*reach)*between(.65,1.25)*(.7+.3*power);
      p.kx=Math.cos(a)*s;p.ky=Math.sin(a)*s-extent*.06;p.kspin=between(-6,6)*reach;p.kickAt=time+d/(extent*2.4);
    }
  }

  function drawLeaf(p,x,y,alpha,scale){
    if(alpha<.004||x<-90||x>width+90||y<-90||y>height+90)return;
    const set=sprites[p.color][p.kind],size=p.size*scale;
    let fold=1,angle=p.angle,image=p.q<.28?set.soft:set.front;
    // Turning over, a leaf narrows to its edge and shows its underside.
    if(p.kind<2){const turn=Math.cos(p.tumble);fold=Math.max(.14,Math.abs(turn));if(turn<0&&image===set.front)image=set.back;}
    else angle+=Math.sin(p.flutter*.9)*.35; // a grape cluster swings from its stem
    const cos=Math.cos(angle)*dpr,sin=Math.sin(angle)*dpr;
    context.setTransform(cos*fold,sin*fold,-sin,cos,x*dpr,y*dpr);context.globalAlpha=Math.min(1,alpha);
    context.drawImage(image,-size,-size,size*2,size*2);
  }

  function drawTendril(x,y,length,turn,alpha,progress=1,curve=0){
    if(alpha<.004)return;
    const cos=Math.cos(turn)*dpr,sin=Math.sin(turn)*dpr;
    context.setTransform(cos,sin,-sin,cos,x*dpr,y*dpr);context.globalAlpha=alpha;
    context.strokeStyle='#b9ba7b';context.lineWidth=.75;context.beginPath();
    const steps=42;
    for(let i=0;i<=Math.floor(steps*progress);i++){
      const t=i/steps;
      // A supple stem resolves into the tightening spiral of a real vine tendril.
      const coil=smooth((t-.5)/.5),a=coil*Math.PI*2.15,r=length*.16*(1-coil*.75);
      const px=t<.5?t*length*.82:length*.41+Math.sin(a)*r;
      const py=Math.sin(t*Math.PI)*length*(.1+curve*.035)+(t<.5?0:(1-Math.cos(a))*r);
      if(i===0)context.moveTo(px,py);else context.lineTo(px,py);
    }
    context.stroke();
  }

  // Quiet round the face (the portrait covers most of it) ...
  function clear(x,y){
    const unit=face.unit*height,dx=(x-face.x*width)/(unit*1.7),dy=(y-(face.y+face.unit*.4)*height)/(unit*2.1);
    return smooth((Math.hypot(dx,dy)-.55)/.75);
  }
  // ... and thinner behind the copy once it shows (beside the leopard on wide screens, above it on
  // narrow ones), fading over a wide margin rather than at an edge.
  let copy=null;
  function measureCopy(){
    const text=home.querySelector('.hero-copy');if(!text)return;
    const box=text.getBoundingClientRect(),hero=home.getBoundingClientRect();
    copy={left:box.left-hero.left,top:box.top-hero.top,right:box.right-hero.left,bottom:box.bottom-hero.top};
  }
  function readable(x,y,strength){
    if(!opened||!copy)return 1;
    const margin=extent*.09;
    return 1-strength*smooth((x-copy.left+margin)/margin)*smooth((copy.right+margin-x)/margin)*smooth((y-copy.top+margin)/margin)*smooth((copy.bottom+margin-y)/margin);
  }

  function render(){
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);
    if(reduced.matches)return;
    const arrival=opened?lerp(.58,1,smooth((time-impactAt-1)/2.5)):.72;
    // Sparse botanical filigree at the edges frames the portrait without an orbiting ring.
    for(let i=0;i<4;i++){
      const side=i%2===0?1:-1,x=side===1?width*.025:width*.96,y=height*(.24+Math.floor(i/2)*.46);
      drawTendril(x+pointer.x*3,y+Math.sin(time*.19+i)*5,Math.min(width*.16,150),side===1?-.42:Math.PI+.3,.09*arrival,1,Math.sin(time*.17+i));
    }
    const stirred=Math.max(smooth(pull.energy*1.5),wake);
    for(const p of field){
      const shown=p.calm?(.11+p.seed*.13)*arrival:(.19+p.seed*.24)*stirred;
      if(shown<.004)continue;
      const x=p.x+pointer.x*(4+p.q*12),y=p.y+pointer.y*(3+p.q*7);
      drawLeaf(p,x,y,shown*clear(x,y)*readable(x,y,.72)*smooth((time-p.entered)/1.2),1);
    }
    let motes=0;
    for(const p of flights){
      const age=time-p.born;
      if(age<0)continue;
      if(p.kind===4){motes++;continue;}
      // Sizes follow the camera only halfway, so the leaves stay legible as it pulls back; each one
      // pops a little larger as it comes out.
      const at=place(p),life=smooth(age/.07)*(1-smooth((age-p.life*.55)/(p.life*.45))),size=Math.sqrt(at.scale);
      if(p.kind===3)drawTendril(at.x,at.y,p.size*size,p.angle,(.32+.2*p.seed)*life*readable(at.x,at.y,.6),smooth(age/.7),Math.sin(age*2+p.seed*6));
      else drawLeaf(p,at.x,at.y,(.56+p.seed*.36)*life*readable(at.x,at.y,.6),size*(1+.28*Math.exp(-age*7)));
    }
    if(motes){
      // Pollen adds light rather than paint.
      context.globalCompositeOperation='lighter';
      for(const p of flights){
        const age=time-p.born;
        if(p.kind!==4||age<0)continue;
        const at=place(p),life=smooth(age/.05)*(1-smooth((age-p.life*.4)/(p.life*.6))),r=p.size*2.2*Math.sqrt(at.scale);
        context.setTransform(dpr,0,0,dpr,at.x*dpr,at.y*dpr);context.globalAlpha=clamp((.6+.4*p.seed)*life*(.62+.38*Math.sin(age*p.beat*7+p.seed*tau))*readable(at.x,at.y,.6));
        context.drawImage(mote,-r,-r,r*2,r*2);
      }
      context.globalCompositeOperation='source-over';
    }
    context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;
  }

  function tick(now){
    if(dead)return;frame=requestAnimationFrame(tick);
    if(!visible||document.hidden){last=0;return;}
    // The resting breeze runs at about thirty frames a second; pulls, bursts and camera moves at full rate.
    const busy=pull.energy>.004||pull.target>0||flights.length>0||wake>0||now-faceMoved<200;
    if(last&&!busy&&now-last<32)return;
    const dt=last?Math.min((now-last)/1000,.05):1/60;last=now;
    if(reduced.matches)return;
    step(dt);render();
  }

  function locate(x,y){for(const node of[layer,effects]){node.style.setProperty('--ay-source-x',x*100+'%');node.style.setProperty('--ay-source-y',y*100+'%');}}
  function framed(detail={}){
    const x=Number(detail.x),y=Number(detail.y),unit=Number(detail.unit);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!(unit>0))return;
    face.x=x;face.y=y;face.unit=unit;faceMoved=performance.now();locate(x,y);
  }
  function drag(detail={}){
    if(reduced.matches)return;
    const active=detail.active!==false;
    if(active&&!pull.active){
      // Each pull turns the air its own way; the leaves it wakes come in from the edges.
      pull.turn=Math.random()<.5?-1:1;
      if(Math.max(pull.energy,wake)<.02)for(const p of field)if(!p.calm)border(p);
    }
    pull.active=active;pull.target=active?clamp(Number(detail.power)||0):0;
  }
  function impact(detail={}){
    const x=Number(detail.x),y=Number(detail.y),originX=(Number.isFinite(x)?clamp(x):face.x)*width,originY=(Number.isFinite(y)?clamp(y):face.y)*height;
    impactAt=time;opened=true;pull.active=false;pull.target=0;wake=1;measureCopy();
    if(!reduced.matches)burst(originX,originY,clamp(Number(detail.power)||.6,.4,1));
    locate(originX/width,originY/height);
    effects.classList.remove('ay-atmosphere--impact');void effects.offsetWidth;
    effects.classList.add('ay-atmosphere--impact','ay-atmosphere--revealed');layer.classList.add('ay-atmosphere--revealed');
    clearTimeout(flashTimer);flashTimer=setTimeout(()=>effects.classList.remove('ay-atmosphere--impact'),1500);
  }
  function reset(){
    opened=false;impactAt=-100;wake=0;flights=[];pull.energy=pull.target=0;pull.active=false;
    for(const p of field){p.kickAt=0;if(!p.calm)border(p);}
    locate(face.x,face.y);
    layer.classList.remove('ay-atmosphere--impact','ay-atmosphere--revealed');effects.classList.remove('ay-atmosphere--impact','ay-atmosphere--revealed');clearTimeout(flashTimer);render();
  }
  function preference(){
    layer.classList.toggle('ay-atmosphere--reduced',reduced.matches);effects.classList.toggle('ay-atmosphere--reduced',reduced.matches);render();
  }
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;last=0;},{rootMargin:'120px'});observer.observe(home);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(home);
  window.addEventListener('ayama:frame',e=>framed(e.detail),{signal});
  window.addEventListener('ayama:drag',e=>drag(e.detail),{signal});
  window.addEventListener('ayama:impact',e=>impact(e.detail),{signal});
  window.addEventListener('ayama:discover',()=>{opened=true;measureCopy();layer.classList.add('ay-atmosphere--revealed');},{signal});
  window.addEventListener('ayama:language',()=>requestAnimationFrame(measureCopy),{signal});
  window.addEventListener('ayama:replay',reset,{signal});window.addEventListener('ayama:reset',reset,{signal});
  home.addEventListener('pointermove',e=>{const r=home.getBoundingClientRect();pointerTarget.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);pointerTarget.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1);},{passive:true,signal});
  home.addEventListener('pointerleave',()=>{pointerTarget={x:0,y:0};},{signal});
  reduced.addEventListener('change',preference,{signal});
  makeSprites();resize();preference();frame=requestAnimationFrame(tick);
  window.AyamaAtmosphere={impact,drag,reset,destroy(){dead=true;cancelAnimationFrame(frame);clearTimeout(flashTimer);controller.abort();observer.disconnect();resizeObserver.disconnect();layer.remove();effects.remove();delete window.AyamaAtmosphere;}};
})();
