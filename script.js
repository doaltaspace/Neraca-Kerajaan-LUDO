const inputTargetTabungan = document.getElementById('inputTargetTabungan');
const tabunganProgress = document.getElementById('tabunganProgress');
const persenTabungan = document.getElementById('persenTabungan');
const statusTotalTabungan = document.getElementById('statusTotalTabungan');
const statusSisaTarget = document.getElementById('statusSisaTarget');

const totalPendapatanUI = document.getElementById('totalPendapatanUI');
const totalTabunganUI = document.getElementById('totalTabunganUI');
const totalPengeluaranUI = document.getElementById('totalPengeluaranUI');
const sisaOperasionalUI = document.getElementById('sisaOperasionalUI');

const tabelBukuBesar = document.getElementById('tabelBukuBesar');
const emptyLedgerMessage = document.getElementById('emptyLedgerMessage');

const viewDashboard = document.getElementById('viewDashboard');
const viewLedger = document.getElementById('viewLedger');
const tabDashboardBtn = document.getElementById('tabDashboard');
const tabLedgerBtn = document.getElementById('tabLedger');
const missionBarsStage = document.getElementById('missionBarsStage');
const missionBarsList = document.getElementById('missionBarsList');
const missionBarsEmpty = document.getElementById('missionBarsEmpty');
const missionDetailCard = document.getElementById('missionDetailCard');
const missionDetailTitle = document.getElementById('missionDetailTitle');
const missionDetailMeta = document.getElementById('missionDetailMeta');
const missionDetailAmount = document.getElementById('missionDetailAmount');
const missionDetailMessage = document.getElementById('missionDetailMessage');

const openStatusMisiBtn = document.getElementById('openStatusMisiBtn');
const closeStatusMisiBtn = document.getElementById('closeStatusMisiBtn');
const statusMisiModal = document.getElementById('statusMisiModal');
const statusMisiBackdrop = document.getElementById('statusMisiBackdrop');

let neracaChartInst;
let transactions = [];

const kategoriAliasMisi = {
    'Emas Batangan': 'EMAS',
    'Rekening Rahasia': 'REKENING',
    'Saham/Investasi': 'INVESTASI'
};

const kategoriWarnaMisi = {
    'Emas Batangan': {
        start: '#22c55e',
        end: '#4ade80',
        chip: '#bbf7d0'
    },
    'Rekening Rahasia': {
        start: '#0ea5e9',
        end: '#38bdf8',
        chip: '#bae6fd'
    },
    'Saham/Investasi': {
        start: '#f59e0b',
        end: '#fbbf24',
        chip: '#fde68a'
    },
    default: {
        start: '#64748b',
        end: '#94a3b8',
        chip: '#e2e8f0'
    }
};

let selectedMissionKey = '';

const formatRp = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

const escapeHtml = (value) => {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const getCurrentDateString = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

const ambilDataMisiTabungan = () => {
    const misiMap = new Map();

    transactions.forEach((tx) => {
        if (tx.type !== 'saving') return;

        const namaBersih = tx.name.trim();
        if (!namaBersih) return;

        const key = namaBersih.toLowerCase();
        if (!misiMap.has(key)) {
            misiMap.set(key, {
                name: namaBersih,
                category: tx.category || '',
                total: 0
            });
        }

        const misi = misiMap.get(key);
        misi.total += tx.amount;
        if (tx.category) misi.category = tx.category;
    });

    return Array.from(misiMap.values()).sort((a, b) => b.total - a.total);
};

const formatLabelMisi = (misi) => {
    const namaUpper = misi.name.toUpperCase();
    if (namaUpper.includes('(') && namaUpper.includes(')')) return namaUpper;

    const alias = kategoriAliasMisi[misi.category] || 'MISI';
    return `${namaUpper} (${alias})`;
};

const getMissionKey = (misi) => {
    return `${misi.name.trim().toLowerCase()}::${misi.category || '-'}`;
};

const getWarnaMisi = (kategori) => {
    return kategoriWarnaMisi[kategori] || kategoriWarnaMisi.default;
};

const getNarasiMisi = (misi, persenRaw, targetTabungan) => {
    const persen = Math.round(persenRaw);
    const kategori = (misi.category || 'misi').toLowerCase();

    if (targetTabungan <= 0) {
        return `Target tabungan kerajaan belum diatur. Persentase saat ini memakai misi terkuat sebagai pembanding.`;
    }
    if (persen < 30) {
        return `${persen}% masih fase awal untuk ${kategori}. Tambah setoran rutin agar laju misi ini makin terasa.`;
    }
    if (persen < 60) {
        return `${persen}% sudah bergerak, tapi masih perlu dorongan agar misi ${kategori} tidak tertinggal.`;
    }
    if (persen < 85) {
        return `${persen}% termasuk solid. Pertahankan ritme supaya misi ${kategori} segera tembus garis aman.`;
    }
    return `${persen}% sangat kuat. Misi ${kategori} sudah jadi tulang punggung tabungan kerajaan.`;
};

const setActiveMissionRow = () => {
    if (!missionBarsList) return;

    const rows = missionBarsList.querySelectorAll('.mission-bar-row');
    rows.forEach((row) => {
        const isActive = row.dataset.missionKey === selectedMissionKey;
        row.classList.toggle('active', isActive);
    });
};

const updateMissionDetail = (misi, persenRaw, targetTabungan, totalMisi) => {
    if (!missionDetailCard || !missionDetailTitle || !missionDetailMeta || !missionDetailAmount || !missionDetailMessage) {
        return;
    }

    const warna = getWarnaMisi(misi.category);
    const persenBulat = Math.round(persenRaw);
    const sourceLabel = targetTabungan > 0 ? 'target kerajaan' : 'misi tabungan terbesar';

    missionDetailCard.classList.remove('hidden');
    missionDetailCard.style.setProperty('--detail-accent', warna.start);

    missionDetailTitle.textContent = formatLabelMisi(misi);
    missionDetailMeta.textContent = `${persenBulat}% dari ${sourceLabel} · ${totalMisi} misi aktif`;
    missionDetailAmount.textContent = formatRp(misi.total);
    missionDetailMessage.textContent = getNarasiMisi(misi, persenRaw, targetTabungan);
};

const renderMissionBars = (targetTabungan) => {
    if (!missionBarsList || !missionBarsEmpty) return;

    const daftarMisi = ambilDataMisiTabungan().slice(0, 6);
    missionBarsList.innerHTML = '';

    if (daftarMisi.length === 0) {
        if (missionBarsStage) {
            missionBarsStage.classList.add('is-empty');
        }
        missionBarsEmpty.classList.remove('hidden');
        selectedMissionKey = '';
        if (missionDetailCard) {
            missionDetailCard.classList.add('hidden');
        }
        return;
    }

    if (missionBarsStage) {
        missionBarsStage.classList.remove('is-empty');
    }
    missionBarsEmpty.classList.add('hidden');

    const pembagi = targetTabungan > 0
        ? targetTabungan
        : Math.max(...daftarMisi.map((misi) => misi.total), 1);

    const daftarRender = daftarMisi.map((misi) => {
        const persenRaw = pembagi > 0 ? (misi.total / pembagi) * 100 : 0;
        const warna = getWarnaMisi(misi.category);
        return {
            ...misi,
            key: getMissionKey(misi),
            persenRaw,
            persenLabel: Math.round(persenRaw),
            persenBar: Math.max(0, Math.min(100, persenRaw)),
            warna
        };
    });

    if (!selectedMissionKey || !daftarRender.some((item) => item.key === selectedMissionKey)) {
        selectedMissionKey = daftarRender[0].key;
    }

    daftarRender.forEach((item) => {
        const kategoriLabel = item.category || 'Umum';

        const row = document.createElement('div');
        row.className = 'mission-bar-row';
        row.dataset.missionKey = item.key;
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.innerHTML = `
            <div class="mission-bar-head">
                <span class="mission-bar-label">
                    ${escapeHtml(formatLabelMisi(item))}
                    <span class="mission-bar-category" style="--chip-bg:${item.warna.chip};">${escapeHtml(kategoriLabel)}</span>
                </span>
                <span class="mission-bar-percent">${item.persenLabel}%</span>
            </div>
            <div class="mission-bar-track">
                <div class="mission-bar-fill" style="--bar-width:${item.persenBar}%;--bar-start:${item.warna.start};--bar-end:${item.warna.end};"></div>
            </div>
            <p class="mission-bar-nominal">${escapeHtml(formatRp(item.total))}</p>
        `;

        const pilihMisi = () => {
            selectedMissionKey = item.key;
            setActiveMissionRow();
            updateMissionDetail(item, item.persenRaw, targetTabungan, daftarRender.length);
        };

        row.addEventListener('click', pilihMisi);
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                pilihMisi();
            }
        });

        missionBarsList.appendChild(row);
    });

    const misiAktif = daftarRender.find((item) => item.key === selectedMissionKey) || daftarRender[0];
    selectedMissionKey = misiAktif.key;
    setActiveMissionRow();
    updateMissionDetail(misiAktif, misiAktif.persenRaw, targetTabungan, daftarRender.length);
};

const bukaStatusMisiModal = () => {
    if (!statusMisiModal) return;
    statusMisiModal.classList.remove('hidden');
    statusMisiModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
};

const tutupStatusMisiModal = () => {
    if (!statusMisiModal) return;
    statusMisiModal.classList.add('hidden');
    statusMisiModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
};

const inisialisasiChart = () => {
    const ctx = document.getElementById('neracaChart').getContext('2d');
    
    Chart.defaults.font.family = "'Fredoka', sans-serif";
    Chart.defaults.font.size = 14;
    Chart.defaults.font.weight = 'bold';
    Chart.defaults.color = '#000';

    neracaChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Tabungan', 'Total Pengeluaran'],
            datasets: [{
                data: [1, 1], // Dimulai dengan data minimal (agar nampak)
                backgroundColor: ['#22c55e', '#ef4444'], // Hijau tabungan, merah pengeluaran
                borderColor: '#000000',
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { 
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 14, weight: '900' }
                    }
                },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: { size: 14 },
                    bodyFont: { size: 16, weight: 'bold' },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ' ' + formatRp(context.raw);
                        }
                    }
                }
            }
        }
    });
};

const catatTransaksi = (type) => {
    let namaInput, jumlahInput, kategoriInput;

    if (type === 'income') {
        // Pemasukan disembunyikan sementara, kode tetap bisa berjalan jika elemennya ada.
        namaInput = document.getElementById('namaPendapatan') || { value: '' };
        jumlahInput = document.getElementById('jumlahPendapatan') || { value: 0 };
        kategoriInput = document.getElementById('kategoriPendapatan') || { value: '' };
    } else if (type === 'saving') {
        namaInput = document.getElementById('namaTabungan');
        jumlahInput = document.getElementById('jumlahTabungan');
        kategoriInput = document.getElementById('kategoriTabungan');
    } else if (type === 'expense') {
        namaInput = document.getElementById('namaPengeluaran');
        jumlahInput = document.getElementById('jumlahPengeluaran');
        kategoriInput = document.getElementById('kategoriPengeluaran');
    }

    const nama = namaInput.value ? namaInput.value.trim() : '';
    const jumlah = Number(jumlahInput.value) || 0;
    const kategori = kategoriInput.value;

    if (nama === '' || jumlah <= 0) return;

    const tx = {
        id: Date.now(),
        date: getCurrentDateString(),
        type: type,
        category: kategori,
        name: nama,
        amount: jumlah
    };

    transactions.unshift(tx);

    namaInput.value = '';
    jumlahInput.value = '';

    updateKalkulasi();
    renderLedger();
};

const updateKalkulasi = () => {
    let totalHarta = 0;
    let totalTabungan = 0;
    let totalPengeluaran = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') totalHarta += tx.amount;
        if (tx.type === 'saving') totalTabungan += tx.amount;
        if (tx.type === 'expense') totalPengeluaran += tx.amount;
    });

    const targetTabungan = Number(inputTargetTabungan?.value) || 0;

    const danaOpsAlokasi = totalHarta * 0.50;

    let persentase = 0;
    if (targetTabungan > 0) {
        persentase = (totalTabungan / targetTabungan) * 100;
    }
    if (persentase > 100) persentase = 100;

    if (tabunganProgress) {
        tabunganProgress.style.width = `${persentase}%`;
    }
    if (persenTabungan) {
        persenTabungan.textContent = Math.round(persentase);
    }

    const sisaOps = danaOpsAlokasi - totalPengeluaran;

    if (totalPendapatanUI) {
        totalPendapatanUI.textContent = formatRp(totalHarta);
    }
    sisaOperasionalUI.textContent = formatRp(sisaOps);
    totalTabunganUI.textContent = formatRp(totalTabungan);
    totalPengeluaranUI.textContent = formatRp(totalPengeluaran);

    const sisaTarget = Math.max(targetTabungan - totalTabungan, 0);
    if (statusTotalTabungan) {
        statusTotalTabungan.textContent = formatRp(totalTabungan);
    }
    if (statusSisaTarget) {
        statusSisaTarget.textContent = formatRp(sisaTarget);
    }

    neracaChartInst.data.datasets[0].data = [
        totalTabungan, 
        totalPengeluaran
    ];
    neracaChartInst.update();

    renderMissionBars(targetTabungan);
};

const renderLedger = () => {
    tabelBukuBesar.innerHTML = '';
    
    if (transactions.length === 0) {
        emptyLedgerMessage.style.display = 'block';
        return;
    }
    emptyLedgerMessage.style.display = 'none';

    transactions.forEach(tx => {
        const tr = document.createElement('tr');
        tr.className = "border-b-4 border-black border-dashed";
        
        let rowBgClass = "";
        let amountFormat = "";
        let typeIcon = "";
        let typeLabel = "";

        if (tx.type === 'income') {
            rowBgClass = "bg-blue-50";
            amountFormat = `<span class="text-blue-700">+${formatRp(tx.amount)}</span>`;
            typeIcon = "📥";
            typeLabel = "Pemasukan";
        } else if (tx.type === 'saving') {
            rowBgClass = "bg-green-50";
            amountFormat = `<span class="text-green-700">🔒 ${formatRp(tx.amount)}</span>`;
            typeIcon = "💎";
            typeLabel = "Tabungan";
        } else if (tx.type === 'expense') {
            rowBgClass = "bg-red-50";
            amountFormat = `<span class="text-red-700">-${formatRp(tx.amount)}</span>`;
            typeIcon = "🔥";
            typeLabel = "Pengeluaran";
        }

        tr.classList.add(rowBgClass);
        
        tr.innerHTML = `
            <td class="p-4 border-r-4 border-black whitespace-nowrap text-sm">${tx.date}</td>
            <td class="p-4 border-r-4 border-black">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${typeIcon}</span>
                    <div>
                        <div class="font-black uppercase text-sm">${typeLabel}</div>
                        <div class="text-xs text-gray-600">${tx.category}</div>
                    </div>
                </div>
            </td>
            <td class="p-4 border-r-4 border-black">${tx.name}</td>
            <td class="p-4 text-right font-black text-xl">${amountFormat}</td>
        `;
        tabelBukuBesar.appendChild(tr);
    });
};

const switchView = (viewId) => {
    if (viewId === 'dashboard') {
        viewDashboard.classList.remove('hidden');
        viewLedger.classList.add('hidden');
        tabDashboardBtn.classList.add('active');
        tabLedgerBtn.classList.remove('active');
    } else {
        viewDashboard.classList.add('hidden');
        viewLedger.classList.remove('hidden');
        tabDashboardBtn.classList.remove('active');
        tabLedgerBtn.classList.add('active');
        renderLedger();
    }
};

let currentSlideNumber = 1;

const changeSlide = (direction) => {
    currentSlideNumber += direction;
    if (currentSlideNumber > 2) currentSlideNumber = 1;
    if (currentSlideNumber < 1) currentSlideNumber = 2;

    const slideNeraca = document.getElementById('slideNeraca');
    const slideTarget = document.getElementById('slideTarget');

    if (currentSlideNumber === 1) {
        slideNeraca.classList.remove('hidden');
        slideTarget.classList.add('hidden');
        requestAnimationFrame(() => {
            if (neracaChartInst) neracaChartInst.resize();
        });
    } else {
        slideNeraca.classList.add('hidden');
        slideTarget.classList.remove('hidden');
        renderMissionBars(Number(inputTargetTabungan?.value) || 0);
    }
};

if (openStatusMisiBtn) {
    openStatusMisiBtn.addEventListener('click', bukaStatusMisiModal);
}
if (closeStatusMisiBtn) {
    closeStatusMisiBtn.addEventListener('click', tutupStatusMisiModal);
}
if (statusMisiBackdrop) {
    statusMisiBackdrop.addEventListener('click', tutupStatusMisiModal);
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        tutupStatusMisiModal();
    }
});

inisialisasiChart();
updateKalkulasi();
renderLedger();
