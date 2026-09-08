"""Run with a separately installed Playwright and localhost:8001 serving this repo."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 errors=[]
 def scene(**kwargs):
  page=b.new_page(service_workers='block',**kwargs);page.on('pageerror',lambda e:errors.append(str(e)))
  page.clock.install();page.goto('http://127.0.0.1:8001/landing/?mode=classic');return page
 def ready(page):
  if page.locator('.cockpit').get_attribute('data-phase')=='opening':
   page.get_by_role('button',name='SKIP CINEMATIC').click();page.clock.run_for(20)
  assert page.locator('.launch-plume').count()==0
 def start(page):
  ready(page)
  page.get_by_role('button',name='BEGIN DESCENT').click()
  page.clock.run_for(2700)
  assert page.locator('.cockpit').get_attribute('data-phase')=='flying'
 page=scene(viewport={'width':1440,'height':900})
 ready(page)
 assert 'HOLD TO THRUST' in page.locator('.start-card').inner_text()
 page.screenshot(path='/tmp/stalsfar-controls.png')
 page.get_by_role('button',name='BEGIN DESCENT').click()
 page.clock.run_for(200);page.screenshot(path='/tmp/stalsfar-arrival.png')
 page.clock.run_for(700)
 page.keyboard.down('Space');page.clock.run_for(1500)
 assert float(page.locator('[data-read="fuel"]').inner_text())<13
 # Esc must pause, including during held thrust. Repeats cannot relight after resume.
 page.keyboard.press('Escape');before=page.locator('[data-read="clock"]').inner_text()
 assert page.locator('.skip-card').is_hidden()
 page.clock.run_for(2000);assert page.locator('[data-read="clock"]').inner_text()==before
 page.keyboard.press('Escape')
 page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',repeat:true}))")
 page.clock.run_for(1000);fuel=page.locator('[data-read="fuel"]').inner_text()
 page.clock.run_for(1000);assert page.locator('[data-read="fuel"]').inner_text()==fuel
 page.keyboard.up('Space')
 # Fresh held input works, release cuts, and blur clears both keyboard and touch.
 page.keyboard.down('Space');page.clock.run_for(600);page.keyboard.up('Space');page.clock.run_for(600)
 cut=page.locator('[data-read="fuel"]').inner_text();page.clock.run_for(500);assert page.locator('[data-read="fuel"]').inner_text()==cut
 page.keyboard.down('Space');page.clock.run_for(200);page.evaluate("window.dispatchEvent(new Event('blur'))")
 assert page.locator('.pause-card').is_visible()
 page.keyboard.up('Space');page.locator('.pause-card button').click();page.clock.run_for(800)
 cut=page.locator('[data-read="fuel"]').inner_text();page.clock.run_for(500);assert page.locator('[data-read="fuel"]').inner_text()==cut
 page.clock.run_for(250000)
 result=json.loads(page.locator('pre').text_content());assert len(result['landings'])==6 and result['status']=='completed'
 print('Space/release, Esc, blur, and six-entry completion passed',flush=True)
 page.get_by_role('button',name='FLY AGAIN').click();ready(page)
 page.get_by_role('button',name='SKIP ↗').click();page.get_by_role('button',name='SKIP INTRO',exact=True).click()
 result=json.loads(page.locator('pre').text_content());assert result['status']=='skipped' and result['resources']['crew']==4
 mobile=scene(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
 ready(mobile);mobile.screenshot(path='/tmp/stalsfar-mobile-controls.png');start(mobile)
 cdp=mobile.context.new_cdp_session(mobile);burn=mobile.locator('.thumb-boost').bounding_box()
 points=[{'x':burn['x']+burn['width']/2,'y':burn['y']+burn['height']/2,'id':0},{'x':75,'y':400,'id':1}]
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points});points[1]['x']=115
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points});mobile.clock.run_for(900)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.clock.run_for(500)
 assert float(mobile.locator('[data-read="fuel"]').inner_text())<13.5
 mobile.screenshot(path='/tmp/stalsfar-mobile-flight.png');assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Missing sprites and reduced motion: immediately readable splash, no camera cinematic.
 fallback=b.new_page(service_workers='block',viewport={'width':1000,'height':800},reduced_motion='reduce')
 fallback.on('pageerror',lambda e:errors.append(str(e)));fallback.route('**/assets/**',lambda r:r.abort())
 fallback.clock.install();fallback.goto('http://127.0.0.1:8001/landing/?mode=classic')
 assert fallback.locator('.cockpit').get_attribute('data-phase')=='ready'
 fallback.get_by_role('button',name='BEGIN DESCENT').click()
 assert fallback.locator('.cockpit').get_attribute('data-phase')=='flying'
 fallback.clock.run_for(250000);assert json.loads(fallback.locator('pre').text_content())['status']=='completed'
 print('Replay, skip, multitouch, reduced motion, and fallback completion passed',flush=True)
 api=scene();ready(api)
 api.get_by_role('button',name='SKIP ↗').click();api.get_by_role('button',name='SKIP INTRO',exact=True).click()
 check=api.evaluate("""async()=>{document.querySelector('.summary').remove();const before=document.body.childElementCount;const {runLandingIntro}=await import('./lander.js');const inert=before===document.body.childElementCount;window.testPromise=runLandingIntro(document.querySelector('canvas'),{entries:1,onEntryResolved:()=>{throw Error('injected test fault')}});let duplicate=false;try{runLandingIntro(document.querySelector('canvas'))}catch{duplicate=true}return {inert,duplicate}}""")
 assert check=={'inert':True,'duplicate':True}
 start(api);api.clock.run_for(20000)
 assert api.evaluate('async()=>(await window.testPromise).status')=='skipped'
 assert api.locator('.cockpit').count()==0
 print('API lifecycle passed; browser errors:',errors,flush=True);assert not errors
 b.close()
