import { rollup } from '@rollup/wasm-node';
import { minify } from 'terser';
import { stat, writeFile } from 'node:fs/promises';

const bundle = await rollup({ input: 'app.js', external: id => id.startsWith('https://') });
try {
    const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true });
    const result = await minify(output[0].code, { module: true, format: { comments: false } });
    await writeFile('app.min.js', result.code + '\n');
} finally { await bundle.close(); }
console.log(`Production JavaScript: ${((await stat('app.min.js')).size / 1024).toFixed(1)} KB`);
