/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserRecord {
  nickname: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_STORAGE_KEY = 'payradise_users';
const SESSION_STORAGE_KEY = 'payradise_current_user';

/**
 * Validates password strength:
 * - At least 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Введите пароль' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Пароль должен быть не короче 8 символов' };
  }
  if (!/[a-zа-яё]/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать строчные буквы' };
  }
  if (!/[A-ZА-ЯЁ]/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать заглавные буквы' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать хотя бы одну цифру' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать хотя бы один спецсимвол (!@#$%^&*...)' };
  }
  return { valid: true };
}

/**
 * Validates nickname:
 * - Must not be empty
 * - 3 to 24 characters
 * - Letters, digits, underscores, dashes
 */
export function validateNickname(nickname: string): { valid: boolean; message?: string } {
  const trimmed = (nickname || '').trim();
  if (!trimmed) {
    return { valid: false, message: 'Введите никнейм' };
  }
  if (trimmed.length < 3) {
    return { valid: false, message: 'Никнейм должен быть не короче 3 символов' };
  }
  if (trimmed.length > 24) {
    return { valid: false, message: 'Никнейм не должен превышать 24 символа' };
  }
  if (!/^[a-zA-Z0-9а-яА-ЯёЁ_\-]+$/.test(trimmed)) {
    return { valid: false, message: 'Никнейм может содержать только буквы, цифры, дефис и _' };
  }
  return { valid: true };
}

/**
 * Computes a SHA-256 hash string for the password with a static app salt.
 * Uses Web Crypto API when available, with a fallback for test environments.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = 'payradise_salt_v1_';
  const data = new TextEncoder().encode(salt + password);

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash for environments without Web Crypto
  let hash = 0;
  const str = salt + password;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Reads users list from localStorage.
 */
export function getStoredUsers(): UserRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserRecord[];
  } catch (err) {
    console.error('Failed to read users from localStorage', err);
    return [];
  }
}

/**
 * Saves users list to localStorage.
 */
export function saveStoredUsers(users: UserRecord[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users to localStorage', err);
  }
}

/**
 * Finds a user by nickname (case-insensitive).
 */
export function findUserByNickname(nickname: string): UserRecord | undefined {
  const users = getStoredUsers();
  const lower = nickname.trim().toLowerCase();
  return users.find((u) => u.nickname.toLowerCase() === lower);
}

/**
 * Registers a new user.
 */
export function registerUser(nickname: string, passwordHash: string): { success: boolean; error?: string } {
  const cleanNick = nickname.trim();
  if (findUserByNickname(cleanNick)) {
    return { success: false, error: 'Пользователь с таким никнеймом уже зарегистрирован' };
  }

  const users = getStoredUsers();
  users.push({
    nickname: cleanNick,
    passwordHash,
    createdAt: new Date().toISOString(),
  });
  saveStoredUsers(users);
  return { success: true };
}

/**
 * Gets currently logged in user nickname from localStorage.
 */
export function getCurrentSession(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets currently logged in user.
 */
export function setCurrentSession(nickname: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, nickname.trim());
  } catch (err) {
    console.error('Failed to save session', err);
  }
}

/**
 * Clears user session (logout).
 */
export function clearCurrentSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear session', err);
  }
}
