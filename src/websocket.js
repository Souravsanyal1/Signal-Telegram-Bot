const io = require('socket.io-client');
const config = require('./config');

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.reconnectAttempts = 0;
    this.simulationInterval = null;
  }

  /**
   * Register listener for specific WebSocket streams
   * @param {string} event - "quotes" or "depth"
   * @param {Function} callback
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Connect to market data source
   */
  connect() {
    if (config.websocket.simulate) {
      console.log('🤖 [WebSocket] Starting in SIMULATED market mode...');
      this.startSimulation();
      return;
    }

    console.log(`🔌 [WebSocket] Connecting to WebSocket: ${config.websocket.url}`);

    // Configuration tailored to Engine.IO EIO=3 compatibility and standard WebSocket transport
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
      console.log('✅ [WebSocket] Connected successfully to live market data feed.');
      this.reconnectAttempts = 0;

      // Subscribe to quotes & depth streams for monitored assets
      config.strategy.monitoredAssets.forEach(asset => {
        console.log(`[WebSocket] Subscribing to streams for ${asset}`);
        // Quotex subscription events (e.g. depth/follow, quotes/subscribe)
        this.socket.emit('depth/follow', asset);
        this.socket.emit('quotes/subscribe', asset);
      });
    });

    // Handle incoming price streams
    this.socket.on('quotes/stream', (data) => {
      // Data shape: { asset: 'EUR/USD', price: 1.12345, timestamp: 16800000000 }
      if (data && data.asset && data.price) {
        this.trigger('quotes', data);
      }
    });

    // Handle incoming depth changes
    this.socket.on('depth/change', (data) => {
      // Data shape: { asset: 'EUR/USD', asks: [...], bids: [...], volume: 450 }
      if (data && data.asset) {
        this.trigger('depth', data);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`⚠️ [WebSocket] Disconnected from host: ${reason}. Retrying connection...`);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts > 5) {
        console.warn('⚠️ [WebSocket] Multiple connection failures. Consider checking .env settings or switching to simulation mode (SIMULATE_MARKET=true).');
      }
    });
  }

  /**
   * Helper to dispatch events locally
   */
  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  /**
   * Simulation Engine for local sandbox testing
   */
  startSimulation() {
    // Initial starting prices
    const assets = {};
    config.strategy.monitoredAssets.forEach(asset => {
      let basePrice = 1.0;
      if (asset.startsWith('EUR/USD')) basePrice = 1.08250;
      else if (asset.startsWith('GBP/USD')) basePrice = 1.25400;
      else if (asset.startsWith('USD/JPY')) basePrice = 155.450;
      else if (asset.startsWith('AUD/USD')) basePrice = 0.66500;
      else if (asset.startsWith('EUR/GBP')) basePrice = 0.85200;
      else if (asset.startsWith('BTC/USD')) basePrice = 67500.00;

      assets[asset] = {
        price: basePrice,
        trend: 0, // direction factor
        ticksCount: 0
      };
    });

    this.simulationInterval = setInterval(() => {
      // Pick a random asset to update
      const assetKeys = Object.keys(assets);
      const randomAsset = assetKeys[Math.floor(Math.random() * assetKeys.length)];
      const assetState = assets[randomAsset];

      // Simulate price movements using random walk + trends
      assetState.ticksCount++;
      
      // Periodically shift the trend to trigger signals
      if (assetState.ticksCount % 15 === 0) {
        // Randomly set a trend: -1 (bearish), 0 (flat), 1 (bullish)
        assetState.trend = Math.floor(Math.random() * 3) - 1;
      }

      const volatility = randomAsset.includes('BTC') ? 15.0 : 0.00015;
      const bias = assetState.trend * volatility * 0.8;
      const randomChange = (Math.random() - 0.5) * volatility + bias;
      
      assetState.price += randomChange;
      if (assetState.price <= 0) assetState.price = 0.0001;

      // Simulate quote update
      this.trigger('quotes', {
        asset: randomAsset,
        price: assetState.price,
        timestamp: Date.now()
      });

      // Periodically simulate a depth/volume change
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
    }, 800); // Send updates every 800ms
  }

  /**
   * Stop the client
   */
  disconnect() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    console.log('[WebSocket] Connection closed.');
  }
}

module.exports = new WebSocketManager();
