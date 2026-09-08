from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch();errors=[]
 for width,height in [(1600,350),(844,390),(390,844),(320,568)]:
  page=b.new_page(viewport={'width':width,'height':height},reduced_motion='reduce',is_mobile=width<900,has_touch=width<900)
  page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://localhost:8001/landing/?mode=classic')
  button=page.get_by_role('button',name='BEGIN DESCENT');box=button.bounding_box();assert box['y']>=0 and box['y']+box['height']<=height,(width,height,box)
  page.screenshot(path=f'/tmp/six-down-ready-{width}.png');button.click();page.close()
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
 page.clock.install();page.goto('http://localhost:8001/landing/?mode=classic');page.get_by_role('button',name='BEGIN DESCENT').click();page.clock.run_for(300)
 assert page.locator('.thumb-boost').is_visible()
 cdp=page.context.new_cdp_session(page);boost=page.locator('.thumb-boost').bounding_box();right={'x':boost['x']+boost['width']/2,'y':boost['y']+boost['height']/2,'id':2}
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':80,'y':440,'id':1},right]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':120,'y':440,'id':1},right]});page.clock.run_for(600)
 assert page.locator('.thumb-stick').is_visible();assert '40px' in page.locator('.thumb-stick i').get_attribute('style');assert float(page.locator('[data-read="fuel"]').inner_text())<13.7
 page.screenshot(path='/tmp/six-down-thumb-controls.png')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[{'x':120,'y':440,'id':1}]});page.clock.run_for(100);assert page.locator('.thumb-stick').is_hidden();assert 'held' in page.locator('.thumb-boost').get_attribute('class')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.clock.run_for(500);assert page.locator('.thumb-stick').is_hidden()
 page.get_by_role('button',name='Pause flight').click();assert page.locator('.thumb-controls').is_hidden();page.locator('.pause-card button').click();assert page.locator('.thumb-controls').is_visible()
 # Service worker contains the whole app, including art, sounds and recovery scene.
 page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
 assets=page.evaluate("caches.open('six-down-06').then(c=>c.keys()).then(r=>r.map(x=>x.url))")
 assert any('hugin.glb' in a for a in assets) and any('icon-512' in a for a in assets)
 page.context.set_offline(True);page.goto('http://localhost:8001/landing/?mode=classic');page.get_by_role('button',name='BEGIN DESCENT').click();page.clock.run_for(100);assert page.locator('.cockpit').get_attribute('data-phase')=='flying'
 assert not errors,errors
 print('Short-window CTA, portrait/landscape layouts, simultaneous analogue steering + boost, pause cleanup, full precache and offline launch passed.');b.close()
