const config = require('./config');
const websocket = require('./websocket');
const strategy = require('./strategy');
const telegram = require('./telegram');
const server = require('./server');
let autotrade = null;

// Track latest volume from depth/change events to augment price analysis
const latestVolumes = {};

// ======== 1-Minute Signal Aggregation Buffer ========
// Collects signals over 60 seconds and sends ONLY the most accurate one
let signalBuffer = [];
let bufferTimerStarted = false;

function enqueueSignal(signal) {
  signalBuffer.push(signal);
  console.log(`📥 [Buffer] Signal added for ${signal.asset} (${signal.type}) with confidence ${signal.confidence}%. Buffer size: ${signalBuffer.length}`);
  
  if (!bufferTimerStarted) {
    startBufferTimer();
  }
}

function startBufferTimer() {
  bufferTimerStarted = true;
  console.log(`⏱️ [Buffer] 1-minute aggregation timer started...`);
  
  setInterval(async () => {
    if (signalBuffer.length === 0) {
      console.log(`⏳ [Buffer] 1 minute passed, but no signals generated. Waiting...`);
      return;
    }

    // Sort buffer by confidence descending (highest confidence first)
    signalBuffer.sort((a, b) => b.confidence - a.confidence);
    
    // Pick the most accurate signal
    const bestSignal = signalBuffer[0];
    const totalGathered = signalBuffer.length;
    
    // Clear buffer for the next minute
    signalBuffer = [];
    
    console.log(`🎯 [Buffer] 1 minute passed. Picked most accurate signal (${bestSignal.asset} ${bestSignal.confidence}%) out of ${totalGathered} signals.`);
    
    let sent = false;
    try {
      sent = await telegram.sendSignal(bestSignal);
      
      // If successfully sent and auto trading is enabled, place trade
      if (sent && autotrade && process.env.AUTO_TRADE_ENABLED === 'true') {
        autotrade.placeTrade(bestSignal);
      }
    } catch (error) {
      console.error(`❌ [Buffer] Error sending signal:`, error.message);
    }
  }, 60000); // Exactly 1 minute (60,000 ms)
}


// ======== Main Entry Point ========
function main() {
  console.log('🤖 Starting Real-Time Trading Signal Bot...');
  
  // Start the HTTP API/Web portal server
  server.startServer();

  // Initialize AutoTrader if enabled
  if (process.env.AUTO_TRADE_ENABLED === 'true') {
    const AutoTrader = require('./autotrade');
    autotrade = new AutoTrader();
    autotrade.init();
  }

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
