// 실사 가발 엔진 — 사진에서 오려낸 가발을 얼굴 기준점(이마 꼭대기·얼굴 폭)에 맞춰 붙이고, 원하면 색만 바꾼다.
// 좌표: 얼굴 폭 = 1, 이마 꼭대기(랜드마크 10) = 원점, 아래로 +y
const WIG=(()=>{
const cl=(v,a,b)=>v<a?a:v>b?b:v;
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const COLORS=[['자연 흑발','#0b0908','#1f1916','#8a8790'],['다크 브라운','#170d08','#3a2418','#a07554'],['애쉬 브라운','#211a17','#574a43','#ab9c91'],
  ['밀크 브라운','#3a2416','#8a6142','#dcb58e'],['애쉬 블론드','#665640','#b39f80','#f1e4cb'],['와인','#1e070b','#5e1a26','#b85d6a'],
  ['핑크 브라운','#361c1e','#8c5458','#dda7a9'],['애쉬 그레이','#3a383a','#8a888b','#e0dfe4']].map(([n,d,b,l])=>({n,sw:b,d:hx(d),b:hx(b),l:hx(l)}));
// 실사 가발 — 사진에서 오려낸 가발을 '이마 꼭대기 점(cx,cy)'과 '얼굴 폭(w)'에 맞춰 붙인다 (단위: 이미지 픽셀)
const PH={
  layered:{name:'내추럴 레이어드',f:'wigs/layered.webp',cx:278.0,cy:157.5,w:256.2},
  beachbob:{name:'비치 웨이브 단발',f:'wigs/beachbob.webp',cx:266.0,cy:152.8,w:247.8},
  sleek:{name:'슬릭 롱 스트레이트',f:'wigs/sleek.webp',cx:271.0,cy:137.8,w:224.7},
  curtain:{name:'커튼뱅 롱헤어',f:'wigs/curtain.webp',cx:284.0,cy:147.7,w:235.2},
  curlybob:{name:'컬리 단발',f:'wigs/curlybob.webp',cx:293.0,cy:149.6,w:245.7}
};
const phImg={},phTex=new Map();
function photoLoad(id,cb){let im=phImg[id];
  if(!im){im=new Image();im.decoding='async';im.src=PH[id].f;phImg[id]=im}
  if(im.complete&&im.naturalWidth){cb&&cb();return}
  im.addEventListener('load',()=>cb&&cb(),{once:true})}
const photoReady=id=>{const im=phImg[id];return!!(im&&im.complete&&im.naturalWidth)};
// 다른 색으로 바꿀 때: 밝기 순서는 그대로 두고 팔레트(어두운색→기본색→하이라이트)에 대응시킨다
function gradMap(im,c){const w=im.naturalWidth,h=im.naturalHeight,cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const D=g.getImageData(0,0,w,h),p=D.data,hist=new Float64Array(256);let n=0;
  for(let i=0;i<p.length;i+=4)if(p[i+3]>200){hist[(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0]++;n++}
  const pct=q=>{let s=0;for(let i=0;i<256;i++){s+=hist[i];if(s>=q*n)return i}return 255};
  const lo=pct(0.04),hi=Math.max(lo+12,pct(0.985)),lut=new Uint8ClampedArray(768);
  for(let L=0;L<256;L++){const t=cl((L-lo)/(hi-lo),0,1.1),A=t<0.62?c.d:c.b,Bc=t<0.62?c.b:c.l,k=t<0.62?t/0.62:Math.min(1,(t-0.62)/0.38);
    for(let j=0;j<3;j++)lut[L*3+j]=A[j]+(Bc[j]-A[j])*k}
  for(let i=0;i<p.length;i+=4){const L=((p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0)*3;p[i]=lut[L];p[i+1]=lut[L+1];p[i+2]=lut[L+2]}
  g.putImageData(D,0,0);return cv}
function photoTex(id,ci){const k=id+'|'+ci;if(phTex.has(k))return phTex.get(k);if(!photoReady(id))return null;
  let t=phImg[id];try{if(ci>=0)t=gradMap(t,COLORS[ci])}catch(e){}phTex.set(k,t);return t}
function wigOnly(g,a,o){const P=PH[o.style],T=photoTex(o.style,o.ci);if(!T)return false;
  g.save();localT(g,a,o);g.imageSmoothingQuality='high';
  if(o.bright&&Math.abs(o.bright-1)>0.02)g.filter=`brightness(${o.bright.toFixed(2)})`;
  const iw=T.naturalWidth||T.width,ih=T.naturalHeight||T.height;g.drawImage(T,-P.cx/P.w,-P.cy/P.w,iw/P.w,ih/P.w);g.restore();return true}
function drawPhoto(g,a,o){if(!photoTex(o.style,o.ci))return false;skinPatch(g,a,o);return wigOnly(g,a,o)}
// 드러나는 이마 위쪽을 손님 피부색으로 메워 원래 머리선을 가린다
const BROW=new Path2D();BROW.moveTo(-0.43,0.2);BROW.lineTo(-0.44,0);BROW.quadraticCurveTo(-0.42,-0.22,-0.18,-0.25);BROW.lineTo(0.18,-0.25);
BROW.quadraticCurveTo(0.42,-0.22,0.44,0);BROW.lineTo(0.43,0.2);BROW.closePath();
function localT(g,a,o){const{p,W,ang}=a,c=Math.cos(ang),s=Math.sin(ang),k=W*o.sc,ox=o.ox||0;
  g.setTransform(k*o.wx*c,k*o.wx*s,-k*s,k*c,p.x-s*o.oy*W+c*ox*W,p.y+c*o.oy*W+s*ox*W)}
function skinPatch(g,a,o){if(!o.skin)return;g.save();localT(g,a,{sc:1,wx:1,oy:0});const gr=g.createLinearGradient(0,-0.27,0,0.2);
  gr.addColorStop(0,`rgba(${o.skin},1)`);gr.addColorStop(0.62,`rgba(${o.skin},1)`);gr.addColorStop(1,`rgba(${o.skin},0)`);
  g.filter=`blur(${Math.max(1,a.W/22).toFixed(1)}px)`;g.fillStyle=gr;g.fill(BROW);g.restore()}
function extent(id){const P=PH[id],im=phImg[id],w=im&&im.naturalWidth||P.cx*2,h=im&&im.naturalHeight||P.cy*4;
  return{top:-P.cy/P.w,bottom:(h-P.cy)/P.w,half:Math.max(P.cx,w-P.cx)/P.w}}
// 썸네일·테스트용 표준 얼굴 윤곽 (랜드마크 10에서 시계 방향)
const half=[[0,0],[0.17,0.01],[0.3,0.05],[0.41,0.13],[0.48,0.26],[0.505,0.42],[0.495,0.57],[0.47,0.72],[0.42,0.88],[0.33,1.03],[0.2,1.15],[0.08,1.21],[0,1.225]];
const CANON=half.concat(half.slice(1,-1).reverse().map(([x,y])=>[-x,y]));
return{COLORS,PH,list:Object.keys(PH),photoLoad,photoReady,photoTex,drawPhoto,wigOnly,skinPatch,extent,CANON};
})();
