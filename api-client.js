// Both GitHub Pages and local previews read IBM data from this user's machine.
export function resolveApiUrl(page) {
    const sameServer = page.protocol === 'http:' && page.hostname === 'localhost' && page.port === '8080';
    return (sameServer ? '' : 'http://localhost:8080') + '/api/work-hours';
}
