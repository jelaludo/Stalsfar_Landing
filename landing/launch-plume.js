// Launch shader by Pulkit (MIT), adapted from the Onkochishin Launch lab.
// Source: https://github.com/pulkitxm/claude-directory/tree/main/shaders/launch-shader
// License: ./licenses/launch-shader-MIT.txt
// The field/ray march is retained; loop accumulators are explicitly initialized.
const FRAGMENT = `#version 300 es
precision highp float;

out vec4 fragColor;
in vec2 v_uv;

uniform vec3  iResolution;   
uniform float iTime;         
uniform int   iFrame;        
uniform vec4  iMouse;        
uniform float uSteps;
uniform vec2 uTint;
uniform vec3 uCam;
uniform float uSquash;
uniform float uOctaves;
uniform float uTurb;
uniform float uCore;
uniform float uDetail;
uniform float uStepSize;
uniform float uExposure;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2  r  = iResolution.xy;
    float t  = iTime;
    vec3  FC = vec3(fragCoord, t);
    vec4  o  = vec4(0.0);

    
    for (float i = 0., z = 0., d = 0., f = 0.; i++ < uSteps; o += vec4(uTint.x, uTint.y, d, z / f) / z) {
        vec3 v = uCam;
        vec3 p = z * normalize(FC.rgb * 2. - r.xyx) + v;
        vec3 a = p;
        a.y *= uSquash;
        for (d = 1.; d++ < uOctaves; )
            a -= uTurb * sin((a.zxy + t * v + d) * d) * p.y / d;

        z += d = min(
                max(-p.y, length(a) - uCore),
                f = .2 + abs(length(a.xz - cos(a.zx * uDetail)) + max(p.y / .1, - .6))
            ) / uStepSize;
    }
    o = tanh(o * o.a / uExposure);  

    fragColor = vec4(o.rgb, 1.0);
}

void main(){
  mainImage(fragColor, gl_FragCoord.xy);
}`;
const VERTEX = `#version 300 es
layout(location=0) in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.,1.);}`;

export function createLaunchPlume(before) {
 const canvas=document.createElement('canvas');canvas.className='launch-plume';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 if(!gl)return null;
 const shaders=[];let program,buffer,disposed=false,lastTime=-1;
 const destroy=()=>{if(disposed)return;disposed=true;canvas.remove();if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.getExtension('WEBGL_lose_context')?.loseContext();};
 try{
  const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const location=name=>gl.getUniformLocation(program,name),uniforms={};
  for(const name of ['iResolution','iTime','uCam'])uniforms[name]=location(name);
  for(const [name,value] of Object.entries({uSteps:100,uSquash:.3,uOctaves:9,uTurb:.1,uCore:2,uDetail:6,uStepSize:8,uExposure:1000}))gl.uniform1f(location(name),value);
  gl.uniform2f(location('uTint'),3,1);
  before.before(canvas);
  const draw=(time,y,width,height,force=false)=>{
   if(disposed)return;
   if(!force&&lastTime>=0&&Math.abs(time-lastTime)<1/30)return;lastTime=time;
   // Fixed scale, at up to native CSS resolution; no low-res image is zoomed.
   const ratio=Math.min(1,1600/width,1000/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.uniform3f(uniforms.iResolution,w,h,1);gl.uniform1f(uniforms.iTime,time);gl.uniform3f(uniforms.uCam,0,y,7);gl.drawArrays(gl.TRIANGLES,0,3);
  };
  return {canvas,draw,destroy};
 }catch(error){console.warn('Launch shader unavailable',error);destroy();return null;}
}
