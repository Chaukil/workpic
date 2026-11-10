# JavaScript build

Trang chạy `app.min.js`: một bundle chứa các module JavaScript nội bộ.
Firebase và Bootstrap vẫn tải từ CDN. Three.js chỉ còn dùng cho hiệu ứng chủ đề hiện có.
`sw.js` chạy riêng vì đây là service worker xử lý thông báo.

Sau khi sửa mã nguồn:

```powershell
npm.cmd ci
npm.cmd run build
```

Đưa `app.min.js` đã build lên cùng `index.html`, `styles.css`, `schedule-house.css` và `sw.js`.
Các file `.test.mjs`, `build.mjs` và `node_modules` không cần đưa lên hosting.
Không sửa tay file `app.min.js`; sửa các module nguồn rồi build lại.

## Ngôi nhà công việc

`schedule-house.js` dựng nhà cắt lớp bằng DOM/CSS, không cần WebGL hay model nhân vật.
`schedule-house-data.js` chuẩn bị 7 tầng từ Thứ Hai đến Chủ nhật, giữ nguyên ngày gốc của task đã dời.

- Mặc định mở tầng của hôm nay; chọn tầng khác hoặc tuần khác để xem lịch.
- Mỗi task có một phòng. Công tắc trên tường bật/tắt nội dung task của tầng.
- Hôm nay có task chưa hết giờ thì tầng tự sáng. Phòng hết giờ hoặc hoàn thành tắt đèn.
- Ngày cũ, ngày tương lai và tầng trống mặc định tắt; có thể bật thủ công để xem.
- Đèn tự cập nhật trong vòng một giây khi task đổi trạng thái hoặc qua ngày.
- Thao tác bật thủ công được giữ qua các lần đồng bộ dữ liệu, đến khi trạng thái lịch thay đổi.
- Task không có giờ: sáng trong ngày đó; task không có thời lượng: mặc định 30 phút.
- Chế độ 3D đã lưu trước đây được chuyển sang chế độ Ngôi nhà.

Kiểm tra:

```powershell
npm.cmd test
node schedule-house-ui.test.mjs
```

Kiểm tra giao diện dùng Chrome/Edge có sẵn và xuất ảnh trong `.artifacts/`.
