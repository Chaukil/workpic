import { dateKey } from './calendar-data.js';
import { houseLights } from './schedule-house-data.js';

const el = (tag, cls, value) => {
    const node = document.createElement(tag); node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
};
const action = (label, cls, run) => {
    const node = el('button', cls, label); node.type = 'button'; node.onclick = run; return node;
};
const stateNames = { upcoming: 'Sắp đến', active: 'Đang diễn ra', past: 'Đã qua giờ', completed: 'Đã hoàn thành' };

export function createScheduleHouse(container, { onOpen, onWeekChange, onDateChange = () => {}, now = () => new Date() }) {
    let data, selected, weekKey, visible = true, disposed = false, timer, lastDate = dateKey(now()), scrolledTo;
    const overrides = new Map(), boundaries = new Map();
    const abort = new AbortController();
    container.classList.add('schedule-house');
    const header = el('header', 'house-header');
    const brand = el('div', 'house-brand');
    brand.append(el('span', 'house-kicker', 'THE WEEK HOUSE'), el('h3', '', 'Mỗi ngày, một không gian.'));
    const controls = el('div', 'house-controls');
    const weekButtons = [0, 1].map(week => action(week ? 'Tuần sau' : 'Tuần này', 'house-week', () => onWeekChange(week)));
    const todayButton = action('Về hôm nay', 'house-today', () => {
        if (!data.days.some(day => day.key === dateKey(now()))) { onWeekChange(0); return; }
        selected = dateKey(now()); render();
    });
    controls.append(...weekButtons, todayButton); header.append(brand, controls);
    const layout = el('div', 'house-layout');
    const sidebar = el('aside', 'house-sidebar');
    const address = el('div', 'house-address');
    address.append(el('span', '', '07'), el('div', '', 'TẦNG NHÀ / 7 NGÀY'));
    const building = el('nav', 'house-building'); building.setAttribute('aria-label', 'Chọn tầng theo ngày');
    const sideNote = el('p', 'house-side-note', 'Chọn một tầng để bước vào ngày của bạn.');
    sidebar.append(address, building, sideNote);
    const interior = el('section', 'house-interior'); interior.setAttribute('aria-label', 'Tầng đang mở');
    const floorHeader = el('div', 'house-floor-header');
    const heading = el('div', 'house-floor-heading');
    const floorNumber = el('span', 'house-kicker'); const title = el('h4', ''); const subtitle = el('p', '');
    heading.append(floorNumber, title, subtitle);
    const lightBadge = el('span', 'house-light-status'); lightBadge.setAttribute('role', 'status');
    floorHeader.append(heading, lightBadge);
    const viewport = el('div', 'house-plan-viewport');
    const plan = el('div', 'house-plan');
    const wall = el('div', 'house-back-wall');
    const wallSign = el('span', 'house-wall-sign');
    const switchPlate = el('div', 'house-switch-plate');
    const lightSwitch = action('', 'house-wall-switch', () => {
        const day = data.days.find(day => day.key === selected);
        if (!day) return;
        overrides.set(day.key, !houseLights(day, now(), overrides.get(day.key)).on); render();
    });
    lightSwitch.setAttribute('role', 'switch');
    const switchLabel = el('span', '', 'CÔNG TẮC ĐÈN');
    switchPlate.append(lightSwitch, switchLabel); wall.append(wallSign, switchPlate);
    const rooms = el('div', 'house-rooms');
    plan.append(wall, rooms); viewport.append(plan);
    const note = el('p', 'house-floor-note');
    const legend = el('div', 'house-legend');
    for (const [cls, label] of [['live', 'Còn lịch'], ['rest', 'Đã qua giờ / hoàn thành'], ['off', 'Đèn tầng đang tắt']]) {
        const item = el('span', cls, label); legend.append(item);
    }
    interior.append(floorHeader, viewport, note, legend); layout.append(sidebar, interior);
    container.replaceChildren(header, layout);

    function light(day, current) {
        const result = houseLights(day, current, overrides.get(day.key));
        if (boundaries.has(day.key) && boundaries.get(day.key) !== result.signature) overrides.delete(day.key);
        boundaries.set(day.key, result.signature);
        return houseLights(day, current, overrides.get(day.key));
    }
    function room(entry, index, state, on, day) {
        const section = el('section', `house-room ${on ? 'is-lit' : 'is-dark'} is-${state}`);
        section.dataset.jobId = entry.job.id;
        section.style.setProperty('--room-accent', ['#7d9c8b', '#b18e73', '#8799ab', '#ab97ad'][index % 4]);
        const window = el('div', 'house-room-window');
        const pendant = el('div', 'house-pendant');
        const furniture = el('div', `house-furniture furniture-${index % 3}`);
        for (const cls of ['rug', 'desk', 'chair', 'shelf', 'plant']) furniture.append(el('span', `house-${cls}`));
        const number = el('span', 'house-room-number', `${day.floor}${String(index + 1).padStart(2, '0')}`);
        section.append(window, pendant, furniture, number);
        const plaque = el('div', 'house-room-plaque');
        if (on) {
            const time = entry.overrideTime || entry.job.time || 'Cả ngày';
            const task = action(entry.job.title || 'Công việc', 'house-task', () => onOpen(entry.job, entry.originDate));
            task.setAttribute('aria-label', `${entry.job.title || 'Công việc'}, ${time}, ${stateNames[state]}`);
            plaque.append(el('span', 'house-task-time', time), task, el('span', 'house-task-state', stateNames[state]));
            if (entry.shiftedFrom || entry.movedFrom) plaque.append(el('span', 'house-task-moved', 'Đã dời lịch'));
        } else plaque.append(el('span', 'house-room-sleep', 'Đèn đang tắt'), el('span', 'house-room-prompt', 'Bật công tắc trên tường để xem task'));
        section.append(plaque); return section;
    }
    function render() {
        if (!data || disposed) return;
        const current = now(), today = dateKey(current);
        const day = data.days.find(value => value.key === selected) || data.days[0];
        if (!day) return;
        selected = day.key;
        const statuses = new Map(data.days.map(value => [value.key, light(value, current)]));
        const status = statuses.get(day.key);
        weekButtons.forEach((button, i) => { button.classList.toggle('is-active', data.week === i); button.setAttribute('aria-pressed', String(data.week === i)); });
        building.replaceChildren(...[...data.days].reverse().map(value => {
            const floor = action('', `house-floor ${selected === value.key ? 'is-selected' : ''} ${statuses.get(value.key).on ? 'is-lit' : ''}`, () => { selected = value.key; render(); });
            floor.dataset.date = value.key;
            floor.style.setProperty('--floor-order', value.floor);
            floor.setAttribute('aria-pressed', String(selected === value.key));
            floor.setAttribute('aria-label', `Tầng ${value.floor}, ${value.label}, ${value.date}, ${value.entries.length} task${value.key === today ? ', hôm nay' : ''}`);
            const windows = el('span', 'house-floor-windows');
            for (let i = 0; i < 4; i++) windows.append(el('i', ''));
            const label = el('span', 'house-floor-label');
            label.append(el('b', '', String(value.floor).padStart(2, '0')), el('span', '', value.label), el('small', '', value.date));
            floor.append(windows, label, el('span', 'house-floor-count', `${value.entries.length} task`));
            if (value.key === today) floor.append(el('span', 'house-today-dot'));
            return floor;
        }));
        if (scrolledTo !== selected && building.scrollWidth > building.clientWidth) {
            const target = building.querySelector('.is-selected');
            building.scrollLeft = target.offsetLeft - (building.clientWidth - target.offsetWidth) / 2;
            scrolledTo = selected;
        }
        floorNumber.textContent = `TẦNG ${String(day.floor).padStart(2, '0')} / MẶT BẰNG CÔNG VIỆC`;
        title.textContent = `${day.label}, ${day.date}${day.key === today ? ' · Hôm nay' : ''}`;
        subtitle.textContent = `${day.entries.length} phòng công việc${day.off || day.holiday ? ' · ' + [day.off, day.holiday].filter(Boolean).join(' · ') : ''}`;
        wallSign.textContent = `THE WEEK HOUSE — ${day.label.toLocaleUpperCase('vi')}`;
        lightSwitch.setAttribute('aria-checked', String(status.on));
        lightSwitch.setAttribute('aria-label', `${status.on ? 'Tắt' : 'Bật'} đèn ${day.label}`);
        lightSwitch.classList.toggle('is-on', status.on);
        lightBadge.textContent = status.on ? 'Đèn đang bật' : 'Đèn đang tắt';
        lightBadge.classList.toggle('is-on', status.on);
        plan.classList.toggle('is-dark', !status.on);
        rooms.replaceChildren();
        rooms.style.gridTemplateRows = day.entries.length ? `repeat(${Math.ceil(day.entries.length / 2)}, minmax(230px, auto))` : '';
        if (!day.entries.length) {
            const empty = el('div', 'house-empty'); empty.append(el('span', '', 'Một khoảng thảnh thơi.'), el('p', '', day.off || day.holiday || 'Tầng này chưa có task. Công việc mới sẽ xuất hiện thành một phòng tại đây.'));
            rooms.append(empty);
        } else {
            const hall = el('div', 'house-hall'); hall.setAttribute('aria-hidden', 'true'); hall.append(el('span', '', 'HÀNH LANG'), el('div', 'house-stairs')); rooms.append(hall);
            day.entries.forEach((entry, index) => {
                const node = room(entry, index, status.states[index], status.on, day);
                node.style.gridColumn = index % 2 ? '3' : '1'; node.style.gridRow = String(Math.floor(index / 2) + 1);
                rooms.append(node);
            });
        }
        note.textContent = !status.on ? 'Bật công tắc trên tường để xem các task của tầng này.' : 'Bấm tên task trong phòng để mở chi tiết. Phòng đã qua giờ hoặc hoàn thành sẽ tối lại.';
    }
    function schedule() {
        clearTimeout(timer);
        if (disposed || !visible || document.hidden || !data) return;
        timer = setTimeout(() => {
            const current = now(), today = dateKey(current);
            if (lastDate !== today) {
                lastDate = today; overrides.clear(); selected = today; onDateChange();
            }
            const changed = data.days.some(day => boundaries.get(day.key) !== houseLights(day, current).signature);
            if (changed || !data.days.some(day => day.key === selected)) render();
            schedule();
        }, 1000);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && visible) { render(); schedule(); } else clearTimeout(timer);
    }, { signal: abort.signal });
    return {
        update(next) {
            if (disposed) return;
            data = next;
            const key = next.days[0]?.key;
            if (weekKey !== key) { weekKey = key; overrides.clear(); boundaries.clear(); selected = next.days.find(day => day.key === dateKey(now()))?.key || key; }
            render(); schedule();
        },
        setVisible(value) { visible = value; if (value) { render(); schedule(); } else clearTimeout(timer); },
        dispose() { disposed = true; clearTimeout(timer); abort.abort(); overrides.clear(); boundaries.clear(); container.replaceChildren(); container.classList.remove('schedule-house'); }
    };
}
