// ══════════════════════════════════════════════
// PKKM DIGITAL - MULTI TAHUN AJARAN (4 TAHUN)
// ══════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBhDGXnuMIvfr-9AXCIw1zgDuJWfCgMUyE",
  authDomain: "data-undangan-digital-9dc5a.firebaseapp.com",
  projectId: "data-undangan-digital-9dc5a",
  storageBucket: "data-undangan-digital-9dc5a.firebasestorage.app",
  messagingSenderId: "765763173060",
  appId: "1:765763173060:web:043f3f4f5d3de0e30ae791"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let userData = null;
let pkkmData = [];
let allUsers = [];
let currentIndikatorId = null;

// 🆕 VARIABEL TAHUN AJARAN AKTIF (Default)
let currentTahun = '2026/2027';

// ═════════════════════════════════════════════
// 1. INIT & AUTH STATE
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadSavedPeriode();
    loadPKKMData();
    
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').where('email', '==', user.email).get().then(snapshot => {
                let dbData = {};
                let docId = null;
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    dbData = doc.data();
                    docId = doc.id;
                }
                userData = {
                    uid: user.uid, email: user.email,
                    nama: dbData.nama || user.email.split('@')[0],
                    role: dbData.role || 'guru', docId: docId
                };
                updateUIForLoggedInUser();
                renderDashboard();
                if (userData.role === 'admin' || userData.role === 'kepala') loadAdminData();
            }).catch(err => {
                console.error('Error:', err);
                userData = { uid: user.uid, email: user.email, nama: user.email.split('@')[0], role: 'guru' };
                updateUIForLoggedInUser();
                renderDashboard();
            });
        } else {
            userData = null;
            updateUIForGuest();
            renderDashboard();
        }
    });
});

// ═════════════════════════════════════════════
// 2. TAB & PERIODE NAVIGATION
// ═════════════════════════════════════════════
window.switchMainTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => { tab.style.display = 'none'; tab.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const selectedTab = document.getElementById(`tab-${tabName}`);
    const selectedBtn = document.getElementById(`tabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (selectedTab) { selectedTab.style.display = 'block'; selectedTab.classList.add('active'); }
    if (selectedBtn) selectedBtn.classList.add('active');
};

window.gantiPeriode = function() {
    const tahunSelect = document.getElementById('filterTahun');
    const badge = document.getElementById('periodeBadge');
    if (tahunSelect) {
        currentTahun = tahunSelect.value;
        if (badge) badge.innerHTML = `📅 ${currentTahun}`;
        localStorage.setItem('pkkm_tahun', currentTahun);
        loadPKKMData();
    }
};

function loadSavedPeriode() {
    const saved = localStorage.getItem('pkkm_tahun');
    if (saved) {
        currentTahun = saved;
        const tahunSelect = document.getElementById('filterTahun');
        const badge = document.getElementById('periodeBadge');
        if (tahunSelect) tahunSelect.value = currentTahun;
        if (badge) badge.innerHTML = `📅 ${currentTahun}`;
    }
}

// ══════════════════════════════════════════════
// 3. LOAD DATA & RENDER DASHBOARD
// ══════════════════════════════════════════════
async function loadPKKMData() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').get();
        
        const uploadsSnapshot = await db.collection('pkkm_uploads')
            .where('tahun_ajaran', '==', currentTahun)
            .get();

        const uploadsMap = {};
        uploadsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!uploadsMap[data.indikator_id]) uploadsMap[data.indikator_id] = [];
            uploadsMap[data.indikator_id].push({ id: doc.id, ...data });
        });

        pkkmData = [];
        let total = 0, selesai = 0;

        aspekSnapshot.forEach(aspekDoc => {
            const aspek = { id: aspekDoc.id, ...aspekDoc.data(), indikator: [] };
            indikatorSnapshot.forEach(indDoc => {
                const ind = indDoc.data();
                if (ind.aspek_id === aspek.id) {
                    total++;
                    const uploads = uploadsMap[indDoc.id] || [];
                    if (uploads.length > 0) selesai++;
                    aspek.indikator.push({ id: indDoc.id, ...ind, uploads: uploads });
                }
            });
            pkkmData.push(aspek);
        });

        const statTotalEl = document.getElementById('statTotal');
        const statSelesaiEl = document.getElementById('statSelesai');
        const statBelumEl = document.getElementById('statBelum');
        if (statTotalEl) statTotalEl.textContent = total;
        if (statSelesaiEl) statSelesaiEl.textContent = selesai;
        if (statBelumEl) statBelumEl.textContent = total - selesai;
        
        const loadingData = document.getElementById('loadingData');
        if (loadingData) loadingData.style.display = 'none';
        
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// ═════════════════════════════════════════════
// FUNGSI PREVIEW PDF YANG DIPERBAIKI
// ═════════════════════════════════════════════
window.previewFile = function(uploadData) {
    if (!uploadData) return;
    
    // Jika link Google Drive
    if (uploadData.file_type === 'link' && uploadData.file_drive_link) {
        window.open(uploadData.file_drive_link, '_blank');
        return;
    }
    
    // Jika file base64
    if (uploadData.file_base64) {
        try {
            // Buat blob dari base64
            const byteCharacters = atob(uploadData.file_base64.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            // Buat URL dari blob
            const blobUrl = URL.createObjectURL(blob);
            
            // Buka di tab baru
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Preview: ${uploadData.file_name || 'Dokumen'}</title>
                        <style>
                            body { margin: 0; padding: 0; }
                            iframe { width: 100%; height: 100vh; border: none; }
                        </style>
                    </head>
                    <body>
                        <iframe src="${blobUrl}" type="application/pdf"></iframe>
                    </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                // Fallback: download file
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = uploadData.file_name || 'dokumen.pdf';
                link.click();
                URL.revokeObjectURL(blobUrl);
            }
        } catch (error) {
            console.error('Error previewing file:', error);
            alert('❌ Gagal membuka preview. Silakan download file.');
        }
    }
};

function renderDashboard() {
    const container = document.getElementById('aspekContainer');
    if (!container) return;
    if (pkkmData.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><p>Belum ada data. Login sebagai admin dan jalankan "Setup Data Awal".</p></div>';
        return;
    }
    
    container.innerHTML = pkkmData.map(aspek => {
        const aspekSelesai = aspek.indikator.filter(ind => ind.uploads.length > 0).length;
        const aspekTotal = aspek.indikator.length;
        const progress = aspekTotal > 0 ? Math.round((aspekSelesai / aspekTotal) * 100) : 0;

        return `
            <div class="aspek-item" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="aspek-title" style="font-weight: 700; color: #0e7490;"><i class="fas fa-folder-open"></i> Dimensi ${aspek.kode}: ${aspek.nama}</div>
                    <span class="badge" style="background: ${progress === 100 ? '#dcfce7' : progress > 0 ? '#fef3c7' : '#fee2e2'}; color: ${progress === 100 ? '#166534' : progress > 0 ? '#92400e' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">${progress}%</span>
                </div>
                <div style="background: #e2e8f0; height: 6px; border-radius: 3px; margin-bottom: 16px; overflow: hidden;">
                    <div style="background: ${progress === 100 ? '#10b981' : '#0891b2'}; height: 100%; width: ${progress}%;"></div>
                </div>
                <div class="indikator-list">
                    ${aspek.indikator.map(ind => {
                        const hasUpload = ind.uploads.length > 0;
                        const lastUpload = hasUpload ? ind.uploads[ind.uploads.length - 1] : null;
                        const isAssigned = userData && ind.penugasan && ind.penugasan.some(p => p.toLowerCase().includes(userData.nama.toLowerCase().split(',')[0]));
                        const isMyUpload = lastUpload && lastUpload.guru_uid === userData?.uid;

                        return `
                            <div class="indikator-item" style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; font-size: 0.95rem; color: #0f172a;">${ind.kode} - ${ind.pertanyaan}</div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin: 4px 0;"><strong>Penanggung Jawab:</strong> ${ind.penugasan ? ind.penugasan.join(', ') : '-'}</div>
                                    ${hasUpload ? `
                                        <div style="margin-top: 8px; padding: 8px; background: #f0fdf4; border-radius: 4px; font-size: 0.85rem;">
                                            <i class="fas fa-check-circle" style="color: #10b981;"></i> 
                                            <strong>${lastUpload.file_name}</strong> 
                                            <span style="color: #64748b;">- diupload oleh ${lastUpload.guru_nama}</span>
                                            ${lastUpload.file_type === 'link' ? 
                                                `<a href="${lastUpload.file_drive_link}" target="_blank" style="color: #0891b2; margin-left: 8px; font-weight: 600; text-decoration: none;"><i class="fas fa-external-link-alt"></i> Buka Link</a>` : 
                                                `<a href="${lastUpload.file_base64}" download="${lastUpload.file_name}" target="_blank" style="color: #0891b2; margin-left: 8px; font-weight: 600; text-decoration: none;"><i class="fas fa-download"></i> Download</a>`
                                            }
                                        </div>` : `<div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;"><i class="fas fa-clock"></i> Belum ada dokumen</div>`}
                                </div>
                                <div style="flex-shrink: 0; margin-left: 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                                    ${hasUpload ? `
                                        <button onclick='previewFile(${JSON.stringify(lastUpload)})' style="background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100px;">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                        <button onclick='previewFile(${JSON.stringify(lastUpload)})' style="background: #6366f1; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100px;">
                                            <i class="fas fa-eye"></i> Preview
                                        </button>
                                    ` : ''}
                                    
                                    ${userData ? (isAssigned ? 
                                        `<button class="btn" style="background: #0891b2; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100%;" onclick="openUploadModal('${ind.id}', '${ind.kode}', '${ind.pertanyaan.replace(/'/g, "\\'")}', '${ind.bukti_diharapkan.join(', ').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-${hasUpload && isMyUpload ? 'sync-alt' : 'upload'}"></i> ${hasUpload && isMyUpload ? 'Ganti' : 'Upload'}
                                        </button>` : 
                                        `<button class="btn" disabled style="background: #e2e8f0; color: #94a3b8; cursor: not-allowed; padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.85rem; width: 100%;"><i class="fas fa-lock"></i> Bukan Tugas Anda</button>`
                                    ) : `
                                        <button class="btn" disabled style="background: #f1f5f9; color: #94a3b8; cursor: not-allowed; padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.85rem; width: 100%;"><i class="fas fa-eye"></i> View Only</button>
                                    `}
                                    
                                    ${hasUpload ? `
                                        <button class="btn" style="background: #ef4444; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100%;" onclick="deleteUpload('${lastUpload.id}')">
                                            <i class="fas fa-trash"></i> Hapus
                                        </button>
                                    ` : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');
}

// ══════════════════════════════════════════════
// 4. UI STATE
// ══════════════════════════════════════════════
function updateUIForGuest() {
    document.getElementById('guestBadge').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('btnLogin').style.display = 'inline-block';
    document.getElementById('btnLogout').style.display = 'none';
    document.getElementById('mainNavTabs').style.display = 'none';
    document.getElementById('tabBtnAdmin').style.display = 'none';
    document.getElementById('tab-admin').style.display = 'none';
    document.getElementById('tab-dashboard').style.display = 'block';
}

function updateUIForLoggedInUser() {
    document.getElementById('guestBadge').style.display = 'none';
    document.getElementById('userInfo').style.display = 'block';
    document.getElementById('userName').textContent = userData.nama;
    document.getElementById('userRole').textContent = userData.role.toUpperCase();
    document.getElementById('btnLogin').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'inline-block';
    document.getElementById('mainNavTabs').style.display = 'flex';
    document.getElementById('tabBtnAdmin').style.display = (userData.role === 'admin' || userData.role === 'kepala') ? 'inline-block' : 'none';
    switchMainTab('dashboard');
}

// ══════════════════════════════════════════════
// 5. LOGIN / LOGOUT
// ══════════════════════════════════════════════
window.openLoginModal = () => document.getElementById('loginModal').classList.add('active');
window.closeLoginModal = () => {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginError').style.display = 'none';
};
window.doLogin = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeLoginModal();
    } catch (error) {
        document.getElementById('loginError').textContent = '❌ ' + error.message;
        document.getElementById('loginError').style.display = 'block';
    }
};
window.logout = () => auth.signOut();
window.closeModal = () => document.getElementById('uploadModal').classList.remove('active');

// ══════════════════════════════════════════════
// 6. UPLOAD LOGIC (FILE BASE64 atau GOOGLE DRIVE LINK)
// ══════════════════════════════════════════════
let uploadMode = 'file';

window.switchUploadMode = function(mode) {
    uploadMode = mode;
    const btnFile = document.getElementById('btnModeFile');
    const btnLink = document.getElementById('btnModeLink');
    const divFile = document.getElementById('uploadModeFile');
    const divLink = document.getElementById('uploadModeLink');
    
    if (mode === 'file') {
        btnFile.style.background = '#0891b2'; btnFile.style.color = 'white';
        btnLink.style.background = '#e2e8f0'; btnLink.style.color = '#475569';
        divFile.style.display = 'block';
        divLink.style.display = 'none';
    } else {
        btnLink.style.background = '#0891b2'; btnLink.style.color = 'white';
        btnFile.style.background = '#e2e8f0'; btnFile.style.color = '#475569';
        divFile.style.display = 'none';
        divLink.style.display = 'block';
    }
};

window.openUploadModal = (indId, kode, pertanyaan, bukti) => {
    if (!userData) { alert('Silakan login terlebih dahulu!'); return; }
    currentIndikatorId = indId;
    
    document.getElementById('modalIndikatorTitle').textContent = `${kode} - ${pertanyaan}`;
    document.getElementById('modalBuktiTitle').textContent = `Bukti: ${bukti}`;
    document.getElementById('fileNameDisplay').textContent = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('driveLinkInput').value = '';
    
    switchUploadMode('file');
    document.getElementById('uploadModal').classList.add('active');
};

window.handleFileSelectPreview = function(event) {
    const file = event.target.files[0];
    const display = document.getElementById('fileNameDisplay');
    if (file) {
        const sizeKB = (file.size / 1024).toFixed(1);
        display.innerHTML = `<i class="fas fa-file"></i> ${file.name} <span style="color: #64748b; font-size: 0.85rem;">(${sizeKB} KB)</span>`;
        
        if (file.size > 500 * 1024) {
            display.innerHTML += `<br><span style="color: #ef4444; font-size: 0.8rem;">⚠️ Melebihi 500KB. Silakan gunakan tab "Link Google Drive" atau kompres file.</span>`;
        }
    }
};

window.submitUpload = async function() {
    if (uploadMode === 'link') {
        const link = document.getElementById('driveLinkInput').value.trim();
        if (!link) {
            alert('️ Harap masukkan link Google Drive!');
            return;
        }
        if (!link.includes('drive.google.com')) {
            alert('️ Link tidak valid. Pastikan link berasal dari Google Drive!');
            return;
        }
        
        const data = {
            indikator_id: currentIndikatorId,
            guru_uid: userData.uid,
            guru_nama: userData.nama,
            file_name: 'Dokumen Google Drive',
            file_drive_link: link,
            file_type: 'link',
            tahun_ajaran: currentTahun,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await saveToFirestore(data);
        
    } else {
        const file = document.getElementById('fileInput').files[0];
        if (!file) {
            alert('⚠️ Harap pilih file terlebih dahulu!');
            return;
        }
        if (file.size > 500 * 1024) {
            alert(`⚠️ Ukuran file terlalu besar! Maksimal: 500 KB.\nUkuran file Anda: ${(file.size / 1024).toFixed(1)} KB.\nSilakan gunakan opsi "Link Google Drive" atau kompres file.`);
            return;
        }

        const display = document.getElementById('fileNameDisplay');
        display.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload...`;
        
        try {
            const base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });

            const data = {
                indikator_id: currentIndikatorId,
                guru_uid: userData.uid,
                guru_nama: userData.nama,
                file_name: file.name,
                file_base64: base64String,
                file_size: (file.size / 1024).toFixed(1) + ' KB',
                file_type: 'file',
                tahun_ajaran: currentTahun,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await saveToFirestore(data);
        } catch (error) {
            alert("❌ Gagal upload: " + error.message);
            display.textContent = '';
        }
    }
};

async function saveToFirestore(data) {
    const display = document.getElementById('fileNameDisplay');
    if (display && uploadMode === 'file') display.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menyimpan ke database...`;
    
    try {
        const existing = await db.collection('pkkm_uploads')
            .where('indikator_id', '==', currentIndikatorId)
            .where('guru_uid', '==', userData.uid)
            .where('tahun_ajaran', '==', currentTahun)
            .get();

        if (!existing.empty) {
            await existing.docs[0].ref.update(data);
        } else {
            data.uploaded_at = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('pkkm_uploads').add(data);
        }

        alert(`✅ Berhasil disimpan untuk Tahun Ajaran ${currentTahun}!`);
        closeModal();
        loadPKKMData();
    } catch (error) {
        alert("❌ Gagal menyimpan: " + error.message);
        if (display) display.textContent = '';
    }
}

window.deleteUpload = async function(uploadId) {
    if (!userData) { alert('Silakan login terlebih dahulu!'); return; }
    if (!confirm('⚠️ Yakin ingin menghapus bukti ini?')) return;
    try {
        await db.collection('pkkm_uploads').doc(uploadId).delete();
        alert('✅ File berhasil dihapus!');
        loadPKKMData();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};

// ═════════════════════════════════════════════
// 7. ADMIN FUNCTIONS
// ══════════════════════════════════════════════
function checkAdminAccess() {
    if (!userData || (userData.role !== 'admin' && userData.role !== 'kepala')) {
        alert(' Akses ditolak! Hanya Admin/Kepala Madrasah.');
        return false;
    }
    return true;
}

async function loadAdminData() {
    const usersSnapshot = await db.collection('users').get();
    allUsers = [];
    usersSnapshot.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
    allUsers.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    renderAdminUsersTable();
    renderAdminAssignments();
}

function renderAdminUsersTable() {
    const tbody = document.getElementById('adminUsersTable');
    if (!tbody) return;
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #64748b;">Belum ada user</td></tr>';
        return;
    }
    tbody.innerHTML = allUsers.map(user => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.nama || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.email || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                ${user.password ? `<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; font-family: monospace;">${user.password}</span>` : `<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Belum diset</span>`}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><span style="background: ${user.role === 'admin' ? '#ef4444' : user.role === 'kepala' ? '#0891b2' : '#10b981'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${(user.role || 'guru').toUpperCase()}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 4px;">
                ${!user.password ? `<button onclick="setPassword('${user.uid}', '${user.email}')" class="btn btn-warning" style="background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;"><i class="fas fa-key"></i></button>` : ''}
                <button onclick="deleteUser('${user.uid}')" class="btn btn-danger" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

window.setPassword = async function(userId, email) {
    const newPassword = prompt(`Password baru untuk ${email} (Min. 6 karakter):`);
    if (!newPassword || newPassword.length < 6) { alert('❌ Minimal 6 karakter!'); return; }
    if (!confirm(`Set password "${newPassword}" untuk ${email}?`)) return;
    try {
        await db.collection('users').doc(userId).update({ password: newPassword });
        alert(`✅ Password berhasil diset: ${newPassword}`);
        loadAdminData();
    } catch (error) { alert('❌ Gagal: ' + error.message); }
};

window.exportUsersToExcel = function() {
    if (allUsers.length === 0) return alert('Tidak ada data!');
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;width:100%}th{background:#0891b2;color:#fff;padding:12px;border:1px solid #ddd;text-align:left}td{padding:10px;border:1px solid #ddd}tr:nth-child(even){background:#f9fafb}.pwd{background:#fef3c7;color:#d97706;font-weight:bold;padding:4px 8px;border-radius:4px;text-align:center;font-family:monospace}.role{font-weight:bold;padding:4px 8px;border-radius:4px;text-align:center}</style></head><body><table><thead><tr><th>No</th><th>Nama</th><th>Email</th><th>Password</th><th>Role</th></tr></thead><tbody>`;
    allUsers.forEach((u, i) => {
        html += `<tr><td>${i+1}</td><td>${u.nama||''}</td><td>${u.email||''}</td><td class="pwd">${u.password||''}</td><td class="role" style="background:${u.role==='admin'?'#fee2e2;color:#dc2626':'#d1fae5;color:#059669'}">${(u.role||'guru').toUpperCase()}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `User_PKKM_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    alert(`✅ Berhasil mengunduh ${allUsers.length} user!`);
};

window.deleteUser = async function(userId) {
    if (!checkAdminAccess() || !confirm('Yakin hapus user ini?')) return;
    try { await db.collection('users').doc(userId).delete(); alert('✅ User dihapus.'); loadAdminData(); } 
    catch (error) { alert('❌ Gagal: ' + error.message); }
};

function renderAdminAssignments() {
    const filter = document.getElementById('filterDimensi').value;
    const container = document.getElementById('adminAssignmentList');
    if (!container) return;
    let filtered = [];
    pkkmData.forEach(aspek => { if (filter === 'all' || aspek.kode === filter) filtered.push(...aspek.indikator); });
    if (filtered.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#64748b;">Belum ada data.</p>'; return; }
    container.innerHTML = filtered.map(ind => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;background:white;">
            <div style="font-weight:700;color:#0e7490;margin-bottom:8px;">${ind.kode} - ${ind.pertanyaan}</div>
            <div style="margin-bottom:12px;"><strong style="font-size:0.9rem;">Pilih Penanggung Jawab:</strong>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:8px;">
                    ${allUsers.filter(u => u.role !== 'admin').map(user => `
                        <label style="display:flex;align-items:center;gap:8px;padding:8px;background:#f8fafc;border-radius:4px;cursor:pointer;">
                            <input type="checkbox" value="${user.nama}" ${ind.penugasan && ind.penugasan.includes(user.nama) ? 'checked' : ''}>
                            <span style="font-size:0.9rem;">${user.nama}</span>
                        </label>`).join('')}
                </div>
            </div>
            <button onclick="saveAssignment('${ind.id}', this)" class="btn btn-primary" style="background:#10b981;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-save"></i> Simpan Penugasan</button>
        </div>`).join('');
}

window.saveAssignment = async function(indikatorId, btn) {
    if (!checkAdminAccess()) return;
    const checkboxes = btn.closest('div').querySelectorAll('input[type="checkbox"]:checked');
    const penugasan = Array.from(checkboxes).map(cb => cb.value);
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
        await db.collection('pkkm_indikator').doc(indikatorId).update({ penugasan: penugasan, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert('✅ Penugasan disimpan!'); loadPKKMData();
    } catch (error) { alert('❌ Gagal: ' + error.message); } 
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penugasan'; }
};

// ══════════════════════════════════════════════
// 8. SETUP DATA AWAL (ADMIN ONLY)
// ══════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (!checkAdminAccess() || !confirm('⚠️ Isi database dengan 109 indikator PKKM lengkap?')) return;
    try {
        const aspekList = [
            { kode: 'A', nama: 'Usaha Pengembangan Madrasah' }, { kode: 'B', nama: 'Pelaksanaan Tugas Manajerial' },
            { kode: 'C', nama: 'Pengembangan Kewirausahaan' }, { kode: 'D', nama: 'Supervisi Kepada Guru dan Tenaga Kependidikan' },
            { kode: 'E', nama: 'Hasil Kinerja Kepala Madrasah' }
        ];
        for (const asp of aspekList) await db.collection('pkkm_aspek').doc(`aspek_${asp.kode}`).set(asp);
        
        const timA = ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'];
        const timB = ['Irmayani, S.Pd', 'Wahda Nursimi, S.Pd', 'Risnasari, S.Pd'];
        const timC = ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I'];
        const timD = ['Nursyam, S.Pd', 'Atika, S.Pd', 'Haerani, S.Pd.I'];
        const timE = ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd'];
        
        const indikatorList = [
            { aspek_id: 'aspek_A', kode: 'A.1.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.', bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat', 'Dokumen sosialisasi', 'Daftar hadir'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.2', pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.', bukti_diharapkan: ['Dokumen penetapan organisasi', 'Rincian tugas', 'Sertifikat', 'SOP Personalia'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.', bukti_diharapkan: ['Dokumen SOP madrasah', 'Pedoman SIM'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.1', pertanyaan: 'Mampu mengembangkan program baru untuk meningkatkan pencapaian target.', bukti_diharapkan: ['Visi misi', 'Data prestasi', 'Data UN 3 tahun', 'Data alumni', 'RKJM'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.2', pertanyaan: 'Mampu membangun tim kerja yang efektif.', bukti_diharapkan: ['Bagan struktur', 'SK', 'Tugas fungsi', 'Pedoman monev', 'Pedoman reward/punishment'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.3', pertanyaan: 'Mampu menerapkan teknik pembaharuan dalam pengelolaan pembelajaran.', bukti_diharapkan: ['Dokumen kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Peraturan akademik', 'Notulen evaluasi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.4', pertanyaan: 'Mampu mengembangkan potensi dan meningkatkan prestasi madrasah.', bukti_diharapkan: ['Data prestasi 1 tahun', 'Dokumen akreditasi', 'Program ekstrakurikuler', 'Program unggulan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.1', pertanyaan: 'Merencanakan kerjasama dengan lembaga pemerintah, swasta dan masyarakat.', bukti_diharapkan: ['SK komite', 'AD/ART', 'Proker komite', 'MoU', 'Foto/Sertifikat'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.2', pertanyaan: 'Melakukan pendekatan untuk mendapatkan dukungan dari lembaga.', bukti_diharapkan: ['Program kegiatan kerjasama', 'Foto', 'Jadwal', 'Laporan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.3', pertanyaan: 'Memanfaatkan dan memelihara hubungan kerjasama.', bukti_diharapkan: ['Laporan kegiatan', 'Laporan monev', 'Dokumentasi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.1', pertanyaan: 'Mengaplikasikan pengembangan kurikulum sesuai standar isi.', bukti_diharapkan: ['Kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Buku kerja guru', 'Dokumen rapat'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.2', pertanyaan: 'Mengaplikasikan pengembangan proses pembelajaran sesuai standar proses.', bukti_diharapkan: ['Silabus', 'RPP', 'Struktur Kurikulum', 'Jadwal mengajar', 'Jurnal mengajar', 'Dokumen supervisi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.3', pertanyaan: 'Mengaplikasikan sistem penilaian pembelajaran sesuai standar penilaian.', bukti_diharapkan: ['Instrumen penilaian', 'Kisi-kisi', 'Naskah soal', 'Analisis butir soal', 'Laporan hasil belajar', 'Dokumen PAS/PAT'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.4', pertanyaan: 'Melaksanakan penjaminan mutu pencapaian standar kompetensi lulusan.', bukti_diharapkan: ['Program kegiatan kesiswaan', 'Laporan pembiasaan', 'Dokumen literasi', 'Data hasil ujian 2 tahun'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.1', pertanyaan: 'Mampu mengelola laboratorium madrasah secara optimal.', bukti_diharapkan: ['Luas sesuai standar', 'Sarana pendukung', 'Program kerja lab', 'Jurnal pengelolaan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah.', bukti_diharapkan: ['Luas sesuai standar', 'Daftar buku induk', 'Laporan pengelolaan', 'Program kerja'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.3', pertanyaan: 'Mampu mengelola usaha madrasah.', bukti_diharapkan: ['Laporan kegiatan usaha', 'Dokumentasi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.4', pertanyaan: 'Mampu mengelola koperasi madrasah.', bukti_diharapkan: ['Instrumen hasil praktik', 'AD/ART koperasi', 'Laporan RAT'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.1', pertanyaan: 'Memanfaatkan TIK dalam manajemen madrasah.', bukti_diharapkan: ['Fasilitas TIK', 'Website madrasah', 'Pedoman SIM'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.2', pertanyaan: 'Memanfaatkan TIK dalam pembelajaran.', bukti_diharapkan: ['Komputer', 'Internet', 'Website', 'Email', 'Pemanfaatan TIK'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.3', pertanyaan: 'Memanfaatkan TIK dalam menjalin kerjasama.', bukti_diharapkan: ['Pengelola SIM', 'Surat tugas', 'Pelaporan data', 'Program promosi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.4', pertanyaan: 'Memanfaatkan TIK dalam promosi program madrasah.', bukti_diharapkan: ['Pengelola SIM', 'Pelaporan data', 'Program informasi'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.1', pertanyaan: 'Mampu mengembangkan sistem administrasi pengelolaan dengan TIK.', bukti_diharapkan: ['Komputer/LCD', 'Internet', 'Web sekolah', 'Email', 'Laporan absensi elektronik'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.2', pertanyaan: 'Mengelola administrasi pembelajaran dengan TIK.', bukti_diharapkan: ['Komputer/LCD', 'Internet', 'Pemanfaatan TIK pembelajaran', 'Penilaian online'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.3', pertanyaan: 'Mampu mengembangkan sistem pengelolaan perpustakaan dengan TIK.', bukti_diharapkan: ['Katalog', 'BSE', 'Internet', 'Komputer', 'Aplikasi perpustakaan'], penugasan: timA },
            { aspek_id: 'aspek_B', kode: 'B.2.1.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM berdasarkan evaluasi 8 SNP.', bukti_diharapkan: ['Dokumen EDM', 'Dokumen RKJM dan RKT'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.2', pertanyaan: 'Mampu merumuskan visi-misi sebagai arah pengembangan.', bukti_diharapkan: ['Visi misi yang ditetapkan', 'Berita acara perumusan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.3', pertanyaan: 'Mampu menentukan strategi pencapaian tujuan madrasah.', bukti_diharapkan: ['Program kerja', 'RKJM dan RKTM'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.4', pertanyaan: 'Mampu menyusun program dengan rencana evaluasi.', bukti_diharapkan: ['RKJM dan RKTM', 'Rencana monev'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.1', pertanyaan: 'Mampu memberi contoh berdisiplin.', bukti_diharapkan: ['Daftar hadir elektronik kamad', 'Daftar hadir kegiatan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.2', pertanyaan: 'Mampu melaksanakan peraturan sesuai ketentuan.', bukti_diharapkan: ['Wawancara warga', 'Laporan kehadiran', 'Notulen rapat'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.3', pertanyaan: 'Mampu menunjukkan keteladanan memanfaatkan sumber daya.', bukti_diharapkan: ['Wawancara warga', 'Dokumen monev pemanfaatan sumber belajar'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.4', pertanyaan: 'Mampu menunjukkan kedisiplinan sebagai insan pembelajar.', bukti_diharapkan: ['Koleksi buku', 'Karya tulis', 'Majalah/koran', 'Website', 'Blog'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.1', pertanyaan: 'Mampu menjadi contoh berbudaya mutu yang kompetitif.', bukti_diharapkan: ['Peningkatan KKM', 'Hasil UN', 'Program keunggulan', 'Data prestasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.2', pertanyaan: 'Mampu melengkapi sarana prasarana untuk suasana belajar kondusif.', bukti_diharapkan: ['Observasi lingkungan madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.3', pertanyaan: 'Mampu memfasilitasi kegiatan budaya baca dan tulis.', bukti_diharapkan: ['Laporan literasi', 'Dokumen budaya baca', 'Data kunjungan perpustakaan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.4', pertanyaan: 'Mampu memfasilitasi kegiatan lomba akademik dan nonakademik.', bukti_diharapkan: ['Dokumen kompetisi', 'Daftar piagam/piala'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.1', pertanyaan: 'Mampu menyusun perencanaan pengembangan pendidik dan tendik.', bukti_diharapkan: ['Proker kamad', 'Laporan workshop/pelatihan', 'Dokumentasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.2', pertanyaan: 'Mampu melakukan pembinaan berkala untuk meningkatkan mutu SDM.', bukti_diharapkan: ['Catatan pembinaan', 'Notulen rapat', 'Laporan kinerja'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.3', pertanyaan: 'Memfasilitasi guru dan staf untuk meningkatkan kompetensi.', bukti_diharapkan: ['Catatan pembinaan', 'Notulen rapat', 'Laporan kinerja'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.4', pertanyaan: 'Memantau penerapan hasil pelatihan dalam pekerjaan.', bukti_diharapkan: ['Program pelatihan', 'Laporan pelaksanaan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.1', pertanyaan: 'Mampu mengelola fasilitas prasarana, perabot dan sarana.', bukti_diharapkan: ['Buku Inventaris', 'Buku pemeliharaan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah.', bukti_diharapkan: ['Buku induk', 'Buku data grafik layanan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.3', pertanyaan: 'Mampu mengelola laboratorium madrasah.', bukti_diharapkan: ['Daftar inventaris', 'Jurnal layanan lab'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.4', pertanyaan: 'Mampu mengelola fasilitas penunjang madrasah lainnya.', bukti_diharapkan: ['Data fasilitas penunjang'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.1', pertanyaan: 'Menyusun perencanaan penerimaan dan pengembangan kompetensi peserta didik.', bukti_diharapkan: ['Proker PPDB', 'Brosur', 'Data analisis kemampuan', 'Psikotes'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.2', pertanyaan: 'Memiliki program pengembangan potensi diri dan prestasi.', bukti_diharapkan: ['Program pengembangan diri', 'Laporan pengembangan diri'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.3', pertanyaan: 'Memfasilitasi kegiatan pembiasaan melalui penanaman nilai-nilai.', bukti_diharapkan: ['Program kegiatan', 'Laporan pembiasaan', 'Dokumentasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.4', pertanyaan: 'Memfasilitasi kegiatan pengembangan diri bagi peserta didik, pendidik, tendik.', bukti_diharapkan: ['Program kegiatan', 'Dokumen kegiatan', 'Data prestasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.1', pertanyaan: 'Mampu mengarahkan pengembangan KTSP dalam IHT, Workshop, MGMP.', bukti_diharapkan: ['Dokumen kurikulum', 'SK tim', 'Notulen', 'Laporan workshop'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.2', pertanyaan: 'Mampu mengendalikan pelaksanaan KTSP berlandaskan kalender pendidikan.', bukti_diharapkan: ['Struktur kurikulum', 'Jadwal pelajaran', 'Peraturan akademik', 'SK pembagian tugas'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.3', pertanyaan: 'Memfasilitasi efektivitas tim kerja guru.', bukti_diharapkan: ['Program KKG/MGMP', 'Laporan', 'Dokumentasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.4', pertanyaan: 'Mampu mengembangkan pelayanan belajar yang inovatif.', bukti_diharapkan: ['Observasi kelas', 'Ragam metode di RPP'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.5', pertanyaan: 'Memfasilitasi peserta didik dalam kolaborasi dan kompetisi.', bukti_diharapkan: ['Laporan kegiatan kesiswaan', 'Data prestasi', 'Dokumentasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.1', pertanyaan: 'Mampu merencanakan kebutuhan keuangan madrasah.', bukti_diharapkan: ['RKJM dan RKTM', 'Rencana anggaran', 'Laporan keuangan', 'Buku kas'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.2', pertanyaan: 'Mampu mengupayakan sumber-sumber keuangan dari luar.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.3', pertanyaan: 'Mampu mengkoordinasikan pengelolaan keuangan sesuai peraturan.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.4', pertanyaan: 'Mampu membuat laporan dan evaluasi pengelolaan keuangan.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan', 'Buku kas'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.1', pertanyaan: 'Mampu mengelola administrasi surat masuk dan keluar.', bukti_diharapkan: ['Dokumen surat masuk dan keluar'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.2', pertanyaan: 'Mampu mengelola administrasi madrasah.', bukti_diharapkan: ['Studi dokumen administrasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.3', pertanyaan: 'Mampu mengelola administrasi kearsipan.', bukti_diharapkan: ['Arsip administrasi', 'SOP'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.4', pertanyaan: 'Mampu mengelola administrasi akreditasi.', bukti_diharapkan: ['Dokumen pemenuhan SNP'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.1', pertanyaan: 'Menyusun standar kinerja program pendidikan.', bukti_diharapkan: ['Dokumen SKP'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.2', pertanyaan: 'Melakukan monitoring dan evaluasi kinerja.', bukti_diharapkan: ['Dokumen monev'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.3', pertanyaan: 'Menyusun laporan sesuai standar pelaporan monev.', bukti_diharapkan: ['Laporan monev'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.4', pertanyaan: 'Merumuskan program tindak lanjut berdasarkan hasil evaluasi.', bukti_diharapkan: ['Laporan monev'], penugasan: timB },
            { aspek_id: 'aspek_C', kode: 'C.3.1.1', pertanyaan: 'Memahami dan menghayati arti perubahan (inovasi) madrasah.', bukti_diharapkan: ['Program kewirausahaan', 'Profil madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.2', pertanyaan: 'Menggunakan metode, teknik dan proses perubahan.', bukti_diharapkan: ['Observasi pemanfaatan inovasi'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.3', pertanyaan: 'Menumbuhkan iklim kebebasan berpikir untuk inovasi.', bukti_diharapkan: ['Data usaha produktif', 'Program pengelolaan hasil usaha'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.4', pertanyaan: 'Mendorong warga madrasah melakukan prakarsa.', bukti_diharapkan: ['Data usaha produktif', 'Program pengelolaan hasil usaha'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.1', pertanyaan: 'Mampu bertindak kreatif dan inovatif.', bukti_diharapkan: ['RPP kreatif', 'Hasil karya siswa', 'Foto aktivitas'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.2', pertanyaan: 'Mampu memberdayakan potensi madrasah secara optimal.', bukti_diharapkan: ['RPM', 'Dokumen penanganan kasus', 'Dokumen hasil kegiatan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.3', pertanyaan: 'Mampu menumbuhkan jiwa kewirausahaan.', bukti_diharapkan: ['RPM', 'Dokumen penanganan kasus'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.4', pertanyaan: 'Mampu mencatat ide-ide baru.', bukti_diharapkan: ['Rencana Pengembangan Madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.1', pertanyaan: 'Bersedia belajar dari orang lain.', bukti_diharapkan: ['Forum komunikasi', 'Komunitas kegiatan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.2', pertanyaan: 'Ingin selalu melakukan yang terbaik.', bukti_diharapkan: ['Dokumen/foto kegiatan', 'Keikutsertaan lomba'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.3', pertanyaan: 'Menciptakan perubahan yang kuat.', bukti_diharapkan: ['Program inovasi/RPM', 'Laporan target'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.1', pertanyaan: 'Mampu melibatkan tokoh agama, masyarakat, pemerintah.', bukti_diharapkan: ['MoU', 'Sister school'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.2', pertanyaan: 'Mampu bersikap obyektif dalam mengatasi konflik.', bukti_diharapkan: ['Observasi, wawancara, dokumen'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.3', pertanyaan: 'Mampu bersikap simpatik/tenggang rasa.', bukti_diharapkan: ['Observasi, wawancara, dokumen'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.1', pertanyaan: 'Mampu merencanakan kegiatan produksi/jasa.', bukti_diharapkan: ['Laporan program unit produksi'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.2', pertanyaan: 'Mampu membina kegiatan produksi/jasa.', bukti_diharapkan: ['Laporan Program Pengembangan Unit Produksi'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.3', pertanyaan: 'Mampu melaksanakan pengawasan kegiatan produksi/jasa.', bukti_diharapkan: ['Laporan Evaluasi Kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.4', pertanyaan: 'Mampu mengembangkan kegiatan produksi/jasa dan pemasarannya.', bukti_diharapkan: ['Laporan Evaluasi Kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_D', kode: 'D.4.1.1', pertanyaan: 'Mengidentifikasi masalah guru dalam pembelajaran.', bukti_diharapkan: ['Program supervisi', 'Jadwal', 'SK tim'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.2', pertanyaan: 'Mampu merumuskan tujuan supervisi.', bukti_diharapkan: ['Program supervisi', 'Laporan hasil'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.3', pertanyaan: 'Mampu mengembangkan instrumen supervisi.', bukti_diharapkan: ['Instrumen supervisi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.1', pertanyaan: 'Mengadakan pertemuan awal supervisi.', bukti_diharapkan: ['Program', 'Jadwal', 'Daftar hadir/foto'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.2', pertanyaan: 'Melaksanakan pemantauan pembelajaran.', bukti_diharapkan: ['Instrumen', 'Laporan', 'Catatan rekomendasi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.3', pertanyaan: 'Melakukan pertemuan refleksi.', bukti_diharapkan: ['Analisis hasil', 'Catatan rekomendasi', 'Foto'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.4', pertanyaan: 'Menyusun rekomendasi tindaklanjut perbaikan.', bukti_diharapkan: ['Dokumen tindak lanjut', 'Program workshop', 'Analisis butir soal'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.1', pertanyaan: 'Memfasilitasi guru merencanakan tindak lanjut.', bukti_diharapkan: ['Dokumen tindak lanjut', 'Hasil workshop'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.2', pertanyaan: 'Mengecek ulang keterlaksanaan rekomendasi.', bukti_diharapkan: ['Dokumen rekomendasi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.3', pertanyaan: 'Melaksanakan pembinaan guru sebagai tindak lanjut.', bukti_diharapkan: ['Laporan tindak lanjut', 'Program PKB', 'Foto'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.4', pertanyaan: 'Menggunakan data hasil supervisi untuk pemetaan.', bukti_diharapkan: ['Program PKB', 'Laporan pembinaan'], penugasan: timD },
            { aspek_id: 'aspek_E', kode: 'E.5.1.1', pertanyaan: 'Prestasi akademik peserta didik.', bukti_diharapkan: ['Piagam/sertifikat akademik'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.1.2', pertanyaan: 'Prestasi non akademik peserta didik.', bukti_diharapkan: ['Piagam/sertifikat nonakademik'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.1', pertanyaan: 'Prestasi akademik pendidik dan tendik.', bukti_diharapkan: ['Piagam/sertifikat GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.2', pertanyaan: 'Prestasi non akademik pendidik dan tendik.', bukti_diharapkan: ['Piagam/sertifikat GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.1', pertanyaan: 'Kelebihan prestasi akademik dari madrasah lain.', bukti_diharapkan: ['Dokumen peringkat'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.2', pertanyaan: 'Kelebihan prestasi non akademik dari madrasah lain.', bukti_diharapkan: ['Dokumen peringkat'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.3', pertanyaan: 'Kelebihan prestasi akademik dan non akademik GTK.', bukti_diharapkan: ['Dokumen peringkat GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.1', pertanyaan: 'Ijazah yang dimiliki kepala madrasah.', bukti_diharapkan: ['Fotokopi Ijazah terakhir'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.2', pertanyaan: 'Pendidikan dan pelatihan yang pernah diikuti.', bukti_diharapkan: ['Sertifikat Diklat minimal 3 buah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.3', pertanyaan: 'Penguasaan ICT kepala madrasah.', bukti_diharapkan: ['Sertifikat pelatihan Office/Internet'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.4', pertanyaan: 'Prestasi yang diraih oleh kepala madrasah.', bukti_diharapkan: ['Piagam/sertifikat kepala madrasah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.5', pertanyaan: 'Kegiatan penelitian kependidikan.', bukti_diharapkan: ['Laporan PTS/Karya Tulis Ilmiah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.6', pertanyaan: 'Kegiatan pelibatan komite.', bukti_diharapkan: ['Dokumentasi pelibatan komite'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.7', pertanyaan: 'Kegiatan kemitraan dengan stakeholder.', bukti_diharapkan: ['Dokumen kemitraan'], penugasan: timE }
        ];
        
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }
        alert(`✅ Setup Data Berhasil!\nTotal: 109 Indikator PKKM.\nSilakan refresh halaman.`);
        location.reload();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};