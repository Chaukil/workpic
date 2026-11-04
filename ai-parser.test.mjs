import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const parser = source.slice(source.indexOf('const GEMINI_CONNECTION_STORAGE'), source.indexOf('function validateAIJobs'));
const storage = new Map([['key', 'test-key']]);
let calls = [];
let fail = new Set();
let responseText = '[]';
function session() {
    const ctx = vm.createContext({
        GEMINI_API_KEY_STORAGE: 'key', console: { log() {}, warn() {}, table() {} },
        localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
        AbortController, AbortSignal, setTimeout, clearTimeout,
        localDateKey: () => '2026-11-04', todayKey: () => '2026-11-04', validateAIJobs: jobs => jobs,
        fetch: async (url, options) => {
            calls.push(url);
            if (!options.method) return { ok: true, json: async () => ({ models: [
                { name: 'models/gemini-test-flash-lite', supportedGenerationMethods: ['generateContent'] }
            ] }) };
            const model = url.split('/models/')[1].split(':')[0];
            if (fail.has(model)) return { ok: false, status: 404, json: async () => ({ error: { message: 'unavailable' } }) };
            return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: responseText }] } }] }) };
        }
    });
    vm.runInContext(parser, ctx);
    return expression => vm.runInContext(expression, ctx);
}
let run = session();
assert.equal(await run('checkGeminiConnection()'), 'gemini-test-flash-lite');
assert.equal(calls.length, 2, 'discovery followed by actual connection probe');
calls = [];
run = session();
await run("analyzeTextWithGemini('họp ngày mai')");
assert.equal(calls.length, 1, 'reload reuses successful model without checking other versions');
assert.match(calls[0], /gemini-test-flash-lite/);
calls = [];
await run('checkGeminiConnection()');
assert.equal(calls.length, 1, 'check reuses saved model without listing versions');
run("saveGeminiConnection({ models: ['gemini-test-flash-lite', 'gemini-backup-flash'] })");
fail.add('gemini-test-flash-lite');
calls = [];
await run("analyzeTextWithGemini('họp')");
assert.equal(calls.length, 2);
assert.equal(run('getGeminiConnection().model'), 'gemini-backup-flash');
calls = [];
await run("analyzeTextWithGemini('họp')");
assert.equal(calls.length, 1, 'failed version is skipped on subsequent requests');
responseText = '{}';
await assert.rejects(run("analyzeTextWithGemini('họp')"));
run("saveGeminiApiKey('different-key')");
assert.equal(run('getGeminiConnection().model'), undefined, 'changing credentials resets connection');
console.log('AI model discovery, persistence, fallback, response validation and key reset passed.');
