const config = require('./config');
const websocket = require('./websocket');
const strategy = require('./strategy');
const telegram = require('./telegram');

// Track latest volume from depth/change events to augment price analysis
const latestVolumes = {};

function main() {
  console.log('🤖 Starting Real-Time Trading Signal Bot...');
  console.log(`📡 Monitored Assets: ${config.strategy.monitoredAssets.join(', ')}`);
  console.log(`⚙️  Sensitivity: ${config.strategy.sensitivity.toUpperCase()}`);
  console.log(`⏱️  Signal Cooldown: ${config.strategy.cooldownMs / 1000}s`);
  console.log(`🛡️  Duplicate Protection: ${config.strategy.duplicateProtectionMs / 1000}s\n`);

  // Handle incoming depth changes to store current market volume
  websocket.on('depth', (data) => {
    const { asset, volume } = data;
    if (asset && volume !== undefined) {
      latestVolumes[asset] = volume;
    }
  });

  // Handle incoming live prices
  websocket.on('quotes', (data) => {
    const { asset, price } = data;
    if (!asset || !price) return;

    // Fetch latest volume if available, then pass to strategy
    const volume = latestVolumes[asset] || 0;
    const signal = strategy.processPriceUpdate(asset, price, volume);

    if (signal) {
      // Trigger and send signal to Telegram chat
      telegram.sendSignal(signal);
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
