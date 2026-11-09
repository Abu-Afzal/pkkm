// PKKM Digital - MA. As'adiyah Ereng-Ereng
// Logika Penugasan Anti-Tembus (Strict Matching) - SUDAH DIPERBAIKI

const firebaseConfig = {
  // PENTING: Pastikan ini adalah config proyek PKKM Anda (pkkm-aser-281a4), 
  // bukan config undangan digital. Ganti jika perlu!
  apiKey: "AIzaSyDuAGy8Ku7Jh0is5WanEIf-A12AsVi2Kho", 
  authDomain: "pkkm-aser-281a4.firebaseapp.com",
  projectId: "pkkm-aser-281a4",
  storageBucket: "pkkm-aser-281a4.firebasestorage.app",
  messagingSenderId: "17368843878",
  appId: "1:17368843878:web:70babcedfbb0002f170fa7",
  measurementId: "G-0T4Z0B2MXP"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let userData = null;
let pkkmData = [];
let allUsers = [];
let currentSubBuktiId = null;
const currentTahun = '2026/2027'; 

// ═════════════════════════════════════════════
// 1. INIT & AUTH STATE
// ═════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
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
                userData = { uid: user.uid, email: user.email, nama: dbData.nama || user.email.split('@')[0], role: dbData.role || 'guru', docId: docId };
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

window.switchMainTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => { tab.style.display = 'none'; tab.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const selectedTab = document.getElementById(`tab-${tabName}`);
    const selectedBtn = document.getElementById(`tabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (selectedTab) { selectedTab.style.display = 'block'; selectedTab.classList.add('active'); }
    if (selectedBtn) selectedBtn.classList.add('active');
};

// ══════════════════════════════════════════════
// 2. LOAD DATA & RENDER DASHBOARD
// ══════════════════════════════════════════════
async function loadPKKMData() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').get();
        const uploadsSnapshot = await db.collection('pkkm_uploads').where('tahun_ajaran', '==', currentTahun).get();

        const uploadsMap = {};
        uploadsSnapshot.forEach(doc => {
            const data = doc.data();
            const key = data.sub_bukti_id || data.indikator_id;
            if (!uploadsMap[key]) uploadsMap[key] = [];
            uploadsMap[key].push({ id: doc.id, ...data });
        });

        pkkmData = [];
        let totalSubBukti = 0, selesaiSubBukti = 0;

        aspekSnapshot.forEach(aspekDoc => {
            const aspek = { id: aspekDoc.id, ...aspekDoc.data(), indikator: [] };
            indikatorSnapshot.forEach(indDoc => {
                const ind = indDoc.data();
                if (ind.aspek_id === aspek.id) {
                    const buktiList = ind.bukti_list || [];
                    const indikatorWithUploads = { 
                        id: indDoc.id, ...ind, 
                        bukti_uploads: buktiList.map(bukti => {
                            const uploads = uploadsMap[bukti.id] || [];
                            return { ...bukti, uploads: uploads };
                        })
                    };
                    buktiList.forEach(bukti => {
                        totalSubBukti++;
                        if ((uploadsMap[bukti.id] || []).length > 0) selesaiSubBukti++;
                    });
                    aspek.indikator.push(indikatorWithUploads);
                }
            });
            pkkmData.push(aspek);
        });

        const statTotalEl = document.getElementById('statTotal');
        const statSelesaiEl = document.getElementById('statSelesai');
        const statBelumEl = document.getElementById('statBelum');
        if (statTotalEl) statTotalEl.textContent = totalSubBukti;
        if (statSelesaiEl) statSelesaiEl.textContent = selesaiSubBukti;
        if (statBelumEl) statBelumEl.textContent = totalSubBukti - selesaiSubBukti;
        
        const loadingData = document.getElementById('loadingData');
        if (loadingData) loadingData.style.display = 'none';
        
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function renderDashboard() {
    const container = document.getElementById('aspekContainer');
    if (!container) return;
    if (pkkmData.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><p>Belum ada data. Login sebagai admin dan jalankan "Setup Data Awal".</p></div>';
        return;
    }
    
    container.innerHTML = pkkmData.map(aspek => {
        let aspekTotal = 0, aspekSelesai = 0;
        aspek.indikator.forEach(ind => {
            ind.bukti_uploads.forEach(b => {
                aspekTotal++;
                if (b.uploads.length > 0) aspekSelesai++;
            });
        });
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
                        
                        // ══════════════════════════════════════════════════════════
                        // LOGIKA PENUGASAN ANTI-TEMBUS (STRICT MATCHING)
                        // ══════════════════════════════════════════════════════════
                        const isAssigned = (() => {
                            if (!userData || !userData.nama || !ind.penugasan) return false;
                            
                            const cleanUser = userData.nama.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
                            const userWords = cleanUser.split(' ');
                            
                            return ind.penugasan.some(pName => {
                                const cleanP = pName.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
                                
                                if (cleanUser === cleanP) return true;
                                
                                if (cleanP.startsWith(cleanUser + ' ')) {
                                    if (userWords.length >= 2) {
                                        return true; 
                                    } else {
                                        const titles = ["s pd", "s hum", "m pd", "se", "s ag", "s kom", "s sos", "s pd i", "spdi", "st"];
                                        const remainder = cleanP.replace(cleanUser + ' ', '').trim();
                                        if (titles.includes(remainder)) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            });
                        })();
                        // ══════════════════════════════════════════════════════════

                        return `
                            <div class="indikator-item" style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
                                <div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 6px;">
                                    <i class="fas fa-bullseye" style="color: #0891b2;"></i> ${ind.kode} - ${ind.pertanyaan}
                                </div>
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 14px; padding-left: 24px;">
                                    <i class="fas fa-users"></i> <strong>Penanggung Jawab:</strong> ${ind.penugasan ? ind.penugasan.join(', ') : '-'}
                                </div>
                                <div style="border-top: 1px dashed #e2e8f0; padding-top: 12px;">
                                    <div style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 10px;">
                                        <i class="fas fa-list-check"></i> Bukti yang harus diupload:
                                    </div>
                                    ${ind.bukti_uploads.map((bukti, idx) => {
                                        const hasUpload = bukti.uploads.length > 0;
                                        const lastUpload = hasUpload ? bukti.uploads[bukti.uploads.length - 1] : null;
                                        const isMyUpload = lastUpload && lastUpload.guru_uid === userData?.uid;
                                        const borderColor = hasUpload ? '#10b981' : '#cbd5e1';
                                        const bgColor = hasUpload ? '#f0fdf4' : '#f8fafc';
                                        const iconHtml = hasUpload ? '<i class="fas fa-check-circle" style="color: #10b981;"></i>' : '<i class="fas fa-circle" style="color: #cbd5e1;"></i>';

                                        return `
                                            <div style="background: ${bgColor}; padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                                <div style="flex: 1; min-width: 0;">
                                                    <div style="font-size: 0.9rem; font-weight: 600; color: #0f172a;">
                                                        ${iconHtml} ${idx + 1}. ${bukti.nama}
                                                    </div>
                                                    ${hasUpload ? `
                                                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                                                            <i class="fas fa-file"></i> ${lastUpload.file_name} - diupload oleh ${lastUpload.guru_nama}
                                                        </div>
                                                    ` : '<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-clock"></i> Belum ada dokumen</div>'}
                                                </div>
                                                <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
                                                    ${hasUpload ? `
                                                        <button onclick='previewFile(${JSON.stringify(lastUpload).replace(/'/g, "\\'")})' style="background: #6366f1; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-eye"></i> Preview
                                                        </button>
                                                        <button onclick='downloadFile(${JSON.stringify(lastUpload).replace(/'/g, "\\'")})' style="background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-download"></i> Download
                                                        </button>
                                                    ` : ''}
                                                    ${userData ? (isAssigned ? `
                                                        <button onclick="openUploadModal('${ind.id}', '${ind.kode}', '${bukti.id}', '${bukti.nama.replace(/'/g, "\\'")}', '${ind.pertanyaan.replace(/'/g, "\\'")}')" style="background: #0891b2; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-${hasUpload && isMyUpload ? 'sync-alt' : 'upload'}"></i> ${hasUpload && isMyUpload ? 'Ganti' : 'Upload'}
                                                        </button>
                                                        ${hasUpload ? `
                                                            <button onclick="deleteUpload('${lastUpload.id}')" style="background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                                <i class="fas fa-trash"></i> Hapus
                                                            </button>
                                                        ` : ''}
                                                    ` : `
                                                        <button disabled style="background: #e2e8f0; color: #94a3b8; padding: 5px 10px; border-radius: 5px; border: none; font-size: 0.8rem; width: 90px; cursor: not-allowed;">
                                                            <i class="fas fa-lock"></i> Kunci
                                                        </button>
                                                    `}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ═════════════════════════════════════════════
// FUNGSI PREVIEW & DOWNLOAD
// ═════════════════════════════════════════════
window.previewFile = function(uploadData) {
    if (!uploadData) return;
    if (uploadData.file_type === 'link' && uploadData.file_drive_link) {
        window.open(uploadData.file_drive_link, '_blank');
        return;
    }
    if (uploadData.file_base64) {
        try {
            const byteCharacters = atob(uploadData.file_base64.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(`<!DOCTYPE html><html><head><title>Preview</title><style>body{margin:0;padding:0;}iframe{width:100%;height:100vh;border:none;}</style></head><body><iframe src="${blobUrl}" type="application/pdf"></iframe></body></html>`);
                newWindow.document.close();
            }
        } catch (error) {
            alert('❌ Gagal membuka preview.');
        }
    }
};

window.downloadFile = function(uploadData) {
    if (!uploadData) return;
    if (uploadData.file_type === 'link' && uploadData.file_drive_link) {
        window.open(uploadData.file_drive_link, '_blank');
        return;
    }
    if (uploadData.file_base64) {
        const link = document.createElement('a');
        link.href = uploadData.file_base64;
        link.download = uploadData.file_name || 'dokumen.pdf';
        link.click();
    }
};

// ══════════════════════════════════════════════
// 3. UI STATE & AUTH
// ══════════════════════════════════════════════
function updateUIForGuest() {
    document.getElementById('guestBadge').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('btnLogin').style.display = 'inline-block';
    document.getElementById('btnLogout').style.display = 'none';
    document.getElementById('mainNavTabs').style.display = 'none';
    document.getElementById('tabBtnAdmin').style.display = 'none';
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
// 4. UPLOAD LOGIC
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

window.openUploadModal = (indId, kode, subBuktiId, subBuktiNama, pertanyaan) => {
    if (!userData) { alert('Silakan login terlebih dahulu!'); return; }
    currentSubBuktiId = subBuktiId;
    document.getElementById('modalIndikatorTitle').textContent = `${kode} - ${pertanyaan}`;
    document.getElementById('modalBuktiTitle').textContent = `Bukti: ${subBuktiNama}`;
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
        if (file.size > 700 * 1024) {
            display.innerHTML += `<br><span style="color: #ef4444; font-size: 0.8rem;">⚠️ Melebihi 700KB. Gunakan tab "Link Google Drive" atau kompres file.</span>`;
        }
    }
};

window.submitUpload = async function() {
    if (uploadMode === 'link') {
        const link = document.getElementById('driveLinkInput').value.trim();
        if (!link) { alert('⚠️ Harap masukkan link Google Drive!'); return; }
        if (!link.includes('drive.google.com')) { alert('⚠️ Link tidak valid!'); return; }
        
        const data = {
            indikator_id: currentSubBuktiId.split('.').slice(0, 3).join('.'),
            sub_bukti_id: currentSubBuktiId,
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
        if (!file) { alert('⚠️ Harap pilih file!'); return; }
        if (file.size > 700 * 1024) {
            alert(`⚠️ Ukuran file terlalu besar! Maksimal: 700 KB.\nUkuran: ${(file.size / 1024).toFixed(1)} KB.`);
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
                indikator_id: currentSubBuktiId.split('.').slice(0, 3).join('.'),
                sub_bukti_id: currentSubBuktiId,
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
    if (display && uploadMode === 'file') display.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menyimpan...`;
    
    try {
        const existing = await db.collection('pkkm_uploads')
            .where('sub_bukti_id', '==', currentSubBuktiId)
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
    if (!userData) { alert('Silakan login!'); return; }
    if (!confirm('⚠️ Yakin ingin menghapus bukti ini?')) return;
    try {
        await db.collection('pkkm_uploads').doc(uploadId).delete();
        alert('✅ File berhasil dihapus!');
        loadPKKMData();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};

// ══════════════════════════════════════════════
// 5. ADMIN FUNCTIONS
// ══════════════════════════════════════════════
function checkAdminAccess() {
    if (!userData || (userData.role !== 'admin' && userData.role !== 'kepala')) {
        alert('⛔ Akses ditolak!');
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
                ${!user.password ? `<button onclick="setPassword('${user.uid}', '${user.email}')" style="background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fas fa-key"></i></button>` : ''}
                <button onclick="deleteUser('${user.uid}')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

window.setPassword = async function(userId, email) {
    const newPassword = prompt(`Password baru untuk ${email} (Min. 6 karakter):`);
    if (!newPassword || newPassword.length < 6) { alert('❌ Minimal 6 karakter!'); return; }
    if (!confirm(`Set password "${newPassword}" untuk ${email}?`)) return;
    try {
        await db.collection('users').doc(userId).update({ password: newPassword });
        alert(`✅ Password diset: ${newPassword}`);
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

window.createNewUser = async function() {
    if (!checkAdminAccess()) return;
    
    const nama = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    
    if (!nama || !email || !password) {
        alert('⚠️ Semua kolom (Nama, Email, Password) wajib diisi!');
        return;
    }
    if (password.length < 6) {
        alert('⚠️ Password minimal 6 karakter!');
        return;
    }
    
    if (nama.split(' ').length < 2) {
        if (!confirm('⚠️ PERINGATAN: Nama user hanya 1 kata (misal: "Nur").\n\nIni BERISIKO membuat user tersebut bisa mengakses SEMUA bidang yang mengandung kata tersebut.\n\nSangat disarankan menggunakan Nama Lengkap + Gelar (contoh: "Nur Syamsi S.Pd").\n\nLanjutkan?')) {
            return;
        }
    }

    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (!snapshot.empty) {
            alert('⚠️ Email sudah terdaftar! Gunakan email lain.');
            return;
        }
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        await db.collection('users').doc(uid).set({
            uid: uid,
            email: email,
            nama: nama,
            role: role,
            password: password,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ User berhasil ditambahkan!\n\nNama: ${nama}\nEmail: ${email}\nPassword: ${password}`);
        
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserRole').value = 'guru';
        
        loadAdminData();
    } catch (error) {
        let errorMsg = error.message;
        if (error.code === 'auth/weak-password') errorMsg = 'Password terlalu lemah. Minimal 6 karakter.';
        else if (error.code === 'auth/email-already-in-use') errorMsg = 'Email sudah terdaftar di sistem Firebase.';
        alert('❌ Gagal menambah user: ' + errorMsg);
    }
};

window.deleteUser = async function(userId) {
    if (!checkAdminAccess() || !confirm('Yakin hapus user ini?')) return;
    try { 
        await db.collection('users').doc(userId).delete(); 
        alert('✅ User dihapus.'); 
        loadAdminData(); 
    } catch (error) { 
        alert('❌ Gagal: ' + error.message); 
    }
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
            <button onclick="saveAssignment('${ind.id}', this)" style="background:#10b981;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-save"></i> Simpan Penugasan</button>
        </div>`).join('');
}

window.saveAssignment = async function(indikatorId, btn) {
    if (!checkAdminAccess()) return;
    const checkboxes = btn.parentElement.querySelectorAll('input[type="checkbox"]:checked');
    const penugasan = Array.from(checkboxes).map(cb => cb.value);
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
        await db.collection('pkkm_indikator').doc(indikatorId).update({ penugasan: penugasan, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert('✅ Penugasan disimpan!'); loadPKKMData();
    } catch (error) { alert('❌ Gagal: ' + error.message); } 
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penugasan'; }
};

window.setupDataPKKM = async function() {
    if (!checkAdminAccess() || !confirm('⚠️ PERINGATAN: Semua data lama akan DIHAPUS dan diganti dengan data baru. Lanjutkan?')) return;
    
    try {
        const deletePromises = [];
        deletePromises.push(db.collection('pkkm_aspek').get().then(snapshot => Promise.all(snapshot.docs.map(doc => doc.ref.delete()))));
        deletePromises.push(db.collection('pkkm_indikator').get().then(snapshot => Promise.all(snapshot.docs.map(doc => doc.ref.delete()))));
        await Promise.all(deletePromises);

        const aspekList = [
            { kode: 'A', nama: 'Usaha Pengembangan Madrasah' },
            { kode: 'B', nama: 'Pelaksanaan Tugas Manajerial' },
            { kode: 'C', nama: 'Pengembangan Kewirausahaan' },
            { kode: 'D', nama: 'Supervisi Guru & Tenaga Kependidikan' },
            { kode: 'E', nama: 'Hasil Kinerja Kepala Madrasah' }
        ];
        
        await Promise.all(aspekList.map(asp => db.collection('pkkm_aspek').doc(`aspek_${asp.kode}`).set(asp)));
        
        const timA = ['Nur Asia S.Pd', 'Eka Sasmita S.Sos', 'Fahrir S.Pd', 'Haerunnisa S.Pd M.Pd', 'Khusnul Inayah S.Pd', 'Erwin S.Pd', 'Panji S.Pd', 'Nur Faida Ulfa S.Kom'];
        const timB = ['Wahyuni S.Pd', 'Nur Syamsi S.Pd', 'Andi Irnawanti Nursak S.Pd', 'Nur Hikmah S.Pd', 'Halijah S.Pd', 'Marwati S.Pd M.Pd', 'Lukman SE'];
        const timC = ['Kasmidar S.Pd', 'Lisa Aswirayanti SE', 'Nur Syamsi S.Hum', 'Fajrul Ikhsan Alimuddin S.Pd'];
        const timD = ['Nur Syamsi S.Pd.I', 'St. Muawwafah S.Pd', 'St. Syamsiah S.Ag', 'Nurul Faiqah Jamal S.Pd'];

        const indikatorList = [
            { aspek_id: 'aspek_A', kode: 'A.1.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi.', bukti_list: [{ id: 'A.1.1.1.1', nama: 'Bagan struktur organisasi' }], penugasan: timA },
            { aspek_id: 'aspek_B', kode: 'B.2.1.1', pertanyaan: 'Mampu mengembangkan RKJM/RKT.', bukti_list: [{ id: 'B.2.1.1.1', nama: 'Dokumen RKJM' }], penugasan: timB },
        ];
        
        await Promise.all(indikatorList.map(ind => {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            return db.collection('pkkm_indikator').doc(docId).set(ind);
        }));
        
        alert('✅ Setup Data Berhasil! Silakan refresh halaman.');
        location.reload();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};