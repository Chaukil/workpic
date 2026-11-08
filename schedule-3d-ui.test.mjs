import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('3D browser smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-lounge-'));
try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', {signal:AbortSignal.timeout(15000)});
    assert.ok(response.ok); fs.writeFileSync(path.join(temp,'three.module.js'), await response.text());
    let source=fs.readFileSync('schedule-3d.js','utf8').replace(/\r\n/g,'\n').replace("'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'", "'./three.module.js'");
    source=source.replace("'./schedule-3d-data.js'",JSON.stringify(pathToFileURL(path.resolve('schedule-3d-data.js')).href));
    source=source.replace('return {\n        update,','return {\n        inspect:()=>({renderer,scene,camera,actors,parts,selection,hit,stage}),\n        update,');
    fs.writeFileSync(path.join(temp,'schedule-3d.js'),source);
    const script=`
import {createScheduleLounge} from './schedule-3d.js';
import {loungeDays,loungeWeekStart} from '${pathToFileURL(path.resolve('schedule-3d-data.js'))}';
import * as THREE from './three.module.js';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const frames=new Map();let id=0;window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
let virtualNow=performance.now();
const pump=()=>{virtualNow=Math.max(virtualNow+500,performance.now()+500);const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(virtualNow));};
try {
 const errors=[];const oldError=console.error;console.error=(...args)=>{errors.push(args.join(' '));oldError(...args);};
 const entries={};const titles=['Pull version 00','Release Drill hole','Layout Station','FC KW WN20','Check production plan','Review Motion','Prepare weekly report'];
 for(let d=2;d<=8;d++) entries['2026-11-'+String(d).padStart(2,'0')]=Array.from({length:d===2?8:2+d%3},(_,i)=>({job:{id:'job-'+d+'-'+i,title:titles[(d+i)%titles.length],time:i%2?'14:30':'09:00',type:['weekly','daily','once'][i%3]},originDate:'2026-11-'+String(d).padStart(2,'0')}));
 entries['2026-11-06'][0].completed=true;
 const fixture={days:loungeDays(new Date(2026,10,2),entries,{off:{'2026-11-06':{reason:'SO'}},now:new Date(2026,10,5,12)}),week:0,theme:'light',today:'2026-11-05'};
 let opened=null,week=-1;
 const lounge=createScheduleLounge(document.getElementById('room'),{onOpen:(job,origin)=>{opened={job,origin};document.body.classList.add('modal-open');document.dispatchEvent(new Event('shown.bs.modal'));},onWeekChange:value=>{week=value;}});
 await lounge.update(fixture);pump();
 check(document.querySelectorAll('.lounge-stage canvas').length===1,'one room canvas');
 check(document.querySelectorAll('.lounge-day-label').length===7,'Monday through Sunday');
 check(lounge.inspect().renderer.info.render.calls<50,'bounded draw calls');
 const state=lounge.inspect();
 check(state.scene.children.some(mesh=>mesh.userData.floorReason==='SO'),'off reason is printed on the floor');
 check(state.scene.children.filter(mesh=>mesh.userData.wallCalendar).length===7,'seven calendars attached to the wall');
 check(state.scene.children.find(mesh=>mesh.userData.roomWalls).count===3 && state.camera.position.x===0,'symmetric walls and centered camera');
 check(state.actors[0].sleeping && state.actors.some(a=>a.entry?.completed && a.sleeping),'past and completed jobs sleep');
 check(document.querySelectorAll('.lounge-sleep-label').length>0,'sleep indicators visible');
 check(state.parts.some(part=>part.definitions.length>3),'character details share instanced batches');
 const head=new THREE.Vector3(state.actors[0].x,1.4,state.actors[0].z+.25).project(state.camera);
 const rect=state.stage.getBoundingClientRect();
 const hit=state.hit({clientX:rect.left+(head.x+1)/2*rect.width,clientY:rect.top+(1-head.y)/2*rect.height});
 check(hit===0,'raycasting must select the job character');
 const originalCanvas=document.querySelector('.lounge-stage canvas');await lounge.update(fixture);
 check(document.querySelector('.lounge-stage canvas')===originalCanvas,'live refresh reuses scene');
 document.querySelector('.lounge-list-job').click();
 check(lounge.inspect().selection && !opened,'select first, animate standing before opening');
 pump();check(opened?.job.id===fixture.days[0].entries[0].job.id && opened.origin==='2026-11-02','open View with original occurrence after standing');
 check(frames.size===0,'modal stops animation');
 document.body.classList.remove('modal-open');document.dispatchEvent(new Event('hidden.bs.modal'));check(frames.size===1,'closing View resumes room');
 document.querySelectorAll('.lounge-control')[1].click();check(week===1,'next week control');
 document.querySelector('.lounge-day-count:not(:disabled)').click();check(lounge.inspect().actors.some(a=>a.entry?.job.id===fixture.days[0].entries[6].job.id),'page shows remaining jobs');
 lounge.setVisible(false);check(frames.size===0,'switching away stops room');
 lounge.setVisible(true);pump();
 await lounge.update({...fixture,theme:'dark'});pump();check(lounge.inspect().renderer.info.render.calls<50,'dark scene also bounded');
 lounge.dispose();check(!document.querySelector('.lounge-stage canvas')&&frames.size===0,'dispose stops rendering');
 const preview=createScheduleLounge(document.getElementById('room'),{onOpen(){},onWeekChange(){}});await preview.update(fixture);pump();
 check(!errors.some(e=>/WebGLProgram|shader error/i.test(e)),'no shader errors');
 document.getElementById('result').textContent='PASS: instanced lounge, picking, stand/open, real occurrence, paging, week controls, modal pause, theme changes and cleanup';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
`;
    const html=`<!doctype html><meta charset="utf-8"><style>${fs.readFileSync('styles.css','utf8')}body{margin:0;padding:24px;background:#f1f4f7}.schedule-lounge{max-width:1400px;margin:auto}.lounge-stage{height:700px}#result{font:12px sans-serif;color:#68788a;max-width:1400px;margin:16px auto}</style><body class="theme-light"><div id="room"></div><div id="result"></div><script type="module">${script}</script></body>`;
    const target=path.join(temp,'test.html');fs.writeFileSync(target,html);
    const artifact=path.resolve('.artifacts','schedule-3d-preview.png');fs.mkdirSync(path.dirname(artifact),{recursive:true});
    const result=spawnSync(chrome,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,'profile')}`,'--window-size=1500,1000',`--screenshot=${artifact}`,'--dump-dom','--virtual-time-budget=2000',pathToFileURL(target).href],{encoding:'utf8',timeout:40000,windowsHide:true,maxBuffer:8*1024*1024});
    const output=result.stdout?.match(/<div id="result">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1500)||'3D browser smoke did not finish');console.log(output);
}finally{
 const resolved=path.resolve(temp);if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-lounge-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
