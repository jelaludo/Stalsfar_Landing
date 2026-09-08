"""Reference shader test: only a few forced GPU frames, no gameplay dependencies."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':640,'height':400})
 page.route('**/shader-harness',lambda r:r.fulfill(body='<html><body style="margin:0;background:black"><div id="anchor"></div></body></html>',content_type='text/html'))
 page.goto('http://127.0.0.1:8001/shader-harness')
 result=page.evaluate('''async()=>{
 const {createLaunchPlume}=await import('/landing/launch-plume.js');const {openingCameraY}=await import('/landing/lander.js');
 const effect=createLaunchPlume(document.querySelector('#anchor'));if(!effect)throw Error('WebGL2 test unavailable');
 const gl=effect.canvas.getContext('webgl2'),program=gl.getParameter(gl.CURRENT_PROGRAM),stats=[];
 for(const [time,y] of [[0,2],[5,-8],[8,openingCameraY(8)]]){
  effect.draw(time,y,640,400,true);const data=new Uint8Array(640*400*4);gl.readPixels(0,0,640,400,gl.RGBA,gl.UNSIGNED_BYTE,data);
  let max=0,sum=0;for(let i=0;i<data.length;i+=4){max=Math.max(max,data[i],data[i+1],data[i+2]);sum+=data[i]+data[i+1]+data[i+2];}
  stats.push({y,max,mean:sum/(640*400*3)});
 }
 const uniforms={};for(const name of ['uCam','uTint','uSquash','uOctaves','uTurb','uCore','uDetail','uSteps','uStepSize','uExposure']){
  const value=gl.getUniform(program,gl.getUniformLocation(program,name));uniforms[name]=ArrayBuffer.isView(value)?Array.from(value):value;
 }
 effect.destroy();return {stats,uniforms,remaining:document.querySelectorAll('canvas').length};}''')
 print(result,flush=True)
 assert result['stats'][0]['max']==255 and result['stats'][1]['max']==255
 assert result['stats'][2]['max']==0 and result['stats'][2]['mean']==0
 u=result['uniforms'];assert u['uCam'][0]==0 and u['uCam'][2]==7 and u['uCam'][1]<-8
 assert u['uTint']==[3,1] and u['uOctaves']==9 and u['uCore']==2 and u['uDetail']==6
 assert abs(u['uSquash']-.3)<1e-6 and abs(u['uTurb']-.1)<1e-6
 assert u['uSteps']==100 and u['uStepSize']==8 and u['uExposure']==1000
 assert result['remaining']==0
 print('Reference defaults, Y travel, black final frame, and cleanup passed.',flush=True)
 b.close()
