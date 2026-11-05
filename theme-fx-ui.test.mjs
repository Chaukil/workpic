import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

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
