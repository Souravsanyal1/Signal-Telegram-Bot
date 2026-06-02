const config = require('./config');
const websocket = require('./websocket');
const strategy = require('./strategy');
const telegram = require('./telegram');
const server = require('./server');

// ======== Signal Processing (No Buffering - Send Immediately) ========
function processSignal(signal) {
  console.log(`🎯 [Signal] Received ${signal.type} signal for ${signal.asset} with confidence ${signal.confidence}%`);
  
  // Check cooldown and send immediately
  telegram.sendSignal(signal).then(sent => {
    if (sent) {
      console.log(`✅ [Signal] Sent ${signal.type} signal to Telegram for ${signal.asset}`);
    } else {
      console.log(`⏳ [Signal] Skipped ${signal.type} signal for ${signal.asset} (cooldown/duplicate protection active)`);
    }
  }).catch(err => {
    console.error(`❌ [Signal] Failed to send signal:`, err.message);
  });
}

// Track latest volume from depth/change events
const latestVolumes = {};

// ======== Main Entry Point ========
function main() {
  console.log('🤖 Starting Real-Time Trading Signal Bot...');
  
  // Start the HTTP API/Web portal server
  server.startServer();

  // Auto-trading disabled - bot operates in signal generation mode only

  console.log(`📡 Monitored Assets: ${config.strategy.monitoredAssets.join(', ')}`);
  console.log(`⚙️  Sensitivity: ${config.strategy.sensitivity.toUpperCase()}`);
  console.log(`⏱️  Signal Cooldown: ${config.strategy.cooldownMs / 1000}s`);
  console.log(`🛡️  Duplicate Protection: ${config.strategy.duplicateProtectionMs / 1000}s`);
  console.log(`📥 Signal Queue: ACTIVE (Direct dispatch - no buffering)\n`);

  // Handle incoming depth changes to store current market volume
  websocket.on('depth', (data) => {
    const { asset, volume } = data;
    if (asset && volume !== undefined) {
      latestVolumes[asset] = volume;
    }
  });

  // Handle incoming live prices — process through strategy, then send immediately
  websocket.on('quotes', (data) => {
    const { asset, price } = data;
    if (!asset || !price) return;

    const volume = latestVolumes[asset] || 0;
    const signal = strategy.processPriceUpdate(asset, price, volume);

    if (signal) {
      processSignal(signal);
    }
  });

  // Also listen to raw simulator ticks
  websocket.on('quotes_raw', (data) => {
    const { asset, price } = data;
    if (!asset || !price) return;

    const volume = latestVolumes[asset] || 0;
    const signal = strategy.processPriceUpdate(asset, price, volume);

    if (signal) {
      processSignal(signal);
    }
  });

  // Connect to the stream source
  websocket.connect();

  // Graceful shutdown handling
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutdown signal received. Cleaning up...');
    websocket.disconnect();
    process.exit(0);
  });
}

main();
