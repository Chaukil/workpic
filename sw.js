/* Service worker cho Job Schedule Manager
 * Chỉ dùng để thông báo desktop có nút bấm (Hoàn thành / Đợi tí).
 * Không cache gì cả — không ảnh hưởng cách app tải dữ liệu.
 *
 * Đặt file này CÙNG THƯ MỤC với index.html (phải được phục vụ qua HTTPS, github.io là đủ).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const data = notification.data || {};
    const action = event.action || 'open';      // 'complete' | 'snooze' | 'open' (bấm vào thân thông báo)
    notification.close();

    event.waitUntil((async () => {
        const msg = {
            type: 'job-notification-action',
            action,
            jobId: data.jobId,
            originDate: data.originDate,
            kind: data.kind
        };

        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (wins.length) {
            // Gửi cho 1 cửa sổ duy nhất (ưu tiên cửa sổ đang hiện) để tránh xử lý trùng
            const target = wins.find(c => c.visibilityState === 'visible') || wins[0];
            if (action === 'open') {
                try { await target.focus(); } catch (e) { /* ignore */ }
            }
            target.postMessage(msg);
            return;
        }

        // App đang đóng: mở lại kèm tham số, app sẽ tự xử lý sau khi đăng nhập + tải job xong
        const url = new URL(self.registration.scope);
        url.searchParams.set('jobAction', action);
        if (data.jobId) url.searchParams.set('jobId', data.jobId);
        if (data.originDate) url.searchParams.set('originDate', data.originDate);
        if (data.kind === 'quickjob') url.searchParams.set('kind', 'quickjob');
        await self.clients.openWindow(url.href);
    })());
});
