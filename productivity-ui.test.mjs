import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Browser UI smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const markup = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-ui-'));
const script = `
import { personalEventOccurs } from '${pathToFileURL(path.resolve('productivity-data.js'))}';
import { vietnameseLunar, holidaysForYear, monthPair } from '${pathToFileURL(path.resolve('calendar-data.js'))}';
const check = (value, message) => { if (!value) throw new Error(message); };
const currentUser = { uid: 'me', personalCalendarEvents: [{id:'event',date:'2026-11-05',title:'Weekly appointment',repeat:'weekly',until:'2026-12-01'}], changeHistory: [{kind:'event',action:'Added',title:'Meeting',actor:'Me',detail:'Weekly',at:'2026-11-05T10:00:00Z'}] };
const db = {}; let dayOffViewYear=2026, dayOffViewMonth=10, currentViewingJobId='job';
let jobDayOverridesList = [], stored = {overrideDate:'2026-11-04',note:'Keep this',checklistDone:{}};
let historyCalls = 0, denyWrite = false;
const doc = (_, collection, id) => ({ collection, id });
// Reproduce owner-based rules rejecting the read of a missing override.
const runTransaction = async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), {code:'permission-denied'}); };
const setDoc = async (ref, patch, options) => {
    if (denyWrite) throw Object.assign(new Error('Missing or insufficient permissions.'), {code:'permission-denied'});
    check(options.merge, 'checklist must merge');
    check(Object.keys(patch.checklistDone).length===1,'write only the toggled step');
    stored = {...stored,...patch,checklistDone:{...stored.checklistDone,...patch.checklistDone}};
};
const getOverrideFor = (id,key) => jobDayOverridesList.find(e=>e.jobId===id && e.occurrenceDate===key);
const recordChange = async () => {historyCalls++; await new Promise(() => {});};
const renderSchedule = ()=>{}, renderDayOffCalendars=()=>{}, getUserData=async()=>currentUser;
const renderDayOffModal=()=>{}, repeatLabel=s=>s;
const bootstrap = {Modal:{getOrCreateInstance:()=>({show(){}})}};
${extract('function escapeHtml(', '// ============================================================\n// Check Change Due')}
${extract('function getHolidayName(', 'function renderDayOffCalendars(')}
${extract('function renderChangeHistory(', 'function getDayOffJobPreview(')}
${extract('function renderJobChecklist(', "window.addEventListener('beforeunload'")}
try {
    const kept = ['dayOffModal','viewJobModal','changeHistoryModal'].map(id=>document.getElementById(id));
    const historyButton = document.getElementById('changeHistoryBtn');
    document.body.replaceChildren(...kept,historyButton);
    document.getElementById('dayOffCalendars').innerHTML='<div class="dayoff-day" data-date="2026-11-12">12</div>';
    setupPersonalCalendar(); setupProductivityFeatures();
    const cell=document.querySelector('[data-date]');
    const context = new MouseEvent('contextmenu',{bubbles:true,cancelable:true}); cell.dispatchEvent(context);
    const form=document.getElementById('personalEventForm');
    check(context.defaultPrevented,'right click should open event editor');
    check(!form.classList.contains('d-none'),'editor should be visible');
    check(form.parentElement.id==='dayOffModal','editor must not occupy a calendar row');
    check(document.getElementById('personalEventDate').value==='2026-11-12','editor should use clicked date');
    openPersonalEventEditor('2026-11-12','event',cell);
    check(document.getElementById('personalEventDate').value==='2026-11-05','editing recurrence uses original series start');
    check(document.getElementById('personalEventRepeat').value==='weekly','load repeat mode');
    check(!document.getElementById('personalEventUntil').disabled,'recurring end date enabled');
    document.getElementById('personalEventRepeat').value='none';
    document.getElementById('personalEventRepeat').dispatchEvent(new Event('change'));
    check(document.getElementById('personalEventUntil').disabled,'one-off disables until date');
    check(getPersonalEvents('2026-11-12').length===1,'show recurring occurrence');
    renderChangeHistory();
    check(document.getElementById('changeHistoryList').textContent.includes('Meeting'),'history renders saved record');
    document.getElementById('changeHistorySearch').value='missing'; renderChangeHistory();
    check(!document.getElementById('changeHistoryList').textContent.includes('Meeting'),'history filters results');
    const body=document.getElementById('viewModalBody');
    const job={id:'job',title:'Example',checklist:[{id:'a',text:'Prepare'},{id:'b',text:'Review'}]};
    renderJobChecklist(job,'2026-11-05',body);
    const originalPanel=body.querySelector('.job-checklist-panel');
    const originalCheckbox=body.querySelector('[data-checklist-id="a"]');
    let input=originalCheckbox; input.checked=true; input.dispatchEvent(new Event('change'));
    check(body.querySelector('progress').value===1,'progress updates immediately before save finishes');
    check(!body.querySelector('[data-checklist-id="b"]').disabled,'other steps remain interactive');
    await new Promise(resolve=>setTimeout(resolve,30));
    check(stored.checklistDone.a,'checked step should persist');
    check(stored.overrideDate==='2026-11-04' && stored.note==='Keep this','checklist must preserve existing date overrides');
    check(historyCalls===0,'checkbox changes must not write history');
    check(body.querySelector('progress').value===1,'progress updates after save');
    check(body.querySelector('.job-checklist-panel')===originalPanel && body.querySelector('[data-checklist-id="a"]')===originalCheckbox,'do not rebuild checklist controls');
    check(!originalCheckbox.disabled,'slow history must not block input');
    check(body.querySelector('.checklist-percent').textContent==='50% hoàn thành','show task completion percentage');
    check(!body.querySelector('.checklist-date'),'remove occurrence date selector');
    stored.checklistDone.remote=true;
    input=body.querySelector('[data-checklist-id="b"]'); input.checked=true; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(stored.checklistDone.a && stored.checklistDone.b && stored.checklistDone.remote,'preserve other and concurrent step states');
    input=body.querySelector('[data-checklist-id="a"]'); input.checked=false; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(!stored.checklistDone.a && stored.checklistDone.b,'uncheck only the selected step');
    denyWrite=true;
    input=body.querySelector('[data-checklist-id="a"]'); input.checked=true; input.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,30));
    check(!input.checked && !input.disabled,'failed save restores checkbox and allows retry');
    check(body.querySelector('.checklist-status').textContent.includes('Firestore'),'show permission failure');
    check(historyCalls===0,'checklist must not write history on success or failure');
    renderJobChecklist(job,'2026-11-06',body);
    check(!body.querySelector('[data-checklist-id="a"]').checked,'next occurrence has independent progress');
    const preview=document.createElement('div'); preview.className='off-preview-scroll';
    preview.innerHTML='<table class="table"><thead><tr><th>Job</th><th>Current</th><th>After</th></tr></thead><tbody><tr><td>Example</td><td>10/11</td><td>09/11</td></tr></tbody></table>';
    document.getElementById('dayOffYear').add(new Option('2026','2026'));
    document.getElementById('dayOffMonth').add(new Option('November','10'));
    document.getElementById('dayOffJobPreview').appendChild(preview);
    for (const theme of ['light','dark']) {
        document.body.classList.remove('theme-light','theme-dark'); document.body.classList.add('theme-'+theme);
        const surface=getComputedStyle(document.getElementById('changeHistoryModal')).getPropertyValue('--surface').trim();
        const tableStyle=getComputedStyle(preview.querySelector('table'));
        check(tableStyle.getPropertyValue('--bs-table-bg').trim()===surface,'preview table background follows '+theme+' theme');
        check(getComputedStyle(body.querySelector('[type="checkbox"]')).colorScheme===theme,'checkbox follows '+theme+' theme');
        check(getComputedStyle(document.getElementById('changeHistoryFilter')).colorScheme===theme,'history control follows '+theme+' theme');
        const historyBg=getComputedStyle(document.querySelector('#changeHistoryModal .modal-content')).backgroundColor;
        check(historyBg===(theme==='dark'?'rgb(17, 24, 39)':'rgb(255, 255, 255)'),'history surface follows '+theme+' theme');
        check(getComputedStyle(preview.querySelector('td:nth-child(2)')).color===(theme==='dark'?'rgb(248, 113, 113)':'rgb(239, 68, 68)'),'current schedule is red');
        check(getComputedStyle(preview.querySelector('td:nth-child(3)')).color===(theme==='dark'?'rgb(52, 211, 153)':'rgb(22, 163, 74)'),'new schedule is green');
        check(getComputedStyle(document.querySelector('#dayOffYear option')).color===(theme==='dark'?'rgb(122, 169, 255)':'rgb(59, 130, 246)'),'selected dropdown option follows theme');
    }
    check(document.querySelector('#dayOffReasonPresets [data-reason="SO"]'),'SO reason is available');
    check(document.getElementById('dayOffYear').closest('.dayoff-period-picker')===document.getElementById('dayOffMonth').closest('.dayoff-period-picker'),'year and month share a picker group');
    document.body.innerHTML='<pre id="smoke-result">PASS: event editor, recurrence fields, history filters, checklist persistence and independent occurrences</pre>';
} catch(error) {document.body.innerHTML='<pre id="smoke-result">FAIL: '+escapeHtml(error.stack)+'</pre>';}
`;
try {
    const html = markup.replace('</body>', `<style>${fs.readFileSync('styles.css','utf8')}\n.d-none{display:none!important}</style><script type="module">${script}</script></body>`);
    const target = path.join(temp, 'smoke.html'); fs.writeFileSync(target, html);
    const result = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${path.join(temp, 'profile')}`, '--dump-dom', '--virtual-time-budget=2000', pathToFileURL(target).href], {encoding:'utf8', timeout:30000, windowsHide:true, maxBuffer:8*1024*1024});
    const output = result.stdout?.match(/<pre id="smoke-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output || result.error?.message || result.stderr?.slice(-1500) || 'Browser smoke did not finish');
    console.log(output);
} finally {
    const resolved = path.resolve(temp);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpic-ui-')) fs.rmSync(resolved, {recursive:true,force:true,maxRetries:5,retryDelay:200});
}
