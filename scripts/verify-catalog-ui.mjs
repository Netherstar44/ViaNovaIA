// Run inspect-catalog.ts --ui-fixture first. API responses are intercepted; mutations are blocked.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile('_capture-catalog/api-fixture.json','utf8'));
const folder=path.resolve('_capture-catalog/ui');await mkdir(folder,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5055','--strictPort'],{windowsHide:true,stdio:'ignore'});
let chrome,socket,empty=false,failure=false;const report={checks:[],errors:[],apiReads:0,blockedMutations:0};
try{
 for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:5055/')).ok)break}catch{}await wait(100)}
 const profile=path.join(folder,`profile-${Date.now()}`);
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let i=0;i<150;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break}catch{}await wait(100)}
 const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();socket=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
 let next=0,session;const pending=new Map();
 const send=(method,params={},scoped=true)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(scoped&&session?{sessionId:session}:{})}))});
 const fulfill=(id,status,data)=>send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
 socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result)}}
  if(data.method==='Runtime.exceptionThrown')report.errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  if(data.method==='Fetch.requestPaused'){void(async()=>{const {requestId,request}=data.params;const u=new URL(request.url);if(u.origin==='http://127.0.0.1:5055'&&u.pathname.startsWith('/api/')){
   report.apiReads++;if(request.method!=='GET'){report.blockedMutations++;return fulfill(requestId,405,{message:'Read-only QA'})}
   if(u.pathname==='/api/services')return fulfill(requestId,failure?503:200,{services:empty||failure?[]:fixture.services.filter(s=>s.category===u.searchParams.get('category'))});
   if(u.pathname==='/api/products')return fulfill(requestId,200,{products:fixture.products,total:fixture.products.length});
   if(u.pathname.startsWith('/api/bookings/slots/'))return fulfill(requestId,200,[]);
   if(u.pathname==='/api/comments/ratings')return fulfill(requestId,200,{ratings:{}});
   if(u.pathname.includes('/auth/')||u.pathname.includes('/me'))return fulfill(requestId,401,{message:'No autenticado'});
   return fulfill(requestId,404,{message:'No disponible en verificación de solo lectura'});
  }if(u.origin==='http://127.0.0.1:5055'||['static.poly.pizza','dl.polyhaven.org','images.unsplash.com'].includes(u.hostname))return send('Fetch.continueRequest',{requestId});return send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});})().catch(e=>{if(!e.message.includes('Invalid InterceptionId'))report.errors.push(e.message)});}
 };
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http*',requestStage:'Request'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const until=async(expression,timeout=45000)=>{const start=Date.now();while(Date.now()-start<timeout){try{if(await evaluate(`!!(${expression})`))return}catch{}await wait(150)}throw new Error('Timeout '+expression+' '+await evaluate('document.body.innerText.slice(-1200)'))};
 const navigate=async(route,theme,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5055'+route});await until(`document.readyState==='complete'`);await evaluate(`localStorage.setItem('theme',${JSON.stringify(theme)});location.reload()`);await until(`document.documentElement.classList.contains(${JSON.stringify(theme)})`);};
 const names=fixture.services.filter(s=>['hotel','restaurant','recreation','transport'].includes(s.category)).map(s=>s.name);
 if(process.argv.includes('--media-only'))report.checks=JSON.parse(await readFile(path.join(folder,'report.json'),'utf8')).checks;
 for(const theme of (process.argv.includes('--media-only')?[]:['light','dark','sunset','ocean','forest']))for(const width of [360,768,1440])for(const route of ['/','/explore']){
  await navigate(route,theme,width);const name=route==='/'?names[0]:fixture.products[0].name;await until(`document.body.innerText.includes(${JSON.stringify(name)})`);await wait(200);
  const metrics=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,siteCards:[...document.querySelectorAll('h3')].map(e=>e.textContent)})`);assert.equal(metrics.overflow,false,route+'/'+theme+'/'+width);report.checks.push({theme,width,route,overflow:false});
 }
 console.info('Layouts:',report.checks.length);
 await navigate('/','dark',768);const example=fixture.services.find(s=>['hotel','restaurant','recreation','transport'].includes(s.category)&&s.media.some(a=>a.type==='3d_model')&&s.media.some(a=>a.type==='360_image'));
 await until(`document.body.innerText.includes(${JSON.stringify(example.name)})`);
 await evaluate('performance.setResourceTimingBufferSize(3000)');
 const card=`[...document.querySelectorAll('h3')].find(h=>h.textContent===${JSON.stringify(example.name)}).parentElement.parentElement.parentElement`;
 await evaluate(`[...(${card}).querySelectorAll('button')].find(b=>b.textContent.includes('3D')).click()`);
 await until(`document.querySelector('model-viewer')?.loaded`,60000);
 report.model={loaded:true,sourceMatches:await evaluate(`(document.querySelector('model-viewer').src||document.querySelector('model-viewer').getAttribute('src'))===${JSON.stringify(example.media.find(a=>a.type==='3d_model').url)}`)};assert.equal(report.model.sourceMatches,true);
 await writeFile(path.join(folder,'model-real.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Cerrar visor').click()`);await wait(500);
 await evaluate(`[...(${card}).querySelectorAll('button')].find(b=>/Tour|360/.test(b.textContent)).click()`);
 await until(`document.querySelector('canvas[data-pitch]')!==null`,140000);
 report.closeButtonAccessible=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Cerrar visor');const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);assert.equal(report.closeButtonAccessible,true);
 report.panorama={loaded:true,sourceMatches:await evaluate(`[...performance.getEntriesByType('resource')].some(e=>e.name===${JSON.stringify(example.media.find(a=>a.type==='360_image').url)})`)};assert.equal(report.panorama.sourceMatches,true);
 await writeFile(path.join(folder,'panorama-real.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 empty=true;await navigate('/','light',360);await until(`document.body.innerText.includes('Solo se muestran servicios publicados')`);assert.equal(await evaluate(`document.body.innerText.includes('Hotel Plaza Neiva')`),false);report.emptyCatalog=true;
 empty=false;failure=true;await navigate('/','light',360);await until(`document.body.innerText.includes('No se pudo cargar el catálogo')`);report.failedCatalogNoSamples=true;
 assert.equal(report.blockedMutations,0);assert.deepEqual(report.errors,[]);await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.info(JSON.stringify({layouts:report.checks.length,model:report.model,panorama:report.panorama,empty:report.emptyCatalog,failed:report.failedCatalogNoSamples,errors:report.errors}));
}catch(e){report.error=e.message;await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));throw e}finally{socket?.close();chrome?.kill();vite.kill()}
