import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('app.js', 'utf8');
const fn = name => {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
};
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome, 'Browser required for rendering checks');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-perf-'));
const script = `
${source.split('// BEGIN SHARED HELPERS\n')[1].split('// END SHARED HELPERS')[0]}

const check = (ok, message) => { if (!ok) throw new Error(message); };
let instant = new Date(2026, 10, 16, 8, 59);
const NativeDate = Date;
class Clock extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return +instant; } }
window.Date = Clock;
let jobs = Array.from({length: 200}, (_, i) => ({ id: 'j'+i, title: 'Job '+i, date: '2026-11-16', time: '09:00', type: 'daily', duration: 30 }));
let filteredJobs = jobs, currentUser = { uid:'me', workShift:'day' }, scheduleView='calendar', showSunday=true;
let jobCompletionEnabled=true, jobCompletionSince='2026-01-01', jobDayOverridesList=[], scheduleWorkHoursMap={};
let occurrenceCalls=0, renders=0;
const localDateKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseJobDate = d => new Date(d+'T00:00:00');
let eventData=[];
const getMyOffMap=()=>({}), getHolidayName=()=>'', getPersonalEvents=key=>key==='2026-11-18'?eventData:[], getDeptName=()=>'', compactCalendarLabel=s=>s;
const formatDate=s=>s, formatDateShort=localDateKey, formatDateShortDMY=s=>s, formatWorkHours=s=>s;
const getJobDuration=j=>j.duration||30, getOverrideFor=(id,day)=>jobDayOverridesList.find(o=>o.jobId===id&&o.occurrenceDate===day);
let opened;
let openViewJobModal=j=>{opened=j;}, openEditJobModal=j=>{opened=j;}, openJobFromToday=j=>{opened=j;};
const openDayOverridePopover=()=>{}, setJobOccurrenceCompleted=()=>{}, openPersonalEventEditor=()=>{};
${['escapeHtml','personalEventCardContent','repeatLabel','setupDayOffDetailsToggle','getTodayShift','getJobOccurrences','resolveShiftedDate','computeScheduleEntries','buildScheduleEntries','renderJobList','renderOutOfScheduleJobs','renderSchedule','renderTodayJobs','renderTimeline','clockScope','refreshRenderedClock'].map(fn).join('\n')}
const cachedScheduleEntries=createScheduleCache();
const originalOccurrences=getJobOccurrences;
getJobOccurrences=(...args)=>{occurrenceCalls++;return originalOccurrences(...args);};
try {
    renderSchedule(); renderJobList();
    const calls=occurrenceCalls;
    const first=document.querySelector('.schedule-item[data-render-key="job:j0:2026-11-16"]');
    const unaffected=document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]');
    const sidebar=document.querySelector('#jobList [data-render-key="job:j1"]');
    check(first&&unaffected&&sidebar,'initial calendar cards');
    document.getElementById('viewDataModal').classList.add('show');
    renderTodayJobs();
    check(occurrenceCalls===calls,'today must reuse main schedule calculations');
    const today=document.querySelector('#todayJobsList [data-render-key="job:j1:2026-11-16"]');
    const timeline=document.querySelector('#todayTimelineView [data-render-key="job:j1:2026-11-16"]');
    jobs=jobs.map(j=>j.id==='j0'?{...j,title:'Edited title',duration:45}:({...j})); filteredJobs=jobs;
    renderSchedule(); renderJobList();
    check(occurrenceCalls===calls+1,'one edited job recalculates only once across views');
    check(document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]')===unaffected,'keep unchanged calendar node');
    check(document.querySelector('#jobList [data-render-key="job:j1"]')===sidebar,'keep unchanged sidebar node');
    check(document.querySelector('#todayJobsList [data-render-key="job:j1:2026-11-16"]')===today,'keep unchanged today node');
    check(document.querySelector('#todayTimelineView [data-render-key="job:j1:2026-11-16"]')===timeline,'keep unchanged timeline node');
    const edited=document.querySelector('.schedule-item[data-render-key="job:j0:2026-11-16"]');
    check(edited!==first&&edited.textContent.includes('Edited title'),'replace changed card');
    edited.click(); check(opened.title==='Edited title','changed card listener uses current data');
    let mutations=0; const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.type==='childList').length;});
    observer.observe(document.getElementById('scheduleBody'),{childList:true,subtree:true});
    instant=new NativeDate(2026,10,16,9,31); refreshRenderedClock();
    check(unaffected.classList.contains('past'),'minute updates expiration');
    check(unaffected.classList.contains('pending-done'),'minute updates pending completion');
    check(!edited.classList.contains('past'),'duration respected');
    check(today.classList.contains('past')&&timeline.classList.contains('past'),'today and timeline states updated');
    check(occurrenceCalls===calls+1,'minute does not calculate schedules');
    check(document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-16"]')===unaffected,'minute keeps card identity');
    check(observer.takeRecords().filter(r=>r.type==='childList').length===0,'minute does not rebuild table'); observer.disconnect();
    // Repeated updates must not add duplicate listeners.
    let clicks=0; opened=null;
    const savedOpen=openViewJobModal; openViewJobModal=j=>{clicks++;savedOpen(j);};
    renderTimeline(); renderTimeline(); renderTimeline();
    document.querySelector('#timelineView [data-job-id="j1"]').click();
    check(clicks===1,'timeline has exactly one click handler');
    instant=new NativeDate(2026,10,17,0,1); refreshRenderedClock();
    check(document.querySelector('td.today-cell [data-clock-day="2026-11-17"]'),'day rollover updates calendar');
    const beforeOverride=occurrenceCalls;
    jobDayOverridesList=[{jobId:'j1',occurrenceDate:'2026-11-17',overrideTime:'11:00',completed:true}];
    renderSchedule();
    check(occurrenceCalls===beforeOverride+1,'override recalculates only the affected job');
    const overridden=document.querySelector('.schedule-item[data-render-key="job:j1:2026-11-17"]');
    check(overridden.classList.contains('completed')&&overridden.textContent.includes('11:00'),'override invalidates cache and updates card');
    jobs=jobs.filter(j=>j.id!=='j1'); filteredJobs=jobs; renderSchedule(); renderJobList();
    check(!document.querySelector('#scheduleBody [data-job-id="j1"], #todayTimelineView [data-job-id="j1"], #todayJobsList [data-today-job-id="j1"]')&&!document.querySelector('[data-render-key="job:j1"]'),'deleted job removed from views');
    currentUser.workShift='night';
    jobs=[{id:'night',title:'Night',type:'daily',date:'2026-11-16',time:'23:30',duration:120},{id:'morning',title:'Morning',type:'daily',date:'2026-11-16',time:'02:00',duration:60}]; filteredJobs=jobs;
    instant=new NativeDate(2026,10,17,23,45); renderSchedule();
    let night=document.querySelector('#todayJobsList [data-today-job-id="night"]');
    check(night.classList.contains('active'),'night active before midnight');
    instant=new NativeDate(2026,10,18,0,15); refreshRenderedClock();
    night=document.querySelector('#todayJobsList [data-today-job-id="night"]');
    check(night&&night.classList.contains('active'),'night duration continues through midnight');
    instant=new NativeDate(2026,10,18,2,15); refreshRenderedClock();
    check(document.querySelector('#todayJobsList [data-today-job-id="morning"]').classList.contains('active'),'next morning belongs to previous night shift');
    instant=new NativeDate(2026,10,18,7,0); refreshRenderedClock();
    check(document.querySelector('#todayJobsList [data-today-origin-date="2026-11-18"]'),'shift rollover uses next shift');
    eventData=[{id:'event',time:'14:30',title:'Long event title <safe>',notes:'Full event notes. '.repeat(30)+'LAST LINE',repeat:'weekly',until:'2026-12-31'}];
    currentUser.workShift='day'; instant=new NativeDate(2026,10,18,10,0); renderSchedule();
    const event=document.querySelector('#scheduleBody .calendar-personal-event');
    check(event.textContent.includes('LAST LINE')&&event.textContent.includes('14:30')&&event.textContent.includes('2026-12-31'),'event shows full notes, time and recurrence end');
    check(!event.querySelector('safe'),'event content is escaped');
    const luminance=color=>{
        const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
    };
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    for(const theme of ['light','dark']) {
        document.body.classList.remove('theme-light','theme-dark'); document.body.classList.add('theme-'+theme);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        document.body.className='theme-'+theme;
        const style=getComputedStyle(event);
        check(style.whiteSpace==='normal'&&style.overflow==='visible'&&parseFloat(style.fontSize)>=14,'event is large and not truncated');
        for(const close of document.querySelectorAll('.modal .btn-close')) {
            const closeStyle=getComputedStyle(close), glyph=getComputedStyle(close,'::before');
            check(closeStyle.filter==='none'&&closeStyle.backgroundImage==='none','close icon avoids theme inversion');
            check(contrast(glyph.backgroundColor,closeStyle.backgroundColor)>=4.5,'close icon has readable contrast in '+theme);
        }
        for(const subtitle of document.querySelectorAll('.modal-header .modern-header-subtitle, .modal-header .check-due-header-subtitle')) {
            const labelStyle=getComputedStyle(subtitle),headerStyle=getComputedStyle(subtitle.closest('.modal-header'));
            check(contrast(labelStyle.color,headerStyle.backgroundColor)>=4.5,'header subtitle contrast in '+theme+' '+subtitle.closest('.modal').id+' '+labelStyle.color+' / '+headerStyle.backgroundColor);
        }
        const tabs=document.querySelectorAll('.schedule-view-tab');
        check(getComputedStyle(tabs[0]).color!==getComputedStyle(tabs[1]).color,'active view tab has distinct themed color');
        const sample=document.createElement('div'); sample.innerHTML='<div class="timeline-job once"></div><div class="timeline-job monthly"></div>'; document.body.appendChild(sample);
        check(getComputedStyle(sample.children[0]).backgroundImage!==getComputedStyle(sample.children[1]).backgroundImage,'once and monthly colors differ'); sample.remove();
    }
    const frame=document.createElement('iframe'); frame.style.width='550px'; frame.style.height='300px'; document.body.appendChild(frame);
    await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc='<style>'+document.querySelector('style').textContent+'</style><body class="theme-dark"><button id="toggle" class="dayoff-details-toggle" aria-expanded="false" aria-controls="dayOffDetailList">Toggle</button><div id="dayOffDetailList">Upcoming leave</div></body>';});
    const toggle=frame.contentDocument.getElementById('toggle'),detail=frame.contentDocument.getElementById('dayOffDetailList'); setupDayOffDetailsToggle(toggle);
    check(frame.contentWindow.getComputedStyle(detail).display==='none','mobile leave list starts collapsed');
    toggle.click(); check(toggle.getAttribute('aria-expanded')==='true'&&frame.contentWindow.getComputedStyle(detail).display!=='none','mobile leave list expands');
    toggle.click(); check(frame.contentWindow.getComputedStyle(detail).display==='none','mobile leave list collapses again');
    frame.style.width='1300px'; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    check(frame.contentWindow.getComputedStyle(detail).display!=='none','desktop always shows upcoming leave');
    frame.remove();
    document.body.innerHTML='<pre id="result">PASS: 200 jobs; shared cache, one-job invalidation, DOM identity, current listeners, clock states, overrides, deletion and day/night rollover, event content, theme contrast and mobile collapse</pre>';
} catch(error) { document.body.innerHTML='<pre id="result">FAIL: '+error.stack+'</pre>'; }
`;
try {
    let markup = fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
    markup=markup.replace('</head>', '<style>'+fs.readFileSync('styles.css','utf8')+'\n*,*::before,*::after{animation:none!important;transition:none!important}</style></head>');
    const target=path.join(temp,'check.html');
    fs.writeFileSync(target,markup.replace('</body>',`<script type="module">${script}</script></body>`));
    const result=spawnSync(chrome,['--headless','--disable-gpu','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,'profile')}`,'--dump-dom','--virtual-time-budget=5000',pathToFileURL(target).href],{encoding:'utf8',timeout:60000,windowsHide:true,maxBuffer:8*1024*1024});
    const output=result.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output||result.error?.message||result.stderr?.slice(-1500)||'No browser result');
    console.log(output);
} finally {
    if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('workpic-perf-')) fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
