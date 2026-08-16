-- Идемпотентность платежей ЮKassa + защита от двойного начисления
-- Выполнить в Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS transactions_yookassa_payment_id_uidx
  ON public.transactions (yookassa_payment_id)
  WHERE yookassa_payment_id IS NOT NULL AND yookassa_payment_id <> '';
