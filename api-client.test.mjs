import assert from 'node:assert/strict';
import { resolveApiUrl } from './api-client.js';
const github = new URL('https://chaukil.github.io/workpic/');
assert.equal(resolveApiUrl(github), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://127.0.0.1:5500')), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://localhost:5500')), 'http://localhost:8080/api/work-hours');
assert.equal(resolveApiUrl(new URL('http://localhost:8080')), '/api/work-hours');
assert.equal(resolveApiUrl(new URL('https://localhost:5500')), 'http://localhost:8080/api/work-hours');
console.log('API routing passed: GitHub Pages and local previews use this machine only.');
