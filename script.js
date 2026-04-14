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
        ${n.type === 'error' ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;"></span>' : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;"></span>'}
      </div>
      <div style="flex:1;">
        <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${escHtml(n.message)}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${formatDateTime(n.date)} • ${escHtml(n.user || 'Sistem')}</div>
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

const closeMobileMenu = () => {
  if (!navLinks) return;
  navLinks.classList.remove('mobile-open');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
};

if (hamburger && navLinks) {
  hamburger.setAttribute('aria-expanded', 'false');

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.toggle('mobile-open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  navLinks.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) {
      closeMobileMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;
    if (!navLinks.classList.contains('mobile-open')) return;
    if (e.target.closest('#hamburger') || e.target.closest('#navLinks')) return;
    closeMobileMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMobileMenu();
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

    // Label badge — "MAPS"
    const labelFontSize = Math.round(canvasW * 0.026);
    ctx.font = `900 ${labelFontSize}px 'Fredoka', sans-serif`;
    const labelText = 'MAPS';
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

// Speech bubble messages for the mascot
const mascotSpeechMessages = {
  idle: [
    "Hai Boss! Ayo masuk ke kerajaanmu!",
    "Kerajaan menunggumu, Boss!",
    "Satu langkah lagi menuju istana!",
    "Harta karunmu aman. Ayo cek!",
  ],
  username: [
    "Hmm, siapa yang datang?",
    "Oh! Aku kenal kamu! ...kan?",
    "Ketik yang benar ya, Boss~",
  ],
  password: [
    "Sssttt... aku tutup mata dulu!",
    "Kata sandi itu rahasia kerajaan!",
    "Aku nggak ngintip, janji!",
  ],
  error: [
    "Hmm, sepertinya salah...",
    "Coba lagi, Boss! Jangan menyerah!",
    "Password atau username keliru!",
  ],
  success: [
    "Selamat datang, Yang Mulia!",
    "Gerbang terbuka! HORE!",
  ],
  poke: [
    "Hehe, geli Boss!",
    "Jangan colek-colek~",
    "Focus login dong, Boss!",
    "Aku bukan tombol!",
    "Hwaaaa! Kaget aku!",
  ],
};

const getRandomSpeech = (type) => {
  const msgs = mascotSpeechMessages[type] || mascotSpeechMessages.idle;
  return msgs[Math.floor(Math.random() * msgs.length)];
};

// ===== ANIMALESE VOICE ENGINE (Animal Crossing Style — Smooth & Cute) =====
let mascotAudioCtx = null;

// Pentatonic scale notes — these ALWAYS sound good together, never dissonant
// C major pentatonic: C D E G A (across 2 octaves) — warm & happy
const PENTATONIC_NOTES = [
  523.25, 587.33, 659.25, 783.99, 880.00,  // C5 D5 E5 G5 A5
  1046.5, 1174.7, 1318.5, 1568.0, 1760.0,  // C6 D6 E6 G6 A6
];

// Map each letter to a pentatonic note index (loops around the scale)
const charToNoteIndex = (ch) => {
  const c = ch.toLowerCase().charCodeAt(0);
  if (c >= 97 && c <= 122) return (c - 97) % PENTATONIC_NOTES.length; // a-z
  if (c >= 48 && c <= 57) return (c - 48) % PENTATONIC_NOTES.length;  // 0-9
  return -1;
};

const getMascotAudioCtx = () => {
  try {
    if (!mascotAudioCtx) {
      mascotAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (mascotAudioCtx.state === 'suspended') {
      mascotAudioCtx.resume().catch(() => {});
    }
    if (mascotAudioCtx.state === 'suspended') return null;
    return mascotAudioCtx;
  } catch (e) {
    return null;
  }
};

/**
 * Play a single cute "boop" note for a character.
 * Uses pentatonic scale + low-pass filter = always smooth, never harsh.
 */
const playAnimalese = (char) => {
  const ctx = getMascotAudioCtx();
  if (!ctx) return;

  const idx = charToNoteIndex(char);
  if (idx < 0) return; // Skip non-letter/digit

  const baseFreq = PENTATONIC_NOTES[idx];
  // Tiny random variation (±3%) — subtle, not chaotic
  const freq = baseFreq * (0.97 + Math.random() * 0.06);

  const now = ctx.currentTime;
  const duration = 0.07 + Math.random() * 0.03; // Short & bubbly (70-100ms)

  // Single clean sine oscillator — smoothest possible waveform
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  // Gentle pitch slide down — sounds like a tiny "boop"
  osc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + duration);

  // Smooth gain envelope — soft fade in, soft fade out (no clicks)
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.015);      // Soft attack
  gain.gain.linearRampToValueAtTime(0.035, now + duration * 0.4); // Sustain
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);   // Soft release

  // Low-pass filter — removes ALL harsh high frequencies, keeps it mellow
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now); // Cut everything above 1.8kHz
  filter.Q.setValueAtTime(0.7, now);          // Gentle slope, no resonance peak

  // Chain: oscillator → filter → gain → speakers
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
};

// Legacy wrapper for any external calls
const playMascotVoice = () => playAnimalese('a');

// Typing effect for speech bubble with Animalese voice
let typingTimeout = null;
let voiceCounter = 0; // Track which chars get voiced

const setMascotSpeech = (text, instant = false, targetId = 'mascotSpeechText') => {
  const el = $(targetId);
  if (!el) return;
  
  if (typingTimeout) clearTimeout(typingTimeout);
  voiceCounter = 0;
  
  if (instant) {
    el.textContent = text;
    return;
  }
  
  el.innerHTML = '<span class="typing-cursor"></span>';
  let i = 0;
  
  const typeChar = () => {
    if (i < text.length) {
      const char = text.charAt(i);
      el.innerHTML = text.substring(0, i + 1) + '<span class="typing-cursor"></span>';
      
      // Play sound every ~2 letters — not every single one (less overwhelming)
      if (/[a-zA-Z0-9]/.test(char)) {
        voiceCounter++;
        if (voiceCounter % 2 === 0) {
          playAnimalese(char);
        }
      }

      i++;
      // Relaxed typing speed with natural rhythm
      let delay;
      if (/[\s]/.test(char)) {
        delay = 55 + Math.random() * 30; // Brief word pause
      } else if (/[.,!?~…]/.test(char)) {
        delay = 90 + Math.random() * 50; // Sentence pause
      } else {
        delay = 38 + Math.random() * 22; // Normal letter (38-60ms)
      }
      typingTimeout = setTimeout(typeChar, delay);
    } else {
      el.textContent = text;
    }
  };
  
  typingTimeout = setTimeout(typeChar, 100);
};

const initLoginInteractions = () => {
  const userIn = $('loginUsername');
  const passIn = $('loginPassword');
  const mascot = $('loginMascot');
  const loginFaceEl = $('loginMascotFace');

  if (!userIn || !passIn || !mascot || !loginFaceEl) return;

  // --- Set login mascot face from MASCOT_FACES ---
  let currentLoginFace = 'neutral';
  const setLoginFace = (faceName) => {
    if (!MASCOT_FACES[faceName]) faceName = 'neutral';
    currentLoginFace = faceName;
    loginFaceEl.innerHTML = MASCOT_FACES[faceName];
  };

  // --- Helper: get pupils from current face ---
  const getLoginPupils = () => loginFaceEl.querySelectorAll('.mascot-pupils');

  // Initialize with neutral face
  setLoginFace('neutral');

  // --- Idle face cycle (rotate expressions while no input focused) ---
  const LOGIN_IDLE_FACES = ['neutral', 'happy', 'neutral', 'neutral', 'happy'];
  let loginIdleInterval = null;
  let loginIdleIdx = 0;

  const startLoginIdle = () => {
    if (loginIdleInterval) clearInterval(loginIdleInterval);
    loginIdleInterval = setInterval(() => {
      if (document.activeElement !== userIn && document.activeElement !== passIn) {
        loginIdleIdx = (loginIdleIdx + 1) % LOGIN_IDLE_FACES.length;
        setLoginFace(LOGIN_IDLE_FACES[loginIdleIdx]);
        setMascotSpeech(getRandomSpeech('idle'));
      }
    }, 8000);
  };
  startLoginIdle();

  // --- Username focus: curious face, look down ---
  const USERNAME_FACES = ['neutral', 'happy', 'surprised'];
  userIn.addEventListener('focus', () => {
    if (loginIdleInterval) clearInterval(loginIdleInterval);
    const face = USERNAME_FACES[Math.floor(Math.random() * USERNAME_FACES.length)];
    setLoginFace(face);
    // Nudge pupils down
    const pupils = getLoginPupils();
    pupils.forEach(p => { p.style.transform = 'translateY(1.5px)'; p.style.transition = 'transform 0.15s ease-out'; });
    mascot.style.transform = 'scale(1.06)';
    setMascotSpeech(getRandomSpeech('username'));
  });

  // --- Username input: Pupils follow text length ---
  userIn.addEventListener('input', (e) => {
    const len = Math.min(e.target.value.length, 20);
    const shiftX = (len / 20) * 3 - 1.5;
    const pupils = getLoginPupils();
    pupils.forEach(p => { p.style.transform = `translate(${shiftX}px, 1.5px)`; p.style.transition = 'transform 0.1s ease-out'; });
  });

  userIn.addEventListener('blur', () => {
    const pupils = getLoginPupils();
    pupils.forEach(p => { p.style.transform = 'translate(0, 0)'; });
    mascot.style.transform = '';
    setLoginFace('neutral');
    startLoginIdle();
  });

  // --- Password focus: closed/shy face ---
  const PASSWORD_FACES = ['laugh', 'tickled']; // eyes shut
  passIn.addEventListener('focus', () => {
    if (loginIdleInterval) clearInterval(loginIdleInterval);
    const face = PASSWORD_FACES[Math.floor(Math.random() * PASSWORD_FACES.length)];
    setLoginFace(face);
    mascot.style.transform = 'scale(0.96) translateY(6px) rotate(-3deg)';
    setMascotSpeech(getRandomSpeech('password'));
  });

  passIn.addEventListener('blur', () => {
    setLoginFace('neutral');
    mascot.style.transform = '';
    startLoginIdle();
  });

  // --- Click mascot: POKE with random expression ---
  const LOGIN_POKE_FACES = [
    { face: 'tickled', text: 'GYAHAHA! Stop Boss!!' },
    { face: 'surprised', text: 'HUWAA! Kaget!!' },
    { face: 'angry', text: 'Ih! Jangan sentuh!' },
    { face: 'happy', text: 'Hehe~ kena deh!' },
    { face: 'angry_surprised', text: 'HAH?! APA-APAAN?!' },
    { face: 'scared', text: 'H-hiii! Jangan tiba-tiba!' },
    { face: 'laugh', text: 'Ehehe~ sekali lagi~' },
    { face: 'disgusted', text: 'Ihh tangan Boss bau!' },
    { face: 'scared_surprised', text: 'ASTAGA!! JANTUNGKU!!' },
    { face: 'surprised_happy', text: 'OH! Hai Boss~ hehe!' },
    { face: 'cynical', text: 'Hmm... iseng ya?' },
    { face: 'happy_disgusted', text: 'Geli tapi lucu~' },
    { face: 'surprised_scared', text: 'UWAAA!! AMPUN!!' },
  ];
  let lastLoginPoke = -1;

  mascot.addEventListener('click', (e) => {
    e.stopPropagation();
    if (loginIdleInterval) clearInterval(loginIdleInterval);
    playSound('pop');

    let idx;
    do { idx = Math.floor(Math.random() * LOGIN_POKE_FACES.length); } while (idx === lastLoginPoke && LOGIN_POKE_FACES.length > 1);
    lastLoginPoke = idx;
    const reaction = LOGIN_POKE_FACES[idx];

    setLoginFace(reaction.face);
    setMascotSpeech(reaction.text);

    // Quick bounce
    mascot.style.transition = 'transform 0.15s ease';
    mascot.style.transform = 'scale(1.15) rotate(5deg)';
    setTimeout(() => {
      mascot.style.transform = 'scale(0.9) rotate(-5deg)';
      setTimeout(() => {
        mascot.style.transition = '';
        mascot.style.transform = '';
        // Return to neutral after 2s
        setTimeout(() => {
          setLoginFace('neutral');
          startLoginIdle();
        }, 2000);
      }, 150);
    }, 150);
  });

  // --- Mouse proximity: Eyes follow cursor (desktop) ---
  const loginCard = document.querySelector('.login-card');
  if (loginCard) {
    loginCard.addEventListener('mousemove', (e) => {
      // Only track if face has visible pupils and not focused on input
      if (document.activeElement === userIn || document.activeElement === passIn) return;
      const pupils = getLoginPupils();
      if (!pupils.length) return;

      const rect = mascot.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      const maxShift = 1.5;
      let shiftX = dx * 3;
      let shiftY = dy * 3;
      const dist = Math.sqrt(shiftX * shiftX + shiftY * shiftY);
      if (dist > maxShift) {
        shiftX = (shiftX / dist) * maxShift;
        shiftY = (shiftY / dist) * maxShift;
      }
      pupils.forEach(p => {
        p.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        p.style.transition = 'transform 0.15s ease-out';
      });
    });

    loginCard.addEventListener('mouseleave', () => {
      if (document.activeElement !== userIn && document.activeElement !== passIn) {
        const pupils = getLoginPupils();
        pupils.forEach(p => { p.style.transform = 'translate(0, 0)'; });
      }
    });
  }
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
    
    // Mascot celebrates with dynamic face!
    const loginFaceEl = $('loginMascotFace');
    const mascotSvg = $('loginMascot');
    const SUCCESS_FACES = ['happy_surprised', 'surprised_happy', 'laugh', 'happy'];
    if (loginFaceEl) {
      const face = SUCCESS_FACES[Math.floor(Math.random() * SUCCESS_FACES.length)];
      loginFaceEl.innerHTML = MASCOT_FACES[face] || MASCOT_FACES.happy;
    }
    if (mascotSvg) {
      mascotSvg.style.transform = 'scale(1.2) rotate(5deg)';
      mascotSvg.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }
    setMascotSpeech(getRandomSpeech('success'));
    
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
    
    // Mascot reacts to error with dynamic face
    const loginFaceEl = $('loginMascotFace');
    const ERROR_FACES = ['angry', 'sad_angry', 'scared', 'angry_surprised', 'sad_surprised', 'angry_sad', 'sad'];
    if (loginFaceEl) {
      const face = ERROR_FACES[Math.floor(Math.random() * ERROR_FACES.length)];
      loginFaceEl.innerHTML = MASCOT_FACES[face] || MASCOT_FACES.angry;
    }
    setMascotSpeech(getRandomSpeech('error'));
    const mascotSvg = $('loginMascot');
    if (mascotSvg) {
      mascotSvg.style.transition = 'transform 0.1s ease';
      mascotSvg.style.transform = 'scale(1.05) rotate(-3deg)';
      setTimeout(() => {
        mascotSvg.style.transform = ''; mascotSvg.style.transition = '';
        // Reset to neutral after shake
        if (loginFaceEl) loginFaceEl.innerHTML = MASCOT_FACES.neutral;
      }, 800);
    }
    
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
  closeMobileMenu();
  
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

// ===== LEDGER LOGIC (V2 — Card Based) =====
let ledgerCurrentPage = 1;
const LEDGER_PER_PAGE = 5;
let ledgerPeriodMode = '30days'; // '30days' | 'all' | 'custom'
const ledgerTypeOptions = ['all', 'income', 'expense', 'transfer'];
const ledgerTypeLabels = { all: 'Semua Tipe', income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' };
let ledgerTypeIndex = 0;
let ledgerSortColumn = 'date'; // 'date' | 'amount' | 'category' | 'description'
let ledgerSortDir = 'desc';    // 'asc' | 'desc'

const toggleLedgerSort = (column) => {
  playSound('pop');
  if (ledgerSortColumn === column) {
    ledgerSortDir = ledgerSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    ledgerSortColumn = column;
    ledgerSortDir = column === 'amount' ? 'desc' : 'asc';
  }
  updateSortIndicators();
  ledgerCurrentPage = 1;
  renderLedger();
};

const updateSortIndicators = () => {
  document.querySelectorAll('.ledger-v2-col-headers .col-sortable').forEach(el => {
    el.classList.remove('sort-asc', 'sort-desc');
    if (el.dataset.sort === ledgerSortColumn) {
      el.classList.add(ledgerSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
};

// Filter UI Helpers
const toggleLedgerPeriodFilter = () => {
  playSound('pop');
  const dateRangeEl = $('ledgerDateRange');
  const pillEl = $('filterPillPeriod');
  const textEl = $('filterPeriodText');
  
  if (ledgerPeriodMode === '30days') {
    ledgerPeriodMode = 'all';
    textEl.textContent = 'Semua Waktu';
    pillEl.classList.remove('active');
    dateRangeEl.classList.add('hidden');
    $('filterStartDate').value = '';
    $('filterEndDate').value = '';
  } else if (ledgerPeriodMode === 'all') {
    ledgerPeriodMode = 'custom';
    textEl.textContent = 'Kustom';
    pillEl.classList.add('active');
    dateRangeEl.classList.remove('hidden');
  } else if (ledgerPeriodMode === 'custom') {
    ledgerPeriodMode = '7days';
    textEl.textContent = '7 Hari Terakhir';
    pillEl.classList.add('active');
    dateRangeEl.classList.add('hidden');
    $('filterStartDate').value = '';
    $('filterEndDate').value = '';
  } else if (ledgerPeriodMode === '7days') {
    ledgerPeriodMode = '14days';
    textEl.textContent = '14 Hari Terakhir';
  } else {
    ledgerPeriodMode = '30days';
    textEl.textContent = '30 Hari Terakhir';
  }
  ledgerCurrentPage = 1;
  renderLedger();
};

const cycleLedgerTypeFilter = () => {
  playSound('pop');
  ledgerTypeIndex = (ledgerTypeIndex + 1) % ledgerTypeOptions.length;
  const val = ledgerTypeOptions[ledgerTypeIndex];
  $('filterType').value = val;
  $('filterTypeText').textContent = ledgerTypeLabels[val];
  const pillEl = $('filterPillType');
  pillEl.classList.remove('filter-income', 'filter-expense', 'filter-transfer');
  pillEl.classList.add('active');
  if (val !== 'all') {
    pillEl.classList.add(`filter-${val}`);
  }
  ledgerCurrentPage = 1;
  renderLedger();
};

const toggleLedgerSearchBar = () => {
  playSound('pop');
  const searchBarEl = $('ledgerSearchBar');
  const pillEl = $('filterPillSearch');
  const isHidden = searchBarEl.classList.contains('hidden');
  searchBarEl.classList.toggle('hidden', !isHidden);
  pillEl.classList.toggle('filter-search-open', isHidden);
  if (isHidden) {
    setTimeout(() => $('filterSearch').focus(), 100);
  } else {
    $('filterSearch').value = '';
    renderLedger();
  }
};

const renderLedger = () => {
  const container = $('ledgerCardsContainer');
  const emptyEl = $('ledgerEmpty');
  const paginationEl = $('ledgerPagination');
  const countEl = $('ledgerTxCount');
  const totalInEl = $('ledgerTotalIn');
  const totalOutEl = $('ledgerTotalOut');
  if(!container || !emptyEl) return;

  const typeFilter = $('filterType').value;
  const searchInput = $('filterSearch') ? $('filterSearch').value.toLowerCase().trim() : '';

  let filtered = [...state.transactions];
  
  // Apply column sort
  filtered.sort((a, b) => {
    let valA, valB;
    switch (ledgerSortColumn) {
      case 'date':
        valA = new Date(a.date); valB = new Date(b.date);
        break;
      case 'amount':
        valA = Math.abs(a.amount); valB = Math.abs(b.amount);
        break;
      case 'category':
        valA = (a.category || '').toLowerCase(); valB = (b.category || '').toLowerCase();
        return ledgerSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      case 'description':
        valA = (a.description || '').toLowerCase(); valB = (b.description || '').toLowerCase();
        return ledgerSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      default:
        valA = new Date(a.date); valB = new Date(b.date);
    }
    return ledgerSortDir === 'asc' ? valA - valB : valB - valA;
  });
  
  // Period filter
  if (ledgerPeriodMode === '30days') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0,0,0,0);
    filtered = filtered.filter(tx => new Date(tx.date) >= thirtyDaysAgo);
  } else if (ledgerPeriodMode === '14days') {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0,0,0,0);
    filtered = filtered.filter(tx => new Date(tx.date) >= fourteenDaysAgo);
  } else if (ledgerPeriodMode === '7days') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);
    filtered = filtered.filter(tx => new Date(tx.date) >= sevenDaysAgo);
  } else if (ledgerPeriodMode === 'custom') {
    const startDate = $('filterStartDate').value;
    const endDate = $('filterEndDate').value;
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
  }

  // --- NEW LOGIC: Calculate Selisih BEFORE Type & Search filters so it only depends on Rentang Waktu ---
  let selisihIn = 0, selisihOut = 0;
  filtered.forEach(tx => {
    if (tx.type === 'income') selisihIn += tx.amount;
    else if (tx.type === 'expense') selisihOut += tx.amount;
  });
  const netFlow = selisihIn - selisihOut;

  // Type filter
  if (typeFilter !== 'all') {
    filtered = filtered.filter(tx => tx.type === typeFilter);
  }
  
  // Search filter
  if (searchInput) {
    filtered = filtered.filter(tx => (tx.description || '').toLowerCase().includes(searchInput));
  }

  // Calculate totals for currently visible items
  let totalIn = 0, totalOut = 0;
  filtered.forEach(tx => {
    if (tx.type === 'income') totalIn += tx.amount;
    else if (tx.type === 'expense') totalOut += tx.amount;
  });
  totalInEl.textContent = formatRp(totalIn);
  totalOutEl.textContent = formatRp(totalOut);

  // Calculate & display net flow
  const netFlowEl = $('ledgerNetFlow');
  const netPillEl = $('summaryNetFlow');
  const netMsgEl = $('ledgerNetFlowMsg');
  const netMascotEl = $('ledgerNetFlowMascot');

  if (netFlowEl) {
    const prefix = netFlow > 0 ? '+' : (netFlow < 0 ? '-' : '');
    netFlowEl.textContent = `${prefix}${formatRp(Math.abs(netFlow))}`;
  }
  
  if (netPillEl && netMsgEl && netMascotEl) {
    netPillEl.classList.remove('surplus', 'deficit');
    
    // Funny phrases and interactive mascots
    let msg = "";
    let mascotHtml = "";
    
    const svgLaugh = `<svg viewBox="0 0 32 32" width="36" height="36" fill="none" class="mascot-laugh-svg">
      <path d="M4 24h24v3H4z" fill="#f6a723" rx="1.5" />
      <path d="M4 24L2 10l8 6 6-10 6 10 8-6-2 14z" fill="#f6a723" opacity="0.85" />
      <circle cx="8" cy="10.5" r="1.8" fill="#f6a723" />
      <circle cx="16" cy="5.5" r="1.8" fill="#f6a723" />
      <circle cx="24" cy="10.5" r="1.8" fill="#f6a723" />
      <g style="transform-origin: center 15.5px; animation: blink 4s infinite;">
        <path d="M10 17 Q12 14 14 17" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M18 17 Q20 14 22 17" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round" fill="none" />
      </g>
      <path d="M12 19 Q16 26 20 19 Z" fill="#b91c1c" />
      <circle cx="9" cy="19" r="2" fill="#fca5a5" opacity="0.8" />
      <circle cx="23" cy="19" r="2" fill="#fca5a5" opacity="0.8" />
    </svg>`;

    const svgCry = `<svg viewBox="0 0 32 32" width="36" height="36" fill="none" class="mascot-cry-svg">
      <path d="M4 24h24v3H4z" fill="#f6a723" rx="1.5" />
      <path d="M4 24L2 10l8 6 6-10 6 10 8-6-2 14z" fill="#f6a723" opacity="0.85" />
      <circle cx="8" cy="10.5" r="1.8" fill="#f6a723" />
      <circle cx="16" cy="5.5" r="1.8" fill="#f6a723" />
      <circle cx="24" cy="10.5" r="1.8" fill="#f6a723" />
      <g style="transform-origin: center 15px; animation: blink 4s infinite 1.5s;">
        <path d="M10 15 Q12 13 14 16" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M18 16 Q20 13 22 15" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round" fill="none" />
      </g>
      <ellipse cx="16" cy="21" rx="2.5" ry="3.5" fill="#1a1a2e" />
      <circle cx="11" cy="18" r="1.5" fill="#38bdf8" class="tear-anim tear-left" />
      <circle cx="21" cy="18" r="1.5" fill="#38bdf8" class="tear-anim tear-right" />
    </svg>`;

    const svgNeutral = `<svg viewBox="0 0 32 32" width="36" height="36" fill="none" class="mascot-neutral-svg">
      <path d="M4 24h24v3H4z" fill="#f6a723" rx="1.5" />
      <path d="M4 24L2 10l8 6 6-10 6 10 8-6-2 14z" fill="#f6a723" opacity="0.85" />
      <circle cx="8" cy="10.5" r="1.8" fill="#f6a723" />
      <circle cx="16" cy="5.5" r="1.8" fill="#f6a723" />
      <circle cx="24" cy="10.5" r="1.8" fill="#f6a723" />
      <g style="transform-origin: center 16px; animation: blink 4s infinite 0.5s;">
        <ellipse cx="12" cy="16" rx="2.5" ry="3.5" fill="#fff" />
        <ellipse cx="20" cy="16" rx="2.5" ry="3.5" fill="#fff" />
        <circle cx="12" cy="16" r="1.2" fill="#1a1a2e" />
        <circle cx="20" cy="16" r="1.2" fill="#1a1a2e" />
      </g>
      <path d="M14 21 Q16 20.5 18 21" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    </svg>`;

    netMascotEl.style.animation = "none";
    
    if (netFlow > 0) {
      netPillEl.classList.add('surplus');
      const surplusPhrases = [
        "Wah, raja makmur nih! Cuan deras~",
        "Mantap bossque! Kas keraton penuh!",
        "Sultan mah bebas! Saldo luber~"
      ];
      msg = surplusPhrases[Math.floor(Math.random() * surplusPhrases.length)];
      mascotHtml = svgLaugh;
    } else if (netFlow < 0) {
      netPillEl.classList.add('deficit');
      const deficitPhrases = [
        "Waduh... koinnya amblas boss!",
        "Rakyat menjerit, kas menipis!",
        "Astaga naga, boncos bulan ini!"
      ];
      msg = deficitPhrases[Math.floor(Math.random() * deficitPhrases.length)];
      mascotHtml = svgCry;
    } else {
      msg = "Imbang bro! Gak rugi, gak untung.";
      mascotHtml = svgNeutral;
    }
    
    netMsgEl.textContent = msg;
    netMascotEl.innerHTML = mascotHtml;
  }

  // ===== SELISIH ANALYSIS ENGINE =====
  const analysisEl = $('selisihAnalysis');
  if (analysisEl) {
    if (filtered.length === 0) {
      analysisEl.style.display = 'none';
      analysisEl.innerHTML = '';
    } else {
      let analysisHTML = '';
      const pct = totalIn > 0 ? ((netFlow / totalIn) * 100).toFixed(0) : 0;
      const ratio = totalIn > 0 ? (totalOut / totalIn * 100).toFixed(0) : (totalOut > 0 ? 100 : 0);

      // Categorize expenses
      const expenseByCategory = {};
      filtered.filter(t => t.type === 'expense').forEach(t => {
        const cat = (t.category || 'Lainnya');
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount;
      });
      const sortedCats = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedCats.length > 0 ? sortedCats[0] : null;
      const topCatPct = topCategory && totalOut > 0 ? (topCategory[1] / totalOut * 100).toFixed(0) : 0;

      if (netFlow > 0) {
        // SURPLUS analysis
        analysisHTML = `<strong>📊 Status: SURPLUS (Sehat)</strong><br>`;
        analysisHTML += `Kamu berhasil menahan sisa dana sebesar <strong>${pct}%</strong> dari pemasukan periode ini. Total pengeluaranmu hanya <strong>${ratio}%</strong> dari uang yang masuk.<br>`;
        if (topCategory) {
          analysisHTML += `<br>💡 <strong>Alasan Surplus:</strong> Realisasi bebanmu tetap di bawah pendapatan, di mana pengeluaran terbesarmu dialokasikan pada <strong>${topCategory[0]}</strong> (${topCatPct}% dari total keluar). `;
        }
        if (netFlow > totalOut * 2) {
          analysisHTML += `Kas terpantau stabil dan bertumbuh positif!`;
        } else {
          analysisHTML += `Kondisi kasmu tergolong aman, terapkan terus manajemen ini.`;
        }
      } else if (netFlow < 0) {
        // DEFICIT analysis
        const deficitAmt = Math.abs(netFlow);
        analysisHTML = `<strong>⚠️ Status: DEFISIT (Boncos)</strong><br>`;
        if (totalIn > 0) {
          const overPct = (deficitAmt / totalIn * 100).toFixed(0);
          analysisHTML += `Pengeluaranmu melampaui pemasukan! Kamu telah membelanjakan <strong>${ratio}%</strong> dari pendapatan (Over budget <strong>${overPct}%</strong>).<br>`;
        } else {
          analysisHTML += `Belum ada pemasukan yang tercatat, tetapi kamu sudah menghabiskan dana sebesar <strong>${formatRp(totalOut)}</strong>!<br>`;
        }
        if (topCategory) {
          analysisHTML += `<br>🔍 <strong>Penyebab Utama:</strong> Kebocoran terbesar berasal dari kategori <strong>${topCategory[0]}</strong> menyita dana <strong>${formatRp(topCategory[1])}</strong> (${topCatPct}% dari beban).`;
          if (sortedCats.length > 1) {
            analysisHTML += ` Penguras dana terbesar kedua adalah <strong>${sortedCats[1][0]}</strong>.`;
          }
          analysisHTML += ` Pertimbangkan untuk menekan biaya pada sektor tersebut.`;
        }
      } else {
        // ZERO / BALANCE
        if (totalIn === 0 && totalOut === 0) {
          analysisHTML = ''; // Handled below
        } else {
          analysisHTML = `<strong>⚖️ Status: SEIMBANG (Break Even)</strong><br>`;
          analysisHTML += `Pemasukan (<strong>${formatRp(totalIn)}</strong>) sama persis dengan Pengeluaran (<strong>${formatRp(totalOut)}</strong>).<br><br>💡 Tidak ada untung maupun rugi. Arus uang hanya menumpang lewat di periode ini!`;
        }
      }

      if (analysisHTML === '') {
        analysisEl.style.display = 'none';
        analysisEl.innerHTML = '';
      } else {
        analysisEl.style.display = 'block';
        analysisEl.innerHTML = analysisHTML;
      }
    }
  }

  // Pagination
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / LEDGER_PER_PAGE));
  if (ledgerCurrentPage > totalPages) ledgerCurrentPage = totalPages;
  
  const startIdx = (ledgerCurrentPage - 1) * LEDGER_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + LEDGER_PER_PAGE);

  // Update count badge
  countEl.textContent = `MENAMPILKAN ${totalItems} TRANSAKSI`;

  if (totalItems === 0) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    paginationEl.innerHTML = '';
    return;
  }
  
  emptyEl.classList.add('hidden');
  
  // Render cards
  container.innerHTML = pageItems.map(tx => {
    const isIncome = tx.type === 'income';
    const isExpense = tx.type === 'expense';
    const isTransfer = tx.type === 'transfer';
    
    // Category badge
    let catText, catClass, catIcon;
    if (isIncome) {
      catText = 'Pemasukan';
      catClass = 'cat-income';
      catIcon = 'Rp';
    } else if (isExpense) {
      catText = tx.category || 'Pengeluaran';
      catClass = 'cat-expense';
      catIcon = '$';
    } else {
      catText = 'Transfer';
      catClass = 'cat-transfer';
      catIcon = '~';
    }

    // Amount display
    let amountClass = 'neutral';
    if (isIncome) amountClass = 'positive';
    if (isExpense) amountClass = 'negative';
    
    // Format date
    const d = new Date(tx.date);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    // Source label
    let sourceLabel = '';
    if (isIncome) {
      sourceLabel = getAccountLabel(tx.destination);
    } else if (isExpense) {
      sourceLabel = getAccountLabel(tx.source);
    } else {
      sourceLabel = `${getAccountLabel(tx.source)} → ${getAccountLabel(tx.destination)}`;
    }

    // Actions
    const photoBtn = tx.photo ? `
      <button class="btn-icon-mini btn-view-mini" onclick="viewPhoto('${tx.id}')" aria-label="Lihat Bukti" title="Lihat Bukti">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>` : '';
    
    const deleteBtn = `
      <button class="btn-icon-mini btn-delete-mini" onclick="deleteLedgerRow('${tx.id}', this)" aria-label="Hapus" title="Hapus">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>`;

    return `
      <div class="tx-card type-${tx.type}" id="tx_row_${tx.id}">
        <div class="tx-date">${dateStr}</div>
        <span class="tx-category-badge ${catClass}">${catIcon} ${escHtml(catText)}</span>
        <div class="tx-description">
          <span>${escHtml(tx.description || '-')}</span>
        </div>
        <div class="tx-amount ${amountClass}">${formatRp(tx.amount)}</div>
        <span class="tx-source-tag">${escHtml(sourceLabel)}</span>
        <div class="tx-actions">
          ${photoBtn}
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');

  // Render pagination
  let paginationHTML = '';
  
  // Prev button
  paginationHTML += `<button class="page-btn ${ledgerCurrentPage <= 1 ? 'disabled' : ''}" onclick="goToLedgerPage(${ledgerCurrentPage - 1})">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - ledgerCurrentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === ledgerCurrentPage - 3 || i === ledgerCurrentPage + 3) {
        paginationHTML += `<span style="color: var(--text-muted); font-weight: 800; padding: 0 4px;">•••</span>`;
      }
      continue;
    }
    paginationHTML += `<button class="page-btn ${i === ledgerCurrentPage ? 'active' : ''}" onclick="goToLedgerPage(${i})">${i}</button>`;
  }
  
  // Next button
  paginationHTML += `<button class="page-btn ${ledgerCurrentPage >= totalPages ? 'disabled' : ''}" onclick="goToLedgerPage(${ledgerCurrentPage + 1})">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;

  paginationEl.innerHTML = paginationHTML;
};

const goToLedgerPage = (page) => {
  playSound('pop');
  ledgerCurrentPage = page;
  renderLedger();
  // Scroll to top of ledger
  const ledgerEl = $('pageLedger');
  if (ledgerEl) ledgerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    
    const card = btnEl.closest('.tx-card');
    if (card) card.classList.add('row-delete-anim');
    
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

// ===== INTERACTIVE MASCOT =====

// --- SVG Face Templates (with eyebrows & soft eyes) ---
// 27 unique expressions covering all emotional combinations
const MASCOT_FACES = {

  // ========== BASIC EMOTIONS ==========

  neutral: `
    <path d="M10 12.5 Q12 11 14 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 12 Q20 11 22 12.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.1" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1.1" fill="#1a1a2e"/>
        <circle cx="12.5" cy="15.6" r="0.4" fill="#fff" opacity="0.8"/>
        <circle cx="20.5" cy="15.6" r="0.4" fill="#fff" opacity="0.8"/>
      </g>
    </g>
    <path d="M14 21 Q16 22.5 18 21" fill="none" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round"/>
  `,

  happy: `
    <path d="M10 10.5 Q12 9 14 10.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 10.5 Q20 9 22 10.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="15.5" r="1.1" fill="#1a1a2e"/>
        <circle cx="20" cy="15.5" r="1.1" fill="#1a1a2e"/>
        <circle cx="12.5" cy="15.1" r="0.4" fill="#fff" opacity="0.8"/>
        <circle cx="20.5" cy="15.1" r="0.4" fill="#fff" opacity="0.8"/>
      </g>
    </g>
    <circle cx="9.5" cy="18.5" r="2" fill="#ffb3ba" opacity="0.7"/>
    <circle cx="22.5" cy="18.5" r="2" fill="#ffb3ba" opacity="0.7"/>
    <path d="M13.5 19.5 Q16 23.5 18.5 19.5" fill="none" stroke="#5a4a3a" stroke-width="1.1" stroke-linecap="round"/>
  `,

  laugh: `
    <path d="M10 10 Q12 8 14 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 10 Q20 8 22 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M10 16 Q12 13.5 14 16" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M18 16 Q20 13.5 22 16" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="9.5" cy="17.5" r="2.5" fill="#ffb3ba" opacity="0.7"/>
    <circle cx="22.5" cy="17.5" r="2.5" fill="#ffb3ba" opacity="0.7"/>
    <path d="M13 19 Q16 25 19 19 Z" fill="#1a1a2e"/>
    <path d="M14 21 Q16 20 18 21" fill="#e85d75" stroke="none"/>
  `,

  sad: `
    <path d="M10 12 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10.5 22 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="14.8" cy="19" rx="0.8" ry="1.5" fill="#5b9de9" opacity="0.85">
      <animate attributeName="cy" values="19;22;19" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.85;0.2;0.85" dur="1.8s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M14 22 Q16 19.5 18 22" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  `,

  angry: `
    <path d="M10 12.5 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10.5 22 12.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1.4" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="1.4" fill="#1a1a2e"/>
        <circle cx="12" cy="16" r="0.5" fill="#c0392b"/>
        <circle cx="20" cy="16" r="0.5" fill="#c0392b"/>
      </g>
    </g>
    <g opacity="0.7">
      <path d="M7 9 L8.5 10 L7.5 10.5 L9 11.5" stroke="#e74c3c" stroke-width="0.8" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M14 22 Q16 20 18 22" stroke="#5a4a3a" stroke-width="1.1" stroke-linecap="round" fill="none"/>
  `,

  scared: `
    <!-- Takut: Alis naik tinggi, mata besar lebar, mulut O kecil -->
    <path d="M10 10 Q12 8 14 10.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 10.5 Q20 8 22 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="0.9" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="0.9" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="16" cy="22" rx="1.5" ry="1.8" fill="#1a1a2e"/>
    <!-- Keringat dingin -->
    <ellipse cx="7.5" cy="14" rx="0.6" ry="1.2" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="14;18;14" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.7;0;0.7" dur="1.5s" repeatCount="indefinite"/>
    </ellipse>
  `,

  disgusted: `
    <!-- Jijik: Satu alis turun satu naik, mata menyipit, mulut miring -->
    <path d="M10 12 Q12 11.5 14 12.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10 22 11" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="0.9" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1" fill="#1a1a2e"/>
      </g>
    </g>
    <circle cx="9" cy="18" r="1.5" fill="#b8e994" opacity="0.5"/>
    <path d="M13 21 Q15 22 17 20.5 Q18 21.5 19 21" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  `,

  surprised: `
    <!-- Terkejut: Alis sangat tinggi, mata bulat besar, mulut O -->
    <path d="M9.5 9 Q12 7 14.5 9" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M17.5 9 Q20 7 22.5 9" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="3" ry="3.8" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="3" ry="3.8" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="12.6" cy="15.2" r="0.5" fill="#fff" opacity="0.9"/>
        <circle cx="20.6" cy="15.2" r="0.5" fill="#fff" opacity="0.9"/>
      </g>
    </g>
    <ellipse cx="16" cy="22.5" rx="2" ry="2.5" fill="#1a1a2e"/>
    <ellipse cx="16" cy="22" rx="1.2" ry="1.5" fill="#e85d75"/>
  `,

  tickled: `
    <path d="M10 9 Q12 7 14 9" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 9 Q20 7 22 9" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M10 15.5 Q12 13 14 15.5" stroke="#5a4a3a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M18 15.5 Q20 13 22 15.5" stroke="#5a4a3a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <circle cx="9" cy="17" r="2.8" fill="#ffb3ba" opacity="0.8"/>
    <circle cx="23" cy="17" r="2.8" fill="#ffb3ba" opacity="0.8"/>
    <circle cx="8.5" cy="15" r="0.8" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="15;13;15" dur="0.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="23.5" cy="15" r="0.8" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="15;13;15" dur="0.5s" repeatCount="indefinite"/>
    </circle>
    <path d="M12.5 19 Q16 26 19.5 19 Z" fill="#1a1a2e"/>
    <ellipse cx="16" cy="22" rx="1.8" ry="1" fill="#e85d75"/>
    <circle cx="6" cy="12" r="0.6" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cx" values="6;4;6" dur="0.3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="26" cy="12" r="0.6" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cx" values="26;28;26" dur="0.3s" repeatCount="indefinite"/>
    </circle>
  `,

  // ========== COMPOUND EMOTIONS ==========

  // Bahagia + Terkejut → Takjub (amazed)
  happy_surprised: `
    <!-- Takjub: alis tinggi, mata bersinar lebar, mulut O besar + blush -->
    <path d="M9.5 8.5 Q12 6.5 14.5 8.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M17.5 8.5 Q20 6.5 22.5 8.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15" rx="3.2" ry="4" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15" rx="3.2" ry="4" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="15.5" r="1.6" fill="#1a1a2e"/>
        <circle cx="20" cy="15.5" r="1.6" fill="#1a1a2e"/>
        <circle cx="12.7" cy="14.5" r="0.7" fill="#fff" opacity="0.9"/>
        <circle cx="20.7" cy="14.5" r="0.7" fill="#fff" opacity="0.9"/>
        <!-- bintang kecil di mata -->
        <circle cx="11.3" cy="14" r="0.3" fill="#f6a723" opacity="0.8"/>
        <circle cx="19.3" cy="14" r="0.3" fill="#f6a723" opacity="0.8"/>
      </g>
    </g>
    <circle cx="9" cy="18" r="2.2" fill="#ffb3ba" opacity="0.7"/>
    <circle cx="23" cy="18" r="2.2" fill="#ffb3ba" opacity="0.7"/>
    <ellipse cx="16" cy="22" rx="2.2" ry="2.5" fill="#1a1a2e"/>
    <ellipse cx="16" cy="21.8" rx="1.3" ry="1.2" fill="#e85d75"/>
    <!-- sparkle -->
    <g opacity="0.6">
      <line x1="6" y1="8" x2="7" y2="9" stroke="#f6a723" stroke-width="0.8"/>
      <line x1="7" y1="8" x2="6" y2="9" stroke="#f6a723" stroke-width="0.8"/>
      <line x1="25" y1="8" x2="26" y2="9" stroke="#f6a723" stroke-width="0.8"/>
      <line x1="26" y1="8" x2="25" y2="9" stroke="#f6a723" stroke-width="0.8"/>
    </g>
  `,

  // Bahagia + Jijik → senyum paksa, satu mata menyipit
  happy_disgusted: `
    <!-- Senyum jijik: alis asimetris, mata menyipit sebelah, senyum canggung -->
    <path d="M10 10.5 Q12 9.5 14 11" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 12.5 Q20 11.5 22 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="15.5" r="1.1" fill="#1a1a2e"/>
        <circle cx="20" cy="16.2" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <circle cx="9.5" cy="18" r="1.5" fill="#b8e994" opacity="0.4"/>
    <circle cx="22.5" cy="18" r="1.5" fill="#ffb3ba" opacity="0.5"/>
    <path d="M13 20.5 Q16 23 18 20 L18.5 20.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  `,

  // Sedih + Terkejut → kaget sedih
  sad_surprised: `
    <!-- Sedih kaget: alis terangkat tapi miring sedih, mata basah besar, mulut O kecil -->
    <path d="M10 10 Q12 8 14 10.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 10.5 Q20 8 22 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="1.2" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="14.5" cy="19.5" rx="0.7" ry="1.2" fill="#5b9de9" opacity="0.8">
      <animate attributeName="cy" values="19.5;22;19.5" dur="1.5s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="16" cy="22.5" rx="1.5" ry="1.5" fill="#1a1a2e"/>
  `,

  // Sedih + Marah → marah terluka
  sad_angry: `
    <!-- Marah tapi nangis: alis V tapi bergetar, mata tajam + air mata -->
    <path d="M10 12 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10.5 22 12" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="12" cy="16" r="0.4" fill="#c0392b"/>
        <circle cx="20" cy="16" r="0.4" fill="#c0392b"/>
      </g>
    </g>
    <ellipse cx="15" cy="19" rx="0.7" ry="1.3" fill="#5b9de9" opacity="0.8">
      <animate attributeName="cy" values="19;22;19" dur="1.6s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="17.5" cy="19.5" rx="0.7" ry="1.3" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cy" values="19.5;22.5;19.5" dur="2s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M13.5 22 Q16 20 18.5 22" stroke="#5a4a3a" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <g opacity="0.6">
      <path d="M7 9 L8.5 10 L7.5 10.5 L9 11.5" stroke="#e74c3c" stroke-width="0.7" fill="none" stroke-linecap="round"/>
    </g>
  `,

  // Sedih + Takut → miris (anxious despair)
  sad_scared: `
    <!-- Miris: alis terangkat + miring sedih, mata berkaca, mulut zigzag bergetar -->
    <path d="M10 11 Q12 9.5 14 10.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 10.5 Q20 9.5 22 11" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.5" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.5" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="0.8" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="14.8" cy="19" rx="0.6" ry="1" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="19;21;19" dur="1.5s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="7" cy="14" rx="0.5" ry="1" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cy" values="14;17;14" dur="1.3s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M13 22 L14.5 21 L16 22 L17.5 21 L19 22" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none">
      <animate attributeName="d" values="M13 22 L14.5 21 L16 22 L17.5 21 L19 22;M13 21.8 L14.5 21.2 L16 21.8 L17.5 21.2 L19 21.8;M13 22 L14.5 21 L16 22 L17.5 21 L19 22" dur="0.5s" repeatCount="indefinite"/>
    </path>
  `,

  // Sedih + Jijik → menderita
  sad_disgusted: `
    <!-- Jijik nangis: alis satu naik satu miring sedih, mata datar + air mata, mulut jijik -->
    <path d="M10 12 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 12.5 Q20 11.5 22 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="2.8" ry="2.8" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="0.9" fill="#1a1a2e"/>
        <circle cx="20" cy="16.2" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <circle cx="9" cy="18" r="1.5" fill="#b8e994" opacity="0.5"/>
    <ellipse cx="15" cy="19" rx="0.7" ry="1.2" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="19;21.5;19" dur="1.8s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M13.5 21.5 Q15 23 17 21 Q18 22 19 21.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
  `,

  // Takut + Terkejut → horror
  scared_surprised: `
    <!-- Horror: alis sangat melengkung tinggi, mata super besar, mulut O lebar + keringat -->
    <path d="M9 8.5 Q12 6 15 8.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M17 8.5 Q20 6 23 8.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="3.5" ry="4" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <ellipse cx="20" cy="15.5" rx="3.5" ry="4" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="0.8" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="16" cy="23" rx="2.5" ry="2.2" fill="#1a1a2e"/>
    <ellipse cx="7" cy="13" rx="0.7" ry="1.5" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="13;18;13" dur="1.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.7;0;0.7" dur="1.2s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="25" cy="14" rx="0.7" ry="1.5" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cy" values="14;19;14" dur="1.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.4s" repeatCount="indefinite"/>
    </ellipse>
  `,

  // Takut + Marah → takut tapi berani
  scared_angry: `
    <!-- Fight-or-flight: alis V tapi bergetar, mata besar tajam, mulut bergetar, keringat -->
    <path d="M10 12 Q12 10.5 14 11" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none">
      <animate attributeName="d" values="M10 12 Q12 10.5 14 11;M10 11.5 Q12 10.5 14 11;M10 12 Q12 10.5 14 11" dur="0.3s" repeatCount="indefinite"/>
    </path>
    <path d="M18 11 Q20 10.5 22 12" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none">
      <animate attributeName="d" values="M18 11 Q20 10.5 22 12;M18 11 Q20 10.5 22 11.5;M18 11 Q20 10.5 22 12" dur="0.3s" repeatCount="indefinite"/>
    </path>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.3" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1.3" fill="#1a1a2e"/>
        <circle cx="12" cy="15.5" r="0.4" fill="#c0392b"/>
        <circle cx="20" cy="15.5" r="0.4" fill="#c0392b"/>
      </g>
    </g>
    <ellipse cx="7" cy="12" rx="0.5" ry="1" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="12;16;12" dur="1s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M13.5 22 Q16 20.5 18.5 22" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none">
      <animate attributeName="d" values="M13.5 22 Q16 20.5 18.5 22;M13.5 21.8 Q16 20.8 18.5 21.8;M13.5 22 Q16 20.5 18.5 22" dur="0.4s" repeatCount="indefinite"/>
    </path>
  `,

  // Takut + Jijik → ngeri (creeped out)
  scared_disgusted: `
    <!-- Ngeri: alis asimetris, satu mata besar satu menyipit, mulut mengerut, keringat -->
    <path d="M10 10 Q12 8.5 14 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 12.5 Q20 11.5 22 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="0.8" fill="#1a1a2e"/>
        <circle cx="20" cy="16.2" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <circle cx="22.5" cy="18" r="1.5" fill="#b8e994" opacity="0.5"/>
    <ellipse cx="7" cy="14" rx="0.5" ry="1.2" fill="#5b9de9" opacity="0.6">
      <animate attributeName="cy" values="14;17;14" dur="1.3s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M14 22 Q15 21 16 22 Q17 21 18 22" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
  `,

  // Marah + Terkejut → murka kaget
  angry_surprised: `
    <!-- Murka kaget: alis V tajam, mata melotot, mulut terbuka lebar -->
    <path d="M10 12 Q12 10 14 11" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 11 Q20 10 22 12" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="12" cy="15.5" r="0.5" fill="#c0392b"/>
        <circle cx="20" cy="15.5" r="0.5" fill="#c0392b"/>
      </g>
    </g>
    <g opacity="0.8">
      <path d="M7 8 L8.5 9 L7.5 9.5 L9 10.5" stroke="#e74c3c" stroke-width="0.9" fill="none" stroke-linecap="round"/>
      <path d="M25 8 L23.5 9 L24.5 9.5 L23 10.5" stroke="#e74c3c" stroke-width="0.9" fill="none" stroke-linecap="round"/>
    </g>
    <ellipse cx="16" cy="22.5" rx="2.2" ry="2" fill="#1a1a2e"/>
  `,

  // Marah + Jijik → benci (hatred)
  angry_disgusted: `
    <!-- Benci: alis V tajam, mata menyipit sinis, mulut berkerut jijik + vein -->
    <path d="M10 12.5 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10.5 22 12.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="12" cy="16" r="0.4" fill="#c0392b"/>
        <circle cx="20" cy="16" r="0.4" fill="#c0392b"/>
      </g>
    </g>
    <g opacity="0.8">
      <path d="M7 9 L8.5 10 L7.5 10.5 L9 11.5" stroke="#e74c3c" stroke-width="0.9" fill="none" stroke-linecap="round"/>
    </g>
    <circle cx="9" cy="18" r="1.5" fill="#b8e994" opacity="0.5"/>
    <path d="M13 21 Q14.5 22.5 16 20.5 Q17.5 22.5 19 21" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  `,

  // Jijik + Terkejut → shocked disgust
  disgusted_surprised: `
    <!-- Kaget jijik: alis satu naik satu turun, mata satu besar satu sipit, mulut lebar jijik -->
    <path d="M10 10 Q12 8 14 10" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M18 12.5 Q20 11 22 12.5" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.3" fill="#1a1a2e"/>
        <circle cx="20" cy="16.2" r="0.8" fill="#1a1a2e"/>
      </g>
    </g>
    <circle cx="22" cy="18" r="1.5" fill="#b8e994" opacity="0.5"/>
    <ellipse cx="16" cy="22" rx="2" ry="1.8" fill="#1a1a2e"/>
    <path d="M15 22 Q16 21 17 22" fill="#b8e994" opacity="0.4"/>
  `,

  // Marah + Sedih → marah terpukul
  angry_sad: `
    <!-- Marah terpukul: alis V tapi bergetar sedih, mata basah + tajam, mulut cemberut -->
    <path d="M10 12 Q12 10.5 14 11.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 11.5 Q20 10.5 22 12" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="16" rx="2.8" ry="3" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1.1" fill="#1a1a2e"/>
        <circle cx="20" cy="16.5" r="1.1" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="14.8" cy="19" rx="0.6" ry="1.2" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="19;21.5;19" dur="1.6s" repeatCount="indefinite"/>
    </ellipse>
    <g opacity="0.5">
      <path d="M7 9 L8.5 10 L7.5 10.5 L9 11.5" stroke="#e74c3c" stroke-width="0.7" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M13.5 22.5 Q16 20 18.5 22.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
  `,

  // Marah + Penghinaan → sinis (contempt)
  cynical: `
    <!-- Sinis: satu alis naik, satu mata menyipit tajam, senyum miring sinis -->
    <path d="M10 12 Q12 11 14 12" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
    <path d="M18 11 Q20 10 22 11" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="2.3" ry="2.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15" rx="2.8" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16.5" r="1" fill="#1a1a2e"/>
        <circle cx="20" cy="15.5" r="1.2" fill="#1a1a2e"/>
        <circle cx="20" cy="15" r="0.4" fill="#c0392b" opacity="0.6"/>
      </g>
    </g>
    <path d="M14 21 L18.5 20" stroke="#5a4a3a" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  `,

  // Terkejut + Bahagia → shocked happy
  surprised_happy: `
    <!-- Kaget senang: alis tinggi, mata bersinar besar, mulut senyum lebar O -->
    <path d="M9.5 9 Q12 7 14.5 9" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M17.5 9 Q20 7 22.5 9" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15.5" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <ellipse cx="20" cy="15.5" rx="3" ry="3.5" fill="#fff" stroke="#1a1a2e" stroke-width="0.5"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="15.5" r="1.5" fill="#1a1a2e"/>
        <circle cx="20" cy="15.5" r="1.5" fill="#1a1a2e"/>
        <circle cx="12.5" cy="14.8" r="0.6" fill="#fff" opacity="0.9"/>
        <circle cx="20.5" cy="14.8" r="0.6" fill="#fff" opacity="0.9"/>
      </g>
    </g>
    <circle cx="9" cy="18.5" r="2" fill="#ffb3ba" opacity="0.7"/>
    <circle cx="23" cy="18.5" r="2" fill="#ffb3ba" opacity="0.7"/>
    <path d="M13 20 Q16 24.5 19 20" fill="none" stroke="#5a4a3a" stroke-width="1.1" stroke-linecap="round"/>
  `,

  // Terkejut + Marah → tersentak marah
  surprised_angry: `
    <!-- Kaget marah: alis V + tinggi, mata melotot merah, mulut terbuka teriak -->
    <path d="M9.5 11.5 Q12 9.5 14 10.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M18 10.5 Q20 9.5 22.5 11.5" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="16" rx="3" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <ellipse cx="20" cy="16" rx="3" ry="3.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="1.5" fill="#1a1a2e"/>
        <circle cx="12" cy="15.5" r="0.6" fill="#c0392b"/>
        <circle cx="20" cy="15.5" r="0.6" fill="#c0392b"/>
      </g>
    </g>
    <g opacity="0.9">
      <path d="M6.5 8 L8 9 L7 9.5 L8.5 10.5" stroke="#e74c3c" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M25.5 8 L24 9 L25 9.5 L23.5 10.5" stroke="#e74c3c" stroke-width="1" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M13 20 Q16 25 19 20 Z" fill="#1a1a2e"/>
  `,

  // Terkejut + Takut → flinch
  surprised_scared: `
    <!-- Flinch: alis sangat tinggi mengerut, mata super besar, mulut zigzag bergetar, keringat banyak -->
    <path d="M9 8 Q12 5.5 15 8" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <path d="M17 8 Q20 5.5 23 8" stroke="#5a4a3a" stroke-width="1.0" stroke-linecap="round" fill="none"/>
    <g class="mascot-blink-group">
      <ellipse cx="12" cy="15" rx="3.5" ry="4.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <ellipse cx="20" cy="15" rx="3.5" ry="4.2" fill="#fff" stroke="#1a1a2e" stroke-width="0.6"/>
      <g class="mascot-pupils">
        <circle cx="12" cy="16" r="0.7" fill="#1a1a2e"/>
        <circle cx="20" cy="16" r="0.7" fill="#1a1a2e"/>
      </g>
    </g>
    <ellipse cx="6.5" cy="12" rx="0.6" ry="1.5" fill="#5b9de9" opacity="0.8">
      <animate attributeName="cy" values="12;17;12" dur="1s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="25.5" cy="13" rx="0.6" ry="1.5" fill="#5b9de9" opacity="0.7">
      <animate attributeName="cy" values="13;18;13" dur="1.2s" repeatCount="indefinite"/>
    </ellipse>
    <path d="M12.5 22 L14 21 L15.5 22.5 L17 21 L18.5 22.5 L19.5 21.5" stroke="#5a4a3a" stroke-width="0.8" stroke-linecap="round" fill="none">
      <animate attributeName="d" values="M12.5 22 L14 21 L15.5 22.5 L17 21 L18.5 22.5 L19.5 21.5;M12.5 21.5 L14 21.5 L15.5 22 L17 21.5 L18.5 22 L19.5 21.5;M12.5 22 L14 21 L15.5 22.5 L17 21 L18.5 22.5 L19.5 21.5" dur="0.4s" repeatCount="indefinite"/>
    </path>
  `,

};

// --- Quotes Dictionary ---
const MASCOT_QUOTES = {
  surplus: [
    { face: 'happy_surprised', text: 'ASTAGA! Kas menggila, Boss!!' },
    { face: 'laugh', text: 'Kas makin tebal, Boss!' },
    { face: 'happy', text: 'Asik, uang masuk terus!' },
    { face: 'laugh', text: 'Hahaha! Moni-moni makin jaya!' },
    { face: 'surprised_happy', text: 'WOW! Gak nyangka! Surplus besar!' },
    { face: 'happy', text: 'Beli cilok ah pakai duit sisa!' },
    { face: 'neutral', text: 'Laporan kas aman terkendali!' },
    { face: 'laugh', text: 'Wuhuu! Cuann terooss~' },
    { face: 'happy', text: 'Mantap jiwa, surplus terus!' },
    { face: 'laugh', text: 'Dompet senyum lebar, Boss!' },
    { face: 'happy_surprised', text: 'Tajir melintir Boss!! WOW!!' },
  ],
  deficit: [
    { face: 'sad_surprised', text: 'HAH?! K-kok minus...!?' },
    { face: 'sad', text: 'Waduh, tekor kita Boss...' },
    { face: 'angry', text: 'Bocor! Pengeluaran ngeri amat!' },
    { face: 'sad_scared', text: 'A-aku takut cek saldo....' },
    { face: 'sad_angry', text: 'Nangis aku tapi KESAL!' },
    { face: 'angry_surprised', text: 'APA?! Siapa belanja segini?!' },
    { face: 'sad', text: 'Puasa dulu ya kita bulan ini...' },
    { face: 'angry', text: 'HEH! Tolong rem belanjanya!' },
    { face: 'angry_disgusted', text: 'Ihh jijik lihat angka minus!' },
    { face: 'sad', text: 'Minus terus nih... sedih.' },
    { face: 'angry_sad', text: 'KESEL tapi sedih juga...' },
    { face: 'scared', text: 'G-gawat... kasnya menipis!' },
    { face: 'sad_disgusted', text: 'Mual aku lihat defisit ini...' },
    { face: 'angry', text: 'Siapa yang belanja lagi?!' },
    { face: 'sad', text: 'Makan mie instan aja deh...' },
  ],
  zero: [
    { face: 'happy', text: 'Halooo~ Aku Moni-Moni! Penjaga harta kerajaanmu~' },
    { face: 'neutral', text: 'Hai Boss! Sini-sini, biar aku pantau kasnya!' },
    { face: 'surprised', text: 'OH! Belum ada transaksi?! Ayo mulai!' },
    { face: 'happy', text: 'Moni-Moni siap jaga kas Boss hari ini!' },
    { face: 'neutral', text: 'Belum ada transaksi nih~ Ayo Boss semangat!' },
    { face: 'laugh', text: 'Hehe~ Aku Moni-Moni, si mahkota paling kece!' },
    { face: 'cynical', text: 'Hmm... kasnya masih nol ya Boss...' },
    { face: 'happy', text: 'Hari baru, rejeki baru! Semangat Boss!' },
    { face: 'surprised_happy', text: 'Boss datang! Yay~ Aku kangen!' },
  ]
};

// --- Poke reactions (separate from financial mood) ---
const POKE_REACTIONS = [
  { face: 'tickled', text: 'GYAHAHAHA! Stop Boss!!', sound: 'boing' },
  { face: 'tickled', text: 'ADUUUH! Geliiii!! Hahahaha', sound: 'boing' },
  { face: 'laugh', text: 'Ehehe~ sekali lagi dong!', sound: 'pop' },
  { face: 'tickled', text: 'WKWKWK! Ampuun Boss!!', sound: 'boing' },
  { face: 'angry', text: 'Ih kok di-poke! Sebell!', sound: 'error' },
  { face: 'happy', text: 'Hehe~ kena deh!', sound: 'pop' },
  { face: 'surprised', text: 'HUWAA! Kaget!!', sound: 'boing' },
  { face: 'angry_surprised', text: 'HAH?! APA-APAAN?!', sound: 'error' },
  { face: 'scared', text: 'H-hiii! Jangan tiba-tiba!', sound: 'boing' },
  { face: 'tickled', text: 'ASTAGA GELINYA PARAH!!', sound: 'boing' },
  { face: 'surprised_happy', text: 'OH! Hai Boss~ hehe!', sound: 'pop' },
  { face: 'laugh', text: 'Awas ya Boss, tak balas!', sound: 'pop' },
  { face: 'angry', text: 'JANGAN SENTUH MAHKOTAKU!', sound: 'error' },
  { face: 'cynical', text: 'Hmm... iseng ya, Boss?', sound: 'pop' },
  { face: 'scared_surprised', text: 'ASTAGA!! JANTUNGKU!!', sound: 'boing' },
  { face: 'disgusted', text: 'Iiih... tangan Boss bau!', sound: 'error' },
  { face: 'happy_disgusted', text: 'Ehh... geli tapi lucu~', sound: 'pop' },
  { face: 'tickled', text: 'TOLOONG! WKWKWK!', sound: 'boing' },
  { face: 'happy', text: 'Boss lagi gabut ya?', sound: 'pop' },
  { face: 'surprised_scared', text: 'UWAAA!! AMPUN BOSS!!', sound: 'boing' },
  { face: 'laugh', text: 'Hihihi~ sini aku gigit!', sound: 'boing' },
];

let mascotInterval = null;
let mascotBlinkTimeout = null;
let lastPokeIdx = -1;

// --- Blink engine (independent of face changes) ---
const triggerBlink = () => {
  const blinkGroups = document.querySelectorAll('#interactiveMascotFace .mascot-blink-group');
  blinkGroups.forEach(g => {
    g.style.transition = 'transform 0.08s';
    g.style.transformOrigin = 'center 16px';
    g.style.transform = 'scaleY(0.08)';
    setTimeout(() => {
      g.style.transform = 'scaleY(1)';
      // Double blink 30% of the time
      if (Math.random() < 0.3) {
        setTimeout(() => {
          g.style.transform = 'scaleY(0.08)';
          setTimeout(() => { g.style.transform = 'scaleY(1)'; }, 80);
        }, 180);
      }
    }, 100);
  });
};

const startBlinking = () => {
  if (mascotBlinkTimeout) clearTimeout(mascotBlinkTimeout);
  const scheduleBlink = () => {
    const delay = 2000 + Math.random() * 2000;
    mascotBlinkTimeout = setTimeout(() => {
      triggerBlink();
      scheduleBlink();
    }, delay);
  };
  scheduleBlink();
};

// --- Pupil follow mouse ---
const initPupilTracking = () => {
  document.addEventListener('mousemove', (e) => {
    const svg = document.getElementById('interactiveMascotSvg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    const maxShift = 1.5;
    const shiftX = Math.max(-maxShift, Math.min(maxShift, dx * maxShift));
    const shiftY = Math.max(-maxShift, Math.min(maxShift, dy * 1));
    
    const pupils = document.querySelectorAll('#interactiveMascotFace .mascot-pupils');
    pupils.forEach(p => {
      p.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
      p.style.transition = 'transform 0.15s ease-out';
    });
  });
};

// --- Main mascot update loop ---
const startInteractiveMascot = () => {
  if (mascotInterval) clearInterval(mascotInterval);
  
  const updateMascot = () => {
    const totalIn = state.transactions.filter(t => t.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = state.transactions.filter(t => t.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const netFlow = totalIn - totalOut;

    let condition = 'zero';
    if (netFlow > 0) condition = 'surplus';
    else if (netFlow < 0) condition = 'deficit';

    const quotes = MASCOT_QUOTES[condition];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    
    const faceEl = $('interactiveMascotFace');
    const textEl = $('interactiveMascotText');
    
    if (faceEl && textEl) {
      faceEl.innerHTML = MASCOT_FACES[randomQuote.face];
      
      textEl.style.transition = 'opacity 0.25s, transform 0.25s';
      textEl.style.opacity = '0';
      textEl.style.transform = 'translateY(4px)';
      
      setTimeout(() => {
        textEl.textContent = randomQuote.text;
        textEl.style.opacity = '1';
        textEl.style.transform = 'translateY(0)';
      }, 250);
    }
  };

  updateMascot();
  mascotInterval = setInterval(updateMascot, 6000);
};

// --- Poke / Tickle handler ---
window.pokeMascot = () => {
  const faceEl = $('interactiveMascotFace');
  const textEl = $('interactiveMascotText');
  const svgEl = document.getElementById('interactiveMascotSvg');
  if (!faceEl || !textEl) return;

  // Pick a random poke reaction (avoid repeating last one)
  let idx;
  do { idx = Math.floor(Math.random() * POKE_REACTIONS.length); } while (idx === lastPokeIdx && POKE_REACTIONS.length > 1);
  lastPokeIdx = idx;
  const reaction = POKE_REACTIONS[idx];

  // Play reaction sound
  if (typeof playSound === 'function') playSound(reaction.sound);

  // Quick squish animation on the SVG
  if (svgEl) {
    svgEl.style.transition = 'transform 0.1s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    svgEl.style.transform = 'scale(0.8) rotate(-10deg)';
    setTimeout(() => {
      svgEl.style.transform = 'scale(1.15) rotate(5deg)';
      setTimeout(() => {
        svgEl.style.transition = 'transform 0.3s ease';
        svgEl.style.transform = '';
      }, 150);
    }, 120);
  }

  // Change face
  faceEl.innerHTML = MASCOT_FACES[reaction.face];

  // Animate text swap (fast pop)
  textEl.style.transition = 'opacity 0.08s, transform 0.15s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
  textEl.style.opacity = '0';
  textEl.style.transform = 'translateY(-3px) scale(0.95)';
  setTimeout(() => {
    textEl.textContent = reaction.text;
    textEl.style.opacity = '1';
    textEl.style.transform = 'translateY(0) scale(1)';
  }, 80);

  // Resume normal cycle after 2.5 seconds
  if (mascotInterval) clearInterval(mascotInterval);
  setTimeout(() => {
    startInteractiveMascot();
  }, 2500);
};

// --- Bootstrap ---
const originalInit = typeof init === 'function' ? init : () => {};
window.init = async () => {
  await originalInit();
  startInteractiveMascot();
  startBlinking();
  initPupilTracking();
};
if (typeof init === 'function') {
  init();
}

/* ============================================
   NERACA KERAJAAN LUDO — AI MASCOT (Vanilla JS)
   ============================================ */

class AiMascotService {
  constructor() {
    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.geminiModel = 'gemini-1.5-flash';
    this.groqBaseURL = 'https://api.groq.com/openai/v1/chat/completions';
    this.groqModel = 'llama3-8b-8192';
  }

  getApiKey(type) {
    return sessionStorage.getItem(type + '_api_key') || '';
  }

  async getGeminiResponse(prompt) {
    const key = this.getApiKey('gemini');
    if (!key) throw new Error("Gemini API Key hilang.");
    
    // Konteks ringkas untuk Mascot
    const systemPrompt = `Kamu adalah Moni-moni, maskot keuangan virtual berwujud mahkota emas kecil. 
Jawablah pertanyaan user mengenai uang/keuangan/kas dengan gaya bahasa santai, lucu, layaknya "Bos" dan ajudan. Hindari format markdown yang rumit.
Berikan respon maksimal 2 atau 3 kalimat singkat yang asik.
Pertanyaan User: ${prompt}`;

    const url = `${this.geminiBaseURL}/models/${this.geminiModel}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!response.ok) throw new Error(`Gemini Error: ${response.status}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async getGroqResponse(prompt) {
    const key = this.getApiKey('groq');
    if (!key) throw new Error("Groq API Key hilang.");

    const systemPrompt = `Kamu adalah Moni-moni, maskot keuangan virtual bergaya bos namun lucu. Jawab seputar uang, jujur tapi asik. Maksimal 2 kalimat singkat.\\nUser: ${prompt}`;

    const response = await fetch(this.groqBaseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Groq Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  getOfflineRulesResponse(prompt) {
    console.info("Maskot Mode: Offline Safety Net Aktif");
    const p = prompt.toLowerCase();
    
    if (p.includes('uang') || p.includes('saldo') || p.includes('kaya')) {
      return "Sistem AI ku sedang mati. Tapi ingat, kalau mau kaya, pengeluaran harus lebih kecil dari pemasukan!";
    }
    if (p.includes('halo') || p.includes('hai')) {
      return "Hai Bos! Meskipun otak awanku sedang offline, aku tetap setia mencatat kasmu!";
    }
    
    return "Hm... pengaturan AI di pojok kanan atas belum kamu isi ya? Otakku terbatas nih kalau offline.";
  }

  async askMascot(prompt) {
    const hasGemini = !!this.getApiKey('gemini');
    const hasGroq = !!this.getApiKey('groq');

    if (!hasGemini && !hasGroq) {
      return this.getOfflineRulesResponse(prompt);
    }

    try {
      if (hasGemini) {
        console.log("[Cascade] Mencoba Primary API: Gemini Flash...");
        return await this.getGeminiResponse(prompt);
      } else {
        throw new Error("Skip Gemini");
      }
    } catch (geminiError) {
      console.warn("Primary API Gagal / Kosong:", geminiError.message);
      try {
        if (hasGroq) {
          console.log("[Cascade] Beralih ke Fallback API: Groq...");
          return await this.getGroqResponse(prompt);
        } else {
          throw new Error("Skip Groq");
        }
      } catch (groqError) {
        console.error("Fallback API Gagal / Kosong:", groqError.message);
        return this.getOfflineRulesResponse(prompt);
      }
    }
  }
}

const aiMascot = new AiMascotService();

// --- UI Handlers for AI ---

window.saveAiSettings = () => {
    const gem = document.getElementById('geminiApiKey').value.trim();
    const grq = document.getElementById('groqApiKey').value.trim();
    
    if (gem) sessionStorage.setItem('gemini_api_key', gem);
    else sessionStorage.removeItem('gemini_api_key');
    
    if (grq) sessionStorage.setItem('groq_api_key', grq);
    else sessionStorage.removeItem('groq_api_key');
    
    if (typeof closeModal === 'function') closeModal('aiSettingsModal');
    
    if (gem || grq) {
        if (typeof showToast === 'function') showToast('Otak AI Mascot berhasil diaktifkan!', 'success');
        setMascotSpeech("Wah, pemikiranku jadi cepat sekali sekarang! Ada yang mau ditanyakan?", false, 'interactiveMascotText');
    } else {
        if (typeof showToast === 'function') showToast('API Key dikosongkan. Maskot berjalan di Mode Offline.', 'warning');
    }
};

window.sendChatMascot = async () => {
    const input = document.getElementById('mascotChatInput');
    const textEl = document.getElementById('interactiveMascotText');
    const svgEl = document.getElementById('interactiveMascotSvg');
    
    if (!input || !textEl) return;
    const prompt = input.value.trim();
    if (!prompt) return;
    
    // Clear input
    input.value = '';
    
    // Stop normal interval while chatting
    if (typeof mascotInterval !== 'undefined' && mascotInterval) {
        clearInterval(mascotInterval);
    }
    
    // Set loading state
    setMascotSpeech("Sedang mikir keras...", true, 'interactiveMascotText');
    textEl.style.opacity = '0.5';
    
    try {
        const answer = await aiMascot.askMascot(prompt);
        textEl.style.opacity = '1';
        setMascotSpeech(answer, false, 'interactiveMascotText');
        
        // Quick bounce
        if (svgEl) {
            svgEl.style.transition = 'transform 0.2s';
            svgEl.style.transform = 'translateY(-10px)';
            setTimeout(() => { svgEl.style.transform = 'translateY(0)'; }, 200);
        }
        
    } catch (e) {
        textEl.style.opacity = '1';
        setMascotSpeech("Aduh, koneksiku terputus!", false, 'interactiveMascotText');
    } finally {
        // Resume normal interval after 15 seconds
        setTimeout(() => {
            if (typeof startInteractiveMascot === 'function') {
                startInteractiveMascot();
            }
        }, 15000);
    }
};

// Prepopulate inputs if session exists
document.addEventListener('DOMContentLoaded', () => {
    const gKey = sessionStorage.getItem('gemini_api_key');
    const qKey = sessionStorage.getItem('groq_api_key');
    if (gKey && document.getElementById('geminiApiKey')) document.getElementById('geminiApiKey').value = gKey;
    if (qKey && document.getElementById('groqApiKey')) document.getElementById('groqApiKey').value = qKey;
});
