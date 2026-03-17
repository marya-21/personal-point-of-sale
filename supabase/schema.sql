-- =============================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================

-- 1. Tabel Produk
CREATE TABLE IF NOT EXISTS products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode    TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  price_sell INTEGER NOT NULL DEFAULT 0,
  stock      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Transaksi (Header)
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_price   INTEGER NOT NULL,
  cash_amount   INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel Item Transaksi (Detail)
CREATE TABLE IF NOT EXISTS transaction_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id),
  qty            INTEGER NOT NULL,
  subtotal       INTEGER NOT NULL
);

-- 4. Function untuk mengurangi stok secara atomik
-- Ini mencegah race condition jika 2 kasir scan produk bersamaan
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = stock - amount
  WHERE id = product_id AND stock >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak cukup untuk produk %', product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Enable Row Level Security (opsional, aktifkan jika pakai Auth)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- 6. Contoh data produk untuk testing
INSERT INTO products (barcode, name, price_sell, stock) VALUES
  ('8991234567890', 'Aqua 600ml', 3000, 100),
  ('8997002100104', 'Indomie Goreng', 3500, 200),
  ('8999999100110', 'Teh Botol Sosro 350ml', 4000, 150)
ON CONFLICT (barcode) DO NOTHING;
