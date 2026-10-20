// ══════════════════════════════════════════════
// PKKM DIGITAL - HYBRID MODE (TAMU & LOGIN)
// ═════════════════════════════════════════════

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
let currentIndikatorId = null;

// ═════════════════════════════════════════════
// 1. INIT: LOAD DATA LANGSUNG (TANPA TUNGGU LOGIN)
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadPKKMData(); // Load data untuk semua orang (Tamu & User)
    
    // Pantau status login
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.email.replace(/[@.]/g, '_')).get().then(doc => {
                const dbData = doc.exists ? doc.data() : {};
                userData = {
                    uid: user.uid,
                    email: user.email,
                    nama: dbData.nama || user.email.split('@')[0],
                    role: dbData.role || 'guru'
                };
                updateUIForLoggedInUser();
                renderDashboard(); // Re-render untuk munculkan tombol upload
            });
        } else {
            userData = null;
            updateUIForGuest();
            renderDashboard(); // Re-render untuk sembunyikan tombol upload
        }
    });
});

// ══════════════════════════════════════════════
// 2. LOAD DATA DARI FIRESTORE
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

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statSelesai').textContent = selesai;
        document.getElementById('statBelum').textContent = total - selesai;
        document.getElementById('loadingData').style.display = 'none';
        
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('loadingData').innerHTML = '<p style="color:red;">Gagal memuat data. Periksa Rules Firebase.</p>';
    }
}

// ══════════════════════════════════════════════
// 3. RENDER DASHBOARD (DINAMIS: TAMU vs LOGIN)
// ═════════════════════════════════════════════
function renderDashboard() {
    const container = document.getElementById('aspekContainer');
    
    container.innerHTML = pkkmData.map(aspek => {
        const aspekSelesai = aspek.indikator.filter(ind => ind.uploads.length > 0).length;
        const aspekTotal = aspek.indikator.length;
        const progress = aspekTotal > 0 ? Math.round((aspekSelesai / aspekTotal) * 100) : 0;

        return `
            <div class="aspek-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="aspek-title"><i class="fas fa-folder-open"></i> Dimensi ${aspek.kode}: ${aspek.nama}</div>
                    <span class="badge ${progress === 100 ? 'badge-success' : progress > 0 ? 'badge-warning' : 'badge-danger'}">${progress}%</span>
                </div>
                <div style="background: #e2e8f0; height: 6px; border-radius: 3px; margin-bottom: 16px; overflow: hidden;">
                    <div style="background: ${progress === 100 ? '#10b981' : '#0891b2'}; height: 100%; width: ${progress}%;"></div>
                </div>
                <div class="indikator-list">
                    ${aspek.indikator.map(ind => {
                        const hasUpload = ind.uploads.length > 0;
                        const lastUpload = hasUpload ? ind.uploads[ind.uploads.length - 1] : null;
                        
                        // Cek apakah user login ditugaskan di sini
                        const isAssigned = userData && ind.penugasan && ind.penugasan.some(p => p.toLowerCase().includes(userData.nama.toLowerCase().split(',')[0]));
                        const isMyUpload = lastUpload && lastUpload.guru_uid === userData?.uid;

                        return `
                            <div class="indikator-item ${hasUpload ? 'uploaded' : ''}">
                                <div style="flex: 1;">
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
                                        `<button class="btn ${hasUpload && isMyUpload ? 'btn-warning' : 'btn-primary'}" onclick="openUploadModal('${ind.id}', '${ind.kode}', '${ind.pertanyaan.replace(/'/g, "\\'")}', '${ind.bukti_diharapkan.join(', ').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-${hasUpload && isMyUpload ? 'sync-alt' : 'upload'}"></i> ${hasUpload && isMyUpload ? 'Ganti' : 'Upload'}
                                        </button>` : 
                                        `<button class="btn" disabled style="background: #e2e8f0; color: #94a3b8; cursor: not-allowed;"><i class="fas fa-lock"></i> Bukan Tugas Anda</button>`
                                    ) : `
                                        <button class="btn" disabled style="background: #f1f5f9; color: #94a3b8; cursor: not-allowed;"><i class="fas fa-eye"></i> View Only</button>
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
// 4. FUNGSI UI LOGIN / LOGOUT
// ══════════════════════════════════════════════
function updateUIForLoggedInUser() {
    document.getElementById('guestBadge').style.display = 'none';
    document.getElementById('userInfo').style.display = 'block';
    document.getElementById('userName').textContent = userData.nama;
    document.getElementById('userRole').textContent = userData.role;
    document.getElementById('btnLogin').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'inline-block';
    if (userData.role === 'kepala' || userData.role === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
    }
}

function updateUIForGuest() {
    document.getElementById('guestBadge').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('btnLogin').style.display = 'inline-block';
    document.getElementById('btnLogout').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
}

window.openLoginModal = () => document.getElementById('loginModal').classList.add('active');
window.closeLoginModal = () => {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginError').style.display = 'none';
};

window.doLogin = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeLoginModal();
    } catch (error) {
        errorDiv.textContent = '❌ ' + error.message;
        errorDiv.style.display = 'block';
    }
};

window.logout = () => auth.signOut();
window.closeModal = () => document.getElementById('uploadModal').classList.remove('active');

// ═════════════════════════════════════════════
// 5. FUNGSI UPLOAD (HANYA BERJIKA SUDAH LOGIN)
// ══════════════════════════════════════════════
window.openUploadModal = (indId, kode, pertanyaan, bukti) => {
    if (!userData) { alert('Silakan login terlebih dahulu!'); return; }
    currentIndikatorId = indId;
    document.getElementById('modalIndikatorTitle').textContent = `${kode} - ${pertanyaan}`;
    document.getElementById('modalBuktiTitle').textContent = `Bukti: ${bukti}`;
    document.getElementById('fileNameDisplay').textContent = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('uploadModal').classList.add('active');
};

window.handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || !userData) return;

    if (file.size > 10 * 1024 * 1024) { alert("Maksimal 10MB!"); return; }

    document.getElementById('fileNameDisplay').innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload...`;
    
    try {
        const storageRef = storage.ref(`pkkm_uploads/${userData.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // Cek upload sebelumnya oleh user ini
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
// 6. SETUP DATA AWAL (ADMIN ONLY)
// ═════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (!userData || userData.role !== 'kepala') { alert("Hanya Kepala Madrasah!"); return; }
    if (!confirm("Setup data awal PKKM?")) return;

    const btn = event.target;
    btn.disabled = true; btn.innerHTML = 'Memproses...';

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

        // Data Indikator (Sesuai PDF & Pembagian Tugas)
        const indikatorList = [
            { aspek_id: 'aspek_A', kode: 'A.1.1', pertanyaan: 'Mampu mengembangkan struktur organisasi...', bukti_diharapkan: ['Bagan struktur', 'Notulen rapat'], penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'] },
            { aspek_id: 'aspek_A', kode: 'A.1.2', pertanyaan: 'Mampu menempatkan personalia...', bukti_diharapkan: ['SK Organisasi', 'Rincian tugas'], penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'] },
            { aspek_id: 'aspek_A', kode: 'A.1.3', pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja (SOP)...', bukti_diharapkan: ['Dokumen SOP', 'Pedoman SIM'], penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd'] },
            
            { aspek_id: 'aspek_B', kode: 'B.2.1', pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM...', bukti_diharapkan: ['Dokumen EDM', 'RKJM'], penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd'] },
            { aspek_id: 'aspek_B', kode: 'B.2.30', pertanyaan: 'Mampu merencanakan kebutuhan keuangan...', bukti_diharapkan: ['RKJM', 'Laporan keuangan'], penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd'] },

            { aspek_id: 'aspek_C', kode: 'C.3.1', pertanyaan: 'Memahami dan menghayati arti inovasi madrasah...', bukti_diharapkan: ['Program kewirausahaan', 'Profil madrasah'], penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I'] },

            { aspek_id: 'aspek_D', kode: 'D.4.1', pertanyaan: 'Mengidentifikasi masalah pembelajaran guru...', bukti_diharapkan: ['Program supervisi', 'Jadwal supervisi'], penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I'] },

            { aspek_id: 'aspek_E', kode: 'E.5.1', pertanyaan: 'Prestasi akademik peserta didik...', bukti_diharapkan: ['Piagam/Sertifikat'], penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I'] }
            // Tambahkan indikator lainnya sesuai PDF di sini...
        ];

        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }

        // Setup User Metadata
        const users = [
            { nama: "Natsir, S.Pd.I", email: "natsir@mahasyimasyari.sch.id", role: "kepala" },
            { nama: "Elis Harianto, S.Pd", email: "elis@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Jamil Rahmat, S.Pd", email: "jamil@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Marhani, S.Pd", email: "marhani@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Ahmad Mudatsir, S.Pd", email: "mudatsir@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Irmayani, S.Pd", email: "irmayani@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Wahda Nurismi, S.Pd", email: "wahda@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Risna Sari, S.Pd", email: "risna@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Niar, S.Pd", email: "niar@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Muniratul Asri, S.Pd", email: "muniratul@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Marwah, S.Pd.I", email: "marwah@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Nursyam, S.Pd", email: "nursyam@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Atikah, S.Pd.I", email: "atikah@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Haerani, S.Pd.I", email: "haerani@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Sumarni, S.E.", email: "sumarni@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Khaerul, S.Ag", email: "khaerul@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Hj. Murniati Mahdi, S.Pd.I", email: "murniati@mahasyimasyari.sch.id", role: "guru" }
        ];

        for (const u of users) {
            await db.collection('users').doc(u.email.replace(/[@.]/g, '_')).set(u);
        }

        alert("✅ Setup Berhasil!");
        loadPKKMData();
    } catch (error) {
        alert("❌ Gagal: " + error.message);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-database"></i> Setup Data Awal';
    }
};
