// ══════════════════════════════════════════════
// PKKM DIGITAL - MULTI TAHUN AJARAN (4 TAHUN)
// DENGAN SUB-BUKTI UPLOAD
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
let currentSubBuktiId = null;

let currentTahun = '2026/2027';

// ═════════════════════════════════════════════
// 1. INIT & AUTH STATE
// ═════════════════════════════════════════════
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
                        id: indDoc.id, 
                        ...ind, 
                        bukti_uploads: buktiList.map(bukti => {
                            const uploads = uploadsMap[bukti.id] || [];
                            return { ...bukti, uploads: uploads };
                        })
                    };
                    
                    buktiList.forEach(bukti => {
                        totalSubBukti++;
                        const uploads = uploadsMap[bukti.id] || [];
                        if (uploads.length > 0) selesaiSubBukti++;
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
                        const isAssigned = userData && ind.penugasan && ind.penugasan.some(p => p.toLowerCase().includes(userData.nama.toLowerCase().split(',')[0]));
                        
                        return `
                            <div class="indikator-item" style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
                                <div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 4px;">${ind.kode} - ${ind.pertanyaan}</div>
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px;"><strong>Penanggung Jawab:</strong> ${ind.penugasan ? ind.penugasan.join(', ') : '-'}</div>
                                <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
                                    <div style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 8px;"><i class="fas fa-list-check"></i> Bukti yang harus diupload:</div>
                                    ${ind.bukti_uploads.map((bukti, idx) => {
                                        const hasUpload = bukti.uploads.length > 0;
                                        const lastUpload = hasUpload ? bukti.uploads[bukti.uploads.length - 1] : null;
                                        const isMyUpload = lastUpload && lastUpload.guru_uid === userData?.uid;
                                        
                                        return `
                                            <div style="background: ${hasUpload ? '#f0fdf4' : '#f8fafc'}; padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${hasUpload ? '#10b981' : '#cbd5e1'}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                                <div style="flex: 1; min-width: 0;">
                                                    <div style="font-size: 0.9rem; font-weight: 600; color: #0f172a;">
                                                        ${hasUpload ? '<i class="fas fa-check-circle" style="color: #10b981;"></i>' : '<i class="fas fa-circle" style="color: #cbd5e1;"></i>'} 
                                                        ${idx + 1}. ${bukti.nama}
                                                    </div>
                                                    ${hasUpload ? `
                                                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                                                            <i class="fas fa-file"></i> ${lastUpload.file_name} - diupload oleh ${lastUpload.guru_nama}
                                                        </div>
                                                    ` : '<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-clock"></i> Belum ada dokumen</div>'}
                                                </div>
                                                <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
                                                    ${hasUpload ? `
                                                        <button onclick="previewFile(${JSON.stringify(lastUpload).replace(/'/g, "\\'")})" style="background: #6366f1; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-eye"></i> Preview
                                                        </button>
                                                        <button onclick="downloadFile(${JSON.stringify(lastUpload).replace(/'/g, "\\'")})" style="background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-download"></i> Download
                                                        </button>
                                                    ` : ''}
                                                    ${userData && isAssigned ? `
                                                        <button onclick="openUploadModal('${ind.id}', '${ind.kode}', '${bukti.id}', '${bukti.nama.replace(/'/g, "\\'")}', '${ind.pertanyaan.replace(/'/g, "\\'")}')" style="background: #0891b2; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-${hasUpload && isMyUpload ? 'sync-alt' : 'upload'}"></i> ${hasUpload && isMyUpload ? 'Ganti' : 'Upload'}
                                                        </button>
                                                    ` : '<button disabled style="background: #e2e8f0; color: #94a3b8; padding: 5px 10px; border-radius: 5px; border: none; font-size: 0.8rem; width: 90px; cursor: not-allowed;"><i class="fas fa-lock"></i> Kunci</button>'}
                                                    ${hasUpload ? `
                                                        <button onclick="deleteUpload('${lastUpload.id}')" style="background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; width: 90px;">
                                                            <i class="fas fa-trash"></i> Hapus
                                                        </button>
                                                    ` : ''}
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
                newWindow.document.write(`<!DOCTYPE html><html><head><title>Preview: ${uploadData.file_name || 'Dokumen'}</title><style>body{margin:0;padding:0;}iframe{width:100%;height:100vh;border:none;}</style></head><body><iframe src="${blobUrl}" type="application/pdf"></iframe></body></html>`);
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
// 6. UPLOAD LOGIC (SUB-BUKTI)
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
        if (file.size > 500 * 1024) {
            display.innerHTML += `<br><span style="color: #ef4444; font-size: 0.8rem;">⚠️ Melebihi 500KB. Gunakan tab "Link Google Drive" atau kompres file.</span>`;
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
        if (file.size > 500 * 1024) {
            alert(`⚠️ Ukuran file terlalu besar! Maksimal: 500 KB.\nUkuran: ${(file.size / 1024).toFixed(1)} KB.`);
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
// 7. ADMIN FUNCTIONS
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
            <button onclick="saveAssignment('${ind.id}', this)" style="background:#10b981;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-save"></i> Simpan Penugasan</button>
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
// 8. SETUP DATA AWAL (ADMIN ONLY) - DENGAN SUB-BUKTI
// ══════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (!checkAdminAccess() || !confirm('⚠️ Isi database dengan 109 indikator + sub-bukti PKKM lengkap?')) return;
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
            { aspek_id: 'aspek_A', kode: 'A.1.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.', bukti_list: [
                { id: 'A.1.1.1.1', nama: 'Bagan/struktur organisasi' },
                { id: 'A.1.1.1.2', nama: 'Notulen rapat keputusan tentang penyusunan struktur organisasi' },
                { id: 'A.1.1.1.3', nama: 'Dokumen sosialisasi' },
                { id: 'A.1.1.1.4', nama: 'Daftar hadir' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.2', pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.', bukti_list: [
                { id: 'A.1.1.2.1', nama: 'Dokumen penetapan/pengesahan susunan organisasi madrasah' },
                { id: 'A.1.1.2.2', nama: 'Rincian tugas setiap personil pada struktur organisasi madrasah' },
                { id: 'A.1.1.2.3', nama: 'Sertifikat' },
                { id: 'A.1.1.2.4', nama: 'SOP Personalia' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.', bukti_list: [
                { id: 'A.1.1.3.1', nama: 'Dokumen SOP madrasah' },
                { id: 'A.1.1.3.2', nama: 'Pedoman Sistem Informasi Madrasah' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.1', pertanyaan: 'Mampu mengembangkan program baru untuk meningkatkan pencapaian target.', bukti_list: [
                { id: 'A.1.2.1.1', nama: 'Visi dan misi madrasah' },
                { id: 'A.1.2.1.2', nama: 'Data prestasi madrasah' },
                { id: 'A.1.2.1.3', nama: 'Data hasil UN 3 tahun terakhir' },
                { id: 'A.1.2.1.4', nama: 'Data alumni' },
                { id: 'A.1.2.1.5', nama: 'RKJM' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.2', pertanyaan: 'Mampu membangun tim kerja yang efektif.', bukti_list: [
                { id: 'A.1.2.2.1', nama: 'Bagan/struktur organisasi' },
                { id: 'A.1.2.2.2', nama: 'SK' },
                { id: 'A.1.2.2.3', nama: 'Tugas dan fungsi' },
                { id: 'A.1.2.2.4', nama: 'Pedoman monitoring dan evaluasi kerja' },
                { id: 'A.1.2.2.5', nama: 'Pedoman reward dan punishment' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.3', pertanyaan: 'Mampu menerapkan teknik pembaharuan dalam pengelolaan pembelajaran.', bukti_list: [
                { id: 'A.1.2.3.1', nama: 'Dokumen kurikulum' },
                { id: 'A.1.2.3.2', nama: 'Kalender pendidikan' },
                { id: 'A.1.2.3.3', nama: 'Perangkat pembelajaran' },
                { id: 'A.1.2.3.4', nama: 'Penilaian' },
                { id: 'A.1.2.3.5', nama: 'Peraturan akademik' },
                { id: 'A.1.2.3.6', nama: 'Notulen diskusi evaluasi rutin pembelajaran' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.4', pertanyaan: 'Mampu mengembangkan potensi dan meningkatkan prestasi madrasah.', bukti_list: [
                { id: 'A.1.2.4.1', nama: 'Data prestasi madrasah 1 tahun terakhir' },
                { id: 'A.1.2.4.2', nama: 'Data hasil UN 1 tahun terakhir' },
                { id: 'A.1.2.4.3', nama: 'Dokumen akreditasi' },
                { id: 'A.1.2.4.4', nama: 'Program ekstrakurikuler' },
                { id: 'A.1.2.4.5', nama: 'Program unggulan madrasah' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.1', pertanyaan: 'Merencanakan kerjasama dengan lembaga pemerintah, swasta dan masyarakat.', bukti_list: [
                { id: 'A.1.3.1.1', nama: 'SK komite madrasah' },
                { id: 'A.1.3.1.2', nama: 'AD/ART komite madrasah' },
                { id: 'A.1.3.1.3', nama: 'Program kerja komite madrasah' },
                { id: 'A.1.3.1.4', nama: 'Laporan kegiatan komite madrasah' },
                { id: 'A.1.3.1.5', nama: 'Dokumen tertulis kerja sama (MoU)' },
                { id: 'A.1.3.1.6', nama: 'Foto-foto' },
                { id: 'A.1.3.1.7', nama: 'Sertifikat/plakat kerja sama' },
                { id: 'A.1.3.1.8', nama: 'Laporan kegiatan' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.2', pertanyaan: 'Melakukan pendekatan untuk mendapatkan dukungan dari lembaga.', bukti_list: [
                { id: 'A.1.3.2.1', nama: 'Program kegiatan kerjasama' },
                { id: 'A.1.3.2.2', nama: 'Foto kegiatan' },
                { id: 'A.1.3.2.3', nama: 'Jadwal kegiatan' },
                { id: 'A.1.3.2.4', nama: 'Laporan kegiatan' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.3', pertanyaan: 'Memanfaatkan dan memelihara hubungan kerjasama.', bukti_list: [
                { id: 'A.1.3.3.1', nama: 'Laporan kegiatan kerja' },
                { id: 'A.1.3.3.2', nama: 'Laporan monitoring/evaluasi kegiatan' },
                { id: 'A.1.3.3.3', nama: 'Dokumentasi foto/video pelaksanaan kerjasama' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.1', pertanyaan: 'Mengaplikasikan pengembangan kurikulum sesuai standar isi.', bukti_list: [
                { id: 'A.1.4.1.1', nama: 'Kurikulum' },
                { id: 'A.1.4.1.2', nama: 'Kalender pendidikan' },
                { id: 'A.1.4.1.3', nama: 'Perangkat pembelajaran' },
                { id: 'A.1.4.1.4', nama: 'Pedoman penilaian' },
                { id: 'A.1.4.1.5', nama: 'Peraturan akademik' },
                { id: 'A.1.4.1.6', nama: 'Buku kerja guru' },
                { id: 'A.1.4.1.7', nama: 'Dokumen rapat penyusunan kurikulum (daftar hadir, daftar peserta, foto)' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.2', pertanyaan: 'Mengaplikasikan pengembangan proses pembelajaran sesuai standar proses.', bukti_list: [
                { id: 'A.1.4.2.1', nama: 'Dokumen pengembangan silabus' },
                { id: 'A.1.4.2.2', nama: 'RPP' },
                { id: 'A.1.4.2.3', nama: 'Struktur Kurikulum' },
                { id: 'A.1.4.2.4', nama: 'Pembagian jam mengajar' },
                { id: 'A.1.4.2.5', nama: 'Jadwal mengajar' },
                { id: 'A.1.4.2.6', nama: 'RPE' },
                { id: 'A.1.4.2.7', nama: 'Buku teks' },
                { id: 'A.1.4.2.8', nama: 'Jurnal mengajar guru' },
                { id: 'A.1.4.2.9', nama: 'Data siswa per kelas' },
                { id: 'A.1.4.2.10', nama: 'Dokumen supervisi (laporan pemantauan, laporan supervisi, laporan evaluasi, rencana tindak lanjut)' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.3', pertanyaan: 'Mengaplikasikan sistem penilaian pembelajaran sesuai standar penilaian.', bukti_list: [
                { id: 'A.1.4.3.1', nama: 'Instrumen penilaian' },
                { id: 'A.1.4.3.2', nama: 'Kisi-kisi soal' },
                { id: 'A.1.4.3.3', nama: 'Kumpulan naskah soal' },
                { id: 'A.1.4.3.4', nama: 'Analisis butir soal' },
                { id: 'A.1.4.3.5', nama: 'Dokumen analisis hasil belajar siswa' },
                { id: 'A.1.4.3.6', nama: 'Laporan hasil belajar siswa' },
                { id: 'A.1.4.3.7', nama: 'Tindak lanjut hasil penilaian' },
                { id: 'A.1.4.3.8', nama: 'Dokumen pelaksanaan PAS' },
                { id: 'A.1.4.3.9', nama: 'Dokumen pelaksanaan PAT' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.4', pertanyaan: 'Melaksanakan penjaminan mutu pencapaian standar kompetensi lulusan.', bukti_list: [
                { id: 'A.1.4.4.1', nama: 'Dokumen program kegiatan kesiswaan' },
                { id: 'A.1.4.4.2', nama: 'Laporan kegiatan kesiswaan' },
                { id: 'A.1.4.4.3', nama: 'Dokumentasi kegiatan kesiswaan' },
                { id: 'A.1.4.4.4', nama: 'Laporan kegiatan pembiasaan siswa' },
                { id: 'A.1.4.4.5', nama: 'Dokumen kegiatan literasi' },
                { id: 'A.1.4.4.6', nama: 'Data rata-rata hasil ujian 2 tahun terakhir' },
                { id: 'A.1.4.4.7', nama: 'Data prestasi akademik 2 tahun terakhir' },
                { id: 'A.1.4.4.8', nama: 'Data prestasi non akademik 2 tahun terakhir' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.1', pertanyaan: 'Mampu mengelola laboratorium madrasah secara optimal.', bukti_list: [
                { id: 'A.1.5.1.1', nama: 'Luas sesuai standar' },
                { id: 'A.1.5.1.2', nama: 'Sarana pendukung laboratorium' },
                { id: 'A.1.5.1.3', nama: 'Program kerja laboratorium' },
                { id: 'A.1.5.1.4', nama: 'Jurnal dan laporan pengelolaan laboratorium' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah.', bukti_list: [
                { id: 'A.1.5.2.1', nama: 'Luas sesuai standar' },
                { id: 'A.1.5.2.2', nama: 'Sarana pendukung' },
                { id: 'A.1.5.2.3', nama: 'Daftar buku induk perpustakaan' },
                { id: 'A.1.5.2.4', nama: 'Laporan pengelolaan perpustakaan' },
                { id: 'A.1.5.2.5', nama: 'Program kerja perpustakaan' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.3', pertanyaan: 'Mampu mengelola usaha madrasah.', bukti_list: [
                { id: 'A.1.5.3.1', nama: 'Data/laporan kegiatan usaha madrasah' },
                { id: 'A.1.5.3.2', nama: 'Dokumentasi kegiatan (foto/video)' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.4', pertanyaan: 'Mampu mengelola koperasi madrasah.', bukti_list: [
                { id: 'A.1.5.4.1', nama: 'Instrumen hasil praktik pembelajaran' },
                { id: 'A.1.5.4.2', nama: 'Foto kegiatan praktik' },
                { id: 'A.1.5.4.3', nama: 'AD/ART koperasi' },
                { id: 'A.1.5.4.4', nama: 'Laporan RAT' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.1', pertanyaan: 'Memanfaatkan TIK dalam manajemen madrasah.', bukti_list: [
                { id: 'A.1.6.1.1', nama: 'Fasilitas teknologi dan informasi' },
                { id: 'A.1.6.1.2', nama: 'Sumber daya informasi' },
                { id: 'A.1.6.1.3', nama: 'Website madrasah' },
                { id: 'A.1.6.1.4', nama: 'Pedoman sistem informasi madrasah' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.2', pertanyaan: 'Memanfaatkan TIK dalam pembelajaran.', bukti_list: [
                { id: 'A.1.6.2.1', nama: 'Ketersediaan komputer' },
                { id: 'A.1.6.2.2', nama: 'Jaringan internet' },
                { id: 'A.1.6.2.3', nama: 'Website madrasah' },
                { id: 'A.1.6.2.4', nama: 'Alamat email madrasah' },
                { id: 'A.1.6.2.5', nama: 'Pemanfaatan TIK untuk pembelajaran (observasi/wawancara)' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.3', pertanyaan: 'Memanfaatkan TIK dalam menjalin kerjasama.', bukti_list: [
                { id: 'A.1.6.3.1', nama: 'Pengelola SIM' },
                { id: 'A.1.6.3.2', nama: 'Fasilitas SIM' },
                { id: 'A.1.6.3.3', nama: 'Surat tugas pengelola SIM' },
                { id: 'A.1.6.3.4', nama: 'Pelaporan data dan informasi' },
                { id: 'A.1.6.3.5', nama: 'Program promosi' },
                { id: 'A.1.6.3.6', nama: 'Observasi dan wawancara' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.4', pertanyaan: 'Memanfaatkan TIK dalam promosi program madrasah.', bukti_list: [
                { id: 'A.1.6.4.1', nama: 'Pengelola SIM' },
                { id: 'A.1.6.4.2', nama: 'Fasilitas SIM' },
                { id: 'A.1.6.4.3', nama: 'Surat tugas pengelola SIM' },
                { id: 'A.1.6.4.4', nama: 'Pelaporan data dan informasi' },
                { id: 'A.1.6.4.5', nama: 'Program informasi' },
                { id: 'A.1.6.4.6', nama: 'Observasi dan wawancara' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.1', pertanyaan: 'Mampu mengembangkan sistem administrasi pengelolaan dengan TIK.', bukti_list: [
                { id: 'A.1.7.1.1', nama: 'Jumlah komputer dan LCD yang cukup' },
                { id: 'A.1.7.1.2', nama: 'Memiliki jaringan internet' },
                { id: 'A.1.7.1.3', nama: 'Memiliki web sekolah' },
                { id: 'A.1.7.1.4', nama: 'Memiliki email madrasah' },
                { id: 'A.1.7.1.5', nama: 'Laporan absensi elektronik' },
                { id: 'A.1.7.1.6', nama: 'Dokumen lain pemanfaatan TIK untuk administrasi madrasah' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.2', pertanyaan: 'Mengelola administrasi pembelajaran dengan TIK.', bukti_list: [
                { id: 'A.1.7.2.1', nama: 'Jumlah komputer dan LCD yang cukup' },
                { id: 'A.1.7.2.2', nama: 'Memiliki jaringan internet' },
                { id: 'A.1.7.2.3', nama: 'Pemanfaatan TIK untuk pembelajaran (Edmodo, Google Classroom, dll)' },
                { id: 'A.1.7.2.4', nama: 'Pengelolaan penilaian secara online' }
            ], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.3', pertanyaan: 'Mampu mengembangkan sistem pengelolaan perpustakaan dengan TIK.', bukti_list: [
                { id: 'A.1.7.3.1', nama: 'Katalog' },
                { id: 'A.1.7.3.2', nama: 'BSE' },
                { id: 'A.1.7.3.3', nama: 'Akses internet' },
                { id: 'A.1.7.3.4', nama: 'Komputer' },
                { id: 'A.1.7.3.5', nama: 'Dokumen aplikasi layanan perpustakaan' }
            ], penugasan: timA },
            { aspek_id: 'aspek_B', kode: 'B.2.1.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM berdasarkan evaluasi 8 SNP.', bukti_list: [
                { id: 'B.2.1.1.1', nama: 'Dokumen Evaluasi diri madrasah' },
                { id: 'B.2.1.1.2', nama: 'Dokumen RKJM dan RKT berbasis SDM' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.2', pertanyaan: 'Mampu merumuskan visi-misi sebagai arah pengembangan.', bukti_list: [
                { id: 'B.2.1.2.1', nama: 'Visi misi yang telah ditetapkan oleh Kamad' },
                { id: 'B.2.1.2.2', nama: 'Berita acara dan daftar hadir kegiatan perumusan/peninjauan kembali dan penetapan visi misi' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.3', pertanyaan: 'Mampu menentukan strategi pencapaian tujuan madrasah.', bukti_list: [
                { id: 'B.2.1.3.1', nama: 'Program kerja' },
                { id: 'B.2.1.3.2', nama: 'RKJM dan RKTM' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.4', pertanyaan: 'Mampu menyusun program dengan rencana evaluasi.', bukti_list: [
                { id: 'B.2.1.4.1', nama: 'RKJM dan RKTM' },
                { id: 'B.2.1.4.2', nama: 'Rencana/program evaluasi dan monitoring' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.1', pertanyaan: 'Mampu memberi contoh berdisiplin.', bukti_list: [
                { id: 'B.2.2.1.1', nama: 'Daftar hadir elektronik kamad' },
                { id: 'B.2.2.1.2', nama: 'Daftar hadir pada kegiatan di madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.2', pertanyaan: 'Mampu melaksanakan peraturan sesuai ketentuan.', bukti_list: [
                { id: 'B.2.2.2.1', nama: 'Wawancara dengan warga madrasah' },
                { id: 'B.2.2.2.2', nama: 'Laporan kehadiran' },
                { id: 'B.2.2.2.3', nama: 'Notulen rapat/briefing pengarahan kegiatan' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.3', pertanyaan: 'Mampu menunjukkan keteladanan memanfaatkan sumber daya.', bukti_list: [
                { id: 'B.2.2.3.1', nama: 'Wawancara dengan warga madrasah' },
                { id: 'B.2.2.3.2', nama: 'Dokumen monitoring dan evaluasi pemanfaatan sumber belajar' },
                { id: 'B.2.2.3.3', nama: 'Notulensi rapat/diskusi pemanfaatan sumber belajar' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.4', pertanyaan: 'Mampu menunjukkan kedisiplinan sebagai insan pembelajar.', bukti_list: [
                { id: 'B.2.2.4.1', nama: 'Koleksi buku referensi/ilmu pengetahuan' },
                { id: 'B.2.2.4.2', nama: 'Karya tulis yang diterbitkan atau tidak' },
                { id: 'B.2.2.4.3', nama: 'Majalah/koran madrasah' },
                { id: 'B.2.2.4.4', nama: 'Website madrasah' },
                { id: 'B.2.2.4.5', nama: 'Blog pribadi' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.1', pertanyaan: 'Mampu menjadi contoh berbudaya mutu yang kompetitif.', bukti_list: [
                { id: 'B.2.3.1.1', nama: 'Peningkatan KKM' },
                { id: 'B.2.3.1.2', nama: 'Hasil UN' },
                { id: 'B.2.3.1.3', nama: 'Program keunggulan dan inovasi akademik/non akademik' },
                { id: 'B.2.3.1.4', nama: 'Data prestasi akademik dan non akademik' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.2', pertanyaan: 'Mampu melengkapi sarana prasarana untuk suasana belajar kondusif.', bukti_list: [
                { id: 'B.2.3.2.1', nama: 'Observasi lingkungan madrasah (asri, bersih, rindang, aman, menyenangkan)' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.3', pertanyaan: 'Mampu memfasilitasi kegiatan budaya baca dan tulis.', bukti_list: [
                { id: 'B.2.3.3.1', nama: 'Rencana dan laporan pelaksanaan kegiatan literasi' },
                { id: 'B.2.3.3.2', nama: 'Dokumen kegiatan pengembangan budaya baca' },
                { id: 'B.2.3.3.3', nama: 'Dokumen/pajangan hasil karya tulis siswa' },
                { id: 'B.2.3.3.4', nama: 'Data kunjungan perpustakaan' },
                { id: 'B.2.3.3.5', nama: 'Data peminjaman buku perpustakaan' },
                { id: 'B.2.3.3.6', nama: 'Observasi/wawancara' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.4', pertanyaan: 'Mampu memfasilitasi kegiatan lomba akademik dan nonakademik.', bukti_list: [
                { id: 'B.2.3.4.1', nama: 'Dokumen penyelenggaraan kegiatan kompetisi tingkat madrasah' },
                { id: 'B.2.3.4.2', nama: 'Daftar perolehan piagam, penghargaan, piala, trofi perlombaan di semua jenjang' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.1', pertanyaan: 'Mampu menyusun perencanaan pengembangan pendidik dan tendik.', bukti_list: [
                { id: 'B.2.4.1.1', nama: 'Program kerja kepala madrasah' },
                { id: 'B.2.4.1.2', nama: 'Laporan kegiatan workshop/pelatihan kompetensi guru' },
                { id: 'B.2.4.1.3', nama: 'Dokumentasi (foto/video) kegiatan workshop atau pelatihan guru' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.2', pertanyaan: 'Mampu melakukan pembinaan berkala untuk meningkatkan mutu SDM.', bukti_list: [
                { id: 'B.2.4.2.1', nama: 'Buku/catatan pembinaan guru dan tendik' },
                { id: 'B.2.4.2.2', nama: 'Notulen dan daftar hadir rapat pembinaan' },
                { id: 'B.2.4.2.3', nama: 'Laporan kinerja kepala madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.3', pertanyaan: 'Memfasilitasi guru dan staf untuk meningkatkan kompetensi.', bukti_list: [
                { id: 'B.2.4.3.1', nama: 'Buku/catatan pembinaan guru dan tendik' },
                { id: 'B.2.4.3.2', nama: 'Notulen dan daftar hadir rapat pembinaan' },
                { id: 'B.2.4.3.3', nama: 'Laporan kinerja kepala madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.4', pertanyaan: 'Memantau penerapan hasil pelatihan dalam pekerjaan.', bukti_list: [
                { id: 'B.2.4.4.1', nama: 'Program pelatihan pengembangan profesi guru dan tendik' },
                { id: 'B.2.4.4.2', nama: 'Laporan pelaksanaan pelatihan pengembangan profesi guru dan tendik' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.1', pertanyaan: 'Mampu mengelola fasilitas prasarana, perabot dan sarana.', bukti_list: [
                { id: 'B.2.5.1.1', nama: 'Buku Inventaris' },
                { id: 'B.2.5.1.2', nama: 'Buku pemeliharaan sarana dan prasarana' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah.', bukti_list: [
                { id: 'B.2.5.2.1', nama: 'Buku induk perpustakaan' },
                { id: 'B.2.5.2.2', nama: 'Buku data grafik layanan perpustakaan' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.3', pertanyaan: 'Mampu mengelola laboratorium madrasah.', bukti_list: [
                { id: 'B.2.5.3.1', nama: 'Daftar inventaris laboratorium' },
                { id: 'B.2.5.3.2', nama: 'Buku/jurnal/data/grafik layanan laboratorium' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.4', pertanyaan: 'Mampu mengelola fasilitas penunjang madrasah lainnya.', bukti_list: [
                { id: 'B.2.5.4.1', nama: 'Data fasilitas penunjang wirausaha yang dikelola oleh madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.1', pertanyaan: 'Menyusun perencanaan penerimaan dan pengembangan kompetensi peserta didik.', bukti_list: [
                { id: 'B.2.6.1.1', nama: 'Dokumen program penerimaan peserta didik baru' },
                { id: 'B.2.6.1.2', nama: 'Brosur' },
                { id: 'B.2.6.1.3', nama: 'Data hasil analisis kemampuan peserta didik baru' },
                { id: 'B.2.6.1.4', nama: 'Hasil psikotes minat bakat peserta didik baru' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.2', pertanyaan: 'Memiliki program pengembangan potensi diri dan prestasi.', bukti_list: [
                { id: 'B.2.6.2.1', nama: 'Program pengembangan diri peserta didik akademik dan non akademik' },
                { id: 'B.2.6.2.2', nama: 'Laporan pengembangan diri peserta didik akademik dan non akademik' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.3', pertanyaan: 'Memfasilitasi kegiatan pembiasaan melalui penanaman nilai-nilai.', bukti_list: [
                { id: 'B.2.6.3.1', nama: 'Program kegiatan akademik dan non akademik dan laporan' },
                { id: 'B.2.6.3.2', nama: 'Laporan kegiatan pembiasaan diri peserta didik' },
                { id: 'B.2.6.3.3', nama: 'Dokumentasi kegiatan' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.4', pertanyaan: 'Memfasilitasi kegiatan pengembangan diri bagi peserta didik, pendidik, tendik.', bukti_list: [
                { id: 'B.2.6.4.1', nama: 'Program kegiatan pengembangan diri' },
                { id: 'B.2.6.4.2', nama: 'Dokumen kegiatan' },
                { id: 'B.2.6.4.3', nama: 'Data prestasi siswa, guru, dan tendik' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.1', pertanyaan: 'Mampu mengarahkan pengembangan KTSP dalam IHT, Workshop, MGMP.', bukti_list: [
                { id: 'B.2.7.1.1', nama: 'Dokumen kurikulum yang berlaku' },
                { id: 'B.2.7.1.2', nama: 'SK tim pengembangan kurikulum' },
                { id: 'B.2.7.1.3', nama: 'Dokumen penyusunan kurikulum (daftar hadir, berita acara, notulen)' },
                { id: 'B.2.7.1.4', nama: 'Laporan kegiatan workshop/rakor pengembangan kurikulum' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.2', pertanyaan: 'Mampu mengendalikan pelaksanaan KTSP berlandaskan kalender pendidikan.', bukti_list: [
                { id: 'B.2.7.2.1', nama: 'Struktur kurikulum' },
                { id: 'B.2.7.2.2', nama: 'Jadwal pelajaran' },
                { id: 'B.2.7.2.3', nama: 'Daftar hadir guru' },
                { id: 'B.2.7.2.4', nama: 'Peraturan akademik' },
                { id: 'B.2.7.2.5', nama: 'Kalender pendidikan' },
                { id: 'B.2.7.2.6', nama: 'SK pembagian tugas mengajar' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.3', pertanyaan: 'Memfasilitasi efektivitas tim kerja guru.', bukti_list: [
                { id: 'B.2.7.3.1', nama: 'Program KKG/MGMP di madrasah' },
                { id: 'B.2.7.3.2', nama: 'Laporan pelaksanaan KKG/MGMP' },
                { id: 'B.2.7.3.3', nama: 'Dokumentasi kegiatan (foto/video)' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.4', pertanyaan: 'Mampu mengembangkan pelayanan belajar yang inovatif.', bukti_list: [
                { id: 'B.2.7.4.1', nama: 'Observasi kelas, studi dokumen, wawancara dengan siswa dan guru' },
                { id: 'B.2.7.4.2', nama: 'Menelaah ragam metode, media, dan sumber belajar yang digunakan dalam RPP' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.5', pertanyaan: 'Memfasilitasi peserta didik dalam kolaborasi dan kompetisi.', bukti_list: [
                { id: 'B.2.7.5.1', nama: 'Program, laporan, dan dokumen kegiatan kesiswaan (akademik dan non akademik)' },
                { id: 'B.2.7.5.2', nama: 'Data prestasi akademik dan non akademik' },
                { id: 'B.2.7.5.3', nama: 'Dokumentasi kegiatan (laporan, foto, video)' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.1', pertanyaan: 'Mampu merencanakan kebutuhan keuangan madrasah.', bukti_list: [
                { id: 'B.2.8.1.1', nama: 'RKJM dan RKTM' },
                { id: 'B.2.8.1.2', nama: 'Rencana anggaran' },
                { id: 'B.2.8.1.3', nama: 'Laporan keuangan' },
                { id: 'B.2.8.1.4', nama: 'Buku kas' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.2', pertanyaan: 'Mampu mengupayakan sumber-sumber keuangan dari luar.', bukti_list: [
                { id: 'B.2.8.2.1', nama: 'RKJM dan RKTM' },
                { id: 'B.2.8.2.2', nama: 'Laporan keuangan' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.3', pertanyaan: 'Mampu mengkoordinasikan pengelolaan keuangan sesuai peraturan.', bukti_list: [
                { id: 'B.2.8.3.1', nama: 'RKJM dan RKTM' },
                { id: 'B.2.8.3.2', nama: 'Laporan keuangan' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.4', pertanyaan: 'Mampu membuat laporan dan evaluasi pengelolaan keuangan.', bukti_list: [
                { id: 'B.2.8.4.1', nama: 'RKJM dan RKTM' },
                { id: 'B.2.8.4.2', nama: 'Laporan keuangan' },
                { id: 'B.2.8.4.3', nama: 'Buku kas' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.1', pertanyaan: 'Mampu mengelola administrasi surat masuk dan keluar.', bukti_list: [
                { id: 'B.2.9.1.1', nama: 'Dokumen surat masuk dan keluar' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.2', pertanyaan: 'Mampu mengelola administrasi madrasah.', bukti_list: [
                { id: 'B.2.9.2.1', nama: 'Studi dokumen administrasi akademik, kesiswaan, sarana/prasarana, keuangan, dan hubungan madrasah dengan masyarakat' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.3', pertanyaan: 'Mampu mengelola administrasi kearsipan.', bukti_list: [
                { id: 'B.2.9.3.1', nama: 'Administrasi madrasah' },
                { id: 'B.2.9.3.2', nama: 'Arsip administrasi' },
                { id: 'B.2.9.3.3', nama: 'SOP administrasi madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.4', pertanyaan: 'Mampu mengelola administrasi akreditasi.', bukti_list: [
                { id: 'B.2.9.4.1', nama: 'Dokumen administrasi pemenuhan SNP madrasah' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.1', pertanyaan: 'Menyusun standar kinerja program pendidikan.', bukti_list: [
                { id: 'B.2.10.1.1', nama: 'Dokumen SKP yang terukur' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.2', pertanyaan: 'Melakukan monitoring dan evaluasi kinerja.', bukti_list: [
                { id: 'B.2.10.2.1', nama: 'Dokumen pelaksanaan monitoring dan evaluasi' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.3', pertanyaan: 'Menyusun laporan sesuai standar pelaporan monev.', bukti_list: [
                { id: 'B.2.10.3.1', nama: 'Dokumen laporan pelaksanaan monitoring dan evaluasi' }
            ], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.4', pertanyaan: 'Merumuskan program tindak lanjut berdasarkan hasil evaluasi.', bukti_list: [
                { id: 'B.2.10.4.1', nama: 'Dokumen laporan pelaksanaan monitoring dan evaluasi' }
            ], penugasan: timB },
            { aspek_id: 'aspek_C', kode: 'C.3.1.1', pertanyaan: 'Memahami dan menghayati arti perubahan (inovasi) madrasah.', bukti_list: [
                { id: 'C.3.1.1.1', nama: 'Program pengembangan kewirausahaan' },
                { id: 'C.3.1.1.2', nama: 'Profil madrasah beberapa tahun terakhir' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.2', pertanyaan: 'Menggunakan metode, teknik dan proses perubahan.', bukti_list: [
                { id: 'C.3.1.2.1', nama: 'Observasi: pemanfaatan hasil inovasi dan kreatifitas' },
                { id: 'C.3.1.2.2', nama: 'Membudayakan hasil inovasi dan kreatifitas' },
                { id: 'C.3.1.2.3', nama: 'Pengembangan pembudayaan inovasi dan kreatifitas' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.3', pertanyaan: 'Menumbuhkan iklim kebebasan berpikir untuk inovasi.', bukti_list: [
                { id: 'C.3.1.3.1', nama: 'Data jenis usaha produktif yang dimiliki' },
                { id: 'C.3.1.3.2', nama: 'Program pengelolaan dan pendayagunaan hasil usaha' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.4', pertanyaan: 'Mendorong warga madrasah melakukan prakarsa.', bukti_list: [
                { id: 'C.3.1.4.1', nama: 'Data jenis usaha produktif yang dimiliki' },
                { id: 'C.3.1.4.2', nama: 'Program pengelolaan dan pendayagunaan hasil usaha' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.1', pertanyaan: 'Mampu bertindak kreatif dan inovatif.', bukti_list: [
                { id: 'C.3.2.1.1', nama: 'RPP yang memuat rencana pembelajaran untuk menumbuhkan keterampilan berpikir kreatif, produktif, kritis, mandiri, kolaboratif, komunikatif' },
                { id: 'C.3.2.1.2', nama: 'Hasil kerja dan karya siswa' },
                { id: 'C.3.2.1.3', nama: 'Foto-foto aktifitas pembelajaran siswa' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.2', pertanyaan: 'Mampu memberdayakan potensi madrasah secara optimal.', bukti_list: [
                { id: 'C.3.2.2.1', nama: 'Rencana Pengembangan Madrasah (RPM)' },
                { id: 'C.3.2.2.2', nama: 'Dokumen penanganan permasalahan/kasus' },
                { id: 'C.3.2.2.3', nama: 'Dokumen hasil kegiatan sekolah' },
                { id: 'C.3.2.2.4', nama: 'Dokumen hasil kegiatan pengembangan madrasah' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.3', pertanyaan: 'Mampu menumbuhkan jiwa kewirausahaan.', bukti_list: [
                { id: 'C.3.2.3.1', nama: 'Rencana Pengembangan Madrasah (RPM)' },
                { id: 'C.3.2.3.2', nama: 'Dokumen penanganan permasalahan/kasus' },
                { id: 'C.3.2.3.3', nama: 'Dokumen hasil kegiatan sekolah' },
                { id: 'C.3.2.3.4', nama: 'Dokumen hasil kegiatan pengembangan madrasah' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.4', pertanyaan: 'Mampu mencatat ide-ide baru.', bukti_list: [
                { id: 'C.3.2.4.1', nama: 'Rencana Pengembangan Madrasah (observasi, wawancara, studi dokumen)' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.1', pertanyaan: 'Bersedia belajar dari orang lain.', bukti_list: [
                { id: 'C.3.3.1.1', nama: 'Forum komunikasi dengan lembaga pendidikan lain dan orang tua siswa' },
                { id: 'C.3.3.1.2', nama: 'Komunitas/forum kegiatan yang diikuti' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.2', pertanyaan: 'Ingin selalu melakukan yang terbaik.', bukti_list: [
                { id: 'C.3.3.2.1', nama: 'Dokumen/foto pelaksanaan kegiatan' },
                { id: 'C.3.3.2.2', nama: 'Keikutsertaan dalam lomba-lomba pembelajaran/pendidikan/manajemen prestasi' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.3', pertanyaan: 'Menciptakan perubahan yang kuat.', bukti_list: [
                { id: 'C.3.3.3.1', nama: 'Program inovasi madrasah atau RPM' },
                { id: 'C.3.3.3.2', nama: 'Laporan target yang sudah dicapai' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.1', pertanyaan: 'Mampu melibatkan tokoh agama, masyarakat, pemerintah.', bukti_list: [
                { id: 'C.3.4.1.1', nama: 'MoU dengan pihak lain' },
                { id: 'C.3.4.1.2', nama: 'Sister school/kemitraan dengan sekolah lain' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.2', pertanyaan: 'Mampu bersikap obyektif dalam mengatasi konflik.', bukti_list: [
                { id: 'C.3.4.2.1', nama: 'Observasi, wawancara, dan studi dokumen kegiatan/foto' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.3', pertanyaan: 'Mampu bersikap simpatik/tenggang rasa.', bukti_list: [
                { id: 'C.3.4.3.1', nama: 'Observasi, wawancara, dan studi dokumen kegiatan dan foto' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.1', pertanyaan: 'Mampu merencanakan kegiatan produksi/jasa.', bukti_list: [
                { id: 'C.3.5.1.1', nama: 'Dokumen laporan pelaksanaan dan hasil program pengembangan unit produksi kewirausahaan' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.2', pertanyaan: 'Mampu membina kegiatan produksi/jasa.', bukti_list: [
                { id: 'C.3.5.2.1', nama: 'Dokumen laporan pelaksanaan dan hasil Program Pengembangan Unit Produksi Kewirausahaan' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.3', pertanyaan: 'Mampu melaksanakan pengawasan kegiatan produksi/jasa.', bukti_list: [
                { id: 'C.3.5.3.1', nama: 'Laporan hasil Evaluasi Program Pengembangan Kewirausahaan' },
                { id: 'C.3.5.3.2', nama: 'Program Pengembangan Jiwa Kewirausahaan' },
                { id: 'C.3.5.3.3', nama: 'Program Pengembangan Unit Produksi Kewirausahaan' }
            ], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.4', pertanyaan: 'Mampu mengembangkan kegiatan produksi/jasa dan pemasarannya.', bukti_list: [
                { id: 'C.3.5.4.1', nama: 'Laporan hasil Evaluasi Program Pengembangan Kewirausahaan' },
                { id: 'C.3.5.4.2', nama: 'Program Pengembangan Jiwa Kewirausahaan' },
                { id: 'C.3.5.4.3', nama: 'Program Pengembangan Unit Produksi Kewirausahaan' }
            ], penugasan: timC },
            { aspek_id: 'aspek_D', kode: 'D.4.1.1', pertanyaan: 'Mengidentifikasi masalah guru dalam pembelajaran.', bukti_list: [
                { id: 'D.4.1.1.1', nama: 'Program pengawasan pembelajaran/supervisi pembelajaran' },
                { id: 'D.4.1.1.2', nama: 'Jadwal pelaksanaan supervisi' },
                { id: 'D.4.1.1.3', nama: 'SK tim supervisor' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.2', pertanyaan: 'Mampu merumuskan tujuan supervisi.', bukti_list: [
                { id: 'D.4.1.2.1', nama: 'Program pengawasan pembelajaran/supervisi pembelajaran' },
                { id: 'D.4.1.2.2', nama: 'Jadwal pelaksanaan supervisi' },
                { id: 'D.4.1.2.3', nama: 'Laporan hasil supervisi' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.3', pertanyaan: 'Mampu mengembangkan instrumen supervisi.', bukti_list: [
                { id: 'D.4.1.3.1', nama: 'Instrumen supervisi pembelajaran' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.1', pertanyaan: 'Mengadakan pertemuan awal supervisi.', bukti_list: [
                { id: 'D.4.2.1.1', nama: 'Program pengawasan pembelajaran/supervisi pembelajaran' },
                { id: 'D.4.2.1.2', nama: 'Jadwal supervisi' },
                { id: 'D.4.2.1.3', nama: 'Daftar hadir, notulen, foto pertemuan awal supervisi' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.2', pertanyaan: 'Melaksanakan pemantauan pembelajaran.', bukti_list: [
                { id: 'D.4.2.2.1', nama: 'Instrumen supervisi pembelajaran' },
                { id: 'D.4.2.2.2', nama: 'Laporan hasil supervisi pembelajaran' },
                { id: 'D.4.2.2.3', nama: 'Catatan rekomendasi hasil supervisi' },
                { id: 'D.4.2.2.4', nama: 'Rencana tindak lanjut hasil supervisi' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.3', pertanyaan: 'Melakukan pertemuan refleksi.', bukti_list: [
                { id: 'D.4.2.3.1', nama: 'Analisis hasil supervisi pembelajaran' },
                { id: 'D.4.2.3.2', nama: 'Catatan rekomendasi hasil supervisi' },
                { id: 'D.4.2.3.3', nama: 'Daftar hadir, notulen, foto pertemuan refleksi hasil supervisi' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.4', pertanyaan: 'Menyusun rekomendasi tindaklanjut perbaikan.', bukti_list: [
                { id: 'D.4.2.4.1', nama: 'Dokumen hasil analisis dan tindak lanjut supervisi penilaian' },
                { id: 'D.4.2.4.2', nama: 'Program kegiatan workshop/diklat penilaian untuk guru' },
                { id: 'D.4.2.4.3', nama: 'Hasil analisis butir soal' },
                { id: 'D.4.2.4.4', nama: 'Program remedial dan pengayaan' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.1', pertanyaan: 'Memfasilitasi guru merencanakan tindak lanjut.', bukti_list: [
                { id: 'D.4.3.1.1', nama: 'Dokumen hasil analisis dan tindak lanjut supervisi pembelajaran' },
                { id: 'D.4.3.1.2', nama: 'Hasil kegiatan workshop/diklat untuk guru' },
                { id: 'D.4.3.1.3', nama: 'Data dan piagam hasil pelatihan guru' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.2', pertanyaan: 'Mengecek ulang keterlaksanaan rekomendasi.', bukti_list: [
                { id: 'D.4.3.2.1', nama: 'Dokumen rekomendasi hasil perbaikan sistem penilaian hasil belajar' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.3', pertanyaan: 'Melaksanakan pembinaan guru sebagai tindak lanjut.', bukti_list: [
                { id: 'D.4.3.3.1', nama: 'Laporan tindak lanjut supervisi' },
                { id: 'D.4.3.3.2', nama: 'Program PKB guru' },
                { id: 'D.4.3.3.3', nama: 'Laporan kegiatan pembinaan guru' },
                { id: 'D.4.3.3.4', nama: 'Daftar hadir, notulen, foto kegiatan PKB guru' }
            ], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.4', pertanyaan: 'Menggunakan data hasil supervisi untuk pemetaan.', bukti_list: [
                { id: 'D.4.3.4.1', nama: 'Program PKB guru' },
                { id: 'D.4.3.4.2', nama: 'Laporan kegiatan pembinaan guru' },
                { id: 'D.4.3.4.3', nama: 'Daftar hadir, notulen, foto kegiatan PKB guru' }
            ], penugasan: timD },
            { aspek_id: 'aspek_E', kode: 'E.5.1.1', pertanyaan: 'Prestasi akademik peserta didik.', bukti_list: [
                { id: 'E.5.1.1.1', nama: 'Piagam/sertifikat kejuaraan akademik (tingkat kecamatan s.d. nasional)' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.1.2', pertanyaan: 'Prestasi non akademik peserta didik.', bukti_list: [
                { id: 'E.5.1.2.1', nama: 'Piagam/sertifikat kejuaraan nonakademik (tingkat kecamatan s.d. nasional)' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.1', pertanyaan: 'Prestasi akademik pendidik dan tendik.', bukti_list: [
                { id: 'E.5.2.1.1', nama: 'Piagam/sertifikat kejuaraan akademik GTK' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.2', pertanyaan: 'Prestasi non akademik pendidik dan tendik.', bukti_list: [
                { id: 'E.5.2.2.1', nama: 'Piagam/sertifikat kejuaraan nonakademik GTK' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.1', pertanyaan: 'Kelebihan prestasi akademik dari madrasah lain.', bukti_list: [
                { id: 'E.5.3.1.1', nama: 'Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.2', pertanyaan: 'Kelebihan prestasi non akademik dari madrasah lain.', bukti_list: [
                { id: 'E.5.3.2.1', nama: 'Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.3', pertanyaan: 'Kelebihan prestasi akademik dan non akademik GTK.', bukti_list: [
                { id: 'E.5.3.3.1', nama: 'Dokumen peringkat GTK' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.1', pertanyaan: 'Ijazah yang dimiliki kepala madrasah.', bukti_list: [
                { id: 'E.5.4.1.1', nama: 'Fotokopi Ijazah terakhir Kepala Madrasah (S1/S2/S3)' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.2', pertanyaan: 'Pendidikan dan pelatihan yang pernah diikuti.', bukti_list: [
                { id: 'E.5.4.2.1', nama: 'Sertifikat STTPL/Diklat minimal 3 buah' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.3', pertanyaan: 'Penguasaan ICT kepala madrasah.', bukti_list: [
                { id: 'E.5.4.3.1', nama: 'Sertifikat pelatihan Microsoft Office/Internet' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.4', pertanyaan: 'Prestasi yang diraih oleh kepala madrasah.', bukti_list: [
                { id: 'E.5.4.4.1', nama: 'Piagam/sertifikat kejuaraan kepala madrasah' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.5', pertanyaan: 'Kegiatan penelitian kependidikan.', bukti_list: [
                { id: 'E.5.4.5.1', nama: 'Laporan Penelitian Tindakan Sekolah (PTS)/Karya Tulis Ilmiah' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.6', pertanyaan: 'Kegiatan pelibatan komite.', bukti_list: [
                { id: 'E.5.4.6.1', nama: 'Dokumentasi pelibatan komite dan stakeholder' }
            ], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.7', pertanyaan: 'Kegiatan kemitraan dengan stakeholder.', bukti_list: [
                { id: 'E.5.4.7.1', nama: 'Dokumen kemitraan dengan stakeholder pendidikan' }
            ], penugasan: timE }
        ];
        
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }
        
        const totalSubBukti = indikatorList.reduce((sum, ind) => sum + (ind.bukti_list?.length || 0), 0);
        alert(`✅ Setup Data Berhasil!\n\n📊 Total Indikator: ${indikatorList.length}\n📋 Total Sub-Bukti: ${totalSubBukti}\n\n- Dimensi A: ${indikatorList.filter(i=>i.aspek_id==='aspek_A').reduce((s,i)=>s+(i.bukti_list?.length||0),0)} sub-bukti\n- Dimensi B: ${indikatorList.filter(i=>i.aspek_id==='aspek_B').reduce((s,i)=>s+(i.bukti_list?.length||0),0)} sub-bukti\n- Dimensi C: ${indikatorList.filter(i=>i.aspek_id==='aspek_C').reduce((s,i)=>s+(i.bukti_list?.length||0),0)} sub-bukti\n- Dimensi D: ${indikatorList.filter(i=>i.aspek_id==='aspek_D').reduce((s,i)=>s+(i.bukti_list?.length||0),0)} sub-bukti\n- Dimensi E: ${indikatorList.filter(i=>i.aspek_id==='aspek_E').reduce((s,i)=>s+(i.bukti_list?.length||0),0)} sub-bukti\n\nSilakan refresh halaman.`);
        location.reload();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};
