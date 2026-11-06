-- Таблица отзывов PayRadise (Supabase)
-- Выполните этот скрипт в Supabase SQL Editor, чтобы облачная синхронизация отзывов заработала.
-- Даже без этой таблицы отзывы сохраняются локально на устройстве пользователя.

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  nickname text not null,
  rating integer not null default 5,
  game_name text not null,
  amount text,
  review_text text not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Публичное чтение (список отзывов)
drop policy if exists "public_read_reviews" on public.reviews;
create policy "public_read_reviews"
  on public.reviews for select
  using (true);

-- Публичная вставка (оставить отзыв)
drop policy if exists "public_insert_reviews" on public.reviews;
create policy "public_insert_reviews"
  on public.reviews for insert
  with check (true);

-- Удаление отзыва (админка/автор)
drop policy if exists "public_delete_reviews" on public.reviews;
create policy "public_delete_reviews"
  on public.reviews for delete
  using (true);
