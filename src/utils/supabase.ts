/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://kbjfzrgbyuomwrfvmlok.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_S9sR_KMoOFqqyDdYNsgYHQ_6f9Ip2Ym';

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string) => any;
    };
  }
}

// User specified: const db = supabase.createClient('https://kbjfzrgbyuomwrfvmlok.supabase.co', 'sb_publishable_S9sR_KMoOFqqyDdYNsgYHQ_6f9Ip2Ym');
export const db = (typeof window !== 'undefined' && window.supabase?.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface ReviewItem {
  id?: string | number;
  nickname: string;
  rating: number;
  game_name: string;
  amount: number | string;
  review_text: string;
  created_at?: string;
}
