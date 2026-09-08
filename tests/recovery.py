"""Exercise real finish-screen rendering with controlled host results."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);errors=[]
 for survivors in [2,3,6]:
  page=b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  result={'status':'completed','grade':'B','survivors':survivors,'reconstructionUnlocked':survivors>=5,'resources':{'propellant':260,'alloy':150,'crew':3,'credits':420},'assistsUsed':[], 'landings':[{'index':i,'padTier':'APRON','outcome':'perfect' if i<survivors else 'wreck','verdict':'SINK 1.5m/s · LIMIT 2.5m/s'} for i in range(6)]}
  page.route('**/lander.js*',lambda route:route.fulfill(content_type='text/javascript',body='export async function runLandingIntro(){return '+json.dumps(result)+';}'))
  page.goto('http://localhost:8001/landing/')
  page.wait_for_selector('.summary')
  if survivors<3:assert page.locator('.recovery-stage').count()==0
  else:
   page.wait_for_selector('.recovery-stage[data-ready="true"]',timeout=30000)
   a=page.locator('.recovery-stage').screenshot();page.wait_for_timeout(1200);z=page.locator('.recovery-stage').screenshot();assert a!=z,'Animation must move'
   page.screenshot(path=f'/tmp/stalsfar-recovery-{survivors}.png')
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/tmp/stalsfar-recovery-mobile.png')
   assert page.evaluate('document.querySelector(".summary").scrollWidth<=innerWidth')
   page.get_by_role('button',name='FLY AGAIN').click();page.wait_for_selector('.recovery-stage[data-ready="true"]');assert page.locator('.recovery-stage canvas').count()==1
  page.close()
 assert not errors,errors
 print('Recovery: threshold 2/3/6, animated GLB, responsive layout and replay cleanup passed.');b.close()
