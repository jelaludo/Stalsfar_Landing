// Floating analogue steering. A second pointer can independently hold BOOST.
export function createTouchPilot(ui,signal,enabled){
 const ring=ui.querySelector('.thumb-stick'),knob=ring.querySelector('i');
 let pointer=null,x=0,y=0,turn=0;
 const reset=()=>{pointer=null;turn=0;ring.hidden=true;knob.style.transform='translate(-50%,-50%)';};
 const move=e=>{if(e.pointerId!==pointer)return;e.preventDefault();const dx=e.clientX-x,dy=e.clientY-y,length=Math.hypot(dx,dy),factor=Math.min(1,48/Math.max(1,length));const horizontal=dx*factor;turn=Math.abs(horizontal)<5?0:Math.sign(horizontal)*(Math.abs(horizontal)-5)/43;knob.style.transform=`translate(calc(-50% + ${horizontal}px),calc(-50% + ${dy*factor}px))`;};
 window.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||pointer!==null||!enabled()||e.clientX>innerWidth*.55||e.target.closest('button,a,input,summary,select'))return;
  e.preventDefault();pointer=e.pointerId;x=e.clientX;y=e.clientY;ring.style.left=`${x}px`;ring.style.top=`${y}px`;ring.hidden=false;e.target.setPointerCapture?.(pointer);move(e);
 },{signal,passive:false});
 window.addEventListener('pointermove',move,{signal,passive:false});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(name,e=>{if(e.pointerId===pointer)reset();},{signal});
 window.addEventListener('blur',reset,{signal});window.addEventListener('resize',reset,{signal});signal.addEventListener('abort',reset,{once:true});
 return {get turn(){return turn;},reset};
}
