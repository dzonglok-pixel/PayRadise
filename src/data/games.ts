export interface PricingTier {
  min: number;
  rate: number;
}

export interface GameConfig {
  key: string;
  name: string;
  image: string;
  sellUrl: string;
  servers: string[];
  pricing: PricingTier[];
  actionBuyText: string;
  actionSellText: string;
  buyTitle: string;
  amountLabel: string;
  amountPlaceholder: string;
  buySubmitText: string;
  rateSuffix: string;
  goldMode: boolean;
  autoSelectServer: string;
  className: string;
}

export const SUPPORT_URL = 'https://t.me/PayRadiseSupport';
export const SELL_MANAGER_URL = 'https://t.me/PayRadise';

// Games that deliver gold via the in-game market (skin listing) instead of trade/bank.
export const MARKET_DELIVERY_GAME_KEYS: string[] = ['so2'];

export const PROMO_CODES: Record<string, number> = {
  START5: 5,
  BONUS7: 7,
  VIP10: 10,
};

export const blackRussiaServers: string[] = [
  'RED', 'GREEN', 'BLUE', 'YELLOW', 'ORANGE', 'PURPLE', 'LIME', 'PINK', 'CHERRY', 'BLACK',
  'INDIGO', 'WHITE', 'MAGENTA', 'CRIMSON', 'GOLD', 'AZURE', 'PLATINUM', 'AQUA', 'GRAY', 'ICE',
  'CHILLI', 'CHOCO', 'MOSCOW', 'SPB', 'UFA', 'SOCHI', 'KAZAN', 'SAMARA', 'ROSTOV', 'ANAPA',
  'EKB', 'KRASNODAR', 'ARZAMAS', 'NOVOSIB', 'GROZNY', 'SARATOV', 'OMSK', 'IRKUTSK', 'VOLGOGRAD',
  'VORONEZH', 'BELGOROD', 'MAKHACHKALA', 'VLADIKAVKAZ', 'VLADIVOSTOK', 'KALININGRAD',
  'CHELYABINSK', 'KRASNOYARSK', 'CHEBOKSARY', 'KHABAROVSK', 'PERM', 'TULA', 'RYAZAN', 'MURMANSK',
  'PENZA', 'KURSK', 'ARKHANGELSK', 'ORENBURG', 'KIROV', 'KEMEROVO', 'TYUMEN', 'TOLYATTI',
  'IVANOVO', 'STAVROPOL', 'SMOLENSK', 'PSKOV', 'BRYANSK', 'OREL', 'YAROSLAVL', 'BARNAUL',
  'LIPETSK', 'ULYANOVSK', 'YAKUTSK', 'TAMBOV', 'BRATSK', 'ASTRAKHAN', 'CHITA', 'KOSTROMA',
  'VLADIMIR', 'KALUGA', 'NOVGOROD', 'TAGANROG', 'VOLOGDA', 'TVER', 'TOMSK', 'IZHEVSK', 'SURGUT',
  'PODOLSK', 'MAGADAN', 'CHEREPOVETS', 'NORILSK',
];

export const gtaServers: string[] = [
  'Downtown', 'Strawberry', 'Vinewood', 'Blackberry', 'Insquad', 'Sunrise', 'Rainbow', 'Richman',
  'Eclipse', 'La Mesa', 'Burton', 'Rockford', 'Alta', 'Del Perro', 'Davis', 'Harmony', 'Redwood',
  'Hawick', 'Grapeseed', 'Murrieta', 'Vespucci', 'Milton', 'La Puerta', 'Senora',
];

export const matreshkaServers: string[] = Array.from({ length: 34 }, (_, i) => `MATRESHKA MOBILE #${i + 1}`);

export const blackRussiaPricing: PricingTier[] = [
  { min: 10, rate: 50 },
  { min: 0, rate: 60 },
];

export const matreshkaPricing: PricingTier[] = [
  { min: 100, rate: 70 },
  { min: 10, rate: 80 },
  { min: 0, rate: 100 },
];

export const gtaPricing: PricingTier[] = [
  { min: 50, rate: 800 },
  { min: 10, rate: 900 },
  { min: 5, rate: 950 },
  { min: 0, rate: 1000 },
];

export const standoffPricing: PricingTier[] = [
  { min: 0, rate: 0.55 },
];

export const GAMES: Record<string, GameConfig> = {
  br: {
    key: 'br',
    name: 'BLACK RUSSIA',
    image: '/black-russia.png',
    sellUrl: SELL_MANAGER_URL,
    servers: blackRussiaServers,
    pricing: blackRussiaPricing,
    actionBuyText: 'КУПИТЬ ВИРТЫ',
    actionSellText: 'ПРОДАТЬ ВИРТЫ',
    buyTitle: 'Купить вирты',
    amountLabel: 'Количество валюты (кк)',
    amountPlaceholder: 'Например, 10',
    buySubmitText: 'КУПИТЬ',
    rateSuffix: '₽ / 1кк',
    goldMode: false,
    autoSelectServer: '',
    className: 'btn-game-br',
  },
  mat: {
    key: 'mat',
    name: 'MATRESHKA RP',
    image: '/matreshka.png',
    sellUrl: SELL_MANAGER_URL,
    servers: matreshkaServers,
    pricing: matreshkaPricing,
    actionBuyText: 'КУПИТЬ ВИРТЫ',
    actionSellText: 'ПРОДАТЬ ВИРТЫ',
    buyTitle: 'Купить вирты',
    amountLabel: 'Количество валюты (кк)',
    amountPlaceholder: 'Например, 10',
    buySubmitText: 'КУПИТЬ',
    rateSuffix: '₽ / 1кк',
    goldMode: false,
    autoSelectServer: '',
    className: 'btn-game-mat',
  },
  gta: {
    key: 'gta',
    name: 'GTA 5 RP',
    image: '/gta5rp.png',
    sellUrl: SELL_MANAGER_URL,
    servers: gtaServers,
    pricing: gtaPricing,
    actionBuyText: 'КУПИТЬ ВИРТЫ',
    actionSellText: 'ПРОДАТЬ ВИРТЫ',
    buyTitle: 'Купить вирты',
    amountLabel: 'Количество валюты (кк)',
    amountPlaceholder: 'Например, 10',
    buySubmitText: 'КУПИТЬ',
    rateSuffix: '₽ / 1кк',
    goldMode: false,
    autoSelectServer: '',
    className: 'btn-game-gta',
  },
  so2: {
    key: 'so2',
    name: 'STANDOFF 2',
    image: '/standoff.png',
    sellUrl: SELL_MANAGER_URL,
    servers: ['STANDOFF 2'],
    pricing: standoffPricing,
    actionBuyText: 'КУПИТЬ ГОЛДУ',
    actionSellText: 'ПРОДАТЬ ГОЛДУ',
    buyTitle: 'Купить голду',
    amountLabel: 'Количество голды',
    amountPlaceholder: 'Например, 100',
    buySubmitText: 'КУПИТЬ ГОЛДУ',
    rateSuffix: '₽ за 1 голду',
    goldMode: true,
    autoSelectServer: 'STANDOFF 2',
    className: 'btn-game-so2',
  },
};
