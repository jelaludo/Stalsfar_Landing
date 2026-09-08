"""Audio gesture gating, real decoding, impact routing and lifecycle."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(reduced_motion='reduce');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.audioContexts=[];window.audioStarts=[];
 const Original=window.AudioContext;
 window.AudioContext=class extends Original{constructor(...args){super(...args);audioContexts.push(this);}};
 window.audioStops=0;const stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.stop=function(...args){audioStops++;return stop.apply(this,args);};
 const start=AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start=function(...args){audioStarts.push(this.buffer.duration);return start.apply(this,args);};''')
 page.clock.install();page.goto('http://127.0.0.1:8001/landing/')
 assert page.evaluate('audioContexts.length')==0
 page.get_by_role('button',name='BEGIN DESCENT').click()
 page.wait_for_function("audioContexts[0].state==='running'")
 page.clock.run_for(200)
 page.wait_for_function('audioStarts.some(d=>d<26)')
 assert page.evaluate('audioStarts.filter(d=>d>26).length')==0
 page.keyboard.down('Space');page.clock.run_for(200)
 page.wait_for_function('audioStarts.some(d=>d>26)')
 page.keyboard.up('Space');page.clock.run_for(50)
 assert page.evaluate('audioStops')>0
 count=page.evaluate('audioStarts.length')
 page.clock.run_for(200);assert page.evaluate('audioStarts.length')==count
 page.keyboard.down('Space');page.clock.run_for(100)
 page.wait_for_function(f'audioStarts.length>{count}')
 assert page.evaluate('audioStarts.some(d=>d>26 && d<27)')
 page.keyboard.press('Escape');page.wait_for_function("audioContexts[0].state==='suspended'")
 page.keyboard.press('Escape');page.wait_for_function("audioContexts[0].state==='running'")
 page.keyboard.up('Space')
 page.clock.run_for(18000)
 page.wait_for_function('audioStarts.some(d=>d>1.7&&d<1.9)')
 page.wait_for_function('audioStarts.some(d=>d>2&&d<2.2)')
 page.get_by_role('button',name='SKIP ↗').click()
 page.get_by_role('button',name='SKIP INTRO',exact=True).click()
 page.wait_for_function("audioContexts[0].state==='closed'")
 assert not errors,errors
 print('Audio: silent until manual thrust; release/repress gates burn; all three local clips decoded and played; pause/resume and cleanup passed.',flush=True)
 b.close()
