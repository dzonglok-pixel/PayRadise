/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReviewItem } from './supabase.ts';

const REVIEWS_STORAGE_KEY = 'payradise_reviews';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/**
 * Reads user-submitted reviews from localStorage. These are the guaranteed
 * local copies of every review the user published, so they never get lost
 * even if the cloud database is unavailable.
 */
export function loadLocalReviews(): ReviewItem[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReviewItem[]) : [];
  } catch (err) {
    console.error('Failed to read local reviews', err);
    return [];
  }
}

/**
 * Persists the full list of local reviews to localStorage.
 */
export function saveLocalReviews(reviews: ReviewItem[]): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch (err) {
    console.error('Failed to save local reviews', err);
  }
}

export interface LocalReviewInput {
  nickname: string;
  rating: number;
  game_name: string;
  amount: number | string;
  review_text: string;
}

/**
 * Appends a new review to localStorage and returns the complete, saved review
 * (with a generated id and created_at timestamp) so the UI can render it
 * immediately.
 */
export function addLocalReview(input: LocalReviewInput): ReviewItem {
  const review: ReviewItem = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nickname: input.nickname,
    rating: input.rating,
    game_name: input.game_name,
    amount: input.amount,
    review_text: input.review_text,
    created_at: new Date().toISOString(),
  };

  const existing = loadLocalReviews();
  saveLocalReviews([review, ...existing]);
  return review;
}

/**
 * Removes a review from localStorage and returns the remaining list.
 */
export function removeLocalReview(id: string | number): ReviewItem[] {
  const existing = loadLocalReviews();
  const remaining = existing.filter((review) => review.id !== id);
  saveLocalReviews(remaining);
  return remaining;
}

/**
 * Sorts reviews by created_at descending (newest first), tolerating missing
 * or invalid dates.
 */
export function sortReviews(list: ReviewItem[]): ReviewItem[] {
  return list.slice().sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime() || 0;
    const tb = new Date(b.created_at || 0).getTime() || 0;
    return tb - ta;
  });
}

/**
 * Merges cloud (Supabase) reviews with local reviews, de-duplicating by id and
 * keeping local user-submitted entries that have not yet synced to the cloud.
 */
export function mergeReviews(local: ReviewItem[], remote: ReviewItem[]): ReviewItem[] {
  const seen = new Set<string | number>();
  const merged: ReviewItem[] = [];

  const pushUnique = (review: ReviewItem) => {
    if (review.id !== undefined && review.id !== null) {
      if (seen.has(review.id)) return;
      seen.add(review.id);
    }
    merged.push(review);
  };

  // Cloud copy is authoritative, so it comes first.
  for (const review of remote) pushUnique(review);
  // Then local submissions that are not yet on the cloud.
  for (const review of local) pushUnique(review);

  return sortReviews(merged);
}
