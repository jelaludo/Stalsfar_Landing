from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 source=Path('landing/fleet.js').read_text().replace("s.mode='fleet';","globalThis.testFleet=s;s.mode='fleet';")
 page.route('**/fleet.js*',lambda r:r.fulfill(content_type='text/javascript',body=source))
 page.add_init_script('''window.clips=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){clips.push(this.buffer.duration);return start.apply(this,args);};''')
 page.clock.install();page.goto('http://localhost:8001/landing/?mode=fleet&seed=7');page.get_by_role('button',name='BEGIN DESCENT').click();page.clock.run_for(1000)
 assert page.locator('.crt-alert').is_hidden();assert page.evaluate('testFleet.controlled===null&&testFleet.selected===-1');assert page.locator('.pad-list .selected').count()==0
 page.clock.run_for(13500)
 page.wait_for_function('clips.some(d=>d>1&&d<1.1)&&clips.some(d=>d>32&&d<34)')
 assert page.locator('.crt-alert').is_visible();assert page.locator('.fleet-status span').count()==6
 page.screenshot(path='/tmp/stalsfar-fleet-override.png')
 # Place the controlled booster at a valid touchdown to exercise the offer UI.
 page.evaluate('''()=>{const s=testFleet,v=s.v,p=s.terrain.pads[s.selected];Object.assign(v,{x:p.x,y:p.y+11.24,vy:-1.5,vx:0,angle:0,angVel:0,legs:1});}''')
 page.clock.run_for(300);assert page.locator('.takeover-card').is_visible()
 page.screenshot(path='/tmp/stalsfar-fleet-offer.png')
 page.get_by_role('button',name='TAKE OVER',exact=True).click();page.clock.run_for(200)
 assert page.evaluate('testFleet.controlled===testFleet.lastUnit')
 page.keyboard.press('Escape');before=page.evaluate('testFleet.time');page.clock.run_for(1000);assert page.evaluate('testFleet.time')==before;page.keyboard.press('Escape')
 page.clock.run_for(85000);assert page.locator('.summary').count()==1
 page.get_by_role('button',name='FLY AGAIN').click();assert page.locator('.start-card').is_visible()
 assert not errors,errors
 print('Fleet browser: CRT alert, six live units, optional takeover, pause, completion and replay passed.');b.close()
