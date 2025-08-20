import { RiggedDeck } from './packages/core/src/game/RiggedDeck.js';

const deck = RiggedDeck.createAlternatingDeck({
  holeCards: [
    ['As', 'Ah'], // Player 1
    ['Ks', 'Kh'], // Player 2
    ['Qs', 'Qh'], // Player 3
    ['2c', '3c'], // Player 4
  ],
  burn: ['8d', '8h', '8s'],
  flop: ['4c', '5c', '6c'],
  turn: '7c',
  river: '9c',
});

console.log('Cards in deck:');
deck.cards.forEach((card, i) => {
  console.log(`  [${i}]: ${card.toString()}`);
});

console.log('\nDealing hole cards:');
const p1Cards = deck.dealHoleCards('p1', 0);
console.log('Player 1:', p1Cards.map(c => c.toString()).join(', '));

const p2Cards = deck.dealHoleCards('p2', 1);
console.log('Player 2:', p2Cards.map(c => c.toString()).join(', '));

const p3Cards = deck.dealHoleCards('p3', 2);
console.log('Player 3:', p3Cards.map(c => c.toString()).join(', '));

const p4Cards = deck.dealHoleCards('p4', 3);
console.log('Player 4:', p4Cards.map(c => c.toString()).join(', '));