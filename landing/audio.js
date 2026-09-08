// User-supplied audio. Loading bytes is silent; AudioContext is created only by Begin Descent.
const SETTINGS={lowpassHz:2400,master:.7,launch:.45,crash:.85,impact:.4,maxImpacts:4,impactGap:.16};
export function createLandingAudio(signal) {
 const base=new URL('./assets/audio/',import.meta.url),raw={};
 for(const kind of ['launch','crash','impact','handoff','alarm'])raw[kind]=fetch(new URL(`${kind}.mp3`,base),{signal}).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);
 let context=null,filter,compressor,master,disposed=false,paused=false,muted=false,generation=0,launchGeneration=0,burning=false,lastImpact=-100;
 const buffers={},voices=new Set();
 const prepare=()=>{
  if(context||disposed)return;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  context=new Audio();filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=SETTINGS.lowpassHz;filter.Q.value=.6;
  compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=3;compressor.attack.value=.01;compressor.release.value=.2;
  master=context.createGain();master.gain.value=muted?0:SETTINGS.master;
  filter.connect(compressor);compressor.connect(master);master.connect(context.destination);
  for(const kind of Object.keys(raw))buffers[kind]=raw[kind].then(bytes=>bytes&&!disposed?context.decodeAudioData(bytes.slice(0)):null).catch(()=>null);
 };
 const stopLaunch=()=>{
  burning=false;launchGeneration++;
  if(!context)return;
  for(const voice of voices)if(voice.kind==='launch'){
   const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.12);
   try{voice.source.stop(now+.13);}catch{}
  }
 };
 const play=async(kind,volume,rate=1,duration=0)=>{
  if(!context||disposed||paused)return;
  const token=generation,launchToken=launchGeneration;
  try{await context.resume();}catch{return;}
  const buffer=await buffers[kind];
  if(!buffer||disposed||paused||token!==generation||context.state!=='running')return;
  if(kind==='launch'&&launchToken!==launchGeneration)return;
  if(kind==='impact'&&[...voices].filter(v=>v.kind==='impact').length>=SETTINGS.maxImpacts)return;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=kind==='launch';source.playbackRate.value=rate;gain.gain.value=volume;
  source.connect(gain);gain.connect(filter);const voice={source,gain,kind};voices.add(voice);
  source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};source.start();if(duration)source.stop(context.currentTime+duration);
 };
 const thrust=value=>{
  value=Boolean(value)&&!paused&&!disposed;
  if(value===burning)return;
  if(!value){stopLaunch();return;}
  burning=true;void play('launch',SETTINGS.launch);
 };
 return {
  begin(){
   try{prepare();if(context)void context.resume().catch(()=>{});}catch{/* Sound must not block the game. */}
  },
  thrust,
  handoff(){void play('handoff',.55,1,2.5);},
  alarm(){void play('alarm',.5,1,2);},
  crash(){void play('crash',SETTINGS.crash);},
  resolve(crashed){stopLaunch();if(crashed)void play('crash',SETTINGS.crash);},
  impact(event){
   if(event.age<.15||event.speed<2.5||event.time-lastImpact<SETTINGS.impactGap)return;
   lastImpact=event.time;
   const strength=Math.max(.2,Math.min(1,event.speed/25));
   void play('impact',SETTINGS.impact*strength,.86+strength*.12);
  },
  pause(value){
   if(value)stopLaunch();
   paused=value;generation++;
   if(context&&!disposed)void(value?context.suspend():context.resume()).catch(()=>{});
  },
  mute(value){muted=value;if(master)master.gain.setTargetAtTime(value?0:SETTINGS.master,context.currentTime,.03);},
  destroy(){
   if(disposed)return;disposed=true;generation++;
   for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}voices.clear();
   if(context)void context.close().catch(()=>{});
  },
 };
}
