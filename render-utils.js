// Keep unchanged DOM nodes (and their focus/listeners) while patching rendered views.
export function reconcileChildren(target, incoming) {
    const key = node => node.nodeType === 1 && (node.getAttribute('data-render-key') || null);
    const previous = [...target.childNodes];
    const keyed = new Map(previous.filter(key).map(node => [key(node), node]));
    let cursor = target.firstChild;
    for (const fresh of [...incoming.childNodes]) {
        const id = key(fresh);
        let node = id ? keyed.get(id) : cursor;
        if (node && (key(node) !== id || node.nodeType !== fresh.nodeType || node.nodeName !== fresh.nodeName)) node = null;
        if (!node) node = fresh;
        else if (node.nodeType !== 1) {
            if (node.nodeValue !== fresh.nodeValue) node.nodeValue = fresh.nodeValue;
        } else if (node.outerHTML !== fresh.outerHTML) {
            // Job cards have closures over their rendered data; replace changed cards.
            if (id && id.startsWith('job:')) node = fresh;
            else {
                for (const attr of [...node.attributes]) if (!fresh.hasAttribute(attr.name)) node.removeAttribute(attr.name);
                for (const attr of [...fresh.attributes]) if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
                reconcileChildren(node, fresh);
            }
        }
        if (node !== cursor) target.insertBefore(node, cursor);
        cursor = node.nextSibling;
        if (id) keyed.delete(id);
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
}

export function reconcileMarkup(target, html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    reconcileChildren(target, template.content);
}

// Cache per job in a shared calendar window. External scheduling changes invalidate
// the window; job edits invalidate only that job. Returned arrays are caller-owned.
export function createScheduleCache() {
    let stateKey, windowStart, windowEnd;
    const records = new Map();
    return (start, end, jobs, externalKey, compute, dateKey, jobKey = () => '') => {
        if (externalKey !== stateKey || !windowStart || start < windowStart || end > windowEnd) {
            stateKey = externalKey;
            windowStart = new Date(start); windowStart.setHours(0, 0, 0, 0);
            windowStart.setDate(windowStart.getDate() - ((windowStart.getDay() + 6) % 7) - 7);
            windowEnd = new Date(end); windowEnd.setHours(23, 59, 59, 999);
            windowEnd.setDate(windowEnd.getDate() + 21);
            records.clear();
        }
        const liveIds = new Set(jobs.map(job => job.id));
        // Bound memory without dropping other jobs for single-job lookups.
        if (records.size > 2000) for (const id of records.keys()) if (!liveIds.has(id)) records.delete(id);
        const output = {}, first = dateKey(start), last = dateKey(end);
        for (const job of jobs) {
            const signature = JSON.stringify(job) + jobKey(job);
            let record = records.get(job.id);
            if (!record || record.signature !== signature) {
                record = { signature, map: compute(windowStart, windowEnd, [job]) };
                records.set(job.id, record);
            }
            for (const [day, entries] of Object.entries(record.map)) {
                if (day >= first && day <= last) (output[day] ||= []).push(...entries.map(entry => ({ ...entry, job })));
            }
        }
        return output;
    };
}
