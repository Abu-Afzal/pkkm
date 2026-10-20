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
const storage = firebase.storage();

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
            // ✅ PERBAIKAN: Query berdasarkan field 'email', bukan Document ID
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
                    docId: docId  // Simpan docId untuk keperluan update/delete
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
    }); // ✅ PERBAIKAN: Ini yang hilang - penutup onAuthStateChanged
});

// ═════════════════════════════════════════════
// 2. TAB NAVIGATION
// ═════════════════════════════════════════════
window.switchMainTab = function(tabName) {
    // Sembunyikan SEMUA tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Hapus active dari semua tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Tampilkan tab yang dipilih
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
                            <div class="indikator-item" style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
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
                                            <a href="${lastUpload.file_url}" target="_blank" style="color: #0891b2; margin-left: 8px; font-weight: 600;"><i class="fas fa-download"></i> Download</a>
                                        </div>
                                    ` : `
                                        <div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;"><i class="fas fa-clock"></i> Belum ada dokumen</div>
                                    `}
                                </div>
                                <div style="flex-shrink: 0; margin-left: 12px;">
                                    ${userData ? (isAssigned ? 
                                        `<button class="btn btn-primary" onclick="openUploadModal('${ind.id}', '${ind.kode}', '${ind.pertanyaan.replace(/'/g, "\\'")}', '${ind.bukti_diharapkan.join(', ').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-${hasUpload && isMyUpload ? 'sync-alt' : 'upload'}"></i> ${hasUpload && isMyUpload ? 'Ganti' : 'Upload'}
                                        </button>` : 
                                        `<button class="btn" disabled style="background: #e2e8f0; color: #94a3b8; cursor: not-allowed; padding: 8px 12px; border-radius: 6px; border: none;"><i class="fas fa-lock"></i> Bukan Tugas Anda</button>`
                                    ) : `
                                        <button class="btn" disabled style="background: #f1f5f9; color: #94a3b8; cursor: not-allowed; padding: 8px 12px; border-radius: 6px; border: none;"><i class="fas fa-eye"></i> View Only</button>
                                    `}
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
// 4. UI STATE (GUEST vs LOGIN) - DENGAN NULL CHECKS
// ══════════════════════════════════════════════
function updateUIForGuest() {
    // Header elements
    const guestBadge = document.getElementById('guestBadge');
    const userInfo = document.getElementById('userInfo');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    
    if (guestBadge) guestBadge.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
    
    // Navigation tabs - SEMBUNYIKAN
    const navTabs = document.getElementById('mainNavTabs');
    if (navTabs) navTabs.style.display = 'none';
    
    // Tab buttons
    const tabBtnAdmin = document.getElementById('tabBtnAdmin');
    if (tabBtnAdmin) tabBtnAdmin.style.display = 'none';
    
    // PAKSA sembunyikan tab admin
    const tabAdmin = document.getElementById('tab-admin');
    if (tabAdmin) {
        tabAdmin.style.display = 'none';
        tabAdmin.classList.remove('active');
    }
    
    // PAKSA tampilkan tab dashboard
    const tabDashboard = document.getElementById('tab-dashboard');
    if (tabDashboard) {
        tabDashboard.style.display = 'block';
        tabDashboard.classList.add('active');
    }
}

function updateUIForLoggedInUser() {
    // Header elements
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
    
    // Tampilkan navigation tabs
    const navTabs = document.getElementById('mainNavTabs');
    if (navTabs) navTabs.style.display = 'flex';
    
    // Cek role untuk admin panel
    const tabBtnAdmin = document.getElementById('tabBtnAdmin');
    if (tabBtnAdmin) {
        if (userData.role === 'admin' || userData.role === 'kepala') {
            tabBtnAdmin.style.display = 'inline-block';
        } else {
            tabBtnAdmin.style.display = 'none';
        }
    }
    
    // Default: tampilkan dashboard
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
// 6. UPLOAD LOGIC
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
    if (file.size > 10 * 1024 * 1024) { alert("Maksimal 10MB!"); return; }

    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay) fileNameDisplay.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload...`;
    
    try {
        const storageRef = storage.ref(`pkkm_uploads/${userData.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        const existing = await db.collection('pkkm_uploads').where('indikator_id', '==', currentIndikatorId).where('guru_uid', '==', userData.uid).get();

        const data = {
            indikator_id: currentIndikatorId,
            guru_uid: userData.uid,
            guru_nama: userData.nama,
            file_name: file.name,
            file_url: downloadURL,
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
        alert("❌ Gagal: " + error.message);
    }
};

// ══════════════════════════════════════════════
// 7. ADMIN FUNCTIONS (USER MANAGEMENT & ASSIGNMENT)
// ══════════════════════════════════════════════
function checkAdminAccess() {
    if (!userData) {
        alert(' Akses ditolak! Silakan login terlebih dahulu.');
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
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #64748b;">Belum ada user</td></tr>';
        return;
    }
    
    tbody.innerHTML = allUsers.map(user => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.nama || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${user.email || '-'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><span style="background: ${user.role === 'admin' ? '#ef4444' : user.role === 'kepala' ? '#0891b2' : '#10b981'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${(user.role || 'guru').toUpperCase()}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                <button onclick="deleteUser('${user.uid}')" class="btn btn-danger" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.createNewUser = async function() {
    if (!checkAdminAccess()) return;
    
    const nama = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    
    if (!nama || !email || !password) { alert('❌ Nama, email, dan password wajib diisi!'); return; }
    if (password.length < 6) { alert(' Password minimal 6 karakter!'); return; }
    
    try {
        const apiKey = firebaseConfig.apiKey;
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password, returnSecureToken: false })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error.message);
        }
        const authResult = await response.json();
        
        // ✅ PERBAIKAN: Gunakan UID sebagai Document ID (konsisten dengan Firebase Auth)
        await db.collection('users').doc(authResult.localId).set({
            nama: nama,
            email: email,
            role: role,
            uid: authResult.localId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ User "${nama}" berhasil dibuat!`);
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        loadAdminData();
    } catch (error) {
        alert('❌ Gagal membuat user: ' + error.message);
    }
};

window.deleteUser = async function(userId) {
    if (!checkAdminAccess()) return;
    if (!confirm('⚠️ Yakin ingin menghapus user ini dari database?')) return;
    
    try {
        // userId sekarang adalah UID (Document ID yang benar)
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
    if (!confirm('⚠️ Ini akan mengisi database dengan data PKKM lengkap. Lanjutkan?')) return;
    
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
            { aspek_id: 'aspek_A', kode: 'A.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.', bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat', 'Dokumen sosialisasi', 'Daftar hadir'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.2', pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.', bukti_diharapkan: ['Dokumen penetapan organisasi', 'Rincian tugas personil', 'Sertifikat', 'SOP Personalia'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.', bukti_diharapkan: ['Dokumen SOP madrasah', 'Pedoman Sistem Informasi Madrasah'], penugasan: timA },
            { aspek_id: 'aspek_B', kode: 'B.2.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM berdasarkan data hasil evaluasi 8 SNP.', bukti_diharapkan: ['Dokumen EDM', 'Dokumen RKJM dan RKT'], penugasan: timB },
            { aspek_id: 'aspek_C', kode: 'C.3.1', pertanyaan: 'Memahami dan menghayati arti dan tujuan perubahan (inovasi) madrasah.', bukti_diharapkan: ['Program pengembangan kewirausahaan', 'Profil madrasah'], penugasan: timC },
            { aspek_id: 'aspek_D', kode: 'D.4.1', pertanyaan: 'Mengidentifikasi masalah yang guru hadapi dalam pelaksanaan pembelajaran.', bukti_diharapkan: ['Program supervisi', 'Jadwal supervisi', 'SK tim supervisor'], penugasan: timD },
            { aspek_id: 'aspek_E', kode: 'E.5.1', pertanyaan: 'Prestasi akademik peserta didik.', bukti_diharapkan: ['Piagam/sertifikat kejuaraan akademik'], penugasan: timE }
        ];
        
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }
        
        alert('✅ Setup Data Berhasil! Silakan refresh halaman.');
        location.reload();
    } catch (error) {
        alert('❌ Gagal: ' + error.message);
    }
};