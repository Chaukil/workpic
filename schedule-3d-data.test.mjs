import assert from 'node:assert/strict';
import { loungeWeekStart, loungeDays, loungeJobColor, loungeJobState } from './schedule-3d-data.js';
import { dateKey } from './calendar-data.js';
import fs from 'node:fs';
import vm from 'node:vm';
assert.equal(dateKey(loungeWeekStart(new Date(2026, 10, 8))), '2026-11-02', 'Sunday belongs to the previous Monday');
assert.equal(dateKey(loungeWeekStart(new Date(2026, 11, 31), 1)), '2027-01-04', 'next week crosses years');
const morning = { job: { id: 'a', title: 'Morning', time: '09:00' }, originDate: '2026-11-05' };
const afternoon = { job: { id: 'b', title: 'Afternoon', time: '10:00' }, overrideTime: '14:30', originDate: '2026-11-06', shiftedFrom: '2026-11-06' };
const entries = { '2026-11-05': [afternoon, morning] };
const days = loungeDays(loungeWeekStart(new Date(2026, 10, 5)), entries, { off: { '2026-11-06': {reason:'SO'} }, holiday: d => dateKey(d) === '2026-11-02' ? 'Holiday' : '' });
assert.equal(days.length, 7);
assert.equal(days[0].label, 'Thứ Hai');
assert.equal(days[6].label, 'Chủ nhật');
assert.equal(days[4].off, 'SO');
assert.equal(days[0].holiday, 'Holiday');
assert.equal(days[3].entries[0].job.id, 'a');
assert.equal(days[3].entries[1].originDate, '2026-11-06', 'opening a shifted job keeps its original occurrence');
assert.equal(entries['2026-11-05'][0].job.id, 'b', 'do not mutate schedule arrays');
assert.equal(loungeDays(loungeWeekStart(new Date()), {}, { showSunday: false }).length, 6);
assert.equal(loungeJobColor({job:{type:'daily'},completed:true}),'#ef4444','completed jobs keep their shirt color');
assert.equal(loungeJobColor({job:{type:'weekly'}}),'#14b8a6');
assert.equal(loungeJobColor({job:{type:'weekly'},shiftedFrom:'2026-11-06'}),'#ec4899','shifted jobs use pink');
assert.equal(loungeJobColor({job:{type:'once',isPresenterJob:true}}),'#8b5cf6');
const timed = { job: { time: '09:00', duration: 60 } };
assert.equal(loungeJobState(timed,'2026-11-05',new Date(2026,10,5,8,59)),'upcoming');
assert.equal(loungeJobState(timed,'2026-11-05',new Date(2026,10,5,9,30)),'active');
assert.equal(loungeJobState(timed,'2026-11-05',new Date(2026,10,5,10)),'past');
assert.equal(loungeJobState({...timed,completed:true},'2026-11-06',new Date(2026,10,5)),'completed');
assert.equal(loungeJobState({...timed,overrideTime:'14:00'},'2026-11-05',new Date(2026,10,5,10)),'upcoming');
assert.equal(loungeJobState({job:{time:'23:30',duration:90}},'2026-11-05',new Date(2026,10,6,0,30)),'active');
assert.equal(loungeJobState({job:{time:'23:30',duration:90}},'2026-11-05',new Date(2026,10,6,1)),'past');
console.log('3D schedule data passed: Monday/Sunday, year rollover, sorted overrides, off/holidays and occurrence identity.');

const source = fs.readFileSync('app.js', 'utf8');
const classes = () => ({ values: new Set(), toggle(name, state) { state ? this.values.add(name) : this.values.delete(name); } });
const elements = Object.fromEntries(['calendarView','timelineView','schedule3dView','scheduleHeaderIcon','scheduleHeaderTitle','scheduleHeaderSub'].map(id => [id, {classList:classes()}]));
const tabs = ['calendar','timeline','3d'].map(view => ({ dataset:{view}, classList:classes(), listeners:{}, addEventListener(name,fn){this.listeners[name]=fn;}, setAttribute(){} }));
let saved = '3d', rendered = 0, loungeVisible;
const context = vm.createContext({
    scheduleView:'calendar', SCHEDULE_VIEW_STORAGE_KEY:'view', currentUser:{workShift:'day'},
    localStorage:{getItem:()=>saved,setItem:(_,value)=>{saved=value;}},
    document:{getElementById:id=>elements[id],querySelectorAll:()=>tabs},
    renderSchedule(){rendered++;},renderFullscreenFx(){},scheduleLounge:{setVisible:value=>{loungeVisible=value;}}
});
vm.runInContext(source.slice(source.indexOf('function initTimelineView('),source.indexOf('async function saveUserWorkShift('))
    + source.slice(source.indexOf('function setScheduleView('),source.indexOf('function renderSchedule3D(')),context);
vm.runInContext('initTimelineView()',context);
assert.equal(elements.schedule3dView.classList.values.has('d-none'), false);
assert.equal(elements.calendarView.classList.values.has('d-none'), true);
tabs[1].listeners.click();
assert.equal(context.scheduleView,'timeline');
assert.equal(saved,'timeline');
assert.equal(loungeVisible,false);
tabs[2].listeners.click();
assert.equal(context.scheduleView,'3d');
assert.equal(loungeVisible,true);
assert.equal(rendered,2);
assert.equal(tabs[2].classList.values.has('active'),true);
console.log('3D integration passed: saved mode, three tabs, visibility, persistence and stopping inactive room.');
