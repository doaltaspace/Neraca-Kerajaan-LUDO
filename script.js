/* ============================================
   NERACA KERAJAAN LUDO — Application Logic
   ============================================ */

// ===== STORAGE KEYS =====
const SK = {
  transactions: 'nk_transactions',
  goals: 'nk_goals',
  categories: 'nk_categories',
  theme: 'nk_theme',
  notifications: 'nk_notifications',
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
  notifications: [],
};

// ===== AUDIO ENGINE =====
const sfx = {
  // Clean UI variants: Soft pop, clear chime for success, modern blip for error
  pop: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
  coin: new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'),
  error: new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'),
  pageFlip: new Audio('https://www.soundjay.com/misc/sounds/page-flip-01a.mp3'),
  shutter: new Audio('https://www.soundjay.com/mechanical/sounds/camera-shutter-click-01.mp3'),
  magic: new Audio('https://www.soundjay.com/misc/sounds/magic-chime-01.mp3'),
  swoosh: new Audio('https://www.soundjay.com/misc/sounds/wind-swoosh-01.mp3'),
  boing: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  sword: new Audio('https://www.soundjay.com/mechanical/sounds/scissors-cutting-2.mp3'),
  drawer: new Audio('https://www.soundjay.com/misc/sounds/wood-crack-1.mp3')
};
sfx.pop.volume = 0.5;
sfx.coin.volume = 0.6;
sfx.error.volume = 0.5;
sfx.pageFlip.volume = 0.7;
sfx.shutter.volume = 0.6;
sfx.magic.volume = 0.5;
sfx.swoosh.volume = 0.3;
sfx.boing.volume = 0.4;
sfx.sword.volume = 0.7;
sfx.drawer.volume = 0.6;

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
  if (e.target.closest('.notebook-tab')) {
    playSound('pageFlip');
  } else if (e.target.closest('.theme-toggle')) {
    playSound('boing');
  } else if (e.target.closest('button, .modal-close, .slide-nav-btn')) {
    if (e.target.closest('.btn-shutter')) {
      playSound('shutter');
    } else {
      playSound('pop');
    }
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
    localStorage.setItem(SK.notifications, JSON.stringify(state.notifications));
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
    const notifs = localStorage.getItem(SK.notifications);

    state.transactions = tx ? JSON.parse(tx) : [];
    state.goals = goals ? JSON.parse(goals) : [...DEFAULT_GOALS];
    state.categories = cats ? JSON.parse(cats) : [...DEFAULT_CATEGORIES];
    state.theme = theme || 'light';
    state.notifications = notifs ? JSON.parse(notifs) : [];
  } catch (e) {
    console.warn('Load failed:', e);
    state.transactions = [];
    state.goals = [...DEFAULT_GOALS];
    state.categories = [...DEFAULT_CATEGORIES];
    state.theme = 'light';
    state.notifications = [];
  }
  updateNotifBadge();
};

// ===== TOAST & NOTIFICATIONS =====
const updateNotifBadge = () => {
  const badge = $('notifBadge');
  if (!badge) return;
  const unreadCount = state.notifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
};

const renderNotifications = () => {
  const list = $('notifList');
  if (!list) return;
  
  if (state.notifications.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Belum ada notifikasi</div>';
    return;
  }
  
  list.innerHTML = state.notifications.map(n => `
    <div class="item-row" style="align-items:flex-start; margin-bottom: 8px;">
      <div style="margin-right: 12px; margin-top:2px; font-size:1.2rem;">
        ${n.type === 'error' ? '🔴' : '🟢'}
      </div>
      <div style="flex:1;">
        <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${escHtml(n.message)}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${formatDateTime(n.date)} • 👤 ${escHtml(n.user || 'Sistem')}</div>
      </div>
    </div>
  `).join('');
};

const openNotifModal = () => {
  openModal('notifModal');
  renderNotifications();
  // Mark all as read
  if (state.notifications.some(n => !n.read)) {
    state.notifications.forEach(n => n.read = true);
    saveState();
    updateNotifBadge();
  }
};

const showToast = (message, type = 'success') => {
  if (type === 'error') playSound('error');

  const loggedInUser = sessionStorage.getItem('nk_loggedInUser') || localStorage.getItem('nk_loggedInUser') || 'Sistem';

  state.notifications.unshift({
    id: uid(),
    message,
    type,
    user: loggedInUser,
    date: new Date().toISOString(),
    read: false
  });
  if (state.notifications.length > 50) state.notifications.pop();
  saveState();
  updateNotifBadge();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 320);
  }, 2800);
};

if ($('notifBtn')) {
  $('notifBtn').addEventListener('click', openNotifModal);
}

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
    const row = document.createElement('div');
    row.className = `item-row`;
    row.innerHTML = `
      <div class="item-row-name">
        <span>${escHtml(cat)}</span>
      </div>
      <button class="item-delete-btn" onclick="deleteCategory(${idx})" aria-label="Hapus ${escHtml(cat)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
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
    row.className = `item-row goal-row`;
    row.innerHTML = `
      <div class="goal-top">
        <div class="item-row-name">
          <span>${escHtml(goal.name)}</span>
        </div>
        <button class="item-delete-btn" onclick="deleteGoal('${goal.id}')" aria-label="Hapus ${escHtml(goal.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
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
  if (!goal) return;

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

  // Income goal dropdown — always include a placeholder so "+ Tambahkan" can trigger change
  const goalOpts = state.goals.map((g) => `<option value="${g.id}">${escHtml(g.name)}</option>`);
  incGoal.innerHTML = [
    '<option value="" disabled selected>— Pilih tabungan —</option>',
    ...goalOpts,
    '<option value="__manage_goal__" class="manage-opt">+ Tambahkan</option>'
  ].join('');

  // Transfer from/to
  trfFrom.innerHTML = sourceOpts;
  trfTo.innerHTML = sourceOpts;
};

// Bind dropdown "Kelola" / "+ Tambahkan" options
const bindManageOption = (el, manageValue, modalId) => {
  if (!el) return;
  // Primary: change event
  el.addEventListener('change', function() {
    if (this.value === manageValue) {
      this.selectedIndex = 0;
      openModal(modalId);
    }
  });
  // Fallback: click event for when the manage option is already selected
  el.addEventListener('click', function() {
    if (this.value === manageValue) {
      this.selectedIndex = 0;
      openModal(modalId);
    }
  });
};

bindManageOption(expCategory, '__manage_category__', 'categoryModal');
bindManageOption(expSource, '__manage_goal__', 'goalsModal');
bindManageOption(incGoal, '__manage_goal__', 'goalsModal');
bindManageOption(trfFrom, '__manage_goal__', 'goalsModal');
bindManageOption(trfTo, '__manage_goal__', 'goalsModal');


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

// ===== NOMINAL INPUT COMPONENT =====
const parseNominal = (val) => {
  if (!val) return 0;
  return parseInt(val.toString().replace(/\D/g, ''), 10) || 0;
};

const formatNominalInput = (e) => {
  const val = e.target.value.replace(/\D/g, '');
  if (!val) {
    e.target.value = '';
    return;
  }
  e.target.value = parseInt(val, 10).toLocaleString('id-ID');
};

// ===== RECORD SUBMISSION =====

const submitExpense = () => {
  const amount = parseNominal(expAmount.value);
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
  const amount = parseNominal(incAmount.value);
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
  playSound('magic');
  showToast(`Pemasukan ${formatRp(amount)} tercatat`);
  
  if (dest !== 'operasional') {
    triggerConfetti();
  }
};

const submitTransfer = () => {
  const amount = parseNominal(trfAmount.value);
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
  return state.theme === 'dark' ? '#ffffff' : '#1a1a2e';
};

const getChartGridColor = () => {
  return state.theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(26,26,46,0.15)';
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
        borderRadius: 16,
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

  // === Radar: Kesehatan Tabungan (Wealth Distribution) ===
  if (radarChartInst) {
    const radarLabels = [];
    const radarData = [];

    // 1. Operasional balance
    const opBal = Math.max(0, getOperasionalBalance());
    radarLabels.push('Operasional');
    radarData.push(opBal);

    // 2. Each savings goal (actual balance)
    state.goals.forEach(g => {
      radarLabels.push(g.name);
      radarData.push(Math.max(0, getGoalBalance(g.id)));
    });

    // 3. Ensure minimum 3 data points for a proper polygon
    // Hanya gunakan tabungan, tambahkan titik kosong agar tidak merusak bentuk grafik!
    let spaces = ' ';
    while (radarLabels.length < 3) {
      radarLabels.push(spaces);
      radarData.push(0);
      spaces += ' ';
    }

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
  
  const container = document.getElementById('mainNotebookContainer');
  const btn = document.getElementById(`tabBtn-${tabName}`);
  
  if (container && container.classList.contains('is-open') && btn && btn.classList.contains('active')) {
      container.classList.remove('is-open');
      btn.classList.remove('active');
      return;
  }

  // Stop camera if leaving expense tab
  if (tabName !== 'expense') {
    stopCameraStream();
  }

  document.querySelectorAll('.notebook-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.notebook-page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('animate-in'); // Reset animation
  });

  if (btn) btn.classList.add('active');

  // Show active page
  const activePage = document.getElementById(`page-${tabName}`);
  if (activePage) {
    activePage.style.display = 'block';
    // Small timeout to allow display:block to bind before adding animation class
    setTimeout(() => {
      activePage.classList.add('animate-in');
    }, 10);
  }
  
  if (container && !container.classList.contains('is-open')) {
      container.classList.add('is-open');
  }
};

// ===== CAMERA SYSTEM =====
let cameraStream = null;
let capturedPhotoDataUrl = null;
let currentAddress = null;

const fetchLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        // Reverse geocode for full address
        if (!currentAddress) {
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}&zoom=18&addressdetails=1`)
            .then(r => r.json())
            .then(data => {
              if (data && data.display_name) {
                currentAddress = data.display_name;
              }
            })
            .catch(() => {});
        }
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
  
  if (typeof retakeFullscreenPhoto === 'function') {
      retakeFullscreenPhoto();
  }
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
  const doneWrap = $('cameraDoneWrap');
  doneWrap.classList.remove('hidden');
};

const getOSMTileUrl = (lat, lon, zoom) => {
  const xtile = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return `https://a.tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;
};

const drawMapOverlay = (ctx, canvasW, canvasH, lat, lng, callback) => {
  const zoom = 15;
  const url = getOSMTileUrl(lat, lng, zoom);
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  
  img.onload = () => {
    ctx.save();
    const mapSize = canvasW * 0.28;
    const margin = canvasW * 0.03; // Same margin as timestamp
    const mapX = margin;
    const mapY = canvasH - mapSize - margin;
    const r = 14;
    
    // Shadow
    ctx.fillStyle = 'rgba(26, 26, 46, 0.55)';
    roundRect(ctx, mapX + 5, mapY + 5, mapSize, mapSize, r);
    ctx.fill();
    
    // Card bg
    ctx.fillStyle = '#fdf6e3';
    roundRect(ctx, mapX, mapY, mapSize, mapSize, r);
    ctx.fill();
    
    // Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1a1a2e';
    roundRect(ctx, mapX, mapY, mapSize, mapSize, r);
    ctx.stroke();

    // Draw map tile clipped
    try {
      ctx.save();
      roundRect(ctx, mapX, mapY, mapSize, mapSize, r);
      ctx.clip();
      ctx.drawImage(img, 0, 0, 256, 256, mapX, mapY, mapSize, mapSize);
      ctx.restore();
    } catch (e) {
      console.warn('Map draw failed:', e);
    }

    // Label badge — "📍 MAPS"
    const labelFontSize = Math.round(canvasW * 0.026);
    ctx.font = `900 ${labelFontSize}px 'Fredoka', sans-serif`;
    const labelText = '📍 MAPS';
    const labelMetrics = ctx.measureText(labelText);
    const labelW = labelMetrics.width + 20;
    const labelH = labelFontSize + 16;
    const labelX = mapX + 8;
    const labelY = mapY + 8;

    ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
    roundRect(ctx, labelX, labelY, labelW, labelH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 211, 77, 0.6)';
    ctx.lineWidth = 2;
    roundRect(ctx, labelX, labelY, labelW, labelH, 8);
    ctx.stroke();
    ctx.fillStyle = '#fdf6e3';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + 10, labelY + labelH / 2);
    
    // Pin marker
    const px = Math.floor((lng + 180) / 360 * Math.pow(2, zoom) * 256);
    const py = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom) * 256);
    
    const markerX = mapX + ((px % 256) / 256) * mapSize;
    const markerY = mapY + ((py % 256) / 256) * mapSize;

    // Pin shadow
    ctx.fillStyle = 'rgba(26,26,46,0.5)';
    ctx.beginPath();
    ctx.arc(markerX + 3, markerY + 3, 10, 0, Math.PI * 2);
    ctx.fill();
    // Pin outer
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 10, 0, Math.PI * 2);
    ctx.fill();
    // Pin inner
    ctx.fillStyle = '#ef6b6b';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    callback();
  };
  
  img.onerror = () => callback();
  img.src = url;
};

let tempPendingPhoto = null;

const capturePhotoFullscreen = () => {
  const video = $('cameraVideo');
  const canvas = $('cameraCanvas');
  const ctx = canvas.getContext('2d');

  if (!video || !video.videoWidth) {
    return showToast('Kamera belum siap, tunggu sebentar...', 'error');
  }

  const videoWrap = document.querySelector('.fs-camera-video-wrap');
  if (videoWrap) {
    videoWrap.classList.remove('flash');
    void videoWrap.offsetWidth; 
    videoWrap.classList.add('flash');
  }
  playSound('shutter');

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  
  // Calculate crop for 3:4 aspect ratio to match viewfinder
  const aspect = 3/4;
  let cropW, cropH, sx, sy;
  
  if (vw / vh > aspect) { // Video is wider than 3:4
      cropH = vh;
      cropW = vh * aspect;
      sx = (vw - cropW) / 2;
      sy = 0;
  } else { // Video is taller than 3:4
      cropW = vw;
      cropH = vw / aspect;
      sx = 0;
      sy = (vh - cropH) / 2;
  }

  const outputW = 1920;
  const outputH = 2560; // 3:4 ratio, ultra high-res for sharp overlays
  canvas.width = outputW;
  canvas.height = outputH;

  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outputW, outputH);

  const finalizePhoto = () => {
    drawComicTimestamp(ctx, outputW, outputH);
    tempPendingPhoto = canvas.toDataURL('image/jpeg', 0.92);
    
    // Hide viewfinder, show polaroid preview
    $('cameraViewfinderInner').style.display = 'none';
    
    const polaroidWrap = $('fsPolaroidWrap');
    const polaroidImg = $('fsPolaroidImg');
    
    polaroidImg.src = tempPendingPhoto;
    
    // Make photo clickable to open maps if location available
    if (currentLocation) {
      polaroidImg.style.cursor = 'pointer';
      polaroidImg.onclick = () => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${currentLocation.lat},${currentLocation.lng}`, '_blank');
      };
    } else {
      polaroidImg.style.cursor = 'default';
      polaroidImg.onclick = null;
    }
    
    polaroidWrap.classList.remove('hidden');
    
    $('cameraActionStandard').classList.add('hidden');
    $('cameraActionPreview').classList.remove('hidden');
  };

  if (currentLocation) {
    drawMapOverlay(ctx, outputW, outputH, currentLocation.lat, currentLocation.lng, finalizePhoto);
  } else {
    finalizePhoto();
  }
};

const retakeFullscreenPhoto = () => {
    tempPendingPhoto = null;
    const polaroidImg = $('fsPolaroidImg');
    if (polaroidImg) { polaroidImg.onclick = null; polaroidImg.style.cursor = 'default'; }
    $('fsPolaroidWrap').classList.add('hidden');
    $('cameraViewfinderInner').style.display = '';
    $('cameraActionStandard').classList.remove('hidden');
    $('cameraActionPreview').classList.add('hidden');
};

const acceptPhoto = () => {
    if (tempPendingPhoto) {
        capturedPhotoDataUrl = tempPendingPhoto;
        stopCameraStream();
        showPreview();
        $('cameraViewfinderWrap').classList.add('hidden');
        retakeFullscreenPhoto();
    }
};

const downloadPhoto = () => {
    if (tempPendingPhoto) {
        const a = document.createElement('a');
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        a.href = tempPendingPhoto;
        a.download = `bukti_${ts}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        playSound('coin');
        showToast('Foto berhasil diunduh!');
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
      
      // Crop to 3:4 aspect ratio (portrait)
      const aspect = 3 / 4;
      let cropW, cropH, sx, sy;
      
      if (vw / vh > aspect) {
        cropH = vh;
        cropW = vh * aspect;
        sx = (vw - cropW) / 2;
        sy = 0;
      } else {
        cropW = vw;
        cropH = vw / aspect;
        sx = 0;
        sy = (vh - cropH) / 2;
      }

      const outputW = 1920;
      const outputH = 2560; // 3:4 ratio, ultra high-res
      canvas.width = outputW;
      canvas.height = outputH;

      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outputW, outputH);
      
      const finalizePhoto = () => {
        drawComicTimestamp(ctx, outputW, outputH);
        capturedPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        showPreview();
        playSound('coin');
      };

      if (currentLocation) {
        drawMapOverlay(ctx, outputW, outputH, currentLocation.lat, currentLocation.lng, finalizePhoto);
      } else {
        finalizePhoto();
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = ''; 
};

const drawComicTimestamp = (ctx, canvasW, canvasH) => {
  const now = new Date();
  const h = canvasH || canvasW;

  // --- Data ---
  const dayName = now.toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // --- Sizing ---
  const margin = canvasW * 0.03;
  const fDate = Math.round(canvasW * 0.036);
  const fTime = Math.round(canvasW * 0.030);
  const fAddr = Math.round(canvasW * 0.020);
  const padX = canvasW * 0.035;
  const padTop = canvasW * 0.025;
  const padBot = canvasW * 0.022;
  const lineGap = canvasW * 0.008;

  // --- Content ---
  const dateLine = `${dayName}, ${dateStr}`;
  const timeLine = `${timeStr} WIB`;

  // Measure banner width to fill the gap next to map
  const mapSize = canvasW * 0.28;
  const paddingBetween = margin * 0.5;
  const bannerWidth = canvasW - mapSize - margin * 2 - paddingBetween;
  
  // Word-wrap address
  const addrLines = [];
  if (currentAddress) {
    ctx.font = `700 ${fAddr}px 'Fredoka', sans-serif`;
    const maxLineW = bannerWidth - padX * 2 - 20; // 20px buffer
    const parts = currentAddress.split(/,\s*/);
    let current = '';
    parts.forEach(part => {
      const test = current ? current + ', ' + part : part;
      if (ctx.measureText(test).width > maxLineW && current) {
        addrLines.push(current + ',');
        current = part;
      } else {
        current = test;
      }
    });
    if (current) addrLines.push(current);
  }

  const dateLineH = fDate * 1.4;
  const timeLineH = fTime * 1.4;
  const addrLineH = fAddr * 1.55;
  const separatorH = addrLines.length > 0 ? canvasW * 0.02 : 0;
  const addrBlockH = addrLines.length > 0 ? addrLines.length * addrLineH + canvasW * 0.008 : 0;

  const bannerHeight = padTop + dateLineH + lineGap + timeLineH + separatorH + addrBlockH + padBot;
  const bannerX = canvasW - bannerWidth - margin;
  const bannerY = h - bannerHeight - margin;
  const r = 16;

  // --- Background: solid amber ---
  // Shadow
  ctx.fillStyle = 'rgba(26, 26, 46, 0.5)';
  roundRect(ctx, bannerX + 6, bannerY + 6, bannerWidth, bannerHeight, r);
  ctx.fill();

  // Main fill — warm amber
  ctx.fillStyle = '#f5b731';
  roundRect(ctx, bannerX, bannerY, bannerWidth, bannerHeight, r);
  ctx.fill();

  // Border — dark
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 4;
  roundRect(ctx, bannerX, bannerY, bannerWidth, bannerHeight, r);
  ctx.stroke();

  // --- Text (all centered) ---
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const centerX = bannerX + bannerWidth / 2;
  let curY = bannerY + padTop;

  // Date — bold dark
  ctx.font = `900 ${fDate}px 'Fredoka', sans-serif`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(dateLine, centerX, curY + dateLineH / 2);
  curY += dateLineH + lineGap;

  // Time — dark
  ctx.font = `800 ${fTime}px 'Fredoka', sans-serif`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(timeLine, centerX, curY + timeLineH / 2);
  curY += timeLineH;

  // Address block
  if (addrLines.length > 0) {
    // Separator line
    curY += separatorH * 0.35;
    ctx.fillStyle = 'rgba(26, 26, 46, 0.3)';
    const sepW = bannerWidth * 0.55;
    roundRect(ctx, centerX - sepW / 2, curY, sepW, 3, 2);
    ctx.fill();
    curY += separatorH * 0.65;

    ctx.font = `700 ${fAddr}px 'Fredoka', sans-serif`;
    ctx.fillStyle = 'rgba(26, 26, 46, 0.75)';
    addrLines.forEach(line => {
      ctx.fillText(line, centerX, curY + addrLineH / 2);
      curY += addrLineH;
    });
  }

  ctx.textAlign = 'left'; // Reset
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
  const doneWrap = $('cameraDoneWrap');
  if (doneWrap) doneWrap.classList.add('hidden');
  // Reopen camera
  toggleCamera();
};

const resetCameraUI = () => {
  stopCameraStream();
  capturedPhotoDataUrl = null;
  const doneWrap = $('cameraDoneWrap');
  if (doneWrap) doneWrap.classList.add('hidden');
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
  
  const customPasswords = JSON.parse(localStorage.getItem('nk_customPasswords') || '{}');
  const expectedPassword = customPasswords[username] || accounts[username];
  
  if (expectedPassword && expectedPassword === password) {
    playSound('coin');
    
    if (rememberMe) {
      localStorage.setItem('nk_loggedIn', 'true');
      localStorage.setItem('nk_loggedInUser', username);
    } else {
      sessionStorage.setItem('nk_loggedIn', 'true');
      sessionStorage.setItem('nk_loggedInUser', username);
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
  sessionStorage.removeItem('nk_loggedInUser');
  localStorage.removeItem('nk_loggedInUser');
  
  const appContainer = $('appContainer');
  const loginScreen = $('loginScreen');
  
  appContainer.style.display = 'none';
  loginScreen.classList.remove('hidden-overlay');
  loginScreen.style.display = 'flex';
  
  showToast('Behasil keluar dari Gerbang Utama');
};

let newProfilePhotoDataUrl = null;

const applyProfileData = () => {
  const savedPhoto = localStorage.getItem('nk_profilePhoto');
  const profileBtn = $('profileBtn');
  if (savedPhoto && profileBtn) {
    profileBtn.style.backgroundImage = `url(${savedPhoto})`;
    profileBtn.style.backgroundSize = 'cover';
    profileBtn.style.backgroundPosition = 'center';
    const svg = profileBtn.querySelector('svg');
    if (svg) svg.style.display = 'none';
  } else if (profileBtn) {
    profileBtn.style.backgroundImage = 'none';
    const svg = profileBtn.querySelector('svg');
    if (svg) svg.style.display = 'block';
  }
};

if ($('profileBtn')) {
  $('profileBtn').addEventListener('click', () => {
    playSound('pop');
    const savedPhoto = localStorage.getItem('nk_profilePhoto');
    const profileImg = $('profilePhotoImg');
    
    if (savedPhoto && profileImg) {
      profileImg.src = savedPhoto;
    } else if (profileImg) {
      profileImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a2e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
    }
    $('profileNewPassword').value = '';
    const loggedInUser = sessionStorage.getItem('nk_loggedInUser') || localStorage.getItem('nk_loggedInUser') || 'Sistem';
    if ($('profileNameDisplay')) {
      $('profileNameDisplay').textContent = loggedInUser;
    }
    
    newProfilePhotoDataUrl = null;
    openModal('profileModal');
  });
}

const handleProfilePhoto = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    newProfilePhotoDataUrl = event.target.result;
    $('profilePhotoImg').src = newProfilePhotoDataUrl;
    playSound('pop');
  };
  reader.readAsDataURL(file);
  e.target.value = ''; 
};

const saveProfile = () => {
  playSound('pop');
  const newPass = $('profileNewPassword').value.trim();
  const loggedInUser = sessionStorage.getItem('nk_loggedInUser') || localStorage.getItem('nk_loggedInUser');
  
  if (newProfilePhotoDataUrl) {
    localStorage.setItem('nk_profilePhoto', newProfilePhotoDataUrl);
  }
  
  if (newPass && loggedInUser) {
    const overrides = JSON.parse(localStorage.getItem('nk_customPasswords') || '{}');
    overrides[loggedInUser] = newPass;
    localStorage.setItem('nk_customPasswords', JSON.stringify(overrides));
  }
  
  applyProfileData();
  closeModal('profileModal');
  showToast('Pengaturan profil disimpan');
};

const toggleNotebookBook = () => {
    playSound('swoosh');
    const container = document.getElementById('mainNotebookContainer');
    if (container) {
        if (container.classList.contains('is-open')) {
            container.classList.remove('is-open');
            document.querySelectorAll('.notebook-tab').forEach(t => t.classList.remove('active'));
        } else {
            container.classList.add('is-open');
            let activeFound = false;
            document.querySelectorAll('.notebook-page').forEach(p => {
                if (p.classList.contains('active') || p.style.display === 'block') {
                    const pageId = p.id.replace('page-', '');
                    const btn = document.getElementById(`tabBtn-${pageId}`);
                    if (btn) btn.classList.add('active');
                    activeFound = true;
                }
            });
            if (!activeFound) switchNotebookTab('expense');
        }
    }
};

let sideChartIndex = 0;

const updateSideChartIndicators = () => {
  const indicators = document.querySelectorAll('#sideChartIndicators .indicator');
  indicators.forEach((ind, i) => {
    if (i === sideChartIndex) ind.classList.add('active');
    else ind.classList.remove('active');
  });
};

const flipSideChart = () => {
  const slides = document.querySelectorAll('.side-chart-slide');
  if (slides.length === 0) return;
  slides[sideChartIndex].classList.remove('active');
  slides[sideChartIndex].style.display = 'none';
  
  sideChartIndex = (sideChartIndex + 1) % slides.length;
  
  slides[sideChartIndex].classList.add('active');
  slides[sideChartIndex].style.display = 'block';
  updateSideChartIndicators();
};

const goToSideChartSlide = (index) => {
  const slides = document.querySelectorAll('.side-chart-slide');
  if (!slides[index] || index === sideChartIndex) return;
  
  slides[sideChartIndex].classList.remove('active');
  slides[sideChartIndex].style.display = 'none';
  
  sideChartIndex = index;
  
  slides[sideChartIndex].classList.add('active');
  slides[sideChartIndex].style.display = 'block';
  updateSideChartIndicators();
};

// ===== INITIALIZATION =====
const init = () => {
  loadState();
  applyTheme();
  populateDropdowns();
  initCharts();
  recalculate();
  applyProfileData();

  // Set initial KPI values without animation
  kpiOperasional.dataset.currentValue = getOperasionalBalance();
  kpiTabungan.dataset.currentValue = getTotalTabungan();
  kpiPengeluaran.dataset.currentValue = getTotalPengeluaran();
  kpiSisaSaldo.dataset.currentValue = getOperasionalBalance() + getTotalTabungan();

  checkAuth();
  
  // Format Inputs
  ['expAmount', 'incAmount', 'trfAmount'].forEach(id => {
    const el = $(id);
    if (el) {
      el.type = 'text';
      el.addEventListener('input', formatNominalInput);
    }
  });

  // Start side-chart slide
  setInterval(flipSideChart, 15000);
};

// ===== SPA ROUTING =====
const navigatePage = (pageId) => {
  playSound('pageFlip');
  
  // Update navs
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if(link.dataset.page === pageId) link.classList.add('active');
  });

  // Toggle sections
  document.querySelectorAll('.page-view').forEach(page => {
    page.style.display = 'none';
    page.classList.remove('active');
  });

  const activePage = $('page' + pageId.charAt(0).toUpperCase() + pageId.slice(1));
  if(activePage) {
    activePage.style.display = 'block';
    setTimeout(() => activePage.classList.add('active'), 50);
  }

  // Trigger page specific renders
  if(pageId === 'ledger') {
    renderLedger();
  }
};

// ===== LEDGER LOGIC =====
const renderLedger = () => {
  const tbody = $('ledgerTableBody');
  const emptyEl = $('ledgerEmpty');
  if(!tbody || !emptyEl) return;

  const startDate = $('filterStartDate').value;
  const endDate = $('filterEndDate').value;
  const typeFilter = $('filterType').value;
  const searchInput = $('filterSearch') ? $('filterSearch').value.toLowerCase().trim() : '';

  let filtered = [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  // Date filter logic
  if (startDate) {
    const sDate = new Date(startDate);
    sDate.setHours(0,0,0,0);
    filtered = filtered.filter(tx => new Date(tx.date) >= sDate);
  }
  if (endDate) {
    const eDate = new Date(endDate);
    eDate.setHours(23,59,59,999);
    filtered = filtered.filter(tx => new Date(tx.date) <= eDate);
  }

  // Type filter logic
  if (typeFilter !== 'all') {
    filtered = filtered.filter(tx => tx.type === typeFilter);
  }
  
  // Text search filtering logic
  if (searchInput) {
    filtered = filtered.filter(tx => (tx.description || '').toLowerCase().includes(searchInput));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  
  emptyEl.classList.add('hidden');
  
  tbody.innerHTML = filtered.map(tx => {
    const isIncome = tx.type === 'income';
    const isExpense = tx.type === 'expense';
    
    // Label
    let stampText = 'UNKNOWN';
    let stampColor = '';
    if (isIncome) { stampText = 'Pemasukan'; stampColor = 'income'; }
    if (isExpense) { stampText = 'Pengeluaran'; stampColor = 'expense'; }
    if (!isIncome && !isExpense) { stampText = 'Transfer'; stampColor = 'transfer'; }
    
    const displayDate = new Date(tx.date).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    return `
      <tr class="ledger-row" id="tx_row_${tx.id}">
        <td>
          <div style="font-size: 0.9em; font-weight: 800; color: var(--text-primary);">${displayDate}</div>
        </td>
        <td style="max-width: 200px;">
          <div style="font-weight: 800; color: var(--text-primary);">${escHtml(tx.description || '-')}</div>
        </td>
        <td>
          <span class="table-badge ${stampColor}">${stampText}</span>
        </td>
        <td>
          <div style="font-weight: 800; color: var(--text-primary); text-transform: capitalize;">${isIncome ? 'Eksternal' : escHtml(tx.source || '-')}</div>
        </td>
        <td>
          <span class="table-amount ${stampColor}">${formatRp(tx.amount)}</span>
        </td>
        <td style="text-align: center;">
          ${tx.photo ? `
            <button class="btn-icon-sq btn-view" onclick="viewPhoto('${tx.id}')" aria-label="Lihat Bukti" title="Lihat Bukti">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          ` : ''}
        </td>
        <td style="text-align: center;">
          <button class="btn-icon-sq btn-delete" onclick="deleteLedgerRow('${tx.id}', this)" aria-label="Hapus" title="Hapus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

const viewPhoto = (txId) => {
    playSound('pop');
    const tx = state.transactions.find(t => t.id === txId);
    if (tx && tx.photo) {
        const viewerImg = $('viewerPhotoImg');
        const btnDownload = $('btnDownloadViewer');
        
        viewerImg.src = tx.photo;
        
        btnDownload.onclick = () => {
             const a = document.createElement('a');
             a.href = tx.photo;
             a.download = `bukti_${tx.id}.jpg`;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             playSound('coin');
             showToast('Foto berhasil diunduh!');
        };
        
        openModal('photoViewerModal');
    } else {
        showToast('Foto tidak tersedia.', 'error');
    }
};

const deleteLedgerRow = (txId, btnEl) => {
  playSound('pop');
  
  $('confirmModalText').textContent = 'Hapus transaksi ini permanen?';
  
  const confirmBtn = $('btnConfirmAction');
  confirmBtn.onclick = () => {
    closeModal('confirmModal');
    
    const row = btnEl.closest('tr');
    if (row) row.classList.add('row-delete-anim');
    
    setTimeout(() => {
      state.transactions = state.transactions.filter(t => t.id !== txId);
      saveState();
      recalculate();
      renderLedger();
      showToast('Transaksi berhasil dihapus.', 'success');
    }, 300); 
  };
  
  openModal('confirmModal');
};

init();

