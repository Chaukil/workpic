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

All signed-in users share the same notes feed. The requested policy gives every
signed-in user read/write access to sharedNotes, with no role or department filter.

Live Firestore rules are not included in this workspace and have not been deployed.
Open https://console.firebase.google.com/project/workpic-eb555/firestore/rules,
add this match inside the existing /databases/{database}/documents block and Publish.
Replace an existing sharedNotes block if present; keep all other rules intact:

```text
match /sharedNotes/{noteId} {
  allow read, write: if request.auth != null;
}
```

Browser tests mock Firestore, including send failures and sign-out cleanup; they do
not write sample notes into the live shared collection or deploy security rules.

## Attendance companion

Each account stores `attendancePet` on its existing user profile. The profile is
chosen consistently by document ID when legacy duplicate profiles exist. Check-in,
feeding and resurrection use transactions to read the latest state before writing;
the app never reports a successful check-in when the write fails.

Days reset at midnight in Asia/Bangkok (UTC+7). Ten actual check-in days during one
life unlock the next form. The pet dies 72 hours after its latest check-in, or birth
if it has never checked in. Clicking a dead pet resurrects it and resets evolution.
Both the initial and resurrected egg hatch one hour after birth. These times are
stored as timestamps, so hatching and absence are evaluated correctly after closing
and reopening the app. Feeding is limited to once per calendar day.

The companion uses the same pinned Three.js version as the existing visual effects,
with a small transparent WebGL canvas and a lightweight vector fallback. Hover/focus
pauses roaming. Sign-out stops the renderer, timers and profile listener.

`node --use-system-ca tools.mjs test:ui --pet` additionally checks all 20 egg/creature
forms with real WebGL and saves the preview to `.artifacts/attendance-pet-stages.png`.
Regular UI tests use a fake Firebase backend; live profile permissions are not deployed
or changed by these tests.
