import { GameConfig, PROMO_CODES } from '../data/games.ts';

export interface CalculationResult {
  virtualAmount: number;
  rate: number;
  subtotal: number;
  promoDiscount: number;
  total: number;
}

export function getPromoPercent(code: string): number {
  const cleanCode = (code || '').trim().toUpperCase();
  return PROMO_CODES[cleanCode] || 0;
}

export function getPricingForVirtual(amount: number, game?: GameConfig): number {
  if (!game || !Array.isArray(game.pricing) || !game.pricing.length) {
    return 0;
  }

  const pricing = game.pricing.slice().sort((a, b) => b.min - a.min);
  const selected = pricing.find((item) => amount >= item.min) || pricing[pricing.length - 1];

  return selected.rate;
}

export function calculateFromVirtual(
  amount: number | string,
  game?: GameConfig,
  promoCode: string = ''
): CalculationResult {
  const validAmount = Math.max(0, Number(amount) || 0);
  const rate = getPricingForVirtual(validAmount, game);
  const subtotal = Math.round(validAmount * rate * 100) / 100;
  const promoPercent = getPromoPercent(promoCode);
  const promoDiscount = Math.round(((subtotal * promoPercent) / 100) * 100) / 100;
  const total = Math.round(Math.max(0, subtotal - promoDiscount) * 100) / 100;

  return {
    virtualAmount: validAmount,
    rate,
    subtotal,
    promoDiscount,
    total,
  };
}

export function calculateFromMoney(
  moneyValue: number | string,
  game?: GameConfig,
  promoCode: string = ''
): CalculationResult {
  const money = Math.max(0, Number(moneyValue) || 0);
  const promoPercent = getPromoPercent(promoCode);

  if (!game || !Array.isArray(game.pricing) || !game.pricing.length) {
    return calculateFromVirtual(0, game, promoCode);
  }

  const pricing = game.pricing.slice().sort((a, b) => b.min - a.min);

  for (const tier of pricing) {
    const effectiveRate = tier.rate * (1 - promoPercent / 100);

    if (effectiveRate <= 0) continue;

    const rawVirtualAmount = money / effectiveRate;
    const virtualAmount = Math.round(rawVirtualAmount * 100) / 100;
    if (virtualAmount >= tier.min) {
      return calculateFromVirtual(virtualAmount, game, promoCode);
    }
  }

  return calculateFromVirtual(0, game, promoCode);
}

export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export function formatAmountValue(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  if (Number.isInteger(num)) return num.toLocaleString('ru-RU');
  return Number(num.toFixed(2)).toLocaleString('ru-RU');
}

export function formatTierLabel(min: number, goldMode: boolean): string {
  if (goldMode) {
    return `от ${formatAmountValue(min)} голды`;
  }
  return `от ${formatAmountValue(min)} кк`;
}
