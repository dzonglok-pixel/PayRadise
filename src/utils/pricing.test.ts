import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, PROMO_CODES } from '../data/games.ts';
import {
  calculateFromVirtual,
  calculateFromMoney,
  getPricingForVirtual,
  getPromoPercent,
  formatMoney,
  formatAmountValue,
} from './pricing.ts';

test('PROMO_CODES validation works properly', () => {
  assert.equal(getPromoPercent('START5'), 5);
  assert.equal(getPromoPercent('start5'), 5);
  assert.equal(getPromoPercent('BONUS7'), 7);
  assert.equal(getPromoPercent('VIP10'), 10);
  assert.equal(getPromoPercent('INVALID'), 0);
  assert.equal(getPromoPercent(''), 0);
});

test('BLACK RUSSIA pricing tiers calculate correctly', () => {
  const br = GAMES.br;
  // min 10 => rate 50; below 10 => rate 60
  assert.equal(getPricingForVirtual(5, br), 60);
  assert.equal(getPricingForVirtual(10, br), 50);
  assert.equal(getPricingForVirtual(50, br), 50);

  // 10 kk at 50 rate => 500 ₽
  const res1 = calculateFromVirtual(10, br);
  assert.equal(res1.subtotal, 500);
  assert.equal(res1.promoDiscount, 0);
  assert.equal(res1.total, 500);

  // With VIP10 promo => 10% discount = 450 ₽
  const res2 = calculateFromVirtual(10, br, 'VIP10');
  assert.equal(res2.subtotal, 500);
  assert.equal(res2.promoDiscount, 50);
  assert.equal(res2.total, 450);
});

test('calculateFromMoney reverse calculation matches', () => {
  const br = GAMES.br;
  // 500 ₽ without promo => 10 kk
  const res1 = calculateFromMoney(500, br);
  assert.equal(res1.virtualAmount, 10);
  assert.equal(res1.total, 500);

  // STANDOFF 2: 55 ₽ => 100 gold (at 0.55 rate)
  const so2 = GAMES.so2;
  const res2 = calculateFromMoney(55, so2);
  assert.equal(res2.virtualAmount, 100);
  assert.equal(res2.total, 55);
});

test('formatMoney produces expected Russian ruble formatting', () => {
  assert.ok(formatMoney(450).includes('450'));
  assert.ok(formatMoney(450).includes('₽'));
  assert.equal(formatAmountValue(10), '10');
  assert.equal(formatAmountValue(10.5), '10,5');
});
