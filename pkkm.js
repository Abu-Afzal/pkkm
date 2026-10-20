// 1. FIREBASE CONFIG (Sesuai permintaan)
const firebaseConfig = {
  apiKey: "AIzaSyBhDGXnuMIvfr-9AXCIw1zgDuJWfCgMUyE",
  authDomain: "data-undangan-digital-9dc5a.firebaseapp.com",
  projectId: "data-undangan-digital-9dc5a",
  storageBucket: "data-undangan-digital-9dc5a.firebasestorage.app",
  messagingSenderId: "765763173060",
  appId: "1:765763173060:web:043f3f4f5d3de0e30ae791",
  measurementId: "G-1HTRDFF02C"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let userData = null;
let pkkmData = [];
let currentIndikatorId = null;

// 2. AUTO-LOGIN & INIT
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Untuk demo, kita buat login otomatis sebagai Natsir (Admin) jika belum login
            // DI PRODUKSI: Ganti dengan halaman login sesungguhnya
            await auth.signInWithEmailAndPassword("natsir@mahasyimasyari.sch.id", "password123"); 
            return;
        }

        userData = {
            uid: user.uid,
            email: user.email,
            nama: user.displayName || user.email.split('@')[0],
            role: user.email.includes('natsir') ? 'kepala' : 'guru' // Simulasi role
        };

        document.getElementById('userName').textContent = userData.nama;
        document.getElementById('userRole').textContent = userData.role.toUpperCase();

        if (userData.role === 'kepala' || userData.role === 'admin') {
            document.getElementById('adminPanel').style.display = 'block';
        }

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('contentState').style.display = 'block';
        
        loadPKKMData();
    });
});

// 3. LOAD DATA PKKM
async function loadPKKMData() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').get();
        const uploadSnapshot = await db.collection('pkkm_uploads').where('guru_uid', '==', userData.uid).get();

        const uploadsMap = {};
        uploadSnapshot.forEach(doc => {
            const data = doc.data();
            uploadsMap[data.indikator_id] = data;
        });

        pkkmData = [];
        let totalIndikator = 0, selesai = 0;

        aspekSnapshot.forEach(aspekDoc => {
            const aspek = { id: aspekDoc.id, ...aspekDoc.data(), indikator: [] };
            
            indikatorSnapshot.forEach(indDoc => {
                const ind = indDoc.data();
                if (ind.aspek_id === aspek.id) {
                    totalIndikator++;
                    const isUploaded = !!uploadsMap[indDoc.id];
                    if (isUploaded) selesai++;
                    
                    aspek.indikator.push({
                        id: indDoc.id,
                        ...ind,
                        isUploaded: isUploaded,
                        uploadData: uploadsMap[indDoc.id] || null
                    });
                }
            });
            pkkmData.push(aspek);
        });

        document.getElementById('statTotal').textContent = totalIndikator;
        document.getElementById('statSelesai').textContent = selesai;
        document.getElementById('statBelum').textContent = totalIndikator - selesai;

        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Gagal memuat data. Pastikan Anda sudah menjalankan 'Setup Data Awal'");
    }
}

// 4. RENDER DASHBOARD
function renderDashboard() {
    const container = document.getElementById('aspekContainer');
    container.innerHTML = pkkmData.map(aspek => `
        <div class="aspek-item">
            <div class="aspek-title"><i class="fas fa-folder-open"></i> Dimensi ${aspek.kode}: ${aspek.nama}</div>
            <div class="indikator-list">
                ${aspek.indikator.map(ind => `
                    <div class="indikator-item ${ind.isUploaded ? 'uploaded' : ''}">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.95rem;">${ind.kode} - ${ind.pertanyaan}</div>
                            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                                <strong>Bukti:</strong> ${ind.bukti_diharapkan.join(', ')}
                            </div>
                            ${ind.isUploaded ? `
                                <div style="margin-top: 8px; font-size: 0.8rem; color: #166534;">
                                    <i class="fas fa-check-circle"></i> Diupload: ${ind.uploadData.file_name} 
                                    <a href="${ind.uploadData.file_url}" target="_blank" style="color: #0891b2; margin-left: 8px;"><i class="fas fa-external-link-alt"></i> Lihat File</a>
                                </div>
                            ` : ''}
                        </div>
                        <div>
                            ${ind.isUploaded ? 
                                `<span class="badge badge-success">SELESAI</span>` : 
                                `<button class="btn btn-primary" onclick="openUploadModal('${ind.id}', '${ind.kode}', '${ind.pertanyaan}', '${ind.bukti_diharapkan.join(', ')}')"><i class="fas fa-upload"></i> Upload</button>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div
        </div>
    `).join('');
}

// 5. UPLOAD LOGIC (Menggunakan Firebase Storage)
window.openUploadModal = function(indId, kode, pertanyaan, bukti) {
    currentIndikatorId = indId;
    document.getElementById('modalIndikatorTitle').textContent = `${kode} - ${pertanyaan}`;
    document.getElementById('modalBuktiTitle').textContent = `Bukti yang diperlukan: ${bukti}`;
    document.getElementById('fileNameDisplay').textContent = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('uploadModal').classList.add('active');
};

window.handleFileSelect = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file maksimal 5MB!");
        return;
    }

    document.getElementById('fileNameDisplay').innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload ${file.name}...`;
    
    try {
        // 1. Upload ke Firebase Storage
        const storageRef = storage.ref(`pkkm_uploads/${userData.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // 2. Simpan metadata ke Firestore
        await db.collection('pkkm_uploads').add({
            indikator_id: currentIndikatorId,
            guru_uid: userData.uid,
            guru_nama: userData.nama,
            file_name: file.name,
            file_url: downloadURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ Upload berhasil!");
        closeModal();
        loadPKKMData(); // Refresh data
    } catch (error) {
        console.error(error);
        alert("❌ Gagal upload: " + error.message);
        document.getElementById('fileNameDisplay').textContent = 'Gagal upload. Coba lagi.';
    }
};

window.closeModal = function() {
    document.getElementById('uploadModal').classList.remove('active');
};

window.logout = function() {
    auth.signOut().then(() => location.reload());
};

// 6. SETUP DATA AWAL (HANYA UNTUK ADMIN/KEPALA MADRASAH)
window.setupDataPKKM = async function() {
    if (!confirm("Ini akan mengisi database dengan data instrumen PKKM Dimensi A dan Data Guru. Lanjutkan?")) return;

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

    try {
        // A. Setup Aspek (Contoh Dimensi A)
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

        // B. Setup Indikator (Contoh Dimensi A.1.1 s.d A.1.4 dari PDF)
        const indikatorList = [
            { 
                aspek_id: 'aspek_A', kode: 'A.1.1', 
                pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.',
                bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat', 'Dokumen sosialisasi', 'Daftar hadir'],
                penugasan: 'Jamil Rahmat, S.Pd' // Contoh penugasan
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.2', 
                pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.',
                bukti_diharapkan: ['Dokumen penetapan organisasi', 'Rincian tugas personil', 'SOP Personalia'],
                penugasan: 'Natsir, S.Pd.I'
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.3', 
                pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.',
                bukti_diharapkan: ['Dokumen SOP madrasah', 'Pedoman Sistem Informasi Madrasah'],
                penugasan: 'Nursyam, S.Pd'
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.4', 
                pertanyaan: 'Mampu mengembangkan program baru untuk meningkatkan pencapaian target.',
                bukti_diharapkan: ['Visi dan misi', 'Data prestasi', 'Data hasil UN 3 tahun', 'RKJM'],
                penugasan: 'Jamil Rahmat, S.Pd'
            }
        ];

        for (const ind of indikatorList) {
            await db.collection('pkkm_indikator').add(ind);
        }

        // C. Setup User Guru (Simulasi agar bisa login)
        // Catatan: Di Firebase Console, Anda harus membuat user ini secara manual di Authentication
        // Kode ini hanya mencatat metadata di Firestore
        const guruList = [
            { nama: "Natsir, S.Pd.I", email: "natsir@mahasyimasyari.sch.id", role: "kepala" },
            { nama: "Jamil Rahmat, S.Pd", email: "jamil@mahasyimasyari.sch.id", role: "wakil" },
            { nama: "Nursyam, S.Pd", email: "nursyam@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Marwah, S.Pd.I", email: "marwah@mahasyimasyari.sch.id", role: "guru" }
        ];

        for (const guru of guruList) {
            await db.collection('users').doc(guru.email).set(guru);
        }

        alert("✅ Setup Data PKKM Berhasil! Silakan refresh halaman.");
        loadPKKMData();
    } catch (error) {
        console.error(error);
        alert("❌ Gagal setup: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-database"></i> Setup Data Awal PKKM (Admin Only)';
    }
};
