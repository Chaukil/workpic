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
has twenty paired forms at levels 10–29 and a final form at level 30 (290 XP). Each regular
species has a juvenile and mature stage with increasing display size. Users may
switch branches without losing check-ins; transactions persist the selected
`branch` in the same profile. The last form is capped at level 30, but daily
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
feeding/renaming/branch/revival target a stable pet ID. A pet that reaches level 30
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
XP but no weight. Absence leaves weight intact and the pet dies after 72 hours
without checking in. Weight never falls below zero. Previously stored weight
is used as-is, including old deductions. Legacy records without weight derive
it from their feed count at 200 grams per feed. Revival and egg resets set weight
to zero. The Firebase Functions build shares the same weight calculation.

The separate weight comparison dialog reuses the existing users-directory
snapshot, with no new polling/query or write per render. It includes users whose
most recent actual attendance or feed occurred less than seven rolling days ago;
at exactly seven days they are omitted. Born-at, rename and generic updated-at
timestamps do not qualify a user. Modern household records use `attendanceAt`
for actual attendance so an admin level edit cannot qualify an offline user.
Legacy profiles fall back to pet attendance/feed timestamps. Each owned pet is a
row, ordered by living status, then level, then weight. Dead pets remain
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

Pet startup reuses the canonical profile from authentication. It subscribes to
its profile separately only when the directory does not supply that document.
The active jobs listener replaces the login connection probe. The admin picker,
assignment, presenter picker, days-off picker and statistics reuse the directory
snapshot when available. Shared notes retain a single listener capped at 100
notes to support the unread badge. Quick jobs subscribe to open or invited jobs and
jobs created in the last 30 days, with a compatibility fallback if Firestore
reports a missing index. Duplicate days off are merged in the view and removed
when explicitly deleting their day.

After a resource-exhausted response, new pet requests are paused for five minutes
across tabs in the same browser. The pause limits retries. Project quota is
controlled by Firestore. Tests use fake backends and do not measure live usage.

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
listeners. Successful settlements and dismissed invitations release their listeners.
The simulated new-room flow uses 10 transaction document reads and 10 document
writes across create, accept, both ready actions and both settlements. The earlier
flow used 13 transaction reads for those actions. These counts exclude listeners,
security-rule reads and retries. Repeated ready or claim actions already reflected
locally launch no new transaction.

Remaining broad reads include the live users directory, historical days off and
the all-jobs statistics view. If the Firebase Usage chart shows reads concentrated
around pet updates, move frequently updated pet state out of public user profiles
and subscribe to invitations addressed to each participant. That requires a
coordinated data and rules migration.

Battle tests use two simulated clients and real browser/WebGL rendering. Live
Firebase access has not been tested. Existing rules must permit participant access
to `petBattles` and owned profile updates; no deployed rules were overwritten.
Firestore-only Bot matches are simulated locally and settle in one transaction
when the match ends. A bounded `petBotClaims` marker prevents ordinary retries
from paying twice, but clients control the simulation and can alter their data.
This is not server-authoritative anti-cheat.

### Pet Control Center permissions

The control center updates `attendancePet` in the selected member's profile.
In [Firestore Rules](https://console.firebase.google.com/project/workpic-eb555/firestore/rules),
add this rule inside the existing `match /users/{userId}` block and publish.
Replace `ADMIN_AUTH_UID` with the Firebase Authentication UID for
`chauchikil01@gmail.com` from the Authentication Users tab. Keep the existing
rules for profile owners and other collections.

```firestore
allow update: if request.auth != null
  && request.auth.uid == "ADMIN_AUTH_UID"
  && request.resource.data.attendancePet is map
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendancePet']);
```

### Firestore-only pet mode

The browser uses Firestore directly; Cloud Functions deployment and callable CORS
are not required. Pet data and human battles stay in `users` and `petBattles`.
The member list is fetched once per sign-in rather than kept in a real-time
collection listener. Opening rankings reads `users` once and builds the ordered
result locally; the UI displays 20 rows at a time and caches the result for one
minute. While ranking is open, document listeners track the first 20 ranked
profiles only; they are removed when the dialog closes. This keeps changes to
those profiles live without listening to the whole collection. A newly active
member or profile not in those first 20 requires reopening/refreshing the ranking
to enter the in-memory result.

Bot matches are local simulations. At completion, one Firestore transaction
updates the player's pet and an idempotency marker in their `users` document.
Because the browser controls the result, users can manipulate Bot rewards.
Server-side verification requires Cloud Functions and is intentionally not used
in this mode. Continue using the existing Firestore Rules for signed-in reads,
owned profile updates, and participant access to `petBattles`; no new collection
or Firebase deployment setup is needed.

New battles include a five-second RPS result intro (`introMs: 5000`) anchored
to `startedAt`; older battles retain their two-second intro. The finish button
is enabled only after the current player's claim has settled. It dismisses the
room on the current device using account-scoped local storage, rather than deleting
the shared document before an offline opponent can claim. Skill particles remain
bounded to 4–16 per turn; species control the effect and model lunge, while levels
increase particle density and glow. Reduced-motion preferences suppress particles.

New allocations use eight fields (attack, magic, defense, physicalReduction,
magicReduction, dodge, luck, health). Level 1 starts at 100 points, levels 2–9
add one point each, and levels 10–30 add two each. Existing
three-field battles remain supported. New combat sums separately mitigated physical
and magic damage; deterministic seeded rolls apply capped dodge (40%) and critical
chance (35%, 1.5x damage), each at 0.5 percentage points per allocated point.
Winner claims set the participating pet's `victoryAuraUntil` in the same profile
transaction as payment. Expiry is combat end plus one hour, independent of claim
time; timers merely render it and never extend it or write to Firestore.


### Full Rules for direct Firestore mode

Paste the complete block into Firestore Database > Rules. This mode stores pet
data in users and uses petBattles. Players can settle their results on returning
to the app. Existing petProfiles documents are owner-readable so the browser can
detect migrated accounts without creating a replacement pet.

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function owns(data, field) {
      return signedIn()
        && data.get(field, '') == request.auth.uid;
    }

    function battleParticipant(data) {
      return signedIn()
        && data.participantUids is list
        && request.auth.uid in data.participantUids;
    }

    match /users/{id} {
      allow read: if signedIn();

      allow create: if owns(request.resource.data, 'uid');

      allow update: if owns(resource.data, 'uid')
        && request.resource.data.uid == resource.data.uid;

      allow delete: if false;

      allow update: if request.auth != null
        && request.auth.uid == "M5ZnmEC8JdYbSFHN6K5rjK5YMQw1"
        && request.resource.data.attendancePet is map
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['attendancePet']);
    }

    match /petProfiles/{uid} {
      allow get: if signedIn() && request.auth.uid == uid;
      allow list, write: if false;
    }

    match /jobs/{id} {
      allow read: if signedIn();

      allow create: if signedIn()
        && request.resource.data.ownerId is string
        && request.resource.data.ownerId.size() > 0;

      allow update, delete: if signedIn()
        && (
          !('ownerId' in resource.data)
          || owns(resource.data, 'ownerId')
        );
    }

    match /sharedNotes/{noteId} {
      allow read, write: if signedIn();
    }

    match /petBattles/{battleId} {
      // Transaction tạo trận đọc ID chưa tồn tại trước khi ghi.
      // Trận đã tồn tại chỉ hai người tham gia được đọc.
      allow get: if signedIn()
        && (
          !exists(
            /databases/$(database)/documents/petBattles/$(battleId)
          )
          || battleParticipant(resource.data)
        );

      allow list: if battleParticipant(resource.data);

      allow create: if signedIn()
        && request.resource.data.version == 1
        && request.resource.data.challengerUid == request.auth.uid
        && request.resource.data.opponentUid is string
        && request.resource.data.opponentUid.size() > 0
        && request.resource.data.opponentUid != request.auth.uid
        && request.resource.data.participantUids == [
          request.auth.uid,
          request.resource.data.opponentUid
        ]
        && request.resource.data.status == 'invited'
        && request.resource.data.stakeGrams is int
        && request.resource.data.stakeGrams >= 100
        && request.resource.data.stakeGrams % 100 == 0
        && request.resource.data.players is list
        && request.resource.data.players.size() == 1
        && request.resource.data.players[0].uid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.rpsRound == 0
        && request.resource.data.commits == {}
        && request.resource.data.reveals == {}
        && request.resource.data.claims == {}
        && request.resource.data.turns == []
        && request.resource.data.maxHp == []
        && request.resource.data.winnerUid == null
        && request.resource.data.startedAt == null;

      // Giữ nguyên danh tính hai bên, mức cược và dữ liệu tạo trận.
      allow update: if battleParticipant(resource.data)
        && request.resource.data.version == resource.data.version
        && request.resource.data.challengerUid
          == resource.data.challengerUid
        && request.resource.data.opponentUid
          == resource.data.opponentUid
        && request.resource.data.participantUids
          == resource.data.participantUids
        && request.resource.data.stakeGrams
          == resource.data.stakeGrams
        && request.resource.data.createdAt
          == resource.data.createdAt
        && request.resource.data.createdMs
          == resource.data.createdMs
        && request.resource.data.expiresAt
          == resource.data.expiresAt
        && request.resource.data.status in [
          'invited',
          'ready',
          'rps',
          'fighting',
          'finished',
          'rejected',
          'cancelled',
          'expired'
        ];

      allow delete: if false;
    }

    match /notifications/{id} {
      allow read, delete: if owns(resource.data, 'userId');

      allow create: if signedIn();

      allow update: if owns(resource.data, 'userId')
        && request.resource.data.userId == resource.data.userId;
    }

    match /dayOffs/{id} {
      allow read: if signedIn();

      allow create: if owns(request.resource.data, 'userId');

      allow update: if owns(resource.data, 'userId')
        && request.resource.data.userId == resource.data.userId;

      allow delete: if owns(resource.data, 'userId');
    }

    match /jobDayOverrides/{id} {
      allow read, delete: if owns(resource.data, 'userId');

      allow create: if owns(request.resource.data, 'userId');

      allow update: if owns(resource.data, 'userId')
        && request.resource.data.userId == resource.data.userId;
    }

    match /quickJobs/{id} {
      allow read, write: if signedIn();
    }

    match /transferRequests/{id} {
      allow read, write: if signedIn();
    }

    match /quickJobTransferRequests/{id} {
      allow read, write: if signedIn();
    }

    match /workHours/{id} {
      allow read, write: if signedIn();
    }

    match /departments/{id} {
      allow read, write: if signedIn();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
