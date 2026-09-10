// Starship by @XorDev, adapted by Pulkit (MIT) and the Onkochishin lab.
// https://kai-denrei.github.io/onkochishin/atelier/starship/
// https://github.com/pulkitxm/claude-directory/tree/main/shaders/starship-shader
// License: ./licenses/starship-shader-MIT.txt
export const STARSHIP_COUNT = 6;
export function starshipSettings(elapsed) {
 const seconds=Math.max(0,elapsed);
 return {time:seconds*3,exposure:.05+3.95*Math.min(1,seconds/5)};
}

// Select once per document, so FLY AGAIN does not consume another reload.
let documentVariant;
export function openingVariant() {
 if(documentVariant)return documentVariant;
 documentVariant='launch';
 try {
  const key='six-down-opening-next';
  documentVariant=localStorage.getItem(key)==='starship'?'starship':'launch';
  localStorage.setItem(key,documentVariant==='launch'?'starship':'launch');
 } catch { /* Storage-disabled browsers still get the original opening. */ }
 return documentVariant;
}

const VERTEX=`#version 300 es
layout(location=0) in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.,1.);}`;
const FRAGMENT=`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform float iExposure;
uniform sampler2D iChannel0;

// Original noise-warped exhaust field, with initialized accumulators.
vec3 starship(vec2 I, vec2 r, float t) {
 vec2 p=(I+I-r)/r.y*mat2(3.,4.,4.,-3.)/1e2;
 vec4 S=vec4(0.0), C=vec4(1.,2.,3.,0.), W;
 for(float T=.1*t+p.y,i=0.;i<50.;i+=1.) {
  W=sin(i)*C;
  S+=(cos(W)+1.)*exp(sin(i+i*T))
   /max(length(max(p,p/vec2(2.,max(texture(iChannel0,p/exp(W.x)+vec2(i,t)/8.).r,0.0001)*40.))),0.000001)/1e4;
  p+=.02*cos(i*(C.xz+8.+i)+T+T);
 }
 return (S*S).rgb;
}
void main() {
 vec2 r=iResolution;
 bool portrait=r.x<r.y;
 vec2 grid=portrait?vec2(2.,3.):vec2(3.,2.);
 vec2 cell=r/grid;
 float size=min(cell.x,cell.y)*.8;
 vec3 light=vec3(0.);
 for(int ship=0;ship<${STARSHIP_COUNT};ship++) {
  float n=float(ship);
  vec2 slot=vec2(mod(n,grid.x),floor(n/grid.x));
  vec2 center=(slot+.5)*cell;
  vec2 local=gl_FragCoord.xy-center+size*.5;
  light+=starship(local,vec2(size),iTime);
 }
 fragColor=vec4(tanh(light*iExposure),1.);
}`;

export function createStarshipIntro(before) {
 const canvas=document.createElement('canvas');
 canvas.className='launch-plume';canvas.dataset.intro='starship';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 if(!gl)return null;
 const shaders=[];let program,buffer,texture,disposed=false,lastTime=-1;
 const destroy=()=>{
  if(disposed)return;disposed=true;canvas.remove();
  if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
  for(const shader of shaders)gl.deleteShader(shader);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
 };
 try {
  const compile=(type,source)=>{
   const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;
  };
  program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  // Same generated 256² RGBA noise channel, linear sampling and repeating edges.
  const noise=new Uint8Array(256*256*4);let seed=0x57a15fa;
  for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed>>>24;}
  texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,noise);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program,'iChannel0'),0);
  const uniforms=Object.fromEntries(['iResolution','iTime','iExposure'].map(name=>[name,gl.getUniformLocation(program,name)]));
  before.before(canvas);
  const draw=(elapsed,_y,width,height,force=false)=>{
   if(disposed)return;
   if(!force&&lastTime>=0&&Math.abs(elapsed-lastTime)<1/30)return;lastTime=elapsed;
   // Six fields share one context; cap fill rate for the 300 noise samples/pixel.
   const ratio=Math.min(1,960/width,600/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const settings=starshipSettings(elapsed);
   gl.viewport(0,0,w,h);gl.uniform2f(uniforms.iResolution,w,h);gl.uniform1f(uniforms.iTime,settings.time);gl.uniform1f(uniforms.iExposure,settings.exposure);gl.drawArrays(gl.TRIANGLES,0,3);
  };
  return {canvas,draw,destroy};
 } catch(error) {console.warn('Starship shader unavailable',error);destroy();return null;}
}
