/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  GAMES,
  SUPPORT_URL,
  PROMO_CODES,
  MARKET_DELIVERY_GAME_KEYS,
  GameConfig,
} from './data/games.ts';
import {
  calculateFromVirtual,
  calculateFromMoney,
  formatMoney,
  formatAmountValue,
  formatTierLabel,
} from './utils/pricing.ts';
import {
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
  findUserByNickname,
  registerUser,
  hashPassword,
  validateNickname,
  validatePassword,
} from './utils/auth.ts';
import { db, ReviewItem } from './utils/supabase.ts';
import { formatReviewDate } from './utils/formatDate.ts';
import {
  loadLocalReviews,
  addLocalReview,
  removeLocalReview,
  sortReviews,
  mergeReviews,
} from './utils/reviews.ts';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        disableVerticalSwipes?: () => void;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
        initData?: string;
      };
    };
  }
}

type ScreenType =
  | 'home'
  | 'actions'
  | 'servers'
  | 'buy'
  | 'orderGuide'
  | 'deliveryInfo'
  | 'info'
  | 'privacy'
  | 'agreement'
  | 'auth'
  | 'profile'
  | 'reviews';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('home');
  const [selectedGameKey, setSelectedGameKey] = useState<string>('br');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [serverSearch, setServerSearch] = useState<string>('');

  // Authentication & Profile state
  const [currentUser, setCurrentUser] = useState<string | null>(() => getCurrentSession());
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authNickname, setAuthNickname] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authGeneralError, setAuthGeneralError] = useState<string | null>(null);
  const [authNickError, setAuthNickError] = useState<string | null>(null);
  const [authPassError, setAuthPassError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Buy form state
  const [nickname, setNickname] = useState<string>(() => getCurrentSession() || '');
  const [deliveryMethod, setDeliveryMethod] = useState<'trade' | 'bank' | 'market'>('trade');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [virtualAmountStr, setVirtualAmountStr] = useState<string>('');
  const [moneyAmountStr, setMoneyAmountStr] = useState<string>('');
  const [lastEdited, setLastEdited] = useState<'virtual' | 'money'>('virtual');

  // Modal state
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<boolean>(false);

  // Reviews state (Supabase)
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewGame, setReviewGame] = useState<string>('BLACK RUSSIA');
  const [reviewAmount, setReviewAmount] = useState<string>('');
  const [reviewText, setReviewText] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);
  const [reviewFormSuccess, setReviewFormSuccess] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState<boolean>(false);

  const currentGame: GameConfig = GAMES[selectedGameKey] || GAMES.br;

  // Telegram WebApp initialization
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        if (window.Telegram.WebApp.disableVerticalSwipes) {
          window.Telegram.WebApp.disableVerticalSwipes();
        }
      } catch (err) {
        console.error('Telegram WebApp init error', err);
      }
    }
  }, []);

  // Check URL params (?autostart=1 or ?game=br, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    const screenParam = params.get('screen') as ScreenType | null;

    if (gameParam && GAMES[gameParam]) {
      setSelectedGameKey(gameParam);
      setDeliveryMethod(MARKET_DELIVERY_GAME_KEYS.includes(gameParam) ? 'market' : 'trade');
    }
    if (screenParam) {
      setActiveScreen(screenParam);
    }
  }, []);

  // Keep modal-open class synced on document.body
  useEffect(() => {
    if (showMaintenanceModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [showMaintenanceModal]);

  const openExternal = (url: string) => {
    if (window.Telegram?.WebApp) {
      if (url.startsWith('https://t.me/') && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
        return;
      }
      if (window.Telegram.WebApp.openLink) {
        window.Telegram.WebApp.openLink(url);
        return;
      }
    }
    window.open(url, '_blank');
  };

  const handleSelectGame = (key: string) => {
    setSelectedGameKey(key);
    setSelectedServer('');
    setNickname(currentUser || '');
    setBankAccount('');
    setPromoCode('');
    setVirtualAmountStr('');
    setMoneyAmountStr('');
    setDeliveryMethod(MARKET_DELIVERY_GAME_KEYS.includes(key) ? 'market' : 'trade');
    setLastEdited('virtual');
    setServerSearch('');
    setActiveScreen('actions');
  };

  const handleOpenBuyFlow = () => {
    if (currentGame.autoSelectServer) {
      setSelectedServer(currentGame.autoSelectServer);
      setActiveScreen('buy');
    } else {
      setServerSearch('');
      setActiveScreen('servers');
    }
  };

  const handleSelectServer = (serverName: string) => {
    setSelectedServer(serverName);
    setActiveScreen('buy');
  };

  // Promo code validation
  const promoStatus = useMemo(() => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return null;
    if (PROMO_CODES[clean]) {
      return {
        type: 'success',
        text: `Промокод активирован: скидка ${PROMO_CODES[clean]}%`,
      };
    }
    return {
      type: 'warning',
      text: 'Промокод не найден.\nЗаказ будет оформлен без скидки.',
    };
  }, [promoCode]);

  // Pricing calculations
  const calculation = useMemo(() => {
    if (lastEdited === 'money') {
      return calculateFromMoney(moneyAmountStr, currentGame, promoCode);
    } else {
      return calculateFromVirtual(virtualAmountStr, currentGame, promoCode);
    }
  }, [lastEdited, moneyAmountStr, virtualAmountStr, currentGame, promoCode]);

  // Sync inputs when edited
  const handleVirtualAmountChange = (val: string) => {
    setLastEdited('virtual');
    setVirtualAmountStr(val);
    const res = calculateFromVirtual(val, currentGame, promoCode);
    setMoneyAmountStr(res.total > 0 ? Math.round(res.total).toString() : '');
  };

  const handleMoneyAmountChange = (val: string) => {
    setLastEdited('money');
    setMoneyAmountStr(val);
    const res = calculateFromMoney(val, currentGame, promoCode);
    setVirtualAmountStr(res.virtualAmount > 0 ? Number(res.virtualAmount.toFixed(2)).toString() : '');
  };

  const handlePromoChange = (val: string) => {
    setPromoCode(val);
    if (lastEdited === 'money') {
      const res = calculateFromMoney(moneyAmountStr, currentGame, val);
      setVirtualAmountStr(res.virtualAmount > 0 ? Number(res.virtualAmount.toFixed(2)).toString() : '');
    } else {
      const res = calculateFromVirtual(virtualAmountStr, currentGame, val);
      setMoneyAmountStr(res.total > 0 ? Math.round(res.total).toString() : '');
    }
  };

  // Auth submission handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthGeneralError(null);
    setAuthNickError(null);
    setAuthPassError(null);

    const cleanNick = authNickname.trim();
    const cleanPass = authPassword;

    // Basic empty checks
    let hasEmpty = false;
    if (!cleanNick) {
      setAuthNickError('Введите никнейм');
      hasEmpty = true;
    }
    if (!cleanPass) {
      setAuthPassError('Введите пароль');
      hasEmpty = true;
    }
    if (hasEmpty) return;

    setAuthLoading(true);

    try {
      if (authTab === 'login') {
        // LOGIN FLOW
        const user = findUserByNickname(cleanNick);
        if (!user) {
          setAuthGeneralError('Неверный никнейм или пароль');
          setAuthLoading(false);
          return;
        }

        const passHash = await hashPassword(cleanPass);
        if (user.passwordHash !== passHash) {
          setAuthGeneralError('Неверный никнейм или пароль');
          setAuthLoading(false);
          return;
        }

        // Login successful
        setCurrentSession(user.nickname);
        setCurrentUser(user.nickname);
        if (!nickname) {
          setNickname(user.nickname);
        }
        setAuthPassword('');
        setActiveScreen('profile');
      } else {
        // REGISTER FLOW
        const nickValidation = validateNickname(cleanNick);
        if (!nickValidation.valid) {
          setAuthNickError(nickValidation.message || 'Некорректный никнейм');
          setAuthLoading(false);
          return;
        }

        if (findUserByNickname(cleanNick)) {
          setAuthNickError('Пользователь с таким никнеймом уже зарегистрирован');
          setAuthLoading(false);
          return;
        }

        const passValidation = validatePassword(cleanPass);
        if (!passValidation.valid) {
          setAuthPassError(passValidation.message || 'Пароль слишком простой');
          setAuthLoading(false);
          return;
        }

        const passHash = await hashPassword(cleanPass);
        const result = registerUser(cleanNick, passHash);
        if (!result.success) {
          setAuthGeneralError(result.error || 'Ошибка регистрации');
          setAuthLoading(false);
          return;
        }

        // Registration successful
        setCurrentSession(cleanNick);
        setCurrentUser(cleanNick);
        if (!nickname) {
          setNickname(cleanNick);
        }
        setAuthPassword('');
        setActiveScreen('profile');
      }
    } catch (err) {
      console.error('Auth error', err);
      setAuthGeneralError('Произошла непредвиденная ошибка');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearCurrentSession();
    setCurrentUser(null);
    setAuthNickname('');
    setAuthPassword('');
    setAuthGeneralError(null);
    setAuthNickError(null);
    setAuthPassError(null);
    setActiveScreen('home');
  };

  // Initial fallback reviews if Supabase table is empty or while network connects
  const DEFAULT_REVIEWS: ReviewItem[] = useMemo(() => [
    {
      id: 101,
      nickname: 'Maksim_Gromov',
      rating: 5,
      game_name: 'BLACK RUSSIA',
      amount: '2 400',
      review_text: 'Брал 10кк на сервере RED. Перевели банком минут за 7, всё четко без бана и проверок. Рекомендую PayRadise!',
      created_at: '2024-05-24T15:30:00Z',
    },
    {
      id: 102,
      nickname: 'StandoffKing',
      rating: 5,
      game_name: 'STANDOFF 2',
      amount: '1 100',
      review_text: 'Купил 2000 голды, комиссию рынка покрыли полностью. Продавцу респект за оперативность!',
      created_at: '2024-05-23T18:45:00Z',
    },
    {
      id: 103,
      nickname: 'Artem_Voronov',
      rating: 5,
      game_name: 'GTA 5 RP',
      amount: '4 800',
      review_text: 'Всё честно, беру уже третий раз на Downtown. Поддержка в ТГ отвечает моментально.',
      created_at: '2024-05-22T12:15:00Z',
    },
  ], []);

  // Загрузка отзывов: локальные отзывы (гарантированно) + Supabase (по возможности).
  const loadReviews = async () => {
    setReviewsLoading(true);
    setReviewsError(null);

    const localReviews = loadLocalReviews();

    try {
      const { data, error } = await db
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error:', error);
        setReviewsError(error.message);
      }

      const remoteReviews: ReviewItem[] = !error && Array.isArray(data) ? (data as ReviewItem[]) : [];
      const merged = mergeReviews(localReviews, remoteReviews);
      setReviews(merged.length > 0 ? merged : DEFAULT_REVIEWS);
    } catch (err: any) {
      console.warn('Supabase network error:', err);
      setReviewsError(err.message || 'Ошибка подключения к базе');
      setReviews(localReviews.length > 0 ? localReviews : DEFAULT_REVIEWS);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  // Сохранение отзыва: всегда пишем локально (гарантированно), затем пытаемся синхронизировать с Supabase.
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setReviewFormError('Для отправки отзыва необходимо войти в аккаунт');
      return;
    }
    if (!reviewAmount.trim()) {
      setReviewFormError('Укажите сумму оплаты');
      return;
    }
    if (!reviewText.trim()) {
      setReviewFormError('Напишите текст отзыва');
      return;
    }

    setReviewSubmitting(true);
    setReviewFormError(null);
    setReviewFormSuccess(null);

    const cleanAmount = reviewAmount.replace(/\s+/g, '');
    const amountValue = cleanAmount ? cleanAmount : reviewAmount.trim();
    const payload = {
      nickname: currentUser,
      rating: reviewRating,
      game_name: reviewGame,
      amount: amountValue,
      review_text: reviewText.trim(),
    };

    // 1) Guaranteed local persistence, then update the UI right away.
    const savedReview = addLocalReview(payload);
    setReviews((prev) => sortReviews([savedReview, ...prev]));

    // 2) Best-effort cloud sync (non-blocking for the user).
    try {
      const { error } = await db.from('reviews').insert([payload]);
      if (error) {
        console.warn('Supabase insert error (review saved locally):', error);
      }
    } catch (err: any) {
      console.warn('Supabase insert network error (review saved locally):', err);
    }

    setReviewFormSuccess('Отзыв успешно опубликован!');
    setReviewText('');
    setReviewAmount('');
    setShowReviewForm(false);
    setReviewSubmitting(false);
  };

  // Удаление отзыва: сначала удаляем из локального хранилища, затем по возможности из Supabase.
  const handleDeleteReview = async (reviewId: string | number) => {
    if (!confirm('Вы уверены, что хотите удалить этот отзыв?')) return;

    removeLocalReview(reviewId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));

    const isLocalId = typeof reviewId === 'string' && reviewId.startsWith('local_');
    if (!isLocalId) {
      try {
        const { error } = await db.from('reviews').delete().eq('id', reviewId);
        if (error) {
          console.warn('Supabase delete error:', error);
        }
      } catch (err: any) {
        console.warn('Supabase delete network error:', err);
      }
    }
  };

  // Servers filtering
  const filteredServers = useMemo(() => {
    if (!serverSearch.trim()) return currentGame.servers;
    const query = serverSearch.trim().toLowerCase();
    return currentGame.servers.filter((s) => s.toLowerCase().includes(query));
  }, [currentGame.servers, serverSearch]);

  const isMarketDelivery = MARKET_DELIVERY_GAME_KEYS.includes(currentGame.key);
  const deliveryMethodLabel =
    deliveryMethod === 'market' ? 'Через рынок' : deliveryMethod === 'bank' ? 'Банком' : 'Трейдом';

  // Render discounts block
  const renderDiscounts = () => {
    if (currentGame.goldMode) {
      return (
        <div className="discounts">
          <div className="discounts-title">Тарифы и скидки</div>
          <div id="discountsList">
            <div className="discount-row"><span>1 голда</span><span>0.55 ₽</span></div>
            <div className="discount-row"><span>100 голды</span><span>55 ₽</span></div>
            <div className="discount-row"><span>500 голды</span><span>275 ₽</span></div>
            <div className="discount-row"><span>1000 голды</span><span>550 ₽</span></div>
          </div>
        </div>
      );
    }

    const pricing = currentGame.pricing.slice().sort((a, b) => a.min - b.min);
    return (
      <div className="discounts">
        <div className="discounts-title">Тарифы и скидки</div>
        <div id="discountsList">
          {pricing.map((item, index) => {
            const label =
              index === 0
                ? pricing[index + 1]?.min
                  ? `до ${formatAmountValue(pricing[index + 1].min - 0.01)} кк`
                  : 'любой объём'
                : formatTierLabel(item.min, false);

            return (
              <div key={item.min} className="discount-row">
                <span>{label}</span>
                <span>{item.rate} ₽ / 1кк</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Background Ambient Glowing Shapes */}
      <div className="ambient" aria-hidden="true">
        <span className="ambient-shape ambient-shape-one"></span>
        <span className="ambient-shape ambient-shape-two"></span>
        <span className="ambient-shape ambient-shape-three"></span>
      </div>

      <div className="container">
        {/* ========================================================
            SCREEN 1: HOME
        ======================================================== */}
        <div id="home" className={`screen ${activeScreen === 'home' ? 'active' : ''}`}>
          <div className="card home-card">
            <div className="brand-bar">
              <div className="brand">
                <span className="brand-mark" aria-hidden="true">P</span>
                <span className="brand-copy">
                  <strong>PayRadise</strong>
                  <small>Цифровые товары</small>
                </span>
              </div>
              <div className="brand-right">
                <span className="status-pill"><i></i> Онлайн</span>
                {currentUser ? (
                  <button
                    className="user-pill"
                    type="button"
                    onClick={() => setActiveScreen('profile')}
                    aria-label={`Профиль ${currentUser}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>{currentUser}</span>
                  </button>
                ) : (
                  <button
                    className="user-pill"
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthGeneralError(null);
                      setAuthNickError(null);
                      setAuthPassError(null);
                      setActiveScreen('auth');
                    }}
                    aria-label="Войти в аккаунт"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>Войти</span>
                  </button>
                )}
              </div>
            </div>

            <h1 className="title">Игровая валюта.<br />Просто и быстро.</h1>
            <p className="subtitle">
              Выберите игру — всё остальное займёт пару минут.
            </p>

            <div className="content-label">Выберите игру</div>
            <div className="stack">
              {/* Game 1: Black Russia */}
              <button
                className="btn btn-game btn-game-br"
                onClick={() => handleSelectGame('br')}
                aria-label="BLACK RUSSIA - Оформление заказа на игровую валюту"
              >
                <span className="game-left">
                  <span className="game-icon">
                    <img src="/black-russia.png" alt="BLACK RUSSIA" />
                  </span>
                  <span className="game-meta">
                    <span className="game-name">BLACK RUSSIA</span>
                    <span className="game-note">Оформление заказа на игровую валюту</span>
                  </span>
                </span>
                <span className="game-arrow">›</span>
              </button>

              {/* Game 2: Matreshka RP */}
              <button
                className="btn btn-game btn-game-mat"
                onClick={() => handleSelectGame('mat')}
                aria-label="MATRESHKA RP - Оформление заказа на игровую валюту"
              >
                <span className="game-left">
                  <span className="game-icon">
                    <img src="/matreshka.png" alt="MATRESHKA RP" />
                  </span>
                  <span className="game-meta">
                    <span className="game-name">MATRESHKA RP</span>
                    <span className="game-note">Оформление заказа на игровую валюту</span>
                  </span>
                </span>
                <span className="game-arrow">›</span>
              </button>

              {/* Game 3: GTA 5 RP */}
              <button
                className="btn btn-game btn-game-gta"
                onClick={() => handleSelectGame('gta')}
                aria-label="GTA 5 RP - Оформление заказа на игровую валюту"
              >
                <span className="game-left">
                  <span className="game-icon">
                    <img src="/gta5rp.png" alt="GTA 5 RP" />
                  </span>
                  <span className="game-meta">
                    <span className="game-name">GTA 5 RP</span>
                    <span className="game-note">Оформление заказа на игровую валюту</span>
                  </span>
                </span>
                <span className="game-arrow">›</span>
              </button>

              {/* Game 4: Standoff 2 */}
              <button
                className="btn btn-game btn-game-so2"
                onClick={() => handleSelectGame('so2')}
                aria-label="STANDOFF 2 - Оформление заказа на игровую валюту"
              >
                <span className="game-left">
                  <span className="game-icon">
                    <img src="/standoff.png" alt="STANDOFF 2" />
                  </span>
                  <span className="game-meta">
                    <span className="game-name">STANDOFF 2</span>
                    <span className="game-note">Оформление заказа на игровую валюту</span>
                  </span>
                </span>
                <span className="game-arrow">›</span>
              </button>

              {/* Quick Info Grid */}
              <div className="quick-info-grid" aria-label="Информация о заказе">
                <button
                  className="quick-info-tile"
                  type="button"
                  onClick={() => setActiveScreen('orderGuide')}
                >
                  <span className="quick-info-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="quick-info-title">Как заказать</span>
                </button>

                <button
                  className="quick-info-tile"
                  type="button"
                  onClick={() => setActiveScreen('deliveryInfo')}
                >
                  <span className="quick-info-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M4 10h16M8 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="quick-info-title">Доставка</span>
                </button>
              </div>

              {/* Reviews Banner Widget */}
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setActiveScreen('reviews')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', color: '#ffd60a', fontSize: 14 }}>
                    ★ ★ ★ ★ ★
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Отзывы покупателей ({reviews.length})
                  </span>
                </div>
                <span style={{ color: '#58aaff', fontSize: 13, fontWeight: 600 }}>Читать ›</span>
              </button>

              {/* Secondary Actions */}
              <div className="secondary-row">
                <button className="btn btn-secondary" onClick={() => openExternal(SUPPORT_URL)}>
                  Поддержка
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveScreen('reviews')}>
                  Отзывы
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveScreen('info')}>
                  О сервисе
                </button>
              </div>
            </div>

            <div className="footer">
              Сервис не связан с правообладателями игровых проектов. Названия и логотипы используются только для обозначения игр.
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 2: ACTIONS
        ======================================================== */}
        <div id="actions" className={`screen ${activeScreen === 'actions' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Выбор действия</div>
                <h2 id="actionsTitle">{currentGame.name}</h2>
              </div>
            </div>

            <div className="badge-row">
              <div className="badge">
                Игра: <strong id="actionsGameBadge">{currentGame.name}</strong>
              </div>
            </div>

            <div className="stack">
              <button
                className={`btn center ${currentGame.goldMode ? 'btn-gold' : 'btn-primary'}`}
                onClick={handleOpenBuyFlow}
              >
                {currentGame.actionBuyText}
              </button>
              <button
                className="btn btn-sell"
                onClick={() => openExternal(currentGame.sellUrl)}
              >
                {currentGame.actionSellText}
              </button>
            </div>

            <div className="footer">
              Покупка открывает оформление заказа.
              Продажа оформляется как заявка менеджеру в Telegram.
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 3: SERVERS
        ======================================================== */}
        <div id="servers" className={`screen ${activeScreen === 'servers' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('actions')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">{currentGame.buyTitle}</div>
                <h2>{currentGame.autoSelectServer ? 'Подтверждение товара' : 'Выбор сервера'}</h2>
              </div>
            </div>

            <div className="badge-row">
              <div className="badge">
                Игра: <strong id="serversGameBadge">{currentGame.name}</strong>
              </div>
            </div>

            <input
              id="serverSearch"
              className="search-box"
              placeholder="Поиск сервера..."
              value={serverSearch}
              onChange={(e) => setServerSearch(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
            />
            <div id="serversContainer" className="servers-wrapper">
              {filteredServers.length === 0 ? (
                <div className="empty-state">Ничего не найдено по этому запросу.</div>
              ) : (
                filteredServers.map((name) => (
                  <button
                    key={name}
                    className="btn server-btn"
                    onClick={() => handleSelectServer(name)}
                  >
                    <span>{name}</span>
                    <small>Нажми, чтобы перейти к оформлению</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 4: BUY FORM
        ======================================================== */}
        <div id="buy" className={`screen ${activeScreen === 'buy' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button
                className="back-btn"
                onClick={() => {
                  if (currentGame.autoSelectServer) {
                    setActiveScreen('actions');
                  } else {
                    setActiveScreen('servers');
                  }
                }}
                aria-label="Назад"
              >
                ←
              </button>
              <div>
                <div className="section-title">Оформление заказа</div>
                <h2>{currentGame.buyTitle}</h2>
              </div>
            </div>

            <div className="selected-box">
              <div className="selected-row">
                <span>Игра</span>
                <strong id="buyGameName">{currentGame.name}</strong>
              </div>
              <div className="selected-row">
                <span>{currentGame.autoSelectServer ? 'Товар' : 'Сервер'}</span>
                <strong id="buyServerName">{selectedServer || '—'}</strong>
              </div>
              <div className="selected-row">
                <span>Получение</span>
                <strong id="buyDeliveryMethodText">{deliveryMethodLabel}</strong>
              </div>
            </div>

            <input
              id="nickname"
              className="field"
              placeholder="Введите игровой ник"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              enterKeyHint="done"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
            />

            <div className="delivery-box">
              <div className="section-title">Способ получения</div>
              {isMarketDelivery ? (
                <>
                  <div className="delivery-toggle">
                    <button type="button" className="delivery-option active">
                      Через рынок (продажа скина)
                    </button>
                  </div>
                  <div id="deliveryHint" className="delivery-hint">
                    Голда в Standoff 2 выдаётся через Торговую площадку. После оплаты вы выставляете в лобби любой скин на продажу за сумму заказа (минимальная цена лота — 0.03 голды), а продавец выкупает его. Голда поступит на ваш аккаунт за вычетом комиссии рынка.
                  </div>
                </>
              ) : (
                <>
                  <div className="delivery-toggle">
                    <button
                      type="button"
                      id="deliveryTradeBtn"
                      className={`delivery-option ${deliveryMethod === 'trade' ? 'active' : ''}`}
                      onClick={() => {
                        setDeliveryMethod('trade');
                        setBankAccount('');
                      }}
                    >
                      Получить трейдом
                    </button>
                    <button
                      type="button"
                      id="deliveryBankBtn"
                      className={`delivery-option ${deliveryMethod === 'bank' ? 'active' : ''}`}
                      onClick={() => setDeliveryMethod('bank')}
                    >
                      Получить банком
                    </button>
                  </div>

                  <input
                    id="bankAccount"
                    className={`field delivery-extra ${deliveryMethod === 'bank' ? 'show' : ''}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="Номер банковского счёта"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value.replace(/[^\d]/g, ''))}
                    enterKeyHint="done"
                    autoComplete="off"
                  />

                  <div id="deliveryHint" className="delivery-hint">
                    {deliveryMethod === 'bank'
                      ? 'Для выдачи банком укажи номер игрового банковского счёта.'
                      : 'Выдача будет отмечена как трейд.'}
                  </div>
                </>
              )}
            </div>

            <input
              id="promoInput"
              className="field"
              placeholder="Промокод (необязательно)"
              value={promoCode}
              onChange={(e) => handlePromoChange(e.target.value)}
              enterKeyHint="done"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
            />
            <div
              id="promoStatus"
              className={`helper-text ${promoStatus?.type || ''}`}
            >
              {promoStatus?.text || ''}
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label htmlFor="virtualAmount">{currentGame.amountLabel}</label>
                <input
                  id="virtualAmount"
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={currentGame.amountPlaceholder}
                  value={virtualAmountStr}
                  onChange={(e) => handleVirtualAmountChange(e.target.value)}
                  enterKeyHint="done"
                  autoComplete="off"
                />
              </div>
              <div className="input-group">
                <label htmlFor="moneyAmount">Сумма оплаты (₽)</label>
                <input
                  id="moneyAmount"
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Например, 450"
                  value={moneyAmountStr}
                  onChange={(e) => handleMoneyAmountChange(e.target.value)}
                  enterKeyHint="done"
                  autoComplete="off"
                />
              </div>
            </div>

            {renderDiscounts()}

            <div className="summary-box">
              <div className="summary-row">
                <span>Курс</span>
                <strong id="rateText">
                  {calculation.virtualAmount > 0
                    ? `${calculation.rate} ${currentGame.rateSuffix}`
                    : '—'}
                </strong>
              </div>
              <div className="summary-row">
                <span>Сумма без промокода</span>
                <strong id="subtotalText">{formatMoney(calculation.subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Скидка по промокоду</span>
                <strong id="promoDiscountText">{formatMoney(calculation.promoDiscount)}</strong>
              </div>
              <div className="summary-row total">
                <span>К оплате</span>
                <strong id="totalText">{formatMoney(calculation.total)}</strong>
              </div>
            </div>

            <button
              className={`btn center ${currentGame.goldMode ? 'btn-gold' : 'btn-primary'}`}
              onClick={() => setShowMaintenanceModal(true)}
            >
              {currentGame.buySubmitText}
            </button>

            <div className="footer">
              {currentGame.goldMode
                ? 'Можно ввести количество голды или сумму в рублях — второе поле пересчитается автоматически.'
                : 'Можно ввести либо количество виртов, либо сумму в рублях — второе поле пересчитается автоматически.'}
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 5: HOW TO ORDER GUIDE
        ======================================================== */}
        <div id="orderGuide" className={`screen ${activeScreen === 'orderGuide' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Информация</div>
                <h2>Как проходит заказ</h2>
              </div>
            </div>

            <div className="info-box">
              <div className="info-box-title">Порядок оформления</div>
              <div className="info-box-text">
                Выберите игру, сервер, количество игровой валюты и способ получения. После оформления заказ передаётся в обработку, а данные проверяются менеджером.
              </div>
            </div>

            <div className="info-box">
              <div className="info-box-title">Что нужно указать</div>
              <div className="info-box-text">
                Для оформления потребуются игровой ник, выбранный сервер, объём заказа и способ получения: трейдом или через игровой банк, если такой способ доступен.
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 6: DELIVERY INFO
        ======================================================== */}
        <div id="deliveryInfo" className={`screen ${activeScreen === 'deliveryInfo' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Информация</div>
                <h2>Оплата и доставка</h2>
              </div>
            </div>

            <div className="info-box">
              <div className="info-box-title">Цифровой товар</div>
              <div className="info-box-text">
                Товар является цифровым. Физическая доставка не осуществляется. Передача выполняется внутри выбранной игры на указанном сервере.
              </div>
            </div>

            <div className="info-box">
              <div className="info-box-title">Способ получения</div>
              <div className="info-box-text">
                Доступные способы получения: трейдом или через игровой банк, если такой способ предусмотрен для выбранной игры и сервера.
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 7: ABOUT SERVICE
        ======================================================== */}
        <div id="info" className={`screen ${activeScreen === 'info' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">О сервисе</div>
                <h2>Информация</h2>
              </div>
            </div>

            <div className="info-box">
              <div className="info-box-title">О сервисе</div>
              <div className="info-box-text">
                Через mini-app можно оформить заказ на цифровые игровые товары и услуги.
                Подробные условия использования сервиса размещены в разделах ниже.
              </div>
            </div>

            <div className="stack">
              <button className="btn btn-secondary" onClick={() => setActiveScreen('privacy')}>
                Политика конфиденциальности
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveScreen('agreement')}>
                Пользовательское соглашение
              </button>
              <button className="btn btn-secondary" onClick={() => openExternal(SUPPORT_URL)}>
                Поддержка
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 8: PRIVACY POLICY
        ======================================================== */}
        <div id="privacy" className={`screen ${activeScreen === 'privacy' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('info')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">О сервисе</div>
                <h2>Политика конфиденциальности</h2>
              </div>
            </div>

            <div className="legal-text">
{`Политика конфиденциальности

1. Общие положения
Настоящая политика конфиденциальности определяет порядок обработки информации пользователей сервиса t.me/PayRadise_bot и mini-app.

2. Какие данные могут использоваться
- Telegram username и технические данные Telegram;
- игровой ник;
- выбранная игра, сервер, объём заказа;
- промокод;
- способ получения заказа;
- номер игрового банковского счёта, если выбран способ получения банком.

3. Для чего используются данные
- оформление и обработка заказа;
- связь с пользователем;
- предоставление поддержки;
- улучшение работы сервиса;
- предотвращение злоупотреблений.

4. Передача третьим лицам
Данные могут передаваться только в объёме, необходимом для обработки платежей, исполнения требований законодательства или защиты сервиса.

5. Контакты
По вопросам обработки данных: @PayRadise`}
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 9: USER AGREEMENT
        ======================================================== */}
        <div id="agreement" className={`screen ${activeScreen === 'agreement' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('info')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">О сервисе</div>
                <h2>Пользовательское соглашение</h2>
              </div>
            </div>

            <div className="legal-text">
{`Пользовательское соглашение

1. Общие положения
Сервис t.me/PayRadise_bot и mini-app предоставляет возможность оформления заказов на цифровые игровые товары и услуги.

2. Обязанности пользователя
Пользователь обязуется:
- указывать корректные данные при оформлении заказа;
- проверять игру, сервер, ник и параметры заказа;
- не использовать сервис в противоправных целях;
- не нарушать работу сервиса.

3. Порядок оформления заказа
Пользователь самостоятельно оформляет заказ через интерфейс mini-app. Заказ передаётся в обработку после подтверждения и/или оплаты.

4. Ответственность
Сервис не несёт ответственности за ошибки пользователя в нике, сервере, способе получения или иных параметрах заказа.

5. Ограничение ответственности
Сервис не отвечает за технические сбои Telegram, платёжных систем, игровых платформ и иных внешних сервисов.

6. Поддержка
По всем вопросам: @PayRadiseSupport`}
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 10: AUTH (LOGIN & REGISTRATION)
        ======================================================== */}
        <div id="auth" className={`screen ${activeScreen === 'auth' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Личный кабинет</div>
                <h2>{authTab === 'login' ? 'Вход' : 'Регистрация'}</h2>
              </div>
            </div>

            {/* Auth Mode Tabs */}
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  setAuthGeneralError(null);
                  setAuthNickError(null);
                  setAuthPassError(null);
                }}
                role="tab"
                aria-selected={authTab === 'login'}
              >
                Вход
              </button>
              <button
                type="button"
                className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  setAuthGeneralError(null);
                  setAuthNickError(null);
                  setAuthPassError(null);
                }}
                role="tab"
                aria-selected={authTab === 'register'}
              >
                Регистрация
              </button>
            </div>

            {authGeneralError && (
              <div className="field-error" style={{ marginBottom: 14 }}>
                {authGeneralError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} noValidate>
              <div className="input-group">
                <label htmlFor="authNickname">Никнейм</label>
                <input
                  id="authNickname"
                  className="field"
                  type="text"
                  placeholder="Ваш никнейм"
                  value={authNickname}
                  onChange={(e) => {
                    setAuthNickname(e.target.value);
                    if (authNickError) setAuthNickError(null);
                    if (authGeneralError) setAuthGeneralError(null);
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                />
                {authNickError && <div className="field-error">{authNickError}</div>}
              </div>

              <div className="input-group">
                <label htmlFor="authPassword">Пароль</label>
                <input
                  id="authPassword"
                  className="field"
                  type="password"
                  placeholder="Введите пароль"
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    if (authPassError) setAuthPassError(null);
                    if (authGeneralError) setAuthGeneralError(null);
                  }}
                  autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                />
                {authPassError && <div className="field-error">{authPassError}</div>}
                {authTab === 'register' && (
                  <div className="auth-requirements">
                    <div className="auth-requirements-title">Требования к паролю:</div>
                    <div className="auth-req-grid">
                      <div className={`auth-req-item ${authPassword.length >= 8 ? 'met' : ''}`}>
                        <span className="auth-req-dot" />
                        <span>От 8 символов</span>
                      </div>
                      <div
                        className={`auth-req-item ${
                          /[a-zа-яё]/.test(authPassword) && /[A-ZА-ЯЁ]/.test(authPassword) ? 'met' : ''
                        }`}
                      >
                        <span className="auth-req-dot" />
                        <span>A-z буквы</span>
                      </div>
                      <div className={`auth-req-item ${/[0-9]/.test(authPassword) ? 'met' : ''}`}>
                        <span className="auth-req-dot" />
                        <span>Цифры 0-9</span>
                      </div>
                      <div
                        className={`auth-req-item ${
                          /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(authPassword) ? 'met' : ''
                        }`}
                      >
                        <span className="auth-req-dot" />
                        <span>Спецсимволы</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary center"
                disabled={authLoading}
                style={{ marginTop: 4 }}
              >
                {authLoading
                  ? 'Подождите...'
                  : authTab === 'login'
                  ? 'ВОЙТИ'
                  : 'ЗАРЕГИСТРИРОВАТЬСЯ'}
              </button>
            </form>

            <div className="auth-switch">
              {authTab === 'login' ? (
                <>
                  <span>Нет аккаунта?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('register');
                      setAuthGeneralError(null);
                      setAuthNickError(null);
                      setAuthPassError(null);
                    }}
                  >
                    Зарегистрироваться
                  </button>
                </>
              ) : (
                <>
                  <span>Уже есть аккаунт?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthGeneralError(null);
                      setAuthNickError(null);
                      setAuthPassError(null);
                    }}
                  >
                    Войти
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 11: USER PROFILE
        ======================================================== */}
        <div id="profile" className={`screen ${activeScreen === 'profile' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Личный кабинет</div>
                <h2>Профиль</h2>
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-avatar" aria-hidden="true">
                {(currentUser || 'P').charAt(0).toUpperCase()}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {currentUser}
              </h3>
              <span className="badge" style={{ margin: '0 0 12px' }}>
                Статус: <strong>Авторизован</strong>
              </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45, maxWidth: 300 }}>
                Данные аккаунта сохранены на этом устройстве. Вы можете продолжить оформление заказов под этим никнеймом.
              </p>
            </div>

            <div className="stack">
              <button
                type="button"
                className="btn btn-primary center"
                onClick={() => setActiveScreen('home')}
              >
                К ВЫБОРУ ИГР
              </button>
              <button
                type="button"
                className="btn btn-secondary center"
                onClick={() => setActiveScreen('reviews')}
              >
                ОТЗЫВЫ О СЕРВИСЕ
              </button>
              <button
                type="button"
                className="btn btn-danger center"
                onClick={handleLogout}
              >
                ВЫЙТИ ИЗ АККАУНТА
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            SCREEN 12: REVIEWS (Supabase Real Database)
        ======================================================== */}
        <div id="reviews" className={`screen ${activeScreen === 'reviews' ? 'active' : ''}`}>
          <div className="card">
            <div className="topbar">
              <button className="back-btn" onClick={() => setActiveScreen('home')} aria-label="Назад">
                ←
              </button>
              <div>
                <div className="section-title">Честные отзывы</div>
                <h2>Отзывы покупателей</h2>
              </div>
            </div>

            {/* Summary Bar */}
            <div className="reviews-summary-bar">
              <div className="reviews-stat-left">
                <div className="reviews-stat-score">
                  {reviews.length > 0
                    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)
                    : '5.0'}
                </div>
                <div>
                  <div className="review-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} className="review-star" viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <div className="reviews-stat-count">
                    {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}
                onClick={() => {
                  if (!currentUser) {
                    setAuthTab('login');
                    setActiveScreen('auth');
                  } else {
                    setShowReviewForm((prev) => !prev);
                  }
                }}
              >
                {showReviewForm ? 'Закрыть' : '+ Оставить отзыв'}
              </button>
            </div>

            {/* Admin mode / user status banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--stroke-soft)', borderRadius: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>
                {currentUser ? (
                  <>Вы вошли как <strong style={{ color: '#58aaff' }}>{currentUser}</strong></>
                ) : (
                  <>Войдите в профиль, чтобы опубликовать отзыв</>
                )}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={adminMode}
                  onChange={(e) => setAdminMode(e.target.checked)}
                  style={{ accentColor: '#0a84ff' }}
                />
                <span>Админка (удаление)</span>
              </label>
            </div>

            {/* Review Submission Form */}
            {showReviewForm && (
              <form className="review-form-box" onSubmit={handleAddReview}>
                <div className="review-form-title">
                  <span>Новый отзыв</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Автор: <strong style={{ color: '#58aaff' }}>{currentUser}</strong>
                  </span>
                </div>

                {reviewFormError && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    {reviewFormError}
                  </div>
                )}
                {reviewFormSuccess && (
                  <div className="form-success" style={{ marginBottom: 12 }}>
                    {reviewFormSuccess}
                  </div>
                )}

                <div className="field">
                  <label>Оценка в звёздах (рейтинг: {reviewRating} из 5)</label>
                  <div className="star-rating-select">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="star-rating-btn"
                        onClick={() => setReviewRating(star)}
                        aria-label={`Оценка ${star}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          style={{
                            fill: star <= reviewRating ? '#ffd60a' : 'rgba(255, 255, 255, 0.15)',
                            color: star <= reviewRating ? '#ffd60a' : 'rgba(255, 255, 255, 0.25)',
                          }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    ))}
                    <span className="star-rating-label">{reviewRating} из 5</span>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="reviewGame">Игра / проект</label>
                  <select
                    id="reviewGame"
                    className="input select"
                    value={reviewGame}
                    onChange={(e) => setReviewGame(e.target.value)}
                  >
                    <option value="BLACK RUSSIA">BLACK RUSSIA</option>
                    <option value="MATRESHKA RP">MATRESHKA RP</option>
                    <option value="GTA 5 RP">GTA 5 RP</option>
                    <option value="STANDOFF 2">STANDOFF 2</option>
                    <option value="Другой заказ">Другой заказ</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="reviewAmount">Сумма оплаты (в руб.)</label>
                  <input
                    id="reviewAmount"
                    type="text"
                    className="input"
                    placeholder="Например: 1500"
                    value={reviewAmount}
                    onChange={(e) => setReviewAmount(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="reviewText">Текст отзыва</label>
                  <textarea
                    id="reviewText"
                    className="input textarea"
                    rows={3}
                    placeholder="Напишите честный отзыв о качестве сервиса..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    style={{ minHeight: 80, resize: 'vertical' }}
                  />
                </div>

                <div className="secondary-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowReviewForm(false)}
                    disabled={reviewSubmitting}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? 'Отправка в базу...' : 'Отправить'}
                  </button>
                </div>
              </form>
            )}

            {/* Reviews Feed List */}
            {reviewsLoading && reviews.length === 0 ? (
              <div className="reviews-empty-state">
                <div style={{ color: '#58aaff', marginBottom: 6 }}>Загрузка отзывов из базы...</div>
                <p>Подключаемся к Supabase</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="reviews-empty-state">
                <div>Пока нет отзывов</div>
                <p>Будьте первым, кто оставит отзыв о покупке в PayRadise!</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map((item, idx) => {
                  const rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
                  const canDelete = adminMode || currentUser?.toLowerCase() === 'admin' || (currentUser && currentUser === item.nickname);

                  return (
                    <article key={item.id ?? idx} className="review-card">
                      <div className="review-header">
                        <div className="review-author-info">
                          <div className="review-avatar" aria-hidden="true">
                            {(item.nickname || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="review-author-name">{item.nickname}</div>
                            <div className="review-created-at">
                              {formatReviewDate(item.created_at || '')}
                            </div>
                          </div>
                        </div>

                        {/* Rating in 5 stars */}
                        <div className="review-stars" aria-label={`Оценка: ${rating} из 5`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`review-star ${star <= rating ? '' : 'empty'}`}
                              viewBox="0 0 24 24"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                      </div>

                      {/* Game & Amount Badge with 'руб.' */}
                      <div className="review-meta-pill">
                        <span className="review-game-tag">{item.game_name}</span>
                        <span>•</span>
                        <span className="review-amount-tag">{item.amount} руб.</span>
                      </div>

                      {/* Review text */}
                      <p className="review-content">{item.review_text}</p>

                      {/* Delete action in admin / author view */}
                      {canDelete && (
                        <div className="review-card-footer">
                          <button
                            type="button"
                            className="review-delete-btn"
                            onClick={() => handleDeleteReview(item.id!)}
                            title="Удалить отзыв из базы данных"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span>Удалить отзыв</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="stack" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary center"
                onClick={() => setActiveScreen('home')}
              >
                НА ГЛАВНУЮ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MAINTENANCE / ORDER NOTICE MODAL
      ======================================================== */}
      <div
        id="maintenanceModal"
        className={`notice-modal ${showMaintenanceModal ? 'show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMaintenanceModal}
        hidden={!showMaintenanceModal}
        aria-labelledby="maintenanceTitle"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowMaintenanceModal(false);
          }
        }}
      >
        <div className="notice-sheet">
          <div className="notice-icon" aria-hidden="true">i</div>
          <h2 id="maintenanceTitle">Сервис временно на обновлении</h2>
          <p>
            Купить игровую валюту сейчас можно через личные сообщения в Telegram.
          </p>
          <a
            className="notice-link"
            href="https://t.me/PayRadise"
            onClick={(e) => {
              e.preventDefault();
              setShowMaintenanceModal(false);
              openExternal('https://t.me/PayRadise');
            }}
          >
            t.me/PayRadise
          </a>
          <div className="notice-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setShowMaintenanceModal(false);
                openExternal('https://t.me/PayRadise');
              }}
            >
              Написать в Telegram
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowMaintenanceModal(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
