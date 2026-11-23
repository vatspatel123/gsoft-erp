-- Same as EXCHANGE_ORIGINAL_SALESMAN.sql, for a PC running the shop database locally.
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS original_salesman_id UUID;
CREATE INDEX IF NOT EXISTS idx_exchange_bills_original_salesman_id ON public.exchange_bills(original_salesman_id);
