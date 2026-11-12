# Build và gộp file phát hành

Mã nguồn ở thư mục gốc chạy `app.min.js`: một bundle chứa các module JavaScript nội bộ.
Lệnh build đồng thời tạo bản phát hành trong `dist/`, chỉ gồm **2 file**:

- `index.html`: gộp HTML, `styles.css` và JavaScript đã bundle/minify.
- `sw.js`: service worker xử lý thông báo, cần URL riêng để trình duyệt đăng ký.

Các module nguồn và test vẫn giữ riêng để chỉnh sửa và kiểm tra; không cần tải lên hosting.
Firebase và Bootstrap vẫn tải từ CDN. Three.js chỉ còn dùng cho hiệu ứng chủ đề hiện có.
`sw.js` chạy riêng vì đây là service worker xử lý thông báo.

Sau khi sửa mã nguồn:

```powershell
npm.cmd ci
npm.cmd run build
```

Đưa **nội dung** thư mục `dist/` lên thư mục gốc của hosting (giữ `index.html` và `sw.js` cạnh nhau).
Không cần đưa `app.min.js`, CSS, module nguồn, test, công cụ build hay `node_modules` lên hosting.
Không sửa tay `app.min.js` hoặc `dist/index.html`; sửa mã nguồn ở thư mục gốc rồi build lại.
Các thư viện CDN và font vẫn cần mạng; bản gộp không phải bản offline.
Server IBM (`serve-work-hours.ps1`, `start-server.pyw`) vẫn là công cụ chạy riêng trên máy Windows.
Server hiện tại phục vụ mã nguồn ở thư mục gốc; bản phát hành `dist/` dùng khi đưa lên hosting.

---

# Chạy cập nhật giờ làm việc

Mỗi máy tự chạy server để lấy dữ liệu IBM. Cả `https://chaukil.github.io/workpic/` và bản local đều gọi `http://localhost:8080/api/work-hours` trên chính máy đang mở trình duyệt. Không cần mã API hay cấu hình địa chỉ server dùng chung.

## Mở bằng nhấp đúp (Python)

Cài Python 3 trên Windows với Tkinter (bản cài Python thông thường có sẵn). Nhấp đúp **start-server.pyw** trong thư mục này, nhập tài khoản/mật khẩu IBM, chọn mở web GitHub Pages hoặc local rồi bấm **Bật server và mở ứng dụng**. Trang được chọn tự mở khi server sẵn sàng. Không cần cài thư viện Python bổ sung. Chỉ mở trang web không thể tự chạy tiến trình Python; phải mở launcher trên từng máy trước khi Update.

Giữ cửa sổ launcher mở khi sử dụng; bấm **Dừng server** hoặc đóng cửa sổ để tắt. Mật khẩu chỉ truyền vào tiến trình server, không ghi vào file. Nếu Windows chưa liên kết file `.pyw`, dùng **Open with → Python** hoặc chạy `py .\start-server.pyw` trong terminal. File Python bật dịch vụ PowerShell hiện có, nên vẫn cần IBM provider và mạng nội bộ như bên dưới.

Khi Update lỗi, form giữ lại khung lỗi để sao chép: HTTP status, bước lỗi, mã lỗi, thông báo IBM/ADO, SQLState và gợi ý kiểm tra. Cửa sổ Python cũng có **Nhật ký server / lỗi IBM** và **Sao chép nhật ký**. Nhật ký nằm trong bộ nhớ, không ghi ra file; mật khẩu được che. Sau khi cập nhật mã, dừng server cũ, mở lại `start-server.pyw` và tải lại trang bằng Ctrl+F5 để nhận phần báo lỗi mới.

## Chạy bằng PowerShell

Ứng dụng cần dịch vụ Windows vì trình duyệt không dùng được ADODB/IBM OLE DB. Chạy trên Windows có IBM i Access provider `IBMDASQL.DataSource.1` và kết nối mạng tới WFVNPROD. Dùng Windows PowerShell 5.1 có kiến trúc 32/64 bit phù hợp provider.

Trong PowerShell tại thư mục ứng dụng:

```powershell
$credential = Get-Credential -Message 'Tài khoản IBM database'
$env:WORKHOURS_DB_USER = $credential.UserName
$env:WORKHOURS_DB_PASSWORD = $credential.GetNetworkCredential().Password
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\serve-work-hours.ps1
```

Mở `http://localhost:8080`, đăng nhập ứng dụng, chọn bộ phận trong “Update giờ làm việc”, rồi bấm **Update dữ liệu**. Dữ liệu mới được thêm; nếu có ngày trùng trong bộ phận đó, ứng dụng hỏi xác nhận trước khi ghi toàn bộ đợt. Hủy sẽ giữ nguyên dữ liệu.

Cũng có thể dùng Live Server tại `http://127.0.0.1:5500` hoặc `http://localhost:5500`: ứng dụng tự gọi API `http://localhost:8080/api/work-hours`. Vẫn cần chạy script PowerShell ở trên và giữ cửa sổ đó mở. Live Server chỉ phục vụ file tĩnh, không chạy query IBM; gọi `/api/work-hours` trực tiếp ở cổng 5500 sẽ trả 404. Dịch vụ cho phép các origin HTTP loopback để hỗ trợ cách chạy này. Giữ cổng API mặc định 8080. Lệnh trên chỉ áp dụng execution policy cho tiến trình chạy dịch vụ, không thay đổi thiết lập hệ thống.

## Dùng trên GitHub Pages

1. Khởi động server trên chính máy đang dùng bằng launcher.
2. Mở `https://chaukil.github.io/workpic/`, đăng nhập và bấm Update.
3. Nếu Chrome/Edge hỏi quyền truy cập mạng cục bộ hoặc localhost, chọn **Cho phép**. Nếu đã chặn, mở cài đặt quyền của trang để cho phép rồi tải lại. Nếu chính sách trình duyệt của công ty chặn truy cập localhost, dùng bản local hoặc nhờ IT cấp quyền; không cần tắt bảo vệ trình duyệt.
4. Nếu không kết nối được, mở `http://localhost:8080/api/health` trên cùng máy để kiểm tra tiến trình server, rồi xem nhật ký launcher. Health không kiểm tra kết nối IBM.

Server cho phép CORS từ `https://chaukil.github.io` và origin loopback. Origin CORS không chứa `/workpic/`. Tham khảo [quyền truy cập mạng cục bộ của Chrome](https://developer.chrome.com/blog/local-network-access) và [hướng dẫn Edge](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access).

Cần cập nhật bản GitHub Pages với `app.js`, `api-client.js`, `work-hours-data.js`, `index.html`, `styles.css` rồi nhấn Ctrl+F5. Mã cũ trên trang online vẫn dùng cấu hình cũ cho tới khi được triển khai; workspace này chưa tự xuất bản lên GitHub.

MSS là ngày thứ Tư, THU–WED là 6 ngày trước đến ngày MSS. ETD là thứ Bảy sau MSS, dùng để xác định năm kể cả qua tháng 12/tháng 1. Điều kiện `ETD >= CLng(Date)` được giữ bằng OLE Automation date serial như VBA.

MOTION lấy M151; STATION chỉ lấy O100. O200 vẫn có trong query gốc nhưng được bỏ qua khi quy đổi, kể cả khi khác giờ O100. Nếu các dòng cùng line O100 (hoặc M151) vẫn khác giờ trong cùng ngày, ứng dụng báo lỗi kèm thông tin dòng nguồn và không ghi đợt đó. Giờ 0 là dữ liệu hợp lệ.

Dịch vụ chỉ nghe localhost và phục vụ các file công khai được liệt kê sẵn. Không lưu mật khẩu trong mã nguồn. Mỗi máy cần IBM provider và mạng tới WFVNPROD. Các máy khác vẫn xem được giờ đã lưu trong Firestore theo quyền hiện có; việc Update từ IBM cần server trên chính máy thực hiện.

Kiểm tra logic quy đổi: `node work-hours-data.test.mjs`. Chưa thể xác nhận kết nối thực tế nếu chưa có IBM provider và mạng nội bộ. Các batch Firestore tối đa 400 ngày; nếu một batch sau lỗi, batch trước đã lưu có thể chạy lại.
