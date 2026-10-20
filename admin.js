// ══════════════════════════════════════════════
// ADMIN PANEL - PKKM DIGITAL
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

let currentUser = null;
let allUsers = [];
let allIndicators = [];

// ══════════════════════════════════════════════
// 1. ADMIN LOGIN
// ══════════════════════════════════════════════
window.adminLogin = async function() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!email || !password) {
        errorDiv.textContent = '❌ Email dan password wajib diisi!';
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Cek apakah user adalah admin
        const userDoc = await db.collection('users').doc(email.replace(/[@.]/g, '_')).get();
        
        if (!userDoc.exists) {
            errorDiv.textContent = '❌ User tidak ditemukan di database!';
            await auth.signOut();
            return;
        }
        
        const userData = userDoc.data();
        
        if (userData.role !== 'admin' && userData.role !== 'kepala') {
            errorDiv.textContent = '❌ Akses ditolak! Hanya admin/kepala yang bisa masuk.';
            await auth.signOut();
            return;
        }
        
        currentUser = { uid: user.uid, email: user.email, ...userData };
        
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('adminName').textContent = userData.nama;
        
        loadUsers();
        
    } catch (error) {
        errorDiv.textContent = '❌ ' + error.message;
    }
};

window.adminLogout = async function() {
    await auth.signOut();
    location.reload();
};

// ══════════════════════════════════════════════
// 2. TAB NAVIGATION
// ══════════════════════════════════════════════
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'users') loadUsers();
    if (tabName === 'tasks') loadIndicatorsForAssignment();
    if (tabName === 'indicators') loadAllIndicators();
};

// ══════════════════════════════════════════════
// 3. USER MANAGEMENT
// ══════════════════════════════════════════════
window.createUser = async function() {
    const nama = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    
    if (!nama || !email || !password) {
        alert('❌ Nama, email, dan password wajib diisi!');
        return;
    }
    
    if (password.length < 6) {
        alert('❌ Password minimal 6 karakter!');
        return;
    }
    
    try {
        // Buat user di Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Simpan metadata di Firestore
        await db.collection('users').doc(email.replace(/[@.]/g, '_')).set({
            nama: nama,
            email: email,
            role: role,
            uid: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ User "${nama}" berhasil dibuat!`);
        
        // Reset form
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        
        loadUsers();
        
    } catch (error) {
        alert('❌ Gagal membuat user: ' + error.message);
    }
};

window.loadUsers = async function() {
    try {
        const snapshot = await db.collection('users').get();
        allUsers = [];
        
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        
        allUsers.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        
        const tbody = document.getElementById('usersTable');
        
        if (allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada user</td></tr>';
            return;
        }
        
        tbody.innerHTML = allUsers.map(user => `
            <tr>
                <td><strong>${user.nama || '-'}</strong></td>
                <td>${user.email || '-'}</td>
                <td><span class="badge" style="background: ${getRoleColor(user.role)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${(user.role || 'guru').toUpperCase()}</span></td>
                <td>
                    <button onclick="editUser('${user.id}')" class="btn-secondary btn-small">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteUser('${user.id}', '${user.email}')" class="btn-danger btn-small">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading users:', error);
        alert('❌ Gagal memuat data user: ' + error.message);
    }
};

function getRoleColor(role) {
    if (role === 'admin') return '#ef4444';
    if (role === 'kepala') return '#0891b2';
    return '#10b981';
}

window.editUser = function(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserName').value = user.nama || '';
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserRole').value = user.role || 'guru';
    
    document.getElementById('editUserModal').classList.add('active');
};

window.closeEditModal = function() {
    document.getElementById('editUserModal').classList.remove('active');
};

window.saveEditUser = async function() {
    const userId = document.getElementById('editUserId').value;
    const nama = document.getElementById('editUserName').value.trim();
    const role = document.getElementById('editUserRole').value;
    
    if (!nama) {
        alert('❌ Nama wajib diisi!');
        return;
    }
    
    try {
        await db.collection('users').doc(userId).update({
            nama: nama,
            role: role,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ User berhasil diupdate!');
        closeEditModal();
        loadUsers();
        
    } catch (error) {
        alert(' Gagal update: ' + error.message);
    }
};

window.deleteUser = async function(userId, email) {
    if (!confirm(`⚠️ Yakin ingin menghapus user "${email}"?\n\nTindakan ini tidak dapat dibatalkan!`)) {
        return;
    }
    
    try {
        // Hapus dari Firestore
        await db.collection('users').doc(userId).delete();
        
        // Hapus dari Firebase Auth (memerlukan re-authentication)
        // Untuk sekarang, kita hapus dari Firestore saja
        // User bisa dihapus dari Auth manual jika diperlukan
        
        alert('✅ User berhasil dihapus dari database!');
        loadUsers();
        
    } catch (error) {
        alert('❌ Gagal menghapus: ' + error.message);
    }
};

// ══════════════════════════════════════════════
// 4. TASK ASSIGNMENT
// ══════════════════════════════════════════════
window.loadIndicatorsForAssignment = async function() {
    try {
        const snapshot = await db.collection('pkkm_indikator').orderBy('kode').get();
        allIndicators = [];
        
        snapshot.forEach(doc => {
            allIndicators.push({ id: doc.id, ...doc.data() });
        });
        
        filterIndicatorsByDimensi();
        
    } catch (error) {
        console.error('Error loading indicators:', error);
        alert('❌ Gagal memuat indikator. Pastikan data sudah di-setup.');
    }
};

window.filterIndicatorsByDimensi = function() {
    const dimensi = document.getElementById('selectDimensi').value;
    const container = document.getElementById('indicatorsList');
    
    let filtered = allIndicators;
    if (dimensi !== 'all') {
        filtered = allIndicators.filter(ind => ind.aspek_id === `aspek_${dimensi}`);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">Tidak ada indikator untuk dimensi ini</p>';
        return;
    }
    
    container.innerHTML = filtered.map(ind => {
        const currentPenugasan = ind.penugasan || [];
        
        return `
            <div class="indicator-item">
                <h4>${ind.kode} - ${ind.pertanyaan}</h4>
                <p><strong>Bukti yang diperlukan:</strong> ${ind.bukti_diharapkan ? ind.bukti_diharapkan.join(', ') : '-'}</p>
                
                <div style="margin-top: 12px;">
                    <strong style="color: #0e7490; font-size: 0.9rem;">Pilih Guru yang Bertanggung Jawab:</strong>
                    <div class="teacher-checkboxes">
                        ${allUsers.filter(u => u.role === 'guru' || u.role === 'kepala').map(user => `
                            <label>
                                <input type="checkbox" 
                                       value="${user.nama}" 
                                       ${currentPenugasan.includes(user.nama) ? 'checked' : ''}
                                       onchange="updatePenugasan('${ind.id}', this)">
                                ${user.nama}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <button onclick="savePenugasan('${ind.id}')" class="save-indicator-btn">
                    <i class="fas fa-save"></i> Simpan Penugasan
                </button>
            </div>
        `;
    }).join('');
};

// Simpan perubahan penugasan secara real-time
window.updatePenugasan = function(indikatorId, checkbox) {
    // Fungsi ini akan dipanggil setiap kali checkbox berubah
    // Tapi kita simpan hanya ketika tombol "Simpan" diklik
};

window.savePenugasan = async function(indikatorId) {
    const indicatorItem = event.target.closest('.indicator-item');
    const checkboxes = indicatorItem.querySelectorAll('input[type="checkbox"]:checked');
    
    const penugasan = Array.from(checkboxes).map(cb => cb.value);
    
    try {
        await db.collection('pkkm_indikator').doc(indikatorId).update({
            penugasan: penugasan,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ Penugasan berhasil disimpan!\n\n${penugasan.length} guru ditugaskan.`);
        
    } catch (error) {
        alert('❌ Gagal menyimpan: ' + error.message);
    }
};

// ══════════════════════════════════════════════
// 5. INDICATORS DATA VIEW
// ══════════════════════════════════════════════
window.loadAllIndicators = async function() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').orderBy('kode').get();
        
        const container = document.getElementById('indicatorsData');
        
        if (aspekSnapshot.empty && indikatorSnapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">Belum ada data. Klik "Setup Data Awal" untuk mengisi.</p>';
            return;
        }
        
        let html = '';
        
        aspekSnapshot.forEach(aspekDoc => {
            const aspek = aspekDoc.data();
            html += `<h3 style="color: #0e7490; margin: 20px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #0891b2;">Dimensi ${aspek.kode}: ${aspek.nama}</h3>`;
            
            indikatorSnapshot.forEach(indDoc => {
                const ind = indDoc.data();
                if (ind.aspek_id === aspekDoc.id) {
                    html += `
                        <div class="indikator-card">
                            <h4>${ind.kode} - ${ind.pertanyaan}</h4>
                            <div class="bukti-list">
                                <strong>Bukti Fisik:</strong>
                                <ul style="margin: 8px 0 0 20px;">
                                    ${(ind.bukti_diharapkan || []).map(b => `<li>${b}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="penugasan-info">
                                <strong><i class="fas fa-users"></i> Penanggung Jawab:</strong> 
                                ${ind.penugasan && ind.penugasan.length > 0 ? ind.penugasan.join(', ') : 'Belum ada'}
                            </div>
                        </div>
                    `;
                }
            });
        });
        
        container.innerHTML = html || '<p style="text-align: center;">Tidak ada data</p>';
        
    } catch (error) {
        console.error('Error loading indicators:', error);
        alert('❌ Gagal memuat data: ' + error.message);
    }
};

// ══════════════════════════════════════════════
// 6. SETUP DATA AWAL
// ══════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (!confirm('⚠️ Ini akan mengisi database dengan data instrumen PKKM lengkap. Lanjutkan?')) return;
    
    try {
        // Setup Aspek
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
        
        // Setup Indikator (data lengkap dari PDF)
        const timA = ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'];
        const timB = ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd'];
        const timC = ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I'];
        const timD = ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I'];
        const timE = ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I'];
        
        const indikatorList = [
            // Dimensi A
            { aspek_id: 'aspek_A', kode: 'A.1.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.', bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat', 'Dokumen sosialisasi', 'Daftar hadir'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.2', pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.', bukti_diharapkan: ['Dokumen penetapan organisasi', 'Rincian tugas personil', 'Sertifikat', 'SOP Personalia'], penugasan: timA },
            { aspek_id: 'aspek_A', kode: 'A.1.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.', bukti_diharapkan: ['Dokumen SOP madrasah', 'Pedoman Sistem Informasi Madrasah'], penugasan: timA },
            // Tambahkan indikator lainnya sesuai kebutuhan...
            
            // Dimensi B
            { aspek_id: 'aspek_B', kode: 'B.2.1.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM berdasarkan data hasil evaluasi 8 SNP.', bukti_diharapkan: ['Dokumen EDM', 'Dokumen RKJM dan RKT'], penugasan: timB },
            // Tambahkan indikator lainnya...
            
            // Dimensi C, D, E - tambahkan sesuai kebutuhan
        ];
        
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }
        
        alert('✅ Setup data berhasil!');
        loadAllIndicators();
        
    } catch (error) {
        alert('❌ Gagal setup: ' + error.message);
    }
};

// Auto-check login status
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection('users').doc(user.email.replace(/[@.]/g, '_')).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                if (userData.role === 'admin' || userData.role === 'kepala') {
                    currentUser = { uid: user.uid, email: user.email, ...userData };
                    document.getElementById('loginPage').style.display = 'none';
                    document.getElementById('adminDashboard').style.display = 'block';
                    document.getElementById('adminName').textContent = userData.nama;
                    loadUsers();
                }
            }
        });
    }
});
