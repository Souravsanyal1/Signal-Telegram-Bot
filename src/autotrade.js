/**
 * autotrade.js — Puppeteer-FREE Direct API Auto Trader for Quotex
 *
 * কিভাবে কাজ করে:
 *  1. axios দিয়ে HTTP POST login (ব্রাউজার লাগে না)
 *  2. Session cookie সেভ করে রাখে
 *  3. Quotex Trading WebSocket-এ connect করে
 *  4. Signal আসলে সরাসরি WebSocket message পাঠিয়ে trade place করে
 */

const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '..', 'quotex_session.json');

class AutoTrader {
  constructor() {
    this.isReady = false;
    this.isLoggedIn = false;
    this.socket = null;
    this.cookies = '';
    this.sessionToken = '';
    this.tradeAmount = parseFloat(process.env.TRADE_AMOUNT) || 10;
    this.isDemo = process.env.TRADE_DEMO !== 'false'; // Default: Demo mode
    this.requestId = Math.floor(Math.random() * 1000000);
    this.jar = new CookieJar();
    this.client = null; // Will be initialized in init()
  }

  async initializeClient() {
    // Dynamically import ESM module
    const { wrapper } = await import('axios-cookiejar-support');
    this.client = wrapper(axios.create({
      jar: this.jar,
      withCredentials: true,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      }
    }));
  }

  async init() {
    // Initialize the HTTP client first
    await this.initializeClient();
    
    console.log('🤖 [AutoTrade] Initializing Direct API Auto Trader (No Browser)...');
    console.log(`💰 [AutoTrade] Trade Amount: $${this.tradeAmount} | Mode: ${this.isDemo ? 'DEMO' : 'REAL'}`);

    const email = process.env.QUOTEX_EMAIL;
    const password = process.env.QUOTEX_PASSWORD;

    if (!email || !password) {
      console.error('❌ [AutoTrade] QUOTEX_EMAIL and QUOTEX_PASSWORD must be set in .env!');
      return;
    }

    // Try to load saved session first
    if (this.loadSession()) {
      console.log('🔄 [AutoTrade] Found saved session. Connecting to trading WebSocket...');
      await this.connectTradingSocket();
      if (this.isLoggedIn) {
        console.log('✅ [AutoTrade] Resumed session successfully!');
        return;
      }
      console.log('⚠️ [AutoTrade] Saved session expired. Logging in fresh...');
    }

    // Fresh login via HTTP API
    const success = await this.login(email, password);
    if (success) {
      await this.connectTradingSocket();
    }
  }

  async login(email, password) {
    try {
      console.log('🔐 [AutoTrade] Logging in to Quotex via HTTP API...');

      // Step 1: Get CSRF token from sign-in page
      console.log('🌐 [AutoTrade] Fetching login page for CSRF token...');
      const pageRes = await this.client.get('https://qxbroker.com/en/sign-in', {
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });

      // Extract CSRF token from HTML
      const csrfMatch = pageRes.data.match(/name="_token"\s+value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      if (csrf) {
        console.log('✅ [AutoTrade] CSRF token obtained.');
      } else {
        console.warn('⚠️ [AutoTrade] CSRF token not found. Trying login without it...');
      }

      // Step 2: POST login credentials
      console.log('📨 [AutoTrade] Sending login credentials...');
      const loginRes = await this.client.post(
        'https://qxbroker.com/en/sign-in',
        new URLSearchParams({
          _token: csrf,
          email: email,
          password: password,
          remember: 'on'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://qxbroker.com/en/sign-in',
            'Origin': 'https://qxbroker.com',
          },
          maxRedirects: 5,
          validateStatus: (s) => s < 500,
        }
      );

      // Check if login succeeded by verifying redirect/URL or page content
      const finalUrl = loginRes.request?.res?.responseUrl || loginRes.config?.url || '';
      const responseBody = typeof loginRes.data === 'string' ? loginRes.data : '';

      const loginSuccess =
        finalUrl.includes('/trade') ||
        finalUrl.includes('/en/trade') ||
        responseBody.includes('"authorized":true') ||
        responseBody.includes('logout') ||
        loginRes.status === 200 && !responseBody.includes('sign-in') && !responseBody.includes('Sign in');

      if (loginSuccess) {
        console.log('✅ [AutoTrade] HTTP Login SUCCESS!');
        // Extract and save cookies
        this.cookies = await this.jar.getCookiesSync('https://qxbroker.com')
          .map(c => `${c.key}=${c.value}`)
          .join('; ');
        this.saveSession();
        return true;
      } else {
        console.error('❌ [AutoTrade] Login failed. Wrong credentials or Cloudflare block.');
        console.error('   📋 Tip: Set QUOTEX_SESSION_COOKIE in .env with cookie from your browser.');
        // Try cookie-based fallback
        if (process.env.QUOTEX_SESSION_COOKIE) {
          console.log('🍪 [AutoTrade] Using QUOTEX_SESSION_COOKIE from .env...');
          this.cookies = process.env.QUOTEX_SESSION_COOKIE;
          return true;
        }
        return false;
      }
    } catch (err) {
      console.error('❌ [AutoTrade] Login error:', err.message);
      // Fallback to manual cookie if provided
      if (process.env.QUOTEX_SESSION_COOKIE) {
        console.log('🍪 [AutoTrade] Using QUOTEX_SESSION_COOKIE from .env as fallback...');
        this.cookies = process.env.QUOTEX_SESSION_COOKIE;
        return true;
      }
      return false;
    }
  }

  async connectTradingSocket() {
    return new Promise((resolve) => {
      console.log('📡 [AutoTrade] Connecting to Quotex Trading WebSocket...');

      const wsUrl = 'wss://ws2.qxbroker.com';

      this.socket = io(wsUrl, {
        transports: ['websocket'],
        extraHeaders: {
          'Cookie': this.cookies,
          'Origin': 'https://qxbroker.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionAttempts: 5,
        timeout: 15000,
      });

      const connectTimeout = setTimeout(() => {
        console.warn('⚠️ [AutoTrade] WebSocket connection timed out. Will retry on next trade signal.');
        this.isReady = true; // Still mark ready so bot continues
        resolve();
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log('✅ [AutoTrade] Trading WebSocket connected!');
        this.isLoggedIn = true;
        this.isReady = true;
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(connectTimeout);
        console.warn(`⚠️ [AutoTrade] WebSocket connection error: ${err.message}`);
        console.warn('   Bot will continue without live WebSocket. Trades will use HTTP API fallback.');
        this.isReady = true;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`⚠️ [AutoTrade] WebSocket disconnected: ${reason}`);
        this.isLoggedIn = false;
      });

      this.socket.on('error', (data) => {
        console.warn('⚠️ [AutoTrade] WebSocket error event:', data);
      });

      // Listen for trade confirmation
      this.socket.on('successOpenOrder', (data) => {
        console.log(`🎯 [AutoTrade] Trade CONFIRMED by Quotex! Order ID: ${data?.id || 'N/A'}`);
      });

      this.socket.on('failOpenOrder', (data) => {
        console.warn('❌ [AutoTrade] Trade REJECTED by Quotex:', JSON.stringify(data));
      });
    });
  }

  async placeTrade(signal) {
    if (!this.isReady) {
      console.warn('⚠️ [AutoTrade] Trader not ready yet. Skipping trade.');
      return;
    }

    const direction = (signal.type.toUpperCase() === 'BUY' || signal.type.toUpperCase() === 'CALL')
      ? 'call' : 'put';

    const emoji = direction === 'call' ? '↗️' : '↘️';
    console.log(`${emoji} [AutoTrade] Placing ${direction.toUpperCase()} trade | ${signal.asset} | $${this.tradeAmount} | ${this.isDemo ? 'DEMO' : 'REAL'}`);

    // Normalize asset name for Quotex (e.g. EUR/USD -> EURUSD_otc)
    const asset = this.normalizeAsset(signal.asset);
    this.requestId++;

    const tradePayload = {
      asset: asset,
      amount: this.tradeAmount,
      action: direction,
      isDemo: this.isDemo ? 1 : 0,
      requestId: this.requestId,
      optionType: 100,  // Binary option
      time: 60,         // 1 minute expiry
    };

    // Try WebSocket first
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('openOrder', tradePayload);
        console.log(`✅ [AutoTrade] Trade sent via WebSocket: ${asset} ${direction.toUpperCase()}`);
        return;
      } catch (err) {
        console.warn('⚠️ [AutoTrade] WebSocket trade failed, trying HTTP API...');
      }
    }

    // HTTP API fallback
    await this.placeTradeHTTP(tradePayload);
  }

  async placeTradeHTTP(payload) {
    try {
      const res = await this.client.post(
        'https://qxbroker.com/api/v1/trading/open-option',
        payload,
        {
          headers: {
            'Cookie': this.cookies,
            'Content-Type': 'application/json',
            'Referer': 'https://qxbroker.com/en/trade',
            'X-Requested-With': 'XMLHttpRequest',
          }
        }
      );

      if (res.data && (res.data.success || res.data.id)) {
        console.log(`✅ [AutoTrade] Trade placed via HTTP API! ID: ${res.data.id || 'N/A'}`);
      } else {
        console.warn('⚠️ [AutoTrade] HTTP trade response:', JSON.stringify(res.data).substring(0, 200));
      }
    } catch (err) {
      console.error('❌ [AutoTrade] HTTP trade failed:', err.message);
    }
  }

  normalizeAsset(asset) {
    // Convert "EUR/USD" → "EURUSD_otc"
    const map = {
      'EUR/USD': 'EURUSD_otc',
      'GBP/USD': 'GBPUSD_otc',
      'USD/JPY': 'USDJPY_otc',
      'AUD/USD': 'AUDUSD_otc',
      'EUR/GBP': 'EURGBP_otc',
      'BTC/USD': 'BTCUSD_otc',
      'USD/CAD': 'USDCAD_otc',
      'USD/CHF': 'USDCHF_otc',
    };
    return map[asset] || asset.replace('/', '') + '_otc';
  }

  saveSession() {
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify({
        cookies: this.cookies,
        savedAt: Date.now(),
      }), 'utf8');
      console.log('💾 [AutoTrade] Session saved to disk.');
    } catch (e) {
      // Ignore save errors
    }
  }

  loadSession() {
    try {
      if (!fs.existsSync(SESSION_FILE)) return false;
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Session valid for 12 hours
      if (Date.now() - data.savedAt > 12 * 60 * 60 * 1000) {
        console.log('⏰ [AutoTrade] Saved session expired (>12h). Will re-login.');
        return false;
      }
      this.cookies = data.cookies;
      return true;
    } catch (e) {
      return false;
    }
  }

  async close() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🛑 [AutoTrade] Trading WebSocket disconnected.');
    }
  }
}

module.exports = new AutoTrader();
