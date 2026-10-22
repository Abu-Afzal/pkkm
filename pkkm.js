// ══════════════════════════════════════════════
// PKKM DIGITAL - SINGLE LINK (HYBRID MODE)
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
// const storage = firebase.storage(); // Dinonaktifkan karena hanya menggunakan Firestore

let userData = null; // Null = Tamu
let pkkmData = [];
let allUsers = [];
let currentIndikatorId = null;

// ═════════════════════════════════════════════
// 1. INIT & AUTH STATE
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadPKKMData(); // Load data untuk semua orang
    
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
                    uid: user.uid,
                    email: user.email,
                    nama: dbData.nama || user.email.split('@')[0],
                    role: dbData.role || 'guru',
                    docId: docId
                };
                
                console.log('✅ User ditemukan:', userData.nama, '| Role:', userData.role);
                
                updateUIForLoggedInUser();
                renderDashboard();
                
                if (userData.role === 'admin' || userData.role === 'kepala') {
                    loadAdminData();
                }
            }).catch(err => {
                console.error('Error fetching user:', err);
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
// 2. TAB NAVIGATION
// ═════════════════════════════════════════════
window.switchMainTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(`tab-${tabName}`);
    const selectedBtn = document.getElementById(`tabBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active');
    }
    
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
};

// ══════════════════════════════════════════════
// 3. LOAD DATA & RENDER DASHBOARD
// ══════════════════════════════════════════════
async function loadPKKMData() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').get();
        const uploadsSnapshot = await db.collection('pkkm_uploads').get();

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
                                    <div style="font-size: 0.8rem; color: #64748b; margin: 4px 0;">
                                        <strong>Penanggung Jawab:</strong> ${ind.penugasan ? ind.penugasan.join(', ') : '-'}
                                    </div>
                                    ${hasUpload ? `
                                        <div style="margin-top: 8px; padding: 8px; background: #f0fdf4; border-radius: 4px; font-size: 0.85rem;">
                                            <i class="fas fa-check-circle" style="color: #10b981;"></i> 
                                            <strong>${lastUpload.file_name}</strong> 
                                            <span style="color: #64748b;">- diupload oleh ${lastUpload.guru_nama}</span>
                                        </div>
                                    ` : `
                                        <div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;"><i class="fas fa-clock"></i> Belum ada dokumen</div>
                                    `}
                                </div>
                                <div style="flex-shrink: 0; margin-left: 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                                    ${hasUpload ? `
                                        <a href="${lastUpload.file_base64 || lastUpload.file_url}" download="${lastUpload.file_name}" target="_blank" style="text-decoration: none; width: 100px;">
                                            <button class="btn" style="background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100%;">
                                                <i class="fas fa-download"></i> Download
                                            </button>
                                        </a>
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
                                        <a href="${lastUpload.file_base64 || lastUpload.file_url}" target="_blank" style="text-decoration: none; width: 100px;">
                                            <button class="btn" style="background: #6366f1; color: white; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; width: 100%;">
                                                <i class="fas fa-eye"></i> Preview
                                            </button>
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ══════════════════════════════════════════════
// 4. UI STATE (GUEST vs LOGIN)
// ══════════════════════════════════════════════
function updateUIForGuest() {
    const guestBadge = document.getElementById('guestBadge');
    const userInfo = document.getElementById('userInfo');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    
    if (guestBadge) guestBadge.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
    
    const navTabs = document.getElementById('mainNavTabs');
    if (navTabs) navTabs.style.display = 'none';
    
    const tabBtnAdmin = document.getElementById('tabBtnAdmin');
    if (tabBtnAdmin) tabBtnAdmin.style.display = 'none';
    
    const tabAdmin = document.getElementById('tab-admin');
    if (tabAdmin) {
        tabAdmin.style.display = 'none';
        tabAdmin.classList.remove('active');
    }
    
    const tabDashboard = document.getElementById('tab-dashboard');
    if (tabDashboard) {
        tabDashboard.style.display = 'block';
        tabDashboard.classList.add('active');
    }
}

function updateUIForLoggedInUser() {
    const guestBadge = document.getElementById('guestBadge');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    
    if (guestBadge) guestBadge.style.display = 'none';
    if (userInfo) userInfo.style.display = 'block';
    if (userName) userName.textContent = userData.nama;
    if (userRole) userRole.textContent = userData.role.toUpperCase();
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-block';
    
    const navTabs = document.getElementById('mainNavTabs');
    if (navTabs) navTabs.style.display = 'flex';
    
    const tabBtnAdmin = document.getElementById('tabBtnAdmin');
    if (tabBtnAdmin) {
        if (userData.role === 'admin' || userData.role === 'kepala') {
            tabBtnAdmin.style.display = 'inline-block';
        } else {
            tabBtnAdmin.style.display = 'none';
        }
    }
    
    switchMainTab('dashboard');
}

// ══════════════════════════════════════════════
// 5. LOGIN / LOGOUT
// ══════════════════════════════════════════════
window.openLoginModal = () => {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
};

window.closeLoginModal = () => {
    const modal = document.getElementById('loginModal');
    const errorDiv = document.getElementById('loginError');
    if (modal) modal.classList.remove('active');
    if (errorDiv) errorDiv.style.display = 'none';
};

window.doLogin = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeLoginModal();
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = '❌ ' + error.message;
            errorDiv.style.display = 'block';
        }
    }
};

window.logout = () => auth.signOut();

window.closeModal = () => {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.classList.remove('active');
};

// ══════════════════════════════════════════════
// 6. UPLOAD LOGIC (BASE64 UNTUK FIRESTORE)
// ═════════════════════════════════════════════
window.openUploadModal = (indId, kode, pertanyaan, bukti) => {
    if (!userData) { alert('Silakan login terlebih dahulu!'); return; }
    currentIndikatorId = indId;
    
    const titleEl = document.getElementById('modalIndikatorTitle');
    const buktiEl = document.getElementById('modalBuktiTitle');
    const fileNameEl = document.getElementById('fileNameDisplay');
    const fileInput = document.getElementById('fileInput');
    const modal = document.getElementById('uploadModal');
    
    if (titleEl) titleEl.textContent = `${kode} - ${pertanyaan}`;
    if (buktiEl) buktiEl.textContent = `Bukti: ${bukti}`;
    if (fileNameEl) fileNameEl.textContent = '';
    if (fileInput) fileInput.value = '';
    if (modal) modal.classList.add('active');
};

window.handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || !userData) return;
    
    // ✅ BATAS MAKSIMAL 500 KB agar aman di bawah batas 1MB Firestore
    const maxSize = 500 * 1024; 
    if (file.size > maxSize) { 
        alert(`⚠️ Ukuran file terlalu besar!\n\nMaksimal: 500 KB\nUkuran file Anda: ${(file.size / 1024).toFixed(1)} KB\n\nSilakan kompres file PDF/Gambar Anda terlebih dahulu.`); 
        return; 
    }

    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay) fileNameDisplay.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload...`;
    
    try {
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        const existing = await db.collection('pkkm_uploads')
            .where('indikator_id', '==', currentIndikatorId)
            .where('guru_uid', '==', userData.uid)
            .get();

        const data = {
            indikator_id: currentIndikatorId,
            guru_uid: userData.uid,
            guru_nama: userData.nama,
            file_name: file.name,
            file_base64: base64String,
            file_size: (file.size / 1024).toFixed(1) + ' KB',
            file_type: file.type,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!existing.empty) {
            await existing.docs[0].ref.update(data);
        } else {
            data.uploaded_at = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('pkkm_uploads').add(data);
        }

        alert("✅ Upload berhasil!");
        closeModal();
        loadPKKMData();
    } catch (error) {
        console.error('Upload error:', error);
        alert("❌ Gagal upload: " + error.message);
        if (fileNameDisplay) fileNameDisplay.textContent = '';
    }
};

// ══════════════════════════════════════════════
// 7. ADMIN FUNCTIONS
// ══════════════════════════════════════════════
function checkAdminAccess() {
    if (!userData) {
        alert('⛔ Akses ditolak! Silakan login terlebih dahulu.');
        return false;
    }
    if (userData.role !== 'admin' && userData.role !== 'kepala') {
        alert('⛔ Akses ditolak! Hanya Administrator atau Kepala Madrasah yang dapat mengakses fitur ini.');
        return false;
    }
    return true;
}

async function loadAdminData() {
    try {
        const usersSnapshot = await db.collection('users').get();
        allUsers = [];
        usersSnapshot.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
        allUsers.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        
        renderAdminUsersTable();
        renderAdminAssignments();
    } catch (error) {
        console.error("Error loading admin data:", error);
    }
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
                ${user.password ? 
                    `<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; font-family: monospace;">${user.password}</span>` : 
                    `<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Belum diset</span>`
                }
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                <span style="background: ${user.role === 'admin' ? '#ef4444' : user.role === 'kepala' ? '#0891b2' : '#10b981'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">
                    ${(user.role || 'guru').toUpperCase()}
                </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 4px;">
                ${!user.password ? `
                    <button onclick="setPassword('${user.uid}', '${user.email}')" class="btn btn-warning" style="background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Set Password">
                        <i class="fas fa-key"></i>
                    </button>
                ` : ''}
                <button onclick="deleteUser('${user.uid}')" class="btn btn-danger" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

window.setPassword = async function(userId, email) {
    const newPassword = prompt(`Masukkan password baru untuk ${email}:\n(Minimal 6 karakter)`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
        alert('❌ Password minimal 6 karakter!');
        return;
    }
    if (!confirm(`⚠️ Set password "${newPassword}" untuk ${email}?\n\nCatatan: Password akan disimpan di database untuk ditampilkan di tabel.`)) {
        return;
    }
    try {
        await db.collection('users').doc(userId).update({ password: newPassword });
        alert(`✅ Password untuk ${email} berhasil diset!\n\nPassword: ${newPassword}`);
        loadAdminData();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};

window.exportUsersToExcel = function() {
    if (allUsers.length === 0) {
        alert('Tidak ada data user untuk diekspor!');
        return;
    }
    
    let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8">
        <style>
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #0891b2; color: white; font-weight: bold; padding: 12px; border: 1px solid #ddd; text-align: left; }
            td { padding: 10px; border: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .role-admin { background-color: #fee2e2; color: #dc2626; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-align: center; }
            .role-guru { background-color: #d1fae5; color: #059669; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-align: center; }
            .password { background-color: #fef3c7; color: #d97706; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-align: center; font-family: monospace; }
        </style></head><body><table>
            <thead><tr><th>No</th><th>Nama Lengkap</th><th>Email</th><th>Password</th><th>Role</th></tr></thead><tbody>
    `;
    
    allUsers.forEach((user, index) => {
        const roleClass = user.role === 'admin' ? 'role-admin' : 'role-guru';
        htmlContent += `<tr>
            <td>${index + 1}</td>
            <td>${user.nama || ''}</td>
            <td>${user.email || ''}</td>
            <td class="password">${user.password || ''}</td>
            <td class="${roleClass}">${(user.role || 'guru').toUpperCase()}</td>
        </tr>`;
    });
    
    htmlContent += `</tbody></table></body></html>`;
    
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daftar_User_PKKM_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    alert(`✅ Berhasil mengunduh ${allUsers.length} user! File siap untuk dicetak ke PDF.`);
};

window.deleteUser = async function(userId) {
    if (!checkAdminAccess()) return;
    if (!confirm('⚠️ Yakin ingin menghapus user ini dari database?')) return;
    try {
        await db.collection('users').doc(userId).delete();
        alert('✅ User dihapus dari database.');
        loadAdminData();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};

function renderAdminAssignments() {
    const filter = document.getElementById('filterDimensi').value;
    const container = document.getElementById('adminAssignmentList');
    if (!container) return;
    
    let filteredIndicators = [];
    pkkmData.forEach(aspek => {
        if (filter === 'all' || aspek.kode === filter) {
            filteredIndicators.push(...aspek.indikator);
        }
    });
    
    if (filteredIndicators.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">Belum ada data. Klik "Jalankan Setup Data" terlebih dahulu.</p>';
        return;
    }
    
    container.innerHTML = filteredIndicators.map(ind => `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: white;">
            <div style="font-weight: 700; color: #0e7490; margin-bottom: 8px;">${ind.kode} - ${ind.pertanyaan}</div>
            <div style="margin-bottom: 12px;">
                <strong style="font-size: 0.9rem;">Pilih Penanggung Jawab:</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 8px;">
                    ${allUsers.filter(u => u.role !== 'admin').map(user => `
                        <label style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8fafc; border-radius: 4px; cursor: pointer;">
                            <input type="checkbox" value="${user.nama}" ${ind.penugasan && ind.penugasan.includes(user.nama) ? 'checked' : ''}>
                            <span style="font-size: 0.9rem;">${user.nama}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <button onclick="saveAssignment('${ind.id}', this)" class="btn btn-primary" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;"><i class="fas fa-save"></i> Simpan Penugasan</button>
        </div>
    `).join('');
}

window.saveAssignment = async function(indikatorId, btn) {
    if (!checkAdminAccess()) return;
    const container = btn.closest('div');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const penugasan = Array.from(checkboxes).map(cb => cb.value);
    
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
        await db.collection('pkkm_indikator').doc(indikatorId).update({
            penugasan: penugasan,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Penugasan berhasil disimpan!');
        loadPKKMData();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    } finally {
        btn.disabled = false; 
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penugasan';
    }
};

// ══════════════════════════════════════════════
// 8. SETUP DATA AWAL (ADMIN ONLY)
// ══════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (!checkAdminAccess()) return;
    if (!confirm('⚠️ Ini akan mengisi database dengan SEMUA indikator PKKM lengkap. Lanjutkan?')) return;
    
    try {
        const aspekList = [
            { kode: 'A', nama: 'Usaha Pengembangan Madrasah' },
            { kode: 'B', nama: 'Pelaksanaan Tugas Manajerial' },
            { kode: 'C', nama: 'Pengembangan Kewirausahaan' },
            { kode: 'D', nama: 'Supervisi Kepada Guru dan Tenaga Kependidikan' },
            { kode: 'E', nama: 'Hasil Kinerja Kepala Madrasah' }
        ];
        
        for (const asp of aspekList) {
            await db.collection('pkkm_aspek').doc(`aspek_${asp.kode}`).set(asp);
        }
        
        const timA = ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'];
        const timB = ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd'];
        const timC = ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I'];
        const timD = ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I'];
        const timE = ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I'];
        
        const indikatorList = [
            { aspek_id: 'aspek_A', kode: 'A.1.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.', bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat keputusan tentang penyusunan struktur organisasi', 'Dokumen sosialisasi', 'Daftar hadir'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.2', pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.', bukti_diharapkan: ['Dokumen penetapan/pengesahan susunan organisasi madrasah', 'Rincian tugas setiap personil pada struktur organisasi madrasah', 'Sertifikat', 'SOP Personalia'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.', bukti_diharapkan: ['Dokumen SOP madrasah/pedoman Sistem Informasi Madrasah'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.1', pertanyaan: 'Mampu mengembangkan program baru untuk meningkatkan pencapaian target yang lebih tinggi.', bukti_diharapkan: ['Visi dan misi madrasah', 'Data prestasi madrasah', 'Data hasil UN 3 tahun terakhir', 'Data alumni', 'RKJM'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.2', pertanyaan: 'Mampu dan terampil dalam membangun tim kerja yang efektif untuk mendapatkan produk kinerja yang lebih unggul.', bukti_diharapkan: ['Bagan/struktur organisasi', 'SK', 'Tugas dan fungsi', 'Pedoman monitoring dan evaluasi kerja', 'Pedoman reward dan punishment'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.3', pertanyaan: 'Mampu menerapkan berbagai teknik pembaharuan dalam pengelolaan pembelajaran.', bukti_diharapkan: ['Dokumen kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Penilaian', 'Peraturan akademik', 'Notulen diskusi evaluasi rutin pembelajaran'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2.4', pertanyaan: 'Mampu mengembangkan potensi dan meningkatkan prestasi madrasah.', bukti_diharapkan: ['Data prestasi madrasah 1 tahun terakhir', 'Data hasil UN 1 tahun terakhir', 'Dokumen akreditasi', 'Program ekstrakurikuler', 'Program unggulan madrasah'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.1', pertanyaan: 'Merencanakan kerjasama dengan lembaga pemerintah, swasta dan masyarakat.', bukti_diharapkan: ['SK komite madrasah', 'AD/ART komite madrasah', 'Program kerja komite madrasah', 'Laporan kegiatan komite madrasah', 'Dokumen tertulis kerja sama (MoU)', 'Foto-foto', 'Sertifikat/plakat kerja sama', 'Laporan kegiatan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.2', pertanyaan: 'Melakukan pendekatan-pendekatan dalam rangka mendapatkan dukungan dari lembaga pemerintah, swasta dan masyarakat.', bukti_diharapkan: ['Program kegiatan kerjasama', 'Foto kegiatan', 'Jadwal kegiatan', 'Laporan kegiatan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3.3', pertanyaan: 'Memanfaatkan dan memelihara hubungan kerjasama dengan lembaga pemerintah, swasta dan masyarakat.', bukti_diharapkan: ['Laporan kegiatan kerja', 'Laporan monitoring/evaluasi kegiatan', 'Dokumentasi foto/video pelaksanaan kerjasama'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.1', pertanyaan: 'Mengaplikasikan pengembangan kurikulum yang mengacu kepada standar isi.', bukti_diharapkan: ['Kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Pedoman penilaian', 'Peraturan akademik', 'Buku kerja guru', 'Dokumen rapat penyusunan kurikulum (daftar hadir, daftar peserta, foto)'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.2', pertanyaan: 'Mengaplikasikan pengembangan proses pembelajaran yang mengacu kepada standar proses.', bukti_diharapkan: ['Dokumen pengembangan silabus', 'RPP', 'Struktur Kurikulum', 'Pembagian jam mengajar', 'Jadwal mengajar', 'RPE', 'Buku teks', 'Jurnal mengajar guru', 'Data siswa per kelas', 'Dokumen supervisi (laporan pemantauan pembelajaran, laporan supervisi, laporan evaluasi pembelajaran dan rencana tindak lanjut)'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.3', pertanyaan: 'Mengaplikasikan sistem penilaian pembelajaran yang mengacu kepada standar penilaian.', bukti_diharapkan: ['Instrumen penilaian', 'Kisi-kisi soal', 'Kumpulan naskah soal', 'Analisis butir soal', 'Dokumen analisis hasil belajar siswa', 'Laporan hasil belajar siswa', 'Tindak lanjut hasil penilaian', 'Dokumen pelaksanaan PAS', 'Dokumen pelaksanaan PAT'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.4.4', pertanyaan: 'Melaksanakan penjaminan mutu pencapaian standar kompetensi lulusan.', bukti_diharapkan: ['Dokumen program kegiatan kesiswaan', 'Laporan kegiatan kesiswaan', 'Dokumentasi kegiatan kesiswaan', 'Laporan kegiatan pembiasaan siswa', 'Dokumen kegiatan literasi', 'Data rata-rata hasil ujian 2 tahun terakhir', 'Data prestasi akademik 2 tahun akademik', 'Data prestasi non akademik 2 tahun terakhir'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.1', pertanyaan: 'Mampu mengelola laboratorium madrasah agar dapat dimanfaatkan secara optimal untuk kepentingan pembelajaran peserta didik.', bukti_diharapkan: ['Luas sesuai standar', 'Sarana pendukung laboratorium', 'Program kerja laboratorium', 'Jurnal dan laporan pengelolaan laboratorium'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah dalam menyiapkan sumber belajar yang diperlukan oleh peserta didik.', bukti_diharapkan: ['Luas sesuai standar', 'Sarana pendukung', 'Daftar buku induk perpustakaan', 'Laporan pengelolaan perpustakaan', 'Program kerja perpustakaan'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.3', pertanyaan: 'Mampu mengelola usaha madrasah untuk pembelajaran peserta didik dan pemasukan tambahan dana bagi madrasah.', bukti_diharapkan: ['Data/laporan kegiatan usaha madrasah', 'Dokumentasi kegiatan (foto/video)'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.5.4', pertanyaan: 'Mampu mengelola koperasi madrasah baik sebagai media praktik maupun sebagai sumber belajar bagi peserta didik.', bukti_diharapkan: ['Instrumen hasil praktik pembelajaran', 'Foto kegiatan praktik', 'AD/ART koperasi', 'Laporan RAT'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.1', pertanyaan: 'Memanfaatkan teknologi informasi dan komunikasi dalam manajemen madrasah.', bukti_diharapkan: ['Fasilitas teknologi dan informasi', 'Sumber daya informasi', 'Website madrasah', 'Pedoman sistem informasi madrasah'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.2', pertanyaan: 'Memanfaatkan teknologi informasi dan komunikasi dalam pembelajaran, baik sebagai sumber belajar maupun sebagai alat/media pembelajaran.', bukti_diharapkan: ['Ketersediaan komputer', 'Jaringan internet', 'Website madrasah', 'Alamat email madrasah', 'Pemanfaatan TIK untuk pembelajaran (observasi/wawancara)'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.3', pertanyaan: 'Memanfaatkan teknologi informasi dan komunikasi dalam menjalin kerjasama dengan pihak lain.', bukti_diharapkan: ['Pengelola SIM', 'Fasilitas SIM', 'Surat tugas pengelola SIM', 'Pelaporan data dan informasi', 'Program promosi', 'Observasi dan wawancara'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.6.4', pertanyaan: 'Memanfaatkan teknologi informasi dan komunikasi dalam promosi program madrasah dan prestasi yang telah dicapai.', bukti_diharapkan: ['Pengelola SIM', 'Fasilitas SIM', 'Surat tugas pengelola SIM', 'Pelaporan data dan informasi', 'Program informasi', 'Observasi dan wawancara'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.1', pertanyaan: 'Mampu mengembangkan sistem administrasi pengelolaan secara efektif dengan dukungan penerapan teknologi informasi dan komunikasi.', bukti_diharapkan: ['Jumlah komputer dan LCD yang cukup', 'Memiliki jaringan internet', 'Memiliki web sekolah', 'Memiliki email madrasah', 'Laporan absensi elektronik', 'Dokumen lain pemanfaatan TIK untuk administrasi madrasah'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.2', pertanyaan: 'Mengelola administrasi pembelajaran secara efektif dengan dukungan penerapan teknologi informasi dan komunikasi.', bukti_diharapkan: ['Jumlah komputer dan LCD yang cukup', 'Memiliki jaringan internet', 'Pemanfaatan TIK untuk pembelajaran (seperti Edmodo, Google Classroom, dll)', 'Pengelolaan penilaian secara online'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.7.3', pertanyaan: 'Mampu mengembangkan sistem pengelolaan perpustakaan secara efektif dengan dukungan penerapan teknologi informasi dan komunikasi.', bukti_diharapkan: ['Katalog', 'BSE', 'Akses internet', 'Komputer', 'Dokumen aplikasi layanan perpustakaan'], penugasan: timA },
            { aspek_id: 'aspek_B', kode: 'B.2.1.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM dengan program lainnya berdasarkan data hasil evaluasi dalam pemenuhan 8 SNP.', bukti_diharapkan: ['Dokumen Evaluasi diri madrasah', 'Dokumen RKJM dan RKT berbasis SDM'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.2', pertanyaan: 'Mampu merumuskan visi-misi sebagai arah pengembangan program RKJM, RKT/RKAS dan program lainnya.', bukti_diharapkan: ['Visi misi yang telah ditetapkan oleh Kamad', 'Berita acara dan daftar hadir kegiatan perumusan atau peninjauan kembali dan penetapan visi misi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.3', pertanyaan: 'Mampu menentukan strategi pencapaian tujuan madrasah, dilengkapi dengan indikator pencapaian yang terukur.', bukti_diharapkan: ['Program kerja', 'RKJM dan RKTM'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.1.4', pertanyaan: 'Mampu menyusun program dengan rencana evaluasi keterlaksanaan dan pencapaian program.', bukti_diharapkan: ['RKJM dan RKTM', 'Rencana/program evaluasi dan monitoring'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.1', pertanyaan: 'Mampu memberi contoh berdisiplin; hadir tepat waktu, disiplin menggunakan waktu, dan tepat waktu mengakhiri pekerjaan.', bukti_diharapkan: ['Daftar hadir elektronik kamad', 'Daftar hadir pada kegiatan di madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.2', pertanyaan: 'Mampu melaksanakan peraturan sesuai dengan ketentuan yang berlaku.', bukti_diharapkan: ['Wawancara dengan warga madrasah', 'Laporan kehadiran', 'Notulen rapat/briefing pengarahan kegiatan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.3', pertanyaan: 'Mampu menunjukkan keteladanan dalam memanfaatkan sumber daya secara efektif dan efisien.', bukti_diharapkan: ['Wawancara dengan warga madrasah', 'Dokumen monitoring dan evaluasi pemanfaatan sumber belajar', 'Notulensi rapat/diskusi pemanfaatan sumber belajar'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.2.4', pertanyaan: 'Mampu menunjukkan kedisiplinan sebagai insan pembelajar.', bukti_diharapkan: ['Koleksi buku referensi/ilmu pengetahuan', 'Karya tulis yang diterbitkan atau tidak', 'Majalah/koran madrasah', 'Website madrasah', 'Blog pribadi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.1', pertanyaan: 'Mampu menjadi contoh dan berbudaya mutu yang kompetitif dalam mendorong peningkatan prestasi akademik dan nonakademik peserta didik.', bukti_diharapkan: ['Peningkatan KKM', 'Hasil UN', 'Program keunggulan dan inovasi baik akademik maupun non akademik', 'Data prestasi akademik dan non akademik'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.2', pertanyaan: 'Mampu melengkapi sarana dan prasarana untuk menciptakan suasana belajar kondusif dan inovatif bagi peserta didik.', bukti_diharapkan: ['Observasi lingkungan madrasah; suasana lingkungan yang asri bersih rindang aman dan menyenangkan peserta didik'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.3', pertanyaan: 'Mampu memfasilitasi kegiatan-kegiatan untuk meningkatkan budaya baca dan budaya tulis peserta didik.', bukti_diharapkan: ['Rencana dan laporan pelaksanaan kegiatan literasi', 'Dokumen kegiatan pengembangan budaya baca', 'Dokumen/pajangan hasil karya tulis siswa', 'Data kunjungan perpustakaan', 'Data peminjaman buku perpustakaan', 'Observasi/wawancara'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.3.4', pertanyaan: 'Mampu memfasilitasi kegiatan-kegiatan lomba di bidang akademik dan nonakademik bagi peserta didik.', bukti_diharapkan: ['Dokumen penyelenggaraan kegiatan kompetisi yang dimulai dari tingkat madrasah', 'Daftar perolehan piagam, penghargaan, piala, trofi perlombaan di semua jenjang'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.1', pertanyaan: 'Mampu menyusun perencanaan pengembangan pendidik dan tenaga kependidikan.', bukti_diharapkan: ['Program kerja kepala madrasah', 'Laporan kegiatan workshop/pelatihan kompetisi guru', 'Dokumentasi (foto/video) kegiatan workshop atau pelatihan guru'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.2', pertanyaan: 'Mampu melakukan pembinaan berkala untuk meningkatkan mutu SDM madrasah.', bukti_diharapkan: ['Buku/catatan pembinaan guru dan tendik', 'Notulen dan daftar hadir rapat pembinaan', 'Laporan kinerja kepala madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.3', pertanyaan: 'Memfasilitasi guru dan staf administrasi untuk meningkatkan kegiatan pembinaan kompetensi.', bukti_diharapkan: ['Buku/catatan pembinaan guru dan tendik', 'Notulen dan daftar hadir rapat pembinaan', 'Laporan kinerja kepala madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.4.4', pertanyaan: 'Memantau dan menilai penerapan hasil pelatihan dalam pekerjaan di madrasah.', bukti_diharapkan: ['Program pelatihan pengembangan profesi guru dan tendik', 'Laporan pelaksanaan pelatihan pengembangan profesi guru dan tendik'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.1', pertanyaan: 'Mampu mengelola fasilitas prasarana, perabot dan sarana madrasah (gedung, bangunan, dan lahan meja, kursi, lemari, peralatan kantor, dan alat kebersihan).', bukti_diharapkan: ['Buku Inventaris', 'Buku pemeliharaan sarana dan prasarana'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.2', pertanyaan: 'Mampu mengelola perpustakaan madrasah.', bukti_diharapkan: ['Buku induk perpustakaan', 'Buku data grafik layanan perpustakaan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.3', pertanyaan: 'Mampu mengelola laboratorium madrasah.', bukti_diharapkan: ['Daftar inventaris laboratorium', 'Buku/jurnal/data/grafik layanan laboratorium'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.5.4', pertanyaan: 'Mampu mengelola fasilitas penunjang madrasah lainnya (bengkel, toko, koperasi, kebun, dsb).', bukti_diharapkan: ['Data fasilitas penunjang wirausaha yang dikelola oleh madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.1', pertanyaan: 'Menyusun perencanaan penerimaan, pengelolaan dan pengembangan kompetensi peserta didik.', bukti_diharapkan: ['Dokumen program penerimaan peserta didik baru', 'Brosur', 'Data hasil analisis kemampuan peserta didik baru', 'Hasil psikotes minat bakat peserta didik baru'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.2', pertanyaan: 'Memiliki program pengembangan potensi diri dan prestasi peserta didik.', bukti_diharapkan: ['Program pengembangan diri peserta didik baik akademik maupun non akademik', 'Laporan pengembangan diri peserta didik akademik maupun non akademik'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.3', pertanyaan: 'Memfasilitasi kegiatan-kegiatan untuk meningkatkan pembiasaan melalui penanaman nilai-nilai.', bukti_diharapkan: ['Program kegiatan akademik dan non akademik dan laporan', 'Laporan kegiatan pembiasaan diri peserta didik', 'Dokumentasi kegiatan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.6.4', pertanyaan: 'Memfasilitasi kegiatan pengembangan diri bagi peserta didik, pendidik, dan tenaga kependidikan lainnya secara optimal.', bukti_diharapkan: ['Program kegiatan pengembangan diri', 'Dokumen kegiatan', 'Data prestasi siswa guru dan tendik'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.1', pertanyaan: 'Mampu mengarahkan secara efektif dalam menerapkan prinsip-prinsip pengembangan KTSP dalam kegiatan IHT, Workshop, Rapat Koordinasi, dan kegiatan MGMP/KKG.', bukti_diharapkan: ['Dokumen kurikulum yang berlaku', 'SK tim pengembangan kurikulum', 'Dokumen penyusunan dokumen kurikulum daftar hadir berita acara notulen', 'Laporan kegiatan workshop rakor pengembangan kurikulum'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.2', pertanyaan: 'Mampu mengendalikan pelaksanaan KTSP berlandaskan kalender pendidikan, menerbitkan surat keputusan pembagian tugas mengajar, dan menerapkan aturan akademik.', bukti_diharapkan: ['Struktur kurikulum', 'Jadwal pelajaran', 'Daftar hadir guru', 'Peraturan akademik', 'Kalender pendidikan', 'SK pembagian tugas mengajar'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.3', pertanyaan: 'Memfasilitasi efektivitas tim kerja guru dalam rangka meningkatkan mutu pembelajaran.', bukti_diharapkan: ['Program KKG/MGMP di madrasah', 'Laporan pelaksanaan KKG/MGMP', 'Dokumentasi kegiatan (foto/video)'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.4', pertanyaan: 'Mampu mengembangkan pelayanan belajar yang inovatif melalui pengembangan perangkat dan sumber belajar yang terbarukan.', bukti_diharapkan: ['Observasi kelas studi dokumen wawancara dengan siswa dan guru', 'Menelaah ragam metode media dan sumber belajar yang digunakan dalam RPP'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.7.5', pertanyaan: 'Memfasilitasi peserta didik dalam mengembangkan kolaborasi dan kompetisi bidang akademik dan nonakademik.', bukti_diharapkan: ['Program laporan dan dokumen kegiatan kesiswaan (kegiatan akademik dan non akademik)', 'Data prestasi akademik maupun non akademik', 'Dokumentasi kegiatan (laporan, foto, video dll)'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.1', pertanyaan: 'Mampu merencanakan kebutuhan keuangan madrasah sesuai dengan rencana pengembangan madrasah, baik jangka pendek maupun jangka panjang.', bukti_diharapkan: ['RKJM dan RKTM', 'Rencana anggaran', 'Laporan keuangan', 'Buku kas'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.2', pertanyaan: 'Mampu mengupayakan sumber-sumber keuangan terutama dari luar madrasah dan dari unit usaha madrasah.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.3', pertanyaan: 'Mampu mengkoordinasikan pengelolaan keuangan sesuai dengan peraturan dan perundang-undangan berdasarkan asas prioritas dan efisiensi.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.8.4', pertanyaan: 'Mampu membuat laporan dan evaluasi pengelolaan keuangan madrasah sesuai dengan prinsip efisien, transparan, dan akuntabel.', bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan', 'Buku kas'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.1', pertanyaan: 'Mampu mengelola administrasi surat masuk dan surat keluar sesuai dengan pedoman persuratan yang berlaku.', bukti_diharapkan: ['Dokumen surat masuk dan keluar'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.2', pertanyaan: 'Mampu mengelola administrasi madrasah yang meliputi administrasi akademik, kesiswaan, sarana/prasarana, keuangan, dan hubungan madrasah dengan masyarakat.', bukti_diharapkan: ['Melalui studi dokumen administrasi akademik kesiswaan sarana dan prasarana keuangan dan hubungan madrasah dengan masyarakat'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.3', pertanyaan: 'Mampu mengelola administrasi kearsipan madrasah baik arsip dinamis maupun arsip lainnya.', bukti_diharapkan: ['Melalui studi dokumen: administrasi madrasah', 'Arsip administrasi', 'SOP administrasi madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.9.4', pertanyaan: 'Mampu mengelola administrasi akreditasi madrasah sesuai dengan prinsip-prinsip tersedianya dokumen pendukung dan bukti fisik.', bukti_diharapkan: ['Dokumen administrasi pemenuhan SNP madrasah'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.1', pertanyaan: 'Menyusun standar kinerja program pendidikan yang dapat diukur dan dinilai.', bukti_diharapkan: ['Dokumen SKP yang terukur'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.2', pertanyaan: 'Melakukan monitoring dan evaluasi kinerja program pendidikan dengan menggunakan teknik yang sesuai.', bukti_diharapkan: ['Dokumen pelaksanaan monitoring dan evaluasi yang sesuai'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.3', pertanyaan: 'Menyusun laporan sesuai dengan standar pelaporan monitoring dan evaluasi.', bukti_diharapkan: ['Dokumen laporan pelaksanaan monitoring dan evaluasi'], penugasan: timB },
            { aspek_id: 'aspek_B', kode: 'B.2.10.4', pertanyaan: 'Merumuskan program tindak lanjut berdasarkan hasil evaluasi pelaksanaan program sebelumnya.', bukti_diharapkan: ['Dokumen laporan pelaksanaan monitoring dan evaluasi'], penugasan: timB },
            { aspek_id: 'aspek_C', kode: 'C.3.1.1', pertanyaan: 'Memahami dan menghayati arti dan tujuan perubahan (inovasi) madrasah.', bukti_diharapkan: ['Program pengembangan kewirausahaan', 'Profil madrasah beberapa tahun terakhir'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.2', pertanyaan: 'Menggunakan metode, teknik dan proses perubahan madrasah.', bukti_diharapkan: ['Melalui observasi: pemanfaatan hasil inovasi dan kreatifitas', 'Membudayakan hasil inovasi dan kreatifitas', 'Pengembangan pembudayaan inovasi dan kreatifitas'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.3', pertanyaan: 'Menumbuhkan iklim yang mendorong kebebasan berpikir untuk menciptakan kreativitas dan inovasi.', bukti_diharapkan: ['Data jenis usaha produktif yang dimiliki', 'Program pengelolaan dan pendayagunaan hasil usaha'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.1.4', pertanyaan: 'Mendorong warga madrasah untuk melakukan prakarsa/keberanian moral untuk melakukan hal-hal baru.', bukti_diharapkan: ['Data jenis usaha produktif yang dimiliki', 'Program pengelolaan dan pendayagunaan hasil usaha'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.1', pertanyaan: 'Mampu bertindak kreatif dan inovatif dalam melaksanakan pekerjaan melalui cara berpikir dan cara bertindak.', bukti_diharapkan: ['RPP yang memuat rencana pembelajaran untuk menumbuhkan keterampilan berpikir dan bertindak kreatif, produktif, kritis, mandiri, kolaboratif dan komunikatif', 'Hasil kerja dan karya siswa', 'Foto-foto aktifitas pembelajaran siswa-siswa'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.2', pertanyaan: 'Mampu memberdayakan potensi madrasah secara optimal ke dalam berbagai kegiatan-kegiatan produktif yang menguntungkan madrasah.', bukti_diharapkan: ['Rencana Pengembangan Madrasah (RPM)', 'Dokumen penanganan permasalahan/kasus', 'Dokumen hasil kegiatan sekolah', 'Dokumen hasil kegiatan pengembangan madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.3', pertanyaan: 'Mampu menumbuhkan jiwa kewirausahaan (kreatif, inovatif dan produktif) di kalangan warga madrasah.', bukti_diharapkan: ['Rencana Pengembangan Madrasah (RPM)', 'Dokumen penanganan permasalahan/kasus', 'Dokumen hasil kegiatan sekolah', 'Dokumen hasil kegiatan pengembangan madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.2.4', pertanyaan: 'Mampu mencatat ide-ide baru, kemudian mengembangkannya.', bukti_diharapkan: ['Melalui observasi, wawancara dan studi dokumen: Rencana Pengembangan Madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.1', pertanyaan: 'Bersedia belajar dari orang lain.', bukti_diharapkan: ['Forum komunikasi dengan lembaga pendidikan lain dan orang tua siswa per tingkat kelas/kelas/angkatan foto-foto kegiatan', 'Komunitas/forum kegiatan yang diikuti'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.2', pertanyaan: 'Ingin selalu melakukan yang terbaik.', bukti_diharapkan: ['Melalui observasi, wawancara dan studi dokumen: dokumen/foto pelaksanaan kegiatan', 'Keikut-sertaan dalam lomba-lomba pembelajaran/pendidikan maupun manajemen prestasi dalam lomba guru, tenaga kependidikan dan kepala madrasah'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.3.3', pertanyaan: 'Menciptakan perubahan yang kuat.', bukti_diharapkan: ['Melalui observasi, wawancara dan studi dokumen: program inovasi madrasah atau Rencana Pengembangan Madrasah (RPM)', 'Laporan target yang sudah dicapai'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.1', pertanyaan: 'Mampu melibatkan tokoh agama, masyarakat, dan pemerintah dalam memecahkan masalah kelembagaan.', bukti_diharapkan: ['Melalui observasi, wawancara dan studi dokumen: MoU dengan pihak lain', 'Sister school kemitraan dengan sekolah lain'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.2', pertanyaan: 'Mampu bersikap obyektif/tidak memihak dalam mengatasi konflik internal madrasah.', bukti_diharapkan: ['Observasi, wawancara dan studi dokumen kegiatan/foto'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.4.3', pertanyaan: 'Mampu bersikap simpatik/tenggang rasa terhadap orang lain.', bukti_diharapkan: ['Observasi, wawancara dan studi dokumen kegiatan dan foto'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.1', pertanyaan: 'Mampu merencanakan kegiatan produksi/jasa sesuai dengan potensi madrasah.', bukti_diharapkan: ['Dokumen laporan yang memuat pelaksanaan dan hasil program pengembangan unit produksi kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.2', pertanyaan: 'Mampu membina kegiatan produksi/jasa sesuai dengan prinsip-prinsip pengelolaan yang professional dan akuntabel.', bukti_diharapkan: ['Dokumen laporan memuat pelaksanaan dan hasil Program Pengembangan Unit Produksi Kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.3', pertanyaan: 'Mampu melaksanakan pengawasan kegiatan produksi/jasa dan menyusun laporan.', bukti_diharapkan: ['Wawancara dan studi dokumen: laporan hasil Evaluasi Program Pengembangan Kewirausahaan yang memuat hasil evaluasi', 'Program Pengembangan Jiwa Kewirausahaan', 'Program Pengembangan Unit Produksi Kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_C', kode: 'C.3.5.4', pertanyaan: 'Mampu mengembangkan kegiatan produksi/jasa dan pemasarannya.', bukti_diharapkan: ['Wawancara dan studi dokumen: laporan hasil Evaluasi Program Pengembangan Kewirausahaan yang memuat hasil evaluasi', 'Program Pengembangan Jiwa Kewirausahaan', 'Program Pengembangan Unit Produksi Kewirausahaan'], penugasan: timC },
            { aspek_id: 'aspek_D', kode: 'D.4.1.1', pertanyaan: 'Mengidentifikasi masalah yang guru hadapi dalam pelaksanaan pembelajaran.', bukti_diharapkan: ['Melalui studi dokumen: program pengawasan pembelajaran/supervisi pembelajaran', 'Jadwal pelaksanaan supervisi', 'SK tim supervisor'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.2', pertanyaan: 'Mampu merumuskan tujuan yang dilengkapi dengan target pencapaian yang terukur.', bukti_diharapkan: ['Studi dokumen: program pengawasan pembelajaran/supervisi pembelajaran', 'Jadwal pelaksanaan supervisi', 'Laporan hasil supervisi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.1.3', pertanyaan: 'Mampu mengembangkan instrumen supervisi.', bukti_diharapkan: ['Studi dokumen: instrumen supervisi pembelajaran'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.1', pertanyaan: 'Mengadakan pertemuan awal untuk menjaring data rencana pembelajaran dan menetapkan fokus kegiatan supervisi.', bukti_diharapkan: ['Wawancara dan studi dokumen: program pengawasan pembelajaran/supervisi pembelajaran', 'Jadwal supervisi', 'Daftar hadir, notulen, foto pertemuan awal supervisi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.2', pertanyaan: 'Melaksanakan kegiatan pemantauan pembelajaran dan membuat catatan yang objektif dan selektif sebagai bahan pemecahan masalah supervisi.', bukti_diharapkan: ['Wawancara dan studi dokumen: instrumen supervisi pembelajaran', 'Laporan hasil supervisi pembelajaran', 'Catatan rekomendasi hasil supervisi', 'Rencana tindak lanjut hasil supervisi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.3', pertanyaan: 'Melakukan pertemuan refleksi, menganalisis catatan hasil observasi, dan menyimpulkan hasil observasi.', bukti_diharapkan: ['Wawancara dan studi dokumen: analisis hasil supervisi pembelajaran', 'Catatan rekomendasi hasil supervisi', 'Daftar hadir, notulen, foto pertemuan, refleksi hasil supervisi'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.2.4', pertanyaan: 'Bersama guru menyusun rekomendasi tindaklanjut perbaikan dalam bentuk kegiatan analisis butir soal, remedial, dan pengayaan.', bukti_diharapkan: ['Wawancara dan studi dokumen: dokumen hasil analisis dan tindak lanjut supervisi penilaian', 'Program kegiatan workshop/diklat penilaian untuk guru', 'Hasil analisis butir soal', 'Program remedial dan pengayaan'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.1', pertanyaan: 'Memfasilitasi guru dalam merencanakan tindak lanjut perbaikan sistem penilaian hasil belajar.', bukti_diharapkan: ['Wawancara dan studi dokumen: dokumen hasil analisis dan tindak lanjut supervisi pembelajaran', 'Hasil kegiatan workshop/diklat untuk guru', 'Data dan piagam hasil pelatihan guru'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.2', pertanyaan: 'Mengecek ulang keterlaksanaan rekomendasi oleh guru.', bukti_diharapkan: ['Wawancara dan studi dokumen rekomendasi hasil perbaikan sistem penilaian hasil belajar'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.3', pertanyaan: 'Melaksanakan pembinaan dan pengembangan guru sebagai tindak lanjut kegiatan supervisi.', bukti_diharapkan: ['Laporan tindak lanjut supervisi', 'Program PKB guru', 'Laporan kegiatan pembinaan guru', 'Daftar hadir, notulen, foto kegiatan PKB guru'], penugasan: timD },
            { aspek_id: 'aspek_D', kode: 'D.4.3.4', pertanyaan: 'Menggunakan data hasil supervisi untuk pemetaan ketercapaian program sebagai dasar perbaikan siklus berikutnya.', bukti_diharapkan: ['Program PKB guru', 'Laporan kegiatan pembinaan guru', 'Daftar hadir, notulen, foto kegiatan PKB guru'], penugasan: timD },
            { aspek_id: 'aspek_E', kode: 'E.5.1.1', pertanyaan: 'Prestasi akademik peserta didik.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan akademik (tingkat kecamatan s.d. nasional)'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.1.2', pertanyaan: 'Prestasi non akademik peserta didik.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan nonakademik (tingkat kecamatan s.d. nasional)'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.1', pertanyaan: 'Prestasi akademik pendidik dan tenaga kependidikan.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan akademik GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.2.2', pertanyaan: 'Prestasi non akademik pendidik dan tenaga kependidikan.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan nonakademik GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.1', pertanyaan: 'Kelebihan prestasi akademik dari madrasah/sekolah lainnya.', bukti_diharapkan: ['Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.2', pertanyaan: 'Kelebihan prestasi non akademik dari madrasah/sekolah lainnya.', bukti_diharapkan: ['Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.3.3', pertanyaan: 'Kelebihan prestasi akademik dan non akademik pendidik dan tenaga kependidikan.', bukti_diharapkan: ['Dokumen peringkat GTK'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.1', pertanyaan: 'Ijazah yang dimiliki kepala madrasah.', bukti_diharapkan: ['Fotokopi Ijazah terakhir Kepala Madrasah (S1/S2/S3)'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.2', pertanyaan: 'Pendidikan dan pelatihan yang pernah diikuti oleh kepala madrasah.', bukti_diharapkan: ['Sertifikat STTPL/Diklat minimal 3 buah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.3', pertanyaan: 'Penguasaan ICT kepala madrasah.', bukti_diharapkan: ['Sertifikat pelatihan Microsoft Office/Internet'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.4', pertanyaan: 'Prestasi yang diraih oleh kepala madrasah.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan kepala madrasah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.5', pertanyaan: 'Kegiatan penelitian kependidikan yang telah dilakukan oleh kepala madrasah.', bukti_diharapkan: ['Laporan Penelitian Tindakan Sekolah (PTS)/Karya Tulis Ilmiah'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.6', pertanyaan: 'Kegiatan pelibatan komite dalam mendukung program madrasah.', bukti_diharapkan: ['Dokumentasi pelibatan komite dan stakeholder'], penugasan: timE },
            { aspek_id: 'aspek_E', kode: 'E.5.4.7', pertanyaan: 'Kegiatan kemitraan dengan stakeholder pendidikan dalam meningkatkan kompetensi guru madrasah.', bukti_diharapkan: ['Dokumen kemitraan dengan stakeholder pendidikan'], penugasan: timE }
        ];
        
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }
        
        alert(`✅ Setup Data Berhasil!\n\n📊 Total Indikator: ${indikatorList.length}\n- Dimensi A: 25 indikator\n- Dimensi B: 40 indikator\n- Dimensi C: 17 indikator\n- Dimensi D: 11 indikator\n- Dimensi E: 16 indikator\n\nTotal: 109 indikator PKKM lengkap!\n\nSilakan refresh halaman.`);
        location.reload();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};