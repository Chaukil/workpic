// Firebase Configuration - Chỉ sử dụng Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, enableIndexedDbPersistence, query, where, writeBatch, arrayUnion, arrayRemove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } 
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
let dayOffModalOpen = false;
let dayOffsList = [];            // toàn bộ lịch off (mọi user) từ tháng trước trở đi
let unsubscribeDayOffs = null;
let dayOffSelected = new Set();  // các ngày (YYYY-MM-DD) MÌNH đang chọn off
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

// Voice command
let voiceRecognition = null;
let voiceListening = false;

// Morning digest email
const MORNING_DIGEST_STORAGE_KEY = 'workpic_morning_digest_sent';
const MORNING_DIGEST_HOURS = { from: 6, to: 10 };  // Chỉ gửi mail trong khung 6h–10h

function applyTheme(theme) {
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

    localStorage.setItem('workpic-theme', theme);
}

function initTheme() {
    const savedTheme = localStorage.getItem('workpic-theme');
    const preferredTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(preferredTheme);
}

function setAuthMode(mode) {
    authMode = mode;
    const isRegister = mode === 'register';
    document.getElementById('loginTab').classList.toggle('active', !isRegister);
    document.getElementById('registerTab').classList.toggle('active', isRegister);
    document.getElementById('authNameLabel').classList.toggle('d-none', !isRegister);
    document.getElementById('authName').classList.toggle('d-none', !isRegister);
    document.getElementById('authName').required = isRegister;
    document.getElementById('authSubmitBtn').textContent = isRegister ? 'Tạo tài khoản' : 'Đăng nhập';
    document.getElementById('authError').textContent = '';
}

function showAuthError(error) {
    const messages = {
        'auth/configuration-not-found': 'Firebase Authentication chưa được cấu hình. Hãy bật Identity Platform và phương thức Email/Password trong Firebase Console.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/email-already-in-use': 'Email này đã được đăng ký.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.'
    };
    document.getElementById('authError').textContent = messages[error.code] || 'Không thể xác thực. Vui lòng thử lại.';
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim();
    const submitButton = document.getElementById('authSubmitBtn');
    submitButton.disabled = true;
    document.getElementById('authError').textContent = '';

    try {
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
    } catch (error) {
        console.error('Authentication error:', error);
        showAuthError(error);
    } finally {
        submitButton.disabled = false;
    }
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
    document.getElementById('profileUid').textContent = currentUser.uid || '---';

    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || '';
    document.getElementById('profileDisplayName').value = displayName;
    document.getElementById('profileNotifyLead').value = String(notifyLeadMinutes);

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

async function saveNotifyLead() {
    if (!currentUser) return;
    const minutes = normalizeLeadMinutes(document.getElementById('profileNotifyLead').value);
    notifyLeadMinutes = minutes;
    localStorage.setItem(`notifyLead_${currentUser.uid}`, String(minutes));
    try {
        const snapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        if (!snapshot.empty) {
            await updateDoc(doc(db, 'users', snapshot.docs[0].id), { notifyLeadMinutes: minutes, updatedAt: new Date().toISOString() });
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
    migrateLegacyJobsModal = new bootstrap.Modal(document.getElementById('migrateLegacyJobsModal'));
    viewDataModal = new bootstrap.Modal(document.getElementById('viewDataModal'));
    checkDueModal = new bootstrap.Modal(document.getElementById('checkDueModal'));
    presenterSpinModal = new bootstrap.Modal(document.getElementById('presenterSpinModal'));
    dayOffModal = new bootstrap.Modal(document.getElementById('dayOffModal'));

    document.getElementById('dayOffModal').addEventListener('hidden.bs.modal', () => { dayOffModalOpen = false; });
    transferConfirmModal = new bootstrap.Modal(document.getElementById('transferConfirmModal'));
    quickJobInviteModal = new bootstrap.Modal(document.getElementById('quickJobInviteModal'), {
        backdrop: 'static',
        keyboard: false
    });
    quickJobTransferConfirmModal = new bootstrap.Modal(document.getElementById('quickJobTransferConfirmModal'));
    guideModal = new bootstrap.Modal(document.getElementById('guideModal'));

    initQuickChatUi();
    initVoiceCommand();

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
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('showSunday').addEventListener('change', toggleSunday);
    document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
    
    document.getElementById('loginTab').addEventListener('click', () => setAuthMode('login'));
    document.getElementById('registerTab').addEventListener('click', () => setAuthMode('register'));
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
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

    document.getElementById('userProfileBtn').addEventListener('click', openUserProfileModal);
    document.getElementById('saveProfileBtn').addEventListener('click', saveUserProfile);
    document.getElementById('profileNotifyLead').addEventListener('change', saveNotifyLead);
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
        <table style="border-collapse: collapse; width: auto; max-width: 100%; margin: 0.5rem 0; table-layout: auto;">
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
        console.log(`📊 Số lượng jobs hiện tại: ${snapshot.size}`);
        
        showNotification('Kết nối thành công', `Đã kết nối với Firestore. Tìm thấy ${snapshot.size} jobs.`);
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
            
            if (!isSunday || workOnSunday) {
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
            } else if (cellDate.getTime() === todayDate.getTime()) {
                cell.style.backgroundColor = '#fffbea';
                cell.style.fontWeight = 'bold';
            }
            
            // Date header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header text-muted small';
            dateHeader.innerHTML = `<i class="bi bi-calendar-day"></i> ${formatDateShort(currentDate)}${offDoc ? '<span class="day-off-badge">OFF</span>' : ''}`;
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
    document.getElementById('deleteJobBtn').style.display = 'none';
    document.getElementById('pauseJobBtn').style.display = 'none'; // NEW
    
    const now = new Date();
    document.getElementById('jobDate').value = now.toISOString().split('T')[0];
    document.getElementById('jobTime').value = now.toTimeString().slice(0, 5);
    document.getElementById('workOnSunday').checked = false;
    document.getElementById('isOutOfSchedule').checked = isOutOfSchedule;
    toggleOutOfScheduleFields();

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
    
    const notificationToggle = document.getElementById('enableNotification');
    if (notificationToggle) {
        notificationToggle.checked = job.enableNotification !== false;
    }
    
    document.getElementById('workOnSunday').checked = job.workOnSunday !== false;
    document.getElementById('isOutOfSchedule').checked = job.isOutOfSchedule === true;
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
        snapshot.forEach(d => {
            const u = d.data();
            if (u.uid && u.avatar && !usersAvatarCache[u.uid]) {
                usersAvatarCache[u.uid] = u.avatar;
            }
        });

        // Nếu avatar của chính mình vừa được sync từ thiết bị khác → cập nhật
        if (currentUser && usersAvatarCache[currentUser.uid] && usersAvatarCache[currentUser.uid] !== currentUser.avatar) {
            currentUser.avatar = usersAvatarCache[currentUser.uid];
            updateUserProfileUI();
        }

        // Refresh các UI đang dùng avatar
        if (dayOffModalOpen) renderDayOffModal();
        if (typeof renderQuickChat === 'function' && quickChatPanelOpen) renderQuickChat();
        if (typeof renderSpinUsersList === 'function' && spinCandidates && spinCandidates.length
            && document.getElementById('presenterSpinModal')?.classList.contains('show')) {
            renderSpinUsersList();
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
            icon: 'https://cdn-icons-png.flaticon.com/512/1189/11890970.png'
        });
    }
    
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
        spinCandidates = [];
        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.uid) spinCandidates.push(user);
        });
        spinCandidates.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));

        // Khôi phục danh sách đã bỏ chọn + số phiếu từ lần trước, chỉ giữ uid còn tồn tại
        const validUids = new Set(spinCandidates.map(u => u.uid));
        spinExcludedUids = new Set(Array.from(loadExcludedUidsFromStorage()).filter(uid => validUids.has(uid)));
        const savedTickets = loadSpinTicketsFromStorage();
        spinTickets = {};
        Object.keys(savedTickets).forEach(uid => { if (validUids.has(uid)) spinTickets[uid] = savedTickets[uid]; });

        renderSpinUsersList();
        renderSpinWheel();
    } catch (error) {
        console.error('Lỗi tải danh sách user để quay số:', error);
        listEl.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><br>Không tải được danh sách user</div>';
    }
}

function renderSpinUsersList() {
    const listEl = document.getElementById('spinUsersList');
    updateSpinCounts();

    if (!spinCandidates.length) {
        listEl.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><br>Chưa có user nào</div>';
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
// LỊCH OFF — đăng ký ngày nghỉ & dời job trong lịch cố định
// Firestore: collection "dayOffs", mỗi ngày off = 1 document, id = `${uid}_${YYYY-MM-DD}`
//   { userId, userName, date, reason, createdAt }
// ============================================================
const DAYOFF_COLLECTION = 'dayOffs';
const DAYOFF_MONTHS_SHOWN = 2;   // tháng hiện tại + tháng sau

function listenDayOffs() {
    if (unsubscribeDayOffs) unsubscribeDayOffs();
    // Lấy từ đầu tháng trước để tuần hiện tại (có thể nằm ở tháng trước) vẫn tính đúng
    const lower = new Date();
    lower.setDate(1);
    lower.setMonth(lower.getMonth() - 1);
    const q = query(collection(db, DAYOFF_COLLECTION), where('date', '>=', localDateKey(lower)));
    unsubscribeDayOffs = onSnapshot(q, (snapshot) => {
        dayOffsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
    dayOffModal.show();
    renderDayOffModal();

    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        // Đồng thời nạp cache avatar từ kết quả fetch này (đề phòng listener
        // listenUsersAvatars chưa fire xong hoặc chưa có user nào có avatar)
        if (!usersAvatarCache) usersAvatarCache = {};
        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.uid) {
                users.push(user);
                if (user.avatar) usersAvatarCache[user.uid] = user.avatar;
            }
        });
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

function renderDayOffUsers() {
    const todayKey = localDateKey(new Date());
    document.getElementById('dayOffUsersCount').textContent = dayOffUsers.length;
    document.getElementById('dayOffUsersList').innerHTML = dayOffUsers.map(user => {
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
        if (dayOffFocusUid && o.userId !== dayOffFocusUid) return;
        (othersByDate[o.date] = othersByDate[o.date] || []).push(o);
    });
    const showMine = !dayOffFocusUid || dayOffFocusUid === currentUser.uid;

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
            const isSelected = dayOffSelected.has(key);
            const isPending = isSelected && !savedMine[key];

            const entries = (othersByDate[key] || []).map(o => ({
                uid: o.userId, name: dayOffUserName(o.userId, o.userName), reason: o.reason
            }));
            if (showMine && isSelected) {
                const reason = savedMine[key] ? savedMine[key].reason : '(chưa lưu)';
                entries.unshift({ uid: currentUser.uid, name: 'Tôi', reason });
            }

            const chips = entries.slice(0, 3).map(e =>
                `<span class="dayoff-chip" style="background:${getDayOffUserColor(e.uid)}">${escapeHtml(avatarInitial({ displayName: e.name }))}</span>`
            ).join('') + (entries.length > 3 ? `<span class="dayoff-chip more">+${entries.length - 3}</span>` : '');
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
        .filter(o => o.date >= todayKey && (!dayOffFocusUid || o.userId === dayOffFocusUid))
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
        : 'Lịch off sắp tới của mọi người';

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
                await deleteDoc(doc(db, DAYOFF_COLLECTION, id));
                dayOffSelected.delete(date);
                dayOffsList = dayOffsList.filter(o => o.id !== id);
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
            batch.delete(doc(db, DAYOFF_COLLECTION, saved[key].id));
        });
        await batch.commit();

        // Cập nhật ngay danh sách local + vẽ lại lịch cố định (không chờ snapshot)
        const removedIds = new Set(removed.map(k => saved[k].id));
        dayOffsList = dayOffsList.filter(o => !removedIds.has(o.id)).concat(added.map(key => ({
            id: `${currentUser.uid}_${key}`, userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'User', date: key, reason, createdAt: now
        })));
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
// VOICE COMMAND — điều khiển bằng giọng nói (Chrome/Edge)
// ============================================================
function initVoiceCommand() {
    const btn = document.getElementById('voiceBtn');
    if (!btn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btn.style.display = 'none';
        return;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'vi-VN';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 3;

    voiceRecognition.onstart = () => {
        voiceListening = true;
        updateVoiceButton();
        showNotification('🎤 Đang nghe', 'Hãy nói lệnh của bạn…', false, 'info');
    };
    voiceRecognition.onend = () => {
        voiceListening = false;
        updateVoiceButton();
    };
    voiceRecognition.onerror = (e) => {
        voiceListening = false;
        updateVoiceButton();
        if (e.error === 'not-allowed') {
            showNotification('Lỗi micro', 'Vui lòng cấp quyền micro cho trang web.', false, 'danger');
        } else if (e.error === 'no-speech') {
            showNotification('Không nghe thấy', 'Không nhận diện được giọng nói.', false, 'warning');
        }
    };
    voiceRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        console.log('🎤 Voice:', transcript);
        handleVoiceCommand(transcript);
    };

    btn.addEventListener('click', toggleVoice);
    updateVoiceButton();
}

function toggleVoice() {
    if (!voiceRecognition) {
        showNotification('Không hỗ trợ', 'Trình duyệt không hỗ trợ nhận diện giọng nói. Dùng Chrome/Edge.', false, 'warning');
        return;
    }
    if (voiceListening) {
        voiceRecognition.stop();
    } else {
        try { voiceRecognition.start(); } catch (e) { console.error(e); }
    }
}

function updateVoiceButton() {
    const btn = document.getElementById('voiceBtn');
    if (!btn) return;
    btn.classList.toggle('voice-active', voiceListening);
    btn.title = voiceListening ? 'Đang nghe… (bấm để dừng)' : 'Lệnh thoại';
}

function handleVoiceCommand(text) {
    // 1. Đóng modal
    if (/^(đóng|tắt|close|thoát)/.test(text)) {
        document.querySelectorAll('.modal.show').forEach(m => {
            const inst = bootstrap.Modal.getInstance(m);
            if (inst) inst.hide();
        });
        showNotification('Đã đóng', 'Đã đóng tất cả cửa sổ.', false, 'success');
        return;
    }

    // 2. Tìm kiếm job
    const searchMatch = text.match(/^(tìm|tìm kiếm|search)\s+(.+)/);
    if (searchMatch) {
        const q = searchMatch[2].replace(/^(job|việc|công việc)\s+/, '').trim();
        document.getElementById('searchJob').value = q;
        handleSearch({ target: { value: q } });
        showNotification('Đang tìm', `"${q}"`, false, 'success');
        return;
    }

    // 3. Thêm job: "thêm job ABC lúc 8 giờ 30 ngày 5 tháng 10"
    const addMatch = text.match(/^(thêm|tạo|add)\s+(job|việc|công việc)\s+(.+)/);
    if (addMatch) {
        let title = addMatch[3].trim();
        let time = null;
        let date = null;

        const timeMatch = title.match(/lúc\s+(\d{1,2})\s*(?:giờ|h|:)?\s*(\d{1,2})?/);
        if (timeMatch) {
            const h = String(timeMatch[1]).padStart(2, '0');
            const m = timeMatch[2] ? String(timeMatch[2]).padStart(2, '0') : '00';
            time = `${h}:${m}`;
            title = title.replace(timeMatch[0], '').trim();
        }
        const dateMatch = title.match(/ngày\s+(\d{1,2})\s*tháng\s*(\d{1,2})/);
        if (dateMatch) {
            const y = new Date().getFullYear();
            const d = String(dateMatch[1]).padStart(2, '0');
            const mo = String(dateMatch[2]).padStart(2, '0');
            date = `${y}-${mo}-${d}`;
            title = title.replace(dateMatch[0], '').trim();
        }
        if (!title) { showNotification('Thiếu tên', 'Chưa nghe rõ tên job.', false, 'warning'); return; }

        openAddJobModal(false);
        document.getElementById('jobTitle').value = title;
        if (time) document.getElementById('jobTime').value = time;
        if (date) document.getElementById('jobDate').value = date;
        showNotification('Đã điền sẵn', `Job "${title}" — kiểm tra và bấm Lưu`, false, 'success');
        return;
    }

    // 4. Mở các chức năng
    if (/(lịch off|nghỉ|off)/.test(text))           { openDayOffModal(); return; }
    if (/(chat|job trong ngày|khung chat)/.test(text)) { openQuickChatPanel(); return; }
    if (/(check due|so sánh|đối chiếu|kiểm tra due)/.test(text)) { openCheckDueModal(); return; }
    if (/(quay số|thuyết trình|random|dice)/.test(text))         { openPresenterSpinModal(); return; }
    if (/(hướng dẫn|guide|trợ giúp)/.test(text))    { guideModal.show(); return; }
    if (/(thông tin|profile|tài khoản|avatar)/.test(text)) { openUserProfileModal(); return; }
    if (/(xem dữ liệu|xem job|view data)/.test(text)) { openViewDataModal(); return; }
    if (/(xuất pdf|in pdf|export pdf)/.test(text))   { exportToPDF(); return; }
    if (/(sidebar|ẩn menu|hiện menu|menu)/.test(text)) { toggleSidebar(); return; }

    // 5. Theme
    if (/(chế độ tối|dark mode|ban đêm|tối)/.test(text)) {
        applyTheme('dark');
        showNotification('Đã bật', 'Chế độ tối', false, 'success'); return;
    }
    if (/(chế độ sáng|light mode|ban ngày|sáng)/.test(text)) {
        applyTheme('light');
        showNotification('Đã bật', 'Chế độ sáng', false, 'success'); return;
    }

    // 6. Đăng xuất
    if (/(đăng xuất|logout|thoát tài khoản)/.test(text)) {
        showConfirmDialog({
            title: 'Đăng xuất?',
            message: 'Bạn có chắc muốn đăng xuất khỏi tài khoản?',
            confirmText: 'Đăng xuất',
            confirmClass: 'btn-delete',
            onConfirm: () => signOut(auth)
        });
        return;
    }

    // 7. Đọc lịch hôm nay
    if (/(hôm nay|việc hôm nay|hôm nay có gì|lịch hôm nay)/.test(text)) {
        speakTodayJobs(); return;
    }

    showNotification('Không hiểu lệnh', `"${text}"\nThử: "mở lịch off", "hôm nay có gì", "tìm frame mill"`, false, 'warning');
}

function speakTodayJobs() {
    if (!('speechSynthesis' in window)) {
        showNotification('Không hỗ trợ', 'Trình duyệt không hỗ trợ đọc văn bản.', false, 'warning');
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = localDateKey(today);
    const activeJobs = jobs.filter(j => j.isPaused !== true && j.isOutOfSchedule !== true);
    const entries = buildScheduleEntries(today, today, activeJobs);
    const todayItems = (entries[todayKey] || []).slice().sort((a, b) =>
        String(a.overrideTime || a.job.time || '').localeCompare(String(b.overrideTime || b.job.time || ''))
    );

    if (todayItems.length === 0) {
        speakText('Hôm nay bạn không có công việc nào.');
        return;
    }
    const parts = [`Hôm nay bạn có ${todayItems.length} công việc.`];
    todayItems.forEach(e => {
        const t = e.overrideTime || e.job.time || '';
        parts.push(`${t}, ${e.job.title}.`);
    });
    speakText(parts.join(' '));
}

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = 1.05;
    speechSynthesis.speak(u);
}

window.addEventListener('beforeunload', () => {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    if (uiRefreshInterval) {
        clearInterval(uiRefreshInterval);
    }
});