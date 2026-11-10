import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
if (!chrome) { console.log('House browser check skipped: no Chrome/Edge.'); process.exit(0); }
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'workpic-house-'));
const sourceUrl = file => pathToFileURL(path.resolve(file)).href;
const script = `
import {createScheduleHouse} from '${sourceUrl('schedule-house.js')}';
import {houseDays,houseWeekStart} from '${sourceUrl('schedule-house-data.js')}';
const check=(value,message)=>{if(!value)throw Error(message);};
let clock=new Date(2026,10,5,9,15), opened, week, dateChanges=0;
const timers=new Map();let timerId=0;window.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};window.clearTimeout=id=>timers.delete(id);
const tick=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};
const entries={};
const names=['Duyệt bản vẽ nội thất','Review Motion tuần 45','Kiểm tra kế hoạch sản xuất','Chuẩn bị tài liệu họp','Cập nhật Station','Báo cáo tiến độ'];
for(let d=2;d<=8;d++)entries['2026-11-'+String(d).padStart(2,'0')]=Array.from({length:d===5?6:3},(_,i)=>({job:{id:'job-'+d+'-'+i,title:names[i%6],time:i===0?'09:00':i===1?'10:00':'14:00',duration:60},originDate:'2026-11-'+String(d).padStart(2,'0')}));
entries['2026-11-05'][0].originDate='2026-11-02';entries['2026-11-05'][0].shiftedFrom='2026-11-02';
const fixture=()=>({days:houseDays(houseWeekStart(clock),entries),week:0});
try{
 const container=document.getElementById('house');
 const house=createScheduleHouse(container,{onOpen:(job,date)=>{opened={job,date};},onWeekChange:value=>{week=value;},onDateChange:()=>{dateChanges++;house.update(fixture());},now:()=>clock});
 house.update(fixture());
 check(document.querySelectorAll('.house-floor').length===7,'seven selectable floors');
 check(document.querySelector('.house-floor.is-selected').dataset.date==='2026-11-05','today opens by default');
 check(document.querySelectorAll('.house-room').length===6,'each task gets a room');
 check(document.querySelectorAll('.house-task').length===6,'today lights show tasks');
 check(document.querySelector('.house-wall-switch').getAttribute('aria-checked')==='true','today automatic lights');
 document.querySelector('.house-task').click();check(opened.date==='2026-11-02','moved task retains original occurrence');
 document.querySelector('.house-wall-switch').click();check(!document.querySelector('.house-task'),'off hides tasks');
 document.querySelector('.house-wall-switch').click();check(document.querySelectorAll('.house-task').length===6,'on reveals tasks');
 document.querySelector('[data-date="2026-11-06"]').click();check(document.querySelector('.house-wall-switch').getAttribute('aria-checked')==='false','future floor starts dark');
 document.querySelector('.house-wall-switch').click();check(document.querySelectorAll('.house-task').length===3,'manual future inspection');
 house.update(fixture());check(document.querySelector('.house-floor.is-selected').dataset.date==='2026-11-06','refresh keeps selected floor');
 document.querySelector('.house-today').click();clock=new Date(2026,10,5,15);tick();
 check(!document.querySelector('.house-task'),'automatic expiry clears manual lights');
 check(document.querySelector('.house-wall-switch').getAttribute('aria-checked')==='false','floor off after last task');
 document.querySelector('.house-wall-switch').click();check(document.querySelectorAll('.house-room.is-past').length===6,'past rooms retain history when manually lit');
 clock=new Date(2026,10,6,0,1);tick();
 check(dateChanges===1&&document.querySelector('.house-floor.is-selected').dataset.date==='2026-11-06','midnight opens new day');
 house.setVisible(false);check(timers.size===0,'inactive view stops timer');house.setVisible(true);check(timers.size===1,'visible view resumes timer');
 document.querySelectorAll('.house-week')[1].click();check(week===1,'week navigation');
 house.dispose();check(timers.size===0&&!container.children.length,'dispose clears timer and DOM');
 clock=new Date(2026,10,5,9,15);
 const preview=createScheduleHouse(container,{onOpen(){},onWeekChange(){},now:()=>clock});preview.update(fixture());
 const hostile={job:{id:'unsafe',title:'<img src=x onerror=alert(1)>',time:'09:00'},originDate:'2026-11-05'};
 const safe=fixture();safe.days[3].entries=[hostile];preview.update(safe);
 check(!container.querySelector('img')&&container.querySelector('.house-task').textContent===hostile.job.title,'task text cannot inject markup');
 const crowded=fixture();crowded.days[3].entries=Array.from({length:40},(_,i)=>({...hostile,job:{...hostile.job,id:'many-'+i,title:'Task '+i}}));preview.update(crowded);
 check(document.querySelectorAll('.house-task').length===40,'no task truncation');
 preview.update(fixture());
 const selectedFloor=container.querySelector('.house-floor.is-selected').getBoundingClientRect();
 const floorNav=container.querySelector('.house-building').getBoundingClientRect();
 check(selectedFloor.left>=floorNav.left-1&&selectedFloor.right<=floorNav.right+12,'selected floor stays visible in mobile navigation');
 check(container.scrollWidth<=container.clientWidth+1,'house does not overflow its container');
 document.getElementById('result').textContent='PASS: seven floors, default day, switches, expiry, rollover, moved job, week controls, cleanup and safe task text';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
`;
try {
    const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#e9ece4;padding:28px;font-family:Arial,sans-serif}*{box-sizing:border-box}#house{max-width:1400px;margin:auto}#result{font-size:11px;max-width:1400px;margin:16px auto;color:#586d5c}@media(max-width:640px){body{padding:8px}}</style><link rel="stylesheet" href="${sourceUrl('schedule-house.css')}"><body><div id="house"></div><div id="result">Running</div><script type="module">${script}</script></body>`;
    const file=path.join(temp,'index.html');
    fs.mkdirSync('.artifacts',{recursive:true});
    for(const [name,width,height] of [['desktop',1500,1150],['mobile',390,1300]]) {
        // Desktop Chrome has a minimum window width; constrain document layout as well.
        fs.writeFileSync(file, name === 'mobile' ? html.replace('<body>', '<style>html{width:390px}body{width:390px}</style><body>') : html);
        const artifact=path.resolve('.artifacts',`schedule-house-${name}.png`);
        const result=spawnSync(chrome,['--headless','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,name)}`,`--window-size=${width},${height}`,`--screenshot=${artifact}`,'--dump-dom','--virtual-time-budget=2000',pathToFileURL(file).href],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
        const output=result.stdout?.match(/<div id="result">([\s\S]*?)<\/div>/)?.[1];
        assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1000)||'Browser did not finish');
        console.log(name+': '+output);
    }
} finally {
    const resolved=path.resolve(temp);
    if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-house-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
