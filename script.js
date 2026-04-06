/* ============================================
   NERACA KERAJAAN LUDO — Application Logic
   ============================================ */

// ===== STORAGE KEYS =====
const SK = {
  transactions: 'nk_transactions',
  goals: 'nk_goals',
  categories: 'nk_categories',
  theme: 'nk_theme',
};

// ===== DEFAULT DATA =====
const DEFAULT_CATEGORIES = [
  'Makanan',
  'Transportasi',
  'Hiburan',
  'Tagihan',
  'Belanja',
  'Kesehatan',
  'Lainnya',
];

const DEFAULT_GOALS = [
  { id: 'g_darurat', name: 'Dana Darurat', target: 0, isDefault: true },
  { id: 'g_liburan', name: 'Liburan', target: 0, isDefault: true },
  { id: 'g_gadget', name: 'Gadget', target: 0, isDefault: true },
  { id: 'g_umum', name: 'Tabungan Umum', target: 0, isDefault: true },
];

// ===== STATE =====
let state = {
  transactions: [],
  goals: [],
  categories: [],
  theme: 'light',
};

// ===== AUDIO ENGINE =====
const sfx = {
  // Clean UI variants: Soft pop, clear chime for success, modern blip for error
  pop: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
  coin: new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'),
  error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3')
};
sfx.pop.volume = 0.5;
sfx.coin.volume = 0.6;
sfx.error.volume = 0.5;

let pendingPop = null;

const playSound = (type) => {
  // Ensure we don't play generic UI click (pop) if a notification (error/coin) triggers simultaneously
  if (type === 'pop') {
    if (!pendingPop) {
      pendingPop = setTimeout(() => {
        if (sfx['pop']) {
          sfx['pop'].currentTime = 0;
          sfx['pop'].play().catch(() => {});
        }
        pendingPop = null;
      }, 30); // small delay to see if more important sounds preempt it
    }
    return;
  }

  // Cancel any queued 'pop' clicks since we have a specific audio notification to play
  if (pendingPop) {
    clearTimeout(pendingPop);
    pendingPop = null;
  }

  if (sfx[type]) {
    sfx[type].currentTime = 0;
    const p = sfx[type].play();
    if (p !== undefined) p.catch(() => {});
  }
};

// Global Listener: Memilih kolom untuk mengetik (Focus)
document.addEventListener('focusin', (e) => {
  if (e.target.closest('input, select')) {
    playSound('pop');
  }
});

// Global Listener: Segala klik
document.addEventListener('click', (e) => {
  if (e.target.closest('button, .notebook-tab, .modal-close, .slide-nav-btn, .theme-toggle')) {
    playSound('pop');
  }
});

// ===== DOM REFS =====
const $ = (id) => document.getElementById(id);

const kpiOperasional = $('kpiOperasional');
const kpiTabungan = $('kpiTabungan');
const kpiPengeluaran = $('kpiPengeluaran');
const kpiSisaSaldo = $('kpiSisaSaldo');

const expCategory = $('expCategory');
const expAmount = $('expAmount');
const expSource = $('expSource');
const expDesc = $('expDesc');

const incAmount = $('incAmount');
const incDest = $('incDest');
const incGoalGroup = $('incGoalGroup');
const incGoal = $('incGoal');
const incDesc = $('incDesc');

const trfFrom = $('trfFrom');
const trfTo = $('trfTo');
const trfAmount = $('trfAmount');
const trfDesc = $('trfDesc');

const toastContainer = $('toastContainer');

// Chart instances
let donutChartInst = null;
let barChartInst = null;
let lineChartInst = null;
let radarChartInst = null;

// ===== CHART COLORS =====
const CHART_COLORS = [
  '#5b9de9', '#47b86b', '#ef6b6b', '#9b7ef0',
  '#f6a723', '#f472b6', '#38bfb0', '#e879a8',
  '#6dd3ce', '#c2a83e',
];

// ===== UTILITIES =====
const formatRp = (n) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

const uid = () => 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const gid = () => 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ===== PERSISTENCE =====
const saveState = () => {
  try {
    localStorage.setItem(SK.transactions, JSON.stringify(state.transactions));
    localStorage.setItem(SK.goals, JSON.stringify(state.goals));
    localStorage.setItem(SK.categories, JSON.stringify(state.categories));
    localStorage.setItem(SK.theme, state.theme);
  } catch (e) {
    console.warn('Save failed:', e);
  }
};

const loadState = () => {
  try {
    const tx = localStorage.getItem(SK.transactions);
    const goals = localStorage.getItem(SK.goals);
    const cats = localStorage.getItem(SK.categories);
    const theme = localStorage.getItem(SK.theme);

    state.transactions = tx ? JSON.parse(tx) : [];
    state.goals = goals ? JSON.parse(goals) : [...DEFAULT_GOALS];
    state.categories = cats ? JSON.parse(cats) : [...DEFAULT_CATEGORIES];
    state.theme = theme || 'light';
  } catch (e) {
    console.warn('Load failed:', e);
    state.transactions = [];
    state.goals = [...DEFAULT_GOALS];
    state.categories = [...DEFAULT_CATEGORIES];
    state.theme = 'light';
  }
};

// ===== TOAST =====
const showToast = (message, type = 'success') => {
  if (type === 'error') playSound('error');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 320);
  }, 2800);
};

const triggerConfetti = () => {
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = -10 + 'px';
    const colors = ['#5b9de9', '#47b86b', '#ef6b6b', '#9b7ef0', '#f6a723', '#f472b6', '#38bfb0'];
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
    confetti.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 2500);
  }
};

// ===== THEME =====
const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', state.theme);
};

const toggleTheme = () => {
  playSound('pop');
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveState();
  updateCharts();
};

// ===== MODAL SYSTEM =====
const openModal = (id) => {
  playSound('pop');
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (id === 'categoryModal') renderCategoryList();
  if (id === 'goalsModal') renderGoalsList();
};

const closeModal = (id) => {
  playSound('pop');
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
};

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ===== CATEGORY MANAGEMENT =====
const renderCategoryList = () => {
  const list = $('categoryList');
  list.innerHTML = '';

  state.categories.forEach((cat, idx) => {
    const isDefault = DEFAULT_CATEGORIES.includes(cat);
    const row = document.createElement('div');
    row.className = `item-row ${isDefault ? 'item-row-default' : ''}`;
    row.innerHTML = `
      <div class="item-row-name">
        <span>${escHtml(cat)}</span>
        ${isDefault ? '<span class="item-default-badge">Default</span>' : ''}
      </div>
      ${!isDefault ? `
        <button class="item-delete-btn" onclick="deleteCategory(${idx})" aria-label="Hapus ${escHtml(cat)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      ` : ''}
    `;
    list.appendChild(row);
  });
};

const addCategory = () => {
  const input = $('newCategoryInput');
  const name = input.value.trim();
  if (!name) return showToast('Nama kategori tidak boleh kosong', 'error');
  if (state.categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
    return showToast('Kategori sudah ada', 'error');
  }

  state.categories.push(name);
  input.value = '';
  saveState();
  renderCategoryList();
  populateDropdowns();
  showToast(`Kategori "${name}" ditambahkan`);
};

const deleteCategory = (idx) => {
  const cat = state.categories[idx];
  if (DEFAULT_CATEGORIES.includes(cat)) return;

  state.categories.splice(idx, 1);
  saveState();
  renderCategoryList();
  populateDropdowns();
  showToast(`Kategori "${cat}" dihapus`);
};

// ===== GOALS MANAGEMENT =====
const renderGoalsList = () => {
  const list = $('goalsList');
  list.innerHTML = '';

  state.goals.forEach((goal) => {
    const balance = getGoalBalance(goal.id);
    const percent = goal.target > 0 ? Math.min(100, Math.round((balance / goal.target) * 100)) : 0;

    const row = document.createElement('div');
    row.className = `item-row goal-row ${goal.isDefault ? 'item-row-default' : ''}`;
    row.innerHTML = `
      <div class="goal-top">
        <div class="item-row-name">
          <span>${escHtml(goal.name)}</span>
          ${goal.isDefault ? '<span class="item-default-badge">Default</span>' : ''}
        </div>
        ${!goal.isDefault ? `
          <button class="item-delete-btn" onclick="deleteGoal('${goal.id}')" aria-label="Hapus ${escHtml(goal.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        ` : ''}
      </div>
      ${goal.target > 0 ? `
        <div class="goal-progress">
          <div class="goal-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="goal-meta">
          <span>${formatRp(balance)} terkumpul</span>
          <span>${percent}% dari ${formatRp(goal.target)}</span>
        </div>
      ` : `
        <div class="goal-meta">
          <span>${formatRp(balance)} terkumpul</span>
          <span>Tanpa target</span>
        </div>
      `}
    `;
    list.appendChild(row);
  });
};

const addGoal = () => {
  const nameInput = $('newGoalName');
  const targetInput = $('newGoalTarget');
  const name = nameInput.value.trim();
  const target = Number(targetInput.value) || 0;

  if (!name) return showToast('Nama tujuan tidak boleh kosong', 'error');
  if (state.goals.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    return showToast('Tujuan dengan nama tersebut sudah ada', 'error');
  }

  state.goals.push({ id: gid(), name, target, isDefault: false });
  nameInput.value = '';
  targetInput.value = '';
  saveState();
  renderGoalsList();
  populateDropdowns();
  playSound('coin');
  showToast(`Tujuan "${name}" ditambahkan`);
};

const deleteGoal = (goalId) => {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal || goal.isDefault) return;

  const balance = getGoalBalance(goalId);
  if (balance > 0) {
    if (!confirm(`Tujuan "${goal.name}" masih memiliki saldo ${formatRp(balance)}. Yakin ingin menghapus? Saldo akan dipindahkan ke Operasional.`)) return;
    // Move remaining balance to operasional
    state.transactions.push({
      id: uid(),
      date: new Date().toISOString(),
      type: 'transfer',
      amount: balance,
      source: goalId,
      destination: 'operasional',
      description: `Auto-transfer dari penghapusan tujuan "${goal.name}"`,
      category: '',
    });
  }

  state.goals = state.goals.filter((g) => g.id !== goalId);
  saveState();
  renderGoalsList();
  populateDropdowns();
  recalculate();
  showToast(`Tujuan "${goal.name}" dihapus`);
};

// ===== DROPDOWN POPULATION =====
const populateDropdowns = () => {
  // Expense categories
  expCategory.innerHTML = [
    ...state.categories.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`),
    '<option value="__manage_category__" class="manage-opt">+ Tambahkan</option>'
  ].join('');

  // Expense source: Operasional + all goals
  const sourceOpts = [
    '<option value="operasional">Saldo Operasional</option>',
    ...state.goals.map((g) => `<option value="${g.id}">${escHtml(g.name)}</option>`),
    '<option value="__manage_goal__" class="manage-opt">+ Tambahkan</option>'
  ].join('');

  expSource.innerHTML = sourceOpts;

  // Income goal dropdown
  incGoal.innerHTML = [
    ...state.goals.map((g) => `<option value="${g.id}">${escHtml(g.name)}</option>`),
    '<option value="__manage_goal__" class="manage-opt">+ Tambahkan</option>'
  ].join('');

  // Transfer from/to
  trfFrom.innerHTML = sourceOpts;
  trfTo.innerHTML = sourceOpts;
};

// Bind dropdown "Kelola" / "+ Tambahkan" options
[expCategory].forEach(el => {
  if (el) {
    el.addEventListener('change', function() {
      if (this.value === '__manage_category__') {
        this.selectedIndex = 0; // reset
        openModal('categoryModal');
      }
    });
  }
});

[expSource, incGoal, trfFrom, trfTo].forEach(el => {
  if (el) {
    el.addEventListener('change', function() {
      if (this.value === '__manage_goal__') {
        this.selectedIndex = 0; // reset
        openModal('goalsModal');
      }
    });
  }
});


// Show/hide goal sub-select on income destination change
incDest.addEventListener('change', () => {
  const isTabungan = incDest.value === 'tabungan';
  incGoalGroup.classList.toggle('visible', isTabungan);
});

// ===== CALCULATIONS =====
const getOperasionalBalance = () => {
  let balance = 0;
  state.transactions.forEach((tx) => {
    if (tx.type === 'income') {
      if (tx.destination === 'operasional') balance += tx.amount;
    } else if (tx.type === 'expense') {
      if (tx.source === 'operasional') balance -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.source === 'operasional') balance -= tx.amount;
      if (tx.destination === 'operasional') balance += tx.amount;
    }
  });
  return balance;
};

const getGoalBalance = (goalId) => {
  let balance = 0;
  state.transactions.forEach((tx) => {
    if (tx.type === 'income') {
      if (tx.destination === goalId) balance += tx.amount;
    } else if (tx.type === 'expense') {
      if (tx.source === goalId) balance -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.source === goalId) balance -= tx.amount;
      if (tx.destination === goalId) balance += tx.amount;
    }
  });
  return balance;
};

const getTotalTabungan = () => {
  return state.goals.reduce((sum, g) => sum + getGoalBalance(g.id), 0);
};

const getTotalPengeluaran = () => {
  return state.transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
};

// ===== ANIMATED COUNTER =====
const animateValue = (element, target) => {
  const current = parseInt(element.dataset.currentValue || '0', 10);
  const diff = target - current;
  
  if (diff === 0) {
    element.textContent = formatRp(target);
    element.dataset.currentValue = target;
    return;
  }

  const duration = 500;
  const startTime = performance.now();

  const step = (timestamp) => {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(current + diff * ease);
    element.textContent = formatRp(value);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = formatRp(target);
      element.dataset.currentValue = target;
      
      // Add fun bounce effect
      element.classList.remove('bounce-text');
      void element.offsetWidth; // trigger reflow
      element.classList.add('bounce-text');
      setTimeout(() => element.classList.remove('bounce-text'), 400);
    }
  };

  requestAnimationFrame(step);
};

// ===== RECALCULATE & UPDATE UI =====
const recalculate = () => {
  const opBalance = getOperasionalBalance();
  const totalTab = getTotalTabungan();
  const totalPeng = getTotalPengeluaran();
  const sisaSaldo = opBalance + totalTab;

  animateValue(kpiOperasional, opBalance);
  animateValue(kpiTabungan, totalTab);
  animateValue(kpiPengeluaran, totalPeng);
  animateValue(kpiSisaSaldo, sisaSaldo);

  updateCharts();
  updateTopDays();
};

// ===== SUBMIT TRANSACTIONS =====
const submitExpense = () => {
  const amount = Number(expAmount.value) || 0;
  const category = expCategory.value;
  const source = expSource.value;
  const desc = expDesc.value.trim();

  if (amount <= 0) return showToast('Nominal pengeluaran harus lebih dari 0', 'error');
  if (!desc) return showToast('Keterangan pengeluaran tidak boleh kosong', 'error');

  // Check sufficient balance
  if (source === 'operasional') {
    if (getOperasionalBalance() < amount) {
      return showToast('Saldo operasional tidak cukup!', 'error');
    }
  } else {
    if (getGoalBalance(source) < amount) {
      return showToast('Saldo tabungan tidak cukup!', 'error');
    }
  }

  state.transactions.push({
    id: uid(),
    date: new Date().toISOString(),
    type: 'expense',
    amount,
    category,
    source,
    destination: '',
    description: desc,
    photo: capturedPhotoDataUrl || null,
    location: capturedPhotoDataUrl ? currentLocation : null,
  });

  expAmount.value = '';
  expDesc.value = '';
  resetCameraUI();
  saveState();
  recalculate();
  playSound('coin');
  showToast(`Pengeluaran ${formatRp(amount)} tercatat`);
};

const submitIncome = () => {
  const amount = Number(incAmount.value) || 0;
  let dest = incDest.value;
  const desc = incDesc.value.trim();

  if (amount <= 0) return showToast('Nominal pemasukan harus lebih dari 0', 'error');
  if (!desc) return showToast('Keterangan pemasukan tidak boleh kosong', 'error');

  // Resolve destination
  if (dest === 'khilaf') dest = 'operasional';
  if (dest === 'tabungan') dest = incGoal.value;

  if (!dest) return showToast('Pilih tujuan pemasukan', 'error');

  state.transactions.push({
    id: uid(),
    date: new Date().toISOString(),
    type: 'income',
    amount,
    category: '',
    source: '',
    destination: dest,
    description: desc,
  });

  incAmount.value = '';
  incDesc.value = '';
  saveState();
  recalculate();
  playSound('coin');
  showToast(`Pemasukan ${formatRp(amount)} tercatat`);
  
  if (dest !== 'operasional') {
    triggerConfetti();
  }
};

const submitTransfer = () => {
  const amount = Number(trfAmount.value) || 0;
  const from = trfFrom.value;
  const to = trfTo.value;
  const desc = trfDesc.value.trim();

  if (amount <= 0) return showToast('Nominal transfer harus lebih dari 0', 'error');
  if (from === to) return showToast('Sumber dan tujuan tidak boleh sama', 'error');

  // Check sufficient balance
  if (from === 'operasional') {
    if (getOperasionalBalance() < amount) {
      return showToast('Saldo operasional tidak cukup!', 'error');
    }
  } else {
    if (getGoalBalance(from) < amount) {
      return showToast('Saldo tabungan sumber tidak cukup!', 'error');
    }
  }

  state.transactions.push({
    id: uid(),
    date: new Date().toISOString(),
    type: 'transfer',
    amount,
    category: '',
    source: from,
    destination: to,
    description: desc || 'Transfer dana',
  });

  trfAmount.value = '';
  trfDesc.value = '';
  saveState();
  recalculate();

  playSound('coin');
  const fromLabel = getAccountLabel(from);
  const toLabel = getAccountLabel(to);
  showToast(`${formatRp(amount)} dipindah dari ${fromLabel} ke ${toLabel}`);
  
  if (to !== 'operasional') {
    triggerConfetti();
  }
};

const getAccountLabel = (id) => {
  if (id === 'operasional') return 'Operasional';
  const goal = state.goals.find((g) => g.id === id);
  return goal ? goal.name : id;
};

// ===== CHARTS =====
const getChartFontColor = () => {
  return state.theme === 'dark' ? '#a8a8c4' : '#55556a';
};

const getChartGridColor = () => {
  return state.theme === 'dark' ? 'rgba(100,100,140,0.3)' : 'rgba(50,50,80,0.1)';
};

const initCharts = () => {
  Chart.defaults.font.family = "'Fredoka', sans-serif";
  Chart.defaults.font.weight = '600';

  const fontColor = getChartFontColor();
  const gridColor = getChartGridColor();

// Donut Chart
  const donutCtx = $('donutChart').getContext('2d');
  donutChartInst = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: CHART_COLORS,
        borderColor: state.theme === 'dark' ? '#222244' : '#fdf6e3',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: fontColor,
            padding: 12,
            font: { size: 12, weight: '600' },
            usePointStyle: true,
            pointStyleWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: state.theme === 'dark' ? '#333366' : '#1a1a2e',
          titleFont: { size: 12 },
          bodyFont: { size: 13, weight: '700' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${formatRp(ctx.raw)}`,
          },
        },
      },
    },
  });

  // Bar Chart
  const barCtx = $('barChart').getContext('2d');
  barChartInst = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Pengeluaran',
        data: [],
        backgroundColor: 'rgba(239, 107, 107, 0.7)',
        borderColor: 'rgba(239, 107, 107, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: state.theme === 'dark' ? '#333366' : '#1a1a2e',
          bodyFont: { size: 13, weight: '700' },
          cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${formatRp(ctx.raw)}` },
        },
      },
      scales: {
        x: { ticks: { color: fontColor, font: { size: 10 } }, grid: { display: false }, border: { color: gridColor } },
        y: { ticks: { color: fontColor, font: { size: 10 }, callback: (v) => formatRp(v) }, grid: { color: gridColor }, border: { display: false } },
      },
    },
  });

  // Line Chart
  const lineCtx = $('lineChart').getContext('2d');
  lineChartInst = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Pengeluaran',
        data: [],
        borderColor: '#9b7ef0',
        backgroundColor: 'rgba(155, 126, 240, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointBackgroundColor: '#9b7ef0',
        pointBorderColor: state.theme === 'dark' ? '#222244' : '#fdf6e3',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: state.theme === 'dark' ? '#333366' : '#1a1a2e',
          bodyFont: { size: 13, weight: '700' },
          cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${formatRp(ctx.raw)}` },
        },
      },
      scales: {
        x: { ticks: { color: fontColor, font: { size: 10 } }, grid: { display: false }, border: { color: gridColor } },
        y: { ticks: { color: fontColor, font: { size: 10 }, callback: (v) => formatRp(v) }, grid: { color: gridColor }, border: { display: false }, beginAtZero: true },
      },
    },
  });

  // Radar Chart (Wiggly)
  const radarCtx = $('radarChart').getContext('2d');
  radarChartInst = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: [],
      datasets: [{
        label: 'Nilai',
        data: [],
        backgroundColor: 'rgba(252, 211, 77, 0.4)', // yellow transparent
        borderColor: '#1a1a2e',
        borderWidth: 4,
        pointBackgroundColor: '#1a1a2e',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#1a1a2e',
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: state.theme === 'dark' ? '#333366' : '#1a1a2e',
          bodyFont: { size: 13, weight: '700' },
          cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${formatRp(ctx.raw)}` },
        },
      },
      scales: {
        r: {
          angleLines: { color: gridColor, borderDash: [5, 5] },
          grid: { color: gridColor, borderDash: [5, 5], circular: true },
          pointLabels: { color: fontColor, font: { size: 11, weight: '700' } },
          ticks: { display: false } // hide axis numbers for stylized look
        }
      }
    }
  });
};

const updateCharts = () => {
  if (!donutChartInst) return;

  const fontColor = getChartFontColor();
  const gridColor = getChartGridColor();
  const borderBg = state.theme === 'dark' ? '#222244' : '#fdf6e3';
  const tooltipBg = state.theme === 'dark' ? '#333366' : '#1a1a2e';

  const expenses = state.transactions.filter((tx) => tx.type === 'expense');

  // === Donut: by category ===
  const catMap = {};
  expenses.forEach((tx) => {
    const cat = tx.category || 'Lainnya';
    catMap[cat] = (catMap[cat] || 0) + tx.amount;
  });

  const catLabels = Object.keys(catMap);
  const catData = Object.values(catMap);

  donutChartInst.data.labels = catLabels.length ? catLabels : ['Belum ada data'];
  donutChartInst.data.datasets[0].data = catData.length ? catData : [1];
  donutChartInst.data.datasets[0].backgroundColor = catLabels.length ? CHART_COLORS.slice(0, catLabels.length) : ['rgba(150,150,180,0.2)'];
  donutChartInst.data.datasets[0].borderColor = borderBg;
  donutChartInst.options.plugins.legend.labels.color = fontColor;
  donutChartInst.options.plugins.tooltip.backgroundColor = tooltipBg;
  donutChartInst.update();

  // === Bar: daily spending this month ===
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyMap = {};
  for (let d = 1; d <= daysInMonth; d++) dailyMap[d] = 0;

  expenses.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() === year && txDate.getMonth() === month) {
      dailyMap[txDate.getDate()] += tx.amount;
    }
  });

  const barLabels = Object.keys(dailyMap).map((d) => `${d}`);
  const barData = Object.values(dailyMap);

  barChartInst.data.labels = barLabels;
  barChartInst.data.datasets[0].data = barData;
  barChartInst.options.scales.x.ticks.color = fontColor;
  barChartInst.options.scales.y.ticks.color = fontColor;
  barChartInst.options.scales.y.grid.color = gridColor;
  barChartInst.options.scales.x.border.color = gridColor;
  barChartInst.options.plugins.tooltip.backgroundColor = tooltipBg;
  barChartInst.update();

  // === Line: last 7 days ===
  const lineLabels = [];
  const lineData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    lineLabels.push(label);

    const dayTotal = expenses
      .filter((tx) => tx.date.split('T')[0] === dateStr)
      .reduce((sum, tx) => sum + tx.amount, 0);
    lineData.push(dayTotal);
  }

  lineChartInst.data.labels = lineLabels;
  lineChartInst.data.datasets[0].data = lineData;
  lineChartInst.data.datasets[0].pointBorderColor = borderBg;
  lineChartInst.options.scales.x.ticks.color = fontColor;
  lineChartInst.options.scales.y.ticks.color = fontColor;
  lineChartInst.options.scales.y.grid.color = gridColor;
  lineChartInst.options.scales.x.border.color = gridColor;
  lineChartInst.options.plugins.tooltip.backgroundColor = tooltipBg;
  lineChartInst.update();

  // === Radar: Dynamic Wealth Distribution ===
  if (radarChartInst) {
    const radarLabels = [];
    const radarData = [];

    // 1. Tabungan Goals
    state.goals.forEach(g => {
      radarLabels.push(g.name);
      radarData.push(g.target > 0 ? g.target : getGoalBalance(g.id)); // Assuming their balance
    });

    // 2. Operasional
    radarLabels.push('Operasional');
    radarData.push(getOperasionalBalance());

    // 3. Categories (Expenses)
    state.categories.forEach(c => {
      radarLabels.push(c);
      radarData.push(catMap[c] || 0); // Using catMap calculated above
    });

    radarChartInst.data.labels = radarLabels;
    radarChartInst.data.datasets[0].data = radarData;
    
    // Theme updates
    radarChartInst.options.scales.r.angleLines.color = gridColor;
    radarChartInst.options.scales.r.grid.color = gridColor;
    radarChartInst.options.scales.r.pointLabels.color = fontColor;
    radarChartInst.options.plugins.tooltip.backgroundColor = tooltipBg;
    
    radarChartInst.update();
  }
};

// ===== TOP SPENDING DAYS =====
const updateTopDays = () => {
  const expenses = state.transactions.filter((tx) => tx.type === 'expense');
  const emptyEl = $('topDaysEmpty');
  const tableEl = $('topDaysTable');
  const bodyEl = $('topDaysBody');

  if (expenses.length === 0) {
    emptyEl.classList.remove('hidden');
    tableEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  tableEl.classList.remove('hidden');

  // Aggregate by date
  const dayMap = {};
  expenses.forEach((tx) => {
    const dateKey = tx.date.split('T')[0];
    if (!dayMap[dateKey]) dayMap[dateKey] = { total: 0, count: 0 };
    dayMap[dateKey].total += tx.amount;
    dayMap[dateKey].count++;
  });

  const sorted = Object.entries(dayMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  bodyEl.innerHTML = sorted.map((d, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    return `
      <tr>
        <td><span class="top-days-rank ${rankClass}">${i + 1}</span></td>
        <td>${formatDate(d.date)}</td>
        <td class="amount-red">${formatRp(d.total)}</td>
        <td>${d.count}x</td>
      </tr>
    `;
  }).join('');
};

// ===== HTML ESCAPE =====
const escHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// ===== HAMBURGER MENU =====
const hamburger = $('hamburger');
const navLinks = $('navLinks');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
  });
}

// ===== CHART CAROUSEL =====
let currentChartSlide = 0;
const totalChartSlides = 5;

const changeChartSlide = (dir) => {
  playSound('pop');
  let nextSlide = currentChartSlide + dir;
  if (nextSlide >= totalChartSlides) nextSlide = 0;
  if (nextSlide < 0) nextSlide = totalChartSlides - 1;
  goToChartSlide(nextSlide);
};

const goToChartSlide = (index) => {
  const slides = document.querySelectorAll('.chart-slide');
  const indicators = document.querySelectorAll('.indicator');
  const titleEl = $('carouselTitle');
  const iconEl = $('carouselIcon');
  
  if (!slides.length) return;
  
  slides[currentChartSlide].classList.remove('active');
  if (indicators[currentChartSlide]) indicators[currentChartSlide].classList.remove('active');
  
  currentChartSlide = index;
  
  const activeSlide = slides[currentChartSlide];
  activeSlide.classList.add('active');
  if (indicators[currentChartSlide]) indicators[currentChartSlide].classList.add('active');
  
  if (titleEl && activeSlide.dataset.title) {
    titleEl.textContent = activeSlide.dataset.title;
  }
  if (iconEl && activeSlide.dataset.icon) {
    iconEl.innerHTML = activeSlide.dataset.icon;
  }

  // Trigger resize if necessary when container becomes visible
  setTimeout(() => {
    if (index === 0 && typeof donutChartInst !== 'undefined' && donutChartInst) donutChartInst.resize();
    if (index === 1 && typeof barChartInst !== 'undefined' && barChartInst) barChartInst.resize();
    if (index === 2 && typeof lineChartInst !== 'undefined' && lineChartInst) lineChartInst.resize();
    if (index === 4 && typeof radarChartInst !== 'undefined' && radarChartInst) radarChartInst.resize();
  }, 50);
};

// ===== NOTEBOOK TABS =====
const switchNotebookTab = (tabName) => {
  playSound('pop');
  // Stop camera if leaving expense tab
  if (tabName !== 'expense') {
    stopCameraStream();
  }

  // Update Tabs
  document.querySelectorAll('.notebook-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById(`tabBtn-${tabName}`);
  if (activeTab) activeTab.classList.add('active');

  // Hide all pages
  document.querySelectorAll('.notebook-page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('animate-in'); // Reset animation
  });

  // Show active page
  const activePage = document.getElementById(`page-${tabName}`);
  if (activePage) {
    activePage.style.display = 'block';
    // Small timeout to allow display:block to bind before adding animation class
    setTimeout(() => {
      activePage.classList.add('animate-in');
    }, 10);
  }
};

// ===== CAMERA SYSTEM =====
let cameraStream = null;
let capturedPhotoDataUrl = null;
let currentLocation = null;

const fetchLocation = () => {
  if (!currentLocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => { console.warn("Location access denied or failed."); }
    );
  }
};

const stopCameraStream = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = $('cameraVideo');
  if (video) video.srcObject = null;

  const viewfinder = $('cameraViewfinderWrap');
  const toggleBtn = $('btnCameraToggle');
  const toggleText = $('cameraToggleText');

  if (viewfinder) viewfinder.classList.add('hidden');
  if (toggleBtn) toggleBtn.classList.remove('camera-active');
  if (toggleText) toggleText.textContent = 'Buka Kamera';
};

const toggleCamera = () => {
  const viewfinder = $('cameraViewfinderWrap');
  const preview = $('cameraPreviewWrap');
  const toggleBtn = $('btnCameraToggle');
  const toggleText = $('cameraToggleText');

  // Trigger location
  fetchLocation();

  // If camera is already streaming, stop it
  if (cameraStream) {
    stopCameraStream();
    return;
  }

  // If we already have a captured photo, clear it and open camera fresh
  if (capturedPhotoDataUrl) {
    capturedPhotoDataUrl = null;
    if (preview) preview.classList.add('hidden');
  }

  // Request camera access — prefer rear camera on mobile
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 720 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      cameraStream = stream;
      const video = $('cameraVideo');
      video.srcObject = stream;
      video.play().catch(() => {});

      viewfinder.classList.remove('hidden');
      toggleBtn.classList.add('camera-active');
      toggleText.textContent = 'Tutup Kamera';
      playSound('pop');
    })
    .catch(err => {
      console.error('Camera access denied:', err);
      showToast('Tidak dapat mengakses kamera. Periksa izin browser.', 'error');
    });
};

const showPreview = () => {
  const preview = $('cameraPreviewWrap');
  const previewImg = $('cameraPreviewImg');
  const caption = $('polaroidCaption');
  const locWrap = $('photoLocationWrap');
  const locLink = $('photoLocationLink');

  previewImg.src = capturedPhotoDataUrl;

  const now = new Date();
  caption.textContent = `📸 ${now.toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })} • ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  if (currentLocation) {
    locLink.href = `https://www.google.com/maps/search/?api=1&query=${currentLocation.lat},${currentLocation.lng}`;
    locWrap.classList.remove('hidden');
  } else {
    locWrap.classList.add('hidden');
  }

  preview.classList.remove('hidden');
};

const getOSMTileUrl = (lat, lon, zoom) => {
  const xtile = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return `https://a.tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;
};

const drawMapOverlay = (ctx, size, lat, lng, callback) => {
  const zoom = 15;
  const url = getOSMTileUrl(lat, lng, zoom);
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  
  img.onload = () => {
    ctx.save();
    const mapSize = size * 0.22; 
    const mapX = size * 0.04;
    const mapY = size - mapSize - (size * 0.035);
    
    ctx.shadowColor = 'rgba(26, 26, 46, 0.4)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    
    ctx.fillStyle = '#fdf6e3';
    roundRect(ctx, mapX, mapY, mapSize, mapSize, 8);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1a2e';
    roundRect(ctx, mapX, mapY, mapSize, mapSize, 8);
    ctx.stroke();

    try {
      ctx.save();
      roundRect(ctx, mapX, mapY, mapSize, mapSize, 8);
      ctx.clip();
      ctx.drawImage(img, 0, 0, 256, 256, mapX, mapY, mapSize, mapSize);
      ctx.restore();
    } catch (e) {
      console.warn('Map draw failed:', e);
    }

    // Label Map
    ctx.fillStyle = '#1a1a2e';
    roundRect(ctx, mapX + 8, mapY - 14, 75, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    ctx.font = `800 ${size * 0.02}px 'Fredoka', sans-serif`;
    ctx.fillText("📍 MAPS", mapX + 14, mapY + 2);
    
    // Marker coordinates
    const px = Math.floor((lng + 180) / 360 * Math.pow(2, zoom) * 256);
    const py = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom) * 256);
    
    const markerX = mapX + ((px % 256) / 256) * mapSize;
    const markerY = mapY + ((py % 256) / 256) * mapSize;

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ef6b6b';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    callback();
  };
  
  img.onerror = () => callback();
  img.src = url;
};

const capturePhoto = () => {
  const video = $('cameraVideo');
  const canvas = $('cameraCanvas');
  const ctx = canvas.getContext('2d');

  if (!video || !video.videoWidth) {
    return showToast('Kamera belum siap, tunggu sebentar...', 'error');
  }

  const viewfinderInner = document.querySelector('.camera-viewfinder-inner');
  viewfinderInner.classList.remove('flash');
  void viewfinderInner.offsetWidth; 
  viewfinderInner.classList.add('flash');
  playSound('coin');

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cropSize = Math.min(vw, vh);
  const sx = (vw - cropSize) / 2;
  const sy = (vh - cropSize) / 2;

  const outputSize = 720; 
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, outputSize, outputSize);

  const finalizePhoto = () => {
    drawComicTimestamp(ctx, outputSize);
    capturedPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCameraStream();
    showPreview();
  };

  if (currentLocation) {
    drawMapOverlay(ctx, outputSize, currentLocation.lat, currentLocation.lng, finalizePhoto);
  } else {
    finalizePhoto();
  }
};

const handlePhotoUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  fetchLocation();

  const preview = $('cameraPreviewWrap');
  if (capturedPhotoDataUrl) {
    capturedPhotoDataUrl = null;
    if (preview) preview.classList.add('hidden');
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = $('cameraCanvas');
      const ctx = canvas.getContext('2d');
      const vw = img.width;
      const vh = img.height;
      const cropSize = Math.min(vw, vh);
      const sx = (vw - cropSize) / 2;
      const sy = (vh - cropSize) / 2;

      const outputSize = 720;
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outputSize, outputSize);
      
      const finalizePhoto = () => {
        drawComicTimestamp(ctx, outputSize);
        capturedPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        showPreview();
        playSound('coin');
      };

      if (currentLocation) {
        drawMapOverlay(ctx, outputSize, currentLocation.lat, currentLocation.lng, finalizePhoto);
      } else {
        finalizePhoto();
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = ''; 
};

const drawComicTimestamp = (ctx, size) => {
  const now = new Date();

  // Format: "06 Apr 2026"
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase();

  // Format: "18:32"
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit'
  });

  const fullText = `${dateStr}  •  ${timeStr}`;

  // --- Background Banner ---
  const bannerHeight = size * 0.065;
  const bannerY = size - bannerHeight - (size * 0.035);
  const bannerPadX = size * 0.04;
  const fontSize = Math.round(size * 0.032);

  ctx.save();

  // Measure text to size the banner
  ctx.font = `900 ${fontSize}px 'Fredoka', sans-serif`;
  const textMetrics = ctx.measureText(fullText);
  const textWidth = textMetrics.width;
  const bannerWidth = textWidth + bannerPadX * 2 + 30; // added extra padding for custom logo
  const bannerX = size - bannerWidth - (size * 0.03);

  // Banner background — semi-transparent dark with thick border
  const bannerRadius = 8;

  // Shadow behind banner
  ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
  roundRect(ctx, bannerX + 3, bannerY + 3, bannerWidth, bannerHeight, bannerRadius);
  ctx.fill();

  // Main banner fill — amber/yellow
  ctx.fillStyle = 'rgba(252, 211, 77, 0.92)';
  roundRect(ctx, bannerX, bannerY, bannerWidth, bannerHeight, bannerRadius);
  ctx.fill();

  // Banner border — thick black
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 3;
  roundRect(ctx, bannerX, bannerY, bannerWidth, bannerHeight, bannerRadius);
  ctx.stroke();

  // --- Text with shadow/outline ---
  const textX = bannerX + bannerPadX + 22; // offset for logo
  const textY = bannerY + bannerHeight / 2 + fontSize * 0.35;

  // Text shadow
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(fullText, textX + 1.5, textY + 1.5);

  // Main text
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(fullText, textX, textY);

  // --- Custom Crown Logo Indicator ---
  const cx = bannerX + 18;
  const cy = bannerY + bannerHeight / 2 - 2;
  const scale = fontSize * 0.035;

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.moveTo(12, 12);
  ctx.lineTo(-12, 12);
  ctx.lineTo(-14, -6);
  ctx.lineTo(-4, 0);
  ctx.lineTo(0, -12);
  ctx.lineTo(4, 0);
  ctx.lineTo(14, -6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-14, -6, 2.5, 0, Math.PI * 2);
  ctx.arc(0, -12, 2.5, 0, Math.PI * 2);
  ctx.arc(14, -6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
};

// Canvas utility: draw rounded rectangle path
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const retakePhoto = () => {
  capturedPhotoDataUrl = null;
  const preview = $('cameraPreviewWrap');
  if (preview) preview.classList.add('hidden');
  // Reopen camera
  toggleCamera();
};

const resetCameraUI = () => {
  stopCameraStream();
  capturedPhotoDataUrl = null;
  const preview = $('cameraPreviewWrap');
  if (preview) preview.classList.add('hidden');
};

// ===== THEME TOGGLE =====
$('themeToggle').addEventListener('click', toggleTheme);

// ===== AUTHENTICATION & INTERACTION =====
const initLoginInteractions = () => {
  const userIn = $('loginUsername');
  const passIn = $('loginPassword');
  const openEyes = $('mascotEyesOpen');
  const closedEyes = $('mascotEyesClosed');
  const pupL = $('mascotPupilL');
  const pupR = $('mascotPupilR');
  const mascot = $('loginMascot');

  if (!userIn || !passIn || !mascot) return;

  userIn.addEventListener('focus', () => {
    openEyes.style.display = 'block';
    closedEyes.style.display = 'none';
    pupL.setAttribute('cy', '18.5');
    pupR.setAttribute('cy', '18.5');
    mascot.style.transform = 'scale(1.05)';
  });

  userIn.addEventListener('input', (e) => {
    const len = Math.min(e.target.value.length, 20);
    const shift = (len / 20) * 3 - 1.5; 
    pupL.setAttribute('cx', 12 + shift);
    pupR.setAttribute('cx', 20 + shift);
  });

  userIn.addEventListener('blur', () => {
    pupL.setAttribute('cx', '12');
    pupR.setAttribute('cx', '20');
    pupL.setAttribute('cy', '17');
    pupR.setAttribute('cy', '17');
    mascot.style.transform = 'none';
  });

  passIn.addEventListener('focus', () => {
    openEyes.style.display = 'none';
    closedEyes.style.display = 'block';
    mascot.style.transform = 'scale(0.95) translateY(4px) rotate(-3deg)';
  });

  passIn.addEventListener('blur', () => {
    openEyes.style.display = 'block';
    closedEyes.style.display = 'none';
    mascot.style.transform = 'none';
  });
};

const checkAuth = () => {
  const loadingScreen = $('loadingScreen');
  const loginScreen = $('loginScreen');
  const appContainer = $('appContainer');
  const loadingText = $('loadingText');
  
  initLoginInteractions();

  const phrases = [
    "Menyiapkan Kerajaan...",
    "Menghitung Koin Emas...",
    "Membangunkan Ksatria...",
    "Mengusir Naga Pengganggu...",
    "Merapikan Karpet Merah..."
  ];
  let phraseIdx = 0;
  
  const textInterval = setInterval(() => {
    phraseIdx = (phraseIdx + 1) % phrases.length;
    if (loadingText) {
      loadingText.classList.remove('bounce-text');
      void loadingText.offsetWidth; 
      loadingText.textContent = phrases[phraseIdx];
      loadingText.classList.add('bounce-text');
      if (Math.random() > 0.5) playSound('pop');
    }
  }, 600);

  // Fake loading delay for aesthetic
  setTimeout(() => {
    clearInterval(textInterval);
    loadingScreen.classList.add('hidden-overlay');
    
    // Check if logged in 
    const isLoggedIn = sessionStorage.getItem('nk_loggedIn') === 'true' || localStorage.getItem('nk_loggedIn') === 'true';
    
    setTimeout(() => {
      loadingScreen.style.display = 'none'; 
      if (isLoggedIn) {
        appContainer.style.display = 'block';
        if (donutChartInst) donutChartInst.resize();
        if (barChartInst) barChartInst.resize();
        if (lineChartInst) lineChartInst.resize();
        if (radarChartInst) radarChartInst.resize();
        triggerConfetti();
      } else {
        loginScreen.style.display = 'flex';
      }
    }, 500); 
    
  }, 2500); 
};

const handleLogin = (e) => {
  if (e) e.preventDefault();
  
  const usernameInput = $('loginUsername');
  const passwordInput = $('loginPassword');
  
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();
  const rememberMe = $('loginRememberMe').checked;
  
  const accounts = {
    'bos ganteng': '111000',
    'kanjeng putri': '120900'
  };
  
  if (accounts[username] && accounts[username] === password) {
    playSound('coin');
    
    if (rememberMe) {
      localStorage.setItem('nk_loggedIn', 'true');
    } else {
      sessionStorage.setItem('nk_loggedIn', 'true');
    }
    
    const loginScreen = $('loginScreen');
    loginScreen.classList.add('hidden-overlay');
    
    setTimeout(() => {
      loginScreen.style.display = 'none';
      $('appContainer').style.display = 'block';
      
      if (donutChartInst) donutChartInst.resize();
      if (barChartInst) barChartInst.resize();
      if (lineChartInst) lineChartInst.resize();
      if (radarChartInst) radarChartInst.resize();
      
      showToast(`Selamat datang, ${username}!`);
      triggerConfetti();
      
      // Clear inputs for security
      usernameInput.value = '';
      passwordInput.value = '';
    }, 500);
    
  } else {
    playSound('error');
    
    const card = document.querySelector('.login-card');
    card.style.transform = 'rotate(-1deg) translateX(-10px)';
    setTimeout(() => card.style.transform = 'rotate(-1deg) translateX(10px)', 100);
    setTimeout(() => card.style.transform = 'rotate(-1deg) translateX(-10px)', 200);
    setTimeout(() => card.style.transform = 'rotate(-1deg) translateX(10px)', 300);
    setTimeout(() => card.style.transform = 'rotate(-1deg)', 400);
    
    showToast('Username atau password salah!', 'error');
  }
};

const logout = () => {
  playSound('pop');
  sessionStorage.removeItem('nk_loggedIn');
  localStorage.removeItem('nk_loggedIn');
  
  const appContainer = $('appContainer');
  const loginScreen = $('loginScreen');
  
  appContainer.style.display = 'none';
  loginScreen.classList.remove('hidden-overlay');
  loginScreen.style.display = 'flex';
  
  showToast('Behasil keluar dari Gerbang Utama');
};

if ($('profileBtn')) {
  $('profileBtn').addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin Logout?')) {
      logout();
    }
  });
}

// ===== INITIALIZATION =====
const init = () => {
  loadState();
  applyTheme();
  populateDropdowns();
  initCharts();
  recalculate();

  // Set initial KPI values without animation
  kpiOperasional.dataset.currentValue = getOperasionalBalance();
  kpiTabungan.dataset.currentValue = getTotalTabungan();
  kpiPengeluaran.dataset.currentValue = getTotalPengeluaran();
  kpiSisaSaldo.dataset.currentValue = getOperasionalBalance() + getTotalTabungan();

  checkAuth();
};

init();
