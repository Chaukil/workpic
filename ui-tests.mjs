import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

// ===== admin-ui checks =====
if (true) await (async function () {
const previewMode = process.env.ADMIN_UI_PREVIEW || '';
const previewWidth = Number(process.env.ADMIN_UI_WIDTH || 1440);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) throw new Error('Chrome/Edge required for admin UI smoke test.');
const markup = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, '');
const appSource = fs.readFileSync('app.js', 'utf8');
const source = appSource.slice(appSource.indexOf('// ADMIN UI START') + '// ADMIN UI START'.length, appSource.indexOf('// ADMIN UI END'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-admin-ui-'));
const iconStyles = fs.existsSync('.artifacts/admin-icons.css') ? fs.readFileSync('.artifacts/admin-icons.css','utf8').replace(/url\([^)]*woff2[^)]*\)/g, 'url('+pathToFileURL(path.resolve('.artifacts/admin-icons.woff2')).href+')') : '';
const script = `
import { ADMIN_EMAIL, FEATURES, ACTIONS, hasPermission, normalizePolicy, profilePolicy, adminJobGroup, PERMISSION_ACTION_LABELS } from '${pathToFileURL(path.resolve('app-data.js'))}';
import { checklistFromText } from '${pathToFileURL(path.resolve('app-data.js'))}';
const check = (value,message) => { if(!value) throw new Error(message); };
const pause = () => new Promise(resolve=>setTimeout(resolve,30));
let noticeForUser=null; const toastCalls=[];
const calls=[]; let currentPolicy={features:{jobs:{view:false}}};
const user={uid:'worker',email:'worker@example.com',displayName:'Worker',department:'layout',policy:{}};
const auth={currentUser:{uid:'worker',email:user.email},signOut(){this.currentUser=null;}};
const doc=(_,a,b)=>({path:a+'/'+b});
const getDoc=async()=>({data:()=>({})});
const collection=(_,name)=>({path:name}); const where=()=>({}); const query=ref=>ref;
const getDocs=async()=>({docs:[{data:()=>({uiPermissions:currentPolicy,lastBlessing:noticeForUser})}],empty:false});
const writeBatch=()=>({});const runTransaction=async()=>{};
const onSnapshot=()=>()=>{};
const sampleRecords={
 users:[{id:'profile-worker',data:{uid:'worker',email:user.email,displayName:'Worker',department:'layout',workShift:'day'}}],
 jobs:[
 {id:'job',data:{ownerId:'worker',title:'Once task',type:'once',date:'2026-11-12',time:'09:00',duration:30}},
 {id:'fixed',data:{ownerId:'worker',title:'Weekly task',type:'weekly',date:'2026-11-12',time:'10:00',duration:45}},
 {id:'outside',data:{ownerId:'worker',title:'Outside task',type:'custom',isOutOfSchedule:true,date:'2026-11-12',time:'11:00',duration:60}}
 ],
 quickJobs:[{id:'quick',data:{createdBy:'other',assigneeUid:'worker',content:'Other creator task',status:'claimed',dateKey:'2026-11-12'}}]
};
const createAdminStore=()=>async(action,data={})=>{
 calls.push({action,...structuredClone(data)});
 if(action==='listUsers')return {users:[user,{uid:'other',email:'other@example.com',displayName:'Other',policy:{}}]};
 if(action==='getUserData')return {collections:sampleRecords,departments:[{id:'layout',name:'Layout'},{id:'station',name:'Station'}]};
 if(action==='saveProfile')Object.assign(sampleRecords.users[0].data,data.value);
 if(action==='saveDocument')sampleRecords[data.collection].find(r=>r.id===data.id).data=structuredClone(data.value);
 if(action==='deleteDocument')sampleRecords[data.collection]=sampleRecords[data.collection].filter(r=>r.id!==data.id);
 return {ok:true};
};
let blessingShows=0;
const instances=new WeakMap();
class Modal {
 constructor(node){this.node=node;instances.set(node,this);}
 show(){this.node.style.display='block';this.node.classList.add('show');if(this.node.id==='blessingsModal')blessingShows++;}
 hide(){this.node.style.display='none';this.node.classList.remove('show');this.node.dispatchEvent(new Event('hidden.bs.modal'));}
 static getInstance(node){return instances.get(node);}
}
window.bootstrap={Modal};window.prompt=()=>null;
${source}
try{
 const access=createAccessControl({app:{},db:{},auth,notify(...args){toastCalls.push(args);}});access.setup();
 await access.start(auth.currentUser);
 check(document.getElementById('openAdminBtn').classList.contains('d-none'),'ordinary user must not see admin button');
 check(document.getElementById('addJobBtn').classList.contains('access-hidden'),'hidden jobs feature must hide add button');
 check(!access.requireAccess('jobs','create'),'hidden feature must deny action');
 check(document.getElementById('deleteJobBtn').classList.contains('access-hidden'),'unchecked delete right hides delete button');
 currentPolicy={};auth.currentUser={uid:'root',email:ADMIN_EMAIL};await access.start(auth.currentUser);
 check(!document.getElementById('openAdminBtn').classList.contains('d-none'),'root must see admin button');
 check(access.can('jobs','delete'),'root has full rights');
 const profile=new Modal(document.getElementById('userProfileModal'));profile.show();
 document.getElementById('openBlessingsBtn').click();await pause();
 check(document.getElementById('blessingsModal').classList.contains('show'),'account opens a separate blessing dialog');
 check(!document.getElementById('userProfileModal').classList.contains('show'),'profile finishes hiding before blessing dialog opens');
 check(document.querySelector('.supreme-capabilities'),'supreme role sees its own full-rights design');
 check(!document.querySelector('.blessing-rights-grid'),'supreme role has no redundant per-permission list');
 document.querySelector('#blessingsModal [data-close-blessings]').click();await pause();
 check(document.getElementById('userProfileModal').classList.contains('show'),'closing a manually opened notice returns to account');
 document.getElementById('openAdminBtn').click();await pause();
 check(document.getElementById('adminModal').classList.contains('show'),'admin panel should open after profile closes');
 document.querySelector('[data-admin-user="worker"]').click();await pause();
 check(document.getElementById('adminProfile-displayName'),'selecting a user automatically opens the profile form');
 if(${JSON.stringify(previewMode)}){
 document.body.className=${JSON.stringify(process.env.ADMIN_UI_THEME==='dark'?'theme-dark':'theme-light')};
 const noticePreview=['supreme','blessing','account'].includes(${JSON.stringify(previewMode)});
 if(noticePreview){
 if(['supreme','account'].includes(${JSON.stringify(previewMode)})){
 Modal.getInstance(document.getElementById('adminModal')).hide();profile.show();
 if(${JSON.stringify(previewMode)}==='account'){
 document.getElementById('profileHeroName').textContent='Châu Kỳ';document.getElementById('profileEmail').textContent=ADMIN_EMAIL;
 document.getElementById('profileRoleBadge').textContent='Đấng tối cao';document.getElementById('profileRoleBadge').classList.add('supreme');
 document.getElementById('profileDisplayName').value='Châu Kỳ';document.getElementById('profileDepartment').innerHTML='<option value="layout">Layout</option>';
 const avatar=document.createElement('canvas');avatar.width=120;avatar.height=120;const ctx=avatar.getContext('2d');ctx.fillStyle='#e6f4f1';ctx.fillRect(0,0,120,120);ctx.fillStyle='#0d9488';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CK',60,62);document.getElementById('profileAvatar').src=avatar.toDataURL();
 }else document.getElementById('openBlessingsBtn').click();
 }else{
 auth.currentUser={uid:'worker',email:user.email};
 noticeForUser={id:'preview-blessing',type:'blessing_granted',title:'Đấng tối cao đã ban phước lành đến bạn',timestamp:'2026-11-12T10:30:00Z',message:'Bạn đã được cấp quyền sử dụng.',granted:[{feature:'jobs',actions:['view','create','edit']},{feature:'dayOffs',actions:['view','create']}],revoked:[]};
 currentPolicy={features:{jobs:{view:true,create:true,edit:true},dayOffs:{view:true,create:true}}};await access.start(auth.currentUser);access.announceBlessing();
 }
 await pause();
 }
 const formPreview=document.getElementById(${JSON.stringify(previewMode)})?.classList.contains('workpic-dialog');
 const previewModal=formPreview?${JSON.stringify(previewMode)}:${JSON.stringify(previewMode)}==='account'?'userProfileModal':noticePreview?'blessingsModal':'adminModal';document.body.dataset.previewModal=previewModal;
 if(formPreview){new Modal(document.getElementById(previewModal)).show();}
 document.body.appendChild(document.getElementById(previewModal));
 document.querySelectorAll('body > *').forEach(n=>{if(n.id!==previewModal&&n.tagName!=='STYLE'&&n.tagName!=='SCRIPT')n.hidden=true;});
 if(!noticePreview&&!formPreview)document.getElementById('adminTab-'+(${JSON.stringify(previewMode)}==='drawer'?'jobs':${JSON.stringify(previewMode)})).click();
 if(${JSON.stringify(previewMode)}==='drawer'){document.querySelector('[data-edit-collection="jobs"]').click();await pause();}
 check(document.querySelector('.admin-layout').scrollWidth<=document.querySelector('.admin-layout').clientWidth+2,'workspace must fit viewport');
 check(document.getElementById(previewModal).getBoundingClientRect().height>100,'preview must be visible');
 document.body.dataset.adminMeasure=JSON.stringify({viewport:window.innerWidth,layout:document.querySelector('.admin-layout').getBoundingClientRect().width,panel:document.getElementById('adminPanelContent').getBoundingClientRect().width});
 document.body.dataset.adminPreview='ready';
 }else{

 document.getElementById('adminProfile-displayName').value='Edited profile';
 document.getElementById('adminProfile-displayName').dispatchEvent(new Event('input',{bubbles:true}));
 document.querySelector('[data-admin-user="other"]').click();await pause();
 check(document.querySelector('.admin-confirm-overlay'),'switching users protects unsaved profile changes');
 document.querySelector('[data-confirm-cancel]').click();await pause();
 check(document.getElementById('adminProfile-displayName').value==='Edited profile','cancel switching keeps entered profile values');
 document.getElementById('adminProfile-workShift').value='night';
 document.getElementById('adminProfile-department').value='station';
 document.getElementById('adminSaveProfile').click();await pause();
 check(calls.some(c=>c.action==='saveProfile'&&c.uid==='worker'&&c.value.displayName==='Edited profile'&&c.value.workShift==='night'),'profile form targets the selected user');
 document.getElementById('adminTab-permissions').click();
 document.getElementById('adminViewOnly').click();await pause();
 check(document.querySelector('[data-feature="jobs"][data-action="view"]').checked&&!document.querySelector('[data-feature="jobs"][data-action="create"]').checked,'view-only preset is explicit');
 document.getElementById('adminSelectAll').click();await pause();
 const permission=document.querySelector('[data-feature="jobs"][data-action="delete"]');
 check(permission,'permission matrix must render');permission.checked=false;
 document.getElementById('adminSavePermissions').click();await pause();
 check(calls.some(c=>c.action==='setPermissions'&&c.uid==='worker'&&c.policy.features.jobs.delete===false),'save exact selected-user permissions');
 document.getElementById('adminLoadData').click();await pause();
 document.getElementById('adminTab-jobs').click();
 check(document.getElementById('adminPane-profile').hidden&&!document.getElementById('adminPane-jobs').hidden,'tabs show one focused workspace');
 document.getElementById('adminJobSearch').value='Weekly';document.getElementById('adminJobSearch').dispatchEvent(new Event('input',{bubbles:true}));
 check(document.querySelector('[data-admin-group="once"]').hidden,'job search filters other groups');
 document.getElementById('adminJobSearch').value='';document.getElementById('adminJobSearch').dispatchEvent(new Event('input',{bubbles:true}));
 document.getElementById('adminJobFilter').value='outside';document.getElementById('adminJobFilter').dispatchEvent(new Event('change',{bubbles:true}));
 check(!document.querySelector('[data-admin-group="outside"]').hidden&&document.querySelector('[data-admin-group="fixed"]').hidden,'job type filter works');
 document.getElementById('adminJobFilter').value='all';document.getElementById('adminJobFilter').dispatchEvent(new Event('change',{bubbles:true}));
 const fixedIndex=sampleRecords.jobs.findIndex(r=>r.id==='fixed');
 document.querySelector('[data-edit-collection="jobs"][data-record="'+fixedIndex+'"]').click();await pause();
 check(!document.getElementById('adminEditorOverlay').hidden,'edit opens dedicated drawer');
 check(document.getElementById('adminSaveJob').parentElement.id==='adminEditorActions','save stays in drawer footer');
 document.getElementById('adminJob-title').value='Unsaved';document.getElementById('adminJob-title').dispatchEvent(new Event('input',{bubbles:true}));
 document.querySelector('[data-admin-close-editor]').click();await pause();
 check(document.querySelector('.admin-confirm-overlay'),'closing a dirty editor asks before discarding');
 document.querySelector('[data-confirm-cancel]').click();await pause();
 check(!document.getElementById('adminEditorOverlay').hidden,'keep editing preserves the form');
 document.querySelector('[data-admin-close-editor]').click();await pause();document.querySelector('[data-confirm-ok]').click();await pause();
 check(document.getElementById('adminEditorOverlay').hidden,'discard closes without saving');
 check(sampleRecords.jobs[fixedIndex].data.title==='Weekly task','cancel preserves stored job');
 for(const id of ['fixed','job','outside']){
 const index=sampleRecords.jobs.findIndex(r=>r.id===id);
 document.querySelector('[data-edit-collection="jobs"][data-record="'+index+'"]').click();await pause();
 check(document.getElementById('adminJob-title'),'all job groups use a labelled edit form');
 document.getElementById('adminJob-title').value='Edited '+id;
 document.getElementById('adminJob-description').value='Changed description';
 document.getElementById('adminSaveJob').click();await pause();
 check(calls.some(c=>c.action==='saveDocument'&&c.uid==='worker'&&c.id===id&&c.value.title==='Edited '+id),'correct grouped job document is saved: '+id);
 }
 document.querySelector('[data-edit-collection="quickJobs"]').click();await pause();
 check(document.getElementById('adminQuick-content'),'quick jobs use a proper form');
 document.getElementById('adminQuick-content').value='Edited other creator job';
 document.getElementById('adminQuick-status').value='completed';
 document.getElementById('adminSaveQuickJob').click();await pause();
 check(calls.some(c=>c.action==='saveDocument'&&c.collection==='quickJobs'&&c.value.content==='Edited other creator job'&&c.value.createdBy==='other'&&c.value.status==='completed'),'admin can edit another creator quick job');

 document.querySelector('[data-delete-collection="quickJobs"]').click();await pause();
 check(document.querySelector('[role="alertdialog"]'),'deletion uses custom confirmation');
 document.querySelector('[data-confirm-ok]').click();await pause();
 check(calls.some(c=>c.action==='deleteDocument'&&c.collection==='quickJobs'&&c.id==='quick'),'admin can delete another creator quick job');
 for(const id of ['fixed','job','outside']){
 const index=sampleRecords.jobs.findIndex(r=>r.id===id);
 document.querySelector('[data-delete-collection="jobs"][data-record="'+index+'"]').click();await pause();
 document.querySelector('[data-confirm-ok]').click();await pause();
 check(calls.some(c=>c.action==='deleteDocument'&&c.id===id),'admin can delete each job group: '+id);
 }
 window.confirm=()=>false;
 document.getElementById('adminTab-advanced').click();
 document.getElementById('adminDeleteUser').click();await pause();
 check(document.querySelector('[data-confirm-ok]').disabled,'user deletion requires email confirmation');
 document.getElementById('adminConfirmEmail').value='wrong@example.com';document.getElementById('adminConfirmEmail').dispatchEvent(new Event('input',{bubbles:true}));
 check(document.querySelector('[data-confirm-ok]').disabled,'wrong email cannot confirm account deletion');
 document.getElementById('adminConfirmEmail').value=user.email;document.getElementById('adminConfirmEmail').dispatchEvent(new Event('input',{bubbles:true}));
 check(!document.querySelector('[data-confirm-ok]').disabled,'matching email enables explicit account deletion');
 document.querySelector('[data-confirm-cancel]').click();await pause();
 check(!calls.some(c=>c.action==='deleteUser'),'cancelled deletion must not write data');
 noticeForUser={id:'notice-test-1',type:'blessing_revoked',title:'Đấng tối cao đã thu hồi phước lành',message:'Thu hồi: Job và lịch làm việc — Sửa'};
 currentPolicy={features:{jobs:{view:true,edit:false}}};
 auth.currentUser={uid:'worker',email:user.email};await access.start(auth.currentUser);
 const beforeBlessing=toastCalls.length,beforeShows=blessingShows;access.announceBlessing();access.announceBlessing();
 check(blessingShows===beforeShows+1,'blessing announcement opens only one notification form');
 check(toastCalls.length===beforeBlessing,'permission updates use the form instead of a transient toast');
 check(document.getElementById('blessingsModal').classList.contains('show'),'permission updates open the notification form automatically');
 check(document.querySelector('.blessing-receipt'),'member notification shows the latest change receipt');
 check(!access.can('notifications'),'permission announcements do not require bell access');
 check(document.getElementById('myBlessingsList').textContent.includes('Job và lịch làm việc'),'user can review blessings in their account');
 check(document.getElementById('openAdminBtn').classList.contains('d-none'),'switching account must hide admin button');
 check(document.getElementById('adminPanelContent').textContent==='','switching accounts must clear admin data');
 document.body.innerHTML='<pre id="smoke-result">PASS: admin visibility, permission matrix, tab navigation, search/filter, drawer save/cancel, unsaved changes, custom confirmations, blessing notification form and supreme role</pre>';
}
}catch(error){document.body.textContent='FAIL: '+error.stack;}
`;

async function renderPreview(target) {
    fs.mkdirSync('.artifacts', {recursive:true});
    const child=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--disable-extensions','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'preview-profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let ws;
    try{
        const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Browser startup timeout')),15000);child.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.on('error',reject);});
        ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
        let serial=0;const pending=new Map();
        ws.addEventListener('message',event=>{const message=JSON.parse(event.data);const promise=pending.get(message.id);if(!promise)return;pending.delete(message.id);if(message.error)promise.reject(new Error(message.error.message));else promise.resolve(message.result);});
        const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
        const {targetId}=await send('Target.createTarget',{url:'about:blank'});
        const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
        const call=(method,params)=>send(method,params,sessionId);
        await call('Emulation.setDeviceMetricsOverride',{width:previewWidth,height:1000,deviceScaleFactor:1,mobile:previewWidth<500});
        await call('Page.navigate',{url:pathToFileURL(target).href});
        let ready=false;
        for(let i=0;i<100;i++){
            const result=await call('Runtime.evaluate',{expression:'JSON.stringify({ready:document.body?.dataset.adminPreview,failed:document.body?.textContent?.startsWith("FAIL:")?document.body.textContent:null})',returnByValue:true});
            const status=JSON.parse(result.result.value||'{}');
            if(status.failed)throw new Error(status.failed);
            if(status.ready==='ready'){ready=true;break;}
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.ok(ready,'Preview must finish');
        await call('Runtime.evaluate',{expression:'document.fonts.ready',awaitPromise:true});
        if(process.env.DIALOG_UI_AUDIT==='1'){
            const audit=await call('Runtime.evaluate',{expression:`(()=>{
                const failures=[];const dialogs=[...document.querySelectorAll('.workpic-dialog')];
                const originalTheme=document.body.className;
                for(const theme of ['theme-light','theme-dark']){
                    document.body.className=theme;
                    for(const modal of dialogs){
                        const previous={hidden:modal.hidden,display:modal.style.display,shown:modal.classList.contains('show')};
                        modal.hidden=false;modal.style.display='block';modal.classList.add('show');
                        modal.querySelectorAll('.modal-dialog,.modal-content').forEach(n=>{n.style.animation='none';n.style.transition='none';});
                        const content=modal.querySelector('.modal-content');const rect=content.getBoundingClientRect();
                        if(rect.left<0||rect.right>innerWidth+1||rect.width<200||rect.height>innerHeight+1)failures.push(theme+' '+modal.id+' exceeds viewport');
                        if(getComputedStyle(modal.querySelector('.modal-header')).backgroundImage!=='none')failures.push(theme+' '+modal.id+' retains old header gradient');
                        modal.hidden=previous.hidden;modal.style.display=previous.display;modal.classList.toggle('show',previous.shown);
                    }
                }
                document.body.className=originalTheme;return {count:dialogs.length,failures};
            })()`,returnByValue:true});
            assert.deepEqual(audit.result.value.failures,[]);
            console.log('PASS: '+audit.result.value.count+' dialog shells fit '+previewWidth+'px in light/dark themes');
        }
        const geometry=await call('Runtime.evaluate',{expression:'JSON.stringify({width:innerWidth,workspace:document.querySelector(".admin-layout").getBoundingClientRect().width})',returnByValue:true});
        const metrics=JSON.parse(geometry.result.value);assert.equal(metrics.width,previewWidth);assert.ok(metrics.workspace<=previewWidth+2);
        await call('Runtime.evaluate',{expression:'document.querySelectorAll(".modal.show,.modal.show .modal-dialog,.modal.show .modal-content").forEach(n=>{n.style.opacity="1";n.style.animation="none";n.style.transition="none"});document.querySelectorAll(".admin-editor-drawer").forEach(n=>n.style.animation="none")'});
        const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        fs.writeFileSync(path.resolve('.artifacts/admin-'+previewMode+'-'+previewWidth+'.png'),Buffer.from(shot.data,'base64'));
        console.log('Preview saved: .artifacts/admin-'+previewMode+'-'+previewWidth+'.png');
        await send('Browser.close');
    } finally {ws?.close();if(child.exitCode===null){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2000);});}}
}

try {
    const target = path.join(temp, 'admin.html');
    fs.writeFileSync(target, markup.replace('</body>', `<style>${fs.existsSync('.artifacts/admin-bootstrap.css') ? fs.readFileSync('.artifacts/admin-bootstrap.css', 'utf8') : '.modal{display:none;position:fixed;inset:0}.modal.show{display:block}.modal-content{display:flex;flex-direction:column}.modal-body{flex:1}'}${iconStyles}${fs.readFileSync('styles.css', 'utf8')}\n.d-none{display:none!important}</style><script type="module">${script}</script></body>`));
    if(previewMode){await renderPreview(target);}else{
    const result = spawnSync(chrome, [...(previewMode ? ['--screenshot='+path.resolve('.artifacts/admin-'+previewMode+'-'+previewWidth+'.png'), '--window-size='+previewWidth+',1000', '--force-device-scale-factor=1', '--hide-scrollbars'] : []), '--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${path.join(temp, 'profile')}`, '--dump-dom', '--virtual-time-budget=4000', pathToFileURL(target).href], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if(previewMode){assert.ok(result.stdout?.includes('data-admin-preview="ready"'),result.stdout?.match(/FAIL:[\s\S]*?<\/body>/)?.[0]||result.error?.message||'Preview failed');console.log(result.stdout.match(/data-admin-measure="([^"]*)"/)?.[1]);console.log('Preview saved: .artifacts/admin-'+previewMode+'-'+previewWidth+'.png');}else{
    const output = result.stdout?.match(/<pre id="smoke-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), result.stdout?.match(/FAIL:[\s\S]*?<\/body>/)?.[0] || result.error?.message || result.stderr?.slice(-1500) || 'Admin UI smoke did not finish');
    console.log(output);
    }
    }
} finally {
    if (path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temp).startsWith('workpic-admin-ui-')) fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

})();

// ===== productivity-ui checks =====
if (!process.env.ADMIN_UI_PREVIEW) await (async function () {
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Browser UI smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const markup = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-ui-'));
const script = `
import { personalEventOccurs } from '${pathToFileURL(path.resolve('app-data.js'))}';
import { vietnameseLunar, holidaysForYear, monthPair } from '${pathToFileURL(path.resolve('app-data.js'))}';
const check = (value, message) => { if (!value) throw new Error(message); };
const currentUser = { uid: 'me', personalCalendarEvents: [{id:'event',date:'2026-11-05',title:'Weekly appointment',repeat:'weekly',until:'2026-12-01'}], changeHistory: [{kind:'event',action:'Added',title:'Meeting',actor:'Me',detail:'Weekly',at:'2026-11-05T10:00:00Z'}] };
const accessControl = { can: () => true, requireAccess: () => true };
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

})();

// ===== theme-fx-ui checks =====
if (process.argv.includes('--themes') && !process.env.ADMIN_UI_PREVIEW) await (async function () {
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.log('Theme GPU smoke skipped: Chrome/Edge unavailable.'); process.exit(0); }
const source = fs.readFileSync('app.js', 'utf8');
let code = source.slice(source.indexOf('const ThreeFx ='), source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
code = code.replace("if (!threePromise) threePromise = import(THREE_URL).catch(err => { threePromise = null; throw err; });", 'if (!threePromise) threePromise = Promise.resolve(THREE);');
code = code.replace('return { start, stop: () =>', 'return { inspect: () => state, start, stop: () =>');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workpic-fx-'));
try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', { signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, 'load the same pinned Three.js version as the app');
    fs.writeFileSync(path.join(temp, 'three.module.js'), await response.text());
    const script = `
import * as THREE from './three.module.js';
const errors=[];
const oldError=console.error; console.error=(...args)=>{errors.push(args.join(' '));oldError(...args);};
${code}
const check=(condition,message)=>{if(!condition)throw new Error(message);};
try {
    const layer=document.getElementById('fxFullscreen');
    const metrics=[];
    let renderer;
    for(const mode of ['theme-dark','theme-light']) {
        document.body.className=mode;
        for(const theme of ['space','noel','tet','trungthu','rain','halloween']) {
            layer.dataset.fx=theme;
            check(await ThreeFx.start(layer,theme,2),'scene build failed: '+theme);
            const state=ThreeFx.inspect();
            if(renderer)check(renderer===state.renderer,'renderer must be shared');
            renderer=state.renderer;
            state.renderer.render(state.scene,state.camera);
            check(layer.querySelectorAll('canvas').length===1,'single canvas: '+theme);
            const owned=new Set(state.owned);
            state.scene.traverse(object=>{
                if(object.material?.map)check(owned.has(object.material.map),'unmanaged texture: '+theme);
            });
            check(state.renderer.info.render.calls<=12,'too many draw calls: '+theme);
            if(theme==='halloween') {
                const flying=state.aspectMats.filter(mat=>mat.uniforms.uWind);
                check(flying[0].uniforms.uDir.value===0 && flying[1].uniforms.uDir.value===0,'both bat flocks must fly horizontally');
            }
            metrics.push(theme+':'+state.renderer.info.render.calls);
        }
    }
    ThreeFx.stop();
    check(!ThreeFx.isActive() && !layer.querySelector('canvas'),'stop removes scene');
    // Three.js retains one shared sprite quad with the reusable renderer.
    check(renderer.info.memory.textures===0 && renderer.info.memory.geometries<=1,'scene GPU resources released: '+JSON.stringify(renderer.info.memory));
    check(!errors.some(e=>/WebGLProgram|shader error|VALIDATE_STATUS/i.test(e)),'shader compile errors: '+errors.join(';'));
    document.body.innerHTML='<pre id="fx-result">PASS: all six high-intensity themes in light/dark, one renderer, owned textures, draw calls '+metrics.join(', ')+'</pre>';
} catch(error) {document.body.innerHTML='<pre id="fx-result">FAIL: '+String(error.stack).replace(/</g,'&lt;')+'</pre>';}
`;
    const html = `<!doctype html><body><div id="fxFullscreen"></div><script type="module">${script}</script></body>`;
    const target=path.join(temp,'smoke.html');fs.writeFileSync(target,html);
    const result=spawnSync(chrome,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--disable-extensions','--allow-file-access-from-files',`--user-data-dir=${path.join(temp,'profile')}`,'--dump-dom','--virtual-time-budget=4000',pathToFileURL(target).href],{encoding:'utf8',timeout:40000,windowsHide:true,maxBuffer:8*1024*1024});
    const output=result.stdout?.match(/<pre id="fx-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'),output||result.error?.message||result.stderr?.slice(-1500)||'GPU smoke did not finish');
    console.log(output);
} finally {
    const resolved=path.resolve(temp);
    if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('workpic-fx-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

})();
