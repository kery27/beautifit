// 네일 엔진 — 손 랜드마크(21점) 위에 손톱 모양을 잡고, 시안(디자인)을 칠하고, 사진의 빛을 입힌다
const NAIL=(()=>{
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgb=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
// 폴리시 색
const COLORS=[['로즈 레드','#c8102e'],['체리','#7d0f24'],['누드 베이지','#d6b49c'],['밀키 핑크','#f1c6cf'],['코랄','#f2685a'],['라벤더','#b49bd8'],
  ['스카이','#97c3e8'],['올리브','#7b8653'],['네이비','#1e2a4f'],['블랙','#141414'],['화이트','#f4f1ec'],['샴페인 골드','#d6b36a']].map(([n,h])=>({n,h,c:hx(h)}));
// 손가락: [가운데 마디, 끝마디(DIP·엄지는 IP), 끝(TIP)]
const FT=[[2,3,4],[6,7,8],[10,11,12],[14,15,16],[18,19,20]];
// 실제 손 사진으로 맞춘 값: 큐티클은 DIP→TIP의 42% 지점, 자연 길이 끝은 108%, 폭은 손가락 3D 길이의 비율
const A0=0.42,A1=1.08,WR=[0.5,0.44,0.45,0.43,0.4];
// 손톱 자리 (좌표계는 lm과 같음). len: 0~1 길이 연장, wid: 폭 배율
function geom(lm,f,o){const dp=lm[FT[f][1]],tp=lm[FT[f][2]],dx=tp[0]-dp[0],dy=tp[1]-dp[1],L=Math.hypot(dx,dy)||1,L3=Math.hypot(dx,dy,(tp[2]||0)-(dp[2]||0))||L;
  const ux=dx/L,uy=dy/L,l0=L*(A1-A0);
  return{bx:dp[0]+ux*L*A0,by:dp[1]+uy*L*A0,ux,uy,l0,len:l0+(o.len||0)*0.7*L,wid:L3*WR[f]*(o.wid||1),f}}
// 손톱 윤곽 (로컬 좌표: x 폭 방향 -w/2~w/2, y 큐티클 0 → 끝 l)
const SHAPES=[['round','라운드'],['oval','오벌'],['square','스퀘어'],['almond','아몬드'],['stiletto','스틸레토']];
function path(w,l,shape){const p=new Path2D(),h=w/2,c=Math.min(0.24*w,0.35*l);
  p.moveTo(-h,c);p.bezierCurveTo(-h,0.25*c,-0.55*h,0,0,0);p.bezierCurveTo(0.55*h,0,h,0.25*c,h,c);
  if(shape==='square'){const t=Math.min(0.14*w,0.3*l);p.lineTo(h,l-t);p.quadraticCurveTo(h,l,h-t,l);p.lineTo(-h+t,l);p.quadraticCurveTo(-h,l,-h,l-t)}
  else if(shape==='almond'||shape==='stiletto'){const ys=c+(shape==='almond'?0.3:0.12)*(l-c),k=shape==='almond'?0.32:0.06;
    p.lineTo(h,ys);p.bezierCurveTo(h,ys+0.55*(l-ys),k*h+0.25*h*(shape==='almond'),l,0,l);p.bezierCurveTo(-(k*h+0.25*h*(shape==='almond')),l,-h,ys+0.55*(l-ys),-h,ys)}
  else{const t=shape==='oval'?Math.min(0.62*w,0.6*l):Math.min(0.42*w,0.55*l),s=shape==='oval'?0.93:1;
    p.lineTo(h*s,l-t);p.bezierCurveTo(h*s,l-0.45*t,0.55*h,l,0,l);p.bezierCurveTo(-0.55*h,l,-h*s,l-0.45*t,-h*s,l-t)}
  p.closePath();return p}
// 반복해도 같은 결과가 나오는 난수 (손톱마다 글리터·마블 무늬가 매 프레임 바뀌지 않게)
function rnd(seed){let s=seed*2654435761>>>0||1;return()=>((s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909),(s^=s>>>16)>>>0)/4294967296)}
// 시안: paint(g,w,l,색,손가락,씨앗,l0,내 사진) — 로컬 좌표에서 손톱 영역(이미 잘라냄)을 칠한다
const nude=[241,210,200];
function fill(g,w,l,c,a=1){g.fillStyle=rgb(c,a);g.fillRect(-w,-l*0.2,2*w,l*1.4)}
function heart(g,x,y,s,c){g.fillStyle=rgb(c);g.beginPath();g.moveTo(x,y+0.35*s);g.bezierCurveTo(x-0.9*s,y-0.25*s,x-0.35*s,y-0.9*s,x,y-0.35*s);g.bezierCurveTo(x+0.35*s,y-0.9*s,x+0.9*s,y-0.25*s,x,y+0.35*s);g.fill()}
const DESIGNS=[
  {id:'solid',n:'원컬러',paint:(g,w,l,c)=>fill(g,w,l,c)},
  {id:'french',n:'프렌치',paint:(g,w,l,c,f,s,l0)=>{fill(g,w,l,[246,216,214],0.82);const h=w/2,y0=l0*0.74,k=l0*0.14;
    g.fillStyle=rgb(c[0]+c[1]+c[2]>600?[250,248,244]:c);g.beginPath();g.moveTo(-w,l*1.2);g.lineTo(-w,y0);
    for(let i=0;i<=16;i++){const x=-h+i*w/16,t=x/h;g.lineTo(x,y0+k*(1-t*t))}g.lineTo(w,y0);g.lineTo(w,l*1.2);g.closePath();g.fill()}},
  {id:'ombre',n:'그라데이션',paint:(g,w,l,c)=>{fill(g,w,l,nude,0.7);const gr=g.createLinearGradient(0,l*0.22,0,l*0.92);gr.addColorStop(0,rgb(c,0));gr.addColorStop(0.55,rgb(c,0.75));gr.addColorStop(1,rgb(c,1));g.fillStyle=gr;g.fillRect(-w,-l*0.2,2*w,l*1.4)}},
  {id:'glitter',n:'글리터',paint:(g,w,l,c,f,s)=>{fill(g,w,l,mix(c,[0,0,0],0.15));const r=rnd(s+7),n=Math.round(w*l/9)+30;
    for(let i=0;i<n;i++){const x=(r()-0.5)*w,y=r()*l,z=0.6+r()*Math.max(1.2,w*0.035),b=r();g.fillStyle=b>0.55?'rgba(255,255,255,.95)':b>0.3?rgb(mix(c,[255,240,200],0.6),0.95):'rgba(255,215,140,.9)';g.fillRect(x,y,z,z)}}},
  {id:'magnet',n:'자석',paint:(g,w,l,c)=>{const d=mix(c,[0,0,0],0.55);fill(g,w,l,d);const gr=g.createLinearGradient(-w*0.6,l*0.15,w*0.6,l*0.85);
    gr.addColorStop(0,rgb(d,0));gr.addColorStop(0.3,rgb(mix(c,[255,255,255],0.15),0.2));gr.addColorStop(0.46,rgb(mix(c,[255,255,255],0.45),0.75));gr.addColorStop(0.5,rgb(mix(c,[255,255,255],0.7),0.95));gr.addColorStop(0.54,rgb(mix(c,[255,255,255],0.45),0.75));gr.addColorStop(0.7,rgb(mix(c,[255,255,255],0.15),0.2));gr.addColorStop(1,rgb(d,0));g.fillStyle=gr;g.fillRect(-w,-l*0.2,2*w,l*1.4)}},
  {id:'marble',n:'마블',paint:(g,w,l,c,f,s)=>{fill(g,w,l,[246,244,240]);const r=rnd(s+3);g.lineCap='round';g.lineJoin='round';
    const vein=(lw,a,col,blur)=>{g.save();g.filter=blur?`blur(${Math.max(0.5,w*0.03).toFixed(1)}px)`:'none';g.strokeStyle=rgb(col,a);g.lineWidth=lw;g.beginPath();
      let x=(r()-0.5)*w,y=-l*0.1;g.moveTo(x,y);for(let k=0;k<4;k++){const nx=(r()-0.5)*w*1.2,ny=y+l*(0.25+r()*0.2);g.quadraticCurveTo((x+nx)/2+(r()-0.5)*w*0.6,(y+ny)/2,nx,ny);x=nx;y=ny}g.stroke();g.restore()};
    for(let i=0;i<2;i++)vein(Math.max(1,w*0.16),0.28,mix(c,[255,255,255],0.3),true);
    for(let i=0;i<3;i++)vein(Math.max(0.6,w*(0.025+r()*0.03)),0.7,mix(c,[0,0,0],0.1),false)}},
  {id:'chrome',n:'크롬',paint:(g,w,l,c)=>{const gr=g.createLinearGradient(-w/2,0,w/2,0),lt=mix(c,[255,255,255],0.75),dk=mix(c,[0,0,0],0.45);
    gr.addColorStop(0,rgb(dk));gr.addColorStop(0.28,rgb(lt));gr.addColorStop(0.45,rgb(mix(c,[255,255,255],0.2)));gr.addColorStop(0.7,rgb(dk));gr.addColorStop(0.9,rgb(lt));gr.addColorStop(1,rgb(mix(c,[0,0,0],0.3)));g.fillStyle=gr;g.fillRect(-w,-l*0.2,2*w,l*1.4)}},
  {id:'heart',n:'하트 포인트',paint:(g,w,l,c,f,s,l0)=>{if(f===3||f===0){fill(g,w,l,[246,222,220]);heart(g,0,l0*0.52,w*0.34,c)}else fill(g,w,l,c)}},
  {id:'mine',n:'내 시안',mine:true,paint:(g,w,l,c,f,s,l0,img)=>{if(!img){fill(g,w,l,[230,225,222]);return}const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,k=Math.max(w/iw,l/ih);
    g.drawImage(img,-iw*k/2,l/2-ih*k/2,iw*k,ih*k)}}
];
const byId=id=>DESIGNS.find(d=>d.id===id)||DESIGNS[0];
// 사진의 빛(밝기 흐름)을 손톱 자리에서 8×12로 재서 4×6 회색 지도로 — 오버레이로 입혀 실제 조명을 따라가게
const smp=document.createElement('canvas');smp.width=8;smp.height=12;const sg=smp.getContext('2d',{willReadFrequently:true});
function light(src,G){const w=G.wid,l=G.l0,nx=-G.uy,ny=G.ux,kx=8/(1.3*w),ky=12/(1.2*l);
  sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,8,12);
  sg.setTransform(kx*nx,ky*G.ux,kx*ny,ky*G.uy,-kx*(nx*G.bx+ny*G.by)+4,-ky*(G.ux*G.bx+G.uy*G.by)+0.1*l*ky);
  sg.imageSmoothingQuality='high';try{sg.drawImage(src,0,0)}catch(e){return null}
  let d;try{d=sg.getImageData(0,0,8,12).data}catch(e){return null}
  const v=[],cs=[0,0,0];let m=0,n=0;for(let k=0;k<96;k++){const a=d[k*4+3];const y=a>200?0.299*d[k*4]+0.587*d[k*4+1]+0.114*d[k*4+2]:NaN;v.push(y);if(a>200){m+=y;n++;cs[0]+=d[k*4];cs[1]+=d[k*4+1];cs[2]+=d[k*4+2]}}
  if(!n)return null;m/=n;const c=document.createElement('canvas');c.width=8;c.height=12;const cg=c.getContext('2d'),im=cg.createImageData(8,12);
  v.forEach((y,i)=>{const t=Number.isNaN(y)?1:Math.min(1.3,Math.max(0.72,y/m)),g=Math.round(128*t);im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=g;im.data[i*4+3]=255});
  cg.putImageData(im,0,0);let lt=0,rt=0;for(let j=0;j<12;j++){lt+=(v[j*8]||m)+(v[j*8+1]||m);rt+=(v[j*8+6]||m)+(v[j*8+7]||m)}
  const t=cs.map(x=>Math.pow(Math.max(1,x/n)/Math.max(1,m),0.35)),tm=Math.max(...t);return{c,mean:m/255,side:lt>rt?-1:1,tint:t.map(x=>Math.round(255*x/tm))}}
// 손톱 하나 그리기. G: 화면 좌표의 자리, o: {design,color,shape,seed,img,light,bright}
function draw(g,G,o){const w=G.wid,l=G.len,D=byId(o.design),pth=path(w,l,o.shape);
  g.save();g.setTransform(-G.uy*o.k,G.ux*o.k,G.ux*o.k,G.uy*o.k,G.bx,G.by);   // o.k: 화면 배율(로컬 단위 = 이미지 픽셀)
  g.save();g.clip(pth);D.paint(g,w,l,o.color,G.f,o.seed,G.l0,o.img);
  const L=o.light;
  if(L){g.globalCompositeOperation='overlay';g.globalAlpha=D.mine?0.5:0.75;g.imageSmoothingEnabled=true;g.drawImage(L.c,-0.65*w,-0.1*G.l0,1.3*w,1.2*G.l0);g.imageSmoothingEnabled=true}
  if((o.bright&&o.bright<0.99)||(L&&L.tint)){g.globalCompositeOperation='multiply';g.globalAlpha=1;const b=o.bright||1,tn=L&&L.tint||[255,255,255];g.fillStyle=`rgb(${tn[0]*b|0},${tn[1]*b|0},${tn[2]*b|0})`;g.fillRect(-w,-l*0.2,2*w,l*1.4)}
  // 큐티클 쪽은 살짝 어둡게
  g.globalCompositeOperation='source-over';g.globalAlpha=1;const cu=g.createLinearGradient(0,0,0,Math.min(l,G.l0)*0.35);cu.addColorStop(0,'rgba(40,15,10,.22)');cu.addColorStop(1,'rgba(40,15,10,0)');g.fillStyle=cu;g.fillRect(-w,-l*0.2,2*w,l*1.4);
  // 둥근 면: 양옆을 조금 어둡게
  g.globalCompositeOperation='source-over';g.globalAlpha=1;const e=g.createLinearGradient(-w/2,0,w/2,0);
  e.addColorStop(0,'rgba(0,0,0,.26)');e.addColorStop(0.2,'rgba(0,0,0,0)');e.addColorStop(0.8,'rgba(0,0,0,0)');e.addColorStop(1,'rgba(0,0,0,.26)');g.fillStyle=e;g.fillRect(-w,-l*0.2,2*w,l*1.4);
  // 광택: 빛이 오는 쪽에 길쭉한 하이라이트
  const sx=(L?L.side:-1)*0.2*w;g.globalCompositeOperation='screen';const hl=g.createLinearGradient(0,l*0.1,0,l*0.8);
  hl.addColorStop(0,'rgba(255,255,255,0)');hl.addColorStop(0.3,'rgba(255,255,255,.5)');hl.addColorStop(0.75,'rgba(255,255,255,.18)');hl.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=hl;g.beginPath();g.ellipse(sx,l*0.45,Math.max(0.6,w*0.07),l*0.34,0,0,7);g.fill();
  g.globalAlpha=0.35;g.beginPath();g.ellipse(-sx*0.6,l*0.2,Math.max(0.5,w*0.05),l*0.08,0,0,7);g.fill();
  g.restore();
  // 테두리: 큐티클 쪽 그늘
  g.globalAlpha=1;g.lineWidth=Math.max(0.6,w*0.03);g.strokeStyle=D.mine?'rgba(60,30,25,.25)':rgb(mix(o.color,[20,8,8],0.55),0.45);g.stroke(pth);g.restore()}
// 카드용 미리보기: 피부색 바탕에 손톱 세 개
function thumb(cv,design,color,shape,img){const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.setTransform(1,0,0,1,0,0);
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#f0d3c2');bg.addColorStop(1,'#dcae96');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const lens=[0.62,0.7,0.6];[-1,0,1].forEach((s,i)=>{const w=W*0.22,l=H*lens[i]*(shape==='almond'||shape==='stiletto'?1.05:0.9),bx=W/2+s*W*0.29,by=H*0.92-l*(i===1?1.08:1);
    g.fillStyle='#e7bea6';g.beginPath();g.ellipse(bx,by+l*0.55,w*0.68,l*0.75,0,0,7);g.fill();
    draw(g,{bx,by:by+l,ux:0,uy:-1,wid:w,len:l,l0:l,f:[1,2,3][i]},{design,color,shape,seed:i+1,img,light:null,k:1})})}
return{COLORS,DESIGNS,SHAPES,FT,geom,path,light,draw,thumb,byId}})();
