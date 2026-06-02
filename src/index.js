const config = require('./config');
const websocket = require('./websocket');
const strategy = require('./strategy');
const telegram = require('./telegram');
const server = require('./server');

// Track latest volume from depth/change events to augment price analysis
const latestVolumes = {};

// ======== Signal Stagger Queue ========
// Prevents flooding: signals arrive 1-2 minutes apart
const signalQueue = [];
let isProcessingQueue = false;

function enqueueSignal(signal) {
  signalQueue.push({ signal, queuedAt: Date.now() });
  console.log(`📥 [Queue] Signal queued for ${signal.asset} (${signal.type}). Queue length: ${signalQueue.length}`);
  if (!isProcessingQueue) {
    processSignalQueue();
  }
}

async function processSignalQueue() {
  if (signalQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const item = signalQueue.shift();

  let sent = false;
  try {
    // Send the signal now
    console.log(`📤 [Queue] Dispatching signal: ${item.signal.asset} ${item.signal.type}`);
    sent = await telegram.sendSignal(item.signal);
  } catch (error) {
    console.error(`❌ [Queue] Error sending signal:`, error.message);
  }

  // If more signals remain, calculate delay
  if (signalQueue.length > 0) {
    // If the signal was suppressed (sent === false) or errored, don't wait 1-2 mins, process next immediately (small 1s delay)
    const delayMs = sent ? (60000 + Math.floor(Math.random() * 60000)) : 1000;
    
    if (sent) {
      console.log(`⏳ [Queue] Next signal in ${(delayMs / 1000).toFixed(0)}s (${signalQueue.length} remaining)`);
    } else {
      console.log(`⏭️ [Queue] Signal suppressed/failed. Skipping delay. (${signalQueue.length} remaining)`);
    }

    setTimeout(() => {
      processSignalQueue();
    }, delayMs);
  } else {
    isProcessingQueue = false;
  }
}

// ======== Main Entry Point ========
function main() {
  console.log('🤖 Starting Real-Time Trading Signal Bot...');
  
  // Start the HTTP API/Web portal server
  server.startServer();

  console.log(`📡 Monitored Assets: ${config.strategy.monitoredAssets.join(', ')}`);
  console.log(`⚙️  Sensitivity: ${config.strategy.sensitivity.toUpperCase()}`);
  console.log(`⏱️  Signal Cooldown: ${config.strategy.cooldownMs / 1000}s`);
  console.log(`🛡️  Duplicate Protection: ${config.strategy.duplicateProtectionMs / 1000}s`);
  console.log(`📥 Signal Queue: ACTIVE (1-2 min spacing between dispatches)\n`);

  // Handle incoming depth changes to store current market volume
  websocket.on('depth', (data) => {
    const { asset, volume } = data;
    if (asset && volume !== undefined) {
      latestVolumes[asset] = volume;
    }
  });

  // Handle incoming live prices — process through strategy, then queue
  websocket.on('quotes', (data) => {
    const { asset, price } = data;
    if (!asset || !price) return;

    const volume = latestVolumes[asset] || 0;
    const signal = strategy.processPriceUpdate(asset, price, volume);

    if (signal) {
      // Queue signal instead of sending immediately
      enqueueSignal(signal);
    }
  });

  // Also listen to raw simulator ticks (websocket.js fires 'quotes_raw' for simulation)
  websocket.on('quotes_raw', (data) => {
    const { asset, price } = data;
    if (!asset || !price) return;

    const volume = latestVolumes[asset] || 0;
    const signal = strategy.processPriceUpdate(asset, price, volume);

    if (signal) {
      enqueueSignal(signal);
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
