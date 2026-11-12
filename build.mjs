import { rollup } from '@rollup/wasm-node';
import { minify } from 'terser';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Resolve inputs relative to this script, including when invoked from another folder.
process.chdir(fileURLToPath(new URL('.', import.meta.url)));

const bundle = await rollup({ input: 'app.js', external: id => id.startsWith('https://') });
try {
    const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true });
    const result = await minify(output[0].code, { module: true, format: { comments: false } });
    if (!result.code) throw new Error('JavaScript bundle is empty');

    const [template, styles] = await Promise.all([
        readFile('index.html', 'utf8'),
        readFile('styles.css', 'utf8')
    ]);
    // Escape HTML raw-text closing tags without changing the JS/CSS values.
    const inlineJs = result.code.replace(/<\/script/gi, '<\\/script');
    const inlineCss = styles.replace(/<\/style/gi, '<\\/style');
    const replacements = [
        ['<link rel="stylesheet" href="styles.css">', `<style>\n${inlineCss}\n</style>`],
        ['<script type="module" src="app.js"></script>', `<script type="module">\n${inlineJs}\n</script>`]
    ];
    let html = template;
    for (const [marker, value] of replacements) {
        if (html.split(marker).length !== 2) throw new Error(`Expected one asset marker: ${marker}`);
        html = html.replace(marker, () => value);
    }
    await mkdir('dist', { recursive: true });
    await writeFile('dist/index.html', html);
    await copyFile('sw.js', 'dist/sw.js');
} finally { await bundle.close(); }
console.log(`Deploy dist/: index.html (${((await stat('dist/index.html')).size / 1024).toFixed(1)} KB) + sw.js`);
