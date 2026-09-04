// Firebase Configuration - Chỉ sử dụng Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, enableIndexedDbPersistence, query, where, writeBatch } 
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

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
        console.warn('⚠️ The current browser does not support offline persistence');
    }
});

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

// Voice Notification Settings - Simple with Google TTS support
let voiceNotificationSettings = {
    enabled: localStorage.getItem('workpic-voice-enabled') === 'true',
    language: 'vi-VN', // Default to Vietnamese
    googleApiKey: localStorage.getItem('workpic-google-api-key') || '',
    apiKeyAsked: localStorage.getItem('workpic-api-key-asked') === 'true' // Track if API key was asked before
};
let currentAudio = null;

// Simple Voice Notification Manager
const VoiceNotificationManager = {
    init() {
        // Initialize Web Speech API
        this.loadBrowserVoice();
    },

    loadBrowserVoice() {
        // Ensure Web Speech API is available
        if (!window.speechSynthesis) {
            console.warn('⚠️ Web Speech API not supported in this browser');
        }
    },

    async speak(text) {
        if (!voiceNotificationSettings.enabled) return;

        // Try Google TTS first if API key is provided
        if (voiceNotificationSettings.googleApiKey) {
            const success = await this.speakWithGoogleTTS(text);
            if (success) return;
        }

        // Fallback to Web Speech API
        this.speakWithWebSpeechAPI(text);
    },

    async speakWithGoogleTTS(text) {
        try {
            // Stop any current playback
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + voiceNotificationSettings.googleApiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text: text },
                    voice: {
                        languageCode: voiceNotificationSettings.language,
                        name: voiceNotificationSettings.language === 'vi-VN' ? 'vi-VN-Neural2-A' : 'en-US-Neural2-C',
                        ssmlGender: 'FEMALE'
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 0.9,
                        volumeGainDb: 2
                    }
                })
            });

            if (!response.ok) {
                console.warn('⚠️ Google TTS API error:', response.status, response.statusText, 'falling back to browser voice');
                if (response.status === 401 || response.status === 403) {
                    this.clearInvalidGoogleKey('API key Google không hợp lệ hoặc chưa bật Cloud Text-to-Speech API trong project.');
                }
                return false;
            }

            const data = await response.json();
            
            if (data.audioContent) {
                const audioData = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
                const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                currentAudio = new Audio(audioUrl);
                currentAudio.play().catch(err => {
                    console.error('❌ Audio playback error:', err);
                });
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Google TTS error:', error);
            return false;
        }
    },

    clearInvalidGoogleKey(reason) {
        const hadGoogleKey = !!voiceNotificationSettings.googleApiKey;
        voiceNotificationSettings.googleApiKey = '';
        voiceNotificationSettings.apiKeyAsked = false;
        localStorage.removeItem('workpic-google-api-key');
        localStorage.setItem('workpic-api-key-asked', 'false');

        if (hadGoogleKey) {
            showNotification('⚠️ Giọng nói Google không khả dụng', `${reason} Đã chuyển sang giọng nói trình duyệt.`, false, 'warning');
        }
    },

    speakWithWebSpeechAPI(text) {
        try {
            // Cancel any ongoing speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = voiceNotificationSettings.language;
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;

            if (window.speechSynthesis) {
                window.speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error('❌ Web Speech API error:', error);
        }
    },

    toggle(forceAskApiKey = false) {
        const shouldEnable = !voiceNotificationSettings.enabled;
        voiceNotificationSettings.enabled = shouldEnable;
        
        // If enabling voice and the key has not yet been asked for or forced to update
        if (voiceNotificationSettings.enabled && (!voiceNotificationSettings.apiKeyAsked || forceAskApiKey)) {
            const result = this.askForApiKey();
            if (!result) {
                voiceNotificationSettings.enabled = false;
                showNotification('🔇 Giọng Nói Tắt', 'Bạn đã hủy việc thiết lập giọng nói Google.', false, 'info');
            } else {
                voiceNotificationSettings.apiKeyAsked = true;
                localStorage.setItem('workpic-api-key-asked', 'true');
            }
        } else if (voiceNotificationSettings.enabled) {
            // Show status message
            if (voiceNotificationSettings.googleApiKey) {
                showNotification('🎧 Giọng Nói Bật', 'Dùng giọng nói Google (Shift+Click để thay đổi API)', false, 'success');
            } else {
                showNotification('🔊 Giọng Nói Bật', 'Dùng giọng nói Browser (Shift+Click để thêm Google API)', false, 'info');
            }
        } else {
            showNotification('🔇 Giọng Nói Tắt', 'Thông báo không phát âm thanh', false, 'info');
        }
        
        localStorage.setItem('workpic-voice-enabled', voiceNotificationSettings.enabled);
        this.updateUI();
    },

    askForApiKey() {
        const currentKey = voiceNotificationSettings.googleApiKey || '';
        const prompt_text = currentKey 
            ? 'Thay đổi Google Cloud Text-to-Speech API key:\n\nAPI key hiện tại: ' + currentKey.substring(0, 10) + '...\n\n(Để trống để dùng giọng nói browser mặc định)\n\nHướng dẫn: https://cloud.google.com/docs/authentication/api-keys'
            : 'Để sử dụng giọng nói Google (chất lượng cao và dễ nghe hơn):\n\nNhập Google Cloud Text-to-Speech API key:\n\n(Để trống để dùng giọng nói browser mặc định)\n\nHướng dẫn: https://cloud.google.com/docs/authentication/api-keys';
        
        const apiKey = prompt(prompt_text, currentKey);
        
        if (apiKey === null) {
            return false;
        }

        const trimmedKey = apiKey.trim();
        if (trimmedKey) {
            const googleApiKeyPattern = /^AIza[0-9A-Za-z\-_]{35}$/;
            if (!googleApiKeyPattern.test(trimmedKey)) {
                showNotification('⚠️ API key không hợp lệ', 'Google Cloud API key phải có định dạng AIza... và project phải bật Text-to-Speech API.', false, 'warning');
                voiceNotificationSettings.googleApiKey = '';
                localStorage.removeItem('workpic-google-api-key');
                return false;
            }

            voiceNotificationSettings.googleApiKey = trimmedKey;
            localStorage.setItem('workpic-google-api-key', trimmedKey);
            showNotification('API Key Đã Lưu', 'Giọng nói Google sẽ được dùng từ bây giờ', false, 'success');
            return true;
        }

        // User pressed OK with empty input - clear API key
        voiceNotificationSettings.googleApiKey = '';
        localStorage.removeItem('workpic-google-api-key');
        showNotification('Chuyển sang Giọng Nói Browser', 'Sẽ dùng giọng nói mặc định của trình duyệt', false, 'info');
        return true;
    },

    updateUI() {
        const toggleBtn = document.getElementById('voiceToggleBtn');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', voiceNotificationSettings.enabled);
            const icon = toggleBtn.querySelector('i');
            const label = toggleBtn.querySelector('span');
            
            if (voiceNotificationSettings.enabled) {
                icon.className = 'bi bi-volume-up-fill';
                if (label) label.textContent = 'Giọng nói bật';
            } else {
                icon.className = 'bi bi-voicemail';
                if (label) label.textContent = 'Giọng nói tắt';
            }
        }
    }
};

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

function handleAuthenticatedUser(user) {
    currentUser = user;
    document.getElementById('authScreen').classList.add('d-none');
    document.getElementById('currentUserEmail').textContent = user.email || '';
    initializeAuthenticatedApp();
}

function handleSignedOut() {
    currentUser = null;
    if (unsubscribeJobs) {
        unsubscribeJobs();
        unsubscribeJobs = null;
    }
    jobs = [];
    filteredJobs = [];
    document.getElementById('authScreen').classList.remove('d-none');
    document.getElementById('currentUserEmail').textContent = '';
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
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    
    jobModal = new bootstrap.Modal(document.getElementById('jobModal'));
    viewJobModal = new bootstrap.Modal(document.getElementById('viewJobModal'));
    migrateLegacyJobsModal = new bootstrap.Modal(document.getElementById('migrateLegacyJobsModal'));
    viewDataModal = new bootstrap.Modal(document.getElementById('viewDataModal'));
    
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
    document.getElementById('migrateLegacyJobsBtn').addEventListener('click', openLegacyMigrationModal);
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


// Open View Job Modal (Hiển thị trạng thái tạm dừng)
function openViewJobModal(job) {
    currentViewingJobId = job.id;
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
        <div class="mb-3">
            <label class="form-label fw-bold" for="transferUserSelect"><i class="bi bi-person-check-fill"></i> Chuyển job cho user khác</label>
            <div class="input-group">
                <select class="form-select" id="transferUserSelect">
                    <option value="">Chọn user nhận job...</option>
                </select>
                <button type="button" class="btn btn-outline-primary" id="transferJobBtn"><i class="bi bi-send-fill"></i> Chuyển</button>
            </div>
        </div>
    `;
    document.getElementById('transferJobBtn').addEventListener('click', transferJob);
    loadTransferUsers();
    viewJobModal.show();
}

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
        users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
        usersContainer.innerHTML = users.length
            ? `<table class="table table-sm table-bordered align-middle">
                <thead><tr><th>Tên</th><th>Email</th><th>Trạng thái</th></tr></thead>
                <tbody>${users.map(user => `
                    <tr>
                        <td>${escapeHtml(user.displayName || '-')}</td>
                        <td>${escapeHtml(user.email || '-')}</td>
                        <td>${user.uid === currentUser.uid ? '<span class="badge bg-success">Đang đăng nhập</span>' : '<span class="badge bg-secondary">User</span>'}</td>
                    </tr>`).join('')}</tbody>
            </table>`
            : '<p class="text-muted">Chưa có user nào.</p>';
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
    try {
        await updateDoc(doc(db, 'jobs', jobId), {
            ownerId: targetUid,
            updatedAt: new Date().toISOString()
        });
        viewJobModal.hide();
        currentViewingJobId = null;
        showNotification('Đã chuyển job', `Job "${job.title}" đã được chuyển cho user khác.`, false, 'success');
    } catch (error) {
        console.error('Lỗi chuyển job:', error);
        showNotification('Lỗi', 'Không thể chuyển job. Vui lòng thử lại.', false, 'danger');
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
    document.getElementById('modalTitle').innerHTML = isOutOfSchedule
        ? '<i class="bi bi-lightning-charge-fill"></i> Thêm Job Ngoài Lịch'
        : '<i class="bi bi-plus-circle-fill"></i> Thêm Job Mới';
    document.getElementById('jobForm').reset();
    document.getElementById('jobDescription').innerHTML = '';
    document.getElementById('deleteJobBtn').style.display = 'none';
    
    const now = new Date();
    document.getElementById('jobDate').value = now.toISOString().split('T')[0];
    document.getElementById('jobTime').value = now.toTimeString().slice(0, 5);
    document.getElementById('workOnSunday').checked = false; // Default: KHÔNG làm CN
    document.getElementById('isPaused').checked = false;
    document.getElementById('isOutOfSchedule').checked = isOutOfSchedule;
    toggleOutOfScheduleFields();

    jobModal.show();
}

// Open Edit Job Modal
function openEditJobModal(job) {
    currentEditingJobId = job.id;
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
    document.getElementById('isPaused').checked = job.isPaused === true; // NEW
    document.getElementById('isOutOfSchedule').checked = job.isOutOfSchedule === true;
    document.getElementById('deleteJobBtn').style.display = 'block';
    toggleOutOfScheduleFields();
    
    jobModal.show();
}

// Save Job
async function saveJob() {
    const title = document.getElementById('jobTitle').value.trim();
    const type = document.getElementById('jobType').value;
    const date = document.getElementById('jobDate').value;
    const time = document.getElementById('jobTime').value;
    const description = document.getElementById('jobDescription').innerHTML;
    const notificationToggle = document.getElementById('enableNotification');
    const enableNotification = notificationToggle ? notificationToggle.checked : true;
    const workOnSunday = document.getElementById('workOnSunday').checked;
    const isPaused = document.getElementById('isPaused').checked; // NEW
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
        isPaused, // NEW
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
            icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'
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
