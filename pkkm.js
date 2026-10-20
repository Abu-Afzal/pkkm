// ══════════════════════════════════════════════
// PKKM DIGITAL - MA HASYIM ASY'ARI
// Penilaian Kinerja Kepala Madrasah
// ══════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBhDGXnuMIvfr-9AXCIw1zgDuJWfCgMUyE",
  authDomain: "data-undangan-digital-9dc5a.firebaseapp.com",
  databaseURL: "https://data-undangan-digital-9dc5a-default-rtdb.asia-southeast1.firebasedatabase.app",
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
let currentIndikatorData = null;

// ══════════════════════════════════════════════
// 1. AUTO-LOGIN & INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Demo mode: auto-login sebagai Natsir (Admin/Kepala Madrasah)
            // DI PRODUKSI: Hapus baris ini dan gunakan halaman login
            await auth.signInWithEmailAndPassword("natsir@mahasyimasyari.sch.id", "password123"); 
            return;
        }

        // Cek role user dari Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userDataDB = userDoc.exists ? userDoc.data() : {};

        userData = {
            uid: user.uid,
            email: user.email,
            nama: userDataDB.nama || user.displayName || user.email.split('@')[0],
            role: userDataDB.role || 'guru'
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

// ══════════════════════════════════════════════
// 2. LOAD DATA PKKM
// ══════════════════════════════════════════════
async function loadPKKMData() {
    try {
        const aspekSnapshot = await db.collection('pkkm_aspek').orderBy('kode').get();
        const indikatorSnapshot = await db.collection('pkkm_indikator').get();
        
        // Ambil semua upload dari semua guru (untuk monitoring)
        const allUploadsSnapshot = await db.collection('pkkm_uploads').get();
        const uploadsByIndikator = {};
        allUploadsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!uploadsByIndikator[data.indikator_id]) uploadsByIndikator[data.indikator_id] = [];
            uploadsByIndikator[data.indikator_id].push({ id: doc.id, ...data });
        });

        // Ambil upload milik user ini saja
        const myUploadsSnapshot = await db.collection('pkkm_uploads').where('guru_uid', '==', userData.uid).get();
        const myUploadsMap = {};
        myUploadsSnapshot.forEach(doc => {
            const data = doc.data();
            myUploadsMap[data.indikator_id] = data;
        });

        pkkmData = [];
        let totalIndikator = 0, selesai = 0, ditugaskan = 0;

        aspekSnapshot.forEach(aspekDoc => {
            const aspek = { id: aspekDoc.id, ...aspekDoc.data(), indikator: [] };
            
            indikatorSnapshot.forEach(indDoc => {
                const ind = indDoc.data();
                if (ind.aspek_id === aspek.id) {
                    totalIndikator++;
                    
                    // Cek apakah user ini ditugaskan
                    const isAssigned = ind.penugasan && ind.penugasan.includes(userData.nama);
                    const allUploads = uploadsByIndikator[indDoc.id] || [];
                    const myUpload = myUploadsMap[indDoc.id] || null;
                    
                    if (isAssigned) ditugaskan++;
                    if (myUpload) selesai++;
                    
                    aspek.indikator.push({
                        id: indDoc.id,
                        ...ind,
                        isAssigned: isAssigned,
                        isUploaded: !!myUpload,
                        myUploadData: myUpload,
                        allUploads: allUploads
                    });
                }
            });
            pkkmData.push(aspek);
        });

        document.getElementById('statTotal').textContent = userData.role === 'kepala' || userData.role === 'admin' ? totalIndikator : ditugaskan;
        document.getElementById('statSelesai').textContent = selesai;
        document.getElementById('statBelum').textContent = (userData.role === 'kepala' || userData.role === 'admin' ? totalIndikator : ditugaskan) - selesai;

        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Gagal memuat data. Pastikan Anda sudah menjalankan 'Setup Data Awal PKKM'");
    }
}

// ══════════════════════════════════════════════
// 3. RENDER DASHBOARD
// ══════════════════════════════════════════════
function renderDashboard() {
    const container = document.getElementById('aspekContainer');
    
    if (pkkmData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: #64748b;">
            <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
            <h3>Belum ada data PKKM</h3>
            <p>Silakan klik tombol "Setup Data Awal PKKM" di atas untuk mengisi data.</p>
        </div>`;
        return;
    }

    container.innerHTML = pkkmData.map(aspek => {
        // Filter indikator: jika user adalah guru biasa, hanya tampilkan yang ditugaskan
        const visibleIndikator = (userData.role === 'kepala' || userData.role === 'admin') 
            ? aspek.indikator 
            : aspek.indikator.filter(ind => ind.isAssigned);

        if (visibleIndikator.length === 0) return '';

        const aspekSelesai = visibleIndikator.filter(ind => ind.isUploaded).length;
        const aspekTotal = visibleIndikator.length;
        const aspekProgress = aspekTotal > 0 ? Math.round((aspekSelesai / aspekTotal) * 100) : 0;

        return `
            <div class="aspek-item">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div class="aspek-title" style="flex: 1;">
                        <i class="fas fa-folder-open"></i> Dimensi ${aspek.kode}: ${aspek.nama}
                    </div>
                    <span class="badge ${aspekProgress === 100 ? 'badge-success' : aspekProgress > 0 ? 'badge-warning' : 'badge-danger'}">
                        ${aspekProgress}% SELESAI
                    </span>
                </div>
                <div style="background: #e2e8f0; border-radius: 4px; height: 8px; margin-bottom: 16px; overflow: hidden;">
                    <div style="background: ${aspekProgress === 100 ? '#10b981' : '#0891b2'}; height: 100%; width: ${aspekProgress}%; transition: 0.3s;"></div>
                </div>
                <div class="indikator-list">
                    ${visibleIndikator.map(ind => {
                        const assignedNames = (ind.penugasan || []).join(', ');
                        const uploadCount = ind.allUploads.length;
                        
                        return `
                            <div class="indikator-item ${ind.isUploaded ? 'uploaded' : ''}">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; font-size: 0.95rem; color: #0f172a; margin-bottom: 4px;">
                                        ${ind.kode} - ${ind.pertanyaan}
                                    </div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 6px; line-height: 1.5;">
                                        <strong>Bukti yang diperlukan:</strong><br>
                                        ${ind.bukti_diharapkan.map((b, i) => `${i+1}. ${b}`).join('<br>')}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #0891b2; margin-bottom: 6px;">
                                        <i class="fas fa-users"></i> <strong>Petugas:</strong> ${assignedNames}
                                    </div>
                                    ${ind.isUploaded ? `
                                        <div style="margin-top: 8px; font-size: 0.8rem; color: #166534; background: #dcfce7; padding: 8px; border-radius: 4px;">
                                            <i class="fas fa-check-circle"></i> <strong>File Anda:</strong> ${ind.myUploadData.file_name}
                                            <a href="${ind.myUploadData.file_url}" target="_blank" style="color: #0891b2; margin-left: 8px;"><i class="fas fa-external-link-alt"></i> Lihat</a>
                                            ${uploadCount > 1 ? `<span style="color: #64748b; margin-left: 8px;">(+${uploadCount - 1} file dari guru lain)</span>` : ''}
                                        </div>
                                    ` : uploadCount > 0 ? `
                                        <div style="margin-top: 8px; font-size: 0.8rem; color: #92400e; background: #fef3c7; padding: 8px; border-radius: 4px;">
                                            <i class="fas fa-info-circle"></i> Sudah ada ${uploadCount} file diupload oleh guru lain, tapi Anda belum upload.
                                        </div>
                                    ` : ''}
                                </div>
                                <div style="flex-shrink: 0;">
                                    ${ind.isAssigned ? 
                                        (ind.isUploaded ? 
                                            `<button class="btn btn-warning" onclick="openUploadModal('${ind.id}', '${ind.kode.replace(/'/g, "\\'")}', '${ind.pertanyaan.replace(/'/g, "\\'")}', '${ind.bukti_diharapkan.join(', ').replace(/'/g, "\\'")}')"><i class="fas fa-sync-alt"></i> Ganti File</button>` :
                                            `<button class="btn btn-primary" onclick="openUploadModal('${ind.id}', '${ind.kode.replace(/'/g, "\\'")}', '${ind.pertanyaan.replace(/'/g, "\\'")}', '${ind.bukti_diharapkan.join(', ').replace(/'/g, "\\'")}')"><i class="fas fa-upload"></i> Upload</button>`
                                        ) : 
                                        `<button class="btn" style="background: #e2e8f0; color: #94a3b8; cursor: not-allowed;" disabled><i class="fas fa-lock"></i> Tidak Ditugaskan</button>`
                                    }
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
// 4. UPLOAD LOGIC
// ══════════════════════════════════════════════
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

    if (file.size > 10 * 1024 * 1024) {
        alert("⚠️ Ukuran file maksimal 10MB!");
        return;
    }

    document.getElementById('fileNameDisplay').innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengupload ${file.name}...`;
    
    try {
        // 1. Upload ke Firebase Storage
        const storageRef = storage.ref(`pkkm_uploads/${userData.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // 2. Cek apakah sudah ada upload dari user ini untuk indikator ini
        const existingUpload = await db.collection('pkkm_uploads')
            .where('indikator_id', '==', currentIndikatorId)
            .where('guru_uid', '==', userData.uid)
            .get();

        if (!existingUpload.empty) {
            // Update dokumen yang sudah ada
            await existingUpload.docs[0].ref.update({
                file_name: file.name,
                file_url: downloadURL,
                file_size: (file.size / 1024).toFixed(1) + ' KB',
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Buat dokumen baru
            await db.collection('pkkm_uploads').add({
                indikator_id: currentIndikatorId,
                guru_uid: userData.uid,
                guru_nama: userData.nama,
                file_name: file.name,
                file_url: downloadURL,
                file_size: (file.size / 1024).toFixed(1) + ' KB',
                uploaded_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert("✅ Upload berhasil!");
        closeModal();
        loadPKKMData();
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

// ══════════════════════════════════════════════
// 5. SETUP DATA AWAL (ADMIN ONLY)
// ══════════════════════════════════════════════
window.setupDataPKKM = async function() {
    if (userData.role !== 'kepala' && userData.role !== 'admin') {
        alert("⛔ Hanya Kepala Madrasah/Admin yang dapat menjalankan setup data!");
        return;
    }

    if (!confirm("⚠️ Ini akan mengisi database dengan data instrumen PKKM lengkap dan penugasan guru. Lanjutkan?")) return;

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

    try {
        // A. SETUP 5 DIMENSI PKKM
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

        // B. SETUP INDICATOR LENGKAP + PENUGASAN GURU
        // Berdasarkan file "Pembagian Tugas PKKM.docx"
        const indikatorList = [
            // ══════════════════════════════════════════════
            // DIMENSI A - USAHA PENGEMBANGAN MADRASAH
            // Petugas: Elis Harianto, Jamil Rahmat, Marhani, Ahmad Mudatsir
            // ══════════════════════════════════════════════
            { 
                aspek_id: 'aspek_A', kode: 'A.1.1', 
                pertanyaan: 'Mampu mengembangkan struktur organisasi yang sesuai dengan kebutuhan program.',
                bukti_diharapkan: ['Bagan/struktur organisasi', 'Notulen rapat keputusan penyusunan struktur organisasi', 'Dokumen sosialisasi', 'Daftar hadir'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.2', 
                pertanyaan: 'Mampu menempatkan personalia yang sesuai dengan kebutuhan.',
                bukti_diharapkan: ['Dokumen penetapan/pengesahan susunan organisasi', 'Rincian tugas setiap personil', 'Sertifikat', 'SOP Personalia'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.3', 
                pertanyaan: 'Mampu mengembangkan pedoman dan prosedur kerja organisasi madrasah.',
                bukti_diharapkan: ['Dokumen SOP madrasah', 'Pedoman Sistem Informasi Madrasah'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.4', 
                pertanyaan: 'Mampu mengembangkan program baru untuk meningkatkan pencapaian target yang lebih tinggi.',
                bukti_diharapkan: ['Visi dan misi madrasah', 'Data prestasi madrasah', 'Data hasil UN 3 tahun terakhir', 'Data alumni', 'RKJM'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.5', 
                pertanyaan: 'Mampu dan terampil dalam membangun tim kerja yang efektif.',
                bukti_diharapkan: ['Bagan/struktur organisasi', 'SK', 'Tugas dan fungsi', 'Pedoman monitoring dan evaluasi', 'Pedoman reward dan punishment'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.6', 
                pertanyaan: 'Mampu menerapkan berbagai teknik pembaharuan dalam pengelolaan pembelajaran.',
                bukti_diharapkan: ['Dokumen kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Penilaian', 'Peraturan akademik', 'Notulen diskusi evaluasi'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.7', 
                pertanyaan: 'Mampu mengembangkan potensi dan meningkatkan prestasi madrasah.',
                bukti_diharapkan: ['Data prestasi madrasah 1 tahun terakhir', 'Data hasil UN 1 tahun terakhir', 'Dokumen akreditasi', 'Program ekstrakurikuler', 'Program unggulan'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.8', 
                pertanyaan: 'Merencanakan kerjasama dengan lembaga pemerintah, swasta dan masyarakat.',
                bukti_diharapkan: ['SK komite madrasah', 'AD/ART komite', 'Program kerja komite', 'Laporan kegiatan', 'MoU', 'Foto kegiatan', 'Sertifikat/plakat'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.9', 
                pertanyaan: 'Melakukan pendekatan-pendekatan dalam rangka mendapatkan dukungan dari lembaga.',
                bukti_diharapkan: ['Program kegiatan kerjasama', 'Foto kegiatan', 'Jadwal kegiatan', 'Laporan kegiatan'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.10', 
                pertanyaan: 'Memanfaatkan dan memelihara hubungan kerjasama dengan lembaga.',
                bukti_diharapkan: ['Laporan kegiatan kerja', 'Laporan monitoring/evaluasi', 'Dokumentasi foto/video'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.11', 
                pertanyaan: 'Mengaplikasikan pengembangan kurikulum yang mengacu kepada standar isi.',
                bukti_diharapkan: ['Kurikulum', 'Kalender pendidikan', 'Perangkat pembelajaran', 'Pedoman penilaian', 'Peraturan akademik', 'Buku kerja guru', 'Dokumen rapat penyusunan kurikulum'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.12', 
                pertanyaan: 'Mengaplikasikan pengembangan proses pembelajaran yang mengacu kepada standar proses.',
                bukti_diharapkan: ['Pengembangan silabus', 'RPP', 'Struktur Kurikulum', 'Pembagian jam mengajar', 'Jadwal mengajar', 'Buku teks', 'Jurnal mengajar', 'Data siswa per kelas', 'Dokumen supervisi'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.13', 
                pertanyaan: 'Mengaplikasikan sistem penilaian pembelajaran yang mengacu kepada standar penilaian.',
                bukti_diharapkan: ['Instrumen penilaian', 'Kisi-kisi soal', 'Kumpulan naskah soal', 'Analisis butir soal', 'Analisis hasil belajar', 'Laporan hasil belajar', 'Tindak lanjut penilaian', 'Dokumen PAS/PAT'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.14', 
                pertanyaan: 'Melaksanakan penjaminan mutu pencapaian standar kompetensi lulusan.',
                bukti_diharapkan: ['Program kegiatan kesiswaan', 'Laporan kegiatan kesiswaan', 'Dokumentasi', 'Laporan pembiasaan siswa', 'Kegiatan literasi', 'Data rata-rata hasil ujian 2 tahun', 'Data prestasi akademik/nonakademik'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.15', 
                pertanyaan: 'Mampu mengelola laboratorium madrasah agar dapat dimanfaatkan secara optimal.',
                bukti_diharapkan: ['Luas sesuai standar', 'Sarana pendukung laboratorium', 'Program kerja laboratorium', 'Jurnal dan laporan pengelolaan'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.16', 
                pertanyaan: 'Mampu mengelola perpustakaan madrasah dalam menyiapkan sumber belajar.',
                bukti_diharapkan: ['Luas sesuai standar', 'Sarana pendukung', 'Daftar buku induk perpustakaan', 'Laporan pengelolaan perpustakaan', 'Program kerja perpustakaan'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.17', 
                pertanyaan: 'Mampu mengelola usaha madrasah untuk pembelajaran dan pemasukan tambahan dana.',
                bukti_diharapkan: ['Data/laporan kegiatan usaha madrasah', 'Dokumentasi kegiatan (foto/video)'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.18', 
                pertanyaan: 'Mampu mengelola koperasi madrasah sebagai media praktik dan sumber belajar.',
                bukti_diharapkan: ['Instrumen hasil praktik pembelajaran', 'Foto kegiatan praktik', 'AD/ART koperasi', 'Laporan RAT'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.19', 
                pertanyaan: 'Memanfaatkan TIK dalam manajemen madrasah.',
                bukti_diharapkan: ['Fasilitas teknologi dan informasi', 'Sumber daya informasi', 'Website madrasah', 'Pedoman sistem informasi madrasah'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.20', 
                pertanyaan: 'Memanfaatkan TIK dalam pembelajaran sebagai sumber belajar dan media.',
                bukti_diharapkan: ['Ketersediaan komputer', 'Jaringan internet', 'Website madrasah', 'Email madrasah', 'Pemanfaatan TIK untuk pembelajaran'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.21', 
                pertanyaan: 'Memanfaatkan TIK dalam menjalin kerjasama dengan pihak lain.',
                bukti_diharapkan: ['Pengelola SIM', 'Fasilitas SIM', 'Surat tugas pengelola SIM', 'Pelaporan data', 'Program promosi'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.22', 
                pertanyaan: 'Memanfaatkan TIK dalam promosi program madrasah dan prestasi.',
                bukti_diharapkan: ['Pengelola SIM', 'Fasilitas SIM', 'Surat tugas pengelola SIM', 'Pelaporan data', 'Program informasi'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.23', 
                pertanyaan: 'Mampu mengembangkan sistem administrasi pengelolaan secara efektif dengan TIK.',
                bukti_diharapkan: ['Jumlah komputer dan LCD', 'Jaringan internet', 'Web sekolah', 'Email madrasah', 'Laporan absensi elektronik'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.24', 
                pertanyaan: 'Mengelola administrasi pembelajaran secara efektif dengan TIK.',
                bukti_diharapkan: ['Jumlah komputer dan LCD', 'Jaringan internet', 'Pemanfaatan TIK untuk pembelajaran (Edmodo, Google Classroom, dll)', 'Pengelolaan penilaian online'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },
            { 
                aspek_id: 'aspek_A', kode: 'A.1.25', 
                pertanyaan: 'Mampu mengembangkan sistem pengelolaan perpustakaan secara efektif dengan TIK.',
                bukti_diharapkan: ['Katalog', 'BSE', 'Akses internet', 'Komputer', 'Dokumen aplikasi layanan perpustakaan'],
                penugasan: ['Elis Harianto, S.Pd', 'Jamil Rahmat, S.Pd', 'Marhani, S.Pd', 'Ahmad Mudatsir, S.Pd']
            },

            // ══════════════════════════════════════════════
            // DIMENSI B - PELAKSANAAN TUGAS MANAJERIAL
            // Petugas: Irmayani, Wahda Nurismi, Risna Sari
            // ══════════════════════════════════════════════
            { 
                aspek_id: 'aspek_B', kode: 'B.2.1', 
                pertanyaan: 'Mampu mengembangkan RKJM, RKT/RKAM berdasarkan data hasil evaluasi 8 SNP.',
                bukti_diharapkan: ['Dokumen Evaluasi diri madrasah (EDM)', 'Dokumen RKJM dan RKT berbasis SDM'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.2', 
                pertanyaan: 'Mampu merumuskan visi-misi sebagai arah pengembangan program.',
                bukti_diharapkan: ['Visi misi yang telah ditetapkan', 'Berita acara dan daftar hadir perumusan visi misi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.3', 
                pertanyaan: 'Mampu menentukan strategi pencapaian tujuan madrasah dengan indikator terukur.',
                bukti_diharapkan: ['Program kerja', 'RKJM dan RKTM'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.4', 
                pertanyaan: 'Mampu menyusun program dengan rencana evaluasi keterlaksanaan.',
                bukti_diharapkan: ['RKJM dan RKTM', 'Rencana/program evaluasi dan monitoring'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.5', 
                pertanyaan: 'Mampu memberi contoh berdisiplin; hadir tepat waktu.',
                bukti_diharapkan: ['Daftar hadir elektronik kamad', 'Daftar hadir pada kegiatan di madrasah'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.6', 
                pertanyaan: 'Mampu melaksanakan peraturan sesuai dengan ketentuan yang berlaku.',
                bukti_diharapkan: ['Wawancara dengan warga madrasah', 'Laporan kehadiran', 'Notulen rapat/briefing'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.7', 
                pertanyaan: 'Mampu menunjukkan keteladanan dalam memanfaatkan sumber daya secara efektif.',
                bukti_diharapkan: ['Wawancara dengan warga madrasah', 'Dokumen monitoring pemanfaatan sumber belajar', 'Notulensi rapat'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.8', 
                pertanyaan: 'Mampu menunjukkan kedisiplinan sebagai insan pembelajar.',
                bukti_diharapkan: ['Koleksi buku referensi', 'Karya tulis', 'Majalah/koran madrasah', 'Website madrasah', 'Blog pribadi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.9', 
                pertanyaan: 'Mampu menjadi contoh dan berbudaya mutu yang kompetitif.',
                bukti_diharapkan: ['Peningkatan KKM', 'Hasil UN', 'Program keunggulan akademik/nonakademik', 'Data prestasi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.10', 
                pertanyaan: 'Mampu melengkapi sarana dan prasarana untuk menciptakan suasana belajar kondusif.',
                bukti_diharapkan: ['Observasi lingkungan madrasah (asri, bersih, rindang, aman)'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.11', 
                pertanyaan: 'Mampu memfasilitasi kegiatan untuk meningkatkan budaya baca dan tulis.',
                bukti_diharapkan: ['Rencana dan laporan kegiatan literasi', 'Dokumen budaya baca', 'Pajangan karya tulis siswa', 'Data kunjungan perpustakaan', 'Data peminjaman buku'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.12', 
                pertanyaan: 'Mampu memfasilitasi kegiatan lomba akademik dan nonakademik.',
                bukti_diharapkan: ['Dokumen penyelenggaraan kompetisi', 'Daftar perolehan piagam/piala/trofi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.13', 
                pertanyaan: 'Mampu menyusun perencanaan pengembangan pendidik dan tenaga kependidikan.',
                bukti_diharapkan: ['Program kerja kepala madrasah', 'Laporan workshop/pelatihan', 'Dokumentasi kegiatan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.14', 
                pertanyaan: 'Mampu melakukan pembinaan berkala untuk meningkatkan mutu SDM.',
                bukti_diharapkan: ['Buku/catatan pembinaan guru dan tendik', 'Notulen dan daftar hadir rapat pembinaan', 'Laporan kinerja'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.15', 
                pertanyaan: 'Memfasilitasi guru dan staf administrasi untuk meningkatkan kompetensi.',
                bukti_diharapkan: ['Buku/catatan pembinaan', 'Notulen dan daftar hadir rapat pembinaan', 'Laporan kinerja'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.16', 
                pertanyaan: 'Memantau dan menilai penerapan hasil pelatihan dalam pekerjaan.',
                bukti_diharapkan: ['Program pelatihan pengembangan profesi', 'Laporan pelaksanaan pelatihan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.17', 
                pertanyaan: 'Mampu mengelola fasilitas prasarana, perabot dan sarana madrasah.',
                bukti_diharapkan: ['Buku Inventaris', 'Buku pemeliharaan sarana dan prasarana'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.18', 
                pertanyaan: 'Mampu mengelola perpustakaan madrasah.',
                bukti_diharapkan: ['Buku induk perpustakaan', 'Buku data grafik layanan perpustakaan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.19', 
                pertanyaan: 'Mampu mengelola laboratorium madrasah.',
                bukti_diharapkan: ['Daftar inventaris laboratorium', 'Buku/jurnal/data/grafik layanan laboratorium'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.20', 
                pertanyaan: 'Mampu mengelola fasilitas penunjang madrasah lainnya.',
                bukti_diharapkan: ['Data fasilitas penunjang wirausaha yang dikelola madrasah'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.21', 
                pertanyaan: 'Menyusun perencanaan penerimaan, pengelolaan dan pengembangan kompetensi peserta didik.',
                bukti_diharapkan: ['Dokumen program PPDB', 'Brosur', 'Data hasil analisis kemampuan peserta didik baru', 'Hasil psikotes'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.22', 
                pertanyaan: 'Memiliki program pengembangan potensi diri dan prestasi peserta didik.',
                bukti_diharapkan: ['Program pengembangan diri akademik/nonakademik', 'Laporan pengembangan diri'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.23', 
                pertanyaan: 'Memfasilitasi kegiatan pembiasaan melalui penanaman nilai-nilai.',
                bukti_diharapkan: ['Program kegiatan akademik dan nonakademik', 'Laporan pembiasaan diri', 'Dokumentasi kegiatan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.24', 
                pertanyaan: 'Memfasilitasi kegiatan pengembangan diri bagi peserta didik, pendidik, dan tendik.',
                bukti_diharapkan: ['Program kegiatan pengembangan diri', 'Dokumen kegiatan', 'Data prestasi siswa/guru/tendik'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.25', 
                pertanyaan: 'Mampu mengarahkan pengembangan KTSP melalui IHT, Workshop, MGMP/KKG.',
                bukti_diharapkan: ['Dokumen kurikulum yang berlaku', 'SK tim pengembangan kurikulum', 'Dokumen penyusunan kurikulum', 'Laporan kegiatan workshop'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.26', 
                pertanyaan: 'Mampu mengendalikan pelaksanaan KTSP berlandaskan kalender pendidikan.',
                bukti_diharapkan: ['Struktur kurikulum', 'Jadwal pelajaran', 'Daftar hadir guru', 'Peraturan akademik', 'Kalender pendidikan', 'SK pembagian tugas mengajar'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.27', 
                pertanyaan: 'Memfasilitasi efektivitas tim kerja guru dalam meningkatkan mutu pembelajaran.',
                bukti_diharapkan: ['Program KKG/MGMP di madrasah', 'Laporan pelaksanaan KKG/MGMP', 'Dokumentasi kegiatan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.28', 
                pertanyaan: 'Mampu mengembangkan pelayanan belajar yang inovatif.',
                bukti_diharapkan: ['Observasi kelas', 'Ragam metode/media/sumber belajar dalam RPP'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.29', 
                pertanyaan: 'Memfasilitasi peserta didik dalam kolaborasi dan kompetisi akademik/nonakademik.',
                bukti_diharapkan: ['Program/laporan kegiatan kesiswaan', 'Data prestasi', 'Dokumentasi kegiatan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.30', 
                pertanyaan: 'Mampu merencanakan kebutuhan keuangan madrasah.',
                bukti_diharapkan: ['RKJM dan RKTM', 'Rencana anggaran', 'Laporan keuangan', 'Buku kas'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.31', 
                pertanyaan: 'Mampu mengupayakan sumber-sumber keuangan dari luar madrasah.',
                bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.32', 
                pertanyaan: 'Mampu mengkoordinasikan pengelolaan keuangan sesuai peraturan.',
                bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.33', 
                pertanyaan: 'Mampu membuat laporan dan evaluasi pengelolaan keuangan.',
                bukti_diharapkan: ['RKJM dan RKTM', 'Laporan keuangan', 'Buku kas'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.34', 
                pertanyaan: 'Mampu mengelola administrasi surat masuk dan keluar.',
                bukti_diharapkan: ['Dokumen surat masuk dan keluar'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.35', 
                pertanyaan: 'Mampu mengelola administrasi madrasah (akademik, kesiswaan, sarpras, keuangan, humas).',
                bukti_diharapkan: ['Studi dokumen administrasi akademik, kesiswaan, sarpras, keuangan, humas'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.36', 
                pertanyaan: 'Mampu mengelola administrasi kearsipan madrasah.',
                bukti_diharapkan: ['Administrasi madrasah', 'Arsip administrasi', 'SOP administrasi madrasah'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.37', 
                pertanyaan: 'Mampu mengelola administrasi akreditasi madrasah.',
                bukti_diharapkan: ['Dokumen administrasi pemenuhan SNP madrasah'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.38', 
                pertanyaan: 'Menyusun standar kinerja program pendidikan yang terukur.',
                bukti_diharapkan: ['Dokumen SKP yang terukur'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.39', 
                pertanyaan: 'Melakukan monitoring dan evaluasi kinerja program pendidikan.',
                bukti_diharapkan: ['Dokumen pelaksanaan monitoring dan evaluasi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.40', 
                pertanyaan: 'Menyusun laporan sesuai standar pelaporan monitoring dan evaluasi.',
                bukti_diharapkan: ['Dokumen laporan pelaksanaan monitoring dan evaluasi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },
            { 
                aspek_id: 'aspek_B', kode: 'B.2.41', 
                pertanyaan: 'Merumuskan program tindak lanjut berdasarkan hasil evaluasi.',
                bukti_diharapkan: ['Dokumen laporan pelaksanaan monitoring dan evaluasi'],
                penugasan: ['Irmayani, S.Pd', 'Wahda Nurismi, S.Pd', 'Risna Sari, S.Pd']
            },

            // ══════════════════════════════════════════════
            // DIMENSI C - PENGEMBANGAN KEWIRAUSAHAAN
            // Petugas: Niar, Muniratul Asri, Marwah
            // ══════════════════════════════════════════════
            { 
                aspek_id: 'aspek_C', kode: 'C.3.1', 
                pertanyaan: 'Memahami dan menghayati arti dan tujuan perubahan (inovasi) madrasah.',
                bukti_diharapkan: ['Program pengembangan kewirausahaan', 'Profil madrasah beberapa tahun terakhir'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.2', 
                pertanyaan: 'Menggunakan metode, teknik dan proses perubahan madrasah.',
                bukti_diharapkan: ['Pemanfaatan hasil inovasi dan kreatifitas', 'Membudayakan hasil inovasi', 'Pengembangan pembudayaan inovasi'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.3', 
                pertanyaan: 'Menumbuhkan iklim yang mendorong kebebasan berpikir kreatif dan inovatif.',
                bukti_diharapkan: ['Data jenis usaha produktif', 'Program pengelolaan dan pendayagunaan hasil usaha'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.4', 
                pertanyaan: 'Mendorong warga madrasah untuk melakukan prakarsa/keberanian moral.',
                bukti_diharapkan: ['Data jenis usaha produktif', 'Program pengelolaan dan pendayagunaan hasil usaha'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.5', 
                pertanyaan: 'Mampu bertindak kreatif dan inovatif dalam melaksanakan pekerjaan.',
                bukti_diharapkan: ['RPP yang memuat rencana pembelajaran kreatif', 'Hasil kerja dan karya siswa', 'Foto aktivitas pembelajaran'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.6', 
                pertanyaan: 'Mampu memberdayakan potensi madrasah secara optimal.',
                bukti_diharapkan: ['Rencana Pengembangan Madrasah (RPM)', 'Dokumen penanganan permasalahan', 'Dokumen hasil kegiatan', 'Dokumen hasil pengembangan'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.7', 
                pertanyaan: 'Mampu menumbuhkan jiwa kewirausahaan di kalangan warga madrasah.',
                bukti_diharapkan: ['Rencana Pengembangan Madrasah (RPM)', 'Dokumen penanganan permasalahan', 'Dokumen hasil kegiatan', 'Dokumen hasil pengembangan'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.8', 
                pertanyaan: 'Mampu mencatat ide-ide baru.',
                bukti_diharapkan: ['Rencana Pengembangan Madrasah'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.9', 
                pertanyaan: 'Bersedia belajar dari orang lain.',
                bukti_diharapkan: ['Forum komunikasi dengan lembaga lain dan orang tua', 'Foto kegiatan', 'Komunitas/forum yang diikuti'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.10', 
                pertanyaan: 'Ingin selalu melakukan yang terbaik.',
                bukti_diharapkan: ['Dokumen/foto pelaksanaan kegiatan', 'Keikutsertaan dalam lomba-lomba'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.11', 
                pertanyaan: 'Menciptakan perubahan yang kuat.',
                bukti_diharapkan: ['Program inovasi madrasah atau RPM', 'Laporan target yang sudah dicapai'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.12', 
                pertanyaan: 'Mampu melibatkan tokoh agama, masyarakat, dan pemerintah dalam memecahkan masalah.',
                bukti_diharapkan: ['MoU dengan pihak lain', 'Sister school kemitraan'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.13', 
                pertanyaan: 'Mampu bersikap obyektif dalam mengatasi konflik internal madrasah.',
                bukti_diharapkan: ['Observasi, wawancara, studi dokumen kegiatan/foto'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.14', 
                pertanyaan: 'Mampu bersikap simpatik/tenggang rasa terhadap orang lain.',
                bukti_diharapkan: ['Observasi, wawancara, studi dokumen kegiatan dan foto'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.15', 
                pertanyaan: 'Mampu merencanakan kegiatan produksi/jasa sesuai potensi madrasah.',
                bukti_diharapkan: ['Dokumen laporan pelaksanaan dan hasil program pengembangan unit produksi kewirausahaan'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.16', 
                pertanyaan: 'Mampu membina kegiatan produksi/jasa sesuai prinsip profesional dan akuntabel.',
                bukti_diharapkan: ['Dokumen laporan pelaksanaan dan hasil Program Pengembangan Unit Produksi Kewirausahaan'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.17', 
                pertanyaan: 'Mampu melaksanakan pengawasan kegiatan produksi/jasa dan menyusun laporan.',
                bukti_diharapkan: ['Laporan hasil Evaluasi Program Pengembangan Kewirausahaan', 'Program Pengembangan Jiwa Kewirausahaan', 'Program Pengembangan Unit Produksi'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_C', kode: 'C.3.18', 
                pertanyaan: 'Mampu mengembangkan kegiatan produksi/jasa dan pemasarannya.',
                bukti_diharapkan: ['Laporan hasil Evaluasi Program Pengembangan Kewirausahaan', 'Program Pengembangan Jiwa Kewirausahaan', 'Program Pengembangan Unit Produksi'],
                penugasan: ['Niar, S.Pd', 'Muniratul Asri, S.Pd', 'Marwah, S.Pd.I']
            },

            // ══════════════════════════════════════════════
            // DIMENSI D - SUPERVISI
            // Petugas: Nursyam, Atikah, Haerani
            // ══════════════════════════════════════════════
            { 
                aspek_id: 'aspek_D', kode: 'D.4.1', 
                pertanyaan: 'Mengidentifikasi masalah yang guru hadapi dalam pelaksanaan pembelajaran.',
                bukti_diharapkan: ['Program pengawasan/supervisi pembelajaran', 'Jadwal pelaksanaan supervisi', 'SK tim supervisor'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.2', 
                pertanyaan: 'Mampu merumuskan tujuan supervisi yang dilengkapi target terukur.',
                bukti_diharapkan: ['Program pengawasan/supervisi pembelajaran', 'Jadwal pelaksanaan supervisi', 'Laporan hasil supervisi'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.3', 
                pertanyaan: 'Mampu mengembangkan instrumen supervisi.',
                bukti_diharapkan: ['Instrumen supervisi pembelajaran'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.4', 
                pertanyaan: 'Mengadakan pertemuan awal untuk menjaring data rencana pembelajaran.',
                bukti_diharapkan: ['Program pengawasan/supervisi', 'Jadwal supervisi', 'Daftar hadir, notulen, foto pertemuan awal'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.5', 
                pertanyaan: 'Melaksanakan kegiatan pemantauan pembelajaran dan membuat catatan objektif.',
                bukti_diharapkan: ['Instrumen supervisi pembelajaran', 'Laporan hasil supervisi', 'Catatan rekomendasi', 'Rencana tindak lanjut'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.6', 
                pertanyaan: 'Melakukan pertemuan refleksi dan menganalisis catatan hasil observasi.',
                bukti_diharapkan: ['Analisis hasil supervisi', 'Catatan rekomendasi', 'Daftar hadir, notulen, foto pertemuan refleksi'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.7', 
                pertanyaan: 'Bersama guru menyusun rekomendasi tindaklanjut perbaikan.',
                bukti_diharapkan: ['Dokumen hasil analisis dan tindak lanjut supervisi', 'Program workshop/diklat penilaian', 'Hasil analisis butir soal', 'Program remedial dan pengayaan'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.8', 
                pertanyaan: 'Memfasilitasi guru dalam merencanakan tindak lanjut perbaikan sistem penilaian.',
                bukti_diharapkan: ['Dokumen hasil analisis dan tindak lanjut supervisi', 'Hasil workshop/diklat', 'Data dan piagam hasil pelatihan'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.9', 
                pertanyaan: 'Mengecek ulang keterlaksanaan rekomendasi oleh guru.',
                bukti_diharapkan: ['Dokumen rekomendasi perbaikan sistem penilaian hasil belajar'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.10', 
                pertanyaan: 'Melaksanakan pembinaan dan pengembangan guru sebagai tindak lanjut supervisi.',
                bukti_diharapkan: ['Laporan tindak lanjut supervisi', 'Program PKB guru', 'Laporan kegiatan pembinaan', 'Daftar hadir, notulen, foto PKB'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_D', kode: 'D.4.11', 
                pertanyaan: 'Menggunakan data hasil supervisi untuk pemetaan ketercapaian program.',
                bukti_diharapkan: ['Program PKB guru', 'Laporan kegiatan pembinaan', 'Daftar hadir, notulen, foto PKB'],
                penugasan: ['Nursyam, S.Pd', 'Atikah, S.Pd.I', 'Haerani, S.Pd.I']
            },

            // ══════════════════════════════════════════════
            // DIMENSI E - HASIL KINERJA KEPALA MADRASAH
            // Petugas: Sumarni, Khaerul, Hj. Murniati Mahdi
            // ══════════════════════════════════════════════
            { 
                aspek_id: 'aspek_E', kode: 'E.5.1', 
                pertanyaan: 'Prestasi akademik peserta didik.',
                bukti_diharapkan: ['Piagam/sertifikat kejuaraan akademik (tingkat kecamatan s.d. nasional)'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.2', 
                pertanyaan: 'Prestasi non akademik peserta didik.',
                bukti_diharapkan: ['Piagam/sertifikat kejuaraan nonakademik (tingkat kecamatan s.d. nasional)'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.3', 
                pertanyaan: 'Prestasi akademik pendidik dan tenaga kependidikan.',
                bukti_diharapkan: ['Piagam/sertifikat kejuaraan akademik GTK'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.4', 
                pertanyaan: 'Prestasi non akademik pendidik dan tenaga kependidikan.',
                bukti_diharapkan: ['Piagam/sertifikat kejuaraan nonakademik GTK'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.5', 
                pertanyaan: 'Kelebihan prestasi akademik madrasah dari sekolah lainnya.',
                bukti_diharapkan: ['Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.6', 
                pertanyaan: 'Kelebihan prestasi non akademik madrasah dari sekolah lainnya.',
                bukti_diharapkan: ['Dokumen peringkat madrasah (tingkat kecamatan s.d. nasional)'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.7', 
                pertanyaan: 'Kelebihan prestasi akademik dan non akademik GTK.',
                bukti_diharapkan: ['Dokumen peringkat GTK'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.8', 
                pertanyaan: 'Ijazah yang dimiliki kepala madrasah.',
                bukti_diharapkan: ['Fotokopi Ijazah terakhir Kepala Madrasah (S1/S2/S3)'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.9', 
                pertanyaan: 'Pendidikan dan pelatihan yang pernah diikuti kepala madrasah.',
                bukti_diharapkan: ['Sertifikat STTPL/Diklat minimal 3 buah'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.10', 
                pertanyaan: 'Penguasaan ICT kepala madrasah.',
                bukti_diharapkan: ['Sertifikat pelatihan Microsoft Office/Internet'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.11', 
                pertanyaan: 'Prestasi yang diraih oleh kepala madrasah.',
                bukti_diharapkan: ['Piagam/sertifikat kejuaraan kepala madrasah'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.12', 
                pertanyaan: 'Kegiatan penelitian kependidikan yang telah dilakukan kepala madrasah.',
                bukti_diharapkan: ['Laporan Penelitian Tindakan Sekolah (PTS) / Karya Tulis Ilmiah'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.13', 
                pertanyaan: 'Kegiatan pelibatan komite dalam mendukung program madrasah.',
                bukti_diharapkan: ['Dokumentasi pelibatan komite dan stakeholder'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            },
            { 
                aspek_id: 'aspek_E', kode: 'E.5.14', 
                pertanyaan: 'Kegiatan kemitraan dengan stakeholder pendidikan dalam meningkatkan kompetensi guru.',
                bukti_diharapkan: ['Dokumen kemitraan dengan stakeholder pendidikan'],
                penugasan: ['Sumarni, S.E.', 'Khaerul, S.Ag', 'Hj. Murniati Mahdi, S.Pd.I']
            }
        ];

        // Simpan indikator ke Firestore
        for (const ind of indikatorList) {
            const docId = `butir_${ind.aspek_id.replace('aspek_', '')}_${ind.kode.replace(/\./g, '_')}`;
            await db.collection('pkkm_indikator').doc(docId).set(ind);
        }

        // C. SETUP USER GURU (Metadata di Firestore)
        // Catatan: User harus dibuat manual di Firebase Authentication
        const guruList = [
            { nama: "Natsir, S.Pd.I", email: "natsir@mahasyimasyari.sch.id", role: "kepala" },
            { nama: "Jamil Rahmat, S.Pd", email: "jamil@mahasyimasyari.sch.id", role: "guru" },
            { nama: "Elis Harianto, S.Pd", email: "elis@mahasyimasyari.sch.id", role: "guru" },
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

        for (const guru of guruList) {
            // Gunakan email sebagai ID dokumen untuk memudahkan lookup
            await db.collection('users').doc(guru.email.replace(/[@.]/g, '_')).set(guru);
        }

        alert(`✅ Setup Data PKKM Berhasil!\n\n📊 Data yang dibuat:\n• 5 Dimensi PKKM (A, B, C, D, E)\n• ${indikatorList.length} Indikator dengan bukti fisik lengkap\n• 17 Data Guru dengan penugasan otomatis\n\nSilakan refresh halaman.`);
        loadPKKMData();
    } catch (error) {
        console.error(error);
        alert("❌ Gagal setup: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-database"></i> Setup Data Awal PKKM (Admin Only)';
    }
};
