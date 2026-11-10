import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = fs.readFileSync('app.js', 'utf8');
const buttons = [];
const ranges = [];
const ctx = vm.createContext({
    escapeHtml: s => s,
    document: {
        createElement: () => ({ dataset: {} }),
        createRange: () => {
            const range = {
                setStart(node, offset) { this.first = node; this.start = offset; },
                setEnd(node, offset) { this.last = node; this.end = offset; },
                deleteContents() {},
                insertNode(button) { buttons.push(button); ranges.push(this); }
            };
            return range;
        }
    }
});
vm.runInContext(source.slice(source.indexOf('const QUOTE_CHARS'), source.indexOf('// Bấm link folder')), ctx);
const text = value => ({ nodeType: 3, nodeValue: value });
const element = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes });
test('quoted paths span rich text formatting; unquoted paths stop at spaces', () => {
    const path = String.raw`V:\Prod & Inv Control\Public\P&IC UPH WN5\03.FRAME MIL\SETUP RELEASE FRAME WN5`;
    const first = text('File setup: "V:\\Prod');
    const last = text(path.slice('V:\\Prod'.length) + '"');
    ctx.root = element('DIV', first, element('SPAN', last), element('BR'), text(String.raw`C:\Reports next`));
    vm.runInContext('enhanceFolderLinks(root)', ctx);
    assert.deepEqual(buttons.map(b => b.dataset.path), [String.raw`C:\Reports`, path]);
    assert.equal(ranges[1].first, first);
    assert.equal(ranges[1].last, last);
    assert.equal(ranges[1].start, 'File setup: "'.length);
    assert.equal(ranges[1].end, last.nodeValue.length - 1);
});
test('does not combine paths across lines or process existing buttons', () => {
    buttons.length = 0;
    ctx.root = element('DIV', element('BUTTON', text(String.raw`C:\Ignored`)), element('P', text('"C:\\One')), element('P', text(' Two"')));
    vm.runInContext('enhanceFolderLinks(root)', ctx);
    assert.deepEqual(buttons.map(b => b.dataset.path), [String.raw`C:\One`]);
});
