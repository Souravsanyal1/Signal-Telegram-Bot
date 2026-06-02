const io = require('socket.io-client');
const config = require('./config');

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.reconnectAttempts = 0;
    this.simulationInterval = null;
  }

  connect() {
    if (config.websocket.simulate) {
      console.log('🤖 [WebSocket] Starting in SIMULATED market mode...');
      this.startSimulation();
      return;
    }

    console.log(`🔌 [WebSocket] Connecting to WebSocket: ${config.websocket.url}`);
    this.socket = io(config.websocket.url, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('✅ [WebSocket] Connected to live market data feed.');
      this.reconnectAttempts = 0;
      config.strategy.monitoredAssets.forEach(asset => {
        this.socket.emit('depth/follow', asset);
        this.socket.emit('quotes/subscribe', asset);
      });
    });

    this.socket.on('quotes/stream', (data) => {
      if (data && data.asset && data.price) {
        // Feed directly to quote callback (strategy handles cooldowns)
        this.trigger('quotes', data);
      }
    });

    this.socket.on('depth/change', (data) => {
      if (data && data.asset) {
        this.trigger('depth', data);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`⚠️ [WebSocket] Disconnected: ${reason}. Retrying...`);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts > 5) {
        console.warn('⚠️ Multiple failures. Try SIMULATE_MARKET=true in .env');
      }
    });
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  startSimulation() {
    const assets = {};
    config.strategy.monitoredAssets.forEach(asset => {
      let basePrice = 1.0;
      if (asset.startsWith('EUR/USD')) basePrice = 1.08250;
      else if (asset.startsWith('GBP/USD')) basePrice = 1.25400;
      else if (asset.startsWith('USD/JPY')) basePrice = 155.450;
      else if (asset.startsWith('AUD/USD')) basePrice = 0.66500;
      else if (asset.startsWith('EUR/GBP')) basePrice = 0.85200;
      else if (asset.startsWith('BTC/USD')) basePrice = 67500.00;

      assets[asset] = { price: basePrice, trend: 0, ticksCount: 0 };
    });

    // Internal tick engine runs fast to build indicator history (every 800ms)
    this.simulationInterval = setInterval(() => {
      const assetKeys = Object.keys(assets);
      const randomAsset = assetKeys[Math.floor(Math.random() * assetKeys.length)];
      const assetState = assets[randomAsset];

      assetState.ticksCount++;
      if (assetState.ticksCount % 15 === 0) {
        assetState.trend = Math.floor(Math.random() * 3) - 1;
      }

      const volatility = randomAsset.includes('BTC') ? 15.0 : 0.00015;
      const bias = assetState.trend * volatility * 0.8;
      const randomChange = (Math.random() - 0.5) * volatility + bias;
      assetState.price += randomChange;
      if (assetState.price <= 0) assetState.price = 0.0001;

      // Feed raw price data directly to strategy (for indicator building)
      // Signals are queued when strategy returns a match
      this.trigger('quotes_raw', {
        asset: randomAsset,
        price: assetState.price,
        timestamp: Date.now()
      });

      if (Math.random() > 0.6) {
        const simulatedVolume = Math.floor(Math.random() * 1500) + (assetState.trend !== 0 ? 1200 : 100);
        this.trigger('depth', {
          asset: randomAsset,
          volume: simulatedVolume,
          asks: [[assetState.price + volatility, 10]],
          bids: [[assetState.price - volatility, 12]],
          timestamp: Date.now()
        });
      }
    }, 800);
  }

  disconnect() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.socket) this.socket.disconnect();
    console.log('[WebSocket] Connection closed.');
  }
}

module.exports = new WebSocketManager();
