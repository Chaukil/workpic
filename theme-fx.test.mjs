import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
let code=source.slice(source.indexOf('const ThreeFx ='),source.indexOf('// CƯỜNG ĐỘ HIỆU ỨNG'));
code=code.replace("if (!threePromise) threePromise = import(THREE_URL).catch(err => { threePromise = null; throw err; });", 'if (!threePromise) threePromise = Promise.resolve(mockThree);');
code=code.replace(/const BUILDERS = \{ space:[^\n]+/, `const BUILDERS = { noel: ctx => {
    ctx.own(disposable, disposable);
    counts.push(ctx.cnt(100));
    const mat={uniforms:{uPixel:{value:0},uTime:{value:0},uAspect:{value:0}}};
    ctx.timeMats.push(mat);ctx.aspectMats.push(mat);mats.push(mat);
}, rain: ctx => ctx.own(disposable) };`);
const listeners=new Map();
const rafs=new Map();let nextRaf=0, constructors=0, disposals=0;
const counts=[], mats=[];
const classes=new Set();
const layer={ isConnected:true, dataset:{fx:'noel'}, prepend() {} };
const add=(event,fn)=>{ if(!listeners.has(event)) listeners.set(event,new Set()); listeners.get(event).add(fn); };
const remove=(event,fn)=>listeners.get(event)?.delete(fn);
const renderers=[];
class Renderer {
    constructor({canvas}) { constructors++;this.domElement=canvas;this.renderLists={dispose(){}};renderers.push(this); }
    setPixelRatio(pixel){this.pixel=pixel;} setSize(w,h){this.width=w;this.height=h;} setClearColor(){} render(){} dispose(){}
}
const ctx=vm.createContext({
    mockThree:{WebGLRenderer:Renderer,Scene:class {clear(){} traverse(){}},PerspectiveCamera:class {position={set(){}};updateProjectionMatrix(){}}},
    counts,mats,disposable:{dispose:()=>disposals++},console,navigator:{hardwareConcurrency:8},
    document:{hidden:false,body:{classList:{contains: cls=>classes.has(cls)}},createElement:()=>({remove(){}}), addEventListener:add,removeEventListener:remove},
    window:{innerWidth:3840,innerHeight:2160,devicePixelRatio:2,addEventListener:add,removeEventListener:remove},
    requestAnimationFrame:fn=>{rafs.set(++nextRaf,fn);return nextRaf;},cancelAnimationFrame:id=>rafs.delete(id),setTimeout
});
vm.runInContext(code,ctx);ctx.layer=layer;
assert.equal(await vm.runInContext("ThreeFx.start(layer,'noel',1)",ctx),true);
assert.ok(renderers[0].width*renderers[0].height*renderers[0].pixel**2<=1500001,'pixel budget on 4K display');
assert.equal(rafs.size,1);
ctx.window.innerWidth=1920;ctx.window.innerHeight=1080;
for(const fn of listeners.get('resize'))fn();
assert.equal(mats[0].uniforms.uPixel.value,renderers[0].pixel,'particle pixel scale follows resize');
assert.equal(mats[0].uniforms.uAspect.value,1920/1080);
ctx.document.hidden=true;
for(const fn of listeners.get('visibilitychange'))fn();
assert.equal(rafs.size,0,'hidden tab stops GPU loop');
ctx.document.hidden=false;
for(const fn of listeners.get('visibilitychange'))fn();
for(const fn of listeners.get('visibilitychange'))fn();
assert.equal(rafs.size,1,'repeated resume events never duplicate loops');
classes.add('modal-open');
for(const fn of listeners.get('shown.bs.modal'))fn();
assert.equal(rafs.size,0,'no animation loop during modal');
classes.delete('modal-open');
for(const fn of listeners.get('hidden.bs.modal'))fn();
assert.equal(rafs.size,1);
assert.equal(await vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx),true);
assert.equal(constructors,1,'reuse WebGL context on intensity change');
assert.equal(disposals,1,'dispose shared scene resources only once');
assert.equal(rafs.size,1,'only one animation loop');
vm.runInContext('ThreeFx.stop()',ctx);
assert.equal(rafs.size,0);
assert.ok([...listeners.values()].every(set=>set.size===0),'no leaked event listeners');
assert.deepEqual(counts,[75,75]);
const first=vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx);
layer.dataset.fx='rain';
const second=vm.runInContext("ThreeFx.start(layer,'rain',2)",ctx);
assert.equal(await first,null,'superseded asynchronous start cannot build a stale scene');
assert.equal(await second,true);
assert.equal(rafs.size,1);
assert.equal(constructors,1,'rapid theme switches reuse renderer');
classes.add('modal-open');
layer.dataset.fx='noel';
const pending=vm.runInContext("ThreeFx.start(layer,'noel',2)",ctx);
vm.runInContext('ThreeFx.stop()',ctx);
classes.delete('modal-open');
assert.equal(await pending,null,'disabling effect cancels a start waiting for a modal');
assert.equal(rafs.size,0);
assert.ok([...listeners.values()].every(set=>set.size===0));
console.log('Theme FX passed: renderer reuse, pixel budget, modal pause/resume, single animation loop and resource cleanup.');
