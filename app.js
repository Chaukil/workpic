// Firebase Configuration - Chỉ sử dụng Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, enableIndexedDbPersistence, query, where, writeBatch, arrayUnion, arrayRemove } 
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
const QUICK_CHAT_REACTIONS = ['👍', '❤️', '😂', '🔥'];

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
    } else {
        // Fallback to email-derived name or auth displayName
        currentUser.displayName = user.displayName || user.email?.split('@')[0] || 'User';
    }
    
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
    
    // Use displayName from Firestore (already fetched in handleAuthenticatedUser)
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    
    document.getElementById('userDisplayName').textContent = displayName;
    
    // Load avatar từ localStorage
    const savedAvatar = localStorage.getItem(`avatar_${currentUser.uid}`);
    const avatarImg = document.getElementById('userAvatar');
    if (savedAvatar) {
        avatarImg.src = savedAvatar;
    } else {
        // Avatar mặc định
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=28`;
    }
}

function openUserProfileModal() {
    if (!currentUser) return;
    
    document.getElementById('profileEmail').textContent = currentUser.email || '---';
    document.getElementById('profileUid').textContent = currentUser.uid || '---';
    
    // Use displayName from Firestore
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || '';
    document.getElementById('profileDisplayName').value = displayName;
    
    // Load avatar
    const savedAvatar = localStorage.getItem(`avatar_${currentUser.uid}`);
    const avatarImg = document.getElementById('profileAvatar');
    if (savedAvatar) {
        avatarImg.src = savedAvatar;
    } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=120`;
    }
    
    userProfileModal.show();
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
function changeAvatar(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarData = e.target.result;
        // Lưu vào localStorage
        localStorage.setItem(`avatar_${currentUser.uid}`, avatarData);
        
        // Cập nhật UI
        document.getElementById('userAvatar').src = avatarData;
        document.getElementById('profileAvatar').src = avatarData;
        
        showNotification('Thành công', 'Đã cập nhật ảnh đại diện!', false, 'success');
    };
    reader.readAsDataURL(file);
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
    jobs = [];
    filteredJobs = [];
    notificationsList = [];
    quickJobsList = [];
    quickChatUnreadCount = 0;
    shownInviteKeys = {};
    cachedUsersForAssign = null;
    pendingQuickInviteId = null;
    pendingQuickInviteData = null;
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
    transferConfirmModal = new bootstrap.Modal(document.getElementById('transferConfirmModal'));
    quickJobInviteModal = new bootstrap.Modal(document.getElementById('quickJobInviteModal'), {
        backdrop: 'static',
        keyboard: false
    });
    guideModal = new bootstrap.Modal(document.getElementById('guideModal'));

    initQuickChatUi();
    
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
            quarterly: [95, 39, 205],
            yearly: [236, 72, 153]
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
                quarterly: 'Quarterly',
                yearly: 'Yearly'
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
    const jobStartDate = new Date(job.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
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
            case 'quarterly':
                currentDate.setMonth(currentDate.getMonth() + 3);
                break;
            case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + 1);
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

        card.addEventListener('click', () => openEditJobModal(job));
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
    
    // Tạo map các jobs theo ngày (FILTER OUT PAUSED JOBS + OUT-OF-SCHEDULE JOBS)
    const jobsByDate = {};
    
    // Only include active (non-paused) jobs that belong to the fixed schedule
    const activeJobs = jobs.filter(job => job.isPaused !== true && job.isOutOfSchedule !== true);
    
    activeJobs.forEach(job => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (totalWeeks * 7) - 1);
        
        const occurrences = getJobOccurrences(job, startDate, endDate);
        
        occurrences.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            if (!jobsByDate[dateStr]) {
                jobsByDate[dateStr] = [];
            }
            jobsByDate[dateStr].push(job);
        });
    });
    
    // Render các tuần
    const daysToShow = showSunday ? 7 : 6;
    
    for (let week = 0; week < totalWeeks; week++) {
        const row = document.createElement('tr');
        
        for (let day = 0; day < daysToShow; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);
            
            const cell = document.createElement('td');
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Normalize dates for comparison (set to midnight)
            const cellDate = new Date(currentDate);
            cellDate.setHours(0, 0, 0, 0);
            
            const todayDate = new Date(today);
            todayDate.setHours(0, 0, 0, 0);
            
            // Highlight hôm nay
            if (cellDate.getTime() === todayDate.getTime()) {
                cell.style.backgroundColor = '#fffbea';
                cell.style.fontWeight = 'bold';
            }
            
            // Date header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header text-muted small';
            dateHeader.innerHTML = `<i class="bi bi-calendar-day"></i> ${formatDateShort(currentDate)}`;
            cell.appendChild(dateHeader);
            
            // Add jobs for this date - SORTED BY TIME
            let dayJobs = jobsByDate[dateStr] || [];
            
            // Sort jobs by time (HH:MM)
            dayJobs.sort((a, b) => {
                const timeA = a.time || '00:00';
                const timeB = b.time || '00:00';
                return timeA.localeCompare(timeB);
            });
            
            if (dayJobs.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'text-muted small text-center';
                emptyMsg.style.opacity = '0.4';
                emptyMsg.style.fontSize = '0.7rem';
                emptyMsg.textContent = '-';
                cell.appendChild(emptyMsg);
            } else {
                dayJobs.forEach(job => {
                    // Determine if job is past, today, or future
                    let timeClass = 'future'; // Default
                    
                    // Compare dates
                    if (cellDate < todayDate) {
                        // Ngày đã qua
                        timeClass = 'past';
                    } else if (cellDate.getTime() === todayDate.getTime()) {
                        // Hôm nay - kiểm tra giờ
                        const [jobHours, jobMinutes] = job.time.split(':').map(Number);
                        
                        // So sánh giờ
                        if (jobHours < currentHours) {
                            // Giờ đã qua
                            timeClass = 'past';
                        } else if (jobHours === currentHours && jobMinutes < currentMinutes) {
                            // Cùng giờ nhưng phút đã qua
                            timeClass = 'past';
                        } else {
                            // Giờ chưa đến
                            timeClass = 'today';
                        }
                    } else {
                        // Ngày tương lai
                        timeClass = 'future';
                    }
                    
                    const scheduleItem = document.createElement('div');
                    scheduleItem.className = `schedule-item ${job.type} ${timeClass}`;
                    scheduleItem.innerHTML = `
                        <h6 title="${job.title}">
                            <i class="bi bi-clipboard-check"></i> ${job.title}
                        </h6>
                        <small><i class="bi bi-clock-fill"></i> ${job.time}</small>
                    `;
                    scheduleItem.addEventListener('click', () => openViewJobModal(job));
                    cell.appendChild(scheduleItem);
                });
            }
            
            row.appendChild(cell);
        }
        
        scheduleBody.appendChild(row);
    }
}

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
    
    const q = query(
        collection(db, 'transferRequests'),
        where('toUid', '==', currentUser.uid),
        where('status', '==', 'pending')
    );
    
    onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
            const request = doc.data();
            // Hiển thị thông báo cho người dùng
            showTransferConfirmModal(doc.id, request);
        });
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

function getTypeBadgeColor(type) {
    const colors = {
        daily: 'danger',
        weekly: 'info',
        biweekly: 'primary',
        monthly: 'warning',
        quarterly: 'secondary',
        yearly: 'pink',
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
        quarterly: 'Quarterly',
        yearly: 'Yearly',
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
    quickjob_rejected: { icon: 'bi-x-circle-fill', color: '#dc2626', label: 'Từ chối job' }
};

function renderNotifDropdown() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const bell = document.getElementById('notifBellBtn');
    if (!list || !badge || !bell) return;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = notificationsList
        .filter(n => new Date(n.timestamp).getTime() >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const unreadCount = notificationsList.filter(n => !n.read).length;
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
                <div class="quick-chat-actions">
                    <button type="button" class="btn btn-sm btn-success" data-action="complete" data-id="${job.id}">
                        <i class="bi bi-check2-circle"></i> Hoàn thành
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${job.id}">
                        <i class="bi bi-x-circle"></i> Từ chối
                    </button>
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

    // Reaction bar
    const reactions = job.reactions || {};
    const reactionButtonsHtml = QUICK_CHAT_REACTIONS.map(emoji => {
        const uids = reactions[emoji] || [];
        const reacted = currentUser && uids.includes(currentUser.uid);
        return `
            <button type="button" class="quick-chat-reaction-btn ${reacted ? 'reacted' : ''}" data-action="react" data-id="${job.id}" data-emoji="${emoji}">
                ${emoji}${uids.length > 0 ? `<span class="quick-chat-reaction-count">${uids.length}</span>` : ''}
            </button>
        `;
    }).join('');

    // Comments
    const comments = job.comments || [];
    const commentsHtml = comments.length > 0
        ? `<div class="quick-chat-comments">${comments.map(c => `
            <div class="quick-chat-comment-item">
                <div class="quick-chat-comment-avatar">${getInitials(c.name)}</div>
                <div class="quick-chat-comment-body">
                    <span class="quick-chat-comment-author">${escapeHtml(c.name || '')}</span>
                    <span class="quick-chat-comment-text">${escapeHtml(c.text || '')}</span>
                </div>
            </div>
        `).join('')}</div>`
        : '';

    const commentFormHtml = `
        <div class="quick-chat-comment-form">
            <input type="text" class="quick-chat-comment-input" id="commentInput-${job.id}" placeholder="Viết bình luận ngắn...">
            <button type="button" class="quick-chat-comment-send" data-action="add-comment" data-id="${job.id}" title="Gửi bình luận">
                <i class="bi bi-send-fill"></i>
            </button>
        </div>
    `;

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
                <div class="quick-chat-avatar">${getInitials(job.createdByName)}</div>
                <span class="quick-chat-author">${escapeHtml(job.createdByName || 'Ẩn danh')}</span>
                <span class="quick-chat-time">${timeAgoVN(job.createdAt)}${editedTagHtml}</span>
                ${ownerToolsHtml}
            </div>
            <p class="quick-chat-content" id="content-${job.id}">${escapeHtml(job.content || '')}</p>
            ${editFormHtml}
            <div class="quick-chat-status-row">${statusPillHtml}${deadlinePillHtml}</div>
            ${actionsHtml}
            <div class="quick-chat-reactions-row">${reactionButtonsHtml}</div>
            ${commentsHtml}
            ${commentFormHtml}
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
            reactions: {},
            comments: [],
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

// Reaction (thả emoji) - toggle
async function quickChatToggleReaction(jobId, emoji) {
    if (!currentUser) return;
    const job = quickJobsList.find(j => j.id === jobId);
    if (!job) return;
    const uids = (job.reactions && job.reactions[emoji]) || [];
    const hasReacted = uids.includes(currentUser.uid);

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
    } catch (error) {
        console.error('Lỗi thả reaction:', error);
    }
}

// Thêm bình luận ngắn
async function quickChatAddComment(jobId) {
    if (!currentUser) return;
    const input = document.getElementById(`commentInput-${jobId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    try {
        await updateDoc(doc(db, 'quickJobs', jobId), {
            comments: arrayUnion({
                uid: currentUser.uid,
                name: currentUser.displayName || currentUser.email,
                text,
                at: new Date().toISOString()
            })
        });
        input.value = '';
    } catch (error) {
        console.error('Lỗi gửi bình luận:', error);
        showNotification('Lỗi', 'Không thể gửi bình luận.', false, 'danger');
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
            else if (action === 'react') quickChatToggleReaction(jobId, btn.dataset.emoji);
            else if (action === 'add-comment') quickChatAddComment(jobId);
            else if (action === 'show-edit') quickChatShowEditForm(jobId);
            else if (action === 'cancel-edit') quickChatCancelEditForm(jobId);
            else if (action === 'save-edit') quickChatSaveEdit(jobId);
            else if (action === 'delete') quickChatDeleteJob(jobId);
        });

        // Enter để gửi bình luận nhanh
        messages.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('quick-chat-comment-input')) {
                e.preventDefault();
                const jobId = e.target.id.replace('commentInput-', '');
                quickChatAddComment(jobId);
            }
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

// Check Notifications - WITH DESKTOP NOTIFICATIONS
function checkNotifications() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    jobs.forEach(job => {
        // Skip paused jobs
        if (job.isPaused === true) {
            return;
        }

        const isOutOfSchedule = job.isOutOfSchedule === true;
        if (isOutOfSchedule) {
            return;
        }
        
        if (job.enableNotification !== false) {
            const isDue = getJobOccurrences(job, now, now).length > 0 && job.time === currentTime;
            
            if (isDue) {
                const notificationKey = `notified_${job.id}_${currentDate}_${currentTime}`;
                if (!localStorage.getItem(notificationKey)) {
                    // Show in-app notification
                    showNotification(
                        '🔔 Nhắc nhở Job',
                        `Đã đến giờ thực hiện: ${job.title}`,
                        true
                    );
                    
                    // Show desktop notification
                    showDesktopNotification(job);
                    
                    localStorage.setItem(notificationKey, 'true');
                }
            }
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
        daily: 'Daily',
        weekly: 'Weekly',
        biweekly: 'Biweekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
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

window.addEventListener('beforeunload', () => {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    if (uiRefreshInterval) {
        clearInterval(uiRefreshInterval);
    }
});
