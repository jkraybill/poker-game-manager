import { PokerGameManager } from '../PokerGameManager.js';
import { Player } from '../Player.js';
import { Action } from '../types/index.js';

/**
 * Performance Benchmark Suite
 * 
 * Measures performance of key operations in the poker game manager.
 * Run with: node packages/core/src/benchmarks/performance.bench.js
 */

// Simple player that always calls
class BenchmarkPlayer extends Player {
  async getAction(gameState) {
    const myState = gameState.players[this.id];
    const toCall = gameState.currentBet - myState.bet;
    
    if (toCall > 0 && myState.chips >= toCall) {
      return {
        playerId: this.id,
        action: Action.CALL,
        amount: toCall,
        timestamp: Date.now(),
      };
    }
    
    return {
      playerId: this.id,
      action: Action.CHECK,
      timestamp: Date.now(),
    };
  }
}

// Benchmark utilities
function measureTime(fn, iterations = 1000) {
  const times = [];
  
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }
  
  // Actual measurements
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  return {
    min: times[0],
    max: times[times.length - 1],
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

function formatResults(name, results) {
  console.log(`\n${name}:`);
  console.log(`  Average: ${results.avg.toFixed(3)}ms`);
  console.log(`  Median:  ${results.median.toFixed(3)}ms`);
  console.log(`  Min:     ${results.min.toFixed(3)}ms`);
  console.log(`  Max:     ${results.max.toFixed(3)}ms`);
  console.log(`  P95:     ${results.p95.toFixed(3)}ms`);
  console.log(`  P99:     ${results.p99.toFixed(3)}ms`);
}

// Benchmarks
async function benchmarkTableCreation() {
  const manager = new PokerGameManager();
  
  const results = measureTime(() => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      maxPlayers: 9,
    });
    // Clean up
    manager.tables.delete(table.id);
  });
  
  formatResults('Table Creation', results);
}

async function benchmarkPlayerAddition() {
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    maxPlayers: 9,
  });
  
  const results = measureTime(() => {
    const player = new BenchmarkPlayer({ name: 'Test' });
    player.buyIn(1000);
    table.addPlayer(player);
    table.removePlayer(player.id);
  });
  
  formatResults('Player Addition/Removal', results);
}

async function benchmarkGameStart() {
  const manager = new PokerGameManager();
  
  const results = measureTime(() => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      maxPlayers: 9,
    });
    
    // Add players
    for (let i = 0; i < 6; i++) {
      const player = new BenchmarkPlayer({ name: `Player${i}` });
      player.buyIn(1000);
      table.addPlayer(player);
    }
    
    // Start game
    table.tryStartGame();
    
    // Clean up
    table.close();
    manager.tables.delete(table.id);
  });
  
  formatResults('Game Start (6 players)', results);
}

async function benchmarkSingleAction() {
  const manager = new PokerGameManager();
  const table = manager.createTable({
    blinds: { small: 10, big: 20 },
    maxPlayers: 9,
  });
  
  // Setup game
  const players = [];
  for (let i = 0; i < 6; i++) {
    const player = new BenchmarkPlayer({ name: `Player${i}` });
    player.buyIn(1000);
    table.addPlayer(player);
    players.push(player);
  }
  
  let actionCount = 0;
  let totalTime = 0;
  
  table.on('action:requested', async ({ playerId, gameState }) => {
    const start = performance.now();
    const player = players.find(p => p.id === playerId);
    if (player) {
      const action = await player.getAction(gameState);
      // Simulate action processing
    }
    const end = performance.now();
    totalTime += (end - start);
    actionCount++;
  });
  
  table.tryStartGame();
  
  // Wait for some actions
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\nSingle Action Processing:');
  console.log(`  Average: ${(totalTime / actionCount).toFixed(3)}ms`);
  console.log(`  Total actions: ${actionCount}`);
}

async function benchmarkHandEvaluation() {
  // Import HandEvaluator
  const { HandEvaluator } = await import('../game/HandEvaluator.js');
  
  // Test hands
  const testHands = [
    ['As', 'Ks', 'Qs', 'Js', 'Ts'], // Royal flush
    ['9h', '8h', '7h', '6h', '5h'], // Straight flush
    ['Kd', 'Kh', 'Kc', 'Ks', '2d'], // Four of a kind
    ['Qd', 'Qh', 'Qc', '7s', '7d'], // Full house
    ['Ac', '8c', '6c', '4c', '2c'], // Flush
    ['Jd', 'Th', '9s', '8c', '7d'], // Straight
    ['5d', '5h', '5c', 'Ks', 'Qd'], // Three of a kind
    ['Ad', 'Ah', 'Kc', 'Ks', 'Jd'], // Two pair
    ['Td', 'Th', '8c', '6s', '2d'], // Pair
    ['Kd', 'Qh', 'Jc', '9s', '7d'], // High card
  ];
  
  const results = measureTime(() => {
    const hand = testHands[Math.floor(Math.random() * testHands.length)];
    HandEvaluator.evaluate(hand);
  });
  
  formatResults('Hand Evaluation (pokersolver)', results);
}

async function benchmarkFullHand() {
  const manager = new PokerGameManager();
  let handsCompleted = 0;
  let totalTime = 0;
  
  const runHand = async () => {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      maxPlayers: 9,
    });
    
    // Add players
    for (let i = 0; i < 6; i++) {
      const player = new BenchmarkPlayer({ name: `Player${i}` });
      player.buyIn(1000);
      table.addPlayer(player);
    }
    
    const start = performance.now();
    
    return new Promise((resolve) => {
      table.on('hand:ended', () => {
        const end = performance.now();
        totalTime += (end - start);
        handsCompleted++;
        table.close();
        manager.tables.delete(table.id);
        resolve();
      });
      
      table.tryStartGame();
    });
  };
  
  // Run multiple hands
  for (let i = 0; i < 100; i++) {
    await runHand();
  }
  
  console.log('\nFull Hand Completion (6 players):');
  console.log(`  Average: ${(totalTime / handsCompleted).toFixed(3)}ms`);
  console.log(`  Total hands: ${handsCompleted}`);
}

// Memory usage benchmark
async function benchmarkMemoryUsage() {
  const manager = new PokerGameManager();
  const tables = [];
  
  // Get initial memory
  if (global.gc) {
    global.gc();
  }
  const initialMemory = process.memoryUsage();
  
  // Create 100 tables with 6 players each
  for (let i = 0; i < 100; i++) {
    const table = manager.createTable({
      blinds: { small: 10, big: 20 },
      maxPlayers: 9,
    });
    
    for (let j = 0; j < 6; j++) {
      const player = new BenchmarkPlayer({ name: `P${i}-${j}` });
      player.buyIn(1000);
      table.addPlayer(player);
    }
    
    table.tryStartGame();
    tables.push(table);
  }
  
  // Wait for games to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get final memory
  if (global.gc) {
    global.gc();
  }
  const finalMemory = process.memoryUsage();
  
  console.log('\nMemory Usage (100 tables, 6 players each):');
  console.log(`  Heap Used: ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  RSS: ${((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Per Table: ${((finalMemory.heapUsed - initialMemory.heapUsed) / 100 / 1024).toFixed(2)}KB`);
  
  // Cleanup
  tables.forEach(table => table.close());
}

// Run all benchmarks
async function runBenchmarks() {
  const os = await import('os');
  
  console.log('=== Poker Game Manager Performance Benchmarks ===');
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`CPUs: ${os.cpus().length} x ${os.cpus()[0].model}`);
  console.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  
  await benchmarkTableCreation();
  await benchmarkPlayerAddition();
  await benchmarkGameStart();
  await benchmarkSingleAction();
  await benchmarkHandEvaluation();
  await benchmarkFullHand();
  await benchmarkMemoryUsage();
  
  console.log('\n=== Benchmark Complete ===');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks, measureTime, formatResults };