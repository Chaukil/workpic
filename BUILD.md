# Build và gộp file phát hành

Tất cả 21 form chiếm **90% chiều rộng và chiều cao màn hình**, bỏ giới hạn chiều rộng
640/820/1200 px cũ. Tiêu đề và nút cuối luôn nằm ngoài vùng cuộn nội dung. Trên máy tính,
Thông tin tài khoản và Cài đặt chia cột; nội dung job/checklist đặt cạnh nhau;
Hướng dẫn chia ba cột. Trên màn hình nhỏ các khung tự xếp lại để đọc và thao tác dễ hơn.


## Build and publish

Run `npm.cmd ci` and `npm.cmd run build` to regenerate `dist/`.
Publish only `dist/index.html` and `dist/sw.js` when using the bundled version.
Do not upload `node_modules/` or `.artifacts/` to GitHub or hosting.

The source version requires `index.html`, `app.js`, `styles.css` and `sw.js` together.
Keep `start-server.pyw` and `serve-work-hours.ps1` for the local IBM work-hours service.

## Verification

`npm.cmd test` runs the logic and lifecycle checks.
`npm.cmd run test:ui` checks the forms in Chrome/Edge.
These checks do not sign into the live Firebase project.

Excel libraries load only when importing a spreadsheet.
Those actions require internet access to their existing CDN.

All signed-in accounts use the same application features.
No administrator email or application permission gate remains.

Build and all verification code live in `tools.mjs`. Use the npm commands above;
`npm.cmd run test:performance` runs browser rendering/performance checks.
The runtime files remain `app.js` and `sw.js`; no extra JS files are needed for publishing.

## Shared notes

The notes panel uses the existing Firebase project and the `sharedNotes` collection.
It shows the latest 100 notes in real time. Image attachments are resized to at most
1400 pixels and embedded as JPEG; a note is limited to 750 KB and 20,000 text characters.
The sender and server timestamp are saved with each note. No job is created.

Live Firestore rules are not included in this workspace. Add this match inside the
existing `/databases/{database}/documents` rules if sharedNotes is not already allowed;
keep the rest of the application's rules intact:

```text
match /sharedNotes/{noteId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasAll(['senderId', 'senderName', 'content', 'createdAt', 'clientCreatedAt'])
    && request.resource.data.keys().hasOnly(['senderId', 'senderName', 'content', 'createdAt', 'clientCreatedAt'])
    && request.resource.data.senderId == request.auth.uid
    && request.resource.data.senderName is string
    && request.resource.data.senderName.size() > 0
    && request.resource.data.senderName.size() <= 500
    && request.resource.data.content is string
    && request.resource.data.content.size() > 0
    && request.resource.data.content.size() <= 750000
    && request.resource.data.createdAt == request.time
    && request.resource.data.clientCreatedAt is string
    && request.resource.data.clientCreatedAt.size() <= 40;
}
```

Browser tests mock Firestore, including send failures and sign-out cleanup; they do
not write sample notes into the live shared collection or deploy security rules.
