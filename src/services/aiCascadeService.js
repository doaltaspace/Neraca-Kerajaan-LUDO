/**
 * =====================================================
 * 🤖 aiCascadeService.js — Multi-API Cascade Engine
 * =====================================================
 * 
 * Sistem Cascade 3 Lapis:
 *   1️⃣ Primary   → Gemini Flash (Google)
 *   2️⃣ Fallback  → Groq Llama
 *   3️⃣ Safety Net → Rule-based Offline
 * 
 * Fitur:
 *   - Auto-fallback saat API gagal atau timeout
 *   - Rate limiting sederhana (per menit)
 *   - Timeout per request (AbortController)
 *   - Retry dengan exponential backoff
 *   - Placeholder key detection via apiConfig
 */

import { apiConfig, validateApiKeys } from '../config/apiConfig';

class AiMascotService {
  constructor() {
    // Validasi satu kali saat inisialisasi dan simpan hasilnya
    const validation = validateApiKeys();
    this.isOnline = validation.isOnline;
    this.apiStatus = validation.status;

    // Rate limiter state
    this._requestTimestamps = [];
  }

  // =================================================
  // RATE LIMITER
  // =================================================

  /**
   * Cek apakah masih boleh kirim request berdasarkan rate limit
   */
  _checkRateLimit() {
    const now = Date.now();
    const windowMs = 60_000; // 1 menit
    const limit = apiConfig.settings.rateLimitPerMinute;

    // Buang timestamp yang sudah di luar jendela 1 menit
    this._requestTimestamps = this._requestTimestamps.filter(
      (ts) => now - ts < windowMs
    );

    if (this._requestTimestamps.length >= limit) {
      const oldestInWindow = this._requestTimestamps[0];
      const waitSec = Math.ceil((windowMs - (now - oldestInWindow)) / 1000);
      throw new Error(
        `Rate limit tercapai (${limit}/menit). Coba lagi dalam ${waitSec} detik.`
      );
    }

    this._requestTimestamps.push(now);
  }

  // =================================================
  // FETCH DENGAN TIMEOUT
  // =================================================

  /**
   * Wrapper fetch() dengan AbortController timeout
   */
  async _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      apiConfig.settings.timeoutMs
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout setelah ${apiConfig.settings.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // =================================================
  // GEMINI FLASH (PRIMARY)
  // =================================================

  async getGeminiResponse(prompt) {
    if (!this.apiStatus.gemini) {
      throw new Error('Gemini API Key tidak dikonfigurasi atau masih placeholder.');
    }

    const url = `${apiConfig.gemini.baseURL}/models/${apiConfig.gemini.model}:generateContent?key=${apiConfig.gemini.apiKey}`;

    const response = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: apiConfig.mascot.maxResponseLength,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Gemini HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();

    // Validasi respons terstruktur
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Gemini: Respons tidak mengandung teks yang valid');
    }

    return data.candidates[0].content.parts[0].text;
  }

  // =================================================
  // GROQ LLAMA (FALLBACK)
  // =================================================

  async getGroqResponse(prompt) {
    if (!this.apiStatus.groq) {
      throw new Error('Groq API Key tidak dikonfigurasi atau masih placeholder.');
    }

    const response = await this._fetchWithTimeout(apiConfig.groq.baseURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiConfig.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: apiConfig.groq.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: apiConfig.mascot.maxResponseLength,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Groq HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('Groq: Respons tidak mengandung teks yang valid');
    }

    return data.choices[0].message.content;
  }

  // =================================================
  // OFFLINE SAFETY NET (RULE-BASED)
  // =================================================

  getOfflineRulesResponse(prompt) {
    console.info('🛡️ Maskot Mode: Offline Safety Net Aktif');
    const p = prompt.toLowerCase();

    if (p.includes('uang') || p.includes('saldo') || p.includes('keuangan') || p.includes('tabung')) {
      return 'Sistem otak AI ku sedang bermasalah 😵‍💫. Tapi ingat, apa pun yang terjadi tetaplah perhatikan arus kasmu ya Bos!';
    }
    if (p.includes('halo') || p.includes('hai') || p.includes('hey')) {
      return 'Hai Bos! Meskipun awan internet gelap gulita, aku masih setia di sini menemani pembukuanmu! 👑';
    }
    if (p.includes('tips') || p.includes('saran') || p.includes('nasihat')) {
      return 'Tips dari ku: catat semua pengeluaran, sekecil apa pun. Seringkali bocornya uang itu dari hal-hal kecil! 💡';
    }
    if (p.includes('hutang') || p.includes('pinjam') || p.includes('cicil')) {
      return 'Soal hutang, prioritaskan yang bunganya paling tinggi dulu ya Bos. Jangan sampai bunga makan bulanan! ⚔️';
    }

    return 'Maaf, kepalaku agak pusing karena koneksi awan terputus 🌧️. Coba tanya hal-hal sederhana tentang fitur saja dulu ya.';
  }

  // =================================================
  // RETRY DENGAN EXPONENTIAL BACKOFF
  // =================================================

  async _retryWithBackoff(fn, retries = apiConfig.settings.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isLast = attempt === retries;
        if (isLast) throw err;

        const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000); // 1s, 2s, 4s, max 8s
        console.warn(
          `🔄 Retry ${attempt}/${retries} gagal: ${err.message}. Tunggu ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // =================================================
  // FUNGSI UTAMA — DIPANGGIL OLEH COMPONENT UI
  // =================================================

  /**
   * askMascot(prompt)
   * 
   * Entry point tunggal untuk semua interaksi dengan maskot AI.
   * Menjalankan cascade: Gemini → Groq → Offline Rules
   * 
   * @param {string} prompt - Pertanyaan atau perintah dari user
   * @returns {Promise<string>} Respons dari maskot
   */
  async askMascot(prompt) {
    // 1. Cek Offline Mode → langsung ke rules jika semua API mati
    if (!this.isOnline) {
      return this.getOfflineRulesResponse(prompt);
    }

    // 2. Cek Rate Limit
    try {
      this._checkRateLimit();
    } catch (rateLimitError) {
      console.warn(`🚦 ${rateLimitError.message}`);
      return `Wah, Bos terlalu semangat bertanya! 😅 ${rateLimitError.message}`;
    }

    // 3. Masukkan System Prompt
    const systemPrompt = `Kamu adalah Moni-moni, maskot keuangan virtual berwujud mahkota emas kecil. 
Jawablah pertanyaan user mengenai uang/keuangan/kas dengan gaya bahasa santai, lucu, layaknya "Bos" dan ajudan. Hindari format markdown yang rumit.
Berikan respon maksimal 2 atau 3 kalimat singkat yang asik.
Lalu ini adalah input dari User: ${prompt}`;

    // 4. CASCADE Tahap 1: Coba Primary API (Gemini Flash) dengan retry
    if (this.apiStatus.gemini) {
      try {
        console.log('⚡ [Cascade] Mencoba Primary API: Gemini Flash...');
        return await this._retryWithBackoff(() => this.getGeminiResponse(systemPrompt));
      } catch (geminiError) {
        console.warn('⚠️ Primary API Gagal final:', geminiError.message);
      }
    }

    // 5. CASCADE Tahap 2: Beralih ke Fallback (Groq) dengan retry
    if (apiConfig.settings.isFallbackEnabled && this.apiStatus.groq) {
      try {
        console.log('🔄 [Cascade] Beralih ke Fallback API: Groq...');
        return await this._retryWithBackoff(() => this.getGroqResponse(systemPrompt));
      } catch (groqError) {
        console.error('❌ Fallback API Gagal final:', groqError.message);
      }
    }

    // 5. CASCADE Tahap 3: Safety net terakhir (Offline Rules)
    return this.getOfflineRulesResponse(prompt);
  }
}

// Ekspor instance singleton
export const aiMascot = new AiMascotService();
