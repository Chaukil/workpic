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
Models are procedural Three.js geometry, not scanned or sculpted GLB assets.
Smooth implicit surfaces join dinosaur torso, neck and skull; curved tube meshes
form tails, limbs and claws. Fish use tapered profiles, fin rays and gill folds.
Generated color/relief textures add scales, while sharks and whales use smoother
skin. Textures and geometries are disposed on each model change and sign-out.
Fish and marine dinosaurs swim, land dinosaurs/dragons walk along the viewport
floor, and bird forms fly in the upper viewport. Cats, tigers and lions also walk.
Eggs and dead pets rest; reduced-motion mode stops roaming and articulation.

Levels 1–9 are shared, ending with the ray. At 80 check-in days (level 9), users
unlock four branches: fish, dinosaurs, birds, and cats/tigers/lions. Each branch
has twenty forms, covering overall levels 10–29 (90–280 check-in days). Each
species has a juvenile and mature stage with increasing display size. Users may
switch branches without losing check-ins; transactions persist the selected
`branch` in the same profile. The last form is capped at level 29, but daily
check-ins continue to keep it alive. Legacy profiles without a branch retain all
check-ins and display the ray until a branch is chosen. Resurrection resets the
branch along with evolution; admin revival that keeps progress retains it.
Floating canvas size follows species scale and is bounded by viewport dimensions.
The admin panel selects the branch before offering its higher level forms.
Branch selection uses a separate native dialog. Its launcher is hidden below
level 9, and opening is guarded by readiness, life state and branch eligibility.
When an eligible pet without a branch is viewed in the care form, the picker is
prompted once per life/session; dismissing it does not reopen it on timer ticks.
Users may reopen it with the care form's branch button, and successful selection
closes only the picker. Closing care/signing out closes the picker too.
The care form's visibility switch hides only the floating pet, retaining its
preview, attendance, feeding and aging. The preference is stored per account in
local storage and makes no Firestore writes. Hidden floating models skip GPU
drawing unless displayed in the care preview.

`node --use-system-ca tools.mjs test:ui --pet` additionally checks all 90 egg/creature
forms with real WebGL and saves the preview to `.artifacts/attendance-pet-stages.png`.
Regular UI tests use a fake Firebase backend; live profile permissions are not deployed
or changed by these tests.

Pet nicknames are plain text, normalized to at most 30 Unicode code points, and
saved only on explicit form submission. Empty names fall back to the species.
Evolution, normal resurrection and admin egg resets retain the nickname.

### Firestore traffic audit (2026-11-19)

The supplied 429 log identifies `documents:batchGet`, `resource-exhausted`, and
the pet startup transaction. It shows a failed read, not evidence that admin
writes exhausted the write quota. Exact exhausted quota and project totals
require Firebase/Google Cloud Usage; no live usage console was accessed.

| Data path | When writes occur |
| --- | --- |
| users / attendancePet | One-time missing-pet initialization; explicit check-in, feeding, resurrection, branch, nickname or admin actions |
| users / account settings and calendar | Registration, profile/settings changes and personal calendar edits |
| jobs, quickJobs, overrides | Explicit creation, edit, transfer, completion, snooze and checklist actions |
| transfer requests and notifications | Explicit assignment/transfer workflow actions |
| work hours, days off, departments | Explicit edit/import/delete actions; imports can write multiple records |
| Pet animation, egg countdown, evolution status, rain water | No Firestore writes from timers; water uses local storage |

Pet startup reuses the canonical profile read during authentication and does not
run an initialization transaction for an already valid pet. The connection probe
now limits its jobs read to one document. The admin picker reuses the existing
users directory snapshot instead of rereading the full collection when available.
Pet transactions use two attempts instead of the SDK default five. After a
resource-exhausted response, new pet/admin requests are locally blocked for five
minutes (also across reloads of that tab). This is retry throttling, not a quota
reset; exhausted daily quota can outlast that interval. Draft names and unchanged
name submissions do not write. Tests use fake backends, not live quota.

The existing realtime users-directory listener remains a read amplification point:
each user document change (including a pet update) is read by clients listening to
that collection. No pet fields were migrated to a new collection, and rules were
not changed. Separating pets from public directory metadata would require a
data/rules migration; the current patch reduces redundant startup/admin reads.
