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

Days reset at midnight in Asia/Bangkok (UTC+7). One account-wide check-in per day
grants one XP to every living pet. Food grants one XP to the selected pet and is
allowed at most once every two hours, based on a persisted `lastFedAt`. Ten XP
unlock the next form. The pet dies 72 hours after its latest check-in, or birth
if it has never checked in. Clicking a dead pet resurrects it and resets evolution.
Both the initial and resurrected egg hatch one hour after birth. These times are
stored as timestamps, so hatching and absence are evaluated correctly after closing
and reopening the app. Feeding never updates the attendance death deadline;
crossing midnight does not reset the feeding cooldown. Legacy records without
`feedingXp` start at zero food XP; legacy `fedOn` dates lack precise feeding times
and are interpreted as midnight in UTC+7 until a new feed records `lastFedAt`.

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

Levels 1–9 are shared, ending with the ray. At 80 XP (level 9), users
unlock four branches: fish, dinosaurs, birds, and cats/tigers/lions. Each branch
has twenty forms, covering overall levels 10–29 (90–280 XP). Each
species has a juvenile and mature stage with increasing display size. Users may
switch branches without losing check-ins; transactions persist the selected
`branch` in the same profile. The last form is capped at level 29, but daily
check-ins continue to keep it alive. Legacy profiles without a branch retain all
check-ins and display the ray until a branch is chosen. Resurrection resets the
branch along with evolution; admin revival that keeps progress retains it.
Floating canvas size follows species scale and is bounded by viewport dimensions.
The admin panel selects the branch before offering its higher level forms.
Admin action handlers are bound once. While an action is pending, only its
clicked button has a busy indicator; other buttons retain their visual styling
and are guarded against activation, and target selectors are temporarily locked.
The selected action starts one transaction with at most one `transaction.update`.
No-op level/branch/hatch/revival/egg choices skip network access, and stale server
state is rechecked before deciding whether to update. Failed actions do not write
or remain locked. Pending choices in unrelated dropdowns are retained. Level and
branch changes do not perform attendance, feeding or revival; branch selection
does not hatch an egg or add XP. Explicit level application to an egg materializes
that level, while the existing max-level one-egg reward stays in the same update.
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

The profile's `attendancePet` retains its version-1 shape for the newest pet and
stores other pets as flat records in `companions`, with stable IDs. The same root
stores account-wide `attendanceDay`/`attendanceAt`. Household transitions run in a
single Firestore transaction: daily check-in updates all living pets once, while
feeding/renaming/branch/revival target a stable pet ID. A pet that reaches level 29
is marked with `eggGrantedAt` and grants exactly one new egg per life. The mature
pet is retained and the egg becomes the newest root pet. Startup initializes this
reward for legacy max-level pets exactly once. Completed pets continue to require
attendance and may be fed. Resurrection resets progression and its egg reward,
retaining the name/identity. Existing dead pets are not revived by household
attendance. No automatic feed or per-second Firestore write was added.
The game care screen lists the full collection; users select one pet to rename,
feed or view in the main 3D preview. Up to four pets (selected plus three companions)
roam simultaneously, each with independent animation and bounded WebGL resources.
Hiding pets/sign-out disposes companion renderers. The collection is not limited
by that on-screen renderer budget. The admin picker selects a pet within a user.

Weight is stored as integer `weightGrams`. New eggs start at zero; every valid
two-hour feed adds 200 grams in addition to its existing one XP. Attendance adds
XP but no weight. After 24 hours since the last check-in/birth, the total absence
penalty is 500 grams; after 48 hours it is 2000 grams total (not another 2000).
The existing death threshold remains 72 hours. Weight never falls below zero.
Views project offline penalties without writing. Successful mutations settle
them with `weightPenaltyGrams`, and attendance resets the penalty stage only
after settling, so checking in cannot restore previously lost weight or apply
a penalty twice. Legacy records without weight derive their initial mass from
their existing feed count at 200 grams per feed. Revival/egg resets weight to zero.

The separate weight comparison dialog reuses the existing users-directory
snapshot, with no new polling/query or write per render. It includes users whose
most recent actual attendance or feed occurred less than seven rolling days ago;
at exactly seven days they are omitted. Born-at, rename and generic updated-at
timestamps do not qualify a user. Modern household records use `attendanceAt`
for actual attendance so an admin level edit cannot qualify an offline user.
Legacy profiles fall back to pet attendance/feed timestamps. Each owned pet is a
row, ordered by living status then projected weight and level. Dead pets remain
visible last without ranks. A branch filter and own-user highlighting are included.
Comparison refreshes on directory snapshots, local pet changes and minute ticks
while open, using the same weight projection as care and roster cards.
Each comparison row includes a thumbnail captured from the same Three.js model
and current form/level/death state as that user's pet. One hidden renderer processes
thumbnail requests sequentially, deduplicating shared appearances and caching up
to 96 PNG/data images in memory. It is disposed when the comparison closes or the
account signs out. An SVG fallback is used when WebGL is unavailable. No thumbnail
is uploaded to Firebase, and creating/refiltering images does not write profiles.

Settings are compact and no longer include sample notifications, the delayed
diagnostic scheduler, test feedback buttons or the Windows-settings link. Existing
job desktop delivery/snooze logic remains intact. The permission warning can still
request browser notification permission, without sending a sample notification.

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
Normal pet transactions use two attempts instead of the SDK default five; admin
transactions use one attempt and never automatically retry an action. After a
resource-exhausted response, new pet/admin requests are locally blocked for five
minutes (also across reloads of that tab). This is retry throttling, not a quota
reset; exhausted daily quota can outlast that interval. Draft names and unchanged
name submissions do not write. Tests use fake backends, not live quota.

The existing realtime users-directory listener remains a read amplification point:
each user document change (including a pet update) is read by clients listening to
that collection. No pet fields were migrated to a new collection, and rules were
not changed. Separating pets from public directory metadata would require a
data/rules migration; the current patch reduces redundant startup/admin reads.

Pet challenges use `petBattles/{id}` and `users/{uid}.petBattleLocks`. Each player
reserves their own virtual grams in a transaction; acceptance reserves the other
stake. Commit/reveal hashes hide rock-paper-scissors choices until both commit.
The server timestamp anchors a deterministic alternating fight locally, without
Firestore writes per animation frame or combat turn. Claims update only the
claimant's profile and are idempotent; an offline player claims on returning.
Unaccepted invitations expire after ten minutes; RPS expires after two minutes
and refunds both stakes. Closing the dialog does not cancel an accepted match.
Incoming invitations reuse directory lock metadata and individual battle document
listeners, with no additional collection query or composite index.

Battle tests use two simulated clients and real browser/WebGL rendering. Live
Firebase access has not been tested. Existing rules must permit participant access
to `petBattles` and owned profile updates; no deployed rules were overwritten.
This client implementation prevents accidental duplicate settlements, but is not
server-authoritative anti-cheat. Adversarial play requires server-side validation
and restrictive rules; virtual pet weight has no monetary value.

New battles include a five-second RPS result intro (`introMs: 5000`) anchored
to `startedAt`; older battles retain their two-second intro. The finish button
is enabled only after the current player's claim has settled. It dismisses the
room on the current device using account-scoped local storage, rather than deleting
the shared document before an offline opponent can claim. Skill particles remain
bounded to 4–16 per turn; species control the effect and model lunge, while levels
increase particle density and glow. Reduced-motion preferences suppress particles.

New allocations use eight fields (attack, magic, defense, physicalReduction,
magicReduction, dodge, luck, health) within the original total budget. Existing
three-field battles remain supported. New combat sums separately mitigated physical
and magic damage; deterministic seeded rolls apply capped dodge (40%) and critical
chance (35%, 1.5x damage), each at 0.5 percentage points per allocated point.
Winner claims set the participating pet's `victoryAuraUntil` in the same profile
transaction as payment. Expiry is combat end plus one hour, independent of claim
time; timers merely render it and never extend it or write to Firestore.
