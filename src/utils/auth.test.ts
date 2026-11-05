import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePassword,
  validateNickname,
  hashPassword,
} from './auth.ts';

test('validateNickname rejects empty and invalid nicknames', () => {
  assert.equal(validateNickname('').valid, false);
  assert.equal(validateNickname('ab').valid, false); // < 3
  assert.equal(validateNickname('super_valid_user').valid, true);
  assert.equal(validateNickname('Игрок123').valid, true);
  assert.equal(validateNickname('bad user name!').valid, false);
});

test('validatePassword enforces strong requirements', () => {
  // Empty
  assert.equal(validatePassword('').valid, false);
  // Too short (< 8)
  assert.equal(validatePassword('Ab1!').valid, false);
  // Missing lowercase
  assert.equal(validatePassword('ABCDEF1!').valid, false);
  // Missing uppercase
  assert.equal(validatePassword('abcdef1!').valid, false);
  // Missing digit
  assert.equal(validatePassword('Abcdefgh!').valid, false);
  // Missing special symbol
  assert.equal(validatePassword('Abcdefg1').valid, false);
  // Valid complex passwords
  assert.equal(validatePassword('Password123!').valid, true);
  assert.equal(validatePassword('МойПароль123@').valid, true);
});

test('hashPassword produces deterministic non-empty hash', async () => {
  const hash1 = await hashPassword('Secret123!');
  const hash2 = await hashPassword('Secret123!');
  const hash3 = await hashPassword('OtherPass456?');

  assert.ok(hash1.length >= 16);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});
