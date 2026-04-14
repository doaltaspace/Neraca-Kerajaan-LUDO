/**
 * =====================================================
 * 🏰 apiConfig.js — Konfigurasi Terpusat API Cascade
 * =====================================================
 * 
 * File ini membaca semua environment variable dari .env
 * dan menyediakan satu sumber kebenaran (single source of truth)
 * untuk seluruh sistem AI Mascot.
 * 
 * Cara kerja di Vite:
 *   - Semua env var HARUS diawali prefix VITE_
 *   - Diakses via import.meta.env.VITE_NAMA_VARIABEL
 *   - Vite mengganti value saat build time (string replacement)
 *   - Nilai yang tidak diawali VITE_ TIDAK akan terekspos ke client
 */

// ====================================================
// 1. KONFIGURASI UTAMA
// ====================================================
export const apiConfig = {
  // — Primary AI: Google Gemini Flash —
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash',
  },

  // — Fallback AI: Groq Llama —
  groq: {
    apiKey: import.meta.env.VITE_GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1/chat/completions',
    model: import.meta.env.VITE_GROQ_MODEL || 'llama3-8b-8192',
  },

  // — Sistem Cascade —
  settings: {
    maxRetries: parseInt(import.meta.env.VITE_MAX_RETRIES || '3', 10),
    isFallbackEnabled: import.meta.env.VITE_AI_FALLBACK_ENABLED !== 'false',
    timeoutMs: parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '10000', 10),
    rateLimitPerMinute: parseInt(import.meta.env.VITE_RATE_LIMIT_PER_MINUTE || '12', 10),
  },

  // — Maskot —
  mascot: {
    maxResponseLength: parseInt(import.meta.env.VITE_MASCOT_MAX_RESPONSE_LENGTH || '300', 10),
    isEmotionEnabled: import.meta.env.VITE_MASCOT_EMOTION_ENABLED !== 'false',
  },

  // — Aplikasi —
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Neraca Kerajaan LUDO',
    version: import.meta.env.VITE_APP_VERSION || '0.0.0',
    env: import.meta.env.VITE_APP_ENV || 'development',
    isDev: import.meta.env.DEV,       // Bawaan Vite: true saat `npm run dev`
    isProd: import.meta.env.PROD,      // Bawaan Vite: true saat `npm run build`
  },
};


// ====================================================
// 2. HELPER: Cek apakah API Key terisi dan valid format
// ====================================================

/**
 * Cek apakah sebuah API key terlihat valid (bukan placeholder).
 * Tidak pernah mencetak isi key ke console demi keamanan.
 */
const isKeyValid = (key) => {
  if (!key || key.trim() === '') return false;

  // Deteksi placeholder yang lupa diganti
  const placeholders = [
    'masukkan_api_key',
    'your_api_key',
    'xxx',
    'paste_key_here',
    'INSERT_KEY',
  ];
  return !placeholders.some((ph) => key.toLowerCase().includes(ph));
};


// ====================================================
// 3. VALIDASI SAAT APP LOAD
// ====================================================

/**
 * validateApiKeys()
 * 
 * Dipanggil SATU KALI saat aplikasi pertama kali di-mount
 * (misalnya di App.jsx atau main.jsx).
 * 
 * Return:
 *   { isOnline: boolean, status: object }
 *   - isOnline: true jika minimal 1 API key aktif
 *   - status: detail per-provider untuk debugging
 */
export const validateApiKeys = () => {
  const status = {
    gemini: false,
    groq: false,
  };

  console.group('🏰 Neraca Kerajaan LUDO — Validasi Environment');

  // ---- Gemini ----
  if (isKeyValid(apiConfig.gemini.apiKey)) {
    status.gemini = true;
    console.log('✅ Gemini API Key  : Terdeteksi & valid');
    console.log(`   Model           : ${apiConfig.gemini.model}`);
  } else {
    console.warn('⚠️ VITE_GEMINI_API_KEY tidak tersedia atau masih placeholder!');
    console.warn('   → Primary AI (Gemini) akan dinonaktifkan.');
  }

  // ---- Groq ----
  if (isKeyValid(apiConfig.groq.apiKey)) {
    status.groq = true;
    console.log('✅ Groq API Key    : Terdeteksi & valid');
    console.log(`   Model           : ${apiConfig.groq.model}`);
  } else {
    console.warn('⚠️ VITE_GROQ_API_KEY tidak tersedia atau masih placeholder!');
    console.warn('   → Fallback AI (Groq) akan dinonaktifkan.');
  }

  // ---- Settings Summary ----
  console.log('——————————————————————————————');
  console.log(`🔁 Fallback Enabled : ${apiConfig.settings.isFallbackEnabled}`);
  console.log(`🔄 Max Retries      : ${apiConfig.settings.maxRetries}`);
  console.log(`⏱️  Timeout          : ${apiConfig.settings.timeoutMs}ms`);
  console.log(`🚦 Rate Limit       : ${apiConfig.settings.rateLimitPerMinute}/menit`);
  console.log(`😃 Emosi Maskot     : ${apiConfig.mascot.isEmotionEnabled ? 'Aktif' : 'Nonaktif'}`);
  console.log(`🌍 Environment      : ${apiConfig.app.env}`);

  // ---- Kesimpulan ----
  const isOnline = status.gemini || status.groq;

  if (!isOnline) {
    console.error(
      '🚨 KRITIS: Semua API key AI tidak tersedia!\n' +
      '   → Maskot akan berjalan permanen di Rule-based Offline Mode.\n' +
      '   → Isi VITE_GEMINI_API_KEY atau VITE_GROQ_API_KEY di file .env'
    );
  } else {
    console.log(
      `🟢 Maskot AI Online — Cascade: ${status.gemini ? 'Gemini' : '—'} → ${status.groq ? 'Groq' : '—'} → Offline Rules`
    );
  }

  console.groupEnd();

  return { isOnline, status };
};
