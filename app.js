// Firebase Configuration - Chỉ sử dụng Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, enableIndexedDbPersistence, query, where, writeBatch, arrayUnion, arrayRemove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8sCCoiCxm5cRJukyks0hNXRk7Quoq2HU",
    authDomain: "workpic-eb555.firebaseapp.com",
    projectId: "workpic-eb555",
    storageBucket: "workpic-eb555.firebasestorage.app",
    messagingSenderId: "828037017175",
    appId: "1:828037017175:web:9c591a375f45d0f3a4fd12",
    measurementId: "G-GYY8VECM0C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global Variables
let jobModal;
let viewJobModal;
let currentEditingJobId = null;
let jobs = [];
let filteredJobs = [];
let notificationCheckInterval;
let firestoreConnected = false;
let showSunday = true;
let sidebarVisible = true;
let pendingConfirmCallback = null;
let currentTheme = 'light';
let uiRefreshInterval = null;
let lastUiRefreshMinute = null;
let currentUser = null;
let unsubscribeJobs = null;
let authMode = 'login';
let currentViewingJobId = null;
let migrateLegacyJobsModal;
let legacyJobs = [];
let viewDataModal;
let checkDueModal;
let presenterSpinModal;
// Lịch off
let dayOffModal;
let salaryCalcModal;
let dayOffModalOpen = false;
let dayOffsList = [];            // toàn bộ lịch off (mọi user) từ tháng trước trở đi
let unsubscribeDayOffs = null;
let dayOffSelected = new Set();  // các ngày (YYYY-MM-DD) MÌNH đang chọn off
// Giờ làm việc (Motion / Station) theo ngày — dùng chung mọi user
let workHoursModal;
let workHoursModalOpen = false;
let workHoursMap = {};           // { 'YYYY-MM-DD': { date, motion, station, ... } }
let scheduleWorkHoursMap = {};
let unsubscribeWorkHours = null;
let workHoursParsed = [];        // kết quả phân tích ô dán
const WORKHOURS_COLLECTION = 'workHours';
let workHoursAll = [];           // toàn bộ document giờ làm việc (mọi bộ phận)

// Bộ phận làm việc
const DEPT_COLLECTION = 'departments';
const DEPT_ALL = '__all__';      // chỉ dùng cho bộ lọc (Quay số / Thống kê)
let departmentDocs = [];         // [{id, name}] từ collection "departments"
let departmentsList = [];        // departmentDocs + bộ phận chỉ xuất hiện ở user
let unsubscribeDepartments = null;
let spinDeptFilter = DEPT_ALL;
let statsDeptFilter = DEPT_ALL;
let workHoursViewDept = '';      // '' = chưa phân bộ phận
let spinAllUsers = [];
let owlSyncHook = null;          // do OwlFx gán; applyTheme gọi để cú xuất hiện/biến mất
let authMouse = null;            // vị trí chuột trên màn hình đăng nhập (đèn pin)
let resetCooldownTimer = null;
let dayOffDeptFilter = DEPT_ALL;
let usersDeptLatest = {};        // uid -> { dept, ts }: bộ phận SAU CÙNG (doc có updatedAt mới nhất) của mỗi người
let dayOffFocusUid = null;       // đang xem riêng lịch của user nào
let dayOffUsers = [];
let notifyLeadMinutes = 0;      // nhắc job trước N phút (0 = đúng giờ)            // danh sách user hiển thị trong form
let checkDueOldRows = null;
let checkDueNewRows = null;
let checkDueResultRows = [];

// Job Day Overrides — đổi giờ / dời ngày / note nhanh cho 1 ngày cụ thể
let jobDayOverridesList = [];
let unsubscribeJobDayOverrides = null;

// Popover tùy chỉnh ngày (chỉ khai báo 1 lần duy nhất)
let dayOverridePopoverEl = null;
let currentOverrideJob = null;    // { job, occurrenceDate }

// Avatar realtime: cache avatar mọi user từ Firestore
let usersAvatarCache = null;      // { uid: dataUrl }
let unsubscribeUsersAvatar = null; // listener realtime để thấy avatar mới của người khác

let userProfileModal;
let changePasswordConfirmModal;
let settingsModal = null;
let transferConfirmModal;
let pendingTransferJob = null;
let pendingTransferFromUser = null;
let pendingTransferRequestId = null;
let pendingTransferRequestData = null;
let currentJobIsPaused = false;
let currentTransferMode = 'transfer';
// Notification bell system
let notificationsList = [];
let unsubscribeNotifications = null;
let notifInitialLoadDone = false;
let notifDropdownOpen = false;
// Quick chat ("Job trong ngày") realtime system
let quickJobsList = [];
let unsubscribeQuickJobs = null;
let quickChatInitialLoadDone = false;
let quickChatPanelOpen = false;
let quickChatUnreadCount = 0;
let quickJobInviteModal;
let pendingQuickInviteId = null;
let pendingQuickInviteData = null;
let shownInviteKeys = {};
let guideModal;
let quickChatActiveTab = 'all';
let quickChatSearchText = '';
let quickChatStatusFilter = 'all';
let quickChatAssigneeFilter = 'all';
// Chuyển/Copy job trong ngày (quick job transfer)
let quickJobTransferConfirmModal;
let pendingQuickJobTransferId = null;
let pendingQuickJobTransferData = null;
let unsubscribeQuickJobTransferRequests = null;
let quickJobTransferRequestsList = [];
// Danh sách các yêu cầu chuyển/copy job (thường) đang chờ mình xác nhận —
// dùng để hiển thị lại trong chuông thông báo nếu người dùng lỡ miss popup.
let pendingTransferRequestsList = [];
let transferRequestsInitialLoadDone = false;
let quickJobTransferInitialLoadDone = false;

let checkEtaDirectModal = null;
let checkEtaDirectParsed = null;
let checkEtaDirectResults = [];

// Statistics
let statisticsModal = null;
let statsMode = 'today';          // 'today' | 'week'
let statsAllJobs = [];            // cache toàn bộ job active (không pause, không out-of-schedule)
let usersInfoCache = {};          // { uid: { displayName, email, avatar } }
const STATS_HIDDEN_USERS_KEY = 'workpic_stats_hidden_users';
let statsHiddenUsers = new Set();
const DEFAULT_JOB_DURATION = 30;  // phút
const WORK_HOURS_PER_DAY = 8;

// Morning digest email
const MORNING_DIGEST_STORAGE_KEY = 'workpic_morning_digest_sent';
const MORNING_DIGEST_HOURS = { from: 6, to: 10 };  // Chỉ gửi mail trong khung 6h–10h

function applyTheme(theme) {
    // Bật "chế độ tắt transition" để hàng trăm element cùng lúc
    // không animate bg/color/border khi đổi theme
    document.body.classList.add('no-theme-transition');

    currentTheme = theme;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        const label = toggleBtn.querySelector('span');
        if (theme === 'dark') {
            toggleBtn.setAttribute('aria-pressed', 'true');
            icon.className = 'bi bi-sun-fill';
            if (label) label.textContent = 'Chế độ sáng';
        } else {
            toggleBtn.setAttribute('aria-pressed', 'false');
            icon.className = 'bi bi-moon-fill';
            if (label) label.textContent = 'Chế độ tối';
        }
    }

    const authBtn = document.getElementById('authThemeBtn');
    if (authBtn) authBtn.querySelector('i').className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    if (owlSyncHook) owlSyncHook();
    if (typeof updateTorch === 'function') updateTorch();

    localStorage.setItem('workpic-theme', theme);

    // Sau 2 frame (browser đã paint xong theme mới) → trả lại transition bình thường
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('no-theme-transition');
    }));
}

// ============================================================
// TOPBAR THEME — trang trí riêng cho thanh header
// ============================================================
const TOPBAR_THEMES = [
    { id: 'default',  name: 'Mặc định',  emoji: '☀️',  desc: 'Trời sáng/tối tự nhiên' },
    { id: 'tet',      name: 'Tết',       emoji: '🌸',  desc: 'Hoa đào, câu đối, đèn lồng đỏ' },
    { id: 'trungthu', name: 'Trung Thu', emoji: '🌕',  desc: 'Trăng rằm, đèn lồng trôi' },
    { id: 'noel',     name: 'Noel',      emoji: '🎄',  desc: 'Tuyết rơi, ông già Noel chạy ngang' },
    { id: 'rain',     name: 'Mưa',       emoji: '🌧️', desc: 'Mưa rơi, mây đen, chớp' }
];
const TOPBAR_THEME_STORAGE_KEY = 'workpic-topbar-theme';
let currentTopbarTheme = 'default';

function getSavedTopbarTheme() {
    const saved = localStorage.getItem(TOPBAR_THEME_STORAGE_KEY);
    return TOPBAR_THEMES.some(t => t.id === saved) ? saved : 'default';
}

function applyTopbarTheme(themeId) {
    if (!TOPBAR_THEMES.some(t => t.id === themeId)) themeId = 'default';
    currentTopbarTheme = themeId;
    document.body.dataset.topbarTheme = themeId;
    try { localStorage.setItem(TOPBAR_THEME_STORAGE_KEY, themeId); } catch (e) { /* ignore */ }
    // Cập nhật trạng thái active trên các thẻ chủ đề (nếu modal đang mở)
    document.querySelectorAll('#themeGrid .theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === themeId);
    });
}

function renderThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;
    grid.innerHTML = TOPBAR_THEMES.map(t => `
        <button type="button" class="theme-card ${t.id === currentTopbarTheme ? 'active' : ''}" data-theme="${t.id}">
            <span class="theme-card-emoji">${t.emoji}</span>
            <span class="theme-card-name">${escapeHtml(t.name)}</span>
            <span class="theme-card-desc">${escapeHtml(t.desc)}</span>
            <span class="theme-card-check"><i class="bi bi-check-circle-fill"></i></span>
        </button>
    `).join('');
    grid.querySelectorAll('.theme-card').forEach(btn => {
        btn.addEventListener('click', () => applyTopbarTheme(btn.dataset.theme));
    });
}

function openSettingsModal() {
    if (!currentUser) return;
    document.getElementById('settingsNotifyLead').value = String(notifyLeadMinutes);
    renderThemeGrid();
    settingsModal.show();
}

function enableSkyAnimation() {
    // Bật transition cho nền topbar sau lần vẽ đầu tiên (tránh chạy animation lúc mới tải trang)
    setTimeout(() => {
        document.querySelectorAll('.topbar-sky').forEach(sky => sky.classList.add('sky-animate'));
    }, 400);
}

function initTheme() {
    // Cũng tắt transition trong lúc load theme lần đầu (tránh FOUC nhấp nháy)
    document.body.classList.add('no-theme-transition');
    const savedTheme = localStorage.getItem('workpic-theme');
    const preferredTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(preferredTheme);
    applyTopbarTheme(getSavedTopbarTheme());
    enableSkyAnimation();
}

function setAuthMode(mode) {
    authMode = mode;
    const isRegister = mode === 'register';
    const isReset = mode === 'reset';
    document.getElementById('loginTab').classList.toggle('active', mode === 'login');
    document.getElementById('registerTab').classList.toggle('active', isRegister);
    document.getElementById('authTabs').classList.toggle('d-none', isReset);
    document.getElementById('authNameLabel').classList.toggle('d-none', !isRegister);
    document.getElementById('authName').classList.toggle('d-none', !isRegister);
    document.getElementById('authName').required = isRegister;
    document.getElementById('authPasswordBlock').classList.toggle('d-none', isReset);
    document.getElementById('authPassword').required = !isReset;
    document.getElementById('authForgotBtn').classList.toggle('d-none', mode !== 'login');
    document.getElementById('authBackBtn').classList.toggle('d-none', !isReset);
    document.getElementById('authSubmitBtn').textContent =
        isReset ? 'Gửi link đặt lại mật khẩu' : (isRegister ? 'Tạo tài khoản' : 'Đăng nhập');
    document.getElementById('authSubtitle').textContent = isReset
        ? 'Nhập email đã đăng ký, hệ thống sẽ gửi link đặt lại mật khẩu về hộp thư của bạn.'
        : 'Đăng nhập để quản lý lịch công việc của bạn.';
    document.getElementById('authError').textContent = '';
    document.getElementById('authInfo').textContent = '';
    if (resetCooldownTimer) { clearInterval(resetCooldownTimer); resetCooldownTimer = null; }
    document.getElementById('authSubmitBtn').disabled = false;
    document.getElementById('authScreen').dataset.mode = mode;
    resetAuthPwUi(true);          // đổi tab KHÔNG tắt đèn pin để còn thấy cú bay
    AuthOwl.moveTo(mode);
}

function showAuthError(error) {
    const messages = {
        'auth/configuration-not-found': 'Firebase Authentication chưa được cấu hình. Hãy bật Identity Platform và phương thức Email/Password trong Firebase Console.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/email-already-in-use': 'Email này đã được đăng ký.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
        'auth/user-not-found': 'Không tìm thấy tài khoản với email này.',
        'auth/missing-email': 'Vui lòng nhập email.',
        'auth/too-many-requests': 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
        'auth/network-request-failed': 'Lỗi kết nối mạng. Kiểm tra internet rồi thử lại.'
    };
    document.getElementById('authError').textContent = messages[error.code] || 'Không thể xác thực. Vui lòng thử lại.';
}

// Gửi email đặt lại mật khẩu (Firebase Authentication tự gửi mail)
async function handlePasswordReset(email, submitButton) {
    await sendPasswordResetEmail(auth, email);
    document.getElementById('authInfo').textContent =
        `Đã gửi link đặt lại mật khẩu tới ${email}. Hãy mở hộp thư (kiểm tra cả mục Spam), bấm link rồi đặt mật khẩu mới.`;
    // chống bấm liên tục: khóa nút 30 giây
    let left = 30;
    submitButton.disabled = true;
    submitButton.textContent = `Gửi lại sau ${left}s`;
    if (resetCooldownTimer) clearInterval(resetCooldownTimer);
    resetCooldownTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearInterval(resetCooldownTimer);
            resetCooldownTimer = null;
            if (authMode === 'reset') {
                submitButton.disabled = false;
                submitButton.textContent = 'Gửi link đặt lại mật khẩu';
            }
        } else {
            submitButton.textContent = `Gửi lại sau ${left}s`;
        }
    }, 1000);
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim();
    const submitButton = document.getElementById('authSubmitBtn');
    submitButton.disabled = true;
    document.getElementById('authError').textContent = '';
    document.getElementById('authInfo').textContent = '';
    let keepDisabled = false;

    try {
        if (authMode === 'reset') {
            await handlePasswordReset(email, submitButton);
            keepDisabled = true;
            return;
        }
        if (authMode === 'register') {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await addDoc(collection(db, 'users'), {
                uid: credential.user.uid,
                email,
                displayName: name || email.split('@')[0],
                createdAt: new Date().toISOString()
            });
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        document.getElementById('authForm').reset();
        resetAuthPwUi();
    } catch (error) {
        console.error('Authentication error:', error);
        showAuthError(error);
    } finally {
        if (!keepDisabled) submitButton.disabled = false;
    }
}

// ---- Nút hiện mật khẩu: chế độ sáng = con mắt, chế độ tối = đèn pin chiếu chùm sáng chữ V theo chuột ----
function resetAuthPwUi(keepTorch = false) {
    const pw = document.getElementById('authPassword');
    const btn = document.getElementById('authPwToggle');
    const reveal = document.getElementById('authPwReveal');
    if (!pw || !btn) return;

    pw.type = 'password';
    if (reveal) {
        reveal.textContent = '';
        reveal.style.setProperty('--mx', '-2000px');
        reveal.style.setProperty('--my', '-2000px');
    }
    if (keepTorch) return;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Hiện mật khẩu');
    const tb = document.getElementById('authTorchBtn');
    if (tb) tb.setAttribute('aria-pressed', 'false');
    document.getElementById('authScreen').classList.remove('torch-on');
    AuthOwl.updateLit(null);
}

function updateTorch() {
    const pwBtn = document.getElementById('authPwToggle');
    // Chế độ "Quên mật khẩu" ẩn ô mật khẩu => dùng nút đèn pin riêng
    const btn = (pwBtn && pwBtn.offsetParent !== null) ? pwBtn : document.getElementById('authTorchBtn');
    const beam = document.getElementById('flashBeam');
    const reveal = document.getElementById('authPwReveal');
    const input = document.getElementById('authPassword');
    if (!btn || !beam) return;

    const screenOn = document.getElementById('authScreen').classList.contains('torch-on') && currentTheme === 'dark';
    if (!screenOn) { AuthOwl.updateLit(null); return; }

    const r = btn.getBoundingClientRect();
    const ox = r.left + r.width / 2;
    const oy = r.top + r.height / 2;
    const m = authMouse || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const ang = Math.atan2(m.x - ox, -(m.y - oy)) * 180 / Math.PI;
    beam.style.setProperty('--bx', ox + 'px');
    beam.style.setProperty('--by', oy + 'px');
    beam.style.setProperty('--ang', ang + 'deg');

    const torch = btn.querySelector('.pw-torch');
    if (torch) torch.style.transform = `rotate(${ang}deg)`;
    AuthOwl.updateLit({ ox, oy, ang });

    // ── Mask cho lớp reveal: vị trí chuột tính theo toạ độ của input ──
    if (reveal && input) {
        const ir = input.getBoundingClientRect();
        // Chỉ đặt mask khi chuột ở gần input (tránh mask nhảy lung tung khi chuột xa)
        const inside = m.x >= ir.left - 60 && m.x <= ir.right + 60
                    && m.y >= ir.top - 60 && m.y <= ir.bottom + 60;
        if (inside) {
            reveal.style.setProperty('--mx', (m.x - ir.left) + 'px');
            reveal.style.setProperty('--my', (m.y - ir.top) + 'px');
        } else {
            // Chuột ở xa → đẩy mask ra ngoài, password tối thui
            reveal.style.setProperty('--mx', '-2000px');
            reveal.style.setProperty('--my', '-2000px');
        }
    }
}

function initAuthExtras() {
    const screen = document.getElementById('authScreen');
    document.getElementById('authThemeBtn').addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    const pwInput = document.getElementById('authPassword');
    const pwToggle = document.getElementById('authPwToggle');

    // Đồng bộ text sang lớp reveal mỗi khi user gõ
    pwInput.addEventListener('input', updatePwReveal);
    pwInput.addEventListener('change', updatePwReveal);
    // Đồng bộ sau khi browser autofill (thường trễ vài chục ms)
    setTimeout(updatePwReveal, 300);

    function setTorch(on) {
        screen.classList.toggle('torch-on', on);
        pwToggle.setAttribute('aria-pressed', String(on));
        pwToggle.setAttribute('aria-label', on ? 'Tắt đèn pin' : 'Bật đèn pin');
        const tb = document.getElementById('authTorchBtn');
        if (tb) { tb.setAttribute('aria-pressed', String(on)); tb.setAttribute('aria-label', on ? 'Tắt đèn pin' : 'Bật đèn pin'); }
        if (on) updatePwReveal();
        updateTorch();
    }

    pwToggle.addEventListener('click', () => {
        if (currentTheme === 'dark') {
            setTorch(!screen.classList.contains('torch-on'));
        } else {
            // Chế độ sáng: toggle hiện/ẩn mật khẩu bình thường
            const show = pwInput.type === 'password';
            pwInput.type = show ? 'text' : 'password';
            pwToggle.setAttribute('aria-pressed', String(show));
            pwToggle.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        }
    });
    document.getElementById('authTorchBtn').addEventListener('click', () => {
        if (currentTheme === 'dark') setTorch(!screen.classList.contains('torch-on'));
    });
    // Đổi sang chế độ sáng => tắt đèn (cú biến mất)
    document.getElementById('authThemeBtn').addEventListener('click', () => {
        if (currentTheme !== 'dark' && screen.classList.contains('torch-on')) setTorch(false);
    });
    // Troll: gõ email ở "Quên mật khẩu" => cú nói chuyện (chỉ khi được chiếu đèn)
    document.getElementById('authEmail').addEventListener('input', () => AuthOwl.onEmailChange());

    screen.addEventListener('pointermove', (e) => {
        authMouse = { x: e.clientX, y: e.clientY };
        updateTorch();
    });
    window.addEventListener('resize', updateTorch);

    document.getElementById('authForgotBtn').addEventListener('click', () => setAuthMode('reset'));
    document.getElementById('authBackBtn').addEventListener('click', () => setAuthMode('login'));
}

// Đồng bộ value của input sang lớp reveal
function updatePwReveal() {
    const input = document.getElementById('authPassword');
    const reveal = document.getElementById('authPwReveal');
    if (!input || !reveal) return;
    reveal.textContent = input.value;
}

async function handleAuthenticatedUser(user) {
    currentUser = user;
    
    // Fetch user data from Firestore
    const userData = await getUserData(user.uid);
    
    if (userData && userData.displayName) {
        // Store displayName in currentUser for easy access
        currentUser.displayName = userData.displayName;
        currentUser.avatar = userData.avatar || null;
    } else {
        // Fallback to email-derived name or auth displayName
        currentUser.displayName = user.displayName || user.email?.split('@')[0] || 'User';
        currentUser.avatar = null;
    }
    
    // Bộ phận: user cũ chưa có field này => '' (chưa phân bộ phận), không gây lỗi
    currentUser.department = (userData && userData.department) || '';
    initDeptState();

    const savedLead = userData && userData.notifyLeadMinutes !== undefined
        ? userData.notifyLeadMinutes
        : localStorage.getItem(`notifyLead_${user.uid}`);
    notifyLeadMinutes = normalizeLeadMinutes(savedLead);
    
    document.getElementById('authScreen').classList.add('d-none');
    updateUserProfileUI();
    initializeAuthenticatedApp();
}

/**
 * Fetch user data from Firestore based on UID
 * Returns { displayName, email, uid, ... } or null if not found
 */
async function getUserData(uid) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            return userDoc.data();
        } else {
            console.warn('No user document found for UID:', uid);
            return null;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

function updateUserProfileUI() {
    if (!currentUser) return;
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    document.getElementById('userDisplayName').textContent = displayName;

    // Ưu tiên avatar từ Firestore (đồng bộ mọi thiết bị), fallback default
    const avatarSrc = currentUser.avatar
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=28`;
    document.getElementById('userAvatar').src = avatarSrc;
}

function openUserProfileModal() {
    if (!currentUser) return;
    document.getElementById('profileEmail').textContent = currentUser.email || '---';

    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || '';
    document.getElementById('profileDisplayName').value = displayName;
    fillDeptSelect(document.getElementById('profileDepartment'), currentUser.department || '', { none: true, noneLabel: '— Chưa chọn —' });
    document.getElementById('profileNewDeptRow').classList.add('d-none');

    const avatarSrc = currentUser.avatar
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=120`;
    document.getElementById('profileAvatar').src = avatarSrc;

    userProfileModal.show();
}

function resizeImageToDataUrl(file, maxSize = 200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                else { w = Math.round(w * maxSize / h); h = maxSize; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                try {
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (err) { reject(err); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function normalizeLeadMinutes(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1440) : 0;
}

async function saveNotifyLead(minutes) {
    if (!currentUser) return;
    minutes = normalizeLeadMinutes(minutes);
    notifyLeadMinutes = minutes;
    localStorage.setItem(`notifyLead_${currentUser.uid}`, String(minutes));

    // Đồng bộ giá trị cả 2 select (Profile & Settings)
    const s = document.getElementById('settingsNotifyLead');
    if (s) s.value = String(minutes);

    try {
        const snapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        if (!snapshot.empty) {
            await updateDoc(doc(db, 'users', snapshot.docs[0].id), {
                notifyLeadMinutes: minutes,
                updatedAt: new Date().toISOString()
            });
        }
        showNotification('Đã lưu', minutes > 0 ? `Bạn sẽ được nhắc job trước ${minutes} phút.` : 'Bạn sẽ được nhắc đúng giờ job.', false, 'success');
    } catch (error) {
        console.error('Lỗi lưu thời gian nhắc:', error);
        showNotification('Đã lưu trên máy này', 'Chưa đồng bộ được lên tài khoản, sẽ dùng cài đặt trên máy này.', false, 'warning');
    }
}

async function saveUserProfile() {
    const newDisplayName = document.getElementById('profileDisplayName').value.trim();
    if (!newDisplayName) {
        showNotification('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.', false, 'warning');
        return;
    }
    
    try {
        // Update Firestore
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await updateDoc(doc(db, 'users', userDoc.id), {
                displayName: newDisplayName,
                updatedAt: new Date().toISOString()
            });
        }
        
        // Update currentUser object
        currentUser.displayName = newDisplayName;
        
        // Refresh UI
        updateUserProfileUI();
        showNotification('Thành công', 'Đã cập nhật tên hiển thị!', false, 'success');
        userProfileModal.hide();
    } catch (error) {
        console.error('Lỗi cập nhật profile:', error);
        showNotification('Lỗi', 'Không thể cập nhật tên hiển thị.', false, 'danger');
    }
}

function handleChangePassword() {
    if (!currentUser) return;
    const newPw = document.getElementById('profileNewPassword').value;
    document.getElementById('changePasswordError').textContent = '';
    if (!newPw || newPw.length < 6) {
        showNotification('Thiếu thông tin', 'Mật khẩu mới cần ít nhất 6 ký tự.', false, 'warning');
        document.getElementById('profileNewPassword').focus();
        return;
    }
    document.getElementById('confirmCurrentPassword').value = '';
    changePasswordConfirmModal.show();
    setTimeout(() => document.getElementById('confirmCurrentPassword').focus(), 320);
}

async function confirmChangePassword() {
    if (!currentUser) return;
    const curPw = document.getElementById('confirmCurrentPassword').value;
    const newPw = document.getElementById('profileNewPassword').value;
    const errEl = document.getElementById('changePasswordError');
    const btn = document.getElementById('confirmChangePasswordBtn');
    errEl.textContent = '';

    if (!curPw) { errEl.textContent = 'Vui lòng nhập mật khẩu hiện tại.'; return; }
    if (!newPw || newPw.length < 6) { errEl.textContent = 'Mật khẩu mới cần ít nhất 6 ký tự.'; return; }
    if (curPw === newPw) { errEl.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại.'; return; }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Đang đổi...';
    btn.disabled = true;

    try {
        const cred = EmailAuthProvider.credential(currentUser.email, curPw);
        await reauthenticateWithCredential(currentUser, cred);
        await updatePassword(currentUser, newPw);

        showNotification('Thành công', 'Đã đổi mật khẩu. Hãy dùng mật khẩu mới cho lần đăng nhập sau.', false, 'success');
        document.getElementById('profileNewPassword').value = '';
        document.getElementById('confirmCurrentPassword').value = '';
        changePasswordConfirmModal.hide();
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        const msg = {
            'auth/wrong-password': 'Mật khẩu hiện tại không đúng.',
            'auth/invalid-credential': 'Mật khẩu hiện tại không đúng.',
            'auth/weak-password': 'Mật khẩu mới quá yếu (cần ít nhất 6 ký tự).',
            'auth/requires-recent-login': 'Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại rồi thử lại.',
            'auth/too-many-requests': 'Bạn thao tác quá nhiều lần. Vui lòng đợi vài phút.',
            'auth/network-request-failed': 'Lỗi kết nối mạng. Kiểm tra internet rồi thử lại.'
        }[error.code] || 'Không đổi được mật khẩu. Vui lòng thử lại.';
        errEl.textContent = msg;
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// Thêm function đổi avatar
async function changeAvatar(file) {
    if (!file || !currentUser) return;
    try {
        // Resize nhỏ (~15-30KB) để không vượt giới hạn 1MB của Firestore document
        const dataUrl = await resizeImageToDataUrl(file, 200, 0.8);

        // Lưu vào Firestore (mọi thiết bị / người khác đều thấy khi realtime sync)
        const snapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        if (!snapshot.empty) {
            await updateDoc(doc(db, 'users', snapshot.docs[0].id), {
                avatar: dataUrl,
                updatedAt: new Date().toISOString()
            });
        }

        currentUser.avatar = dataUrl;
        if (usersAvatarCache) usersAvatarCache[currentUser.uid] = dataUrl;

        document.getElementById('userAvatar').src = dataUrl;
        document.getElementById('profileAvatar').src = dataUrl;

        // Đồng bộ UI phụ thuộc avatar (spin, dayoff, quickchat...) nếu đang mở
        if (typeof renderSpinUsersList === 'function' && document.getElementById('spinUsersList')) {
            // chỉ vẽ lại nếu modal đang có dữ liệu
            if (spinCandidates && spinCandidates.length) renderSpinUsersList();
        }
        if (dayOffModalOpen) renderDayOffModal();

        showNotification('Thành công', 'Đã cập nhật ảnh đại diện (đồng bộ mọi thiết bị)!', false, 'success');
    } catch (error) {
        console.error('Lỗi cập nhật avatar:', error);
        showNotification('Lỗi', 'Không thể cập nhật ảnh đại diện. Ảnh quá lớn hoặc không hợp lệ.', false, 'danger');
    }
}

function handleSignedOut() {
    currentUser = null;
    try {
        [userProfileModal, jobModal, viewJobModal, dayOffModal,
         workHoursModal, salaryCalcModal, statisticsModal,
         presenterSpinModal, guideModal, viewDataModal, checkDueModal,
         transferConfirmModal, quickJobInviteModal, quickJobTransferConfirmModal,
         migrateLegacyJobsModal
        ].forEach(m => { try { m && m.hide(); } catch (_) {} });
    } catch (_) {}
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

    // ── Reset đèn pin + chuột để tránh state cũ dính lại ──
    authMouse = null;
    resetAuthPwUi();
    try { updateTorch(); } catch (_) {}
    setTimeout(() => AuthOwl.moveTo(authMode), 80);   // màn đăng nhập hiện lại => đặt cú về đúng tab

    if (unsubscribeJobs) {
        unsubscribeJobs();
        unsubscribeJobs = null;
    }
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
    }
    if (unsubscribeQuickJobs) {
        unsubscribeQuickJobs();
        unsubscribeQuickJobs = null;
    }
    if (unsubscribeQuickJobTransferRequests) {
        unsubscribeQuickJobTransferRequests();
        unsubscribeQuickJobTransferRequests = null;
    }
    if (unsubscribeDayOffs) {
        unsubscribeDayOffs();
        unsubscribeDayOffs = null;
    }
    dayOffsList = [];
    dayOffSelected = new Set();
    if (unsubscribeWorkHours) {
        unsubscribeWorkHours();
        unsubscribeWorkHours = null;
    }
    if (unsubscribeDepartments) {
        unsubscribeDepartments();
        unsubscribeDepartments = null;
    }
    departmentDocs = [];
    departmentsList = [];
    workHoursAll = [];
    workHoursMap = {};
    if (unsubscribeJobDayOverrides) {
        unsubscribeJobDayOverrides();
        unsubscribeJobDayOverrides = null;
    }
    jobDayOverridesList = [];
    currentOverrideJob = null;

    if (unsubscribeUsersAvatar) {
        unsubscribeUsersAvatar();
        unsubscribeUsersAvatar = null;
    }
    usersAvatarCache = null;

    jobs = [];
    filteredJobs = [];
    notificationsList = [];
    quickJobsList = [];
    quickChatUnreadCount = 0;
    shownInviteKeys = {};
    cachedUsersForAssign = null;
    pendingQuickInviteId = null;
    pendingQuickInviteData = null;
    pendingQuickJobTransferId = null;
    pendingQuickJobTransferData = null;
    quickJobTransferRequestsList = [];
    pendingTransferRequestsList = [];
    transferRequestsInitialLoadDone = false;
    quickJobTransferInitialLoadDone = false;
    quickChatSearchText = '';
    quickChatStatusFilter = 'all';
    quickChatAssigneeFilter = 'all';
    quickChatActiveTab = 'all';
    closeQuickChatPanel();
    document.getElementById('authScreen').classList.remove('d-none');
    renderJobList();
    renderSchedule();
    renderOutOfScheduleJobs();
}

function initializeAuthenticatedApp() {
    requestNotificationPermission();
    startUiRefreshLoop();
    testFirestoreConnection().then(() => {
        loadJobs();
        startNotificationCheck();
        listenTransferRequests();
        listenUserNotifications();
        listenQuickJobs();
        listenQuickJobTransferRequests();
        listenDayOffs();
        listenDepartments();
        listenWorkHours();
        listenJobDayOverrides();
        listenUsersAvatars();
    });
}

// Trong DOMContentLoaded event listener, THÊM CHECK NULL
document.addEventListener('DOMContentLoaded', function() {
    
   jobModal = new bootstrap.Modal(document.getElementById('jobModal'), {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    
    viewJobModal = new bootstrap.Modal(document.getElementById('viewJobModal'), {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    
    userProfileModal = new bootstrap.Modal(document.getElementById('userProfileModal'), {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    changePasswordConfirmModal = new bootstrap.Modal(document.getElementById('changePasswordConfirmModal'));
    settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    migrateLegacyJobsModal = new bootstrap.Modal(document.getElementById('migrateLegacyJobsModal'));
    viewDataModal = new bootstrap.Modal(document.getElementById('viewDataModal'));
    checkDueModal = new bootstrap.Modal(document.getElementById('checkDueModal'));
    checkEtaDirectModal = new bootstrap.Modal(document.getElementById('checkEtaDirectModal'));

    document.getElementById('checkEtaDirectBtn').addEventListener('click', openCheckEtaDirectModal);
    document.getElementById('etaDirectAnalyzeBtn').addEventListener('click', runEtaDirectAnalysis);
    document.getElementById('etaDirectClearBtn').addEventListener('click', clearEtaDirectForm);
    document.getElementById('etaDirectPaste').addEventListener('input', scheduleEtaDirectBadgeUpdate);
    initCheckEtaDirectUi();

    presenterSpinModal = new bootstrap.Modal(document.getElementById('presenterSpinModal'));
    dayOffModal = new bootstrap.Modal(document.getElementById('dayOffModal'));
    salaryCalcModal = new bootstrap.Modal(document.getElementById('salaryCalcModal'));

    document.getElementById('dayOffModal').addEventListener('hidden.bs.modal', () => { dayOffModalOpen = false; });
    transferConfirmModal = new bootstrap.Modal(document.getElementById('transferConfirmModal'));
    quickJobInviteModal = new bootstrap.Modal(document.getElementById('quickJobInviteModal'), {
        backdrop: 'static',
        keyboard: false
    });
    quickJobTransferConfirmModal = new bootstrap.Modal(document.getElementById('quickJobTransferConfirmModal'));
    guideModal = new bootstrap.Modal(document.getElementById('guideModal'));

    statisticsModal = new bootstrap.Modal(document.getElementById('statisticsModal'));
    document.getElementById('statisticsBtn').addEventListener('click', openStatisticsModal);
    initWorkHoursUi();
    initDepartmentUi();
    OwlFx.init();
    document.getElementById('salaryCalcBtn').addEventListener('click', openSalaryCalcModal);
        // Ô nhập tiền → tự chèn dấu "." ngăn cách nghìn, giữ vị trí con trỏ
        const MONEY_INPUT_IDS = ['salLCB'];
    function handleMoneyInput(e) {
        const el = e.target;
        const cursorPos = el.selectionStart;
        const beforeCursor = el.value.slice(0, cursorPos);
        const digitsBefore = beforeCursor.replace(/\D/g, '').length;

        el.value = formatMoneyInputValue(el.value);

        // Đặt lại con trỏ đúng ngay sau chữ số thứ `digitsBefore`
        let pos = 0, count = 0;
        while (pos < el.value.length && count < digitsBefore) {
            if (/\d/.test(el.value[pos])) count++;
            pos++;
        }
        try { el.setSelectionRange(pos, pos); } catch (err) { /* một số input type không hỗ trợ */ }
    }

    // === CHẶN AUTOFILL EMAIL/MẬT KHẨU VÀO Ô TÌM KIẾM ===
function stripAutofillFromSearchInputs() {
    const ids = ['searchJob', 'quickChatSearchInput', 'etaDirectSearch'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const looksLikeCredential = v =>
            /@/.test(v) ||                        // có @ → email
            /password|mật khẩu|matkhau/i.test(v) // có chữ password
        ;

        const clean = () => {
            if (looksLikeCredential(el.value)) {
                el.value = '';
                // nếu đang gõ filter, reset luôn kết quả đã lọc
                if (id === 'searchJob' && typeof filteredJobs !== 'undefined' && typeof jobs !== 'undefined') {
                    filteredJobs = jobs;
                    if (typeof renderJobList === 'function') renderJobList();
                }
                if (id === 'quickChatSearchInput' && typeof quickChatSearchText !== 'undefined') {
                    quickChatSearchText = '';
                    if (typeof renderQuickChat === 'function') renderQuickChat();
                }
            }
        };

        // Chrome autofill xong mới bắn sự kiện, nên phải check nhiều mốc thời gian
        clean();
        setTimeout(clean, 120);
        setTimeout(clean, 500);
        setTimeout(clean, 1200);
        el.addEventListener('animationstart', clean); // Chrome trigger autofill qua animation
        el.addEventListener('change', clean);
    });
}

document.addEventListener('DOMContentLoaded', stripAutofillFromSearchInputs);
window.addEventListener('pageshow', stripAutofillFromSearchInputs);

    document.getElementById('salaryCalcModal').addEventListener('input', (e) => {
        if (MONEY_INPUT_IDS.includes(e.target.id)) {
            handleMoneyInput(e);
            updateSalaryTotals();
            return;
        }
        if (e.target.classList.contains('salary-input') || e.target.classList.contains('salary-count-input')) {
            updateSalaryTotals();
        }
    });

    // Khi rời ô tiền → format lại lần cuối (đề phòng user paste chuỗi lộn xộn)
    document.getElementById('salaryCalcModal').addEventListener('blur', (e) => {
        if (MONEY_INPUT_IDS.includes(e.target.id)) {
            e.target.value = formatMoneyInputValue(e.target.value);
            updateSalaryTotals();
        }
    }, true);

    document.getElementById('salaryCalcModal').addEventListener('hidden.bs.modal', resetSalaryCalc);
    document.querySelectorAll('.stats-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.stats-mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            statsMode = tab.dataset.mode;
            renderStatistics();
        });
    });

    initQuickChatUi();
    initLayoutDropdown();

    // Event Listeners
    document.getElementById('addJobBtn').addEventListener('click', () => openAddJobModal(false));
    document.getElementById('addOutOfScheduleBtn').addEventListener('click', () => openAddJobModal(true));
    document.getElementById('saveJobBtn').addEventListener('click', saveJob);
    document.getElementById('deleteJobBtn').addEventListener('click', deleteJob);
    
    const textColorInput = document.getElementById('textColor');
    textColorInput.addEventListener('input', changeTextColor);
    textColorInput.addEventListener('change', changeTextColor);
    
    const highlightColorInput = document.getElementById('highlightColor');
    highlightColorInput.addEventListener('input', applyHighlightColor);
    highlightColorInput.addEventListener('change', applyHighlightColor);
    
    document.getElementById('searchJob').addEventListener('input', handleSearch);
    document.getElementById('isOutOfSchedule').addEventListener('change', toggleOutOfScheduleFields);
    document.getElementById('jobType').addEventListener('change', toggleDailyExcludeWrap);
    document.getElementById('dailyExcludeDays').addEventListener('click', (e) => {
        const chip = e.target.closest('.daily-exclude-chip');
        if (chip) chip.classList.toggle('active');
    });
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('showSunday').addEventListener('change', toggleSunday);
    document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
    
    initAuthExtras();
    AuthOwl.init();
    document.getElementById('loginTab').addEventListener('click', () => setAuthMode('login'));
    document.getElementById('registerTab').addEventListener('click', () => setAuthMode('register'));
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        // Ẩn modal trước để Bootstrap dọn backdrop + body.modal-open
        userProfileModal.hide();
        // Chờ Bootstrap chạy xong hiệu ứng đóng
        await new Promise(r => setTimeout(r, 200));
    } catch (e) { /* modal chưa init thì bỏ qua */ }
    try { await signOut(auth); } catch (e) { console.error(e); }
    });
    document.getElementById('confirmMigrateLegacyJobsBtn').addEventListener('click', migrateLegacyJobs);
    document.getElementById('viewDataBtn').addEventListener('click', openViewDataModal);
    document.getElementById('checkDueBtn').addEventListener('click', openCheckDueModal);
    document.getElementById('presenterSpinBtn').addEventListener('click', openPresenterSpinModal);
    document.getElementById('spinNowBtn').addEventListener('click', spinPresenterWheel);
    document.getElementById('dayOffBtn').addEventListener('click', openDayOffModal);
    document.getElementById('saveDayOffBtn').addEventListener('click', saveDayOffs);
    document.getElementById('dayOffCalendars').addEventListener('click', handleDayOffCalendarClick);
    document.getElementById('dayOffUsersList').addEventListener('click', handleDayOffUserClick);
    document.getElementById('dayOffDetailList').addEventListener('click', handleDayOffDetailClick);
    document.getElementById('dayOffReasonPresets').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-reason]');
        if (btn) document.getElementById('dayOffReason').value = btn.dataset.reason;
    });
    document.getElementById('confirmSpinBtn').addEventListener('click', confirmPresenterAssignment);
    document.getElementById('checkDueCompareBtn').addEventListener('click', runCheckDueCompare);
    document.getElementById('checkDueClearBtn').addEventListener('click', clearCheckDueForm);
    document.getElementById('checkDueCopyBtn').addEventListener('click', copyCheckDueResult);
    document.getElementById('checkDueOldFile').addEventListener('change', (e) => handleCheckDueFile(e, 'old'));
    document.getElementById('checkDueNewFile').addEventListener('change', (e) => handleCheckDueFile(e, 'new'));
    // Live update badge số dòng khi dán dữ liệu
    document.getElementById('checkDueOldPaste').addEventListener('input', scheduleCheckDuePasteBadgeUpdate);
    document.getElementById('checkDueNewPaste').addEventListener('input', scheduleCheckDuePasteBadgeUpdate);
    
    document.getElementById('confirmCancelBtn').addEventListener('click', hideConfirmModal);
    document.getElementById('confirmModal').addEventListener('click', (event) => {
        if (event.target.id === 'confirmModal') {
            hideConfirmModal();
        }
    });
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
        if (typeof pendingConfirmCallback === 'function') {
            const callback = pendingConfirmCallback;
            pendingConfirmCallback = null;
            hideConfirmModal();
            callback();
        } else {
            hideConfirmModal();
        }
    });

    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('settingsNotifyLead').addEventListener('change', (e) => saveNotifyLead(e.target.value));

    document.getElementById('userProfileBtn').addEventListener('click', openUserProfileModal);
    document.getElementById('saveProfileBtn').addEventListener('click', saveUserProfile);
    document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
    document.getElementById('confirmChangePasswordBtn').addEventListener('click', confirmChangePassword);
    document.getElementById('confirmCurrentPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmChangePassword(); }
    });
    document.getElementById('userProfileModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('changePasswordError').textContent = '';
    });
    document.getElementById('changeAvatarBtn').addEventListener('click', () => {
        document.getElementById('avatarFileInput').click();
    });
    document.getElementById('avatarFileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            changeAvatar(e.target.files[0]);
        }
        e.target.value = '';
    });
    
    // Transfer confirmation
    document.getElementById('transferAcceptBtn').addEventListener('click', acceptTransfer);
    document.getElementById('transferRejectBtn').addEventListener('click', rejectTransfer);

    // Quick job (job trong ngày) transfer/copy confirmation
    document.getElementById('quickJobTransferAcceptBtn').addEventListener('click', acceptQuickJobTransfer);
    document.getElementById('quickJobTransferRejectBtn').addEventListener('click', rejectQuickJobTransfer);

    // Danh sách "Chờ bạn xác nhận" trong chuông thông báo - bấm "Xem lại" để mở lại modal
    document.getElementById('notifPendingList').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-review-type]');
        if (!btn) return;
        const type = btn.dataset.reviewType;
        const id = btn.dataset.reviewId;
        notifDropdownOpen = false;
        document.getElementById('notifDropdown').classList.remove('show');

        if (type === 'transfer') {
            const request = pendingTransferRequestsList.find(r => r.id === id);
            if (request) showTransferConfirmModal(request.id, request);
        } else if (type === 'quickjob_invite') {
            const job = quickJobsList.find(j => j.id === id);
            if (job) showQuickInviteModal(job);
        } else if (type === 'quickjob_transfer') {
            const request = quickJobTransferRequestsList.find(r => r.id === id);
            if (request) showQuickJobTransferConfirmModal(request.id, request);
        }
    });

    document.getElementById('pauseJobBtn').addEventListener('click', togglePauseJob);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideConfirmModal();
        }
    });
    
    initTheme();
    loadSidebarState();
    onAuthStateChanged(auth, user => user ? handleAuthenticatedUser(user) : handleSignedOut());
});


function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('📢 Notification permission:', permission);
                if (permission === 'granted') {
                    showNotification('Thông báo đã bật', 'Bạn sẽ nhận được thông báo desktop khi đến giờ làm job!');
                    
                } else if (permission === 'denied') {
                    console.warn('⚠️ Người dùng từ chối thông báo desktop');
                }
            });
        } else if (Notification.permission === 'granted') {
        } else {
            console.warn('❌ Notification permission bị từ chối');
        }
    } else {
        console.warn('❌ Browser không hỗ trợ Notifications API');
    }
}

function toggleDailyExcludeWrap() {
    const type = document.getElementById('jobType').value;
    const wrap = document.getElementById('dailyExcludeWrap');
    if (wrap) wrap.classList.toggle('d-none', type !== 'daily');
}

function getExcludedWeekdaysFromForm() {
    return Array.from(document.querySelectorAll('#dailyExcludeDays .daily-exclude-chip:not(.active)'))
        .map(chip => parseInt(chip.dataset.dow, 10));
}

function setExcludedWeekdaysInForm(excludedWeekdays) {
    const excluded = new Set(Array.isArray(excludedWeekdays) ? excludedWeekdays : []);
    document.querySelectorAll('#dailyExcludeDays .daily-exclude-chip').forEach(chip => {
        const dow = parseInt(chip.dataset.dow, 10);
        chip.classList.toggle('active', !excluded.has(dow));
    });
}

function toggleOutOfScheduleFields() {
    const isOutOfSchedule = document.getElementById('isOutOfSchedule').checked;
    const scheduleFields = document.getElementById('scheduleFields');
    const jobTitle = document.getElementById('jobTitle');

    if (scheduleFields) {
        scheduleFields.classList.toggle('d-none', isOutOfSchedule);
    }

    if (jobTitle) {
        jobTitle.placeholder = isOutOfSchedule ? 'Nhập tiêu đề job phát sinh...' : 'Nhập tiêu đề job...';
    }
}

// Format text in editor
window.formatText = function(command) {
    document.execCommand(command, false, null);
    document.getElementById('jobDescription').focus();
};

function changeTextColor() {
    const color = document.getElementById('textColor').value;
    const editor = document.getElementById('jobDescription');
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();

        if (selectedText) {
            document.execCommand('foreColor', false, color);
            editor.focus();
            return;
        }
    }

    document.execCommand('foreColor', false, color);
    editor.focus();
}

window.applyHighlightColor = function() {
    const color = document.getElementById('highlightColor').value;
    document.execCommand('hiliteColor', false, color);
    document.getElementById('jobDescription').focus();
};

// Xóa màu nền đã tô cho phần văn bản đang bôi đen (hoặc toàn bộ nếu không chọn gì)
window.removeHighlightColor = function() {
    const editor = document.getElementById('jobDescription');
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        // Không bôi đen gì: chọn hết nội dung để xóa màu nền toàn bộ
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    document.execCommand('hiliteColor', false, 'transparent');
    editor.focus();
};

window.insertTable = function() {
    const editor = document.getElementById('jobDescription');
    const selection = window.getSelection();
    const selectedText = selection && selection.rangeCount > 0 ? selection.toString().trim() : '';

    if (!selectedText) {
        alert('⚠️ Vui lòng bôi đen đoạn văn bản cần chuyển thành bảng trước khi dùng chức năng này!');
        editor.focus();
        return;
    }

    const rows = selectedText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (rows.length === 0) {
        alert('⚠️ Vui lòng bôi đen đoạn văn bản có nội dung trước khi dùng chức năng này!');
        editor.focus();
        return;
    }

    const parseCells = (row) => {
        const byPipe = row.split('|').map(cell => cell.trim()).filter(Boolean);
        if (byPipe.length > 1) return byPipe;

        const byTab = row.split('\t').map(cell => cell.trim()).filter(Boolean);
        if (byTab.length > 1) return byTab;

        return [row];
    };

    const tableHtml = `
        <table style="border-collapse: collapse; width: auto; margin: 0.5rem 0; table-layout: auto;">
            ${rows.map(row => {
                const safeCells = parseCells(row);
                return `<tr>${safeCells.map(cell => `<td style="border: 1px solid #dee2e6; padding: 0.25rem 0.5rem; white-space: nowrap; font-size: 0.95em;">${cell}</td>`).join('')}</tr>`;
            }).join('')}
        </table>
    `;

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createRange().createContextualFragment(tableHtml));
    } else {
        editor.focus();
        document.execCommand('insertHTML', false, tableHtml);
    }

    selection && selection.removeAllRanges();
    editor.focus();
};

// Toggle Sunday Display
function toggleSunday(e) {
    showSunday = e.target.checked;
    renderSchedule();
}

// Handle Search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredJobs = jobs;
    } else {
        filteredJobs = jobs.filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            (job.description && job.description.toLowerCase().includes(searchTerm))
        );
    }
    
    renderJobList();
}

// Export to PDF - Enhanced Version (EXCLUDE PAUSED JOBS)
async function exportToPDF() {
    const activeJobs = jobs.filter(job =>
        currentUser &&
        job.ownerId === currentUser.uid &&
        job.isPaused !== true &&
        job.isOutOfSchedule !== true
    ).sort((firstJob, secondJob) => {
        const weekdayDifference = getWeekdayIndex(firstJob.date) - getWeekdayIndex(secondJob.date);
        if (weekdayDifference !== 0) return weekdayDifference;
        return String(firstJob.time || '').localeCompare(String(secondJob.time || ''));
    });
    
    if (activeJobs.length === 0) {
        alert('📋 Không có job đang hoạt động để xuất PDF!');
        return;
    }

    try {
        // Show loading
        const exportBtn = document.getElementById('exportPdfBtn');
        const originalHTML = exportBtn.innerHTML;
        exportBtn.innerHTML = '<span class="loading"></span> Đang xuất...';
        exportBtn.disabled = true;

        // Access jsPDF from window object
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Colors
        const primaryColor = [102, 126, 234];
        const headerColor = [67, 97, 238];
        const textColor = [33, 33, 33];
        const lightGray = [245, 245, 245];

        // Page dimensions
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // Header Background
        pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.rect(0, 0, pageWidth, 45, 'F');

        // Title
        pdf.setFontSize(28);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DANH SACH JOB', pageWidth / 2, 20, { align: 'center' });
        
        // Subtitle
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        const today = new Date();
        pdf.text(`Ngay xuat: ${formatDateVN(today)}`, pageWidth / 2, 30, { align: 'center' });
        
        // Total jobs (ACTIVE ONLY)
        pdf.setFontSize(10);
        pdf.text(`Tong so: ${activeJobs.length} jobs dang hoat dong`, pageWidth / 2, 38, { align: 'center' });

        // Table start position
        let yPos = 55;

        // Table header
        const headerHeight = 12;
        pdf.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
        pdf.rect(margin, yPos, contentWidth, headerHeight, 'F');
        
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        
        const colWidths = {
            stt: 15,
            title: 85,
            type: 40,
            time: 30
        };
        
        pdf.text('STT', margin + 5, yPos + 8);
        pdf.text('Tieu de', margin + colWidths.stt + 5, yPos + 8);
        pdf.text('Loai Job', margin + colWidths.stt + colWidths.title + 5, yPos + 8);
        pdf.text('Gio thuc hien', margin + colWidths.stt + colWidths.title + colWidths.type + 5, yPos + 8);

        yPos += headerHeight + 2;

        // Table content (ONLY ACTIVE JOBS)
        pdf.setFont('helvetica', 'normal');
        const rowHeight = 10;
        
        // Type colors
        const typeColors = {
            daily: [255, 107, 107],
            weekly: [78, 205, 196],
            biweekly: [69, 183, 209],
            monthly: [247, 183, 49],
        };

        activeJobs.forEach((job, index) => {
            // Check if need new page
            if (yPos > pageHeight - 30) {
                pdf.addPage();
                yPos = 20;
            }

            // Row background (alternating colors)
            if (index % 2 === 0) {
                pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                pdf.rect(margin, yPos - 2, contentWidth, rowHeight, 'F');
            }

            // Row border
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(margin, yPos - 2, contentWidth, rowHeight, 'S');

            // STT
            pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
            pdf.setFontSize(10);
            pdf.text((index + 1).toString(), margin + 5, yPos + 5);
            
            // Title (with truncation)
            let title = job.title;
            if (title.length > 45) {
                title = title.substring(0, 42) + '...';
            }
            pdf.text(title, margin + colWidths.stt + 5, yPos + 5);
            
            // Job type with color badge
            const typeColor = typeColors[job.type] || [150, 150, 150];
            const typeX = margin + colWidths.stt + colWidths.title + 5;
            
            // Type badge background
            pdf.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
            const typeLabels = {
                daily: 'Daily',
                weekly: 'Weekly',
                biweekly: 'Biweekly',
                monthly: 'Monthly',
            };
            const typeLabel = typeLabels[job.type] || job.type;
            const badgeWidth = pdf.getTextWidth(typeLabel) + 6;
            pdf.roundedRect(typeX, yPos + 1, badgeWidth, 6, 2, 2, 'F');
            
            // Type text
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text(typeLabel, typeX + 3, yPos + 5);
            
            // Time
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
            pdf.setFontSize(10);
            const timeX = margin + colWidths.stt + colWidths.title + colWidths.type + 5;
            pdf.text(job.time, timeX, yPos + 5);

            yPos += rowHeight;
        });

        // Footer on all pages
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            
            // Footer line
            pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            pdf.setLineWidth(0.5);
            pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
            
            // Footer text
            pdf.setFontSize(9);
            pdf.setTextColor(120, 120, 120);
            pdf.setFont('helvetica', 'italic');
            pdf.text(
                `Trang ${i} / ${pageCount}`,
                pageWidth / 2,
                pageHeight - 12,
                { align: 'center' }
            );
            
            // Generated by
            pdf.setFontSize(8);
            pdf.text(
                'Job Schedule Manager',
                pageWidth / 2,
                pageHeight - 7,
                { align: 'center' }
            );
        }

        // Save PDF
        const fileName = `Job_Schedule_${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}.pdf`;
        pdf.save(fileName);

        // Reset button
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;

        showNotification('Thành công', `Đã xuất ${activeJobs.length} jobs đang hoạt động ra file PDF!`);
    } catch (error) {
        console.error('Lỗi khi xuất PDF:', error);
        alert('❌ Có lỗi xảy ra khi xuất PDF: ' + error.message);
        
        const exportBtn = document.getElementById('exportPdfBtn');
        exportBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> <span>Xuất PDF</span>';
        exportBtn.disabled = false;
    }
}


// Helper function for Vietnamese date format
function formatDateVN(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Test Firestore Connection
async function testFirestoreConnection() {
    try {
        if (!currentUser) return false;
        const testCollection = query(collection(db, 'jobs'), where('ownerId', '==', currentUser.uid));
        const snapshot = await getDocs(testCollection);
        
        firestoreConnected = true;
        //console.log(`📊 Số lượng jobs hiện tại: ${snapshot.size}`);
        
        //showNotification('Kết nối thành công', `Đã kết nối với Firestore. Tìm thấy ${snapshot.size} jobs.`);
        return true;
    } catch (error) {
        firestoreConnected = false;
        console.error('❌ Lỗi kết nối Firestore:', error);
        
        if (error.code === 'permission-denied') {
            alert(`❌ LỖI FIRESTORE PERMISSIONS!\n\nVui lòng cập nhật Security Rules trong Firebase Console.`);
        }
        return false;
    }
}

// Load Jobs from Firestore
function loadJobs() {
    if (!firestoreConnected || !currentUser) {
        console.warn('⚠️ Chưa kết nối Firestore');
        return;
    }
    
    const jobsCollection = query(collection(db, 'jobs'), where('ownerId', '==', currentUser.uid));
    
    if (unsubscribeJobs) unsubscribeJobs();
    unsubscribeJobs = onSnapshot(jobsCollection, 
        (snapshot) => {
            jobs = [];
            snapshot.forEach((doc) => {
                const job = {
                    id: doc.id,
                    ...doc.data()
                };
                if (!job.ownerId || job.ownerId === currentUser.uid) jobs.push(job);
            });
            
            // Sắp xếp theo ngày tạo
            jobs.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            
            filteredJobs = jobs;
            renderJobList();
            renderSchedule();
            renderOutOfScheduleJobs();
        }, 
        (error) => {
            console.error('❌ Lỗi khi lắng nghe Firestore:', error);
            showNotification('Lỗi', 'Không thể tải dữ liệu từ Firestore!');
        }
    );
}

// Calculate job occurrences based on type (with Sunday check)
function getJobOccurrences(job, startDate, endDate) {
    const occurrences = [];
    const jobStartDate = parseJobDate(job.date);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Job "once": chỉ xuất hiện đúng 1 lần vào ngày đã định, không lặp lại
    if (job.type === 'once') {
        if (jobStartDate >= start && jobStartDate <= end) {
            const isSunday = jobStartDate.getDay() === 0;
            const workOnSunday = job.workOnSunday !== false;
            if (!isSunday || workOnSunday) occurrences.push(new Date(jobStartDate));
        }
        return occurrences;
    }

    let currentDate = new Date(jobStartDate);
    
    // Đảm bảo không bắt đầu trước ngày start
    if (currentDate < start) {
        currentDate = new Date(start);
        
        // Điều chỉnh currentDate để khớp với pattern của job
        if (job.type === 'weekly') {
            const jobDay = jobStartDate.getDay();
            const currentDay = currentDate.getDay();
            const diff = jobDay - currentDay;
            currentDate.setDate(currentDate.getDate() + (diff >= 0 ? diff : 7 + diff));
        }
    }
    
    while (currentDate <= end) {
        if (currentDate >= jobStartDate) {
            // Check if workOnSunday is false and current day is Sunday (0)
            const isSunday = currentDate.getDay() === 0;
            const workOnSunday = job.workOnSunday !== false; // Default true if not specified
            // Daily job có thể bỏ bớt một vài thứ trong tuần (mặc định chạy tất cả)
            const isExcludedWeekday = job.type === 'daily' && Array.isArray(job.excludedWeekdays) &&
                job.excludedWeekdays.includes(currentDate.getDay());

            if (!isExcludedWeekday && (!isSunday || workOnSunday)) {
                occurrences.push(new Date(currentDate));
            }
        }
        
        // Tính ngày tiếp theo dựa trên loại job
        switch (job.type) {
            case 'daily':
                currentDate.setDate(currentDate.getDate() + 1);
                break;
            case 'weekly':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'biweekly':
                currentDate.setDate(currentDate.getDate() + 14);
                break;
            case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            default:
                return occurrences;
        }
    }
    
    return occurrences;
}

// Render Job List (Với trạng thái tạm dừng)
function renderJobList() {
    const jobListContainer = document.getElementById('jobList');
    jobListContainer.innerHTML = '';
    
    if (filteredJobs.length === 0) {
        jobListContainer.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><br>Không tìm thấy job nào</div>';
        return;
    }
    
    filteredJobs.forEach(job => {
        if (job.type === 'once') return;
        const jobItem = document.createElement('div');
        jobItem.className = `job-item ${job.type}${job.isPaused ? ' paused' : ''}`;
        jobItem.innerHTML = `
            <h6>
                <i class="bi bi-check2-circle"></i> ${job.title}
                ${job.isPaused ? '<span class="paused-badge">⏸</span>' : ''}
            </h6>
            <div class="job-item-info">
                <small>
                    <i class="bi bi-calendar"></i> ${formatDate(job.date)} - 
                    <i class="bi bi-clock"></i> ${job.time}
                </small>
                <button class="btn btn-edit btn-sm">
                    <i class="bi bi-pencil"></i> Sửa
                </button>
            </div>
        `;
        
        // Edit button
        jobItem.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditJobModal(job);
        });
        
        jobListContainer.appendChild(jobItem);
    });
}

function renderOutOfScheduleJobs() {
    const container = document.getElementById('outOfScheduleList');
    if (!container) return;

    const outOfScheduleJobs = jobs.filter(job => job.isOutOfSchedule === true);

    if (outOfScheduleJobs.length === 0) {
        container.innerHTML = '<div class="empty-state empty-state-sm"><i class="bi bi-lightning-charge"></i><br>Chưa có job ngoài lịch nào</div>';
        return;
    }

    container.innerHTML = '';

    outOfScheduleJobs.forEach(job => {
        const card = document.createElement('div');
        card.className = `out-of-schedule-card ${job.isPaused ? 'paused' : ''}`;
        card.innerHTML = `
            <div class="out-of-schedule-card-title" title="${job.title}">${job.title}</div>
        `;

        card.addEventListener('click', () => openViewJobModal(job));
        container.appendChild(card);
    });
}

async function toggleOutOfScheduleJob(job) {
    try {
        const jobRef = doc(db, 'jobs', job.id);
        await updateDoc(jobRef, {
            isPaused: !job.isPaused,
            updatedAt: new Date().toISOString()
        });
        showNotification(job.isPaused ? 'Đã bật lại job' : 'Đã dừng job', job.isPaused ? `Job "${job.title}" đã được bật lại.` : `Job "${job.title}" đã được dừng.` , false, job.isPaused ? 'success' : 'warning');
    } catch (error) {
        console.error('❌ Lỗi khi đổi trạng thái job ngoài lịch:', error);
        showNotification('Lỗi', 'Không thể đổi trạng thái job.', false, 'danger');
    }
}

// Render Schedule Calendar (2 tuần tới) - FIXED PAST/TODAY/FUTURE LOGIC
function renderSchedule() {
    const scheduleBody = document.getElementById('scheduleBody');
    const scheduleHeader = document.getElementById('scheduleHeader');
    
    scheduleBody.innerHTML = '';
    scheduleHeader.innerHTML = '';
    
    // Tính khoảng thời gian: Hôm nay - 2 tuần sau
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get current time for comparison (giờ:phút hiện tại)
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Bắt đầu từ thứ 2 tuần này
    const startDate = new Date(today);
    const startDay = startDate.getDay();
    const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + diffToMonday);
    
    // 2 tuần
    const totalWeeks = 2;
    
    // Tạo header dựa trên showSunday
    const daysOfWeek = showSunday 
        ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
        : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    daysOfWeek.forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        scheduleHeader.appendChild(th);
    });
    
    // Only include active (non-paused) jobs that belong to the fixed schedule
    const activeJobs = jobs.filter(job => job.isPaused !== true && job.isOutOfSchedule !== true);

    // Map ngày -> [{ job, shiftedFrom }]. Job rơi vào ngày off của mình sẽ được dời lên ngày làm việc liền trước.
    const rangeEnd = new Date(startDate);
    rangeEnd.setDate(rangeEnd.getDate() + (totalWeeks * 7) - 1);
    const jobsByDate = buildScheduleEntries(startDate, rangeEnd, activeJobs);
    const myOffMap = getMyOffMap();
    
    // Render các tuần
    const daysToShow = showSunday ? 7 : 6;
    
    for (let week = 0; week < totalWeeks; week++) {
        const row = document.createElement('tr');
        
        for (let day = 0; day < daysToShow; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const cell = document.createElement('td');
            const dateStr = localDateKey(currentDate);
            
            // Normalize dates for comparison (set to midnight)
            const cellDate = new Date(currentDate);
            cellDate.setHours(0, 0, 0, 0);
            
            const todayDate = new Date(today);
            todayDate.setHours(0, 0, 0, 0);
            
            const offDoc = myOffMap[dateStr] || null;
            
            // Ngày off: tô sọc đỏ; ngày thường: highlight hôm nay
            if (offDoc) {
                cell.classList.add('day-off-cell');
            }
            if (cellDate.getTime() === todayDate.getTime()) {
                cell.classList.add('today-cell');
            }
            
            // Date header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header text-muted small';
            // MỚI — luôn theo bộ phận của chính mình, không phụ thuộc bộ lọc trong modal
                const whDoc = scheduleWorkHoursMap[dateStr] || null;
const myDeptId = (currentUser && currentUser.department) || '';
const myDeptLabel = myDeptId ? escapeHtml(getDeptName(myDeptId)) : '';
const badges = [];
if (whDoc) {
    if (isValidWhNumber(whDoc.motion)) {
        badges.push(`<span class="wh-badge wh-m" title="Giờ Motion${myDeptLabel ? ' · ' + myDeptLabel : ''}">M-${formatWorkHours(whDoc.motion)}h</span>`);
    }
    if (isValidWhNumber(whDoc.station)) {
        badges.push(`<span class="wh-badge wh-s" title="Giờ Station${myDeptLabel ? ' · ' + myDeptLabel : ''}">S-${formatWorkHours(whDoc.station)}h</span>`);
    }
}
const whBadge = badges.length ? `<span class="wh-badges">${badges.join('')}</span>` : '';
            dateHeader.innerHTML = `<span class="date-header-left"><i class="bi bi-calendar-day"></i> ${formatDateShort(currentDate)}${offDoc ? '<span class="day-off-badge">OFF</span>' : ''}</span>${whBadge}`;
            cell.appendChild(dateHeader);

                        // ===== KÉO-THẢ: ô ngày nhận drop =====
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cell.classList.add('drag-over');
            });
            cell.addEventListener('dragleave', (e) => {
                if (!cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
            });
            cell.addEventListener('drop', async (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                try {
                    const raw = e.dataTransfer.getData('text/plain') || '{}';
                    const data = JSON.parse(raw);
                    if (!data.jobId || !data.originDate) return;
                    await moveJobToDate(data.jobId, data.originDate, dateStr);
                } catch (err) {
                    console.error('Lỗi drop job:', err);
                }
            });
            // ===== HẾT KÉO-THẢ =====

            if (offDoc) {
                const offNote = document.createElement('div');
                offNote.className = 'day-off-note';
                offNote.title = offDoc.reason || '';
                offNote.innerHTML = `<i class="bi bi-calendar-x-fill"></i> ${escapeHtml(offDoc.reason || 'Nghỉ')}`;
                cell.appendChild(offNote);
            }
            
            // Add jobs for this date - SORTED BY TIME
            let dayJobs = jobsByDate[dateStr] || [];
            
            // Sort jobs by time (HH:MM)
            dayJobs.sort((a, b) => {
                // Job dời từ ngày off sang luôn nằm cuối ngày
                const shiftDiff = (a.shiftedFrom ? 1 : 0) - (b.shiftedFrom ? 1 : 0);
                if (shiftDiff !== 0) return shiftDiff;
                const timeA = a.job.time || '00:00';
                const timeB = b.job.time || '00:00';
                return timeA.localeCompare(timeB);
            });
            
            if (dayJobs.length === 0 && offDoc) {
                // Ngày off và không có job dời sang: không cần hiện dấu '-'
            } else if (dayJobs.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'text-muted small text-center';
                emptyMsg.style.opacity = '0.4';
                emptyMsg.style.fontSize = '0.7rem';
                emptyMsg.textContent = '-';
                cell.appendChild(emptyMsg);
            } else {
                dayJobs.forEach(entry => {
    const job = entry.job;
    let timeClass = 'future';

    if (cellDate < todayDate) {
        timeClass = 'past';
    } else if (cellDate.getTime() === todayDate.getTime()) {
        const [jobHours, jobMinutes] = String(entry.overrideTime || job.time).split(':').map(Number);
        if (jobHours < currentHours ||
            (jobHours === currentHours && jobMinutes < currentMinutes)) {
            timeClass = 'past';
        } else {
            timeClass = 'today';
        }
    } else {
        timeClass = 'future';
    }

    const displayTime = entry.overrideTime || job.time;
    const isShifted = !!entry.shiftedFrom;
    const isMoved = !!entry.movedFrom;
    const isPresenter = job.isPresenterJob === true;
    const hasOverride = !!(entry.overrideTime || entry.note || entry.movedFrom);

    const extraClasses = [];
    if (isShifted || isMoved) extraClasses.push('shifted');
    if (isPresenter) extraClasses.push('presenter');

    const scheduleItem = document.createElement('div');
    scheduleItem.className = `schedule-item ${job.type} ${timeClass} ${extraClasses.join(' ')}`.trim();

    const timeHtml = entry.overrideTime
        ? `<small class="schedule-time-override"><i class="bi bi-clock-fill"></i> ${displayTime} <em>(đổi)</em></small>`
        : `<small><i class="bi bi-clock-fill"></i> ${displayTime}</small>`;

    let originTagHtml = '';
    if (isShifted) {
        originTagHtml = `<small class="shifted-tag" title="Job của ngày ${formatDateShortDMY(entry.shiftedFrom)} (bạn off) được dời lên trước"><i class="bi bi-arrow-return-left"></i> dời từ ${formatDateShortDMY(entry.shiftedFrom)}</small>`;
    } else if (isMoved) {
        originTagHtml = `<small class="shifted-tag" title="Job được dời từ ngày ${formatDateShortDMY(entry.movedFrom)}"><i class="bi bi-arrow-right"></i> dời từ ${formatDateShortDMY(entry.movedFrom)}</small>`;
    }

    const noteHtml = entry.note
        ? `<span class="schedule-note" title="${escapeHtml(entry.note)}"><i class="bi bi-sticky-fill"></i> ${escapeHtml(entry.note.length > 40 ? entry.note.substring(0, 40) + '…' : entry.note)}</span>`
        : '';

    scheduleItem.innerHTML = `
        <h6 title="${job.title}">
            <i class="bi bi-clipboard-check"></i> ${job.title}
        </h6>
        <div class="schedule-time-line">
            ${timeHtml}
            <button type="button" class="schedule-override-btn ${hasOverride ? 'has-override' : ''}"
                title="Tùy chỉnh ngày này (đổi giờ / dời ngày / ghi chú)"
                data-job-id="${job.id}"
                data-origin-date="${entry.originDate}">
                <i class="bi bi-sliders"></i>
            </button>
        </div>
        ${originTagHtml}
        ${noteHtml}
    `;

        // ===== KÉO-THẢ: cho phép kéo item =====
    scheduleItem.setAttribute('draggable', 'true');
    scheduleItem.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            jobId: job.id,
            originDate: entry.originDate,
            jobTitle: job.title
        }));
        scheduleItem.classList.add('dragging');
    });
    scheduleItem.addEventListener('dragend', () => {
        scheduleItem.classList.remove('dragging');
        document.querySelectorAll('.schedule-table td.drag-over').forEach(td => td.classList.remove('drag-over'));
    });
    // ===== HẾT KÉO-THẢ =====

    // Click vào nội dung item → mở xem job đầy đủ (không mở override nữa)
    scheduleItem.addEventListener('click', (e) => {
        if (e.target.closest('.schedule-override-btn')) return;
        openViewJobModal(job);
    });

    // Nút tùy chỉnh kế giờ → mở popover
    scheduleItem.querySelector('.schedule-override-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openDayOverridePopover(job, entry.originDate, e.currentTarget);
    });

    cell.appendChild(scheduleItem);
});
            }
            
            row.appendChild(cell);
        }
        
        scheduleBody.appendChild(row);
    }
}

// ============================================================
// KÉO-THẢ JOB — lưu override ngày cho lần xuất hiện của job
// ============================================================
async function moveJobToDate(jobId, originDate, targetDate) {
    if (!currentUser) return;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const docId = `${currentUser.uid}_${jobId}_${originDate}`;
    const existing = getOverrideFor(jobId, originDate);

        // ----- Trường hợp 1: kéo về CHÍNH ngày gốc -----
    // → chỉ xóa overrideDate (giữ nguyên overrideTime/note nếu có)
    if (originDate === targetDate) {
        if (!existing) return;   // chưa có override → không làm gì
        const keepTime = existing.overrideTime || null;
        const keepNote = existing.note || null;
        try {
            if (!keepTime && !keepNote) {
                await deleteDoc(doc(db, 'jobDayOverrides', docId));
            } else {
                await setDoc(doc(db, 'jobDayOverrides', docId), {
                    userId: currentUser.uid,
                    jobId,
                    occurrenceDate: originDate,
                    overrideTime: keepTime,
                    overrideDate: null,
                    note: keepNote,
                    updatedAt: new Date().toISOString()
                });
            }
            showNotification(
                'Đã trả về',
                `"${job.title}" trở về ngày ${formatDateShortDMY(originDate)}`,
                false, 'success'
            );
        } catch (error) {
            console.error('Lỗi trả job về ngày gốc:', error);
            showNotification('Lỗi', 'Không thể trả job về ngày gốc.', false, 'danger');
        }
        return;
    }

    // ----- Trường hợp 2: kéo sang ngày khác -----
    // → tạo / cập nhật override, giữ nguyên giờ gốc (chỉ ngày thay đổi)
    try {
        await setDoc(doc(db, 'jobDayOverrides', docId), {
            userId: currentUser.uid,
            jobId,
            occurrenceDate: originDate,
            overrideTime: existing?.overrideTime || null,
            overrideDate: targetDate,
            note: existing?.note || null,
            updatedAt: new Date().toISOString()
        });
        showNotification(
            'Đã dời job',
            `"${job.title}" → ${formatDateShortDMY(targetDate)} (chỉ lần này)`,
            false, 'success'
        );
    } catch (error) {
        console.error('Lỗi dời job:', error);
        showNotification('Lỗi', 'Không thể dời job. Vui lòng thử lại.', false, 'danger');
    }
}

// ============================================================
// DAY OVERRIDE POPOVER — đổi giờ / dời ngày / note nhanh cho 1 ngày
// ============================================================

function closeDayOverridePopover() {
    if (dayOverridePopoverEl) {
        dayOverridePopoverEl.remove();
        dayOverridePopoverEl = null;
    }
    currentOverrideJob = null;
}

function openDayOverridePopover(job, occurrenceDate, anchorEl) {
    closeDayOverridePopover();
    currentOverrideJob = { job, occurrenceDate };

    const existing = getOverrideFor(job.id, occurrenceDate);
    const pop = document.createElement('div');
    pop.className = 'day-override-popover';
    pop.innerHTML = `
        <div class="pop-title">
            <i class="bi bi-sliders text-primary"></i> Tùy chỉnh ngày này
        </div>
        <div class="pop-job-name">
            <strong>${escapeHtml(job.title)}</strong><br>
            <span class="text-muted">Ngày ${formatDateShortDMY(occurrenceDate)} · Giờ gốc ${escapeHtml(job.time || '—')}</span>
        </div>

        <label class="form-label fw-bold" for="dopTime"><i class="bi bi-clock-fill"></i> Đổi giờ (chỉ ngày này)</label>
        <input type="time" class="form-control mb-2" id="dopTime" value="${existing?.overrideTime || ''}">

        <label class="form-label fw-bold" for="dopDate"><i class="bi bi-calendar-event-fill"></i> Dời sang ngày khác (chỉ lần này)</label>
        <input type="date" class="form-control mb-2" id="dopDate" value="${existing?.overrideDate || ''}">

        <label class="form-label fw-bold" for="dopNote"><i class="bi bi-sticky-fill text-warning"></i> Ghi chú nhanh</label>
        <textarea class="form-control" id="dopNote" rows="2" maxlength="300" placeholder="VD: Chuyển ca chiều...">${escapeHtml(existing?.note || '')}</textarea>

        <div class="pop-actions">
            ${existing ? `<button type="button" class="btn btn-delete" id="dopDelete"><i class="bi bi-trash-fill"></i> Xóa</button>` : ''}
            <button type="button" class="btn btn-cancel ms-auto" id="dopCancel">Hủy</button>
            <button type="button" class="btn btn-save" id="dopSave"><i class="bi bi-check-circle-fill"></i> Lưu</button>
        </div>
    `;

    // Đặt popover cạnh nút, tính toán để không tràn màn hình
    document.body.appendChild(pop);
    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top;
    if (left + popRect.width > window.innerWidth - 8) left = rect.left - popRect.width - 8;
    if (left < 8) left = 8;
    if (top + popRect.height > window.innerHeight - 8) top = window.innerHeight - popRect.height - 8;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.position = 'fixed';

    dayOverridePopoverEl = pop;

    pop.querySelector('#dopCancel').addEventListener('click', closeDayOverridePopover);
    pop.querySelector('#dopSave').addEventListener('click', saveDayOverrideFromPopover);
    const delBtn = pop.querySelector('#dopDelete');
    if (delBtn) delBtn.addEventListener('click', deleteDayOverrideFromPopover);

    // Click ngoài popover → đóng
    setTimeout(() => {
        document.addEventListener('click', _outsideClickClosePopover, { capture: true });
    }, 0);
}

function _outsideClickClosePopover(e) {
    if (!dayOverridePopoverEl) return;
    if (dayOverridePopoverEl.contains(e.target)) return;
    if (e.target.closest('.schedule-override-btn')) return;
    closeDayOverridePopover();
    document.removeEventListener('click', _outsideClickClosePopover, { capture: true });
}

async function saveDayOverrideFromPopover() {
    if (!currentOverrideJob || !currentUser) return;
    const { job, occurrenceDate } = currentOverrideJob;
    const overrideTime = document.getElementById('dopTime').value.trim() || null;
    const overrideDate = document.getElementById('dopDate').value.trim() || null;
    const note = document.getElementById('dopNote').value.trim() || null;

    const btn = document.getElementById('dopSave');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span>';
    btn.disabled = true;

    try {
        const docId = `${currentUser.uid}_${job.id}_${occurrenceDate}`;

        if (!overrideTime && !overrideDate && !note) {
            await deleteDoc(doc(db, 'jobDayOverrides', docId));
        } else {
            await setDoc(doc(db, 'jobDayOverrides', docId), {
                userId: currentUser.uid,
                jobId: job.id,
                occurrenceDate,
                overrideTime,
                overrideDate,
                note,
                updatedAt: new Date().toISOString()
            });
        }

        closeDayOverridePopover();
        showNotification('Đã lưu', 'Tùy chỉnh chỉ áp dụng cho ngày này.', false, 'success');
    } catch (error) {
        console.error('Lỗi lưu tùy chỉnh ngày:', error);
        showNotification('Lỗi', 'Không thể lưu tùy chỉnh. Vui lòng thử lại.', false, 'danger');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function deleteDayOverrideFromPopover() {
    if (!currentOverrideJob || !currentUser) return;
    const { job, occurrenceDate } = currentOverrideJob;
    const docId = `${currentUser.uid}_${job.id}_${occurrenceDate}`;
    try {
        await deleteDoc(doc(db, 'jobDayOverrides', docId));
        closeDayOverridePopover();
        showNotification('Đã xóa tùy chỉnh', 'Job đã trở về lịch cố định của ngày đó.', false, 'success');
    } catch (error) {
        console.error('Lỗi xóa tùy chỉnh:', error);
        showNotification('Lỗi', 'Không thể xóa tùy chỉnh.', false, 'danger');
    }
}

// Đóng popover khi resize / scroll (tránh lệch vị trí)
window.addEventListener('resize', closeDayOverridePopover);
window.addEventListener('scroll', closeDayOverridePopover, true);

function updateTransferMode() {
    const modeTransfer = document.getElementById('transferModeTransfer');
    const modeCopy = document.getElementById('transferModeCopy');
    const btnText = document.getElementById('transferJobBtnText');
    const btn = document.getElementById('transferJobBtn');
    
    if (modeTransfer && modeTransfer.checked) {
        currentTransferMode = 'transfer';
        btnText.textContent = 'Chuyển';
        btn.className = 'btn btn-primary';
        btn.querySelector('i').className = 'bi bi-send-fill';
    } else if (modeCopy && modeCopy.checked) {
        currentTransferMode = 'copy';
        btnText.textContent = 'Copy';
        btn.className = 'btn btn-success';
        btn.querySelector('i').className = 'bi bi-copy';
    }
}

window.toggleTransferSection = function() {
    const section = document.getElementById('transferSection');
    const btn = document.getElementById('toggleTransferSectionBtn');
    
    if (section) {
        const isVisible = section.classList.contains('show');
        
        if (isVisible) {
            section.classList.remove('show');
            btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> Chuyển/Copy Job';
        } else {
            section.classList.add('show');
            btn.innerHTML = '<i class="bi bi-x-circle"></i> Đóng phần chuyển/copy';
        }
    }
};

// Sửa function openViewJobModal
function openViewJobModal(job) {
    currentViewingJobId = job.id;
    currentTransferMode = 'transfer';
    
    document.getElementById('viewModalTitle').innerHTML = `
        <i class="bi bi-eye-fill"></i> ${job.title}
        ${job.isPaused ? '<span class="paused-indicator"><i class="bi bi-pause-circle-fill"></i> Đang tạm dừng</span>' : ''}
    `;
    
    const modalBody = document.getElementById('viewModalBody');
    modalBody.innerHTML = `
        <div class="mb-3">
            <strong><i class="bi bi-tag-fill"></i> Loại:</strong> 
            <span class="badge bg-${getTypeBadgeColor(job.type)} ms-2">${getTypeLabel(job.type)}</span>
        </div>
        <div class="mb-3">
            <strong><i class="bi bi-calendar-event"></i> Ngày bắt đầu:</strong> 
            <span class="ms-2">${formatDate(job.date)}</span>
        </div>
        <div class="mb-3">
            <strong><i class="bi bi-clock"></i> Giờ:</strong> 
            <span class="ms-2">${job.time}</span>
        </div>
                <div class="mb-3">
            <strong><i class="bi bi-hourglass-split"></i> Thời gian thực hiện:</strong> 
            <span class="ms-2">${getJobDuration(job)} phút</span>
        </div>
        ${job.isPaused ? `
        <div class="mb-3">
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle-fill"></i> 
                <strong>Job này đang bị tạm dừng</strong> và sẽ không xuất hiện trong thông báo hoặc báo cáo.
            </div>
        </div>
        ` : ''}
        <div class="mb-3">
            <strong><i class="bi bi-file-text"></i> Nội dung:</strong>
            <div class="view-job-content mt-2">
                ${job.description || '<em class="text-muted">Không có nội dung</em>'}
            </div>
        </div>
        
        <!-- Transfer Section - Hidden by default -->
        <div class="transfer-section" id="transferSection">
            <div class="transfer-section-header">
                <h6><i class="bi bi-arrow-left-right"></i> Chuyển/Copy Job</h6>
                <button type="button" class="transfer-section-close" onclick="toggleTransferSection()">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            
            <div class="mb-3">
                <label class="form-label fw-bold" for="transferUserSelect">
                    <i class="bi bi-person-check-fill"></i> Chọn user nhận job
                </label>
                <select class="form-select" id="transferUserSelect">
                    <option value="">Chọn user nhận job...</option>
                </select>
            </div>
            
            <div class="mb-3">
                <label class="form-label fw-bold">Chọn hành động:</label>
                <div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="transferMode" id="transferModeTransfer" value="transfer" checked>
                        <label class="form-check-label" for="transferModeTransfer">
                            <i class="bi bi-arrow-right-circle-fill text-primary"></i> Chuyển job
                        </label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="transferMode" id="transferModeCopy" value="copy">
                        <label class="form-check-label" for="transferModeCopy">
                            <i class="bi bi-copy text-success"></i> Copy job
                        </label>
                    </div>
                </div>
                <small class="form-text text-muted d-block mt-2">
                    <i class="bi bi-info-circle"></i> 
                    <strong>Chuyển:</strong> Job sẽ không còn ở bạn. 
                    <strong>Copy:</strong> Job vẫn ở bạn và user kia.
                </small>
            </div>
            
            <div class="d-grid gap-2">
                <button type="button" class="btn btn-primary" id="transferJobBtn">
                    <i class="bi bi-send-fill"></i> <span id="transferJobBtnText">Chuyển</span>
                </button>
            </div>
        </div>
    `;
    
    // Show toggle button
    const toggleBtn = document.getElementById('toggleTransferSectionBtn');
    toggleBtn.style.display = 'inline-block';
    
    // Add event listeners
    toggleBtn.onclick = toggleTransferSection;
    
    const transferBtn = document.getElementById('transferJobBtn');
    const transferModeTransfer = document.getElementById('transferModeTransfer');
    const transferModeCopy = document.getElementById('transferModeCopy');
    
    if (transferBtn) transferBtn.addEventListener('click', transferJob);
    if (transferModeTransfer) transferModeTransfer.addEventListener('change', updateTransferMode);
    if (transferModeCopy) transferModeCopy.addEventListener('change', updateTransferMode);
    
    loadTransferUsers();
    viewJobModal.show();
}

document.getElementById('viewJobModal').addEventListener('hidden.bs.modal', function () {
    const section = document.getElementById('transferSection');
    const btn = document.getElementById('toggleTransferSectionBtn');
    
    if (section) section.classList.remove('show');
    if (btn) {
        btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> Chuyển/Copy Job';
        btn.style.display = 'none';
    }
    
    currentViewingJobId = null;
});

async function loadTransferUsers() {
    const select = document.getElementById('transferUserSelect');
    if (!select || !currentUser) return;
    select.innerHTML = '<option value="">Đang tải user...</option>';
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.uid && user.uid !== currentUser.uid) users.push(user);
        });
        select.innerHTML = users.length
            ? '<option value="">Chọn user nhận job...</option>'
            : '<option value="">Chưa có user khác</option>';
        users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.uid;
            option.textContent = user.displayName ? `${user.displayName} (${user.email})` : user.email;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Lỗi tải danh sách user:', error);
        select.innerHTML = '<option value="">Không tải được danh sách user</option>';
    }
}

async function openViewDataModal() {
    const usersContainer = document.getElementById('usersViewList');
    const jobsContainer = document.getElementById('activeJobsViewList');
    usersContainer.innerHTML = '<p class="text-muted">Đang tải danh sách user...</p>';
    jobsContainer.innerHTML = '<p class="text-muted">Đang tải job...</p>';
    viewDataModal.show();

    const activeJobs = jobs.filter(job =>
        currentUser &&
        job.ownerId === currentUser.uid &&
        job.isPaused !== true &&
        job.isOutOfSchedule !== true
    ).sort((firstJob, secondJob) => {
        const weekdayDifference = getWeekdayIndex(firstJob.date) - getWeekdayIndex(secondJob.date);
        if (weekdayDifference !== 0) return weekdayDifference;
        return String(firstJob.time || '').localeCompare(String(secondJob.time || ''));
    });

    if (activeJobs.length === 0) {
        jobsContainer.innerHTML = '<p class="text-muted">Không có job đang thực hiện.</p>';
    } else {
        jobsContainer.innerHTML = `
            <table class="table table-sm table-bordered align-middle">
                <thead><tr><th>Tiêu đề</th><th>Loại</th><th>Thứ thực hiện</th><th>Giờ</th></tr></thead>
                <tbody>${activeJobs.map(job => `
                    <tr>
                        <td>${escapeHtml(job.title)}</td>
                        <td><span class="job-type-label ${escapeHtml(job.type)}">${escapeHtml(getTypeLabel(job.type))}</span></td>
                        <td>${escapeHtml(getWeekdayLabel(job.date))}</td>
                        <td>${escapeHtml(job.time || '-')}</td>
                    </tr>`).join('')}</tbody>
            </table>`;
    }

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        usersSnapshot.forEach(userDoc => users.push(userDoc.data()));
        // Chỉ hiển thị user đang đăng nhập (currentUser), ẩn các user khác
        // để tránh danh sách user dài đẩy phần "Job đang thực hiện" xuống dưới.
        const loggedInUsers = users.filter(user => user.uid === currentUser.uid);
        loggedInUsers.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
        usersContainer.innerHTML = loggedInUsers.length
            ? `<table class="table table-sm table-bordered align-middle">
                <thead><tr><th>Tên</th><th>Email</th><th>Trạng thái</th></tr></thead>
                <tbody>${loggedInUsers.map(user => `
                    <tr>
                        <td>${escapeHtml(user.displayName || '-')}</td>
                        <td>${escapeHtml(user.email || '-')}</td>
                        <td><span class="badge bg-success">Đang đăng nhập</span></td>
                    </tr>`).join('')}</tbody>
            </table>`
            : '<p class="text-muted">Không có user nào đang đăng nhập.</p>';
    } catch (error) {
        console.error('Lỗi tải danh sách user:', error);
        usersContainer.innerHTML = '<p class="text-danger">Không thể tải danh sách user. Kiểm tra Firestore Rules.</p>';
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}

// ============================================================
// Check Change Due (chuyển đổi từ macro VBA CompareFGMO)
// Nhận diện cột thông minh theo NỘI DUNG dữ liệu, không phụ thuộc
// tên cột hay thứ tự cột (vì 2 nguồn dữ liệu có thể đặt tên/khác thứ tự):
//   - FG_MO: bắt đầu bằng "MX" hoặc "MY"
//   - FG_DUE: dạng "1yymmdd" (7 số, bắt đầu bằng 1)
//   - FG_JOBNO: phần còn lại, dạng "LINE MSS" (vd "S226 093026"),
//     chỉ phần LINE (token đầu tiên) được dùng để so sánh.
// ============================================================

const CHECK_DUE_MO_REGEX = /^(MX|MY)/i;
const CHECK_DUE_DUE_REGEX = /^1\d{6}(\.0)?$/;

function openCheckDueModal() {
    checkDueModal.show();
    updateCheckDueStep(checkDueResultRows.length ? 3 : 1);
    if (!document.getElementById('checkDueStatus').textContent.trim()) {
        updateCheckDueStatus('Sẵn sàng so sánh');
    }
}

function clearCheckDueForm() {
    document.getElementById('checkDueOldPaste').value = '';
    document.getElementById('checkDueNewPaste').value = '';
    document.getElementById('checkDueOldFile').value = '';
    document.getElementById('checkDueNewFile').value = '';

    ['checkDueOldFileInfo', 'checkDueNewFileInfo'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = 'Chưa chọn file';
        el.classList.remove('has-file');
    });

    checkDueOldRows = null;
    checkDueNewRows = null;
    checkDueResultRows = [];

    setCheckDueSourceBadge('old', 0);
    setCheckDueSourceBadge('new', 0);

    document.getElementById('checkDueLoading').style.display = 'none';
    document.getElementById('checkDueResultTable').classList.remove('check-due-result-animate');
    document.getElementById('checkDueResultSection').style.display = 'none';

    updateCheckDueStep(1);
    updateCheckDueStatus('Sẵn sàng so sánh');
}

function updateCheckDueStatus(message) {
    const el = document.getElementById('checkDueStatus');
    if (!el) return;
    const text = message || '';
    el.innerHTML = text
        ? `<i class="bi bi-info-circle"></i> ${escapeHtml(text)}`
        : `<i class="bi bi-info-circle"></i> Sẵn sàng so sánh`;
}

function updateCheckDueStep(step) {
    document.querySelectorAll('#checkDueSteps .check-due-step').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.step) === step);
    });
}

function setCheckDueSourceBadge(which, count) {
    const ids = which === 'old'
        ? ['checkDueOldPasteBadge', 'checkDueOldFileBadge']
        : ['checkDueNewPasteBadge', 'checkDueNewFileBadge'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = count > 0 ? `${count} dòng` : '0 dòng';
        el.classList.toggle('has-data', count > 0);
    });
}

let checkDueBadgeTimer = null;
function scheduleCheckDuePasteBadgeUpdate() {
    clearTimeout(checkDueBadgeTimer);
    checkDueBadgeTimer = setTimeout(() => {
        const oldText = document.getElementById('checkDueOldPaste').value;
        const newText = document.getElementById('checkDueNewPaste').value;
        setCheckDueSourceBadge('old', oldText.trim() ? parsePastedRows(oldText).length : 0);
        setCheckDueSourceBadge('new', newText.trim() ? parsePastedRows(newText).length : 0);
    }, 180);
}

/**
 * Giống VBA FormatDue: chuyển chuỗi "1yymmdd" (7 ký tự) -> "mm/dd/yy".
 * Nếu không đúng format thì trả nguyên chuỗi gốc.
 */
function formatDue(dueStr) {
    const value = String(dueStr ?? '').trim().replace(/\.0$/, '');
    if (/^1\d{6}$/.test(value)) {
        const yy = value.substring(1, 3);
        const mm = value.substring(3, 5);
        const dd = value.substring(5, 7);
        return `${mm}/${dd}/${yy}`;
    }
    return value;
}

/**
 * Tách phần LINE (token đầu tiên) khỏi cell "LINE MSS" (vd "S226 093026" -> "S226").
 */
function extractLineCode(jobnoCell) {
    const text = String(jobnoCell ?? '').trim();
    if (!text) return '';
    return text.split(/\s+/)[0] || '';
}

/**
 * Nhận diện 1 dòng dữ liệu (mảng các ô/token, thứ tự bất kỳ) thành
 * { FG_MO, FG_DUE, FG_JOBNO } dựa theo NỘI DUNG, không dựa theo vị trí cột.
 * Trả về null nếu dòng không chứa FG_MO hợp lệ (vd dòng header, dòng trống).
 */
function classifyRowTokens(rawTokens) {
    const tokens = (rawTokens || [])
        .map(cell => String(cell ?? '').trim())
        .filter(cell => cell !== '');
    if (tokens.length === 0) return null;

    let moToken = null;
    let dueToken = null;
    const rest = [];

    tokens.forEach(token => {
        if (moToken === null && CHECK_DUE_MO_REGEX.test(token)) {
            moToken = token;
            return;
        }
        if (dueToken === null && CHECK_DUE_DUE_REGEX.test(token)) {
            dueToken = token;
            return;
        }
        rest.push(token);
    });

    if (!moToken) return null; // không có FG_MO -> không phải dòng dữ liệu hợp lệ (bỏ qua, kể cả header)

    return {
        FG_MO: moToken.toUpperCase(),
        FG_DUE: dueToken || '',
        FG_JOBNO: rest.join(' ').trim()
    };
}

/**
 * Tách 1 dòng text thành các ô: ưu tiên Tab, sau đó dấu phẩy,
 * cuối cùng là 2+ khoảng trắng liên tiếp (giữ nguyên khoảng trắng đơn
 * bên trong ô "LINE MSS").
 */
function splitDelimitedLine(line) {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(',')) return line.split(',');
    return line.split(/\s{2,}/);
}

/**
 * Parse dữ liệu dạng bảng copy/paste (Tab/phẩy/khoảng trắng kép cách cột),
 * tự nhận diện cột theo nội dung, không quan tâm thứ tự cột hay tên header.
 */
function parsePastedRows(text) {
    const lines = String(text || '')
        .split(/\r\n|\r|\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const rows = [];
    lines.forEach(line => {
        const row = classifyRowTokens(splitDelimitedLine(line));
        if (row) rows.push(row);
    });
    return rows;
}

/**
 * Chuẩn hoá mảng 2 chiều (từ CSV hoặc SheetJS) thành { FG_MO, FG_DUE, FG_JOBNO }[],
 * tự nhận diện cột theo nội dung (bỏ qua dòng header tự động vì header
 * không khớp pattern FG_MO/FG_DUE).
 */
function normalizeMatrixRows(matrix) {
    if (!matrix || matrix.length === 0) return [];
    const rows = [];
    matrix.forEach(cols => {
        const row = classifyRowTokens(cols);
        if (row) rows.push(row);
    });
    return rows;
}

function parseCsvText(text) {
    return String(text || '')
        .split(/\r\n|\r|\n/)
        .filter(line => line.trim().length > 0)
        .map(line => splitDelimitedLine(line));
}

/**
 * Tên sheet gợi ý cho dữ liệu Ban_dau / CanDoi, dùng để tự nhận diện
 * khi 1 file Excel chứa sẵn cả 2 sheet.
 */
const CHECK_DUE_OLD_SHEET_HINTS = ['ban_dau', 'bandau', 'ban dau', 'old', 'cu', 'cũ', 'truoc', 'trước'];
const CHECK_DUE_NEW_SHEET_HINTS = ['can_doi', 'candoi', 'can doi', 'cần đổi', 'new', 'moi', 'mới', 'sau'];

function guessSheetRole(sheetName) {
    const name = sheetName.toLowerCase();
    if (CHECK_DUE_OLD_SHEET_HINTS.some(hint => name.includes(hint))) return 'old';
    if (CHECK_DUE_NEW_SHEET_HINTS.some(hint => name.includes(hint))) return 'new';
    return null;
}

function sheetToRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    return normalizeMatrixRows(matrix);
}

/**
 * Đọc 1 file (.csv hoặc .xlsx) một cách "thông minh":
 * - CSV / 1 sheet: trả { old: rows, new: null } (chỉ điền vào bên đang upload).
 * - Excel nhiều sheet: nếu nhận diện được sheet nào là Ban_dau/CanDoi theo tên,
 *   hoặc chỉ có đúng 2 sheet, sẽ trả về CẢ HAI { old: rows, new: rows } luôn,
 *   không cần upload thêm file thứ 2.
 */
function readTableFileSmart(file) {
    return new Promise((resolve, reject) => {
        const isCsv = /\.(csv|txt|prn)$/i.test(file.name);
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Không đọc được file'));

        if (isCsv) {
            reader.onload = () => {
                try {
                    const rows = normalizeMatrixRows(parseCsvText(reader.result));
                    resolve({ old: rows, new: null, sheets: 1 });
                } catch (err) { reject(err); }
            };
            reader.readAsText(file, 'UTF-8');
            return;
        }

        reader.onload = () => {
            try {
                const workbook = XLSX.read(reader.result, { type: 'array' });
                const sheetNames = workbook.SheetNames;

                if (sheetNames.length >= 2) {
                    let oldSheet = sheetNames.find(name => guessSheetRole(name) === 'old');
                    let newSheet = sheetNames.find(name => guessSheetRole(name) === 'new');
                    // Không nhận diện được theo tên -> nếu đúng 2 sheet thì lấy theo thứ tự (sheet 1 = Ban_dau, sheet 2 = CanDoi)
                    if ((!oldSheet || !newSheet) && sheetNames.length === 2) {
                        oldSheet = oldSheet || sheetNames[0];
                        newSheet = newSheet || sheetNames.find(name => name !== oldSheet) || sheetNames[1];
                    }
                    if (oldSheet && newSheet && oldSheet !== newSheet) {
                        resolve({
                            old: sheetToRows(workbook, oldSheet),
                            new: sheetToRows(workbook, newSheet),
                            sheets: sheetNames.length,
                            oldSheetName: oldSheet,
                            newSheetName: newSheet
                        });
                        return;
                    }
                }

                // Chỉ 1 sheet hoặc không tách được 2 vai trò -> đọc sheet đầu tiên, điền cho bên đang upload
                const rows = sheetToRows(workbook, sheetNames[0]);
                resolve({ old: rows, new: null, sheets: sheetNames.length });
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function handleCheckDueFile(event, which) {
    const file = event.target.files && event.target.files[0];
    const infoEl = document.getElementById(which === 'old' ? 'checkDueOldFileInfo' : 'checkDueNewFileInfo');
    if (!file) {
        infoEl.textContent = 'Chưa chọn file';
        infoEl.classList.remove('has-file');
        return;
    }
    infoEl.textContent = `Đang đọc "${file.name}"...`;
    infoEl.classList.remove('has-file');

    try {
        const parsed = await readTableFileSmart(file);

        if (parsed.new) {
            // File tự chứa cả 2 sheet
            checkDueOldRows = parsed.old;
            checkDueNewRows = parsed.new;

            infoEl.textContent = `✓ "${file.name}" · sheet "${parsed.oldSheetName}" = Ban_dau`;
            infoEl.classList.add('has-file');

            const otherInfoEl = document.getElementById(which === 'old' ? 'checkDueNewFileInfo' : 'checkDueOldFileInfo');
            otherInfoEl.textContent = `✓ "${file.name}" · sheet "${parsed.newSheetName}" = CanDoi`;
            otherInfoEl.classList.add('has-file');

            setCheckDueSourceBadge('old', parsed.old.length);
            setCheckDueSourceBadge('new', parsed.new.length);
        } else {
            if (which === 'old') checkDueOldRows = parsed.old;
            else checkDueNewRows = parsed.old;

            infoEl.textContent = `✓ "${file.name}" · ${parsed.old.length} dòng`;
            infoEl.classList.add('has-file');
            setCheckDueSourceBadge(which, parsed.old.length);
        }

        updateCheckDueStatus(`Đã đọc file "${file.name}".`);
    } catch (error) {
        console.error('Lỗi đọc file Check Due:', error);
        infoEl.textContent = `✕ Không đọc được "${file.name}". Kiểm tra lại định dạng.`;
        infoEl.classList.remove('has-file');
    }
}

/**
 * Giữ nguyên logic macro CompareFGMO, nhưng nhận diện LINE thông minh (extractLineCode)
 * thay vì cắt cứng 4 ký tự:
 * - So khớp theo FG_MO (duy nhất).
 * - Bỏ qua nếu FG_MO không có trong CanDoi.
 * - So DUE và LINE: nếu cả 2 không đổi (hoặc CanDoi rỗng) -> bỏ qua dòng đó.
 */
function compareFGMO(oldRows, newRows) {
    const dict = new Map();
    newRows.forEach(row => {
        const key = row.FG_MO;
        if (!key) return;
        dict.set(key, {
            due: String(row.FG_DUE || '').trim(),
            line: extractLineCode(row.FG_JOBNO)
        });
    });

    const results = [];
    oldRows.forEach(row => {
        const key = row.FG_MO;
        if (!key || !dict.has(key)) return; // không có trong CanDoi -> bỏ qua

        const oldDue = String(row.FG_DUE || '').trim();
        const oldLine = extractLineCode(row.FG_JOBNO);
        const target = dict.get(key);

        const resJob = (oldLine === target.line || !target.line) ? '-' : target.line;
        const resDue = (oldDue === target.due || !target.due) ? '-' : formatDue(target.due);

        if (!(resJob === '-' && resDue === '-')) {
            results.push({ FG_MO: key, FG_JOBNO: resJob, FG_DUE: resDue });
        }
    });
    return results;
}

function getCheckDueInputRows() {
    const isFileTabActive = document.getElementById('checkDueFileTab').classList.contains('active');
    if (isFileTabActive) {
        return { oldRows: checkDueOldRows, newRows: checkDueNewRows };
    }
    const oldText = document.getElementById('checkDueOldPaste').value;
    const newText = document.getElementById('checkDueNewPaste').value;
    return {
        oldRows: parsePastedRows(oldText),
        newRows: parsePastedRows(newText)
    };
}

function runCheckDueCompare() {
    const { oldRows, newRows } = getCheckDueInputRows();

    if (!oldRows || oldRows.length === 0 || !newRows || newRows.length === 0) {
        updateCheckDueStatus('Vui lòng nhập/tải đầy đủ dữ liệu Ban_dau và CanDoi trước khi so sánh.');
        updateCheckDueStep(1);
        return;
    }

    const compareBtn = document.getElementById('checkDueCompareBtn');
    const loadingEl = document.getElementById('checkDueLoading');
    const section = document.getElementById('checkDueResultSection');
    const tableContainer = document.getElementById('checkDueResultTable');

    compareBtn.disabled = true;
    section.style.display = 'none';
    tableContainer.innerHTML = '';
    tableContainer.classList.remove('check-due-result-animate');

    updateCheckDueStep(2);
    loadingEl.style.display = 'flex';
    updateCheckDueStatus('Đang so sánh dữ liệu...');

    setTimeout(() => {
        checkDueResultRows = compareFGMO(oldRows, newRows);
        loadingEl.style.display = 'none';
        renderCheckDueResult();
        updateCheckDueStep(3);

        tableContainer.classList.remove('check-due-result-animate');
        void tableContainer.offsetWidth;
        tableContainer.classList.add('check-due-result-animate');

        compareBtn.disabled = false;
        updateCheckDueStatus(`Ban_dau: ${oldRows.length} dòng · CanDoi: ${newRows.length} dòng · ${checkDueResultRows.length} thay đổi`);
    }, 650);
}

function renderCheckDueResult() {
    const section = document.getElementById('checkDueResultSection');
    const countEl = document.getElementById('checkDueResultCount');
    const statTotal = document.getElementById('checkDueStatTotal');
    const statLine = document.getElementById('checkDueStatLine');
    const statDue = document.getElementById('checkDueStatDue');
    const tableContainer = document.getElementById('checkDueResultTable');

    section.style.display = '';
    countEl.textContent = checkDueResultRows.length;

    const lineChanges = checkDueResultRows.filter(r => r.FG_JOBNO !== '-').length;
    const dueChanges = checkDueResultRows.filter(r => r.FG_DUE !== '-').length;
    statTotal.textContent = checkDueResultRows.length;
    statLine.textContent = lineChanges;
    statDue.textContent = dueChanges;

    if (checkDueResultRows.length === 0) {
        tableContainer.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-check2-circle" style="font-size:2rem;color:#16a34a;"></i>
                <p class="mt-2 mb-0">Không có thay đổi nào giữa Ban_dau và CanDoi.</p>
            </div>`;
        return;
    }

    tableContainer.innerHTML = `
        <table class="table table-sm align-middle mb-0">
            <thead>
                <tr>
                    <th style="width:28%;">FG_MO</th>
                    <th style="width:36%;">FG_JOBNO</th>
                    <th style="width:36%;">FG_DUE</th>
                </tr>
            </thead>
            <tbody>
                ${checkDueResultRows.map(row => `
                    <tr>
                        <td>${escapeHtml(row.FG_MO)}</td>
                        <td>${row.FG_JOBNO !== '-'
                            ? `<span class="check-due-diff">${escapeHtml(row.FG_JOBNO)}</span>`
                            : '<span class="check-due-same">-</span>'}</td>
                        <td>${row.FG_DUE !== '-'
                            ? `<span class="check-due-diff">${escapeHtml(row.FG_DUE)}</span>`
                            : '<span class="check-due-same">-</span>'}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

async function copyCheckDueResult() {
    if (!checkDueResultRows || checkDueResultRows.length === 0) {
        updateCheckDueStatus('Chưa có kết quả để copy.');
        return;
    }
    const header = 'FG_MO\tFG_JOBNO\tFG_DUE';
    const lines = checkDueResultRows.map(row => `${row.FG_MO}\t${row.FG_JOBNO}\t${row.FG_DUE}`);
    const text = [header, ...lines].join('\n');

    try {
        await navigator.clipboard.writeText(text);
        updateCheckDueStatus(`Đã copy ${checkDueResultRows.length} dòng kết quả vào clipboard.`);
    } catch (error) {
        console.error('Lỗi copy Check Due:', error);
        // Fallback cho trình duyệt/ngữ cảnh không hỗ trợ Clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            updateCheckDueStatus(`Đã copy ${checkDueResultRows.length} dòng kết quả vào clipboard.`);
        } catch (fallbackError) {
            updateCheckDueStatus('Không thể copy tự động. Vui lòng bôi đen bảng và copy thủ công.');
        }
        document.body.removeChild(textarea);
    }
}

function getWeekdayLabel(dateValue) {
    const weekdayIndex = getWeekdayIndex(dateValue);
    if (weekdayIndex < 0) return '-';
    return ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][weekdayIndex];
}

function getWeekdayIndex(dateValue) {
    const [year, month, day] = String(dateValue || '').split('-').map(Number);
    if (!year || !month || !day) return -1;
    const sundayFirstIndex = new Date(year, month - 1, day).getDay();
    return sundayFirstIndex === 0 ? 6 : sundayFirstIndex - 1;
}

async function openLegacyMigrationModal() {
    const targetSelect = document.getElementById('legacyTargetUser');
    const countLabel = document.getElementById('legacyJobCount');
    targetSelect.innerHTML = '<option value="">Đang tải user...</option>';
    countLabel.textContent = 'Đang kiểm tra...';
    migrateLegacyJobsModal.show();

    try {
        const [jobsSnapshot, usersSnapshot] = await Promise.all([
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'users'))
        ]);
        legacyJobs = [];
        jobsSnapshot.forEach(jobDoc => {
            const data = jobDoc.data();
            if (!data.ownerId) legacyJobs.push({ id: jobDoc.id, ...data });
        });
        countLabel.textContent = legacyJobs.length;

        const users = [];
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.uid) users.push(user);
        });
        users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
        targetSelect.innerHTML = users.length
            ? '<option value="">Chọn user nhận job...</option>'
            : '<option value="">Chưa có user nào</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.uid;
            option.textContent = user.displayName ? `${user.displayName} (${user.email})` : user.email;
            targetSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Lỗi tải job cũ:', error);
        countLabel.textContent = 'Không tải được';
        targetSelect.innerHTML = '<option value="">Kiểm tra lại Firestore Rules</option>';
    }
}

async function migrateLegacyJobs() {
    const targetUid = document.getElementById('legacyTargetUser').value;
    if (!targetUid) {
        showNotification('Thiếu thông tin', 'Hãy chọn user nhận job.', false, 'warning');
        return;
    }
    if (!legacyJobs.length) {
        showNotification('Không có dữ liệu', 'Không còn job nào chưa có user.', false, 'info');
        migrateLegacyJobsModal.hide();
        return;
    }

    const button = document.getElementById('confirmMigrateLegacyJobsBtn');
    button.disabled = true;
    try {
        for (let index = 0; index < legacyJobs.length; index += 500) {
            const batch = writeBatch(db);
            legacyJobs.slice(index, index + 500).forEach(job => {
                batch.update(doc(db, 'jobs', job.id), {
                    ownerId: targetUid,
                    updatedAt: new Date().toISOString()
                });
            });
            await batch.commit();
        }
        showNotification('Đã gán job cũ', `Đã chuyển ${legacyJobs.length} job cho user được chọn.`, false, 'success');
        legacyJobs = [];
        migrateLegacyJobsModal.hide();
    } catch (error) {
        console.error('Lỗi gán job cũ:', error);
        showNotification('Lỗi', 'Không thể gán job cũ. Hãy kiểm tra Firestore Rules tạm thời.', false, 'danger');
    } finally {
        button.disabled = false;
    }
}

async function transferJob() {
    const jobId = currentViewingJobId || currentEditingJobId;
    const targetUid = document.getElementById('transferUserSelect').value;
    const job = jobs.find(item => item.id === jobId);
    
    if (!jobId || !targetUid || !job) {
        showNotification('Thiếu thông tin', 'Hãy chọn user nhận job trước.', false, 'warning');
        return;
    }
    
    const mode = currentTransferMode; // 'transfer' hoặc 'copy'
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';
    const actionTextPast = mode === 'transfer' ? 'chuyển' : 'sao chép';
    
    try {
        // Tạo transfer request
        await addDoc(collection(db, 'transferRequests'), {
            jobId: jobId,
            jobTitle: job.title,
            jobData: { // Lưu toàn bộ job data để copy
                title: job.title,
                type: job.type,
                date: job.date,
                time: job.time,
                description: job.description,
                enableNotification: job.enableNotification,
                workOnSunday: job.workOnSunday,
                isPaused: job.isPaused,
                isOutOfSchedule: job.isOutOfSchedule
            },
            fromUid: currentUser.uid,
            fromEmail: currentUser.email,
            fromName: currentUser.displayName || currentUser.email,
            toUid: targetUid,
            mode: mode, // 'transfer' hoặc 'copy'
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        
        showNotification(
            'Đã gửi yêu cầu', 
            `Đã gửi yêu cầu ${actionText} job "${job.title}" đến user. Vui lòng chờ xác nhận.`, 
            false, 
            'success'
        );
        
        viewJobModal.hide();
        currentViewingJobId = null;
        
    } catch (error) {
        console.error(`Lỗi gửi yêu cầu ${actionText} job:`, error);
        showNotification('Lỗi', `Không thể gửi yêu cầu ${actionText} job.`, false, 'danger');
    }
}

// Thêm function lắng nghe yêu cầu chuyển job
function listenTransferRequests() {
    if (!currentUser) return;
    transferRequestsInitialLoadDone = false;

    const q = query(
        collection(db, 'transferRequests'),
        where('toUid', '==', currentUser.uid),
        where('status', '==', 'pending')
    );

    onSnapshot(q, (snapshot) => {
        pendingTransferRequestsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Chỉ tự động bật popup cho yêu cầu MỚI (added) sau khi đã load lần đầu,
        // tránh việc mở lại popup lặp lại cho các yêu cầu đã có sẵn (đã bị lỡ/đóng trước đó).
        if (transferRequestsInitialLoadDone) {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const request = { id: change.doc.id, ...change.doc.data() };
                    showTransferConfirmModal(request.id, request);
                }
            });
        } else {
            // Lần load đầu tiên (vừa đăng nhập / mở app): nếu có sẵn yêu cầu đang chờ
            // thì vẫn hiện popup cho yêu cầu gần nhất để không bị bỏ sót.
            if (pendingTransferRequestsList.length > 0) {
                const latest = [...pendingTransferRequestsList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                showTransferConfirmModal(latest.id, latest);
            }
        }
        transferRequestsInitialLoadDone = true;

        renderNotifDropdown();
    });
}

function showTransferConfirmModal(requestId, request) {
    const mode = request.mode || 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';
    const modeIcon = mode === 'transfer' 
        ? '<i class="bi bi-arrow-right-circle-fill text-primary"></i>' 
        : '<i class="bi bi-copy text-success"></i>';
    
    document.getElementById('transferConfirmMessage').innerHTML = `
        ${modeIcon}
        <strong>${request.fromName || request.fromEmail}</strong> muốn <strong>${actionText}</strong> job 
        <strong>"${request.jobTitle}"</strong> cho bạn.<br>
        <small class="text-muted">Gửi lúc: ${new Date(request.timestamp).toLocaleString('vi-VN')}</small>
        ${mode === 'copy' ? '<br><small class="text-info"><i class="bi bi-info-circle"></i> Lưu ý: Đây là bản copy, job gốc vẫn ở người gửi.</small>' : ''}
    `;
    
    pendingTransferRequestId = requestId;
    pendingTransferRequestData = request;
    
    transferConfirmModal.show();
}

async function acceptTransfer() {
    if (!pendingTransferRequestId || !pendingTransferRequestData) return;
    
    const mode = pendingTransferRequestData.mode || 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';
    
    try {
        // Cập nhật trạng thái request
        await updateDoc(doc(db, 'transferRequests', pendingTransferRequestId), {
            status: 'accepted',
            respondedAt: new Date().toISOString()
        });
        
        if (mode === 'transfer') {
            // CHUYỂN: Update ownerId của job gốc
            const jobRef = doc(db, 'jobs', pendingTransferRequestData.jobId);
            await updateDoc(jobRef, {
                ownerId: currentUser.uid,
                transferHistory: arrayUnion({
                    from: pendingTransferRequestData.fromUid,
                    to: currentUser.uid,
                    mode: 'transfer',
                    timestamp: new Date().toISOString()
                }),
                updatedAt: new Date().toISOString()
            });

            // Gửi notification cho người chuyển rằng đã được chấp nhận
            await pushNotification(
                pendingTransferRequestData.fromUid,
                'transfer_accepted',
                `${currentUser.displayName || currentUser.email} đã chấp nhận nhận job "${pendingTransferRequestData.jobTitle}"`,
                pendingTransferRequestData.jobId
            );
        } else {
            // COPY: Tạo job mới cho người nhận
            const newJobData = {
                ...pendingTransferRequestData.jobData,
                ownerId: currentUser.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                copiedFrom: pendingTransferRequestData.jobId,
                copyHistory: [{
                    from: pendingTransferRequestData.fromUid,
                    to: currentUser.uid,
                    timestamp: new Date().toISOString()
                }]
            };
            
            await addDoc(collection(db, 'jobs'), newJobData);
            
            // Gửi notification cho người copy rằng đã thành công
            await addDoc(collection(db, 'notifications'), {
                userId: pendingTransferRequestData.fromUid,
                type: 'copy_success',
                message: `${currentUser.displayName || currentUser.email} đã chấp nhận copy job "${pendingTransferRequestData.jobTitle}"`,
                jobId: pendingTransferRequestData.jobId,
                timestamp: new Date().toISOString(),
                read: false
            });
        }
        
        showNotification(
            'Đã nhận job', 
            `Bạn đã nhận ${mode === 'transfer' ? '' : 'bản copy của '}job "${pendingTransferRequestData.jobTitle}"!`, 
            false, 
            'success'
        );
        
        transferConfirmModal.hide();
        pendingTransferRequestId = null;
        pendingTransferRequestData = null;
        
    } catch (error) {
        console.error('Lỗi nhận job:', error);
        showNotification('Lỗi', 'Không thể nhận job.', false, 'danger');
    }
}

async function rejectTransfer() {
    if (!pendingTransferRequestId || !pendingTransferRequestData) return;
    
    const mode = pendingTransferRequestData.mode || 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';
    
    try {
        // Cập nhật trạng thái request
        await updateDoc(doc(db, 'transferRequests', pendingTransferRequestId), {
            status: 'rejected',
            respondedAt: new Date().toISOString()
        });
        
        // Gửi thông báo cho người gửi
        await addDoc(collection(db, 'notifications'), {
            userId: pendingTransferRequestData.fromUid,
            type: mode === 'transfer' ? 'transfer_rejected' : 'copy_rejected',
            message: `${currentUser.displayName || currentUser.email} đã từ chối ${actionText} job "${pendingTransferRequestData.jobTitle}"`,
            jobId: pendingTransferRequestData.jobId,
            timestamp: new Date().toISOString(),
            read: false
        });
        
        showNotification(
            'Đã từ chối', 
            `Bạn đã từ chối ${actionText} job "${pendingTransferRequestData.jobTitle}".`, 
            false, 
            'warning'
        );
        
        transferConfirmModal.hide();
        pendingTransferRequestId = null;
        pendingTransferRequestData = null;
        
    } catch (error) {
        console.error('Lỗi từ chối job:', error);
        showNotification('Lỗi', 'Không thể từ chối job.', false, 'danger');
    }
}

// ============================================================
// Chuyển / Copy job TRONG NGÀY (quickJobs) - áp dụng cùng cơ chế
// với chuyển/copy job thường, kèm khả năng xem lại nếu lỡ miss.
// ============================================================

function listenQuickJobTransferRequests() {
    if (!currentUser) return;
    quickJobTransferInitialLoadDone = false;

    const q = query(
        collection(db, 'quickJobTransferRequests'),
        where('toUid', '==', currentUser.uid),
        where('status', '==', 'pending')
    );

    if (unsubscribeQuickJobTransferRequests) unsubscribeQuickJobTransferRequests();
    unsubscribeQuickJobTransferRequests = onSnapshot(q, (snapshot) => {
        quickJobTransferRequestsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (quickJobTransferInitialLoadDone) {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const request = { id: change.doc.id, ...change.doc.data() };
                    showQuickJobTransferConfirmModal(request.id, request);
                }
            });
        } else if (quickJobTransferRequestsList.length > 0) {
            const latest = [...quickJobTransferRequestsList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            showQuickJobTransferConfirmModal(latest.id, latest);
        }
        quickJobTransferInitialLoadDone = true;

        renderNotifDropdown();
    }, (error) => {
        console.error('Lỗi lắng nghe yêu cầu chuyển job trong ngày:', error);
    });
}

function showQuickJobTransferConfirmModal(requestId, request) {
    const mode = request.mode || 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';
    const modeIcon = mode === 'transfer'
        ? '<i class="bi bi-arrow-right-circle-fill text-primary"></i>'
        : '<i class="bi bi-copy text-success"></i>';

    document.getElementById('quickJobTransferConfirmMessage').innerHTML = `
        ${modeIcon}
        <strong>${escapeHtml(request.fromName || request.fromEmail || '')}</strong> muốn <strong>${actionText}</strong> job trong ngày
        <strong>"${escapeHtml(request.jobContent || '')}"</strong> cho bạn.<br>
        <small class="text-muted">Gửi lúc: ${new Date(request.timestamp).toLocaleString('vi-VN')}</small>
        ${mode === 'copy' ? '<br><small class="text-info"><i class="bi bi-info-circle"></i> Lưu ý: Đây là bản copy, job gốc vẫn ở người gửi.</small>' : ''}
    `;

    pendingQuickJobTransferId = requestId;
    pendingQuickJobTransferData = request;

    quickJobTransferConfirmModal.show();
}

async function acceptQuickJobTransfer() {
    if (!pendingQuickJobTransferId || !pendingQuickJobTransferData) return;
    const request = pendingQuickJobTransferData;
    const mode = request.mode || 'transfer';
    const time = nowTimeHHmm();

    try {
        await updateDoc(doc(db, 'quickJobTransferRequests', pendingQuickJobTransferId), {
            status: 'accepted',
            respondedAt: new Date().toISOString()
        });

        if (mode === 'transfer') {
            await updateDoc(doc(db, 'quickJobs', request.quickJobId), {
                assigneeUid: currentUser.uid,
                assigneeName: currentUser.displayName || currentUser.email,
                status: 'claimed',
                transferHistory: arrayUnion({
                    from: request.fromUid,
                    to: currentUser.uid,
                    mode: 'transfer',
                    timestamp: new Date().toISOString()
                }),
                updatedAt: new Date().toISOString()
            });

            await pushNotification(
                request.fromUid,
                'quickjob_transfer_accepted',
                `${currentUser.displayName || currentUser.email} đã chấp nhận nhận job trong ngày "${request.jobContent}"`
            );
        } else {
            const snap = request.jobSnapshot || {};
            await addDoc(collection(db, 'quickJobs'), {
                content: snap.content || request.jobContent || '',
                deadline: snap.deadline || null,
                dateKey: snap.dateKey || todayKey(),
                status: 'claimed',
                assigneeUid: currentUser.uid,
                assigneeName: currentUser.displayName || currentUser.email,
                time,
                createdBy: currentUser.uid,
                createdByName: currentUser.displayName || currentUser.email,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                copiedFromQuickJobId: request.quickJobId,
                copyHistory: [{
                    from: request.fromUid,
                    to: currentUser.uid,
                    timestamp: new Date().toISOString()
                }]
            });

            await pushNotification(
                request.fromUid,
                'quickjob_copy_accepted',
                `${currentUser.displayName || currentUser.email} đã chấp nhận copy job trong ngày "${request.jobContent}"`
            );
        }

        showNotification(
            'Đã nhận job',
            `Bạn đã nhận ${mode === 'transfer' ? '' : 'bản copy của '}job trong ngày "${request.jobContent}"!`,
            false,
            'success'
        );

        quickJobTransferConfirmModal.hide();
        pendingQuickJobTransferId = null;
        pendingQuickJobTransferData = null;
    } catch (error) {
        console.error('Lỗi nhận job trong ngày (chuyển/copy):', error);
        showNotification('Lỗi', 'Không thể nhận job.', false, 'danger');
    }
}

async function rejectQuickJobTransfer() {
    if (!pendingQuickJobTransferId || !pendingQuickJobTransferData) return;
    const request = pendingQuickJobTransferData;
    const mode = request.mode || 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';

    try {
        await updateDoc(doc(db, 'quickJobTransferRequests', pendingQuickJobTransferId), {
            status: 'rejected',
            respondedAt: new Date().toISOString()
        });

        await pushNotification(
            request.fromUid,
            mode === 'transfer' ? 'quickjob_transfer_rejected' : 'quickjob_copy_rejected',
            `${currentUser.displayName || currentUser.email} đã từ chối ${actionText} job trong ngày "${request.jobContent}"`
        );

        showNotification('Đã từ chối', `Bạn đã từ chối ${actionText} job trong ngày "${request.jobContent}".`, false, 'warning');

        quickJobTransferConfirmModal.hide();
        pendingQuickJobTransferId = null;
        pendingQuickJobTransferData = null;
    } catch (error) {
        console.error('Lỗi từ chối chuyển/copy job trong ngày:', error);
        showNotification('Lỗi', 'Không thể từ chối job.', false, 'danger');
    }
}

async function quickChatShowTransferForm(jobId) {
    const form = document.getElementById(`transferForm-${jobId}`);
    const bubble = document.querySelector(`.quick-chat-bubble[data-job-id="${jobId}"]`);
    if (form) form.classList.remove('d-none');
    if (bubble) {
        const actionsWrap = bubble.querySelector('[data-claimed-actions]');
        if (actionsWrap) actionsWrap.classList.add('d-none');
    }

    const select = document.getElementById(`transferSelect-${jobId}`);
    if (!select) return;
    try {
        const users = await fetchUsersExceptMe();
        select.innerHTML = users.length
            ? '<option value="">Chọn người nhận...</option>'
            : '<option value="">Chưa có user khác</option>';
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.uid;
            option.dataset.name = u.displayName || u.email;
            option.textContent = u.displayName ? `${u.displayName} (${u.email})` : u.email;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Lỗi tải danh sách user:', error);
        select.innerHTML = '<option value="">Không tải được danh sách</option>';
    }
}

function quickChatCancelTransferForm() {
    renderQuickChat();
}

async function quickChatConfirmTransfer(jobId) {
    const select = document.getElementById(`transferSelect-${jobId}`);
    const modeInput = document.querySelector(`input[name="transferMode-${jobId}"]:checked`);
    if (!select || !select.value) {
        showNotification('Thiếu thông tin', 'Hãy chọn người nhận job.', false, 'warning');
        return;
    }
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;

    const targetUid = select.value;
    const targetName = select.selectedOptions[0].dataset.name || select.selectedOptions[0].textContent;
    const mode = modeInput ? modeInput.value : 'transfer';
    const actionText = mode === 'transfer' ? 'chuyển' : 'copy';

    try {
        await addDoc(collection(db, 'quickJobTransferRequests'), {
            quickJobId: jobId,
            jobContent: job.content || '',
            jobSnapshot: {
                content: job.content || '',
                deadline: job.deadline || null,
                dateKey: job.dateKey || todayKey()
            },
            fromUid: currentUser.uid,
            fromEmail: currentUser.email,
            fromName: currentUser.displayName || currentUser.email,
            toUid: targetUid,
            toName: targetName,
            mode,
            status: 'pending',
            timestamp: new Date().toISOString()
        });

        showNotification('Đã gửi yêu cầu', `Đã gửi yêu cầu ${actionText} job "${job.content}" đến ${targetName}. Vui lòng chờ xác nhận.`, false, 'success');
        renderQuickChat();
    } catch (error) {
        console.error(`Lỗi gửi yêu cầu ${actionText} job trong ngày:`, error);
        showNotification('Lỗi', `Không thể gửi yêu cầu ${actionText} job.`, false, 'danger');
    }
}

function getTypeBadgeColor(type) {
    const colors = {
        daily: 'danger',
        weekly: 'info',
        biweekly: 'primary',
        monthly: 'warning',
        custom: 'warning'
    };
    return colors[type] || 'secondary';
}

function getTypeLabel(type) {
    const labels = {
        daily: 'Daily',
        weekly: 'Weekly',
        biweekly: 'Biweekly',
        monthly: 'Monthly',
        custom: 'Ngoài lịch'
    };
    return labels[type] || type;
}

// Open Add Job Modal
function openAddJobModal(isOutOfSchedule = false) {
    currentEditingJobId = null;
    currentJobIsPaused = false;
    document.getElementById('modalTitle').innerHTML = isOutOfSchedule
        ? '<i class="bi bi-lightning-charge-fill"></i> Thêm Job Ngoài Lịch'
        : '<i class="bi bi-plus-circle-fill"></i> Thêm Job Mới';
    document.getElementById('jobForm').reset();
    document.getElementById('jobDescription').innerHTML = '';

        const durInput = document.getElementById('jobDuration');
    if (durInput) durInput.value = '';

    document.getElementById('deleteJobBtn').style.display = 'none';
    document.getElementById('pauseJobBtn').style.display = 'none'; // NEW
    
    const now = new Date();
    document.getElementById('jobDate').value = now.toISOString().split('T')[0];
    document.getElementById('jobTime').value = now.toTimeString().slice(0, 5);
    document.getElementById('workOnSunday').checked = false;
    document.getElementById('isOutOfSchedule').checked = isOutOfSchedule;
    setExcludedWeekdaysInForm([]);
    toggleOutOfScheduleFields();
    toggleDailyExcludeWrap();

    jobModal.show();
}

// Open Edit Job Modal
function openEditJobModal(job) {
    currentEditingJobId = job.id;
    currentJobIsPaused = job.isPaused === true;
    
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil-fill"></i> Chỉnh Sửa Job';
    document.getElementById('jobTitle').value = job.title;
    document.getElementById('jobType').value = job.type;
    document.getElementById('jobDate').value = job.date;
    document.getElementById('jobTime').value = job.time;
    document.getElementById('jobDescription').innerHTML = job.description || '';

        const durInput = document.getElementById('jobDuration');
    if (durInput) durInput.value = job.duration || '';
    
    const notificationToggle = document.getElementById('enableNotification');
    if (notificationToggle) {
        notificationToggle.checked = job.enableNotification !== false;
    }
    
    document.getElementById('workOnSunday').checked = job.workOnSunday !== false;
    document.getElementById('isOutOfSchedule').checked = job.isOutOfSchedule === true;
    setExcludedWeekdaysInForm(job.excludedWeekdays);
    document.getElementById('deleteJobBtn').style.display = 'block';
    
    // Update pause button
    const pauseBtn = document.getElementById('pauseJobBtn');
    const pauseBtnText = document.getElementById('pauseJobBtnText');
    pauseBtn.style.display = 'block';
    
    if (currentJobIsPaused) {
        pauseBtn.classList.add('active');
        pauseBtnText.textContent = 'Bật lại';
        pauseBtn.querySelector('i').className = 'bi bi-play-circle-fill';
    } else {
        pauseBtn.classList.remove('active');
        pauseBtnText.textContent = 'Tạm dừng';
        pauseBtn.querySelector('i').className = 'bi bi-pause-circle-fill';
    }
    
    toggleOutOfScheduleFields();
    toggleDailyExcludeWrap();
    jobModal.show();
}

function togglePauseJob() {
    currentJobIsPaused = !currentJobIsPaused;
    
    const pauseBtn = document.getElementById('pauseJobBtn');
    const pauseBtnText = document.getElementById('pauseJobBtnText');
    
    if (currentJobIsPaused) {
        pauseBtn.classList.add('active');
        pauseBtnText.textContent = 'Bật lại';
        pauseBtn.querySelector('i').className = 'bi bi-play-circle-fill';
    } else {
        pauseBtn.classList.remove('active');
        pauseBtnText.textContent = 'Tạm dừng';
        pauseBtn.querySelector('i').className = 'bi bi-pause-circle-fill';
    }
}

// Sửa function saveJob
async function saveJob() {
    const title = document.getElementById('jobTitle').value.trim();
    const type = document.getElementById('jobType').value;
    const date = document.getElementById('jobDate').value;
    const time = document.getElementById('jobTime').value;
    const description = document.getElementById('jobDescription').innerHTML;
    const notificationToggle = document.getElementById('enableNotification');
    const enableNotification = notificationToggle ? notificationToggle.checked : true;
    const workOnSunday = document.getElementById('workOnSunday').checked;
    const isPaused = currentJobIsPaused; // Lấy từ state thay vì checkbox
    const isOutOfSchedule = document.getElementById('isOutOfSchedule').checked;

        const durationInput = document.getElementById('jobDuration');
    const durationRaw = durationInput ? parseInt(durationInput.value, 10) : NaN;
    const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : DEFAULT_JOB_DURATION;
    
    if (!title) {
        showNotification('Thiếu thông tin', 'Vui lòng nhập tiêu đề job.', false, 'warning');
        return;
    }

    const now = new Date();
    const effectiveDate = isOutOfSchedule ? (date || now.toISOString().split('T')[0]) : date;
    const effectiveTime = isOutOfSchedule ? (time || now.toTimeString().slice(0, 5)) : time;
    const effectiveType = isOutOfSchedule ? 'custom' : type;

    if (!isOutOfSchedule && (!effectiveDate || !effectiveTime)) {
        showNotification('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin bắt buộc.', false, 'warning');
        return;
    }
    
    if (!firestoreConnected) {
        showNotification('Chưa kết nối', 'Hiện tại chưa kết nối được Firestore. Vui lòng thử lại sau.', false, 'danger');
        return;
    }
    
    const jobData = {
        title,
        type: effectiveType,
        date: effectiveDate,
        time: effectiveTime,
        description,
        enableNotification,
        workOnSunday,
        isPaused,
        isOutOfSchedule,
        duration,
        excludedWeekdays: effectiveType === 'daily' ? getExcludedWeekdaysFromForm() : [],
        updatedAt: new Date().toISOString(),
        ownerId: currentUser.uid
    };
    
    try {
        const saveBtn = document.getElementById('saveJobBtn');
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="loading"></span> Đang lưu...';
        saveBtn.disabled = true;
        
        if (currentEditingJobId) {
            const jobRef = doc(db, 'jobs', currentEditingJobId);
            delete jobData.ownerId;
            await updateDoc(jobRef, jobData);
            console.log('✅ Job đã được cập nhật:', currentEditingJobId);
            showNotification('Thành công', `Job "${title}" đã được ${isPaused ? 'tạm dừng' : 'cập nhật'}!`);
        } else {
            jobData.createdAt = new Date().toISOString();
            const docRef = await addDoc(collection(db, 'jobs'), jobData);
            console.log('✅ Job mới đã được thêm:', docRef.id);
            showNotification('Thành công', `Job "${title}" đã được thêm!`);
        }
        
        saveBtn.innerHTML = originalHTML;
        saveBtn.disabled = false;
        jobModal.hide();
    } catch (error) {
        console.error('❌ Lỗi khi lưu job:', error);
        showNotification('Lỗi', 'Có lỗi xảy ra khi lưu job. Vui lòng thử lại.', false, 'danger');
        
        const saveBtn = document.getElementById('saveJobBtn');
        saveBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Lưu Job';
        saveBtn.disabled = false;
    }
}

function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function timeAgoVN(isoString) {
    const then = new Date(isoString).getTime();
    if (isNaN(then)) return '';
    const diffMs = Date.now() - then;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} giờ trước`;
    const day = Math.floor(hour / 24);
    if (day < 30) return `${day} ngày trước`;
    return new Date(isoString).toLocaleDateString('vi-VN');
}

async function pushNotification(toUid, type, message, jobId = null) {
    if (!toUid) return;
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: toUid,
            type,
            message,
            jobId,
            timestamp: new Date().toISOString(),
            read: false
        });
    } catch (error) {
        console.error('Lỗi gửi thông báo:', error);
    }
}

const NOTIF_TYPE_CONFIG = {
    transfer_sent: { icon: 'bi-send-fill', color: '#3b82f6', label: 'Chuyển job' },
    transfer_accepted: { icon: 'bi-check-circle-fill', color: '#16a34a', label: 'Chấp nhận job' },
    transfer_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối job' },
    copy_success: { icon: 'bi-copy', color: '#16a34a', label: 'Copy job' },
    copy_accepted: { icon: 'bi-copy', color: '#16a34a', label: 'Copy job' },
    copy_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối copy' },
    quickjob_claimed: { icon: 'bi-hand-thumbs-up-fill', color: '#f59e0b', label: 'Nhận job' },
    quickjob_invited: { icon: 'bi-person-plus-fill', color: '#3b82f6', label: 'Chỉ định job' },
    quickjob_completed: { icon: 'bi-check2-circle', color: '#16a34a', label: 'Hoàn thành job' },
    quickjob_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối job' },
    quickjob_transfer_accepted: { icon: 'bi-check-circle-fill', color: '#16a34a', label: 'Chấp nhận job' },
    quickjob_transfer_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối job' },
    quickjob_copy_accepted: { icon: 'bi-copy', color: '#16a34a', label: 'Copy job' },
    quickjob_copy_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối copy' }
};

// Gom các yêu cầu/lời mời đang CHỜ MÌNH xác nhận (chuyển job, copy job, chỉ định job
// trong ngày) - kể cả khi popup ban đầu đã bị lỡ/đóng - để hiện lại trong chuông thông báo.
function getPendingActionItems() {
    if (!currentUser) return [];
    const items = [];

    pendingTransferRequestsList.forEach(r => {
        const mode = r.mode || 'transfer';
        items.push({
            reviewType: 'transfer',
            id: r.id,
            timestamp: r.timestamp,
            icon: mode === 'transfer' ? 'bi-arrow-right-circle-fill' : 'bi-copy',
            message: `${r.fromName || r.fromEmail} muốn ${mode === 'transfer' ? 'chuyển' : 'copy'} job "${r.jobTitle}" cho bạn`
        });
    });

    quickJobsList
        .filter(j => j.status === 'invited' && j.invitedUid === currentUser.uid)
        .forEach(j => {
            items.push({
                reviewType: 'quickjob_invite',
                id: j.id,
                timestamp: j.invitedAt || j.createdAt,
                icon: 'bi-person-plus-fill',
                message: `${j.invitedByName || 'Một người dùng'} đã chỉ định bạn nhận job trong ngày "${j.content}"`
            });
        });

    quickJobTransferRequestsList.forEach(r => {
        const mode = r.mode || 'transfer';
        items.push({
            reviewType: 'quickjob_transfer',
            id: r.id,
            timestamp: r.timestamp,
            icon: mode === 'transfer' ? 'bi-arrow-right-circle-fill' : 'bi-copy',
            message: `${r.fromName || r.fromEmail} muốn ${mode === 'transfer' ? 'chuyển' : 'copy'} job trong ngày "${r.jobContent}" cho bạn`
        });
    });

    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return items;
}

function renderPendingActionsSection() {
    const section = document.getElementById('notifPendingSection');
    const listEl = document.getElementById('notifPendingList');
    if (!section || !listEl) return [];

    const items = getPendingActionItems();
    if (items.length === 0) {
        section.classList.add('d-none');
        listEl.innerHTML = '';
        return items;
    }

    section.classList.remove('d-none');
    listEl.innerHTML = items.map(item => `
        <div class="notif-pending-item">
            <div class="notif-pending-item-icon"><i class="bi ${item.icon}"></i></div>
            <div class="notif-pending-item-body">
                <p class="notif-pending-item-message mb-0">${escapeHtml(item.message)}</p>
                <span class="notif-pending-item-time">${timeAgoVN(item.timestamp)}</span>
            </div>
            <button type="button" class="notif-pending-review-btn" data-review-type="${item.reviewType}" data-review-id="${item.id}">Xem lại</button>
        </div>
    `).join('');

    return items;
}

function renderNotifDropdown() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const bell = document.getElementById('notifBellBtn');
    if (!list || !badge || !bell) return;

    const pendingItems = renderPendingActionsSection();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = notificationsList
        .filter(n => new Date(n.timestamp).getTime() >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const unreadCount = notificationsList.filter(n => !n.read).length + pendingItems.length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.classList.remove('d-none');
        bell.classList.add('has-unread');
    } else {
        badge.classList.add('d-none');
        bell.classList.remove('has-unread');
    }

    if (recent.length === 0) {
        list.innerHTML = '<p class="text-muted text-center p-3 mb-0">Không có thông báo</p>';
        return;
    }

    list.innerHTML = recent.map(n => {
        const config = NOTIF_TYPE_CONFIG[n.type] || { icon: 'bi-bell-fill', color: '#667eea', label: 'Thông báo' };
        return `
            <div class="notif-item ${n.read ? '' : 'unread'}">
                <div class="notif-item-icon" style="background:${config.color}">
                    <i class="bi ${config.icon}"></i>
                </div>
                <div class="notif-item-body">
                    <p class="notif-item-message">${escapeHtml(n.message || '')}</p>
                    <span class="notif-item-time">${timeAgoVN(n.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    notifDropdownOpen = !notifDropdownOpen;
    dropdown.classList.toggle('show', notifDropdownOpen);
    if (notifDropdownOpen) {
        markAllNotificationsRead();
    }
}

async function markAllNotificationsRead() {
    const unread = notificationsList.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
        for (let i = 0; i < unread.length; i += 500) {
            const batch = writeBatch(db);
            unread.slice(i, i + 500).forEach(n => {
                batch.update(doc(db, 'notifications', n.id), { read: true });
            });
            await batch.commit();
        }
        unread.forEach(n => { n.read = true; });
        renderNotifDropdown();
    } catch (error) {
        console.error('Lỗi đánh dấu đã đọc:', error);
    }
}

function listenUserNotifications() {
    if (!currentUser) return;
    notifInitialLoadDone = false;

    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid)
    );

    if (unsubscribeNotifications) unsubscribeNotifications();
    unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        notificationsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (notifInitialLoadDone) {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const n = { id: change.doc.id, ...change.doc.data() };
                    const config = NOTIF_TYPE_CONFIG[n.type] || { label: 'Thông báo' };
                    showNotification(
                        config.label || 'Thông báo',
                        n.message,
                        false,
                        n.type && n.type.includes('rejected') ? 'warning' : 'info'
                    );
                }
            });
        }
        notifInitialLoadDone = true;

        renderNotifDropdown();
    }, (error) => {
        console.error('Lỗi lắng nghe thông báo:', error);
    });
}


// ============================================================
// QUICK CHAT - "Job trong ngày" (real-time, giống chat)
// ============================================================
function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function nowTimeHHmm() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

function listenQuickJobs() {
    if (!currentUser) return;
    quickChatInitialLoadDone = false;

    // Không lọc theo ngày trên server nữa: job "open" quá hạn vẫn cần hiển thị để cảnh báo đỏ.
    const q = collection(db, 'quickJobs');

    if (unsubscribeQuickJobs) unsubscribeQuickJobs();
    unsubscribeQuickJobs = onSnapshot(q, (snapshot) => {
        const KEEP_DAYS = 30;
        const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;

        quickJobsList = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(job => job.status === 'open' || job.status === 'invited' || new Date(job.createdAt).getTime() >= cutoff);
        quickJobsList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (quickChatInitialLoadDone) {
            snapshot.docChanges().forEach(change => {
                const data = { id: change.doc.id, ...change.doc.data() };
                const isMine = data.createdBy === currentUser.uid || data.assigneeUid === currentUser.uid;

                if (change.type === 'modified' && data.status === 'claimed' && isMine) {
                    // Có người nhận job -> tự động mở khung chat
                    if (!quickChatPanelOpen) {
                        openQuickChatPanel();
                    }
                } else if (change.type === 'modified' && data.status === 'invited' && data.invitedUid === currentUser.uid) {
                    // Được chỉ định nhận job -> tự động mở khung chat
                    if (!quickChatPanelOpen) {
                        openQuickChatPanel();
                    }
                }
            });
        }
        quickChatInitialLoadDone = true;

        updateQuickChatBadge();
        renderQuickChat();
        checkPendingQuickInvite();
        renderNotifDropdown();
    }, (error) => {
        console.error('Lỗi lắng nghe job trong ngày:', error);
    });
}

function checkPendingQuickInvite() {
    if (!currentUser) return;
    const invite = quickJobsList.find(j => j.status === 'invited' && j.invitedUid === currentUser.uid);
    if (invite && shownInviteKeys[invite.id] !== invite.invitedAt) {
        shownInviteKeys[invite.id] = invite.invitedAt;
        showQuickInviteModal(invite);
    }
}

function showQuickInviteModal(job) {
    pendingQuickInviteId = job.id;
    pendingQuickInviteData = job;
    document.getElementById('quickJobInviteMessage').innerHTML = `
        <i class="bi bi-person-plus-fill text-primary"></i>
        <strong>${escapeHtml(job.invitedByName || 'Một người dùng')}</strong> đã chỉ định bạn nhận job:<br>
        <strong>"${escapeHtml(job.content || '')}"</strong><br>
        <small class="text-muted">Gửi lúc: ${new Date(job.invitedAt).toLocaleString('vi-VN')}</small>
    `;
    quickJobInviteModal.show();
    if (!quickChatPanelOpen) openQuickChatPanel();
}

function updateQuickChatBadge() {
    const badge = document.getElementById('quickChatBadge');
    if (!badge) return;
    const unassignedCount = quickJobsList.filter(j => (j.status || 'open') === 'open').length;
    if (unassignedCount > 0) {
        badge.textContent = unassignedCount > 99 ? '99+' : String(unassignedCount);
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

function renderQuickJobBubble(job) {
    const isOwn = currentUser && job.createdBy === currentUser.uid;
    const isAssignee = currentUser && job.assigneeUid === currentUser.uid;
    const isInvitedMe = currentUser && job.status === 'invited' && job.invitedUid === currentUser.uid;
    const isInviter = currentUser && job.status === 'invited' && job.createdBy === currentUser.uid;
    const status = job.status || 'open';
    const today = todayKey();
    const isOverdue = status === 'open' && job.dateKey && job.dateKey !== today;

    // Deadline: chỉ tính trễ hạn khi job của hôm nay và chưa hoàn thành
    let deadlinePassed = false;
    if (job.deadline && status !== 'completed' && job.dateKey === today) {
        deadlinePassed = nowTimeHHmm() > job.deadline;
    }

    let statusPillHtml = '';
    let actionsHtml = '';

    if (status === 'open') {
        if (isOverdue) {
            statusPillHtml = `<span class="quick-chat-status-pill overdue"><i class="bi bi-exclamation-triangle-fill"></i> Quá hạn - chưa có người nhận (${formatDateShortDMY(job.dateKey)})</span>`;
        } else {
            statusPillHtml = `<span class="quick-chat-status-pill open"><i class="bi bi-hourglass-split"></i> Chưa có người nhận</span>`;
        }
        actionsHtml = `
            <div class="quick-chat-actions" data-open-actions>
                <button type="button" class="btn btn-sm btn-primary" data-action="self-claim" data-id="${job.id}">
                    <i class="bi bi-hand-index-thumb-fill"></i> Nhận job
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="show-assign" data-id="${job.id}">
                    <i class="bi bi-person-plus-fill"></i> Chỉ định người nhận
                </button>
            </div>
            <div class="quick-chat-claim-form d-none" id="assignForm-${job.id}">
                <select class="quick-chat-assign-select" id="assignSelect-${job.id}">
                    <option value="">Đang tải user...</option>
                </select>
                <button type="button" class="btn btn-sm btn-success" data-action="confirm-assign" data-id="${job.id}">
                    <i class="bi bi-check-lg"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel-assign" data-id="${job.id}">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `;
    } else if (status === 'invited') {
        statusPillHtml = `<span class="quick-chat-status-pill invited"><i class="bi bi-person-plus-fill"></i> Đã chỉ định cho ${escapeHtml(job.invitedName || '')} · chờ xác nhận</span>`;
        if (isInvitedMe) {
            actionsHtml = `
                <div class="quick-chat-actions">
                    <button type="button" class="btn btn-sm btn-success" data-action="accept-invite" data-id="${job.id}">
                        <i class="bi bi-check-circle-fill"></i> Nhận
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="reject-invite" data-id="${job.id}">
                        <i class="bi bi-x-circle-fill"></i> Từ chối
                    </button>
                </div>
            `;
        } else if (isInviter) {
            actionsHtml = `
                <div class="quick-chat-actions">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel-invite" data-id="${job.id}">
                        <i class="bi bi-arrow-counterclockwise"></i> Hủy chỉ định
                    </button>
                </div>
            `;
        }
    } else if (status === 'claimed') {
        statusPillHtml = `<span class="quick-chat-status-pill claimed"><i class="bi bi-person-check-fill"></i> ${escapeHtml(job.assigneeName || '')}${job.time ? ' · nhận lúc ' + escapeHtml(job.time) : ''}</span>`;
        if (isAssignee) {
            actionsHtml = `
                <div class="quick-chat-actions" data-claimed-actions>
                    <button type="button" class="btn btn-sm btn-success" data-action="complete" data-id="${job.id}">
                        <i class="bi bi-check2-circle"></i> Hoàn thành
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="show-transfer" data-id="${job.id}">
                        <i class="bi bi-arrow-left-right"></i> Chuyển/Copy
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${job.id}">
                        <i class="bi bi-x-circle"></i> Từ chối
                    </button>
                </div>
                <div class="quick-chat-transfer-form d-none" id="transferForm-${job.id}">
                    <div class="quick-chat-transfer-form-row">
                        <select class="quick-chat-transfer-select" id="transferSelect-${job.id}">
                            <option value="">Đang tải user...</option>
                        </select>
                    </div>
                    <div class="quick-chat-transfer-mode">
                        <label>
                            <input type="radio" name="transferMode-${job.id}" value="transfer" checked>
                            <i class="bi bi-arrow-right-circle-fill text-primary"></i> Chuyển
                        </label>
                        <label>
                            <input type="radio" name="transferMode-${job.id}" value="copy">
                            <i class="bi bi-copy text-success"></i> Copy
                        </label>
                    </div>
                    <div class="quick-chat-transfer-form-row">
                        <button type="button" class="btn btn-sm btn-success" data-action="confirm-transfer" data-id="${job.id}">
                            <i class="bi bi-send-fill"></i> Gửi yêu cầu
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel-transfer" data-id="${job.id}">
                            <i class="bi bi-x-lg"></i> Hủy
                        </button>
                    </div>
                </div>
            `;
        }
    } else if (status === 'completed') {
        statusPillHtml = `<span class="quick-chat-status-pill completed"><i class="bi bi-check2-circle"></i> Hoàn thành bởi ${escapeHtml(job.assigneeName || '')}${job.time ? ' · lúc ' + escapeHtml(job.time) : ''}</span>`;
    }

    let deadlinePillHtml = '';
    if (job.deadline) {
        deadlinePillHtml = deadlinePassed
            ? `<span class="quick-chat-status-pill deadline-overdue"><i class="bi bi-alarm-fill"></i> Trễ hạn (${escapeHtml(job.deadline)})</span>`
            : `<span class="quick-chat-status-pill deadline"><i class="bi bi-alarm"></i> Hạn: ${escapeHtml(job.deadline)}</span>`;
    }

    // Owner tools: sửa / xóa (chỉ người tạo)
    const ownerToolsHtml = isOwn ? `
        <div class="quick-chat-owner-tools">
            <button type="button" data-action="show-edit" data-id="${job.id}" title="Sửa"><i class="bi bi-pencil-fill"></i></button>
            <button type="button" class="delete-btn" data-action="delete" data-id="${job.id}" title="Xóa"><i class="bi bi-trash-fill"></i></button>
        </div>
    ` : '';

    const editedTagHtml = job.edited ? '<span class="quick-chat-edited-tag">(đã chỉnh sửa)</span>' : '';

    const editFormHtml = `
        <div class="quick-chat-edit-form d-none" id="editForm-${job.id}">
            <textarea id="editContent-${job.id}">${escapeHtml(job.content || '')}</textarea>
            <div class="quick-chat-deadline-row">
                <i class="bi bi-alarm"></i>
                <span>Hạn chót:</span>
                <input type="time" id="editDeadline-${job.id}" class="quick-chat-deadline-input" value="${job.deadline || ''}">
            </div>
            <div class="quick-chat-edit-form-actions">
                <button type="button" class="btn btn-sm btn-success" data-action="save-edit" data-id="${job.id}">
                    <i class="bi bi-check-lg"></i> Lưu
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel-edit" data-id="${job.id}">
                    <i class="bi bi-x-lg"></i> Hủy
                </button>
            </div>
        </div>
    `;

    return `
        <div class="quick-chat-bubble ${isOwn ? 'own' : ''} status-${status} ${isOverdue ? 'overdue' : ''} ${deadlinePassed ? 'deadline-passed' : ''}" data-job-id="${job.id}">
            <div class="quick-chat-bubble-head">
                 ${getUserAvatarUrl(job.createdBy)
                    ? `<img class="quick-chat-avatar" src="${getUserAvatarUrl(job.createdBy)}" alt="">`
                    : `<div class="quick-chat-avatar">${getInitials(job.createdByName)}</div>`}
                <span class="quick-chat-author">${escapeHtml(job.createdByName || 'Ẩn danh')}</span>
                <span class="quick-chat-time">${timeAgoVN(job.createdAt)}${editedTagHtml}</span>
                ${ownerToolsHtml}
            </div>
            <p class="quick-chat-content" id="content-${job.id}">${escapeHtml(job.content || '')}</p>
            ${editFormHtml}
            <div class="quick-chat-status-row">${statusPillHtml}${deadlinePillHtml}</div>
            ${actionsHtml}
        </div>
    `;
}

function setQuickChatTab(tab) {
    quickChatActiveTab = tab;
    const tabAll = document.getElementById('quickChatTabAll');
    const tabMine = document.getElementById('quickChatTabMine');
    if (tabAll) tabAll.classList.toggle('active', tab === 'all');
    if (tabMine) tabMine.classList.toggle('active', tab === 'mine');
    renderQuickChat();
}

function applyQuickChatFilters(list) {
    return list.filter(job => {
        if (quickChatSearchText && !(job.content || '').toLowerCase().includes(quickChatSearchText.toLowerCase())) {
            return false;
        }
        if (quickChatStatusFilter !== 'all' && (job.status || 'open') !== quickChatStatusFilter) {
            return false;
        }
        if (quickChatAssigneeFilter !== 'all' && job.assigneeUid !== quickChatAssigneeFilter) {
            return false;
        }
        return true;
    });
}

function populateAssigneeFilterOptions() {
    const select = document.getElementById('quickChatAssigneeFilter');
    if (!select) return;
    const current = select.value;

    const seen = new Map();
    quickJobsList.forEach(j => {
        if (j.assigneeUid && j.assigneeName) seen.set(j.assigneeUid, j.assigneeName);
    });

    select.innerHTML = '<option value="all">Tất cả người phụ trách</option>' +
        Array.from(seen.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([uid, name]) => `<option value="${uid}">${escapeHtml(name)}</option>`)
            .join('');

    if (Array.from(seen.keys()).includes(current) || current === 'all') {
        select.value = current;
    } else {
        select.value = 'all';
        quickChatAssigneeFilter = 'all';
    }
}

function renderQuickChat() {
    const container = document.getElementById('quickChatMessages');
    if (!container) return;

    populateAssigneeFilterOptions();

    const shouldScroll = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
    const hasActiveFilter = quickChatSearchText || quickChatStatusFilter !== 'all' || quickChatAssigneeFilter !== 'all';

    if (quickChatActiveTab === 'mine') {
        if (!currentUser) return;
        const mineBase = quickJobsList.filter(j => j.assigneeUid === currentUser.uid);
        const filtered = applyQuickChatFilters(mineBase);
        const inProgress = filtered.filter(j => j.status === 'claimed');
        const done = filtered.filter(j => j.status === 'completed');

        if (inProgress.length === 0 && done.length === 0) {
            container.innerHTML = hasActiveFilter
                ? '<p class="quick-chat-empty">Không tìm thấy job phù hợp bộ lọc.</p>'
                : '<p class="quick-chat-empty">Bạn chưa nhận job nào. Sang tab "Chung" để nhận job!</p>';
            return;
        }

        let html = '';
        if (inProgress.length > 0) {
            html += `<div class="quick-chat-mine-section-title"><i class="bi bi-hourglass-split"></i> Đang thực hiện (${inProgress.length})</div>`;
            html += inProgress.map(renderQuickJobBubble).join('');
        }
        if (done.length > 0) {
            html += `<div class="quick-chat-mine-section-title"><i class="bi bi-check2-circle"></i> Đã hoàn thành (${done.length})</div>`;
            html += done.map(renderQuickJobBubble).join('');
        }
        container.innerHTML = html;
    } else {
        const filtered = applyQuickChatFilters(quickJobsList);
        if (filtered.length === 0) {
            container.innerHTML = hasActiveFilter
                ? '<p class="quick-chat-empty">Không tìm thấy job phù hợp bộ lọc.</p>'
                : '<p class="quick-chat-empty">Chưa có job phát sinh nào. Hãy nhập bên dưới để báo cho mọi người!</p>';
            return;
        }
        container.innerHTML = filtered.map(renderQuickJobBubble).join('');
    }

    if (shouldScroll) {
        container.scrollTop = container.scrollHeight;
    }
}

function formatDateShortDMY(dateKey) {
    if (!dateKey) return '';
    const [y, m, d] = dateKey.split('-');
    return `${d}/${m}`;
}

// ============ Date helpers - tránh lệch ngày do UTC vs local ============
function parseJobDate(dateValue) {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return new Date(dateValue);
    const parts = String(dateValue).split('-').map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
        // Parse theo local time để không bị lệch ngày
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateValue);
}

function localDateKey(dateValue) {
    const d = dateValue instanceof Date ? dateValue : parseJobDate(dateValue);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function sendQuickJob() {
    const input = document.getElementById('quickChatInput');
    const deadlineInput = document.getElementById('quickChatDeadlineInput');
    if (!input || !currentUser) return;
    const content = input.value.trim();
    if (!content) return;
    const deadline = deadlineInput && deadlineInput.value ? deadlineInput.value : null;

    const sendBtn = document.getElementById('quickChatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        await addDoc(collection(db, 'quickJobs'), {
            content,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || currentUser.email,
            createdAt: new Date().toISOString(),
            dateKey: todayKey(),
            status: 'open',
            assigneeUid: null,
            assigneeName: null,
            time: null,
            deadline,
            invitedUid: null,
            invitedName: null,
            invitedBy: null,
            invitedByName: null,
            invitedAt: null,
            edited: false
        });
        input.value = '';
        input.style.height = 'auto';
        if (deadlineInput) deadlineInput.value = '';
    } catch (error) {
        console.error('Lỗi gửi job trong ngày:', error);
        showNotification('Lỗi', 'Không thể gửi job. Vui lòng thử lại.', false, 'danger');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Nhận job cho chính mình - giờ nhận lấy real-time, không cần nhập tay
async function quickChatSelfClaim(jobId) {
    if (!currentUser) return;
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job) return;
    const time = nowTimeHHmm();

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'claimed',
            assigneeUid: currentUser.uid,
            assigneeName: currentUser.displayName || currentUser.email,
            time,
            updatedAt: new Date().toISOString()
        });

        if (job.createdBy && job.createdBy !== currentUser.uid) {
            await pushNotification(
                job.createdBy,
                'quickjob_claimed',
                `${currentUser.displayName || currentUser.email} đã nhận job "${job.content}" lúc ${time}`
            );
        }
    } catch (error) {
        console.error('Lỗi nhận job trong ngày:', error);
        showNotification('Lỗi', 'Không thể nhận job.', false, 'danger');
    }
}

let cachedUsersForAssign = null;
async function fetchUsersExceptMe() {
    if (cachedUsersForAssign) return cachedUsersForAssign;
    const snapshot = await getDocs(collection(db, 'users'));
    const users = [];
    snapshot.forEach(d => {
        const u = d.data();
        if (u.uid && u.uid !== currentUser.uid) users.push(u);
    });
    users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    cachedUsersForAssign = users;
    return users;
}

async function quickChatShowAssignForm(jobId) {
    const form = document.getElementById(`assignForm-${jobId}`);
    const bubble = document.querySelector(`.quick-chat-bubble[data-job-id="${jobId}"]`);
    if (form) form.classList.remove('d-none');
    if (bubble) {
        const actionsWrap = bubble.querySelector('[data-open-actions]');
        if (actionsWrap) actionsWrap.classList.add('d-none');
    }

    const select = document.getElementById(`assignSelect-${jobId}`);
    if (!select) return;
    try {
        const users = await fetchUsersExceptMe();
        select.innerHTML = users.length
            ? '<option value="">Chọn người nhận...</option>'
            : '<option value="">Chưa có user khác</option>';
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.uid;
            option.dataset.name = u.displayName || u.email;
            option.textContent = u.displayName ? `${u.displayName} (${u.email})` : u.email;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Lỗi tải danh sách user:', error);
        select.innerHTML = '<option value="">Không tải được danh sách</option>';
    }
}

function quickChatCancelAssignForm() {
    renderQuickChat();
}

async function quickChatConfirmAssign(jobId) {
    const select = document.getElementById(`assignSelect-${jobId}`);
    if (!select || !select.value) {
        showNotification('Thiếu thông tin', 'Hãy chọn người nhận job.', false, 'warning');
        return;
    }
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;

    const invitedUid = select.value;
    const invitedName = select.selectedOptions[0].dataset.name || select.selectedOptions[0].textContent;
    const invitedAt = new Date().toISOString();

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'invited',
            invitedUid,
            invitedName,
            invitedBy: currentUser.uid,
            invitedByName: currentUser.displayName || currentUser.email,
            invitedAt
        });

        await pushNotification(
            invitedUid,
            'quickjob_invited',
            `${currentUser.displayName || currentUser.email} đã chỉ định bạn nhận job "${job.content}"`
        );

        showNotification('Đã gửi chỉ định', `Đã chỉ định ${invitedName} nhận job "${job.content}".`, false, 'success');
    } catch (error) {
        console.error('Lỗi chỉ định người nhận:', error);
        showNotification('Lỗi', 'Không thể chỉ định người nhận.', false, 'danger');
    }
}

// ============================================================
// USERS AVATAR — realtime để mọi người thấy avatar mới của nhau
// ============================================================
function listenUsersAvatars() {
    if (unsubscribeUsersAvatar) unsubscribeUsersAvatar();
    unsubscribeUsersAvatar = onSnapshot(collection(db, 'users'), (snapshot) => {
        usersAvatarCache = {};
        usersInfoCache = {};
        usersDeptLatest = {};
        snapshot.forEach(d => {
            const u = d.data();
            if (u.uid) {
                collectUserDepts(u);
                if (u.avatar) usersAvatarCache[u.uid] = u.avatar;
                usersInfoCache[u.uid] = {
                    displayName: u.displayName || '',
                    email: u.email || '',
                    avatar: u.avatar || null,
                    department: u.department || ''
                };
            }
        });

        if (currentUser && usersInfoCache[currentUser.uid]
            && (usersInfoCache[currentUser.uid].department || '') !== (currentUser.department || '')) {
            currentUser.department = usersInfoCache[currentUser.uid].department || '';   // đổi từ thiết bị khác
             rebuildScheduleWorkHoursMap();   // ← THÊM
            renderSchedule();
        }
        rebuildDepartmentsList();
        if (document.getElementById('presenterSpinModal')?.classList.contains('show') && spinAllUsers.length) applySpinDeptFilter(false);

        if (currentUser && usersAvatarCache[currentUser.uid] && usersAvatarCache[currentUser.uid] !== currentUser.avatar) {
            currentUser.avatar = usersAvatarCache[currentUser.uid];
            updateUserProfileUI();
        }

        if (dayOffModalOpen) renderDayOffModal();
        if (typeof renderQuickChat === 'function' && quickChatPanelOpen) renderQuickChat();
        if (typeof renderSpinUsersList === 'function' && spinCandidates && spinCandidates.length
            && document.getElementById('presenterSpinModal')?.classList.contains('show')) {
            renderSpinUsersList();
        }
        // Statistics modal đang mở → refresh để cập nhật tên/avatar
        if (statisticsModal && document.getElementById('statisticsModal')?.classList.contains('show')) {
            renderStatistics();
        }
    }, (error) => {
        console.error('Lỗi lắng nghe avatar users:', error);
    });
}

function getUserAvatarUrl(uid) {
    return (usersAvatarCache && usersAvatarCache[uid]) || null;
}

async function quickChatAcceptInvite(jobId) {
    const job = quickJobsList.find(j => j.id === jobId) || pendingQuickInviteData;
    if (!job || !currentUser) return;
    const time = nowTimeHHmm();

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'claimed',
            assigneeUid: currentUser.uid,
            assigneeName: currentUser.displayName || currentUser.email,
            time,
            updatedAt: new Date().toISOString()
        });

        if (job.invitedBy && job.invitedBy !== currentUser.uid) {
            await pushNotification(
                job.invitedBy,
                'quickjob_claimed',
                `${currentUser.displayName || currentUser.email} đã chấp nhận job "${job.content}" lúc ${time}`
            );
        }
    } catch (error) {
        console.error('Lỗi chấp nhận chỉ định:', error);
        showNotification('Lỗi', 'Không thể nhận job.', false, 'danger');
    } finally {
        if (pendingQuickInviteId === jobId) {
            quickJobInviteModal.hide();
            pendingQuickInviteId = null;
            pendingQuickInviteData = null;
        }
    }
}

async function quickChatRejectInvite(jobId) {
    const job = quickJobsList.find(j => j.id === jobId) || pendingQuickInviteData;
    if (!job || !currentUser) return;

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'open',
            invitedUid: null,
            invitedName: null,
            invitedBy: null,
            invitedByName: null,
            invitedAt: null,
            assigneeUid: null,
            assigneeName: null,
            time: null,
            updatedAt: new Date().toISOString()
        });

        if (job.invitedBy && job.invitedBy !== currentUser.uid) {
            await pushNotification(
                job.invitedBy,
                'quickjob_rejected',
                `${currentUser.displayName || currentUser.email} đã từ chối chỉ định job "${job.content}"`
            );
        }
        showNotification('Đã từ chối', `Bạn đã từ chối job "${job.content}". Job đã trở lại danh sách chờ.`, false, 'warning');
    } catch (error) {
        console.error('Lỗi từ chối chỉ định:', error);
        showNotification('Lỗi', 'Không thể từ chối job.', false, 'danger');
    } finally {
        if (pendingQuickInviteId === jobId) {
            quickJobInviteModal.hide();
            pendingQuickInviteId = null;
            pendingQuickInviteData = null;
        }
    }
}

async function quickChatCancelInvite(jobId) {
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;
    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'open',
            invitedUid: null,
            invitedName: null,
            invitedBy: null,
            invitedByName: null,
            invitedAt: null,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Lỗi hủy chỉ định:', error);
        showNotification('Lỗi', 'Không thể hủy chỉ định.', false, 'danger');
    }
}

async function quickChatComplete(jobId) {
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;
    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        if (job.createdBy && job.createdBy !== currentUser.uid) {
            await pushNotification(
                job.createdBy,
                'quickjob_completed',
                `${currentUser.displayName || currentUser.email} đã hoàn thành job "${job.content}"`
            );
        }
    } catch (error) {
        console.error('Lỗi hoàn thành job:', error);
        showNotification('Lỗi', 'Không thể cập nhật hoàn thành.', false, 'danger');
    }
}

async function quickChatReject(jobId) {
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;
    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            status: 'open',
            assigneeUid: null,
            assigneeName: null,
            time: null,
            updatedAt: new Date().toISOString()
        });
        if (job.createdBy && job.createdBy !== currentUser.uid) {
            await pushNotification(
                job.createdBy,
                'quickjob_rejected',
                `${currentUser.displayName || currentUser.email} đã từ chối job "${job.content}"`
            );
        }
        showNotification('Đã từ chối', `Bạn đã từ chối job "${job.content}". Job đã trở lại danh sách chờ.`, false, 'warning');
    } catch (error) {
        console.error('Lỗi từ chối job:', error);
        showNotification('Lỗi', 'Không thể từ chối job.', false, 'danger');
    }
}

// Sửa job trong ngày (chỉ người tạo)
function quickChatShowEditForm(jobId) {
    const bubble = document.querySelector(`.quick-chat-bubble[data-job-id="${jobId}"]`);
    if (!bubble) return;
    const form = document.getElementById(`editForm-${jobId}`);
    const content = document.getElementById(`content-${jobId}`);
    if (form) form.classList.remove('d-none');
    if (content) content.classList.add('d-none');
}

function quickChatCancelEditForm() {
    renderQuickChat();
}

async function quickChatSaveEdit(jobId) {
    const contentInput = document.getElementById(`editContent-${jobId}`);
    const deadlineInput = document.getElementById(`editDeadline-${jobId}`);
    if (!contentInput) return;
    const newContent = contentInput.value.trim();
    if (!newContent) {
        showNotification('Thiếu nội dung', 'Nội dung job không được để trống.', false, 'warning');
        return;
    }

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            content: newContent,
            deadline: deadlineInput && deadlineInput.value ? deadlineInput.value : null,
            edited: true,
            editedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Lỗi sửa job:', error);
        showNotification('Lỗi', 'Không thể lưu chỉnh sửa.', false, 'danger');
    }
}

// Xóa job trong ngày (chỉ người tạo)
async function quickChatDeleteJob(jobId) {
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job || !currentUser) return;
    if (job.createdBy !== currentUser.uid) return;

    if (!confirm(`Xóa job "${job.content}"? Hành động này không thể hoàn tác.`)) return;

    try {
        await deleteDoc(doc(db, 'quickJobs', jobId));
        showNotification('Đã xóa', 'Job đã được xóa khỏi khung chat.', false, 'success');
    } catch (error) {
        console.error('Lỗi xóa job:', error);
        showNotification('Lỗi', 'Không thể xóa job.', false, 'danger');
    }
}

function openQuickChatPanel() {
    const panel = document.getElementById('quickChatPanel');
    const toggle = document.getElementById('quickChatToggleBtn');
    if (!panel) return;
    quickChatPanelOpen = true;
    panel.classList.add('show');
    if (toggle) {
        toggle.classList.add('active');
        toggle.classList.add('d-none');
    }
    quickChatUnreadCount = 0;
    updateQuickChatBadge();
    setTimeout(() => {
        const container = document.getElementById('quickChatMessages');
        if (container) container.scrollTop = container.scrollHeight;
    }, 50);
}

function closeQuickChatPanel() {
    const panel = document.getElementById('quickChatPanel');
    const toggle = document.getElementById('quickChatToggleBtn');
    if (!panel) return;
    quickChatPanelOpen = false;
    panel.classList.remove('show');
    if (toggle) {
        toggle.classList.remove('active');
        toggle.classList.remove('d-none');
    }
}

function toggleQuickChatPanel() {
    if (quickChatPanelOpen) {
        closeQuickChatPanel();
    } else {
        openQuickChatPanel();
    }
}

function initQuickChatUi() {
    const toggleBtn = document.getElementById('quickChatToggleBtn');
    const closeBtn = document.getElementById('quickChatCloseBtn');
    const sendBtn = document.getElementById('quickChatSendBtn');
    const input = document.getElementById('quickChatInput');
    const messages = document.getElementById('quickChatMessages');
    const notifBell = document.getElementById('notifBellBtn');
    const inviteAcceptBtn = document.getElementById('quickJobInviteAcceptBtn');
    const inviteRejectBtn = document.getElementById('quickJobInviteRejectBtn');
    const tabAll = document.getElementById('quickChatTabAll');
    const tabMine = document.getElementById('quickChatTabMine');
    const guideBtn = document.getElementById('guideBtn');
    const searchInput = document.getElementById('quickChatSearchInput');
    const statusFilter = document.getElementById('quickChatStatusFilter');
    const assigneeFilter = document.getElementById('quickChatAssigneeFilter');

    // ===== Nút mở rộng bộ lọc =====
    const filterToggle = document.getElementById('quickChatFilterToggle');
    const filterExtra  = document.getElementById('quickChatFilterExtra');
    const filterBadge  = document.getElementById('quickChatFilterBadge');

    function updateQuickChatFilterBadge() {
        let count = 0;
        if (quickChatStatusFilter !== 'all') count++;
        if (quickChatAssigneeFilter !== 'all') count++;
        if (filterBadge) {
            filterBadge.textContent = String(count);
            filterBadge.classList.toggle('d-none', count === 0);
        }
    }

    function setQuickChatFilterOpen(open) {
        if (!filterExtra || !filterToggle) return;
        filterExtra.classList.toggle('show', open);
        filterToggle.classList.toggle('active', open);
        filterToggle.setAttribute('aria-expanded', String(open));
    }

    if (filterToggle && filterExtra) {
        filterToggle.addEventListener('click', () => {
            setQuickChatFilterOpen(!filterExtra.classList.contains('show'));
        });
    }

    // Mở sẵn panel nếu đang có filter ngoài 'all' (mở lại panel chat giữa chừng)
    if (quickChatStatusFilter !== 'all' || quickChatAssigneeFilter !== 'all') {
        setQuickChatFilterOpen(true);
    }
    updateQuickChatFilterBadge();
    // ==============================
    
    if (tabAll) tabAll.addEventListener('click', () => setQuickChatTab('all'));
    if (tabMine) tabMine.addEventListener('click', () => setQuickChatTab('mine'));
    if (guideBtn) guideBtn.addEventListener('click', () => guideModal.show());

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            quickChatSearchText = searchInput.value.trim();
            renderQuickChat();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            quickChatStatusFilter = statusFilter.value;
            renderQuickChat();
        });
    }
    if (assigneeFilter) {
        assigneeFilter.addEventListener('change', () => {
            quickChatAssigneeFilter = assigneeFilter.value;
            renderQuickChat();
        });
    }

    if (toggleBtn) toggleBtn.addEventListener('click', toggleQuickChatPanel);
    if (closeBtn) closeBtn.addEventListener('click', closeQuickChatPanel);
    if (sendBtn) sendBtn.addEventListener('click', sendQuickJob);
    if (notifBell) notifBell.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifDropdown();
    });
    if (inviteAcceptBtn) inviteAcceptBtn.addEventListener('click', () => {
        if (pendingQuickInviteId) quickChatAcceptInvite(pendingQuickInviteId);
    });
    if (inviteRejectBtn) inviteRejectBtn.addEventListener('click', () => {
        if (pendingQuickInviteId) quickChatRejectInvite(pendingQuickInviteId);
    });

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuickJob();
            }
        });
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 90) + 'px';
        });
    }

    if (messages) {
        messages.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const jobId = btn.dataset.id;
            if (action === 'self-claim') quickChatSelfClaim(jobId);
            else if (action === 'show-assign') quickChatShowAssignForm(jobId);
            else if (action === 'cancel-assign') quickChatCancelAssignForm(jobId);
            else if (action === 'confirm-assign') quickChatConfirmAssign(jobId);
            else if (action === 'accept-invite') quickChatAcceptInvite(jobId);
            else if (action === 'reject-invite') quickChatRejectInvite(jobId);
            else if (action === 'cancel-invite') quickChatCancelInvite(jobId);
            else if (action === 'complete') quickChatComplete(jobId);
            else if (action === 'reject') quickChatReject(jobId);
            else if (action === 'show-transfer') quickChatShowTransferForm(jobId);
            else if (action === 'cancel-transfer') quickChatCancelTransferForm(jobId);
            else if (action === 'confirm-transfer') quickChatConfirmTransfer(jobId);
            else if (action === 'show-edit') quickChatShowEditForm(jobId);
            else if (action === 'cancel-edit') quickChatCancelEditForm(jobId);
            else if (action === 'save-edit') quickChatSaveEdit(jobId);
            else if (action === 'delete') quickChatDeleteJob(jobId);
        });
    }

    // Đóng dropdown thông báo khi click ra ngoài
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notifDropdown');
        const bell = document.getElementById('notifBellBtn');
        if (notifDropdownOpen && dropdown && !dropdown.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
            notifDropdownOpen = false;
            dropdown.classList.remove('show');
        }
    });

    // Click ra ngoài khung chat "Job trong ngày" -> tự động ẩn
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('quickChatPanel');
        const toggle = document.getElementById('quickChatToggleBtn');
        if (!quickChatPanelOpen || !panel) return;
        if (panel.contains(e.target)) return;
        if (toggle && toggle.contains(e.target)) return;
        // Không đóng nếu đang thao tác trên modal chỉ định job (backdrop static)
        const inviteModalEl = document.getElementById('quickJobInviteModal');
        if (inviteModalEl && inviteModalEl.contains(e.target)) return;
        closeQuickChatPanel();
    });
}

/// ============================================================
// LAYOUT DROPDOWN — tự quản lý, không dùng Bootstrap
// để không bị cắt bởi overflow của .card và #sidebar
// ============================================================
function initLayoutDropdown() {
    const btn = document.getElementById('layoutMenuBtn');
    if (!btn) return;
    const menu = btn.parentElement.querySelector('.layout-dropdown-menu');
    if (!menu) return;

    // Chuyển menu ra body để không tổ tiên nào cắt được
    if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
    }

    let isOpen = false;

    function position() {
        const r = btn.getBoundingClientRect();
        menu.style.maxWidth = Math.min(420, window.innerWidth - 16) + 'px';

        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = r.bottom + 8;
        let left = r.left;

        if (left + mw > vw - 8) left = Math.max(8, r.right - mw);
        if (left < 8) left = 8;

        if (top + mh > vh - 8) {
            const aboveTop = r.top - mh - 8;
            if (aboveTop >= 8) {
                top = aboveTop;
                menu.style.maxHeight = '';
            } else {
                top = 8;
                menu.style.maxHeight = (vh - 16) + 'px';
            }
        } else {
            menu.style.maxHeight = '';
        }

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function openMenu() {
        if (isOpen) return;
        isOpen = true;
        menu.style.top = '-9999px';
        menu.style.left = '-9999px';
        menu.classList.add('show');
        btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => requestAnimationFrame(position));
        setTimeout(() => {
            document.addEventListener('click', onDocClick, true);
            window.addEventListener('resize', position);
            window.addEventListener('scroll', position, true);
        }, 0);
    }

    function closeMenu() {
        if (!isOpen) return;
        isOpen = false;
        menu.classList.remove('show');
        btn.setAttribute('aria-expanded', 'false');
        // Đẩy ra ngoài viewport để chắc chắn không chặn click khi đã đóng
        setTimeout(() => {
            if (!isOpen) {
                menu.style.top = '-9999px';
                menu.style.left = '-9999px';
            }
        }, 200);
        document.removeEventListener('click', onDocClick, true);
        window.removeEventListener('resize', position);
        window.removeEventListener('scroll', position, true);
    }

    function onDocClick(e) {
        if (menu.contains(e.target) || btn.contains(e.target)) return;
        closeMenu();
    }

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) closeMenu(); else openMenu();
    });

    // Đóng menu sau khi chọn item, sau khi handler của item chạy xong
    menu.querySelectorAll('.layout-dropdown-item').forEach(item => {
        item.addEventListener('click', () => setTimeout(closeMenu, 100));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closeMenu();
    });
}

// Delete Job
async function deleteJob() {
    if (!currentEditingJobId) return;
    
    const jobToDelete = jobs.find(j => j.id === currentEditingJobId);
    const jobTitle = jobToDelete ? jobToDelete.title : 'job này';
    
    showConfirmDialog({
        title: 'Xác nhận xóa',
        message: `Bạn có chắc chắn muốn xóa job "${jobTitle}"?`,
        confirmText: 'Xóa ngay',
        confirmClass: 'btn-delete',
        onConfirm: async () => {
            try {
                const deleteBtn = document.getElementById('deleteJobBtn');
                const originalHTML = deleteBtn.innerHTML;
                deleteBtn.innerHTML = '<span class="loading"></span> Đang xóa...';
                deleteBtn.disabled = true;
                
                const jobRef = doc(db, 'jobs', currentEditingJobId);
                await deleteDoc(jobRef);
                console.log('✅ Job đã được xóa:', currentEditingJobId);
                showNotification('Đã xóa', `Job "${jobTitle}" đã được xóa!`, false, 'success');
                
                deleteBtn.innerHTML = originalHTML;
                deleteBtn.disabled = false;
                jobModal.hide();
            } catch (error) {
                console.error('❌ Lỗi khi xóa job:', error);
                showNotification('Lỗi', 'Có lỗi xảy ra khi xóa job. Vui lòng thử lại.', false, 'danger');
                
                const deleteBtn = document.getElementById('deleteJobBtn');
                deleteBtn.innerHTML = '<i class="bi bi-trash-fill"></i> Xóa Job';
                deleteBtn.disabled = false;
            }
        }
    });
}

// Toggle Sidebar Visibility
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    
    sidebarVisible = !sidebarVisible;
    
    if (sidebarVisible) {
        // Show sidebar
        sidebar.classList.remove('hidden');
        mainContent.classList.remove('expanded');
        toggleBtn.classList.remove('sidebar-hidden');
        toggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-inset"></i>';
        toggleBtn.title = 'Ẩn Sidebar';
    } else {
        // Hide sidebar
        sidebar.classList.add('hidden');
        mainContent.classList.add('expanded');
        toggleBtn.classList.add('sidebar-hidden');
        toggleBtn.innerHTML = '<i class="bi bi-layout-sidebar-inset-reverse"></i>';
        toggleBtn.title = 'Hiện Sidebar';
    }
    
    // Add animation effect
    toggleBtn.style.animation = 'none';
    setTimeout(() => {
        toggleBtn.style.animation = '';
    }, 10);
    saveSidebarState();
}

// Save sidebar state to localStorage (optional)
function saveSidebarState() {
    localStorage.setItem('sidebarVisible', sidebarVisible);
}

// Load sidebar state from localStorage (optional)
function loadSidebarState() {
    const savedState = localStorage.getItem('sidebarVisible');
    if (savedState !== null) {
        sidebarVisible = savedState === 'true';
        if (!sidebarVisible) {
            toggleSidebar();
        }
    }
}

function showConfirmDialog({ title = 'Xác nhận', message = 'Bạn có chắc chắn muốn tiếp tục?', confirmText = 'Xác nhận', confirmClass = 'btn-save', onConfirm }) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const okBtn = document.getElementById('confirmOkBtn');

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmText;
    okBtn.className = `btn ${confirmClass} btn-sm`;
    pendingConfirmCallback = typeof onConfirm === 'function' ? onConfirm : null;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => okBtn.focus(), 50);
}

function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    pendingConfirmCallback = null;
}

// Show Notification
function showNotification(title, message, isSystemNotification = false, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const typeConfig = {
        success: { icon: 'bi-check-circle-fill', accent: '#16a34a' },
        warning: { icon: 'bi-exclamation-triangle-fill', accent: '#f59e0b' },
        danger: { icon: 'bi-x-circle-fill', accent: '#dc2626' },
        info: { icon: 'bi-bell-fill', accent: '#667eea' }
    };

    const config = typeConfig[type] || typeConfig.info;
    notification.innerHTML = `
        <div class="notification-icon" style="color:${config.accent}">
            <i class="bi ${config.icon}"></i>
        </div>
        <div class="notification-content">
            <h6>${title}</h6>
            <p>${message}</p>
        </div>
        <button class="notification-close" aria-label="Đóng thông báo">&times;</button>
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    if (isSystemNotification && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#6366f1"/><path d="M32 14a12 12 0 0 0-12 12v8l-4 6h32l-4-6v-8a12 12 0 0 0-12-12zm-5 30a5 5 0 0 0 10 0z" fill="#fff"/></svg>')
        });
    }
    
}

function rebuildScheduleWorkHoursMap() {
    const map = {};
    const myDept = String((currentUser && currentUser.department) || '').trim();
    workHoursAll.forEach(w => {
        if (String(w.department || '').trim() === myDept) map[w.date] = w;
    });
    scheduleWorkHoursMap = map;
}

// ============================================================
// JOB DAY OVERRIDES — đổi giờ / dời ngày / note nhanh cho 1 ngày
// ============================================================

function listenJobDayOverrides() {
    if (!currentUser) return;
    if (unsubscribeJobDayOverrides) unsubscribeJobDayOverrides();

    const q = query(
        collection(db, 'jobDayOverrides'),
        where('userId', '==', currentUser.uid)
    );

    unsubscribeJobDayOverrides = onSnapshot(q, (snapshot) => {
        jobDayOverridesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSchedule();
    }, (error) => {
        console.error('❌ Lỗi lắng nghe jobDayOverrides:', error);
    });
}

function getOverrideFor(jobId, occurrenceDateKey) {
    return jobDayOverridesList.find(o =>
        o.jobId === jobId && o.occurrenceDate === occurrenceDateKey
    ) || null;
}

// Check Notifications - WITH DESKTOP NOTIFICATIONS
function checkNotifications() {
    const now = new Date();
    const lead = notifyLeadMinutes;

    jobs.forEach(job => {
        if (job.isPaused === true || job.isOutOfSchedule === true) return;
        if (job.enableNotification === false || !job.time) return;

        // Xét hôm nay và ngày mai (job 00:10 nhắc trước 30 phút sẽ rơi vào hôm trước)
        for (let offset = 0; offset <= 1; offset++) {
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
            const [hh, mm] = String(job.time).split(':').map(Number);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
            const dueAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
            if (dueAt.getTime() < now.getTime() - 120000) continue;
            if (!isJobScheduledOnDate(job, day)) continue;

            const dateKey = localDateKey(day);
            const slots = [{ at: dueAt, kind: 'due' }];
            if (lead > 0) slots.push({ at: new Date(dueAt.getTime() - lead * 60000), kind: 'lead' });

            slots.forEach(({ at, kind }) => {
                const elapsed = now.getTime() - at.getTime();
                if (elapsed < 0 || elapsed >= 120000) return;   // chỉ nhắc trong 2 phút kể từ mốc
                const key = `notified_${job.id}_${dateKey}_${job.time}_${kind}${kind === 'lead' ? lead : ''}`;
                if (localStorage.getItem(key)) return;
                localStorage.setItem(key, 'true');
                const message = kind === 'lead'
                    ? `Còn ${lead} phút nữa (${job.time}): ${job.title}`
                    : `Đã đến giờ thực hiện: ${job.title}`;
                showNotification('🔔 Nhắc nhở Job', message, true);
                showDesktopNotification(job);
            });
        }
    });
}

// Show Desktop Notification - Works across all apps
function showDesktopNotification(job) {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
        console.warn('Browser không hỗ trợ Desktop Notifications');
        return;
    }
    
    // Check permission
    if (Notification.permission === 'granted') {
        createNotification(job);
    } else if (Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                createNotification(job);
            }
        });
    }
}

function createNotification(job) {
    const typeLabels = {
        once: 'Once',
        daily: 'Daily',
        weekly: 'Weekly',
        biweekly: 'Biweekly',
        monthly: 'Monthly',
        custom: 'Ngoài lịch'
    };
    
    const typeLabel = typeLabels[job.type] || job.type;
    
    // Create notification with options (removed actions - not supported by standard Notification API)
    const notification = new Notification('🔔 Nhắc Nhở Job - Job Schedule Manager', {
        body: `${job.title}\n⏰ ${job.time} - ${typeLabel}`,
        icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        tag: `job-${job.id}`, // Prevent duplicate notifications
        requireInteraction: true, // Notification stays until user interacts
        vibrate: [200, 100, 200], // Vibration pattern (if supported)
        silent: false, // Play sound
        data: {
            jobId: job.id,
            jobTitle: job.title,
            jobTime: job.time
        }
    });
    
    // Handle notification click
    notification.onclick = function(event) {
        event.preventDefault(); // Prevent default browser behavior
        window.focus(); // Focus the window
        
        // Open the job modal
        const clickedJob = jobs.find(j => j.id === job.id);
        if (clickedJob) {
            openViewJobModal(clickedJob);
        }
        
        notification.close();
    };
    
    // Handle notification close
    notification.onclose = function() {
        console.log('Notification closed for job:', job.title);
    };
    
    // Handle notification error
    notification.onerror = function() {
        console.error('Notification error for job:', job.title);
    };
    
    // Auto-close after 30 seconds (optional)
    setTimeout(() => {
        if (notification) {
            notification.close();
        }
    }, 30000);
}

// Handle notification actions (if browser supports)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('notificationclick', function(event) {
        event.notification.close();
        
        if (event.action === 'view') {
            // Open the app and show job details
            event.waitUntil(
                clients.openWindow(window.location.href)
            );
        } else if (event.action === 'close') {
            // Just close the notification
            event.notification.close();
        } else {
            // Click on notification body
            event.waitUntil(
                clients.openWindow(window.location.href)
            );
        }
    });
}


function startUiRefreshLoop() {
    if (uiRefreshInterval) {
        clearInterval(uiRefreshInterval);
    }

    refreshUiForCurrentTime();

    uiRefreshInterval = setInterval(() => {
        refreshUiForCurrentTime();
    }, 15000);

    window.addEventListener('focus', refreshUiForCurrentTime);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshUiForCurrentTime();
        }
    });
}

function refreshUiForCurrentTime() {
    const now = new Date();
    const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

    if (lastUiRefreshMinute === minuteKey) {
        return;
    }

    lastUiRefreshMinute = minuteKey;
    renderSchedule();
    checkNotifications();
}

function startNotificationCheck() {
    checkNotifications();
    notificationCheckInterval = setInterval(checkNotifications, 60000);
}

// Helper Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

function formatDateShort(date) {
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ============================================================
// PRESENTER SPIN WHEEL — Quay số người thuyết trình
// ============================================================
const SPIN_WHEEL_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#14b8a6', '#3b82f6', '#ef4444', '#06b6d4', '#8b5cf6', '#22c55e', '#f97316'];
const SPIN_EXCLUDED_STORAGE_KEY = 'workpic_spin_excluded_uids';
const SPIN_TICKETS_STORAGE_KEY = 'workpic_spin_tickets';
const SPIN_MAX_TICKETS = 5;

let spinCandidates = [];      // {uid, displayName, email}
let spinExcludedUids = new Set();
let spinTickets = {};         // { uid: số phiếu (số ô trên vòng quay) }
let spinIsSpinning = false;
let spinWinner = null;
let spinAssignDate = null;    // 'YYYY-MM-DD'

function avatarInitial(user) {
    const label = user.displayName || user.email || '?';
    return label.trim().charAt(0).toUpperCase();
}

function loadExcludedUidsFromStorage() {
    try {
        const raw = localStorage.getItem(SPIN_EXCLUDED_STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) { return new Set(); }
}

function saveExcludedUidsToStorage() {
    try {
        localStorage.setItem(SPIN_EXCLUDED_STORAGE_KEY, JSON.stringify(Array.from(spinExcludedUids)));
    } catch (e) { /* ignore quota/private mode errors */ }
}

function loadSpinTicketsFromStorage() {
    try {
        const raw = localStorage.getItem(SPIN_TICKETS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
}

function saveSpinTicketsToStorage() {
    try { localStorage.setItem(SPIN_TICKETS_STORAGE_KEY, JSON.stringify(spinTickets)); }
    catch (e) { /* ignore */ }
}

function getSpinTicketCount(uid) {
    const n = parseInt(spinTickets[uid], 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), SPIN_MAX_TICKETS) : 1;
}

// Số ngẫu nhiên không thiên lệch (rejection sampling) từ bộ sinh số mật mã của trình duyệt
function secureRandomInt(max) {
    const cryptoObj = window.crypto;
    if (!cryptoObj || !cryptoObj.getRandomValues || max <= 1) return Math.floor(Math.random() * max);
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do { cryptoObj.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
}

function updateSpinCounts() {
    const people = spinCandidates.length - spinExcludedUids.size;
    const slots = getSpinActiveCandidates().length;
    document.getElementById('spinUsersCount').textContent = `${people}/${spinCandidates.length} người · ${slots} ô`;
}

async function openPresenterSpinModal() {
    presenterSpinModal.show();
    document.getElementById('spinResultCard').style.display = 'none';
    spinWinner = null;
    spinAssignDate = null;
    spinOccupiedMondaySet = null;   // nạp lại các tuần đã có người thuyết trình mỗi lần mở
    const listEl = document.getElementById('spinUsersList');
    listEl.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><br>Đang tải danh sách user...</div>';

    try {
        const snapshot = await getDocs(collection(db, 'users'));
        spinAllUsers = [];
        usersDeptLatest = {};
        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (!user.uid) return;
            spinAllUsers.push(user);
            collectUserDepts(user);
            // đồng bộ bộ phận vào cache (user cũ chưa có field => '')
            usersInfoCache[user.uid] = Object.assign(
                { displayName: user.displayName || '', email: user.email || '', avatar: user.avatar || null },
                usersInfoCache[user.uid] || {},
                { department: user.department || '' }
            );
        });
        rebuildDepartmentsList();
        fillDeptSelect(document.getElementById('spinDeptSelect'), spinDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });

        // Khôi phục danh sách đã bỏ chọn + số phiếu từ lần trước, chỉ giữ uid còn tồn tại (mọi bộ phận)
        const validUids = new Set(spinAllUsers.map(u => u.uid));
        spinExcludedUids = new Set(Array.from(loadExcludedUidsFromStorage()).filter(uid => validUids.has(uid)));
        const savedTickets = loadSpinTicketsFromStorage();
        spinTickets = {};
        Object.keys(savedTickets).forEach(uid => { if (validUids.has(uid)) spinTickets[uid] = savedTickets[uid]; });

        applySpinDeptFilter(false);
    } catch (error) {
        console.error('Lỗi tải danh sách user để quay số:', error);
        listEl.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><br>Không tải được danh sách user</div>';
    }
}

// Lọc danh sách quay số theo bộ phận đang chọn
function applySpinDeptFilter(resetResult = true) {
    spinCandidates = spinAllUsers
        .filter(u => deptMatches(u.uid, spinDeptFilter))
        .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
    if (resetResult) {
        spinWinner = null;
        const card = document.getElementById('spinResultCard');
        if (card) card.style.display = 'none';
    }
    renderSpinUsersList();
    renderSpinWheel();
}

function renderSpinUsersList() {
    const listEl = document.getElementById('spinUsersList');
    updateSpinCounts();

    if (!spinCandidates.length) {
        listEl.innerHTML = spinDeptFilter === DEPT_ALL
            ? '<div class="empty-state"><i class="bi bi-inbox"></i><br>Chưa có user nào</div>'
            : '<div class="empty-state"><i class="bi bi-inbox"></i><br>Bộ phận này chưa có thành viên.<br><small>Mỗi người chọn bộ phận trong Thông tin tài khoản.</small></div>';
        return;
    }

        listEl.innerHTML = spinCandidates.map((user, idx) => {
        const isExcluded = spinExcludedUids.has(user.uid);
        const color = SPIN_WHEEL_COLORS[idx % SPIN_WHEEL_COLORS.length];
        const tickets = getSpinTicketCount(user.uid);
        const avatarUrl = getUserAvatarUrl(user.uid);
        const avatarHtml = avatarUrl
            ? `<img class="spin-user-avatar" src="${avatarUrl}" alt="">`
            : `<span class="spin-user-avatar" style="background:${color}">${escapeHtml(avatarInitial(user))}</span>`;
        return `
            <label class="spin-user-chip ${isExcluded ? 'excluded' : ''}" data-uid="${escapeHtml(user.uid)}">
                <input type="checkbox" class="form-check-input spin-user-checkbox" ${isExcluded ? '' : 'checked'}>
                ${avatarHtml}
                <span class="spin-user-info">
                    <span class="spin-user-name">${escapeHtml(user.displayName || 'Chưa đặt tên')}</span>
                    <span class="spin-user-email">${escapeHtml(user.email || '')}</span>
                </span>
                <span class="spin-ticket" title="Số ô của người này trên vòng quay (trùng tên)">
                    <button type="button" class="spin-ticket-btn" data-ticket="-1" ${tickets <= 1 ? 'disabled' : ''} aria-label="Bớt 1 ô">−</button>
                    <span class="spin-ticket-count">${tickets}</span>
                    <button type="button" class="spin-ticket-btn" data-ticket="1" ${tickets >= SPIN_MAX_TICKETS ? 'disabled' : ''} aria-label="Thêm 1 ô">+</button>
                </span>
            </label>`;
    }).join('');

    listEl.querySelectorAll('.spin-user-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const chip = e.target.closest('.spin-user-chip');
            const uid = chip.dataset.uid;
            if (e.target.checked) {
                spinExcludedUids.delete(uid);
                chip.classList.remove('excluded');
            } else {
                spinExcludedUids.add(uid);
                chip.classList.add('excluded');
            }
            saveExcludedUidsToStorage();
            updateSpinCounts();
            renderSpinWheel();
            document.getElementById('spinResultCard').style.display = 'none';
        });
    });

    listEl.querySelectorAll('.spin-ticket-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (spinIsSpinning) return;
            const uid = btn.closest('.spin-user-chip').dataset.uid;
            const next = Math.min(Math.max(getSpinTicketCount(uid) + parseInt(btn.dataset.ticket, 10), 1), SPIN_MAX_TICKETS);
            spinTickets[uid] = next;
            saveSpinTicketsToStorage();
            renderSpinUsersList();
            renderSpinWheel();
            document.getElementById('spinResultCard').style.display = 'none';
        });
    });
}

// Mỗi "phiếu" = 1 ô trên vòng quay. Các phiếu của cùng 1 người được rải xen kẽ (không dính liền nhau)
// để nhìn công bằng; xác suất trúng của mỗi ô luôn bằng nhau.
function getSpinActiveCandidates() {
    const active = spinCandidates.filter(u => !spinExcludedUids.has(u.uid));
    const maxTickets = active.reduce((max, u) => Math.max(max, getSpinTicketCount(u.uid)), 0);
    const entries = [];
    for (let round = 1; round <= maxTickets; round++) {
        active.forEach(u => { if (getSpinTicketCount(u.uid) >= round) entries.push(u); });
    }
    return entries;
}

function renderSpinWheel() {
    const svg = document.getElementById('spinWheelSvg');
    svg.style.transform = 'rotate(0deg)';
    svg.setAttribute('data-rotation', '0');
    void svg.offsetWidth;            // force reflow
    svg.style.transition = '';
    
    const active = getSpinActiveCandidates();
    const cx = 150, cy = 150, r = 148;

    if (!active.length) {
        svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface-muted)"></circle>
            <text x="${cx}" y="${cy}" text-anchor="middle" fill="var(--muted)" font-size="14">Chưa có ai để quay</text>`;
        return;
    }

    const slice = 360 / active.length;
    const fontSize = active.length > 16 ? 8 : (active.length > 10 ? 9.5 : 11);
    let html = '';
    active.forEach((user, i) => {
        const startAngle = i * slice;
        const endAngle = startAngle + slice;
        const color = SPIN_WHEEL_COLORS[spinCandidates.findIndex(u => u.uid === user.uid) % SPIN_WHEEL_COLORS.length];
        if (active.length === 1) {
            html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#fff" stroke-width="1.5"></circle>`;
        } else {
            const p1 = polarPoint(cx, cy, r, startAngle);
            const p2 = polarPoint(cx, cy, r, endAngle);
            const largeArc = slice > 180 ? 1 : 0;
            html += `<path d="M${cx},${cy} L${p1.x},${p1.y} A${r},${r} 0 ${largeArc} 1 ${p2.x},${p2.y} Z" fill="${color}" stroke="#fff" stroke-width="1.5"></path>`;
        }

        const midAngle = startAngle + slice / 2;
        const labelPoint = polarPoint(cx, cy, r * 0.62, midAngle);
        const label = (user.displayName || user.email || '?').split(' ').pop();
        html += `<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" dominant-baseline="middle"
            fill="#fff" font-size="${fontSize}" font-weight="700" transform="rotate(${midAngle}, ${labelPoint.x}, ${labelPoint.y})">${escapeXml(label.slice(0, 10))}</text>`;
    });
    svg.innerHTML = html;
}

function polarPoint(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Công bằng: mọi ô trên vòng quay có xác suất trúng như nhau (không còn ưu tiên riêng ai).
function pickWinnerIndex(active) {
    return secureRandomInt(active.length);
}

function spinPresenterWheel() {
    if (spinIsSpinning) return;
    const active = getSpinActiveCandidates();
    if (new Set(active.map(u => u.uid)).size < 2) {
        showNotification('Không đủ người', 'Cần ít nhất 2 người khác nhau trong danh sách để quay số.', false, 'warning');
        return;
    }

    spinIsSpinning = true;
    document.getElementById('spinResultCard').style.display = 'none';
    const spinBtn = document.getElementById('spinNowBtn');
    spinBtn.disabled = true;

    // Preload chạy nền, KHÔNG block animation
    preloadOccupiedPresenterWeeks();

    const winnerIndex = pickWinnerIndex(active);
    const slice = 360 / active.length;
    const winnerCenterAngle = winnerIndex * slice + slice / 2;
    const randomJitter = (Math.random() - 0.5) * slice * 0.6;
    const extraSpins = 9 + Math.floor(Math.random() * 4);

    const svg = document.getElementById('spinWheelSvg');
    const currentRotation = parseFloat(svg.getAttribute('data-rotation') || '0');
    const currentMod = ((currentRotation % 360) + 360) % 360;

    // Góc đích (mod 360) để winner nằm dưới pointer ở trên cùng
    const targetMod = (((360 - winnerCenterAngle + randomJitter) % 360) + 360) % 360;

    // Luôn quay TIẾP về phía trước (không quay ngược lại)
    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;

    const newRotation = currentRotation + extraSpins * 360 + delta;
    svg.style.transform = `rotate(${newRotation}deg)`;
    svg.setAttribute('data-rotation', String(newRotation));
    document.getElementById('spinWheelWrap').classList.add('spinning');

    setTimeout(() => {
        spinIsSpinning = false;
        spinBtn.disabled = false;
        document.getElementById('spinWheelWrap').classList.remove('spinning');
        spinWinner = active[winnerIndex];
        spinAssignDate = computeNextAvailableMondayAsync();
        showSpinResult();
    }, 2400);
}


// Vì cần kiểm tra TẤT CẢ user (không chỉ job của mình), hàm này chạy trước khi quay để có dữ liệu tuần đã có người thuyết trình
let spinOccupiedMondaySet = null;
let spinOccupiedLoadPromise = null;

async function preloadOccupiedPresenterWeeks() {
    if (spinOccupiedMondaySet) return spinOccupiedMondaySet;
    if (spinOccupiedLoadPromise) return spinOccupiedLoadPromise;

    spinOccupiedLoadPromise = (async () => {
        try {
            const q = query(collection(db, 'jobs'), where('isPresenterJob', '==', true));
            const snapshot = await getDocs(q);
            spinOccupiedMondaySet = new Set();
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.date) spinOccupiedMondaySet.add(data.date);
            });
        } catch (error) {
            // Không crash vòng quay nếu thiếu quyền / thiếu index
            console.warn('⚠️ Bỏ qua kiểm tra tuần đã có presenter:', error.code || error.message);
            spinOccupiedMondaySet = new Set();
        } finally {
            spinOccupiedLoadPromise = null;
        }
        return spinOccupiedMondaySet;
    })();

    return spinOccupiedLoadPromise;
}

function computeNextAvailableMondayAsync() {
    // Tìm thứ 2 của tuần hiện tại
    const today = new Date();
    const day = today.getDay(); // 0=CN..6=T7
    const diffToMonday = day === 0 ? -6 : 1 - day;
    let monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const occupied = spinOccupiedMondaySet || new Set();
    let dateKey = mondayToKey(monday);
    let guard = 0;
    while (occupied.has(dateKey) && guard < 104) {
        monday.setDate(monday.getDate() + 7);
        dateKey = mondayToKey(monday);
        guard++;
    }
    return dateKey;
}

function mondayToKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function showSpinResult() {
    document.getElementById('spinResultName').textContent = spinWinner.displayName || spinWinner.email;
    const winnerIsOff = dayOffsList.some(o => o.userId === spinWinner.uid && o.date === spinAssignDate);
    document.getElementById('spinResultDate').textContent =
        `Thứ 2, ${formatDate(spinAssignDate)}${spinOccupiedMondaySet && spinOccupiedMondaySet.size ? ' (tuần gần nhất còn trống)' : ''}${winnerIsOff ? ' — ⚠️ người này đã đăng ký OFF ngày này' : ''}`;
    document.getElementById('spinResultCard').style.display = 'block';
}

async function confirmPresenterAssignment() {
    if (!spinWinner) return;
    const btn = document.getElementById('confirmSpinBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Đang xếp lịch...';
    btn.disabled = true;

    try {
        const jobData = {
            title: `🎤 Thuyết trình - ${spinWinner.displayName || spinWinner.email}`,
            type: 'once',
            date: spinAssignDate,
            time: '08:00',
            description: 'Được chỉ định qua Quay số người thuyết trình.',
            enableNotification: true,
            workOnSunday: true,
            isPaused: false,
            isOutOfSchedule: false,
            isPresenterJob: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerId: spinWinner.uid
        };
        const docRef = await addDoc(collection(db, 'jobs'), jobData);
        await pushNotification(spinWinner.uid, 'presenter',
            `🎤 Bạn được chỉ định thuyết trình vào Thứ 2, ${formatDate(spinAssignDate)}!`, docRef.id);

        if (spinOccupiedMondaySet) spinOccupiedMondaySet.add(spinAssignDate);

        showNotification('Đã xếp lịch!', `${spinWinner.displayName || spinWinner.email} sẽ thuyết trình Thứ 2, ${formatDate(spinAssignDate)}.`);
        presenterSpinModal.hide();
    } catch (error) {
        console.error('Lỗi khi xác nhận người thuyết trình:', error);
        showNotification('Lỗi', 'Không thể tạo lịch cho người thuyết trình. Vui lòng thử lại.', false, 'danger');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ============================================================
// CÚ ĐÊM 3D (chỉ chế độ tối)
// - Nằm trong lớp riêng #owlLayer (fixed, toàn màn hình) nên không bị cắt bởi card header.
// - 3D thật bằng CSS: mỗi bộ phận (đuôi, thân, 2 cánh, đầu) là 1 lớp SVG ở độ sâu Z khác nhau,
//   cả con cú dùng perspective() + preserve-3d nên khi xoay/nghiêng sẽ có thị sai & chiều sâu.
// - Bay từ xa (z âm, nhỏ) tới gần, nghiêng người theo hướng bay, vỗ cánh, ngửa người hãm đà rồi đáp.
// - Bấm vào cú đang đậu: đạn bay tới, lông bay tung, cú rơi xoay xuống; ít giây sau con khác bay về.
// ============================================================
const OwlFx = (() => {
    const W = 56, H = 56, PERSP = 700;
    const OWL_SCALE = 0.7;
    const HUES = [0, -8, 8, -14, 14];
    let layer = null, owl = null, parts = {};
    let mode = 'none';                 // none | fly | settle | perch | shot | fall
    let A = {};                        // dữ liệu animation hiện tại
    let raf = 0, last = 0, phase = 0, spawnTimer = 0, spawnCount = 0, perchRange = null;

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (x, y, t) => x + (y - x) * t;
    const bez = (p0, p1, p2, p3, u) => { const k = 1 - u; return k*k*k*p0 + 3*k*k*u*p1 + 3*k*u*u*p2 + u*u*u*p3; };
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <radialGradient id="owlBodyG" cx="42%" cy="30%" r="80%"><stop offset="0" stop-color="#b79470"/><stop offset=".55" stop-color="#8a6a4d"/><stop offset="1" stop-color="#5a4230"/></radialGradient>
        <radialGradient id="owlBellyG" cx="50%" cy="25%" r="75%"><stop offset="0" stop-color="#f7ead0"/><stop offset="1" stop-color="#d0b68a"/></radialGradient>
        <radialGradient id="owlHeadG" cx="45%" cy="30%" r="80%"><stop offset="0" stop-color="#c0a07a"/><stop offset=".6" stop-color="#8f6f51"/><stop offset="1" stop-color="#5d4532"/></radialGradient>
        <radialGradient id="owlDiscG" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#fff6de"/><stop offset="1" stop-color="#e3c995"/></radialGradient>
        <radialGradient id="owlIrisG" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe680"/><stop offset=".65" stop-color="#f5a623"/><stop offset="1" stop-color="#b8650c"/></radialGradient>
        <linearGradient id="owlWingG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a28060"/><stop offset="1" stop-color="#4f3a29"/></linearGradient>
        <linearGradient id="owlBeakG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9cf63"/><stop offset="1" stop-color="#d4851a"/></linearGradient>
    </defs></svg>`;

    const WING = `<path d="M31 48 C20 50 11 62 10 78 L9 90 Q10 97 15 92 L17 98 Q21 99 23 92 L26 99 Q31 98 31 90 L35 96 Q39 94 38 84 C40 72 39 58 36 49 Z" fill="url(#owlWingG)" stroke="#3f2d1f" stroke-width=".8"/>
        <path d="M33 52 L16 88 M34 57 L24 93 M35 60 L31 91" stroke="#3f2d1f" stroke-width=".9" fill="none" opacity=".6" stroke-linecap="round"/>
        <path d="M15 62 q4 4 8 0 M14 70 q4 4 8 0 M24 62 q4 4 8 0 M23 70 q4 4 8 0" stroke="#c9ad85" stroke-width="1.1" fill="none" opacity=".75" stroke-linecap="round"/>`;

    function owlMarkup(hue) {
        return `<div class="owl3d" style="--owl-hue:${hue}deg">
            <svg class="o-part o-tail" viewBox="0 0 100 100"><path d="M36 78 L32 101 L50 96 L68 101 L64 78 Z" fill="#5b4330" stroke="#3f2d1f" stroke-width=".8"/><path d="M42 82 L41 97 M50 82 L50 96 M58 82 L59 97" stroke="#7d6044" stroke-width="1" fill="none"/></svg>
            <svg class="o-part o-body" viewBox="0 0 100 100">
                <ellipse cx="50" cy="66" rx="25" ry="30" fill="url(#owlBodyG)"/>
                <ellipse cx="50" cy="72" rx="16.5" ry="22" fill="url(#owlBellyG)"/>
                <path d="M40 58 q10 6 20 0 M38 66 q12 7 24 0 M39 74 q11 7 22 0 M41 82 q9 6 18 0" stroke="#9c7f55" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
                <path d="M42 94 l-3 5 M42 94 l0 5.5 M42 94 l3 5 M58 94 l-3 5 M58 94 l0 5.5 M58 94 l3 5" stroke="#e5a52c" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
            <svg class="o-part o-wl" viewBox="0 0 100 100"><g>${WING}</g></svg>
            <svg class="o-part o-wr" viewBox="0 0 100 100"><g transform="translate(100,0) scale(-1,1)">${WING}</g></svg>
            <svg class="o-part o-head" viewBox="0 0 100 100">
                <path d="M26 22 L22 3 L40 15 Z" fill="#6c5139"/><path d="M74 22 L78 3 L60 15 Z" fill="#6c5139"/>
                <path d="M27 18 L25 8 L35 15 Z" fill="#a7865f"/><path d="M73 18 L75 8 L65 15 Z" fill="#a7865f"/>
                <ellipse cx="50" cy="34" rx="29" ry="24" fill="url(#owlHeadG)"/>
                <circle cx="37" cy="36" r="15" fill="url(#owlDiscG)" stroke="#7a5d40" stroke-width="1.2"/>
                <circle cx="63" cy="36" r="15" fill="url(#owlDiscG)" stroke="#7a5d40" stroke-width="1.2"/>
                <path d="M50 21 L45 34 M50 21 L55 34" stroke="#7a5d40" stroke-width="1.4" stroke-linecap="round"/>
                <circle cx="37" cy="36" r="9" fill="url(#owlIrisG)"/><circle cx="63" cy="36" r="9" fill="url(#owlIrisG)"/>
                <circle cx="37" cy="36" r="5" fill="#120d18"/><circle cx="63" cy="36" r="5" fill="#120d18"/>
                <ellipse cx="34.5" cy="33.3" rx="2.1" ry="1.7" fill="#fff"/><ellipse cx="60.5" cy="33.3" rx="2.1" ry="1.7" fill="#fff"/>
                <circle cx="39.5" cy="38.5" r=".9" fill="#fff" opacity=".7"/><circle cx="65.5" cy="38.5" r=".9" fill="#fff" opacity=".7"/>
                <ellipse class="o-lid" cx="37" cy="36" rx="9.4" ry="9.4" fill="#9a7b5f"/><ellipse class="o-lid" cx="63" cy="36" rx="9.4" ry="9.4" fill="#9a7b5f"/>
                <path d="M46 42 Q50 39.5 54 42 L50 53 Z" fill="url(#owlBeakG)" stroke="#a8630d" stroke-width=".6"/>
            </svg>
        </div>`;
    }

    // Gradient của cú: MỘT bộ duy nhất ở <body>, dùng chung cho cú lịch làm việc và cú màn đăng nhập.
    // (Không được đặt trong phần tử có thể display:none, nếu không fill url(#...) sẽ mất => cú trong suốt.)
    function ensureDefs() {
        if (document.getElementById('owlDefsGlobal')) return;
        const d = document.createElement('div');
        d.id = 'owlDefsGlobal';
        d.setAttribute('aria-hidden', 'true');
        d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        d.innerHTML = DEFS;
        document.body.appendChild(d);
    }

    function ensureLayer() {
        if (layer) return;
        ensureDefs();
        layer = document.createElement('div');
        layer.id = 'owlLayer';
        document.body.appendChild(layer);
        layer.addEventListener('click', (e) => { if (e.target.closest('.owl3d.perched')) shoot(); });
    }

    function buildOwl() {
        const wrap = document.createElement('div');
        wrap.innerHTML = owlMarkup(HUES[spawnCount % HUES.length]);
        spawnCount += 1;
        owl = wrap.firstElementChild;
        layer.appendChild(owl);
        parts = { wl: owl.querySelector('.o-wl'), wr: owl.querySelector('.o-wr'), head: owl.querySelector('.o-head') };
        owl.style.opacity = '0';
    }

    // Điểm đậu: ngay trên chữ "Lịch Làm Việc"
    function perchPoint() {
    const h6 = document.querySelector('#mainContent .modern-card-header-text h6');
    if (!h6) return null;
    if (!perchRange) perchRange = document.createRange();
    perchRange.selectNodeContents(h6);
    const r = perchRange.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const feetY = r.top + 5;
    return {
        x: r.left + Math.min(r.width, 120) / 2,
        y: feetY - H * 0.46 * OWL_SCALE,             // ← nhân OWL_SCALE để chân vẫn chạm chữ
        visible: feetY - H > 0 && feetY < window.innerHeight + H
    };
}

    function pose(p) {
    if (!owl) return;
    const s = (p.scale == null ? 1 : p.scale) * OWL_SCALE;      // ← nhân thêm OWL_SCALE
    owl.style.opacity = p.opacity == null ? 1 : p.opacity;
    owl.style.transform =
        `translate3d(${p.x - W / 2}px,${p.y - H / 2}px,0) perspective(${PERSP}px) translateZ(${p.z || 0}px) ` +
        `rotateX(${p.pitch || 0}deg) rotateY(${p.yaw || 0}deg) rotateZ(${p.roll || 0}deg) scale(${s})`;
    const th = p.wing || 0, sw = p.sweep || 0, ws = p.wscale || 1;
    parts.wl.style.transform = `translateZ(7px) rotateY(${-sw}deg) rotateZ(${th}deg) scale(1,${ws})`;
    parts.wr.style.transform = `translateZ(7px) rotateY(${sw}deg) rotateZ(${-th}deg) scale(1,${ws})`;
    parts.head.style.transform = `translateZ(12px) translateY(${p.headDy || 0}px) rotateY(${p.headYaw || 0}deg) rotateZ(${p.headRoll || 0}deg)`;
}

    // ---------- bay ----------
    function startFly(E) {
    const vw = window.innerWidth, vh = window.innerHeight;
    A = {
        t0: performance.now(), dur: 4300,
        S:  { x: vw + 130, y: clamp(E.y - vh * 0.5, 50, Math.max(60, E.y - 140)) },
        P1: { x: vw * 0.6, y: Math.max(24, E.y - vh * 0.65) },
        roll: 0
    };
    mode = 'fly';
}

    function stepFly(now, dt) {
        const E = perchPoint();
        if (!E) { despawn(); return; }
        const t = clamp((now - A.t0) / A.dur, 0, 1);
        const u = 1 - Math.pow(1 - t, 1.9);                         // chậm dần khi tới nơi
        const P2 = { x: E.x + 340, y: E.y - 150 };
        const x = bez(A.S.x, A.P1.x, P2.x, E.x, u), y = bez(A.S.y, A.P1.y, P2.y, E.y, u);
        const u2 = Math.min(1, u + 0.02);
        const vxn = clamp((bez(A.S.x, A.P1.x, P2.x, E.x, u2) - x) / 0.02 / 1400, -1, 1);
        const flare = Math.sin(Math.PI * clamp((t - 0.72) / 0.28, 0, 1));   // ngửa người hãm đà
        phase += dt * Math.PI * 2 * lerp(6.2, 3.0, t);
        const f = Math.sin(phase);
        A.roll = lerp(A.roll, vxn * 16, 0.08);
        pose({
    x, y: y - Math.cos(phase) * 5,
    z: -260 * Math.pow(1 - u, 1.5),                 // nhẹ thôi, chủ yếu dùng scale
    roll: A.roll + 3 * Math.sin(phase * 0.5),
    yaw: vxn * 26,
    pitch: flare * 22 - (1 - t) * 8,
    wing: 58 + 24 * flare + (46 + 14 * flare) * f,
    sweep: 16 * Math.cos(phase),
    wscale: 1.55,
    headDy: Math.cos(phase) * 1.5,
    opacity: clamp(t / 0.08, 0, 1),
    scale: lerp(0.30, 1.0, u)                       // ← 0.30 xa → 1.0 khi đáp
});
        if (t >= 1) { mode = 'settle'; A = { t0: now, wing0: 58 + 70 * 0, phase0: phase }; }
    }

    function stepSettle(now, dt) {
        const E = perchPoint();
        if (!E) { despawn(); return; }
        const tt = clamp((now - A.t0) / 900, 0, 1);
        const e = 1 - Math.pow(1 - tt, 3);
        phase += dt * Math.PI * 2 * lerp(3.0, 1.2, tt);
        pose({
            x: E.x, y: E.y - 7 * Math.sin(Math.PI * tt) * (1 - tt),
            pitch: lerp(8, 0, e), wing: (1 - e) * (74 + 30 * Math.sin(phase)), sweep: (1 - e) * 10,
            wscale: lerp(1.55, 1, e), opacity: E.visible ? 1 : 0
        });
        if (tt >= 1) {
            mode = 'perch'; A = { head: 0, headTo: 0, nextLook: now + 2500 };
            owl.classList.add('perched');
        }
    }

    function stepPerch(now, dt) {
        const E = perchPoint();
        if (!E) { despawn(); return; }
        A.lastE = E;
        if (now > A.nextLook) { A.headTo = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 16); A.nextLook = now + 2200 + Math.random() * 5000; setTimeout(() => { A.headTo = 0; }, 1100); }
        A.head = lerp(A.head, A.headTo, 0.07);
        const br = Math.sin(now / 900) * 0.012;
        pose({
            x: E.x, y: E.y, roll: Math.sin(now / 1800) * 0.9, scale: 1 + br,
            headYaw: A.head, headRoll: A.head * 0.25, opacity: E.visible ? 1 : 0
        });
        owl.style.pointerEvents = E.visible ? '' : 'none';
    }

    // ---------- bị bắn & rơi ----------
    function fx(cls, x, y) {
        const el = document.createElement('i');
        el.className = cls;
        layer.appendChild(el);
        el.style.transform = `translate(${x}px,${y}px)`;
        return el;
    }

    function shoot() {
        if (mode !== 'perch' || !A.lastE) return;
        const E = A.lastE;
        mode = 'shot';
        owl.classList.remove('perched');
        const vw = window.innerWidth, vh = window.innerHeight;
        const ox = clamp(E.x - 320 + (Math.random() - 0.5) * 160, 24, vw - 24), oy = vh + 18;
        const dx = E.x - ox, dy = E.y - oy, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const flash = fx('owl-muzzle', ox, vh - 6);
        flash.animate([{ opacity: 1, transform: `translate(${ox}px,${vh - 6}px) scale(.4)` }, { opacity: 0, transform: `translate(${ox}px,${vh - 6}px) scale(1.6)` }], { duration: 160 }).onfinish = () => flash.remove();
        const b = fx('owl-bullet', ox, oy);
        b.animate([
            { transform: `translate(${ox}px,${oy}px) rotate(${ang}deg)` },
            { transform: `translate(${E.x}px,${E.y}px) rotate(${ang}deg)` }
        ], { duration: clamp(dist / 2.6, 160, 420), easing: 'linear', fill: 'forwards' }).onfinish = () => { b.remove(); impact(E); };
    }

    function impact(E) {
        if (!owl) return;
        const ring = fx('owl-ring', E.x, E.y);
        ring.animate([{ opacity: 1, transform: `translate(${E.x}px,${E.y}px) scale(1)` }, { opacity: 0, transform: `translate(${E.x}px,${E.y}px) scale(7)` }], { duration: 420, easing: 'ease-out' }).onfinish = () => ring.remove();
        for (let i = 0; i < 16; i++) {
            const fe = fx('owl-feather', E.x, E.y);
            const vx = (Math.random() - 0.5) * 260, vy = -40 - Math.random() * 190, rot = (Math.random() - 0.5) * 900;
            const dur = 900 + Math.random() * 800;
            fe.animate([
                { opacity: 1, transform: `translate(${E.x}px,${E.y}px) rotate(0deg)` },
                { opacity: 1, offset: 0.4, transform: `translate(${E.x + vx * 0.7}px,${E.y + vy}px) rotate(${rot * 0.5}deg)` },
                { opacity: 0, transform: `translate(${E.x + vx}px,${E.y + vy + 260 + Math.random() * 120}px) rotate(${rot}deg)` }
            ], { duration: dur, easing: 'cubic-bezier(.3,.6,.5,1)' }).onfinish = () => fe.remove();
        }
            mode = 'fall';
    A = {
        t0: performance.now(),
        x: E.x, y: E.y, z: 0,
        vx: (Math.random() - 0.5) * 100,           // ngang nhẹ
        vy: -80 - Math.random() * 60,              // hất lên nhẹ
        roll: 0,
        w:  (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 160),  // °/s
        pitch: 0, wp: 50 + Math.random() * 40,
        yaw: 0,    wy: (Math.random() - 0.5) * 80,
        wingsOpen: 1                               // 1 = xoè (vừa trúng đạn)
    };
    }

    function stepFall(now, dt) {
    const tt = (now - A.t0) / 1000;

    // ── Vật lý ──
    A.vy += 1500 * dt;                             // trọng lực
    A.vx *= Math.max(0, 1 - 0.8 * dt);             // cản không khí ngang
    A.x += A.vx * dt;
    A.y += A.vy * dt;

    // ── Xoay có quán tính (angular drag) ──
    const drag = Math.max(0, 1 - 0.25 * dt);
    A.w  *= drag;
    A.wp *= drag;
    A.wy *= drag;
    A.roll  += A.w  * dt;
    A.pitch += A.wp * dt;
    A.yaw   += A.wy * dt;

    // ── Cánh co vào nhanh trong ~0.35s đầu ──
    A.wingsOpen = Math.max(0, A.wingsOpen - dt * 3);

    // ── Nhỏ dần khi rơi xa camera ──
    const fallScale = Math.max(0.30, 1 - tt * 0.30);

    pose({
        x: A.x, y: A.y, z: 0,
        roll: A.roll, pitch: A.pitch, yaw: A.yaw,
        wing:   18 + A.wingsOpen * 55,             // lúc đầu xoè, sau co xuống
        sweep:  A.wingsOpen * 14,
        wscale: 1 + A.wingsOpen * 0.35,
        headYaw: 0,
        scale: fallScale,
        opacity: 1
    });

    if (A.y > window.innerHeight + H * 2 || tt > 3.5) {
        removeOwl();
        scheduleSpawn(1600);
    }
}

    // ---------- vòng lặp & vòng đời ----------
    function loop(now) {
        if (mode === 'none') { raf = 0; return; }
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        if (mode === 'fly') stepFly(now, dt);
        else if (mode === 'settle') stepSettle(now, dt);
        else if (mode === 'perch') stepPerch(now, dt);
        else if (mode === 'fall') stepFall(now, dt);
    }

    function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

    function removeOwl() {
        if (owl) owl.remove();
        owl = null; mode = 'none';
    }

    function spawn() {
        if (mode !== 'none') return;
        const E = perchPoint();
        if (!E) return;
        ensureLayer();
        buildOwl();
        if (reduced()) {                       // giảm chuyển động: đậu luôn, không bay
            mode = 'perch'; A = { head: 0, headTo: 0, nextLook: Infinity };
            owl.classList.add('perched');
        } else {
            startFly(E);
        }
        startLoop();
    }

    function scheduleSpawn(ms) {
        if (spawnTimer) clearTimeout(spawnTimer);
        spawnTimer = setTimeout(() => { spawnTimer = 0; if (wanted()) spawn(); }, ms);
    }

    
    function despawn() {
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = 0; }
    if (layer) layer.querySelectorAll('.owl-bullet,.owl-feather,.owl-ring,.owl-muzzle').forEach(n => n.remove());
    const old = owl;
    owl = null; mode = 'none';
    if (old) {
        old.classList.remove('perched');       // ← bỏ class có pointer-events: auto
        old.style.pointerEvents = 'none';      // ← chắc chắn không chặn click trong lúc fade
        old.style.transition = 'opacity .35s ease';
        old.style.opacity = '0';
        setTimeout(() => old.remove(), 400);
    }
}

    function wanted() {
        const auth = document.getElementById('authScreen');
        return document.body.classList.contains('theme-dark')
            && !!auth && auth.classList.contains('d-none')
            && window.innerWidth > 576
            && !!perchPoint();
    }

    function sync() {
        if (wanted()) {
            if (mode === 'none' && !spawnTimer) scheduleSpawn(700);
        } else if (mode !== 'none' || spawnTimer || owl) {
            despawn();
        }
    }

    function init() {
        owlSyncHook = sync;
        setInterval(sync, 1200);              // theo dõi đăng nhập/đăng xuất, ẩn/hiện header, đổi kích thước
        window.addEventListener('resize', sync);
        sync();
    }

    return { init, sync, markup: owlMarkup, ensureDefs };
})();

// ============================================================
// CÚ ĐẬU TRÊN NÚT ĐĂNG NHẬP / ĐĂNG KÝ (màn hình đăng nhập, chế độ tối)
// - Cú vô hình; chỉ hiện khi chùm đèn pin quét trúng nó.
// - Đậu trên tab đang chọn; đổi tab => bay sang tab kia (cung bay + vỗ cánh).
// - Bấm (bắn) vào cú đang hiện => đạn bay tới, cú nhảy lên né.
// - "Quên mật khẩu" + chế độ tối + chiếu đèn: cú nói "mật khẩu" trong bong bóng.
//   (TROLL: mật khẩu là chuỗi vui ngẫu nhiên, Firebase không bao giờ cho đọc mật khẩu thật.)
// ============================================================
const AuthOwl = (() => {
    const W = 56, H = 56;
    let el = null, inner = null, bubble = null, owl = null, parts = {};
    let cur = null, beam = null, lit = false, innerAnim = null, flyAnim = null;
    let track = 0, quipTimer = 0, speakTimers = [], lookTimer = 0, lastMode = 'login';
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const QUIPS = ['Hụt rồi nhé! 🦉', 'Chậm quá~', 'Bắn trượt! 😏', 'Hú hú, né được!'];
    const FAKE_PW = ['123456', 'matkhau123', 'khongcho', 'qwerty-cu', 'toilacu', 'passwordhehe', 'dung-doan-nua'];

    function ensure() {
        if (el) return true;
        const panel = document.querySelector('#authScreen .auth-panel');
        if (!panel) return false;
        el = document.createElement('div');
        el.id = 'authOwl';
        el.className = 'auth-owl';
        el.setAttribute('aria-hidden', 'true');
        OwlFx.ensureDefs();
        el.innerHTML = `<div class="auth-owl-bubble"></div><div class="auth-owl-inner">${OwlFx.markup(0)}</div>`;
        panel.appendChild(el);
        bubble = el.querySelector('.auth-owl-bubble');
        inner = el.querySelector('.auth-owl-inner');
        owl = el.querySelector('.owl3d');
        parts = { wl: owl.querySelector('.o-wl'), wr: owl.querySelector('.o-wr'), head: owl.querySelector('.o-head') };
        parts.wl.style.transform = 'translateZ(7px)';
        parts.wr.style.transform = 'translateZ(7px)';
        parts.head.style.transform = 'translateZ(12px)';
        el.addEventListener('click', onShot);
        window.addEventListener('resize', () => place(false));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(false));
        lookTimer = setInterval(look, 3800);
        return true;
    }

    // Vị trí đậu (toạ độ theo auth-panel): chân cú chạm mép trên của nút
    function target(mode) {
        const panel = el.parentElement;
        const btn = document.getElementById(mode === 'reset' ? 'authSubmitBtn' : (mode === 'register' ? 'registerTab' : 'loginTab'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect(), p = panel.getBoundingClientRect();
        if (!r.width || !p.width) return null;
        return { x: r.left - p.left + r.width / 2 - W / 2, y: r.top - p.top - H + 8 };
    }

    function place(animate, mode) {
        if (!ensure()) return;
        mode = mode || lastMode;
        const t = target(mode);
        if (!t) return;
        const from = cur;
        el.style.left = t.x + 'px';
        el.style.top = t.y + 'px';
        cur = t;
        if (flyAnim) { flyAnim.cancel(); flyAnim = null; }
        if (animate && from && !reduced() && (Math.abs(from.x - t.x) > 2 || Math.abs(from.y - t.y) > 2)) fly(from, t);
        refreshLit();
    }

    function flap(times, total, deg) {
        [['wl', 1], ['wr', -1]].forEach(([k, sgn]) => {
            parts[k].animate([
                { transform: 'translateZ(7px) rotateZ(0deg)' },
                { transform: `translateZ(7px) rotateZ(${sgn * deg}deg) scale(1,1.35)` },
                { transform: 'translateZ(7px) rotateZ(0deg)' }
            ], { duration: total / times, iterations: times, easing: 'ease-in-out' });
        });
    }

    function startTrack(ms) {
        cancelAnimationFrame(track);
        const end = performance.now() + ms;
        const loop = () => { refreshLit(); if (performance.now() < end) track = requestAnimationFrame(loop); };
        loop();
    }

    function fly(from, to) {
        const dur = 720;
        const dx = from.x - to.x, dy = from.y - to.y;
        flyAnim = el.animate(
            [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: dur, easing: 'cubic-bezier(.45,.05,.35,1)' });
        if (innerAnim) innerAnim.cancel();
        innerAnim = inner.animate([
            { transform: 'translateY(0) rotate(0deg)' },
            { transform: `translateY(-30px) rotate(${dx > 0 ? -10 : 10}deg)`, offset: .45 },
            { transform: 'translateY(0) rotate(0deg)' }
        ], { duration: dur, easing: 'ease-in-out' });
        flap(5, dur, 64);
        startTrack(dur + 80);
    }

    function moveTo(mode) {
        if (!ensure()) return;
        const prev = lastMode;
        lastMode = mode;
        clearSpeech();
        // đợi layout của mode mới ổn định rồi mới bay
        requestAnimationFrame(() => {
            place(prev !== mode, mode);
            if (mode === 'reset') onEmailChange();
        });
    }

    // Cú ngẫu nhiên xoay đầu cho sinh động
    function look() {
        if (!parts.head || !lit) return;
        const y = (Math.random() < .5 ? -1 : 1) * (10 + Math.random() * 16);
        parts.head.style.transition = 'transform .5s ease';
        parts.head.style.transform = `translateZ(12px) rotateY(${y}deg) rotateZ(${y * .2}deg)`;
        setTimeout(() => { parts.head.style.transform = 'translateZ(12px)'; }, 1100);
    }

    // ---------- chiếu đèn ----------
    function center() {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
    }

    function refreshLit() { updateLit(beam); }

    function updateLit(b) {
        beam = b;
        if (!el && !ensure()) return;
        let on = false;
        if (b && currentTheme === 'dark') {
            const c = center();
            const dx = c.x - b.ox, dy = c.y - b.oy;
            const dist = Math.hypot(dx, dy);
            let diff = Math.abs(((Math.atan2(dx, -dy) * 180 / Math.PI) - b.ang + 540) % 360 - 180);
            on = dist < 44 || (dist < 620 && diff <= 17);
        }
        if (on === lit) return;
        lit = on;
        el.classList.toggle('lit', on);
        if (on) onLit(); else clearSpeech();
    }

    // ---------- bắn ----------
    function onShot(e) {
        if (!lit) return;
        e.stopPropagation();
        const panel = el.parentElement, p = panel.getBoundingClientRect();
        const c = center();
        const o = beam ? { x: beam.ox, y: beam.oy } : { x: c.x, y: c.y + 160 };
        const dx = c.x - o.x, dy = c.y - o.y;
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const len = Math.hypot(dx, dy) || 1;
        const ex = c.x + (dx / len) * 240, ey = c.y + (dy / len) * 240;
        const b = document.createElement('i');
        b.className = 'owl-bullet auth-owl-bullet';
        panel.appendChild(b);
        const P = (x, y) => `translate(${x - p.left}px,${y - p.top}px) rotate(${ang}deg)`;
        b.animate([
            { transform: P(o.x, o.y), opacity: 1 },
            { transform: P(ex, ey), opacity: 1, offset: .8 },
            { transform: P(ex, ey), opacity: 0 }
        ], { duration: 380, easing: 'ease-in' }).onfinish = () => b.remove();
        setTimeout(dodge, 120);     // né đúng lúc đạn sắp tới
    }

    function dodge() {
        if (!inner) return;
        clearSpeech();
        if (innerAnim) innerAnim.cancel();
        const side = Math.random() < .5 ? -1 : 1;
        if (!reduced()) {
            innerAnim = inner.animate([
                { transform: 'translate(0,0) rotate(0deg)' },
                { transform: `translate(${side * 4}px,-8px) scale(1,.88)`, offset: .12 },
                { transform: `translate(${side * 10}px,-52px) rotate(${side * 14}deg)`, offset: .42 },
                { transform: `translate(${side * 6}px,-40px) rotate(${side * 6}deg)`, offset: .62 },
                { transform: 'translate(0,0) rotate(0deg)' }
            ], { duration: 780, easing: 'cubic-bezier(.3,.7,.4,1)' });
            flap(4, 640, 70);
        }
        say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 1700);
    }

    // ---------- bong bóng nói ----------
    function clearSpeech() {
        speakTimers.forEach(clearTimeout); speakTimers = [];
        clearTimeout(quipTimer);
        if (bubble) { bubble.classList.remove('show'); bubble.textContent = ''; }
    }
    function say(text, ms, mono) {
        if (!bubble) return;
        bubble.classList.toggle('mono', !!mono);
        bubble.textContent = text;
        bubble.classList.add('show');
        if (ms) { clearTimeout(quipTimer); quipTimer = setTimeout(() => bubble.classList.remove('show'), ms); }
    }

    function emailName() {
        const v = (document.getElementById('authEmail').value || '').trim();
        return v ? v.split('@')[0].slice(0, 16) : '';
    }

    // Troll mật khẩu: chỉ khi ở "Quên mật khẩu", đã có chữ trong ô email, và cú đang được chiếu đèn
    function speakPassword() {
        clearSpeech();
        const name = emailName();
        if (!name || lastMode !== 'reset' || !lit) return;
        const fake = FAKE_PW[Math.floor(Math.random() * FAKE_PW.length)];
        say(`Mật khẩu của "${name}" là…`, 0);
        speakTimers.push(setTimeout(() => say(fake, 0, true), 1200));
        speakTimers.push(setTimeout(() => say('…đùa thôi! 🤭 Bấm gửi link để đặt lại nhé.', 3600), 2600));
    }

    function onLit() { if (lastMode === 'reset') speakPassword(); }

    function onEmailChange() {
        if (!el) return;
        if (lastMode !== 'reset' || !lit) { return; }
        clearTimeout(onEmailChange.t);
        onEmailChange.t = setTimeout(speakPassword, 450);
    }

    function init() { if (ensure()) place(false, authMode); }

    return { init, moveTo, updateLit, onEmailChange };
})();

// ============================================================
// BỘ PHẬN LÀM VIỆC
// Firestore: collection "departments" (docId = slug) { name, createdBy, createdAt }
//            users/{...}.department = id bộ phận
// Không cần migrate dữ liệu: user cũ chưa có field "department" => coi như '' (chưa phân
// bộ phận) và hiển thị "Chưa phân bộ phận" để mọi người tự cập nhật sau.
// ============================================================
function deptSlug(name) {
    const slug = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || `bp-${Date.now()}`;
}

function getDeptName(id) {
    if (!id) return 'Chưa phân bộ phận';
    const d = departmentsList.find(x => x.id === id);
    return d ? d.name : id;
}

function getUserDept(uid) {
    if (usersDeptLatest[uid]) return usersDeptLatest[uid].dept || '';
    const info = usersInfoCache[uid];
    if (info && info.department !== undefined) return info.department || '';
    if (currentUser && currentUser.uid === uid) return currentUser.department || '';
    return '';
}

// Mỗi uid có thể có nhiều doc trong collection users (doc cũ giữ bộ phận cũ).
// Chỉ lấy bộ phận của doc cập nhật SAU CÙNG (updatedAt mới nhất).
function collectUserDepts(u) {
    if (!u || !u.uid) return;
    const ts = String(u.updatedAt || '');
    const cur = usersDeptLatest[u.uid];
    if (!cur || ts >= cur.ts) usersDeptLatest[u.uid] = { dept: u.department || '', ts };
}

function deptMatches(uid, filter) {
    return filter === DEPT_ALL || getUserDept(uid) === (filter || '');
}

function loadDeptPref(key) {
    try { return localStorage.getItem(`deptPref_${key}_${currentUser ? currentUser.uid : ''}`); }
    catch (e) { return null; }
}
function saveDeptPref(key, value) {
    try { localStorage.setItem(`deptPref_${key}_${currentUser ? currentUser.uid : ''}`, value); }
    catch (e) { /* ignore */ }
}

// Mặc định: bộ phận của chính mình (nếu có), lần sau nhớ lựa chọn gần nhất
function initDeptState() {
    const own = currentUser.department || '';
    const spin = loadDeptPref('spin');
    const stats = loadDeptPref('stats');
    const hours = loadDeptPref('hours');
    spinDeptFilter = spin !== null ? spin : (own || DEPT_ALL);
    statsDeptFilter = stats !== null ? stats : (own || DEPT_ALL);
    workHoursViewDept = hours !== null ? hours : own;
    const off = loadDeptPref('dayoff');
    dayOffDeptFilter = off !== null ? off : (own || DEPT_ALL);
}

function deptOptionsHtml(opts = {}) {
    let html = '';
    if (opts.all) html += `<option value="${DEPT_ALL}">Tất cả bộ phận</option>`;
    if (opts.none) html += `<option value="">${escapeHtml(opts.noneLabel || '— Chưa chọn —')}</option>`;
    departmentsList.forEach(d => { html += `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`; });
    return html;
}

function fillDeptSelect(sel, value, opts) {
    if (!sel) return;
    let html = deptOptionsHtml(opts);
    if (value && value !== DEPT_ALL && !departmentsList.some(d => d.id === value)) {
        html += `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
    }
    sel.innerHTML = html;
    sel.value = value;
}

function refreshDeptSelects() {
    fillDeptSelect(document.getElementById('profileDepartment'), currentUser ? (currentUser.department || '') : '', { none: true, noneLabel: '— Chưa chọn —' });
    fillDeptSelect(document.getElementById('spinDeptSelect'), spinDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });
    fillDeptSelect(document.getElementById('statsDeptSelect'), statsDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });
    fillDeptSelect(document.getElementById('whDeptSelect'), workHoursViewDept, { none: true, noneLabel: 'Chưa phân bộ phận' });
    fillDeptSelect(document.getElementById('dayOffDeptSelect'), dayOffDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });
}

function rebuildDepartmentsList() {
    const map = new Map();
    departmentDocs.forEach(d => map.set(d.id, d.name || d.id));
    Object.values(usersInfoCache).forEach(u => {
        if (u.department && !map.has(u.department)) map.set(u.department, u.department);
    });
    Object.values(usersDeptLatest).forEach(l => { if (l.dept && !map.has(l.dept)) map.set(l.dept, l.dept); });
    if (currentUser && currentUser.department && !map.has(currentUser.department)) {
        map.set(currentUser.department, currentUser.department);
    }
    departmentsList = Array.from(map, ([id, name]) => ({ id, name }))
        .sort((x, y) => x.name.localeCompare(y.name, 'vi'));
    refreshDeptSelects();
}

function listenDepartments() {
    if (unsubscribeDepartments) unsubscribeDepartments();
    unsubscribeDepartments = onSnapshot(collection(db, DEPT_COLLECTION), (snapshot) => {
        departmentDocs = snapshot.docs.map(d => ({ id: d.id, name: (d.data().name || d.id) }));
        rebuildDepartmentsList();
    }, (error) => {
        // Chưa có quyền/collection => vẫn chạy được, chỉ dùng bộ phận lấy từ user
        console.error('❌ Lỗi lắng nghe bộ phận:', error);
        rebuildDepartmentsList();
    });
}

async function saveUserDepartment(deptId) {
    if (!currentUser) return;
    const value = deptId || '';
    const oldValue = currentUser.department || '';

    try {
        const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        const stamp = new Date().toISOString();
        await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'users', d.id), { department: value, updatedAt: stamp })));
        usersDeptLatest[currentUser.uid] = { dept: value, ts: stamp };
        currentUser.department = value;
        if (usersInfoCache[currentUser.uid]) usersInfoCache[currentUser.uid].department = value;

        const followsOld = (pref, allValue) => {
            if (pref === null) return true;
            if (pref === oldValue) return true;
            if (allValue !== undefined && pref === allValue && !oldValue) return true;
            if (allValue === undefined && pref === '' && !oldValue) return true;
            return false;
        };

        if (followsOld(loadDeptPref('spin'),   DEPT_ALL)) { spinDeptFilter   = value || DEPT_ALL; saveDeptPref('spin',   spinDeptFilter); }
        if (followsOld(loadDeptPref('stats'),  DEPT_ALL)) { statsDeptFilter  = value || DEPT_ALL; saveDeptPref('stats',  statsDeptFilter); }
        if (followsOld(loadDeptPref('dayoff'), DEPT_ALL)) { dayOffDeptFilter = value || DEPT_ALL; saveDeptPref('dayoff', dayOffDeptFilter); }

        // Bộ lọc trong modal Update chỉ theo dept mới nếu user chưa chọn tay
        if (followsOld(loadDeptPref('hours'))) {
            workHoursViewDept = value;
            saveDeptPref('hours', workHoursViewDept);
        }

        // LỊCH CỐ ĐỊNH luôn theo dept của mình → luôn rebuild
        rebuildScheduleWorkHoursMap();
        renderSchedule();

        if (workHoursModalOpen) {
            rebuildWorkHoursMap();
            renderWorkHoursSaved();
            renderWorkHoursPreview();
        }

        rebuildDepartmentsList();
        showNotification('Đã lưu', value ? `Bộ phận của bạn: ${getDeptName(value)}.` : 'Đã bỏ chọn bộ phận.', false, 'success');
    } catch (error) {
        console.error('Lỗi lưu bộ phận:', error);
        showNotification('Lỗi', 'Không lưu được bộ phận. Thử lại sau.', false, 'danger');
        fillDeptSelect(document.getElementById('profileDepartment'), currentUser.department || '', { none: true, noneLabel: '— Chưa chọn —' });
    }
}

async function addDepartmentFromProfile() {
    const input = document.getElementById('profileNewDeptName');
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
        showNotification('Thiếu thông tin', 'Nhập tên bộ phận (ít nhất 2 ký tự).', false, 'warning');
        return;
    }
    const id = deptSlug(name);
    const existing = departmentsList.find(d => d.id === id || d.name.toLowerCase() === name.toLowerCase());
    try {
        let useId = id;
        if (existing) {
            useId = existing.id;
        } else {
            await setDoc(doc(db, DEPT_COLLECTION, id), {
                name, createdBy: currentUser.uid, createdAt: new Date().toISOString()
            });
            departmentDocs.push({ id, name });
            rebuildDepartmentsList();
        }
        input.value = '';
        document.getElementById('profileNewDeptRow').classList.add('d-none');
        document.getElementById('profileDepartment').value = useId;
        await saveUserDepartment(useId);
    } catch (error) {
        console.error('Lỗi thêm bộ phận:', error);
        showNotification('Lỗi', 'Không thêm được bộ phận. Kiểm tra Firestore rules cho collection "departments".', false, 'danger');
    }
}

function initDepartmentUi() {
    document.getElementById('profileDepartment').addEventListener('change', (e) => saveUserDepartment(e.target.value));
    document.getElementById('profileAddDeptBtn').addEventListener('click', () => {
        const row = document.getElementById('profileNewDeptRow');
        row.classList.toggle('d-none');
        if (!row.classList.contains('d-none')) document.getElementById('profileNewDeptName').focus();
    });
    document.getElementById('profileNewDeptSaveBtn').addEventListener('click', addDepartmentFromProfile);
    document.getElementById('profileNewDeptName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addDepartmentFromProfile(); }
    });

    document.getElementById('spinDeptSelect').addEventListener('change', (e) => {
        spinDeptFilter = e.target.value;
        saveDeptPref('spin', spinDeptFilter);
        applySpinDeptFilter(true);
    });
    document.getElementById('statsDeptSelect').addEventListener('change', (e) => {
        statsDeptFilter = e.target.value;
        saveDeptPref('stats', statsDeptFilter);
        renderStatistics();
    });
    document.getElementById('dayOffDeptSelect').addEventListener('change', (e) => {
        dayOffDeptFilter = e.target.value;
        saveDeptPref('dayoff', dayOffDeptFilter);
        dayOffFocusUid = null;
        if (dayOffModalOpen) renderDayOffModal();
    });
    document.getElementById('whDeptSelect').addEventListener('change', (e) => {
        workHoursViewDept = e.target.value;
        saveDeptPref('hours', workHoursViewDept);
        rebuildWorkHoursMap();
       // renderSchedule();
        renderWorkHoursSaved();
        renderWorkHoursPreview();
    });
}

// ============================================================
// GIỜ LÀM VIỆC — Motion / Station theo ngày
// Firestore: collection "workHours", mỗi ngày = 1 document, id = YYYY-MM-DD (dùng chung mọi user)
//   { date, motion, station, updatedBy, updatedByName, updatedAt }
// ============================================================
function formatWorkHours(n) {
    if (n === null || n === undefined) return '—';
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return String(Math.round(v * 100) / 100);
}

function listenWorkHours() {
    if (unsubscribeWorkHours) unsubscribeWorkHours();
    const lower = new Date();
    lower.setMonth(lower.getMonth() - 2);
    const q = query(collection(db, WORKHOURS_COLLECTION), where('date', '>=', localDateKey(lower)));
    unsubscribeWorkHours = onSnapshot(q, (snapshot) => {
        const all = [];
        snapshot.forEach(d => {
            const data = d.data();
            if (!data.date) return;
            all.push({ ...data, id: d.id, department: resolveWorkHoursDept(d.id, data) });
        });
        workHoursAll = all;
        rebuildWorkHoursMap();
        rebuildScheduleWorkHoursMap();
        renderSchedule();
        if (workHoursModalOpen) { renderWorkHoursSaved(); renderWorkHoursPreview(); }
    }, (error) => {
        console.error('❌ Lỗi khi lắng nghe giờ làm việc:', error);
        showNotification('Lỗi', 'Không tải được giờ làm việc.', false, 'danger');
    });
}

function resolveWorkHoursDept(docId, data) {
    const field = data && data.department;
    if (field !== undefined && field !== null && String(field).trim() !== '') {
        return String(field).trim();
    }
    const id = String(docId || '');
    const date = data && data.date ? String(data.date) : '';
    const idx = id.lastIndexOf('__');
    if (idx > 0 && date && id.slice(idx + 2) === date) return id.slice(0, idx).trim();
    return '';
}

// Lấy giờ của bộ phận đang xem: { 'YYYY-MM-DD': doc }
function rebuildWorkHoursMap() {
    const map = {};
    const target = String(workHoursViewDept || '').trim();
    workHoursAll.forEach(w => {
        if (String(w.department || '').trim() === target) map[w.date] = w;
    });
    workHoursMap = map;
}

// Doc id: bộ phận trống giữ id = ngày (tương thích dữ liệu cũ); có bộ phận => "<bộ phận>__<ngày>"
function workHoursDocId(dept, date) {
    return dept ? `${dept}__${date}` : date;
}

// "9.75" | "9,75" | "9.75h" -> 9.75 ; sai định dạng -> NaN
function parseWorkHoursNumber(raw) {
    let t = String(raw == null ? '' : raw).trim().replace(/h$/i, '').replace(/\s/g, '');
    if (!t) return null;
    if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.');
    else t = t.replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return parseFloat(t);
}

const isValidWhNumber = (v) => typeof v === 'number' && !Number.isNaN(v);

// d/m | d/m/yyyy | d-m-yy | yyyy-mm-dd -> 'YYYY-MM-DD' (hoặc null)
function parseWorkHoursDate(raw) {
    const t = String(raw == null ? '' : raw).trim();
    let m, y, mo, d;
    if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) {
        y = +m[1]; mo = +m[2]; d = +m[3];
    } else if ((m = t.match(/^(\d{1,2})[-\/.](\d{1,2})(?:[-\/.](\d{2,4}))?$/))) {
        d = +m[1]; mo = +m[2];
        if (m[3]) {
            y = +m[3];
            if (y < 100) y += 2000;
        } else {
            // Không ghi năm: chọn năm gần "hôm nay" nhất (xử lý qua giao thừa)
            const now = new Date();
            y = now.getFullYear();
            const cand = new Date(y, mo - 1, d);
            const diffDays = (cand - now) / 86400000;
            if (diffDays < -180) y += 1;
            else if (diffDays > 180) y -= 1;
        }
    } else {
        return null;
    }
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return localDateKey(dt);
}

function formatWorkHoursDateLabel(key) {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
}

// Phân tích text dán: mỗi dòng "ngày | Motion | Station"
function parseWorkHoursText(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];

    lines.forEach((line, idx) => {
        const cols = (line.includes('\t') ? line.split('\t') : line.split(/[;\s|]+/))
            .map(c => c.trim())
            .filter((c, i, arr) => c !== '' || arr.length <= 3);

        const date = parseWorkHoursDate(cols[0]);
        const motion  = parseWorkHoursNumber(cols[1]);
        const station = parseWorkHoursNumber(cols[2]);

        // Dòng tiêu đề (dòng đầu, không có ngày và không có số hợp lệ nào ở 2 cột sau)
        if (!date && idx === 0 && !isValidWhNumber(motion) && !isValidWhNumber(station)) return;

        const row = { line, date, motion, station, error: '', skipped: false };

        if (!date) row.error = 'Ngày không hợp lệ';
        else if (motion === null && station === null) row.error = 'Cần nhập ít nhất Motion hoặc Station';
        else if (Number.isNaN(motion)) row.error = 'Giờ Motion không hợp lệ';
        else if (Number.isNaN(station)) row.error = 'Giờ Station không hợp lệ';

        rows.push(row);
    });

    const lastIdx = {};
    rows.forEach((r, i) => { if (!r.error) lastIdx[r.date] = i; });
    rows.forEach((r, i) => { if (!r.error && lastIdx[r.date] !== i) r.skipped = true; });

    return rows;
}

function renderWorkHoursPreview() {
    const area = document.getElementById('whPasteArea');
    const host = document.getElementById('whPreview');
    const saveBtn = document.getElementById('whSaveBtn');
    const saveText = document.getElementById('whSaveBtnText');
    workHoursParsed = parseWorkHoursText(area.value);

    const usable = workHoursParsed.filter(r => !r.error && !r.skipped);
    const dupCount = usable.filter(r => workHoursMap[r.date]).length;
    document.getElementById('whPreviewCount').textContent = workHoursParsed.length;

    const fmtVal = (v) => isValidWhNumber(v)
        ? `${formatWorkHours(v)}h`
        : '<span class="text-muted">—</span>';

    if (workHoursParsed.length === 0) {
        host.innerHTML = '<div class="wh-empty">Chưa có dữ liệu</div>';
    } else {
        host.innerHTML = `<table class="wh-table">
            <thead><tr><th>Ngày</th><th>Motion</th><th>Station</th><th>Trạng thái</th></tr></thead>
            <tbody>${workHoursParsed.map(r => {
                if (r.error) {
                    return `<tr><td colspan="3" class="wh-note">${escapeHtml(r.line)}</td><td><span class="wh-tag err">${escapeHtml(r.error)}</span></td></tr>`;
                }
                const old = workHoursMap[r.date];
                let tag;
                if (r.skipped) tag = '<span class="wh-tag skip">Trùng trong dữ liệu dán · bỏ qua</span>';
                else if (old) {
                    const oM = isValidWhNumber(old.motion)  ? formatWorkHours(old.motion)  + 'h' : '—';
                    const oS = isValidWhNumber(old.station) ? formatWorkHours(old.station) + 'h' : '—';
                    tag = `<span class="wh-tag dup">Đã có · M ${oM} / S ${oS}</span>`;
                } else tag = '<span class="wh-tag new">Mới</span>';

                return `<tr class="${r.skipped ? 'is-skip' : ''}">
                    <td>${formatWorkHoursDateLabel(r.date)}</td>
                    <td>${fmtVal(r.motion)}</td>
                    <td>${fmtVal(r.station)}</td>
                    <td class="wh-note">${tag}</td></tr>`;
            }).join('')}</tbody></table>`;
    }

    saveBtn.disabled = usable.length === 0;
    saveText.textContent = usable.length === 0
        ? 'Lưu giờ làm việc'
        : `Lưu ${usable.length} ngày${dupCount ? ` (${dupCount} trùng)` : ''}`;
}

function renderWorkHoursSaved() {
    const host = document.getElementById('whSavedList');
    const todayKey = localDateKey(new Date());
    const items = Object.values(workHoursMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 40);

    // Tiêu đề block hiện bộ phận đang lọc
    const headerEl = host.closest('.wh-block')?.querySelector('.wh-block-title');
    if (headerEl) {
        const deptLabel = workHoursViewDept ? getDeptName(workHoursViewDept) : 'Chưa phân bộ phận';
        headerEl.innerHTML =
            `<i class="bi bi-calendar-check-fill"></i> Đã nhập gần đây · ${escapeHtml(deptLabel)}`;
    }

    if (items.length === 0) {
        host.innerHTML = '<div class="wh-empty">Chưa có ngày nào cho bộ phận này</div>';
        return;
    }

    host.innerHTML = items.map(it => {
        const mV = isValidWhNumber(it.motion)  ? `M: ${formatWorkHours(it.motion)}h`  : '';
        const sV = isValidWhNumber(it.station) ? `S: ${formatWorkHours(it.station)}h` : '';
        const valsText = [mV, sV].filter(Boolean).join(' · ') || '—';

        return `
            <div class="wh-saved-item" data-date="${escapeHtml(it.date)}">
                <div>
                    <strong>${formatDateShortDMY(it.date)}${it.date === todayKey ? ' · hôm nay' : ''}</strong>
                    <div class="wh-saved-vals">${valsText}</div>
                </div>
                <button type="button" class="wh-saved-del" data-act="del" title="Xóa ngày này">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>`;
    }).join('');
}

async function commitWorkHours(rows) {
    const btn = document.getElementById('whSaveBtn');
    btn.disabled = true;
    try {
        const nowIso = new Date().toISOString();
        const dept = workHoursViewDept;
        const payload = rows.map(r => ({
            date: r.date,
            motion:  isValidWhNumber(r.motion)  ? r.motion  : null,
            station: isValidWhNumber(r.station) ? r.station : null,
            department: dept,
            updatedBy: currentUser.uid,
            updatedByName: currentUser.displayName || currentUser.email || '',
            updatedAt: nowIso
        }));
        for (let i = 0; i < payload.length; i += 400) {
            const batch = writeBatch(db);
            payload.slice(i, i + 400).forEach(p =>
                batch.set(doc(db, WORKHOURS_COLLECTION, workHoursDocId(dept, p.date)), p));
            await batch.commit();
        }
        showNotification('Thành công', `Đã lưu giờ làm việc cho ${payload.length} ngày${dept ? ' · ' + getDeptName(dept) : ''}.`, false, 'success');
        document.getElementById('whPasteArea').value = '';
        renderWorkHoursPreview();
    } catch (error) {
        console.error('Lỗi lưu giờ làm việc:', error);
        showNotification('Lỗi', 'Không lưu được giờ làm việc. Kiểm tra Firestore rules cho collection "workHours".', false, 'danger');
        renderWorkHoursPreview();
    }
}

async function saveWorkHours() {
    if (!currentUser) return;
    renderWorkHoursPreview();
    const errors = workHoursParsed.filter(r => r.error);
    const usable = workHoursParsed.filter(r => !r.error && !r.skipped);
    if (usable.length === 0) return;
    const dups = usable.filter(r => workHoursMap[r.date]);

    const proceed = () => commitWorkHours(usable);
    if (dups.length === 0 && errors.length === 0) { proceed(); return; }

    const parts = [];
    if (dups.length) {
        const list = dups.slice(0, 6).map(r => formatDateShortDMY(r.date)).join(', ') + (dups.length > 6 ? ` … (+${dups.length - 6})` : '');
        parts.push(`${dups.length} ngày đã có dữ liệu (${list}) — bạn có muốn cập nhật không?`);
    }
    if (errors.length) parts.push(`${errors.length} dòng lỗi sẽ bị bỏ qua.`);
    showConfirmDialog({
        title: dups.length ? 'Có ngày bị trùng' : 'Có dòng bị lỗi',
        message: parts.join(' '),
        confirmText: dups.length ? 'Cập nhật' : 'Vẫn lưu',
        onConfirm: proceed
    });
}

function addQuickWorkHoursRow() {
    const dateVal = document.getElementById('whQuickDate').value;
    const motionRaw = document.getElementById('whQuickMotion').value.trim();
    const stationRaw = document.getElementById('whQuickStation').value.trim();

    if (!dateVal) {
        showNotification('Thiếu dữ liệu', 'Chọn ngày.', false, 'warning');
        return;
    }

    const motion = parseWorkHoursNumber(motionRaw);
    const station = parseWorkHoursNumber(stationRaw);

    if (Number.isNaN(motion) || Number.isNaN(station)) {
        showNotification('Sai định dạng', 'Giờ không hợp lệ (chỉ dùng số, có thể dùng . hoặc ,).', false, 'warning');
        return;
    }
    if (motion === null && station === null) {
        showNotification('Thiếu dữ liệu', 'Nhập ít nhất Motion hoặc Station.', false, 'warning');
        return;
    }

    const area = document.getElementById('whPasteArea');
    const motionText  = isValidWhNumber(motion)  ? String(motion)  : '';
    const stationText = isValidWhNumber(station) ? String(station) : '';
    area.value = (area.value.trim() ? area.value.replace(/\s+$/, '') + '\n' : '')
        + `${dateVal}\t${motionText}\t${stationText}`;

    document.getElementById('whQuickMotion').value = '';
    document.getElementById('whQuickStation').value = '';
    renderWorkHoursPreview();
}

function openWorkHoursModal() {
    workHoursModalOpen = true;
    document.getElementById('whQuickDate').value = localDateKey(new Date());
    rebuildWorkHoursMap();          // đảm bảo không dùng map cũ
    fillDeptSelect(document.getElementById('whDeptSelect'), workHoursViewDept, { none: true, noneLabel: 'Chưa phân bộ phận' });
    renderWorkHoursSaved();
    renderWorkHoursPreview();
    workHoursModal.show();
}

function initWorkHoursUi() {
    workHoursModal = new bootstrap.Modal(document.getElementById('workHoursModal'));
    document.getElementById('workHoursModal').addEventListener('hidden.bs.modal', () => { workHoursModalOpen = false; });
    document.getElementById('workHoursBtn').addEventListener('click', openWorkHoursModal);
    document.getElementById('whPasteArea').addEventListener('input', renderWorkHoursPreview);
    document.getElementById('whSaveBtn').addEventListener('click', saveWorkHours);
    document.getElementById('whQuickAddBtn').addEventListener('click', addQuickWorkHoursRow);
    document.getElementById('whClearBtn').addEventListener('click', () => {
        document.getElementById('whPasteArea').value = '';
        renderWorkHoursPreview();
    });
    document.getElementById('whSavedList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act="del"]');
        if (!btn) return;
        const date = btn.closest('.wh-saved-item').dataset.date;
        showConfirmDialog({
            title: 'Xóa giờ làm việc',
            message: `Xóa giờ làm việc ngày ${formatWorkHoursDateLabel(date)}?`,
            confirmText: 'Xóa',
            confirmClass: 'btn-delete',
            onConfirm: async () => {
                try { await deleteDoc(doc(db, WORKHOURS_COLLECTION, workHoursDocId(workHoursViewDept, date))); }
                catch (err) {
                    console.error('Lỗi xóa giờ làm việc:', err);
                    showNotification('Lỗi', 'Không xóa được.', false, 'danger');
                }
            }
        });
    });
}

// ============================================================
// LỊCH OFF — đăng ký ngày nghỉ & dời job trong lịch cố định
// Firestore: collection "dayOffs", mỗi ngày off = 1 document, id = `${uid}_${YYYY-MM-DD}`
//   { userId, userName, date, reason, createdAt }
// ============================================================
const DAYOFF_COLLECTION = 'dayOffs';
const DAYOFF_MONTHS_SHOWN = 2;   // tháng hiện tại + tháng sau

// Mỗi (người, ngày) chỉ được có 1 lịch off. Gộp bản trùng (race giữa snapshot realtime và cập nhật local,
// hoặc doc cũ id ngẫu nhiên): ưu tiên doc có id chuẩn `${uid}_${date}`, sau đó doc mới nhất.
let dayOffExtraIds = {};              // `${uid}|${date}` -> [id các doc trùng bị loại]
const dayOffCleaned = new Set();      // id đã gửi lệnh xóa dọn rác (tránh lặp)

function normalizeDayOffs(list) {
    const best = {};
    const extras = {};
    list.forEach(o => {
        if (!o || !o.userId || !o.date) return;
        const k = `${o.userId}|${o.date}`;
        const cur = best[k];
        if (!cur) { best[k] = o; return; }
        const rank = x => (x.id === `${x.userId}_${x.date}` ? 1 : 0);
        const winner = (rank(o) > rank(cur) || (rank(o) === rank(cur) && String(o.createdAt || '') > String(cur.createdAt || ''))) ? o : cur;
        const loser = winner === o ? cur : o;
        best[k] = winner;
        if (loser.id !== winner.id) (extras[k] = extras[k] || []).push(loser.id);
    });
    dayOffExtraIds = extras;
    return Object.values(best);
}

// Dọn nền các doc trùng của CHÍNH MÌNH trong Firestore (không đụng doc người khác)
function cleanupMyDuplicateDayOffs() {
    if (!currentUser) return;
    Object.entries(dayOffExtraIds).forEach(([k, ids]) => {
        if (!k.startsWith(currentUser.uid + '|')) return;
        ids.forEach(id => {
            if (dayOffCleaned.has(id)) return;
            dayOffCleaned.add(id);
            deleteDoc(doc(db, DAYOFF_COLLECTION, id)).catch(() => {});
        });
    });
}

function dayOffAllIds(o) {
    return [o.id].concat(dayOffExtraIds[`${o.userId}|${o.date}`] || []);
}

function listenDayOffs() {
    if (unsubscribeDayOffs) unsubscribeDayOffs();
    // Lấy từ đầu tháng trước để tuần hiện tại (có thể nằm ở tháng trước) vẫn tính đúng
    const lower = new Date();
    lower.setDate(1);
    lower.setMonth(lower.getMonth() - 1);
    const q = query(collection(db, DAYOFF_COLLECTION), where('date', '>=', localDateKey(lower)));
    unsubscribeDayOffs = onSnapshot(q, (snapshot) => {
        dayOffsList = normalizeDayOffs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        cleanupMyDuplicateDayOffs();
        renderSchedule();
        if (dayOffModalOpen) renderDayOffModal();
    }, (error) => {
        console.error('❌ Lỗi khi lắng nghe lịch off:', error);
        showNotification('Lỗi', 'Không tải được lịch off. Kiểm tra Firestore rules cho collection "dayOffs".', false, 'danger');
    });
}

function getMyOffMap() {
    const map = {};
    if (!currentUser) return map;
    dayOffsList.forEach(o => {
        if (o.userId === currentUser.uid && o.date) map[o.date] = o;
    });
    return map;
}

// Ngày làm việc liền TRƯỚC ngày off — bỏ qua các ngày off liên tiếp và Chủ Nhật nếu job không làm Chủ Nhật
function resolveShiftedDate(job, originDate, offMap) {
    const d = new Date(originDate);
    let guard = 0;
    do {
        d.setDate(d.getDate() - 1);
        guard++;
    } while (guard < 60 && (offMap[localDateKey(d)] || (d.getDay() === 0 && job.workOnSunday === false)));
    return d;
}

function buildScheduleEntries(rangeStart, rangeEnd, jobList) {
    const offMap = getMyOffMap();
    const startKey = localDateKey(rangeStart);
    const endKey = localDateKey(rangeEnd);
    const scanFrom = new Date(rangeStart);
    const scanTo = new Date(rangeEnd);
    scanTo.setDate(scanTo.getDate() + 31);

    const map = {};
    jobList.forEach(job => {
        const occurrences = getJobOccurrences(job, scanFrom, scanTo);
        const nativeKeys = new Set(occurrences.map(localDateKey));
        occurrences.forEach(date => {
            const originKey = localDateKey(date);
            let targetKey = originKey;
            let shiftedFrom = null;   // dời do off
            let movedFrom = null;     // dời do override

            // 1) Nếu ngày gốc là ngày off → dời lên ngày làm việc liền trước
            if (offMap[originKey]) {
                targetKey = localDateKey(resolveShiftedDate(job, date, offMap));
                shiftedFrom = originKey;
                if (nativeKeys.has(targetKey)) return;
            }

            // 2) Áp dụng override (đổi giờ / dời ngày / note)
            const override = getOverrideFor(job.id, originKey);
            let overrideTime = null;
            let note = null;

            if (override) {
                if (override.overrideDate && override.overrideDate !== originKey) {
                    // Dời sang ngày khác → bỏ ở ngày cũ, thêm vào ngày mới
                    movedFrom = originKey;
                    targetKey = override.overrideDate;
                }
                overrideTime = override.overrideTime || null;
                note = override.note || null;
            }

            if (targetKey < startKey || targetKey > endKey) return;

            (map[targetKey] = map[targetKey] || []).push({
                job,
                shiftedFrom,     // nếu dời do off (màu hồng)
                movedFrom,       // nếu dời do override (màu hồng)
                overrideTime,    // giờ đổi riêng cho ngày này
                note,            // ghi chú riêng cho ngày này
                originDate: originKey
            });
        });
    });
    return map;
}

function isJobScheduledOnDate(job, date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const map = buildScheduleEntries(day, day, [job]);
    return (map[localDateKey(day)] || []).length > 0;
}

// ---------------- Form đăng ký lịch off ----------------
function getDayOffUserColor(uid) {
    const idx = dayOffUsers.findIndex(u => u.uid === uid);
    return idx >= 0 ? SPIN_WHEEL_COLORS[idx % SPIN_WHEEL_COLORS.length] : '#94a3b8';
}

async function openDayOffModal() {
    if (!currentUser) return;
    dayOffModalOpen = true;
    dayOffFocusUid = null;
    dayOffSelected = new Set(Object.keys(getMyOffMap()));
    document.getElementById('dayOffReason').value = '';
    buildDayOffUsers([]);
    fillDeptSelect(document.getElementById('dayOffDeptSelect'), dayOffDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });
    dayOffModal.show();
    renderDayOffModal();

    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        // Đồng thời nạp cache avatar từ kết quả fetch này (đề phòng listener
        // listenUsersAvatars chưa fire xong hoặc chưa có user nào có avatar)
        if (!usersAvatarCache) usersAvatarCache = {};
        usersDeptLatest = {};
        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.uid) {
                users.push(user);
                collectUserDepts(user);
                if (user.avatar) usersAvatarCache[user.uid] = user.avatar;
                usersInfoCache[user.uid] = Object.assign(
                    { displayName: user.displayName || '', email: user.email || '', avatar: user.avatar || null },
                    usersInfoCache[user.uid] || {},
                    { department: user.department || '' }
                );
            }
        });
        rebuildDepartmentsList();
        buildDayOffUsers(users);
        if (dayOffModalOpen) renderDayOffModal();
    } catch (error) {
        console.error('Lỗi tải danh sách user cho lịch off:', error);
    }
}

// Gộp user từ collection users + user chỉ xuất hiện trong lịch off; mình luôn đứng đầu
function buildDayOffUsers(fetchedUsers) {
    const byUid = {};
    fetchedUsers.forEach(u => { byUid[u.uid] = { uid: u.uid, displayName: u.displayName, email: u.email }; });
    if (currentUser && !byUid[currentUser.uid]) {
        byUid[currentUser.uid] = { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email };
    }
    dayOffsList.forEach(o => {
        if (o.userId && !byUid[o.userId]) byUid[o.userId] = { uid: o.userId, displayName: o.userName, email: '' };
    });
    const label = u => u.displayName || u.email || '';
    dayOffUsers = Object.values(byUid).sort((a, b) => label(a).localeCompare(label(b)));
    dayOffUsers.sort((a, b) => (b.uid === currentUser.uid) - (a.uid === currentUser.uid));
}

function dayOffUserName(uid, fallback) {
    const u = dayOffUsers.find(x => x.uid === uid);
    return (u && (u.displayName || u.email)) || fallback || 'User';
}

function renderDayOffModal() {
    renderDayOffUsers();
    renderDayOffCalendars();
    renderDayOffSummary();
    renderDayOffDetails();
}

function countUpcomingOffs(uid, todayKey) {
    return dayOffsList.filter(o => o.userId === uid && o.date >= todayKey).length;
}

// Người có bộ phận (sau cùng) trùng bộ phận đang lọc ở form lịch off
function dayOffInDept(uid) {
    return deptMatches(uid, dayOffDeptFilter);
}

function renderDayOffUsers() {
    const todayKey = localDateKey(new Date());
    const visibleUsers = dayOffUsers.filter(u => dayOffInDept(u.uid));
    if (dayOffFocusUid && !visibleUsers.some(u => u.uid === dayOffFocusUid)) dayOffFocusUid = null;
    document.getElementById('dayOffUsersCount').textContent = visibleUsers.length;
    document.getElementById('dayOffUsersList').innerHTML = visibleUsers.map(user => {
        const isMe = user.uid === currentUser.uid;
        const name = user.displayName || user.email || 'Chưa đặt tên';
        const count = countUpcomingOffs(user.uid, todayKey);
        const avatarUrl = getUserAvatarUrl(user.uid);
        const avatarHtml = avatarUrl
            ? `<img class="dayoff-user-avatar" src="${avatarUrl}" alt="">`
            : `<span class="dayoff-user-avatar" style="background:${getDayOffUserColor(user.uid)}">${escapeHtml(avatarInitial(user))}</span>`;
        return `
            <button type="button" class="dayoff-user-row ${dayOffFocusUid === user.uid ? 'active' : ''}" data-uid="${escapeHtml(user.uid)}">
                ${avatarHtml}
                <span class="dayoff-user-name">${escapeHtml(name)}${isMe ? ' <em>(Tôi)</em>' : ''}</span>
                <span class="dayoff-user-count ${count ? '' : 'zero'}" title="Số ngày off sắp tới">${count}</span>
            </button>`;
    }).join('');
}

function renderDayOffCalendars() {
    const host = document.getElementById('dayOffCalendars');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = localDateKey(today);
    const savedMine = getMyOffMap();
    const dows = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Lịch off của NGƯỜI KHÁC theo ngày (chỉ xem)
    const othersByDate = {};
    dayOffsList.forEach(o => {
        if (o.userId === currentUser.uid) return;
        if (!dayOffInDept(o.userId)) return;
        if (dayOffFocusUid && o.userId !== dayOffFocusUid) return;
        (othersByDate[o.date] = othersByDate[o.date] || []).push(o);
    });
    // Lịch của tôi chỉ hiện khi bộ phận (sau cùng) của tôi nằm trong bộ lọc đang chọn
    const showMine = dayOffInDept(currentUser.uid) && (!dayOffFocusUid || dayOffFocusUid === currentUser.uid);

    let html = '';
    for (let m = 0; m < DAYOFF_MONTHS_SHOWN; m++) {
        const first = new Date(today.getFullYear(), today.getMonth() + m, 1);
        const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        const lead = (first.getDay() + 6) % 7;   // tuần bắt đầu từ T2

        html += `<div class="dayoff-month"><div class="dayoff-month-title"><i class="bi bi-calendar3"></i> Tháng ${first.getMonth() + 1}/${first.getFullYear()}</div><div class="dayoff-grid">`;
        dows.forEach(w => { html += `<div class="dayoff-dow">${w}</div>`; });
        for (let i = 0; i < lead; i++) html += '<div class="dayoff-day empty"></div>';

        for (let d = 1; d <= daysInMonth; d++) {
            const key = localDateKey(new Date(first.getFullYear(), first.getMonth(), d));
            const isPast = key < todayKey;
            const isSunday = (lead + d - 1) % 7 === 6;
            const isSelected = showMine && dayOffSelected.has(key);
            const isPending = isSelected && !savedMine[key];

            const entries = (othersByDate[key] || []).map(o => ({
                uid: o.userId, name: dayOffUserName(o.userId, o.userName), reason: o.reason
            }));
            if (showMine && isSelected) {
                const reason = savedMine[key] ? savedMine[key].reason : '(chưa lưu)';
                entries.unshift({
                    uid: currentUser.uid, name: 'Tôi', reason,
                    initialName: currentUser.displayName || currentUser.email || 'Tôi'
                });
            }

            const chips = entries.slice(0, 3).map(e => {
                const avatarUrl = getUserAvatarUrl(e.uid) || (e.uid === currentUser.uid ? currentUser.avatar : null);
                const tip = escapeHtml(e.name);
                if (avatarUrl) {
                    return `<img class="dayoff-chip" src="${escapeHtml(avatarUrl)}" alt="${tip}" title="${tip}">`;
                }
                return `<span class="dayoff-chip" style="background:${getDayOffUserColor(e.uid)}">${escapeHtml(avatarInitial({ displayName: e.initialName || e.name }))}</span>`;
            }).join('') + (entries.length > 3 ? `<span class="dayoff-chip more">+${entries.length - 3}</span>` : '');
            const title = entries.map(e => `${e.name}: ${e.reason || 'Off'}`).join('\n');

            const classes = ['dayoff-day'];
            if (isPast) classes.push('past');
            if (key === todayKey) classes.push('today');
            if (isSunday) classes.push('sunday');
            if (isSelected) classes.push('selected');
            if (isPending) classes.push('pending');
            if (entries.length) classes.push('has-off');

            html += `<div class="${classes.join(' ')}" data-date="${key}" title="${escapeHtml(title)}">
                <span class="dayoff-day-num">${d}</span>
                <span class="dayoff-chips">${chips}</span>
            </div>`;
        }
        html += '</div></div>';
    }
    host.innerHTML = html;
}

function getDayOffDiff() {
    const todayKey = localDateKey(new Date());
    const saved = getMyOffMap();
    const added = Array.from(dayOffSelected).filter(k => !saved[k] && k >= todayKey).sort();
    const removed = Object.keys(saved).filter(k => !dayOffSelected.has(k) && k >= todayKey).sort();
    return { added, removed, saved };
}

function renderDayOffSummary() {
    const { added, removed } = getDayOffDiff();
    const summary = document.getElementById('dayOffSummary');
    if (!added.length && !removed.length) {
        summary.innerHTML = '<span class="text-muted">Bấm vào ngày trên lịch để chọn ngày off. Bấm lại ngày đã off của bạn để hủy.</span>';
    } else {
        summary.innerHTML =
            added.map(k => `<span class="dayoff-diff-chip add">+ ${formatDateShortDMY(k)}</span>`).join('') +
            removed.map(k => `<span class="dayoff-diff-chip remove">− ${formatDateShortDMY(k)}</span>`).join('');
    }
    document.getElementById('saveDayOffBtn').disabled = !added.length && !removed.length;
    document.getElementById('dayOffReasonWrap').classList.toggle('d-none', !added.length);
}

function renderDayOffDetails() {
    const todayKey = localDateKey(new Date());
    const rows = dayOffsList
        .filter(o => o.date >= todayKey && dayOffInDept(o.userId) && (!dayOffFocusUid || o.userId === dayOffFocusUid))
                .sort((a, b) => {
            // Ưu tiên mới đăng ký (createdAt) lên đầu
            const ca = a.createdAt || '';
            const cb = b.createdAt || '';
            if (ca !== cb) return cb.localeCompare(ca);
            // Cùng thời điểm → ngày mới hơn lên trước
            return b.date.localeCompare(a.date);
        });
    const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    document.getElementById('dayOffDetailTitle').textContent = dayOffFocusUid
        ? `Lịch off của ${dayOffUserName(dayOffFocusUid)}`
        : (dayOffDeptFilter === DEPT_ALL ? 'Lịch off sắp tới của mọi người' : `Lịch off sắp tới · ${getDeptName(dayOffDeptFilter)}`);

    if (!rows.length) {
        document.getElementById('dayOffDetailList').innerHTML = '<div class="empty-state empty-state-sm"><i class="bi bi-calendar-check"></i><br>Chưa có lịch off nào</div>';
        return;
    }
        document.getElementById('dayOffDetailList').innerHTML = rows.map(o => {
        const isMine = o.userId === currentUser.uid;
        const name = dayOffUserName(o.userId, o.userName);
        const avatarUrl = getUserAvatarUrl(o.userId);
        const avatarHtml = avatarUrl
            ? `<img class="dayoff-user-avatar sm" src="${avatarUrl}" alt="">`
            : `<span class="dayoff-user-avatar sm" style="background:${getDayOffUserColor(o.userId)}">${escapeHtml(avatarInitial({ displayName: name }))}</span>`;
        return `
            <div class="dayoff-detail-row">
                <span class="dayoff-detail-date">${weekdayShort[parseJobDate(o.date).getDay()]} · ${formatDateShortDMY(o.date)}</span>
                ${avatarHtml}
                <span class="dayoff-detail-name">${escapeHtml(isMine ? `${name} (Tôi)` : name)}</span>
                <span class="dayoff-detail-reason">${escapeHtml(o.reason || '')}</span>
                ${isMine ? `<button type="button" class="dayoff-detail-del" data-off-id="${escapeHtml(o.id)}" data-off-date="${o.date}" title="Xóa ngày off này"><i class="bi bi-trash3-fill"></i></button>` : ''}
            </div>`;
    }).join('');
}

function handleDayOffCalendarClick(event) {
    const cell = event.target.closest('.dayoff-day[data-date]');
    // Chỉ chọn được ngày từ hôm nay trở đi; lịch của người khác chỉ để xem
    if (!cell || cell.classList.contains('past')) return;
    if (!dayOffInDept(currentUser.uid)) {
        showNotification('Lịch off', `Bạn đang thuộc "${getDeptName(getUserDept(currentUser.uid))}". Hãy chọn đúng bộ phận của bạn ở bộ lọc để đăng ký ngày off.`, false, 'warning');
        return;
    }
    const key = cell.dataset.date;
    if (dayOffSelected.has(key)) dayOffSelected.delete(key);
    else dayOffSelected.add(key);
    if (dayOffFocusUid && dayOffFocusUid !== currentUser.uid) dayOffFocusUid = null;
    renderDayOffModal();
}

function handleDayOffUserClick(event) {
    const row = event.target.closest('.dayoff-user-row[data-uid]');
    if (!row) return;
    dayOffFocusUid = dayOffFocusUid === row.dataset.uid ? null : row.dataset.uid;
    renderDayOffModal();
}

function handleDayOffDetailClick(event) {
    const btn = event.target.closest('[data-off-id]');
    if (!btn) return;
    const id = btn.dataset.offId;
    const date = btn.dataset.offDate;
    showConfirmDialog({
        title: 'Xóa ngày off',
        message: `Hủy lịch off ngày ${formatDateShortDMY(date)}? Job của ngày này sẽ trở lại lịch bình thường.`,
        confirmText: 'Xóa',
        confirmClass: 'btn-delete',
        onConfirm: async () => {
            try {
                const target = dayOffsList.find(o => o.id === id);
                const ids = target ? dayOffAllIds(target) : [id];
                await Promise.all(ids.map(x => deleteDoc(doc(db, DAYOFF_COLLECTION, x))));
                dayOffSelected.delete(date);
                dayOffsList = dayOffsList.filter(o => !ids.includes(o.id));
                renderSchedule();
                renderDayOffModal();
                showNotification('Đã hủy', `Đã xóa lịch off ngày ${formatDateShortDMY(date)}.`, false, 'success');
            } catch (error) {
                console.error('Lỗi xóa lịch off:', error);
                showNotification('Lỗi', 'Không thể xóa lịch off.', false, 'danger');
            }
        }
    });
}

async function saveDayOffs() {
    if (!currentUser) return;
    const { added, removed, saved } = getDayOffDiff();
    if (!added.length && !removed.length) return;

    const reasonInput = document.getElementById('dayOffReason');
    const reason = reasonInput.value.trim();
    if (added.length && !reason) {
        showNotification('Thiếu lý do', 'Vui lòng nhập lý do off cho các ngày mới chọn.', false, 'warning');
        reasonInput.focus();
        return;
    }

    const btn = document.getElementById('saveDayOffBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Đang lưu...';
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        added.forEach(key => {
            batch.set(doc(db, DAYOFF_COLLECTION, `${currentUser.uid}_${key}`), {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email || 'User',
                date: key,
                reason,
                createdAt: now
            });
        });
        removed.forEach(key => {
            dayOffAllIds(saved[key]).forEach(id => batch.delete(doc(db, DAYOFF_COLLECTION, id)));
        });
        await batch.commit();

        // Cập nhật ngay danh sách local + vẽ lại lịch cố định (không chờ snapshot)
        // Snapshot realtime có thể đã thêm các doc mới trước khi commit() trả về => gộp theo (người, ngày), không concat mù
        const removedIds = new Set(removed.flatMap(k => dayOffAllIds(saved[k])));
        dayOffsList = normalizeDayOffs(dayOffsList.filter(o => !removedIds.has(o.id)).concat(added.map(key => ({
            id: `${currentUser.uid}_${key}`, userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'User', date: key, reason, createdAt: now
        }))));
        renderSchedule();
        renderDayOffModal();

        reasonInput.value = '';
        const parts = [];
        if (added.length) parts.push(`đăng ký ${added.length} ngày off`);
        if (removed.length) parts.push(`hủy ${removed.length} ngày off`);
        showNotification('Đã lưu lịch off', `Bạn đã ${parts.join(' và ')}. Job trong ngày off đã được dời lên ngày làm việc liền trước.`, false, 'success');
    } catch (error) {
        console.error('Lỗi lưu lịch off:', error);
        showNotification('Lỗi', 'Không thể lưu lịch off. Vui lòng thử lại.', false, 'danger');
    } finally {
        btn.innerHTML = originalHTML;
        renderDayOffSummary();
    }
}

// ============================================================
// STATISTICS — Thống kê thời gian làm việc theo user
// ============================================================
// ============================================================
// TÍNH LƯƠNG — ước tính, không lưu dữ liệu, tự reset khi đóng
// Chỉ nhập LCB + số ngày/giờ; các khoản tiền suy ra tự động:
//   Đơn giá ngày = LCB / Ngày công chuẩn
//   Ngày làm việc   = đơn giá ngày × 1  × số ngày
//   Ngày lễ         = đơn giá ngày × 3  × số ngày
//   Phép năm/Nghỉ hưởng lương = đơn giá ngày × 1 × số ngày
//   Tăng ca thường  = (đơn giá ngày / 8) × 1.5 × số giờ
//   Tăng ca CN      = (đơn giá ngày / 8) × 2   × số giờ
//   BHXH/BHYT/BHTN  = LCB × 10.5%
//   Phí công đoàn   = 30.000đ cố định
// ============================================================
// Biểu thuế lũy tiến từng phần 2026 (5 bậc, rút gọn theo Thu nhập tính thuế/tháng)
const SALARY_TAX_BRACKETS_2026 = [
    { upTo: 10000000, rate: 0.05, sub: 0 },
    { upTo: 30000000, rate: 0.10, sub: 500000 },
    { upTo: 60000000, rate: 0.20, sub: 3500000 },
    { upTo: 100000000, rate: 0.30, sub: 9500000 },
    { upTo: Infinity, rate: 0.35, sub: 14500000 }
];
const SALARY_SELF_DEDUCTION_2026 = 15500000;
const SALARY_DEPENDENT_DEDUCTION_2026 = 6200000;

function calcPersonalIncomeTax2026(taxableIncome) {
    if (taxableIncome <= 0) return { tax: 0, rate: 0 };
    const bracket = SALARY_TAX_BRACKETS_2026.find(b => taxableIncome <= b.upTo);
    const tax = taxableIncome * bracket.rate - bracket.sub;
    return { tax: Math.max(tax, 0), rate: bracket.rate };
}

const SALARY_UNION_FEE = 30000;
const SALARY_INSURANCE_RATE = 0.105;
const SALARY_DEFAULT_STANDARD_DAYS = 26;
const SALARY_MONEY_FIELDS = ['salLCB'];
const SALARY_COUNT_FIELDS = ['salWorkDay', 'salHoliday', 'salAnnualLeave', 'salPaidLeave', 'salOtNormal', 'salOtSunday', 'salOtHoliday', 'salNightShift'];
const SALARY_ALL_INPUT_FIELDS = [...SALARY_MONEY_FIELDS, ...SALARY_COUNT_FIELDS, 'salStandardDays', 'salDependents'];

function formatSalaryVND(n) {
    return `${Math.round(n || 0).toLocaleString('vi-VN')} VNĐ`;
}

// Format số nguyên với dấu "." ngăn cách nghìn (vi-VN)
function formatMoneyInputValue(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('vi-VN');
}

// Parse chuỗi tiền có dấu ngăn cách: "26.000.000" -> 26000000
function parseMoney(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const digits = (el.value || '').replace(/\D/g, '');
    return parseInt(digits, 10) || 0;
}

function parseSalaryNumber(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    // Cho phép số thập phân: giữ lại chữ số và MỘT dấu , hoặc . cuối cùng làm dấu thập phân
    let raw = (el.value || '').replace(/[^\d.,]/g, '');
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimalPos = Math.max(lastComma, lastDot);
    if (decimalPos === -1) {
        raw = raw.replace(/[.,]/g, '');
    } else {
        const intPart = raw.slice(0, decimalPos).replace(/[.,]/g, '');
        const decPart = raw.slice(decimalPos + 1).replace(/[.,]/g, '');
        raw = decPart ? `${intPart}.${decPart}` : intPart;
    }
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
}

function openSalaryCalcModal() {
    resetSalaryCalc();
    salaryCalcModal.show();
}

function resetSalaryCalc() {
    SALARY_ALL_INPUT_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateSalaryTotals();
}

function updateSalaryTotals() {
        const lcb = parseMoney('salLCB');
    const standardDays = parseSalaryNumber('salStandardDays') || SALARY_DEFAULT_STANDARD_DAYS;
    const dailyRate = standardDays > 0 ? lcb / standardDays : 0;
    const hourlyRate = dailyRate / 8;

        // Ca đêm = (LCB / Ngày công chuẩn / 8) × 0.3 × số giờ + (số giờ / 8) × 10.000
    const nightShiftHours = parseSalaryNumber('salNightShift');
    const nightShiftPay = hourlyRate * 0.3 * nightShiftHours + (nightShiftHours / 8) * 10000;

    const lineValues = {
        salWorkDayValue: parseSalaryNumber('salWorkDay') * dailyRate,
        salHolidayValue: parseSalaryNumber('salHoliday') * dailyRate,
        salAnnualLeaveValue: parseSalaryNumber('salAnnualLeave') * dailyRate,
        salPaidLeaveValue: parseSalaryNumber('salPaidLeave') * dailyRate,
        salOtNormalValue: parseSalaryNumber('salOtNormal') * hourlyRate * 1.5,
        salOtSundayValue: parseSalaryNumber('salOtSunday') * hourlyRate * 2,
        salOtHolidayValue: parseSalaryNumber('salOtHoliday') * hourlyRate * 3,
        salNightShiftValue: nightShiftPay
    };
    Object.entries(lineValues).forEach(([id, val]) => {
        document.getElementById(id).textContent = formatSalaryVND(val);
    });

    const income = Object.values(lineValues).reduce((a, b) => a + b, 0);

    const insurance = lcb * SALARY_INSURANCE_RATE;
    const unionFee = lcb > 0 ? SALARY_UNION_FEE : 0;
    document.getElementById('salInsuranceValue').textContent = formatSalaryVND(insurance);
    document.getElementById('salUnionFeeValue').textContent = formatSalaryVND(unionFee);
    const deduct = insurance + unionFee;

    document.getElementById('salaryIncomeTotal').textContent = formatSalaryVND(income);
    document.getElementById('salaryDeductTotal').textContent = formatSalaryVND(deduct);

    // Thuế TNCN 2026: Thu nhập tính thuế = Tổng thu nhập chịu thuế - BH bắt buộc - giảm trừ bản thân - giảm trừ người phụ thuộc
    const dependents = Math.max(0, Math.floor(parseSalaryNumber('salDependents')));
    const dependentDeduct = dependents * SALARY_DEPENDENT_DEDUCTION_2026;
    const taxableIncome = income - insurance - SALARY_SELF_DEDUCTION_2026 - dependentDeduct;
    const { tax, rate } = calcPersonalIncomeTax2026(taxableIncome);

    document.getElementById('salSelfDeductValue').textContent = formatSalaryVND(SALARY_SELF_DEDUCTION_2026);
    document.getElementById('salDependentDeductValue').textContent = formatSalaryVND(dependentDeduct);
    document.getElementById('salInsuranceRefValue').textContent = formatSalaryVND(insurance);
    document.getElementById('salTaxableIncomeValue').textContent = formatSalaryVND(Math.max(taxableIncome, 0));
    document.getElementById('salTaxRateLabel').textContent = `${(rate * 100).toFixed(0)}%`;
    document.getElementById('salTaxValue').textContent = formatSalaryVND(tax);

    document.getElementById('salaryNetTotal').textContent = formatSalaryVND(income - deduct - tax);
}

function getJobDuration(job) {
    const n = parseInt(job?.duration, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_JOB_DURATION;
}

function loadStatsHiddenUsers() {
    try {
        const raw = localStorage.getItem(STATS_HIDDEN_USERS_KEY);
        statsHiddenUsers = raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) { statsHiddenUsers = new Set(); }
}
function saveStatsHiddenUsers() {
    try { localStorage.setItem(STATS_HIDDEN_USERS_KEY, JSON.stringify(Array.from(statsHiddenUsers))); }
    catch (e) { /* ignore */ }
}

function getStatsUserColor(uid) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
    return SPIN_WHEEL_COLORS[Math.abs(hash) % SPIN_WHEEL_COLORS.length];
}

async function ensureUsersInfoCache() {
    if (Object.keys(usersInfoCache).length > 0) return;
    try {
        const snap = await getDocs(collection(db, 'users'));
        usersDeptLatest = {};
        snap.forEach(d => {
            const u = d.data();
            if (u.uid) {
                collectUserDepts(u);
                usersInfoCache[u.uid] = {
                    displayName: u.displayName || '',
                    email: u.email || '',
                    avatar: u.avatar || null,
                    department: u.department || ''
                };
                if (u.avatar) {
                    if (!usersAvatarCache) usersAvatarCache = {};
                    usersAvatarCache[u.uid] = u.avatar;
                }
            }
        });
        rebuildDepartmentsList();
    } catch (e) { console.error('Không tải được users info:', e); }
}

async function fetchAllJobsForStats() {
    const snap = await getDocs(collection(db, 'jobs'));
    const list = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.isPaused !== true && data.isOutOfSchedule !== true) {
            list.push({ id: d.id, ...data });
        }
    });
    return list;
}

async function openStatisticsModal() {
    if (!statisticsModal) {
        console.error('statisticsModal chưa được khởi tạo');
        showNotification('Lỗi', 'Không mở được thống kê. Vui lòng tải lại trang.', false, 'danger');
        return;
    }
    try {
        statisticsModal.show();
        document.getElementById('statsSummary').innerHTML = '';
        document.getElementById('statsChart').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><br>Đang tải dữ liệu...</div>';
        document.getElementById('statsTable').innerHTML = '';

        loadStatsHiddenUsers();
        await ensureUsersInfoCache();
        fillDeptSelect(document.getElementById('statsDeptSelect'), statsDeptFilter, { all: true, none: true, noneLabel: 'Chưa phân bộ phận' });
        statsAllJobs = await fetchAllJobsForStats();
        renderStatistics();
    } catch (error) {
        console.error('Lỗi mở thống kê:', error);
        showNotification('Lỗi', 'Không tải được dữ liệu thống kê.', false, 'danger');
    }
}

function computeStatistics(mode) {
    const now = new Date();
    let rangeStart, rangeEnd, totalDays, label;

    if (mode === 'today') {
        rangeStart = new Date(now); rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + 1); rangeEnd.setMilliseconds(-1);
        totalDays = 1; label = 'Hôm nay';
    } else {
        rangeStart = new Date(now); rangeStart.setHours(0, 0, 0, 0);
        const day = rangeStart.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        rangeStart.setDate(rangeStart.getDate() + diff);
        rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + 7); rangeEnd.setMilliseconds(-1);
        totalDays = 7; label = 'Tuần này';
    }

    const byUser = {};
    statsAllJobs.forEach(job => {
        const occurrences = getJobOccurrences(job, rangeStart, rangeEnd);
        if (occurrences.length === 0) return;

        const duration = getJobDuration(job);
        const totalForJob = duration * occurrences.length;
        const uid = job.ownerId;
        if (!uid) return;
        if (!deptMatches(uid, statsDeptFilter)) return;   // lọc theo bộ phận

        const info = usersInfoCache[uid] || {};
        const name = info.displayName || info.email || `User ${uid.slice(0, 6)}`;

        if (!byUser[uid]) {
            byUser[uid] = { uid, name, totalMinutes: 0, jobs: [] };
        }
        byUser[uid].totalMinutes += totalForJob;
        byUser[uid].jobs.push({ job, occurrences: occurrences.length, minutes: totalForJob });
    });

    const totalAvailable = WORK_HOURS_PER_DAY * 60 * totalDays;
    const users = Object.values(byUser).sort((a, b) => b.totalMinutes - a.totalMinutes);
    const totalBusy = users.reduce((s, u) => s + u.totalMinutes, 0);
    const totalFree = Math.max(0, totalAvailable - totalBusy);

    return {
        mode, label, totalDays, totalAvailable, totalBusy, totalFree,
        users, peopleCount: users.length
    };
}

function renderStatistics() {
    if (!currentUser || !statsAllJobs) return;
    const stats = computeStatistics(statsMode);

    // ----- Summary -----
    const busyH = (stats.totalBusy / 60).toFixed(1);
    const freeH = (stats.totalFree / 60).toFixed(1);
    const availH = (stats.totalAvailable / 60).toFixed(1);
    const utilization = stats.totalAvailable > 0
        ? ((stats.totalBusy / stats.totalAvailable) * 100).toFixed(0) : 0;

    document.getElementById('statsSummary').innerHTML = `
        <div class="stats-summary-card">
            <div class="stats-summary-icon people"><i class="bi bi-people-fill"></i></div>
            <div>
                <div class="stats-summary-value">${stats.peopleCount}</div>
                <div class="stats-summary-label">User có job (${stats.label.toLowerCase()})</div>
            </div>
        </div>
        <div class="stats-summary-card">
            <div class="stats-summary-icon busy"><i class="bi bi-hourglass-split"></i></div>
            <div>
                <div class="stats-summary-value">${busyH}h</div>
                <div class="stats-summary-label">Đã chiếm · ${utilization}%</div>
            </div>
        </div>
        <div class="stats-summary-card">
            <div class="stats-summary-icon free"><i class="bi bi-cup-hot-fill"></i></div>
            <div>
                <div class="stats-summary-value">${freeH}h</div>
                <div class="stats-summary-label">Thời gian trống</div>
            </div>
        </div>
        <div class="stats-summary-card">
            <div class="stats-summary-icon jobs"><i class="bi bi-calendar-check-fill"></i></div>
            <div>
                <div class="stats-summary-value">${availH}h</div>
                <div class="stats-summary-label">Quỹ thời gian (${stats.totalDays}×8h)</div>
            </div>
        </div>
    `;

    // ----- Chart (bar ngang) -----
    const chartEl = document.getElementById('statsChart');
    if (stats.users.length === 0) {
        chartEl.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><br>Không có job nào trong khoảng thời gian này</div>';
    } else {
        const maxMinutes = Math.max(...stats.users.map(u => u.totalMinutes), 1);
        chartEl.innerHTML = stats.users.map(u => {
            const isHidden = statsHiddenUsers.has(u.uid);
            const percent = Math.min(100, (u.totalMinutes / maxMinutes) * 100);
            const busyPct = ((u.totalMinutes / stats.totalAvailable) * 100).toFixed(1);
            const hours = (u.totalMinutes / 60).toFixed(1);
            const jobCount = u.jobs.reduce((s, j) => s + j.occurrences, 0);
            const avatarUrl = (usersInfoCache[u.uid] && usersInfoCache[u.uid].avatar) || getUserAvatarUrl(u.uid);
            const avatarHtml = avatarUrl
                ? `<img class="stats-user-avatar" src="${avatarUrl}" alt="">`
                : `<span class="stats-user-avatar" style="background:${getStatsUserColor(u.uid)}">${escapeHtml(avatarInitial({ displayName: u.name }))}</span>`;

            return `
                <div class="stats-user-row ${isHidden ? 'hidden-user' : ''}" data-uid="${escapeHtml(u.uid)}">
                    <label class="stats-toggle">
                        <input type="checkbox" class="stats-user-checkbox" ${isHidden ? '' : 'checked'}>
                        ${avatarHtml}
                        <span class="stats-user-name" title="${escapeHtml(u.name)}">${escapeHtml(u.name)}</span>
                    </label>
                    <div class="stats-bar-wrap">
                        <div class="stats-bar-fill ${Number(busyPct) > 100 ? 'over' : ''}" style="width:${percent}%"></div>
                    </div>
                    <div class="stats-user-stats">
                        <strong>${hours}h</strong> · ${jobCount} job · ${busyPct}%
                    </div>
                </div>
            `;
        }).join('');

        chartEl.querySelectorAll('.stats-user-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const row = e.target.closest('.stats-user-row');
                const uid = row.dataset.uid;
                if (e.target.checked) {
                    statsHiddenUsers.delete(uid);
                    row.classList.remove('hidden-user');
                } else {
                    statsHiddenUsers.add(uid);
                    row.classList.add('hidden-user');
                }
                saveStatsHiddenUsers();
            });
        });
    }

    // ----- Table chi tiết -----
    const tableEl = document.getElementById('statsTable');
    if (stats.users.length === 0) {
        tableEl.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><br>Chưa có dữ liệu</div>';
        return;
    }

    let html = `<table class="stats-table">
        <thead>
            <tr>
                <th>User</th>
                <th>Job</th>
                <th>Loại</th>
                <th>Số lần</th>
                <th>Thời gian/lần</th>
                <th>Tổng (giờ)</th>
            </tr>
        </thead><tbody>`;

    stats.users.forEach(u => {
        u.jobs.sort((a, b) => b.minutes - a.minutes);
        u.jobs.forEach((j, idx) => {
            const isHiddenUser = statsHiddenUsers.has(u.uid);
            const userCell = idx === 0
                ? `<td rowspan="${u.jobs.length}" style="vertical-align: top; font-weight: 700; ${isHiddenUser ? 'opacity:.4;' : ''}">${escapeHtml(u.name)}</td>`
                : '';
            html += `
                <tr>
                    ${userCell}
                    <td>${escapeHtml(j.job.title)}</td>
                    <td><span class="job-type-label ${escapeHtml(j.job.type)}">${escapeHtml(getTypeLabel(j.job.type))}</span></td>
                    <td>${j.occurrences}</td>
                    <td>${getJobDuration(j.job)} phút</td>
                    <td><strong>${(j.minutes / 60).toFixed(1)}h</strong></td>
                </tr>`;
        });
    });
    html += '</tbody></table>';
    tableEl.innerHTML = html;
}

// ============================================================
// CHECK ETA & DIRECT — v3
// - Line S112 / M177 là BACKUP LINE → bỏ qua check LINE ALLOCATED
// - 2 cột day+night cùng ngày → gộp khi check direct & pickup
// - Nhiều line cùng 1 ITEM → gộp tổng SL theo item để check direct
// ============================================================

const ETA_DIRECT_DATE_RE = /^\d{1,2}\/\d{1,2}$/;
const ETA_BACKUP_LINES = ['S112', 'M177'];
// PICK UP rơi vào N ngày đầu của bảng (day+night = 1 ngày) thì chỉ cần hàng lên đúng ngày ETA là OK
const ETA_PICKUP_EARLY_DAYS = 3;

// `checkEtaDirectModal`, `checkEtaDirectParsed`, `checkEtaDirectResults` đã khai báo ở đầu file.

function isBackupLine(line) {
    if (!line) return false;
    return ETA_BACKUP_LINES.includes(String(line).trim().toUpperCase());
}

function setEtaInputCollapsed(hidden) {
    const wrap = document.getElementById('etaDirectInputWrap');
    const btn = document.getElementById('etaDirectToggleInputBtn');
    if (wrap) wrap.classList.toggle('eta-hidden', !!hidden);
    if (btn) {
        btn.querySelector('i').className = hidden ? 'bi bi-eye-fill' : 'bi bi-eye-slash-fill';
        btn.querySelector('span').textContent = hidden ? 'Hiện dán dữ liệu' : 'Ẩn dán dữ liệu';
    }
}

function openCheckEtaDirectModal() {
    checkEtaDirectModal.show();

    // Đồng bộ nút toggle với trạng thái hiện tại của vùng dán
    const wrap = document.getElementById('etaDirectInputWrap');
    const btn = document.getElementById('etaDirectToggleInputBtn');
    if (wrap && btn) {
        const hidden = wrap.classList.contains('eta-hidden');
        btn.querySelector('i').className = hidden ? 'bi bi-eye-fill' : 'bi bi-eye-slash-fill';
        btn.querySelector('span').textContent = hidden ? 'Hiện dán dữ liệu' : 'Ẩn dán dữ liệu';
    }

    updateEtaDirectStatus('Sẵn sàng phân tích');
}

function clearEtaDirectForm() {
    const ta = document.getElementById('etaDirectPaste');
    if (ta) ta.value = '';
    const fi = document.getElementById('etaDirectFile');
    if (fi) fi.value = '';
    checkEtaDirectParsed = null;
    checkEtaDirectResults = [];
    document.getElementById('etaDirectResultSection').style.display = 'none';
    document.getElementById('etaDirectPasteBadge').textContent = '0 dòng';
    document.getElementById('etaDirectPasteBadge').classList.remove('has-data');
    const fileInfo = document.getElementById('etaDirectFileInfo');
    fileInfo.textContent = 'Chưa chọn file';
    fileInfo.classList.remove('has-file');
    updateEtaDirectStatus('Sẵn sàng phân tích');

    const ls = document.getElementById('etaDirectLineFilter');
    if (ls) ls.innerHTML = '<option value="">Tất cả line</option>';
    const se = document.getElementById('etaDirectSearch');
    if (se) se.value = '';
    const ct = document.getElementById('etaDirectCount');
    if (ct) ct.textContent = '';
    setEtaInputCollapsed(false);
}

function updateEtaDirectStatus(msg) {
    const el = document.getElementById('etaDirectStatus');
    if (!el) return;
    el.innerHTML = msg
        ? `<i class="bi bi-info-circle"></i> ${escapeHtml(msg)}`
        : `<i class="bi bi-info-circle"></i> Sẵn sàng phân tích`;
}

let etaDirectBadgeTimer = null;
function scheduleEtaDirectBadgeUpdate() {
    clearTimeout(etaDirectBadgeTimer);
    etaDirectBadgeTimer = setTimeout(() => {
        const text = document.getElementById('etaDirectPaste').value;
        const badge = document.getElementById('etaDirectPasteBadge');
        if (!text.trim()) {
            badge.textContent = '0 dòng';
            badge.classList.remove('has-data');
            return;
        }
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const count = Math.max(0, lines.length - 2);
        badge.textContent = `${count} dòng`;
        badge.classList.toggle('has-data', count > 0);
    }, 180);
}

function parseEtaDateMMDD(str) {
    if (!str) return null;
    const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const month = parseInt(m[1], 10), day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(2026, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
}

function etaParseNum(v) {
    if (v == null) return 0;
    const s = String(v).trim().replace(/,/g, '');
    if (!s) return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

function etaSplitLine(line) {
    if (line.includes('\t')) return line.split('\t');
    return line.split(/\s{2,}/);
}

/**
 * Đọc file Excel/CSV thành ma trận thô (mảng các dòng) cho Check ETA & Direct.
 * - Nhiều sheet: chọn sheet có dòng ngày (mm/dd) + dòng header; không có thì lấy sheet đầu.
 * - Trả về { matrix, sheetName }.
 */
function readExcelRawMatrix(file) {
    return new Promise((resolve, reject) => {
        const isCsv = /\.(csv|txt|prn)$/i.test(file.name);
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Không đọc được file'));

        if (isCsv) {
            reader.onload = () => {
                try { resolve({ matrix: parseCsvText(reader.result), sheetName: '' }); }
                catch (err) { reject(err); }
            };
            reader.readAsText(file, 'UTF-8');
            return;
        }

        reader.onload = () => {
            try {
                const wb = XLSX.read(reader.result, { type: 'array' });
                const toMatrix = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], {
                    header: 1, raw: false, defval: '', blankrows: false
                });
                let picked = null;
                for (const name of wb.SheetNames) {
                    const matrix = toMatrix(name);
                    if (findEtaTable(etaMatrixToText(matrix))) { picked = { matrix, sheetName: name }; break; }
                }
                if (!picked) {
                    const first = wb.SheetNames[0];
                    picked = { matrix: toMatrix(first), sheetName: first };
                }
                resolve(picked);
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
}

function etaMatrixToText(matrix) {
    if (!matrix || !matrix.length) return '';
    return matrix.map(row => (row || []).map(c => c == null ? '' : String(c)).join('\t')).join('\n');
}

function findEtaTable(text) {
    const rawLines = String(text || '').split(/\r?\n/);
    let dateLineIdx = -1;

    for (let i = 0; i < rawLines.length; i++) {
        const cells = etaSplitLine(rawLines[i]);
        const dateCount = cells.filter(c => ETA_DIRECT_DATE_RE.test((c || '').trim())).length;
        if (dateCount >= 2) { dateLineIdx = i; break; }
    }
    if (dateLineIdx === -1) return null;

    let headerLineIdx = -1;
    const KEYWORDS = ['STYLE', 'ITEM', 'LINE', 'DIRECT', 'ETA', 'PICK UP', 'PICKUP', 'FRAME', 'LINE ALLOCATED'];
    for (let i = dateLineIdx + 1; i < Math.min(dateLineIdx + 6, rawLines.length); i++) {
        const upper = rawLines[i].toUpperCase();
        let hits = 0;
        KEYWORDS.forEach(k => { if (upper.includes(k)) hits++; });
        if (hits >= 2) { headerLineIdx = i; break; }
    }
    if (headerLineIdx === -1) return null;

    return { rawLines, dateLineIdx, headerLineIdx };
}

function parseEtaDirectFromText(text) {
    const found = findEtaTable(text);
    if (!found) {
        return { error: 'Không tìm thấy bảng: cần 1 dòng chứa ngày (mm/dd) và 1 dòng header (STYLE/LINE ALLOCATED/ITEM/DIRECT/ETA…).' };
    }

    const { rawLines, dateLineIdx, headerLineIdx } = found;
    const dateCells   = etaSplitLine(rawLines[dateLineIdx]);
    const headerCells = etaSplitLine(rawLines[headerLineIdx]).map(c => (c || '').trim().toUpperCase());

    const dayColumns = [];
    dateCells.forEach((cell, i) => {
        const v = (cell || '').trim();
        if (ETA_DIRECT_DATE_RE.test(v)) dayColumns.push({ index: i, date: v });
    });
    if (!dayColumns.length) return { error: 'Dòng ngày không có mốc mm/dd hợp lệ.' };

    const findCol = (pred) => headerCells.findIndex(pred);
    const colStyle     = findCol(h => h === 'STYLE');
    const colLineAlloc = findCol(h => h.includes('LINE ALLOCATED'));
    const colFrame     = findCol(h => h === 'FRAME');
    const colEff       = findCol(h => h === 'EFF');
    const colItem      = findCol(h => h === 'ITEM');
    const colTotal     = findCol(h => h === 'TOTAL');
    const colLock      = findCol(h => h === 'LOCK_QTY');
    const colRemain    = findCol(h => h === 'REMAIN');
    const colAshton    = findCol(h => h === 'ASHTON');
    const colDirect    = findCol(h => h === 'DIRECT');
    const colEta       = findCol(h => h === 'ETA');
    const colPickup    = findCol(h => h === 'PICK UP' || h === 'PICKUP' || h === 'PICK_UP');

    let colLine = -1;
    const afterAlloc = colLineAlloc >= 0 ? colLineAlloc + 1 : 0;
    const beforeDay = dayColumns[0].index;
    for (let i = afterAlloc; i < beforeDay; i++) {
        if (headerCells[i] === 'LINE') { colLine = i; break; }
    }
    if (colLine === -1) colLine = findCol(h => h === 'LINE');

    if (colItem === -1) return { error: 'Không tìm thấy cột ITEM trong header.' };

    const rows = [];
    for (let i = headerLineIdx + 1; i < rawLines.length; i++) {
        if (!rawLines[i].trim()) continue;
        const cells = etaSplitLine(rawLines[i]);
        const item = (cells[colItem] || '').trim();
        if (!item) continue;

        rows.push({
            rowIndex: rows.length + 1,
            style:         colStyle >= 0 ? (cells[colStyle] || '').trim() : '',
            lineAllocated: colLineAlloc >= 0 ? (cells[colLineAlloc] || '').trim() : '',
            frame:         colFrame >= 0 ? (cells[colFrame] || '').trim() : '',
            eff:           colEff >= 0 ? (cells[colEff] || '').trim() : '',
            item,
            line:          colLine >= 0 ? (cells[colLine] || '').trim() : '',
            total:   colTotal >= 0  ? etaParseNum(cells[colTotal])  : 0,
            lockQty: colLock >= 0   ? etaParseNum(cells[colLock])   : 0,
            remain:  colRemain >= 0 ? etaParseNum(cells[colRemain]) : 0,
            ashton:  colAshton >= 0 ? etaParseNum(cells[colAshton]) : 0,
            direct:  colDirect >= 0 ? etaParseNum(cells[colDirect]) : 0,
            eta:     colEta >= 0    ? (cells[colEta] || '').trim()    : '',
            pickup:  colPickup >= 0 ? (cells[colPickup] || '').trim() : '',
            dailyQty: dayColumns.map(dc => ({
                date: dc.date,
                qty: etaParseNum(cells[dc.index])
            }))
        });
    }

    if (!rows.length) return { error: 'Không có dòng dữ liệu hợp lệ (cột ITEM rỗng toàn bộ).' };

    return { dayColumns, headerCells, rows };
}

// Group các cột theo ngày (2 cột day/night cùng 1 ngày → 1 group)
function buildDayGroups(dayColumns) {
    const groups = [];
    const map = new Map();
    dayColumns.forEach((dc, i) => {
        if (!map.has(dc.date)) {
            const g = { date: dc.date, indexes: [] };
            map.set(dc.date, g);
            groups.push(g);
        }
        map.get(dc.date).indexes.push(i);
    });
    return groups;
}

// ── Row-level checks: LINE ALLOCATED (bỏ qua backup), không chạy trước ETA ──
function analyzeRowLevelEta(row) {
    const rowIssues = [];
    const rowViolations = new Map();  // colIdx → 'eta'

    // LINE ALLOCATED — bỏ qua nếu line là backup (S112, M177)
    if (row.line && !isBackupLine(row.line) && row.lineAllocated) {
        const allowed = row.lineAllocated.split(/[,;]/)
            .map(s => s.trim().toUpperCase()).filter(Boolean);
        if (allowed.length && !allowed.includes(row.line.toUpperCase())) {
            rowIssues.push({
                level: 'error', code: 'LINE', scope: 'row',
                msg: `Line "${row.line}" không nằm trong LINE ALLOCATED (${row.lineAllocated})`
            });
        }
    }

    // ETA — không được có SL trước ngày ETA
    const etaDate = parseEtaDateMMDD(row.eta);
    if (etaDate) {
        let sumBefore = 0;
        const runDates = new Map();   // ngày chạy sớm → tổng kit
        row.dailyQty.forEach((d, ci) => {
            if (d.qty <= 0) return;
            const dd = parseEtaDateMMDD(d.date);
            if (dd && dd.getTime() < etaDate.getTime()) {
                rowViolations.set(ci, 'eta');
                sumBefore += d.qty;
                runDates.set(d.date, (runDates.get(d.date) || 0) + d.qty);
            }
        });
        if (sumBefore > 0) {
            rowIssues.push({
                level: 'error', code: 'ETA', scope: 'row',
                msg: runDates.size > 1
                    ? `Đang chạy ${sumBefore} kit (${[...runDates].map(([d, q]) => `${q} ngày ${d}`).join(', ')}), cảnh báo ETA ${row.eta}`
                    : `Đang chạy ${sumBefore} kit ngày ${[...runDates.keys()][0]}, cảnh báo ETA ${row.eta}`
            });
        }
    }

    return { rowIssues, rowViolations };
}

// ── Item-level checks ──
// (gộp tất cả line cùng ITEM, tổng 2 ô cùng ngày là 1 ngày)
function analyzeItemLevelEta(itemRows, dayColumns) {
    const itemIssues = [];
    const dayGroups = buildDayGroups(dayColumns);

    // Tổng SL của item theo từng ngày (cộng 2 cột day+night của cùng ngày, cộng mọi line)
    const dayTotals = dayGroups.map(g => {
        const qty = itemRows.reduce((sum, row) =>
            sum + g.indexes.reduce((s, ci) => s + (row.dailyQty[ci]?.qty || 0), 0), 0);
        return { date: g.date, dateObj: parseEtaDateMMDD(g.date), qty };
    });
    const totalSL = dayTotals.reduce((s, d) => s + d.qty, 0);

    // Direct / Ashton: lấy max trên tất cả các dòng của item
    const direct = Math.max(0, ...itemRows.map(r => r.direct || 0));
    const ashton = Math.max(0, ...itemRows.map(r => r.ashton || 0));

    // 1) Đủ DIRECT — tổng SL 14 cột phải ≥ DIRECT (không cần đúng ngày)
    if (direct > 0 && totalSL < direct) {
        itemIssues.push({
            level: 'error', code: 'DIRECT', scope: 'item',
            msg: `Tổng SL ${totalSL} < DIRECT ${direct} — thiếu ${direct - totalSL}`
        });
    }

    // 2) Đủ ASHTON — CHECK RIÊNG, KHÔNG gộp với DIRECT.
    //    ASHTON chỉ cần lên đủ số lượng trong 14 cột, ngày nào cũng được,
    //    không cần đúng ngày PICKUP, không cộng thêm DIRECT để so.
    if (ashton > 0 && totalSL < ashton) {
        itemIssues.push({
            level: 'error', code: 'ASHTON', scope: 'item',
            msg: `Tổng SL ${totalSL} < ASHTON ${ashton} — thiếu ${ashton - totalSL}`
        });
    }

    // 3) ETA > PICK UP — ngày ETA là mốc sớm nhất hàng có thể lên.
    //    Chỉ báo ĐỎ khi hàng thực sự lên TRỄ so với mốc cho phép (không báo vàng chỉ vì ETA > PICK UP):
    //    - PICK UP nằm trong ETA_PICKUP_EARLY_DAYS ngày đầu của bảng: chỉ cần có hàng lên đúng ngày ETA là OK.
    //    - PICK UP nằm ở các ngày cuối: tổng (ngày + đêm) của ngày ETA phải đủ số lượng yêu cầu pickup.
    //    Hàng lên trước ngày ETA đã được báo đỏ ở row-level (code 'ETA').
    const etas = itemRows.map(r => parseEtaDateMMDD(r.eta)).filter(Boolean);
    const pickups = itemRows.map(r => parseEtaDateMMDD(r.pickup)).filter(Boolean);
    if (etas.length && pickups.length) {
        const latestEta = new Date(Math.max(...etas.map(d => d.getTime())));
        const earliestPickup = new Date(Math.min(...pickups.map(d => d.getTime())));
        if (latestEta.getTime() > earliestPickup.getTime()) {
            const etaLabel = itemRows.find(r => r.eta)?.eta || '';
            const pickupLabel = itemRows.find(r => r.pickup)?.pickup || '';
            const required = direct > 0 ? direct : totalSL;

            // Vị trí ngày PICK UP trong bảng (đếm số ngày đứng trước nó)
            const pickupPos = dayTotals.filter(d => d.dateObj && d.dateObj.getTime() < earliestPickup.getTime()).length;
            const isEarlyZone = pickupPos < ETA_PICKUP_EARLY_DAYS;

            // Qty đúng ngày ETA (gộp ngày + đêm, mọi line). Nếu ETA nằm trước cột đầu thì lấy ngày đầu tiên >= ETA.
            const etaDayTotal = dayTotals.find(d => d.dateObj && d.dateObj.getTime() >= latestEta.getTime());
            const etaDayQty = (etaDayTotal && etaDayTotal.dateObj.getTime() === latestEta.getTime()) || (etaDayTotal && etaDayTotal === dayTotals[0])
                ? etaDayTotal.qty : 0;

            // Mô tả hàng đang thực sự lên ngày nào
            const runList = dayTotals.filter(d => d.qty > 0).map(d => `${d.qty} ngày ${d.date}`).join(', ');
            const runText = runList ? `đang lên: ${runList}` : 'chưa có hàng lên';

            if (isEarlyZone) {
                if (etaDayQty <= 0) {
                    itemIssues.push({
                        level: 'error', code: 'ETA_PICKUP', scope: 'item',
                        msg: `Trễ: ETA ${etaLabel} (PICK UP ${pickupLabel}) nhưng không có hàng lên ngày ${etaLabel} — ${runText}`
                    });
                }
            } else if (etaDayQty < required) {
                itemIssues.push({
                    level: 'error', code: 'ETA_PICKUP', scope: 'item',
                    msg: `Trễ: PICK UP ${pickupLabel} cần ${required} kit, ngày ETA ${etaLabel} mới lên ${etaDayQty} (thiếu ${required - etaDayQty}) — ${runText}`
                });
            }
        }
    }

    return { itemIssues, totalSL, direct, ashton, dayTotals };
}

function runEtaDirectAnalysis() {
    const text = document.getElementById('etaDirectPaste').value;
    const isFileTab = document.getElementById('etaDirectFileTab').classList.contains('active');
    const fileInput = document.getElementById('etaDirectFile');
    const fileChosen = fileInput && fileInput.files && fileInput.files[0];

    if (isFileTab && !fileChosen) {
        updateEtaDirectStatus('Vui lòng chọn file Excel trước khi phân tích.');
        return;
    }
    if (!isFileTab && !text.trim()) {
        updateEtaDirectStatus('Vui lòng dán dữ liệu trước khi phân tích.');
        return;
    }

    const btn = document.getElementById('etaDirectAnalyzeBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Đang phân tích...';
    btn.disabled = true;

    const finish = (textOrError) => {
        if (typeof textOrError === 'string' && textOrError.startsWith('__ERR__:')) {
            updateEtaDirectStatus(textOrError.replace('__ERR__:', 'Lỗi: '));
            btn.innerHTML = originalHTML; btn.disabled = false;
            return;
        }
        const parsed = parseEtaDirectFromText(textOrError);
        if (parsed.error) {
            updateEtaDirectStatus(`Lỗi: ${parsed.error}`);
            btn.innerHTML = originalHTML; btn.disabled = false;
            return;
        }
        checkEtaDirectParsed = parsed;

        // Row-level: tính cho từng dòng Excel
        const rowLevels = parsed.rows.map(row => analyzeRowLevelEta(row));

        // Group by ITEM để check item-level
        const itemGroupsMap = new Map();
        parsed.rows.forEach(row => {
            if (!itemGroupsMap.has(row.item)) itemGroupsMap.set(row.item, []);
            itemGroupsMap.get(row.item).push(row);
        });
        const itemLevels = new Map();
        itemGroupsMap.forEach((rows, item) => {
            itemLevels.set(item, analyzeItemLevelEta(rows, parsed.dayColumns));
        });

        checkEtaDirectResults = parsed.rows.map((row, idx) => ({
            row,
            rowLevel: rowLevels[idx],
            itemKey: row.item,
            itemLevel: itemLevels.get(row.item),
            sumDaily: row.dailyQty.reduce((s, d) => s + (d.qty || 0), 0),
        }));

        renderEtaDirectResults();
        setEtaInputCollapsed(true); // thu gọn vùng nhập để bảng kết quả rộng hơn
        btn.innerHTML = originalHTML; btn.disabled = false;
        updateEtaDirectStatus(`Đã phân tích ${parsed.rows.length} dòng · ${itemGroupsMap.size} item · ${parsed.dayColumns.length} cột ngày/đêm`);
    };

    if (isFileTab && fileChosen) {
        readExcelRawMatrix(fileChosen).then(({ matrix }) => {
            finish(etaMatrixToText(matrix));
        }).catch(err => {
            console.error('Lỗi đọc file ETA Direct:', err);
            finish('__ERR__:Không đọc được file Excel. Kiểm tra lại định dạng.');
        });
    } else {
        setTimeout(() => finish(text), 250);
    }
}

function renderEtaDirectResults() {
    const section = document.getElementById('etaDirectResultSection');
    section.style.display = '';

    const total = checkEtaDirectResults.length;
    const uniqueItems = new Set(checkEtaDirectResults.map(r => r.itemKey));

    const hasErrorRow = (r) => r.itemLevel.itemIssues.some(i => i.level === 'error') ||
                              r.rowLevel.rowIssues.some(i => i.level === 'error');
    const hasWarnRow  = (r) => !hasErrorRow(r) &&
                              (r.itemLevel.itemIssues.length > 0 || r.rowLevel.rowIssues.length > 0);

    const withError = checkEtaDirectResults.filter(hasErrorRow).length;
    const withWarn  = checkEtaDirectResults.filter(hasWarnRow).length;
    const okCount   = total - withError - withWarn;
    const totalDirect = checkEtaDirectResults.reduce((s, r) => s + (r.row.direct || 0), 0);

    document.getElementById('etaDirectStats').innerHTML = `
        <div class="eta-stat">
            <div class="eta-stat-icon total"><i class="bi bi-list-ul"></i></div>
            <div>
                <div class="eta-stat-value">${total}</div>
                <div class="eta-stat-label">Tổng dòng · ${uniqueItems.size} item</div>
            </div>
        </div>
        <div class="eta-stat">
            <div class="eta-stat-icon error"><i class="bi bi-x-octagon-fill"></i></div>
            <div>
                <div class="eta-stat-value">${withError}</div>
                <div class="eta-stat-label">Dòng vi phạm</div>
            </div>
        </div>
        <div class="eta-stat">
            <div class="eta-stat-icon warning"><i class="bi bi-exclamation-triangle-fill"></i></div>
            <div>
                <div class="eta-stat-value">${withWarn}</div>
                <div class="eta-stat-label">Dòng cảnh báo</div>
            </div>
        </div>
        <div class="eta-stat">
            <div class="eta-stat-icon ok"><i class="bi bi-check-circle-fill"></i></div>
            <div>
                <div class="eta-stat-value">${okCount}</div>
                <div class="eta-stat-label">Dòng hợp lệ</div>
            </div>
        </div>
        <div class="eta-stat">
            <div class="eta-stat-icon total"><i class="bi bi-flag-fill"></i></div>
            <div>
                <div class="eta-stat-value">${totalDirect.toLocaleString('vi-VN')}</div>
                <div class="eta-stat-label">Tổng DIRECT</div>
            </div>
        </div>
    `;

    populateEtaLineFilter();
    renderEtaDirectGrid();
}

function populateEtaLineFilter() {
    const sel = document.getElementById('etaDirectLineFilter');
    if (!sel) return;
    const prev = sel.value;
    const counts = new Map();
    checkEtaDirectResults.forEach(r => {
        const l = String(r.row.line || '').trim().toUpperCase();
        if (l) counts.set(l, (counts.get(l) || 0) + 1);
    });
    const lines = [...counts.keys()].sort((x, y) => x.localeCompare(y, 'en', { numeric: true }));
    sel.innerHTML = '<option value="">Tất cả line</option>' +
        lines.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)} (${counts.get(l)})</option>`).join('');
    sel.value = counts.has(prev) ? prev : '';
}

// Ô "SL DÒNG": tổng item đủ → chỉ hiện SL của dòng (82); tổng item thiếu → hiện SL dòng/yêu cầu (82/200, màu đỏ).
// Yêu cầu của item = max(DIRECT, ASHTON); "tổng item" gộp tất cả các dòng của item.
function etaSlCellHtml(res, rowCount) {
    const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
    const il = res.itemLevel;
    const required = Math.max(il.direct || 0, il.ashton || 0);
    const itemTotal = il.totalSL || 0;
    if (required > 0 && itemTotal < required) {
        const tip = rowCount > 1
            ? `Tổng cả item ${fmt(itemTotal)}/${fmt(required)} — thiếu ${fmt(required - itemTotal)}`
            : `Thiếu ${fmt(required - itemTotal)} so với yêu cầu ${fmt(required)}`;
        return `<span class="sl-short" title="${tip}">${fmt(res.sumDaily)}/${fmt(required)}</span>`;
    }
    return fmt(res.sumDaily);
}

function renderEtaDirectRowCells(res, dayColumns, rowCount = 1) {
    const row = res.row;
    const rl = res.rowLevel;

    // Cột LINE — gộp LINE + LINE ALLOCATED
    const lineBad = rl.rowIssues.some(i => i.code === 'LINE');
    const lineX = lineBad
        ? `<i class="bi bi-x-circle-fill line-x" title="Line ${escapeHtml(row.line)} không nằm trong LINE ALLOCATED"></i>`
        : '';
    const lineCell = `<td class="col-line">
        <div class="line-main">${escapeHtml(row.line || '—')}${lineX}</div>
        ${row.lineAllocated ? `<span class="line-alloc" title="LINE ALLOCATED: ${escapeHtml(row.lineAllocated)}">${escapeHtml(row.lineAllocated)}</span>` : ''}
    </td>`;

    const etaCell    = `<td class="col-eta">${row.eta    ? `<span class="eta-pill eta">${escapeHtml(row.eta)}</span>` : '<span class="text-muted">—</span>'}</td>`;
    const pickupCell = `<td class="col-pickup">${row.pickup ? `<span class="eta-pill pickup">${escapeHtml(row.pickup)}</span>` : '<span class="text-muted">—</span>'}</td>`;
    const directCell = `<td class="col-qty">${row.direct > 0 ? `<span class="eta-pill direct">${row.direct}</span>` : '<span class="text-muted">—</span>'}</td>`;
    const ashtonCell = `<td class="col-qty">${row.ashton > 0 ? `<span class="eta-pill ashton">${row.ashton}</span>` : '<span class="text-muted">—</span>'}</td>`;

    const qtyCells = row.dailyQty.map((d, ci) => {
        const v = rl.rowViolations.get(ci);
        const classes = ['col-day', 'cell-qty'];
        if (d.qty > 0) {
            classes.push('has-qty');
            // Viền xanh lam bao quanh cụm ô liên tiếp đang lên hàng
            const prevHas = ci > 0 && row.dailyQty[ci - 1].qty > 0;
            const nextHas = ci < row.dailyQty.length - 1 && row.dailyQty[ci + 1].qty > 0;
            if (!prevHas) classes.push('run-start');
            if (!nextHas) classes.push('run-end');
        }
        const nextDate = dayColumns[ci + 1]?.date;
        if (!nextDate || nextDate !== d.date) classes.push('day-group-end');
        if (v) {
            classes.push('violation');
            if (v === 'eta') classes.push('violation-eta');
        }
        const title = `${d.qty > 0 ? 'SL ' + d.qty : ''}${v ? ' · Vi phạm' : ''}`;
        return `<td class="${classes.join(' ')}" title="${title.trim()}">${d.qty > 0 ? d.qty : ''}</td>`;
    }).join('');

    const totalCell = `<td class="col-total">${etaSlCellHtml(res, rowCount)}</td>`;

    return lineCell + etaCell + pickupCell + directCell + ashtonCell + qtyCells + totalCell;
}

// Ô "VẤN ĐỀ" gộp: lỗi cấp ITEM (ETA/PICK UP, DIRECT, ASHTON) + lỗi cấp DÒNG (ETA).
// Lỗi LINE không in chữ vì đã có dấu X đỏ cạnh LINE.
function etaIssuesCellHtml(itemIssues, rowIssues) {
    const parts = [];
    (itemIssues || []).forEach(it => parts.push(`
        <div class="eta-issue ${it.level} item-level">
            <i class="bi ${it.level === 'error' ? 'bi-x-octagon-fill' : 'bi-exclamation-triangle-fill'}"></i>
            <span>${escapeHtml(it.msg)}</span>
        </div>`));
    (rowIssues || []).filter(it => it.code !== 'LINE').forEach(it => parts.push(`
        <div class="eta-issue ${it.level}">
            <i class="bi ${it.level === 'error' ? 'bi-x-circle-fill' : 'bi-exclamation-triangle-fill'}"></i>
            <span>${escapeHtml(it.msg)}</span>
        </div>`));
    return parts.length
        ? `<div class="eta-issue-list">${parts.join('')}</div>`
        : '<span class="text-muted">—</span>';
}

function renderEtaDirectGrid() {
    const gridEl = document.getElementById('etaDirectGrid');
    if (!checkEtaDirectParsed) { gridEl.innerHTML = ''; return; }

    const onlyIssues = document.getElementById('etaDirectOnlyIssues').checked;
    const dupOnly = !!document.getElementById('etaDirectOnlyDup')?.checked;
    const lineFilter = (document.getElementById('etaDirectLineFilter')?.value || '').trim().toUpperCase();
    const q = (document.getElementById('etaDirectSearch')?.value || '').trim().toUpperCase();
    const sortMode = document.getElementById('etaDirectSort')?.value || 'date';
    const { dayColumns } = checkEtaDirectParsed;
    const countEl = document.getElementById('etaDirectCount');

    // So sánh line tự nhiên: S111 < S112 < S119 < S120; line rỗng xuống cuối
    const lineCmp = (x, y) => {
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x.localeCompare(y, 'en', { numeric: true });
    };
    const dateOrder = new Map();      // date → thứ tự ngày (cột ngày/đêm cùng ngày dùng chung)
    dayColumns.forEach(dc => { if (!dateOrder.has(dc.date)) dateOrder.set(dc.date, dateOrder.size); });
    const dateIdxOfCol = (c) => dateOrder.get(dayColumns[c]?.date) ?? 0;

    // Item xuất hiện ở nhiều dòng (khác line / khác ngày) → đánh dấu trùng, mỗi item 1 màu riêng
    const itemRowCount = new Map();
    checkEtaDirectResults.forEach(r => itemRowCount.set(r.itemKey, (itemRowCount.get(r.itemKey) || 0) + 1));
    const dupHue = new Map();
    let dupN = 0;
    itemRowCount.forEach((n, k) => { if (n > 1) dupHue.set(k, (dupN++ * 137) % 360); });

    // Mỗi DÒNG được sắp xếp độc lập (item chạy nhiều line sẽ bị tách ra đúng chỗ của từng line/ngày)
    const allRows = [];
    checkEtaDirectResults.forEach((r, i) => {
        const line = String(r.row.line || '').trim().toUpperCase();
        if (lineFilter && line !== lineFilter) return;
        if (q && !`${r.row.item} ${r.row.frame || ''}`.toUpperCase().includes(q)) return;

        let first = Infinity, last = -1;
        r.row.dailyQty.forEach((d, c) => {
            if (d.qty > 0) { if (c < first) first = c; if (c > last) last = c; }
        });
        const hasErr = r.itemLevel.itemIssues.some(x => x.level === 'error') ||
                       r.rowLevel.rowIssues.some(x => x.level === 'error');
        const hasAny = r.itemLevel.itemIssues.length > 0 || r.rowLevel.rowIssues.length > 0;
        allRows.push({
            i, res: r, line,
            sev: hasErr ? 0 : (hasAny ? 1 : 2),
            firstCol: first,
            lastCol: last,
            // Dòng chạy vắt sang ngày kế tiếp → xuống cuối khối ca bắt đầu để nối ca
            carryOver: first !== Infinity && dateIdxOfCol(last) > dateIdxOfCol(first) ? 1 : 0,
        });
    });

    allRows.sort((a, b) => {
        if (sortMode === 'date') {
            // 1) Gom theo LINE: hết hàng của line này (đầu → cuối) rồi mới sang line khác
            if (a.line !== b.line) return lineCmp(a.line, b.line);
            // 2) Đúng thứ tự ca: 10/8 ngày → 10/8 đêm → 10/9 ngày → 10/9 đêm ...
            if (a.firstCol !== b.firstCol) return a.firstCol < b.firstCol ? -1 : 1;
            // 3) Cùng ca: dòng vắt sang ngày sau xuống cuối để nối ca
            if (a.carryOver !== b.carryOver) return a.carryOver - b.carryOver;
            if (a.lastCol !== b.lastCol) return a.lastCol - b.lastCol;
            if (a.sev !== b.sev) return a.sev - b.sev;
        } else if (a.sev !== b.sev) {
            return a.sev - b.sev;
        }
        return a.i - b.i;
    });

    // Lọc
    let visibleRows = onlyIssues ? allRows.filter(r => r.sev < 2) : allRows;
    if (dupOnly) {
        // Chỉ giữ item lặp nhiều dòng, gom các dòng của cùng 1 item sát nhau
        // (nhóm xếp theo vị trí dòng đầu tiên của item; trong nhóm: theo thứ tự ca rồi line)
        const rank = new Map();
        visibleRows = visibleRows.filter(r => (itemRowCount.get(r.res.itemKey) || 1) > 1);
        visibleRows.forEach((r, idx) => { if (!rank.has(r.res.itemKey)) rank.set(r.res.itemKey, idx); });
        visibleRows = visibleRows.map((r, idx) => ({ r, idx })).sort((x, y) => {
            const gx = rank.get(x.r.res.itemKey), gy = rank.get(y.r.res.itemKey);
            if (gx !== gy) return gx - gy;
            if (sortMode === 'date') {
                if (x.r.firstCol !== y.r.firstCol) return x.r.firstCol < y.r.firstCol ? -1 : 1;
                const byLine = lineCmp(x.r.line, y.r.line);
                if (byLine !== 0) return byLine;
            }
            return x.idx - y.idx;
        }).map(o => o.r);
    }
    const visibleItemCount = new Set(visibleRows.map(r => r.res.itemKey)).size;
    if (countEl) countEl.textContent = `Hiển thị ${visibleRows.length}/${allRows.length} dòng · ${visibleItemCount} item`;

    if (!visibleRows.length) {
        const filtering = !!(lineFilter || q || dupOnly);
        gridEl.innerHTML = filtering
            ? `<div class="eta-empty"><i class="bi bi-funnel"></i><strong>Không có dòng nào khớp bộ lọc.</strong><br>${dupOnly ? 'Không có item nào bị trùng theo bộ lọc hiện tại. ' : ''}Thử đổi line / từ khóa${onlyIssues ? ' hoặc bỏ tick "Chỉ hiện dòng có vi phạm"' : ''}.</div>`
            : `<div class="eta-empty">
                <i class="bi bi-shield-check"></i>
                <strong>Không phát hiện vi phạm nào!</strong><br>
                Tất cả ${allRows.length} dòng đều thỏa mãn ràng buộc LINE · DIRECT · ETA · PICK UP.
            </div>`;
        return;
    }

    // THEAD
    const dateHeaderCells = dayColumns.map((dc, i) => {
        const nextDate = dayColumns[i + 1]?.date;
        const isLastInDay = !nextDate || nextDate !== dc.date;
        return `<th class="col-day ${isLastInDay ? 'day-group-end' : ''}">${escapeHtml(dc.date)}</th>`;
    }).join('');
    const numHeaderCells = dayColumns.map((_, i) => {
        const nextDate = dayColumns[i + 1]?.date;
        const isLastInDay = !nextDate || nextDate !== dayColumns[i].date;
        return `<th class="col-day ${isLastInDay ? 'day-group-end' : ''}">${i + 1}</th>`;
    }).join('');

    const thead = `
        <thead>
            <tr>
                <th class="col-num" rowspan="2">#</th>
                <th class="col-item" rowspan="2">ITEM / FRAME</th>
                <th class="col-line" rowspan="2">LINE /<br><small style="font-weight:500;opacity:.8">ALLOCATED</small></th>
                <th class="col-eta" rowspan="2">ETA</th>
                <th class="col-pickup" rowspan="2">PICK UP</th>
                <th class="col-qty" rowspan="2">DIRECT</th>
                <th class="col-qty" rowspan="2">ASHTON</th>
                ${dateHeaderCells}
                <th class="col-total" rowspan="2">Quantity</th>
                <th class="col-item-issues col-issues" rowspan="2">PROBLEM</th>
            </tr>
            <tr>${numHeaderCells}</tr>
        </thead>`;

    // TBODY — mỗi dòng 1 <tr>, không gộp rowspan theo item
    let tbody = '';
    let prevLine = null;
    visibleRows.forEach(r => {
        const res = r.res;
        const row = res.row;
        const il = res.itemLevel;
        // Vạch ngăn: đổi item (khi lọc item trùng) hoặc đổi line (khi sắp theo ngày)
        const blockKey = dupOnly ? res.itemKey : r.line;
        const lineStart = (dupOnly || sortMode === 'date') && prevLine !== null && blockKey !== prevLine;
        prevLine = blockKey;

        const nRows = itemRowCount.get(res.itemKey) || 1;
        const isDup = nRows > 1;
        const dupAttr = isDup ? ` style="--dup-h:${dupHue.get(res.itemKey)}"` : '';
        const dupBadge = isDup
            ? `<span class="dup-badge" title="Item này xuất hiện ở ${nRows} dòng (khác line / khác ngày)">TRÙNG ×${nRows}</span>`
            : '';

        tbody += `<tr class="eta-row ${r.sev === 0 ? 'row-has-error' : ''} ${lineStart ? 'line-block-start' : ''}">`;
        tbody += `<td class="col-num">${row.rowIndex}</td>`;
        tbody += `<td class="col-item ${isDup ? 'is-dup' : ''}"${dupAttr}>
            <div class="item-name">${escapeHtml(row.item)}${dupBadge}</div>
            ${row.frame ? `<div class="item-frame">${escapeHtml(row.frame)}</div>` : ''}
        </td>`;
        tbody += renderEtaDirectRowCells(res, dayColumns, nRows);
        tbody += `<td class="col-item-issues col-issues">${etaIssuesCellHtml(il.itemIssues, res.rowLevel.rowIssues)}</td>`;
        tbody += `</tr>`;
    });

    gridEl.innerHTML = `<table class="eta-grid">${thead}<tbody>${tbody}</tbody></table>`;
}

function initCheckEtaDirectUi() {
    // (nút mở modal / Phân tích / Xóa / ô dán đã được gắn sự kiện ở phần khởi tạo phía trên)
    const fileInput = document.getElementById('etaDirectFile');
    const info = document.getElementById('etaDirectFileInfo');

    document.getElementById('etaDirectToggleInputBtn').addEventListener('click', () => {
        const wrap = document.getElementById('etaDirectInputWrap');
        setEtaInputCollapsed(!wrap.classList.contains('eta-hidden'));
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
            info.textContent = 'Chưa chọn file';
            info.classList.remove('has-file', 'has-error');
            updateEtaDirectStatus('Sẵn sàng phân tích');
            return;
        }
        info.classList.remove('has-error');
        info.textContent = `Đang đọc: ${file.name} (${Math.round(file.size / 1024)} KB)...`;
        updateEtaDirectStatus(`Đang đọc file "${file.name}"...`);
        try {
            const { matrix, sheetName } = await readExcelRawMatrix(file);
            document.getElementById('etaDirectPaste').value = etaMatrixToText(matrix);
            scheduleEtaDirectBadgeUpdate();
            const rows = Math.max(0, matrix.filter(r => (r || []).some(c => String(c ?? '').trim())).length - 2);
            info.textContent = `✓ Đã thêm file: ${file.name} (${Math.round(file.size / 1024)} KB)` +
                (sheetName ? ` · sheet "${sheetName}"` : '') + ` · ~${rows} dòng`;
            info.classList.add('has-file');
            updateEtaDirectStatus(`Đã thêm file "${file.name}"${sheetName ? ` (sheet ${sheetName})` : ''} — bấm Phân tích để kiểm tra`);
        } catch (err) {
            console.error('Lỗi đọc file:', err);
            info.textContent = `✕ Không đọc được "${file.name}"`;
            info.classList.remove('has-file');
            info.classList.add('has-error');
            updateEtaDirectStatus(`Lỗi: không đọc được file "${file.name}"`);
        }
    });

    // Kéo thả file vào dropzone
    const dz = document.querySelector('label[for="etaDirectFile"]');
    if (dz) {
        ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
        dz.addEventListener('drop', e => {
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (!f) return;
            const dt = new DataTransfer();
            dt.items.add(f);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    document.getElementById('etaDirectOnlyIssues').addEventListener('change', renderEtaDirectGrid);
    document.getElementById('etaDirectOnlyDup').addEventListener('change', renderEtaDirectGrid);
    document.getElementById('etaDirectLineFilter').addEventListener('change', renderEtaDirectGrid);
    document.getElementById('etaDirectSort').addEventListener('change', renderEtaDirectGrid);
    let etaSearchTimer = null;
    document.getElementById('etaDirectSearch').addEventListener('input', () => {
        clearTimeout(etaSearchTimer);
        etaSearchTimer = setTimeout(renderEtaDirectGrid, 150);
    });
}

window.addEventListener('beforeunload', () => {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    if (uiRefreshInterval) {
        clearInterval(uiRefreshInterval);
    }
});