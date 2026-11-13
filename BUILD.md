# Build và gộp file phát hành

Tất cả 21 form chiếm **90% chiều rộng và chiều cao màn hình**, bỏ giới hạn chiều rộng
640/820/1200 px cũ. Tiêu đề và nút cuối luôn nằm ngoài vùng cuộn nội dung. Trên máy tính,
Thông tin tài khoản và Cài đặt chia cột; nội dung job/checklist đặt cạnh nhau;
Hướng dẫn chia ba cột. Trên màn hình nhỏ các khung tự xếp lại để đọc và thao tác dễ hơn.

## Hiệu ứng và dọn mã cũ

Mưa dùng một bộ vẽ Canvas 2D chung cho header/toàn màn hình, ba mức cường độ,
cùng màu, tốc độ, hướng gió và nhịp chớp. Chỉ một canvas/vòng animation hoạt động;
tạm ngưng khi ẩn tab hoặc mở form; tôn trọng tùy chọn giảm chuyển động của hệ điều hành.
Không cần tải Three.js chỉ để bật mưa. Các chủ đề khác tiếp tục dùng WebGL hiện có.

Đã bỏ lân Trung thu, các lớp mưa/chớp CSS và shader mưa cũ; xóa 18 hàm không còn
được gọi, các biến/constant dư và form gán job cũ không có lối mở (quản lý job dùng
trang Đấng tối cao). Chỉ xóa mã đã xác minh không có chỗ gọi hoặc đã được thay thế.
Kiểm tra chủ đề thực: `node ui-tests.mjs --themes` (cần mạng tải Three.js).

## Tiết kiệm quota Firebase miễn phí

Trong Đấng tối cao → Công việc, có thể kết hợp tìm kiếm, loại job, lịch lặp
(daily/weekly/2 tuần/tháng/một lần) và thứ trong tuần. Lọc theo lịch gốc:
daily tôn trọng thứ loại trừ, weekly/2 tuần lấy thứ của ngày bắt đầu;
job hằng tháng có thứ thay đổi theo tháng. Không tính ngày dời riêng hoặc lịch off.
Bộ lọc dùng dữ liệu đã tải, không gọi thêm Firebase.

- Lịch sử thay đổi lưu trên trình duyệt theo tài khoản, tối đa 50 mục trong 7 ngày;
  mở Lịch sử và ghi nhật ký không đọc/ghi Firestore. Không đồng bộ lịch sử giữa các máy.
- Đánh dấu thông báo đã đọc lưu tại máy (tối đa 500 ID), không ghi từng thông báo lên Firebase.
- Không ghi thêm mảng lịch sử chuyển/copy vào job. Giữ job, tiến độ, lịch off, sự kiện,
  quyền, thông báo giao việc và yêu cầu chuyển/copy để các chức năng tiếp tục hoạt động.
- Đấng tối cao → chọn thành viên → Tùy chọn → **Dọn dữ liệu phụ cũ** dọn cho mọi thành viên:
  xóa trường `changeHistory` khỏi hồ sơ, `transferHistory`/`copyHistory` khỏi job,
  thông báo quá 30 ngày và yêu cầu đã chấp nhận/từ chối/hủy quá 30 ngày.
  Giữ yêu cầu đang chờ và job đã hoàn thành để thống kê. Ngày không hợp lệ không bị xóa.
- Dọn theo trang 200 bản ghi, không tự chạy mỗi lần đăng nhập. Thao tác dọn cũng dùng quota;
  chỉ chạy một lần khi Firestore đã nhận yêu cầu trở lại. Không hoàn lại quota đã dùng trong ngày.


Form **Thông tin tài khoản** dùng chung phong cách với Phước lành: hồ sơ, bảo mật và
lối vào Đấng tối cao được chia thành các khung rõ ràng, hỗ trợ giao diện sáng/tối và điện thoại.
Bấm **Lưu tên** để lưu tên hiển thị mà không đóng form; bộ phận và ca làm việc tự lưu
khi thay đổi. Phần Bảo mật có thể mở/thu gọn và bật/tắt hiển thị mật khẩu đang nhập.

Các form còn lại (Cài đặt, Lịch sử, Check Change Due, ETA, Hướng dẫn, Thống kê,
job, lịch off, giờ làm việc, tính lương và xác nhận thao tác) dùng chung giao diện:
nền nhẹ, tiêu đề có điểm nhấn vàng, khung bo tròn, nút chính xanh ngọc và phần nội dung
cuộn riêng. Hỗ trợ sáng/tối và điện thoại; giữ màu cảnh báo/xóa để phân biệt thao tác.
Kiểu dùng chung nằm trong `styles.css`, áp dụng qua lớp `workpic-dialog` trong HTML.

Đã dọn `node_modules/` (thư viện có thể cài lại), `.artifacts/` (cache và ảnh kiểm tra)
và `.github/` (workflow kiểm tra tùy chọn, không triển khai hosting). Giữ `dist/` vì đây
là bản phát hành. Muốn build lại, chạy `npm.cmd ci` rồi `npm.cmd run build`.
Các kiểm tra `npm.cmd test` và `npm.cmd run test:ui` không cần cài thư viện build;
kiểm tra giao diện cần Chrome. Chế độ chụp ảnh xem trước tự tạo lại `.artifacts/`.

## Quản trị và phân quyền bằng nút

Đăng nhập bằng chauchikil01@gmail.com → Thông tin tài khoản → Đấng tối cao.
Đấng tối cao luôn có toàn quyền trong ứng dụng, không cần khởi tạo UID hay deploy backend.
Chọn user, tích Xem / Thêm / Sửa / Xóa rồi bấm Lưu phước lành. Bỏ tích thì nút
chức năng tương ứng không hiển thị; user chưa được cấp quyền mặc định không thấy
các chức năng. Có nút Ban toàn bộ / Thu hồi toàn bộ. Quyền lưu trong uiPermissions
của hồ sơ users và đồng bộ qua Firestore, không chỉ lưu trên máy Đấng tối cao.

Khi quyền thay đổi, hệ thống lưu thông báo “Đấng tối cao đã ban phước lành đến bạn”
hoặc “Đấng tối cao đã thu hồi phước lành”, kèm từng chức năng và quyền Xem/Thêm/Sửa/Xóa.
Nếu vừa ban vừa thu hồi, thông báo có hai phần riêng. Thay đổi quyền và thông báo
được lưu chung trong một transaction; lưu lại quyền không đổi không gửi thông báo mới.
User xem lại quyền hiện tại và lần thay đổi gần nhất ở Thông tin tài khoản →
Phước lành của tôi. Đây là form thông báo riêng, tự mở khi có thay đổi quyền và
có thể xem lại bất cứ lúc nào, kể cả khi không có quyền bật chuông thông báo.
Form của Đấng tối cao hiển thị trạng thái Toàn quyền riêng, không liệt kê lặp
các quyền đã có. Đóng form mở từ Thông tin tài khoản sẽ trở về màn hình tài khoản.

Đây là phân quyền ở giao diện ứng dụng, không bảo vệ trước thao tác gọi Firebase
trực tiếp. Mọi thao tác vẫn phải được Firebase hiện tại cho phép; ứng dụng không
vượt qua được quyền ghi bị Firebase từ chối. Không cần Cloud Functions, Emulator,
Java hoặc công cụ triển khai Firebase cho bản này.

Chọn thành viên bên trái, sau đó dùng tab **Hồ sơ / Công việc / Phước lành / Tùy chọn**.
Tab Công việc có tìm kiếm theo tên/nội dung và lọc theo bốn nhóm: Job lịch cố định,
Job một lần, Job ngoài lịch, Job trong ngày. Bấm Sửa để mở form trượt riêng, có
nút Lưu/Hủy cố định ở cuối; không cần cuộn tìm form trong danh sách. Đóng form hoặc
đổi thành viên khi chưa lưu sẽ có xác nhận giữ lại/bỏ thay đổi. Xóa dùng hộp thoại
ngay trong trang, có tên job và thành viên; xóa thành viên cần nhập đúng email.
Tab Phước lành có mẫu Chỉ xem / Ban toàn bộ / Thu hồi toàn bộ và nút Lưu phước lành.
Form hồ sơ cho phép đổi tên, ảnh, bộ phận, ca làm việc, thời gian nhắc và chế độ
tích hoàn thành. Form job hỗ trợ nội dung, checklist, lịch lặp, ngày/giờ, thời lượng,
tạm dừng, làm Chủ Nhật và loại trừ ngày. Job trong ngày có thể sửa nội dung, ngày,
hạn chót, trạng thái, người thực hiện và người được chỉ định. Đấng tối cao cũng thấy nút
Sửa/Xóa ở job do người khác tạo ngay trong khung Job trong ngày.

Đấng tối cao có thể thêm/sửa/xóa job và dữ liệu user bằng trang quản trị. Xóa user khỏi
ứng dụng yêu cầu nhập đúng email, chặn user vào ứng dụng và dọn job, lịch off,
checklist cùng dữ liệu liên quan. Giữ một hồ sơ đánh dấu đã xóa để user không tự
xuất hiện lại khi đăng nhập. Job do người khác tạo được giữ và bỏ gán user đã xóa.
Tài khoản Firebase Authentication vẫn còn: bản web không xóa hoặc đổi mật khẩu,
email đăng nhập của tài khoản người khác. Các thao tác này thực hiện trong
Firebase Console nếu cần. Không nhập khóa quản trị vào mã web.

Kiểm tra: `npm.cmd test`, `npm.cmd run test:ui` và `npm.cmd run build`.

---

Mã ứng dụng ở thư mục gốc chỉ còn **3 file JavaScript**:

- `app.js`: giao diện, lịch, job, đăng nhập và toàn bộ trang quản trị.
- `app-data.js`: tính lịch, xử lý dữ liệu và lưu dữ liệu quản trị dùng chung.
- `sw.js`: service worker cho thông báo desktop.

`index.html` chạy trực tiếp `app.js`. Không còn file `app.min.js` hoặc các module
JavaScript nhỏ tách riêng. Các kiểm tra đã gom vào `tests.mjs` và `ui-tests.mjs`;
công cụ build là `build.mjs`.

Lệnh build đồng thời tạo bản phát hành trong `dist/`, chỉ gồm **2 file**:

- `index.html`: gộp HTML, `styles.css` và JavaScript đã bundle/minify.
- `sw.js`: service worker xử lý thông báo, cần URL riêng để trình duyệt đăng ký.

JavaScript được bundle/minify trực tiếp vào HTML phát hành, không tạo thêm bản JS rời.
Firebase và Bootstrap vẫn tải từ CDN. Three.js chỉ còn dùng cho hiệu ứng chủ đề hiện có.
`sw.js` chạy riêng vì đây là service worker xử lý thông báo.

Sau khi sửa mã nguồn:

```powershell
npm.cmd ci
npm.cmd run build
```

Đưa **nội dung** thư mục `dist/` lên thư mục gốc của hosting (giữ `index.html` và `sw.js` cạnh nhau).
Không cần đưa CSS, mã nguồn, test, công cụ build hay `node_modules` lên hosting.
Không sửa tay `dist/index.html`; sửa mã nguồn ở thư mục gốc rồi build lại.
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

Cần build và cập nhật bản GitHub Pages bằng nội dung `dist/`, rồi nhấn Ctrl+F5. Mã cũ trên trang online vẫn dùng cấu hình cũ cho tới khi được triển khai; workspace này chưa tự xuất bản lên GitHub.

MSS là ngày thứ Tư, THU–WED là 6 ngày trước đến ngày MSS. ETD là thứ Bảy sau MSS, dùng để xác định năm kể cả qua tháng 12/tháng 1. Điều kiện `ETD >= CLng(Date)` được giữ bằng OLE Automation date serial như VBA.

MOTION lấy M151; STATION chỉ lấy O100. O200 vẫn có trong query gốc nhưng được bỏ qua khi quy đổi, kể cả khi khác giờ O100. Nếu các dòng cùng line O100 (hoặc M151) vẫn khác giờ trong cùng ngày, ứng dụng báo lỗi kèm thông tin dòng nguồn và không ghi đợt đó. Giờ 0 là dữ liệu hợp lệ.

Dịch vụ chỉ nghe localhost và phục vụ các file công khai được liệt kê sẵn. Không lưu mật khẩu trong mã nguồn. Mỗi máy cần IBM provider và mạng tới WFVNPROD. Các máy khác vẫn xem được giờ đã lưu trong Firestore theo quyền hiện có; việc Update từ IBM cần server trên chính máy thực hiện.

Kiểm tra logic quy đổi: `npm.cmd test`. Chưa thể xác nhận kết nối thực tế nếu chưa có IBM provider và mạng nội bộ. Các batch Firestore tối đa 400 ngày; nếu một batch sau lỗi, batch trước đã lưu có thể chạy lại.
