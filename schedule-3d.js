import { loungeJobColor } from './schedule-3d-data.js';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const PAGE_SIZE = 6;
let library;
const loadThree = () => library || (library = import(THREE_URL).catch(error => { library = null; throw error; }));
const text = (tag, className, value) => {
    const element = document.createElement(tag); element.className = className; element.textContent = value; return element;
};

export function createScheduleLounge(container, { onOpen, onWeekChange }) {
    let alive = true, visible = true, data, renderer, scene, camera, T, pending = false, revision = 0;
    let owned = new Set(), actors = [], parts = [], pickable = [], labels = [], raf = 0, last = 0;
    let selection = null, pointer = null, pan = { x: 0, z: 0 }, zoom = 1, worldWidth = 21, depth = 8;
    let shadowMesh = null;
    let cameraSpan = 30;
    let guideIndex = 0, elapsed = 0, pages = {}, hovered = -1;
    let previousSignature = '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController();
    const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: abort.signal });
    container.replaceChildren();
    container.classList.add('schedule-lounge');
    const toolbar = text('div', 'lounge-toolbar', '');
    const intro = text('div', 'lounge-intro', '');
    intro.append(text('span', 'lounge-eyebrow', 'WORK LOUNGE'), text('strong', '', 'Một chỗ ngồi, một công việc'));
    const controls = text('div', 'lounge-controls', '');
    const weekButtons = [0, 1].map((week) => {
        const button = text('button', 'lounge-control', week ? 'Tuần sau' : 'Tuần này'); button.type = 'button';
        listen(button, 'click', () => onWeekChange(week)); controls.append(button); return button;
    });
    const button = (label, title, callback) => {
        const element = text('button', 'lounge-control lounge-camera-control', label); element.type = 'button'; element.title = title; element.setAttribute('aria-label', title);
        listen(element, 'click', callback); controls.append(element); return element;
    };
    button('−', 'Thu nhỏ', () => { zoom = Math.max(.65, zoom / 1.2); fit(); });
    button('+', 'Phóng to', () => { zoom = Math.min(3, zoom * 1.2); fit(); });
    button('⌂', 'Góc nhìn ban đầu', () => { zoom = 1; pan = { x: 0, z: 0 }; fit(); });
    toolbar.append(intro, controls);
    const stage = text('div', 'lounge-stage', '');
    const message = text('div', 'lounge-message', 'Đang chuẩn bị phòng khách…'); message.setAttribute('role', 'status');
    const labelLayer = text('div', 'lounge-day-labels', '');
    const tooltip = text('div', 'lounge-tooltip', ''); tooltip.hidden = true; tooltip.setAttribute('role', 'status');
    const hint = text('p', 'lounge-hint', 'Bấm nhân vật để mở job · Kéo để di chuyển góc nhìn · Dùng + / − để thu phóng');
    const list = text('details', 'lounge-job-list', '');
    const listSummary = text('summary', '', 'Danh sách công việc');
    const listBody = text('div', 'lounge-list-body', ''); list.append(listSummary, listBody);
    stage.append(message, labelLayer, tooltip); container.append(toolbar, stage, hint, list);

    const own = object => { owned.add(object); return object; };
    const material = (color, options = {}) => own(new T.MeshStandardMaterial({ color, roughness: .9, metalness: 0, ...options }));
    function upholsteredGeometry() {
        const shape = new T.Shape(), h = .43, r = .11;
        shape.moveTo(-h + r, -h);
        shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
        shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
        shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
        shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
        const geometry = own(new T.ExtrudeGeometry(shape, { depth: .86, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: .07, bevelThickness: .07, curveSegments: 5 }));
        geometry.center(); geometry.computeVertexNormals(); return geometry;
    }
    function floorReason(day, x, z, dark, geometry) {
        const reason = day.off || day.holiday;
        if (!reason) return;
        const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = day.off ? (dark ? '#553e4b' : '#f5dfe5') : (dark ? '#554b36' : '#f6ead0'); ctx.fillRect(0, 0, 768, 256);
        ctx.strokeStyle = day.off ? '#bc7b93' : '#bca066'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 752, 240);
        ctx.textAlign = 'center'; ctx.fillStyle = day.off ? (dark ? '#f5c8d5' : '#9b4969') : (dark ? '#f4dda2' : '#967127');
        ctx.font = '600 28px sans-serif'; ctx.fillText(day.off ? 'NGÀY OFF' : 'NGHỈ LỄ', 384, 57);
        let size = reason.length < 18 ? 100 : 56;
        do { ctx.font = `700 ${size}px sans-serif`; size -= 2; } while (ctx.measureText(reason).width > 690 && size > 22);
        const words = reason.split(/\s+/), lines = []; let line = '';
        words.forEach(word => { const next = line ? line + ' ' + word : word; if (ctx.measureText(next).width > 690 && line) { lines.push(line); line = word; } else line = next; });
        if (line) lines.push(line);
        lines.slice(0, 3).forEach((value, i) => ctx.fillText(value, 384, 155 + i * 39));
        const texture = own(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const mat = own(new T.MeshBasicMaterial({ map: texture, transparent: false, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
        const plane = new T.Mesh(geometry, mat); plane.rotation.x = -Math.PI / 2; plane.position.set(x, .07, z); plane.renderOrder = 2; plane.userData.floorReason = reason; scene.add(plane);
    }
    function wallCalendar(day, x, dark, pageCount, page) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 448;
        const ctx = canvas.getContext('2d'), today = day.key === data.today;
        ctx.fillStyle = dark ? '#d6dfdf' : '#fffaf0'; ctx.fillRect(0, 0, 512, 448);
        ctx.fillStyle = today ? '#4a927f' : '#667d91'; ctx.fillRect(0, 0, 512, 104);
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '700 39px sans-serif'; ctx.fillText(day.label, 256, 72);
        ctx.fillStyle = dark ? '#283944' : '#354753'; ctx.font = '700 116px sans-serif'; ctx.fillText(day.date, 256, 258);
        ctx.font = '500 30px sans-serif';
        if (pageCount === 1) ctx.fillText(`${day.entries.length} job`, 256, 353);
        ctx.strokeStyle = '#bdc8c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(55, 293); ctx.lineTo(457, 293); ctx.stroke();
        ctx.fillStyle = '#d6ddda'; for (const px of [120, 392]) { ctx.beginPath(); ctx.arc(px, 18, 12, 0, Math.PI * 2); ctx.fill(); }
        const texture = own(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const frame = new T.Mesh(own(new T.BoxGeometry(1.98, 1.65, .12)), material(today ? '#578f7f' : dark ? '#859095' : '#a5a5a0'));
        frame.position.set(x, 2.54, -2.02); frame.userData.wallCalendar = day.key; scene.add(frame);
        const paper = new T.Mesh(own(new T.PlaneGeometry(1.82, 1.5)), own(new T.MeshBasicMaterial({ map: texture, toneMapped: false })));
        paper.position.set(x, 2.54, -1.95); scene.add(paper);
    }
    function clearScene() {
        selection = null; shadowMesh = null; actors = []; parts = []; pickable = []; labels = []; hovered = -1;
        owned.forEach(resource => resource.dispose()); owned = new Set(); scene?.clear(); labelLayer.replaceChildren();
        tooltip.hidden = true;
    }
    function batch(geometry, mat, poses, colors = null) {
        if (!poses.length) return null;
        const mesh = own(new T.InstancedMesh(geometry, mat, poses.length));
        const dummy = new T.Object3D();
        poses.forEach((pose, index) => {
            dummy.position.set(...pose.position); dummy.scale.set(...(pose.scale || [1, 1, 1]));
            dummy.rotation.set(...(pose.rotation || [0, 0, 0])); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
            if (colors) mesh.setColorAt(index, new T.Color(colors[index]));
        });
        mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; scene.add(mesh); return mesh;
    }
    function makeRoom() {
        clearScene();
        const dark = data.theme === 'dark';
        scene.background = new T.Color(dark ? '#192433' : '#edf1f4');
        scene.add(new T.HemisphereLight('#fff6e8', dark ? '#56657c' : '#a8b8c0', 2.5));
        const sun = new T.DirectionalLight('#fff3df', 3); sun.position.set(-8, 14, 10); scene.add(sun);
        const box = own(new T.BoxGeometry(1, 1, 1));
        const softBox = upholsteredGeometry();
        const sphere = own(new T.SphereGeometry(1, 20, 16));
        const cylinder = own(new T.CylinderGeometry(1, 1, 1, 12));
        const reasonGeometry = own(new T.PlaneGeometry(2.65, .9));
        const days = data.days;
        worldWidth = days.length * 3.15;
        const rows = Math.max(1, ...days.map(day => Math.ceil(Math.min(PAGE_SIZE, day.entries.length) / 3)));
        depth = rows * 2.6 + 4;
        const left = -worldWidth / 2;
        const floor = material(dark ? '#856f60' : '#d9bea1');
        batch(box, floor, [{ position: [0, -.22, depth / 2 - 1.6], scale: [worldWidth + 1.2, .4, depth + 1] }]);
        // A single instanced mesh draws the timber strips.
        const plankPoses = [], plankColors = [];
        for (let i = 0; i < Math.ceil(worldWidth * 2); i++) {
            plankPoses.push({ position: [left + i * .5 + .25, -.005, depth / 2 - 1.6], scale: [.485, .025, depth + .8] });
            plankColors.push((dark ? ['#8c7865', '#95816e', '#82705f'] : ['#dfc8aa', '#e6d1b6', '#d8bfa1'])[i % 3]);
        }
        batch(box, material('#ffffff'), plankPoses, plankColors);
        const walls = batch(box, material(dark ? '#41536a' : '#c5dbe4'), [
            { position: [0, 1.8, -2.14], scale: [worldWidth + 1.2, 3.6, .16] },
            { position: [left - .52, 1.8, depth / 2 - 1.6], scale: [.16, 3.6, depth + 1] },
            { position: [-left + .52, 1.8, depth / 2 - 1.6], scale: [.16, 3.6, depth + 1] }
        ]);
        walls.userData.roomWalls = true;
        batch(box, material(dark ? '#637a85' : '#e2edf0'), [
            { position: [0, .08, -2.04], scale: [worldWidth + 1, .16, .09] },
            ...[-1, 1].map(side => ({ position: [side * (worldWidth / 2 + .41), .08, depth / 2 - 1.6], scale: [.09, .16, depth + .8] }))
        ]);
        const sofaPoses = [], cushions = [], backs = [], backPillows = [], armrests = [], chaiseBases = [], feet = [], rugs = [], sofaColors = [], rugColors = [];
        const palette = dark ? ['#7f8d9b', '#8e8b9a', '#85948e', '#a19689', '#8391a2', '#9c8e94', '#8d9689'] : ['#a9b1b8', '#b6b2bd', '#b2bdb8', '#c5bcaf', '#acb7c3', '#c3b5bb', '#b8bfb1'];
        days.forEach((day, dayIndex) => {
            const x = left + dayIndex * 3.15 + 1.575;
            const pageCount = Math.max(1, Math.ceil(day.entries.length / PAGE_SIZE));
            const page = Math.min(pages[day.key] || 0, pageCount - 1); pages[day.key] = page;
            const visibleEntries = day.entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
            const dayRows = Math.max(1, Math.ceil(visibleEntries.length / 3));
            rugs.push({ position: [x, .025, rows * 1.3 - .4], scale: [2.94, .035, rows * 2.6 + .65] });
            rugColors.push(day.key === data.today ? (dark ? '#447d72' : '#c2dfd0') : (dark ? '#53616e' : '#d6d9dd'));
            for (let row = 0; row < dayRows; row++) {
                const z = row * 2.6;
                sofaPoses.push({ position: [x, .4, z], scale: [2.6, .38, 1.17] }); sofaColors.push(palette[dayIndex]);
                chaiseBases.push({ position: [x + .8, .4, z + .5], scale: [1.0, .38, 1.85] });
                backs.push({ position: [x, .91, z - .51], scale: [2.63, .78, .25], rotation: [-.07, 0, 0] });
                armrests.push({ position: [x - 1.26, .73, z + .02], scale: [.26, .52, 1.2] });
                armrests.push({ position: [x + 1.26, .73, z + .4], scale: [.26, .52, 1.96] });
                for (const dx of [-1.09, 1.09]) for (const dz of [-.38, dx > 0 ? 1.12 : .41]) feet.push({ position: [x + dx, .15, z + dz], scale: [.065, .26, .065], rotation: [0, 0, dx > 0 ? -.12 : .12] });
                for (let seat = 0; seat < 3; seat++) {
                    cushions.push({ position: [x + (seat - 1) * .75, .67, z + (seat === 2 ? .43 : .04)], scale: [.73, .24, seat === 2 ? 1.65 : .91] });
                    backPillows.push({ position: [x + (seat - 1) * .75, 1.01, z - .32], scale: [.73, .57, .25], rotation: [-.14, 0, 0] });
                }
            }
            visibleEntries.forEach((entry, index) => actors.push({ entry, day, sleeping: ['past', 'completed'].includes(entry.loungeState), chaise: index % 3 === 2, x: x + (index % 3 - 1) * .75, z: Math.floor(index / 3) * 2.6 + .12, angle: 0 }));
            floorReason(day, x, rows * 2.6 - .5, dark, reasonGeometry);
            wallCalendar(day, x, dark, pageCount, page);
            const label = text('div', 'lounge-day-label lounge-wall-calendar-label' + (day.key === data.today ? ' is-today' : ''), '');
            label.append(text('strong', '', day.label), text('span', '', day.date + (day.off || day.holiday ? ' · ' + (day.off || day.holiday) : '')));
            const count = text('button', 'lounge-day-count', pageCount > 1 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, day.entries.length)}/${day.entries.length} job · Tiếp ›` : `${day.entries.length} job`);
            count.type = 'button'; count.disabled = pageCount === 1;
            count.onclick = () => { pages[day.key] = (page + 1) % pageCount; makeRoom(); fit(); wake(); };
            label.append(count); labelLayer.append(label); labels.push({ element: label, point: new T.Vector3(x, 1.94, -1.92) });
        });
        batch(box, material('#ffffff'), rugs, rugColors);
        const upholstery = material('#ffffff', { roughness: 1 });
        batch(softBox, upholstery, sofaPoses, sofaColors);
        const repeatColors = poses => poses.map((_, index) => sofaColors[Math.floor(index / (poses.length / sofaColors.length))] || palette[0]);
        batch(softBox, upholstery, backs, sofaColors);
        batch(softBox, upholstery, chaiseBases, sofaColors);
        batch(softBox, upholstery, armrests, repeatColors(armrests));
        batch(softBox, upholstery, cushions, repeatColors(cushions));
        batch(softBox, upholstery, backPillows, repeatColors(backPillows));
        batch(box, material('#6f7277', { metalness: .55, roughness: .4 }), feet);
        // A few plants and a low table make this a room rather than a chart.
        const plants = [-1, 1].map(side => ({ position: [side * (worldWidth / 2 + .03), .26, depth - 2.4], scale: [.27, .5, .27] }));
        batch(cylinder, material('#ba9c85'), plants);
        batch(sphere, material(dark ? '#4d8c78' : '#72a98b'), plants.map(p => ({ position: [p.position[0], .85, p.position[2]], scale: [.46, .6, .4] })));
        batch(box, material('#b79171'), [{ position: [0, .35, depth - 2.15], scale: [1.6, .16, .75] }]);
        batch(box, material('#766354'), [-.6, .6].map(x => ({ position: [x, .14, depth - 2.15], scale: [.08, .4, .4] })));
        guideIndex = actors.length;
        actors.push({ x: -worldWidth * .35, z: depth - 1.05, angle: Math.PI / 2, guide: true });
        const skin = material('#f2c9ab'), hair = material('#ffffff'), ink = material('#283348'), white = material('#fff9f2');
        const outfit = material('#ffffff'), blush = material('#e9a19e'), mouth = material('#ab6b6d');
        const eyebrows = material('#59404a'), denim = material('#40526d');
        const groups = new Map();
        const addPart = (geometry, mat, seated, standing, colorMode = '', visibility = '') => {
            const key = geometry.uuid + ':' + mat.uuid + ':' + colorMode;
            if (!groups.has(key)) groups.set(key, { geometry, mat, colorMode, definitions: [] });
            groups.get(key).definitions.push({ seated, standing, visibility });
        };
        const pose = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => [x, y, z, sx, sy, sz, rx, ry, rz];
        // Rounded cheeks, layered hair, eyes with highlights and a small smile.
        addPart(sphere, skin, pose(0, 1.5, .04, .3, .33, .28), pose(0, 1.73, 0, .3, .33, .28));
        addPart(sphere, hair, pose(0, 1.69, -.025, .318, .19, .29), pose(0, 1.92, -.065, .318, .19, .29), 'hair');
        addPart(sphere, hair, pose(0, 1.51, -.15, .306, .29, .18), pose(0, 1.74, -.19, .306, .29, .18), 'hair');
        for (const side of [-1, 1]) {
            addPart(sphere, hair, pose(side * .17, 1.68, .19, .145, .115, .13, 0, 0, side * .4), pose(side * .17, 1.91, .15, .145, .115, .13, 0, 0, side * .4), 'hair');
            addPart(sphere, skin, pose(side * .305, 1.5, 0, .06, .085, .06), pose(side * .305, 1.73, -.04, .06, .085, .06));
            addPart(sphere, white, pose(side * .105, 1.52, .307, .048, .059, .025), pose(side * .105, 1.75, .267, .048, .059, .025), '', 'open-eye');
            addPart(sphere, ink, pose(side * .1, 1.515, .331, .029, .043, .014), pose(side * .1, 1.745, .291, .029, .043, .014), '', 'open-eye');
            addPart(sphere, white, pose(side * .1 - .009, 1.534, .345, .011, .013, .007), pose(side * .1 - .009, 1.764, .305, .011, .013, .007), '', 'open-eye');
            addPart(softBox, eyebrows, pose(side * .108, 1.605, .298, .085, .02, .025, 0, 0, side * -.13), pose(side * .108, 1.835, .258, .085, .02, .025, 0, 0, side * -.13));
            addPart(sphere, blush, pose(side * .18, 1.43, .273, .05, .027, .017), pose(side * .18, 1.66, .233, .05, .027, .017));
        }
        addPart(sphere, skin, pose(0, 1.47, .32, .035, .04, .04), pose(0, 1.7, .28, .035, .04, .04));
        const smile = own(new T.TorusGeometry(.043, .008, 5, 14, Math.PI));
        for (const side of [-1, 1]) addPart(smile, ink, pose(side * .105, 1.515, .32, 1, .55, 1, 0, 0, Math.PI), pose(side * .105, 1.745, .28, 1, .55, 1, 0, 0, Math.PI), '', 'closed-eye');
        addPart(smile, mouth, pose(0, 1.395, .303, 1, .65, 1, 0, 0, Math.PI), pose(0, 1.625, .263, 1, .65, 1, 0, 0, Math.PI));
        addPart(sphere, hair, pose(-.05, 1.85, -.02, .09, .1, .09, 0, 0, -.3), pose(-.05, 2.08, -.06, .09, .1, .09, 0, 0, -.3), 'hair');
        // A tailored shirt, collar, placket and sleeves carry the exact job color.
        addPart(softBox, outfit, pose(0, 1.035, 0, .4, .48, .33), pose(0, 1.26, 0, .4, .48, .33), 'outfit');
        addPart(cylinder, skin, pose(0, 1.31, 0, .085, .12, .085), pose(0, 1.54, 0, .085, .12, .085));
        addPart(softBox, white, pose(0, 1.24, .17, .13, .07, .035), pose(0, 1.47, .17, .13, .07, .035));
        addPart(softBox, white, pose(0, 1.09, .177, .016, .22, .016), pose(0, 1.315, .177, .016, .22, .016));
        for (const side of [-1, 1]) {
            addPart(sphere, outfit, pose(side * .24, 1.11, .025, .09, .155, .095, -.25, 0, side * .14), pose(side * .24, 1.32, 0, .09, .155, .095, 0, 0, side * .12), 'outfit');
            addPart(sphere, skin, pose(side * .25, .975, .13, .065, .13, .075, -.5), pose(side * .265, 1.12, .02, .065, .15, .075));
            addPart(sphere, skin, pose(side * .25, .89, .22, .075, .07, .07), pose(side * .265, .99, .035, .075, .07, .07));
            addPart(sphere, denim, pose(side * .105, .75, .2, .1, .1, .25), pose(side * .105, .86, 0, .1, .22, .1));
            addPart(sphere, denim, pose(side * .105, .51, .4, .085, .19, .085), pose(side * .105, .48, 0, .085, .22, .085));
            addPart(softBox, white, pose(side * .105, .3, .46, .18, .14, .28), pose(side * .105, .22, .065, .18, .14, .28));
            addPart(softBox, ink, pose(side * .105, .24, .46, .19, .035, .29), pose(side * .105, .16, .065, .19, .035, .29));
            addPart(softBox, white, pose(side * .105, .37, .49, .085, .025, .09), pose(side * .105, .29, .095, .085, .025, .09));
        }
        const hairPalette = ['#382f39', '#654435', '#9b744e', '#344052', '#6e4a4d'];
        const identity = actor => Array.from(actor.entry?.job.id || 'guide').reduce((sum, c) => sum + c.charCodeAt(0), 0);
        groups.forEach(group => {
            const mesh = own(new T.InstancedMesh(group.geometry, group.mat, actors.length * group.definitions.length));
            mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
            mesh.userData.instancesPerActor = group.definitions.length;
            actors.forEach((actor, i) => {
                const restingShirt = actor.sleeping && group.colorMode === 'outfit';
                const color = new T.Color(group.colorMode === 'hair' ? hairPalette[identity(actor) % hairPalette.length] : group.colorMode === 'outfit' ? actor.guide ? '#e4b269' : restingShirt ? '#808080' : loungeJobColor(actor.entry) : '#ffffff');
                if (actor.sleeping && !restingShirt) color.lerp(new T.Color('#84909b'), .28).multiplyScalar(.5);
                group.definitions.forEach((_, j) => mesh.setColorAt(i * group.definitions.length + j, color));
            });
            scene.add(mesh); parts.push({ mesh, definitions: group.definitions }); pickable.push(mesh);
        });
        const shadow = own(new T.CircleGeometry(1, 16));
        shadowMesh = batch(shadow, own(new T.MeshBasicMaterial({ color: '#433b40', transparent: true, opacity: .12, depthWrite: false })), actors.map(a => ({ position: [a.x, .055, a.z + .2], scale: [.34, .25, 1], rotation: [-Math.PI / 2, 0, 0] })));
        shadowMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        actors.forEach((actor, index) => updateActor(index, actor.guide ? 1 : 0));
        actors.forEach((actor, index) => {
            if (!actor.sleeping) return;
            const label = text('span', 'lounge-sleep-label', 'Zzz'); label.setAttribute('aria-label', actor.entry.loungeState === 'completed' ? 'Đã hoàn thành' : 'Đã qua giờ');
            labelLayer.append(label); labels.push({ element: label, actor: index, point: new T.Vector3(actor.x + .22, 2.1, actor.z + .25) });
        });
        message.hidden = true;
    }
    function updateActor(index, standing, walking = 0) {
        const actor = actors[index]; if (!actor) return;
        const root = new T.Matrix4().makeRotationY(actor.angle || 0);
        const step = actor.guide ? 0 : standing * (actor.chaise ? 1.4 : .85);
        root.setPosition(actor.x, walking ? Math.abs(Math.sin(walking)) * .025 : 0, actor.z + step);
        const dummy = new T.Object3D(), matrix = new T.Matrix4();
        parts.forEach(part => part.definitions.forEach((definition, offset) => {
            const a = definition.seated, b = definition.standing;
            const rest = actor.sleeping ? 1 - standing : 0;
            dummy.position.set(a[0] + (b[0] - a[0]) * standing, a[1] + (b[1] - a[1]) * standing, a[2] + (b[2] - a[2]) * standing);
            dummy.rotation.set((a[6] || 0) + ((b[6] || 0) - (a[6] || 0)) * standing, (a[7] || 0) + ((b[7] || 0) - (a[7] || 0)) * standing, (a[8] || 0) + ((b[8] || 0) - (a[8] || 0)) * standing);
            if (actor.chaise && a[1] < .6 && standing < 1) {
                dummy.position.y += .43 * (1 - standing); dummy.position.z += .18 * (1 - standing);
                if (a[4] > .1 && a[5] < .1) dummy.rotation.x = Math.PI / 2 * (1 - standing);
            }
            if (walking && b[1] < .8) dummy.position.z += Math.sin(walking + (b[0] < 0 ? Math.PI : 0)) * .1;
            if (rest && a[1] >= 1.37) {
                const head = dummy.position.clone(); head.y -= 1.28; head.applyEuler(new T.Euler(.26 * rest, 0, -.16 * rest)); head.y += 1.28; dummy.position.copy(head);
                dummy.rotation.x += .26 * rest; dummy.rotation.z -= .16 * rest;
            }
            const eye = definition.visibility === 'open-eye' ? 1 - rest : definition.visibility === 'closed-eye' ? rest : 1;
            dummy.scale.set(a[3], a[4], a[5]).multiplyScalar(Math.max(.0001, eye)); dummy.updateMatrix(); matrix.multiplyMatrices(root, dummy.matrix);
            part.mesh.setMatrixAt(index * part.definitions.length + offset, matrix); part.mesh.instanceMatrix.needsUpdate = true;
        }));
        if (shadowMesh) {
            dummy.position.set(actor.x, .055, actor.z + step + .2);
            dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(.34, .25, 1); dummy.updateMatrix();
            shadowMesh.setMatrixAt(index, dummy.matrix); shadowMesh.instanceMatrix.needsUpdate = true;
        }
    }
    function fit() {
        if (!renderer || !camera || !visible) return;
        const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight), aspect = w / h;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35, Math.sqrt(1600000 / (w * h))));
        renderer.setSize(w, h, false);
        camera.aspect = aspect; camera.zoom = zoom;
        const target = new T.Vector3(pan.x, 1, depth * .2 + pan.z);
        const direction = new T.Vector3(0, .63, .78).normalize(), up = new T.Vector3(0, direction.z, -direction.y);
        const tangent = Math.tan(camera.fov * Math.PI / 360);
        let distance = 10;
        for (const x of [-worldWidth / 2 - .75, worldWidth / 2 + .75]) for (const y of [-.5, 3.8]) for (const z of [-2.3, depth - .8]) {
            const relative = new T.Vector3(x, y - 1, z - depth * .2);
            distance = Math.max(distance, relative.dot(direction) + Math.max(Math.abs(x) / (tangent * aspect * .9), Math.abs(relative.dot(up)) / (tangent * .9)));
        }
        cameraSpan = 2 * distance * tangent * aspect;
        camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateProjectionMatrix();
        paint();
    }
    function paint() {
        if (!renderer || !scene || !visible || document.hidden) return;
        renderer.render(scene, camera);
        const w = stage.clientWidth, h = stage.clientHeight;
        labels.forEach(label => {
            const point = label.point.clone().project(camera);
            label.element.style.left = `${(point.x + 1) * .5 * w}px`; label.element.style.top = `${(1 - point.y) * .5 * h}px`;
            label.element.hidden = Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1 || (label.actor !== undefined && selection?.index === label.actor);
        });
    }
    function paused() { return !alive || !visible || document.hidden || document.body.classList.contains('modal-open'); }
    function frame(now) {
        raf = 0;
        if (paused()) { last = 0; return; }
        raf = requestAnimationFrame(frame);
        if (now - last < 32) return;
        const dt = last ? Math.min((now - last) / 1000, .08) : .033; last = now;
        if (!reduced.matches && actors[guideIndex]) {
            elapsed += dt;
            const guide = actors[guideIndex]; guide.x = Math.sin(elapsed * .23) * worldWidth * .34; guide.angle = Math.cos(elapsed * .23) >= 0 ? Math.PI / 2 : -Math.PI / 2;
            updateActor(guideIndex, 1, elapsed * 5);
        }
        if (selection && !selection.opened) {
            const progress = Math.min(1, (now - selection.start) / 420);
            updateActor(selection.index, progress * progress * (3 - 2 * progress));
            if (progress === 1) { selection.opened = true; onOpen(selection.entry.job, selection.entry.originDate); }
        }
        paint();
        if (reduced.matches && (!selection || selection.opened)) { cancelAnimationFrame(raf); raf = 0; }
    }
    function wake() {
        if (!renderer || paused() || raf) return;
        last = 0; raf = requestAnimationFrame(frame);
    }
    function activate(index) {
        if (!actors[index]?.entry || selection || paused()) return;
        tooltip.hidden = true;
        selection = { index, entry: actors[index].entry, start: performance.now() - (reduced.matches ? 420 : 0), opened: false };
        wake();
    }
    function hit(event) {
        if (!T || !camera || !pickable.length) return -1;
        const rect = stage.getBoundingClientRect();
        const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
        const result = ray.intersectObjects(pickable, false).find(h => actors[Math.floor(h.instanceId / h.object.userData.instancesPerActor)]?.entry);
        return result ? Math.floor(result.instanceId / result.object.userData.instancesPerActor) : -1;
    }
    function renderList() {
        listBody.replaceChildren();
        const total = data.days.reduce((n, day) => n + day.entries.length, 0);
        listSummary.textContent = `Danh sách công việc · ${total} job`;
        data.days.forEach(day => {
            const group = text('section', 'lounge-list-day', ''); group.append(text('strong', '', `${day.label} · ${day.date}`));
            if (day.off || day.holiday) group.append(text('span', 'lounge-list-empty', day.off ? `Off · ${day.off}` : day.holiday));
            if (!day.entries.length) group.append(text('span', 'lounge-list-empty', 'Ghế trống · chưa có job'));
            day.entries.forEach(entry => {
                const button = text('button', 'lounge-list-job' + (['past', 'completed'].includes(entry.loungeState) ? ' is-resting' : ''), `${entry.overrideTime || entry.job.time || ''} · ${entry.job.title}${entry.loungeState === 'completed' ? ' · Đã xong' : entry.loungeState === 'past' ? ' · Đã qua giờ' : ''}`); button.type = 'button';
                button.onclick = () => {
                    if (!renderer) { onOpen(entry.job, entry.originDate); return; }
                    const page = Math.floor(day.entries.indexOf(entry) / PAGE_SIZE);
                    if ((pages[day.key] || 0) !== page) { pages[day.key] = page; makeRoom(); fit(); }
                    activate(actors.findIndex(actor => actor.entry === entry));
                };
                group.append(button);
            }); listBody.append(group);
        });
    }
    async function update(next) {
        data = next;
        weekButtons.forEach((button, i) => { button.classList.toggle('is-active', next.week === i); button.setAttribute('aria-pressed', String(next.week === i)); });
        const signature = JSON.stringify({ days: next.days, theme: next.theme });
        if (signature === previousSignature && renderer) { fit(); wake(); return; }
        previousSignature = signature;
        renderList();
        if (!visible) return;
        if (!T) {
            if (pending) return;
            pending = true;
            const version = revision;
            try {
                T = await loadThree();
                if (!alive || version !== revision || !visible) { T = null; return; }
                renderer = new T.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' });
                renderer.domElement.setAttribute('aria-label', 'Phòng khách 3D: mỗi nhân vật ngồi trên sofa là một job. Có thể mở job bằng danh sách bên dưới.');
                renderer.domElement.setAttribute('role', 'img'); renderer.setClearColor('#edf1f4'); renderer.outputColorSpace = T.SRGBColorSpace;
                renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
                stage.prepend(renderer.domElement);
                scene = new T.Scene(); camera = new T.PerspectiveCamera(38, 1, .1, 150);
            } catch (error) {
                T = null; previousSignature = '';
                renderer?.dispose(); renderer?.domElement.remove(); renderer = null;
                message.hidden = false; message.textContent = 'Chưa mở được phòng 3D. Bạn vẫn có thể chọn job trong danh sách bên dưới.';
                list.open = true; return;
            } finally { pending = false; }
        }
        if (renderer && alive && visible) { makeRoom(); fit(); wake(); }
    }
    listen(stage, 'pointerdown', event => {
        if (event.target !== renderer?.domElement || event.button > 0) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
        stage.setPointerCapture(event.pointerId);
    });
    listen(stage, 'pointermove', event => {
        if (pointer?.id === event.pointerId) {
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
            if (pointer.moved && camera) {
                const factor = cameraSpan / zoom / Math.max(1, stage.clientWidth);
                const dx = event.clientX - pointer.lastX, dy = event.clientY - pointer.lastY;
                pan.x = Math.max(-worldWidth, Math.min(worldWidth, pan.x - dx * factor * .8 - dy * factor * .45));
                pan.z = Math.max(-depth, Math.min(depth, pan.z + dx * factor * .35 - dy * factor)); fit();
            }
            pointer.lastX = event.clientX; pointer.lastY = event.clientY; tooltip.hidden = true; return;
        }
        if (event.target !== renderer?.domElement) return;
        hovered = hit(event); stage.classList.toggle('is-over-job', hovered >= 0);
        tooltip.hidden = hovered < 0;
        if (hovered >= 0) {
            const actor = actors[hovered], entry = actor.entry;
            tooltip.textContent = `${entry.job.title}\n${actor.day.label} ${actor.day.date} · ${entry.overrideTime || entry.job.time || ''}${entry.shiftedFrom || entry.movedFrom ? ' · Đã dời lịch' : ''}${entry.loungeState === 'completed' ? ' · Đã xong' : entry.loungeState === 'past' ? ' · Đã qua giờ' : ''}`;
            const rect = stage.getBoundingClientRect(); tooltip.style.left = `${Math.max(8, Math.min(event.clientX - rect.left + 14, rect.width - 255))}px`; tooltip.style.top = `${Math.max(8, Math.min(event.clientY - rect.top + 12, rect.height - 90))}px`;
        }
    });
    listen(stage, 'pointerup', event => {
        if (pointer?.id !== event.pointerId) return;
        const moved = pointer.moved; pointer = null; stage.releasePointerCapture(event.pointerId);
        if (!moved) activate(hit(event));
    });
    listen(stage, 'pointercancel', () => { pointer = null; });
    listen(stage, 'pointerleave', () => { tooltip.hidden = true; });
    listen(document, 'visibilitychange', () => { if (paused()) { cancelAnimationFrame(raf); raf = 0; } else wake(); });
    listen(document, 'shown.bs.modal', () => { cancelAnimationFrame(raf); raf = 0; tooltip.hidden = true; });
    listen(document, 'hidden.bs.modal', () => {
        if (selection?.opened) { updateActor(selection.index, 0); selection = null; }
        wake();
    });
    listen(reduced, 'change', () => { paint(); wake(); });
    const resize = new ResizeObserver(() => fit()); resize.observe(stage);
    return {
        update,
        setVisible(value) {
            visible = value;
            if (!value) {
                cancelAnimationFrame(raf); raf = 0;
                if (selection) updateActor(selection.index, 0);
                selection = null; tooltip.hidden = true;
            } else { fit(); wake(); }
        },
        dispose() {
            alive = false; revision++; cancelAnimationFrame(raf); abort.abort(); resize.disconnect(); clearScene();
            renderer?.dispose(); renderer?.domElement.remove(); renderer = null; container.replaceChildren();
        }
    };
}
