-- =============================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================

-- 0. Extension (wajib untuk password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- AUTH TABLES
-- =============================================

-- 0a. Tabel Roles
CREATE TABLE IF NOT EXISTS roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 0b. Tabel Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  resource    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 0c. Tabel Junction Role <-> Permission
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 0d. Tabel Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role_id       UUID REFERENCES roles(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SEED DATA: Roles
-- =============================================
INSERT INTO roles (name) VALUES
  ('admin'),
  ('kasir')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SEED DATA: Permissions
-- =============================================
INSERT INTO permissions (name, description, resource) VALUES
  ('create_transaction',    'Buat transaksi baru',           'transactions'),
  ('view_own_transactions', 'Lihat transaksi sendiri',        'transactions'),
  ('view_all_transactions', 'Lihat semua transaksi',          'transactions'),
  ('void_transaction',      'Void transaksi',                 'transactions'),
  ('delete_transaction',    'Hapus transaksi',                'transactions'),
  ('view_products',         'Lihat daftar produk',            'products'),
  ('create_product',        'Tambah produk baru',             'products'),
  ('edit_product',          'Edit detail dan harga produk',   'products'),
  ('edit_product_price',    'Edit harga produk',              'products'),
  ('delete_product',        'Hapus produk',                   'products'),
  ('view_stock',            'Lihat level stok',               'stock'),
  ('adjust_stock',          'Adjust stok manual',             'stock'),
  ('view_users',            'Lihat daftar user',              'users'),
  ('create_user',           'Tambah user baru',               'users'),
  ('edit_user',             'Edit data user',                 'users'),
  ('delete_user',           'Hapus user',                     'users'),
  ('manage_roles',          'Kelola role dan permission',     'roles'),
  ('view_audit_log',        'Lihat audit log',                'audit')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SEED DATA: Role Permissions
-- =============================================

-- Admin: semua permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Kasir: hanya transaksi + lihat produk + lihat stok
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'kasir'
  AND p.name IN (
    'create_transaction',
    'view_own_transactions',
    'view_products',
    'view_stock'
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- STORED FUNCTION: verify_login
-- =============================================
CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  user_id     UUID,
  email       TEXT,
  full_name   TEXT,
  role_name   TEXT,
  permissions TEXT[]
) AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM users
  WHERE users.email = p_email AND is_active = true;

  IF NOT FOUND THEN RETURN; END IF;

  IF crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_user.id,
    v_user.email,
    v_user.full_name,
    r.name AS role_name,
    ARRAY(
      SELECT p.name::TEXT
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = v_user.role_id
    ) AS permissions
  FROM roles r
  WHERE r.id = v_user.role_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CONTOH: Membuat user admin
-- =============================================
-- INSERT INTO users (email, password_hash, full_name, role_id)
-- VALUES (
--   'admin@toko.com',
--   crypt('password123', gen_salt('bf')),
--   'Admin Toko',
--   (SELECT id FROM roles WHERE name = 'admin')
-- );

-- =============================================
-- BUSINESS TABLES
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
  cashier_id    UUID,  -- referensi ke tabel users (nullable untuk data lama)
  total_price   INTEGER NOT NULL,
  cash_amount   INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Jika tabel transactions sudah ada sebelumnya, jalankan ini untuk menambah kolom:
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashier_id UUID;

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

-- 4b. Function untuk restock (menambah stok)
CREATE OR REPLACE FUNCTION restock_product(
  p_id UUID,
  p_user_id TEXT,
  p_qty_input NUMERIC,
  p_stock_unit_name TEXT,
  p_total_harga_beli NUMERIC DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_unit_conversion NUMERIC;
  v_base_qty NUMERIC;
BEGIN
  -- Cari conversion dari unit yang dipilih
  SELECT conversion INTO v_unit_conversion
  FROM product_units
  WHERE product_id = p_id AND name = p_stock_unit_name;

  IF v_unit_conversion IS NULL THEN
    v_unit_conversion := 1;
  END IF;

  v_base_qty := p_qty_input * v_unit_conversion;

  -- Update stok dan opsional harga beli
  UPDATE products
  SET
    stock = stock + v_base_qty,
    price_cost = COALESCE(p_total_harga_beli, price_cost),
    updated_at = now()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- 4c. Function untuk update produk dengan unit (menambah stok)
CREATE FUNCTION update_product_with_units(
  p_product_id        uuid,
  p_name              text,
  p_units_to_upsert   text,
  p_units_to_delete   text,
  p_user_id           uuid
) 
RETURNS jsonb 
LANGUAGE plpgsql 
AS $$
DECLARE
  v_unit jsonb;
BEGIN
  -- VALIDASI
  IF p_name IS NULL OR p_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nama produk tidak boleh kosong'
    );
  END IF;

  -- 1. Update nama produk
  UPDATE products
  SET name = p_name, updated_at = now()
  WHERE id = p_product_id;

  -- 2. Upsert units
  FOR v_unit IN SELECT jsonb_array_elements(p_units_to_upsert::jsonb)
  LOOP
    IF (v_unit->>'id') IS NOT NULL AND (v_unit->>'id') != '' THEN
      -- Update existing
      UPDATE product_units
      SET 
        name = v_unit->>'name',
        conversion = (v_unit->>'conversion')::numeric,
        barcode = NULLIF(v_unit->>'barcode', ''),
        price_sell = (v_unit->>'price_sell')::numeric,
        updated_at = now()
      WHERE id = (v_unit->>'id')::uuid;
    ELSE
      -- Insert new
      INSERT INTO product_units (
        product_id, name, conversion, is_base,
        barcode, price_sell
      ) VALUES (
        p_product_id,
        v_unit->>'name',
        (v_unit->>'conversion')::numeric,
        false,
        NULLIF(v_unit->>'barcode', ''),
        (v_unit->>'price_sell')::numeric
      );
    END IF;
  END LOOP;

  -- 3. Soft delete units
  FOR v_unit IN SELECT jsonb_array_elements(p_units_to_delete::jsonb)
  LOOP
    UPDATE product_units
    SET is_deleted = true, updated_at = now()
    WHERE id = (v_unit->>'id')::uuid;
  END LOOP;

  -- 4. Audit log
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value)
  VALUES (
    p_user_id, 'update_product', 'products', p_product_id,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id
  );
END;
$$;
$$ LANGUAGE plpgsql;


-- 4d. Function untuk restock produk dengan perhitungan HPP (Harga Pokok Penjualan) baru menggunakan metode Weighted Average
CREATE OR REPLACE FUNCTION process_restock(
  p_product_id       UUID,
  p_unit_id          UUID,
  p_qty_input        NUMERIC,
  p_total_harga_beli NUMERIC,
  p_user_id          UUID,
  p_notes            TEXT DEFAULT NULL
)
RETURNS TABLE (
  success   BOOLEAN,
  message   TEXT,
  qty_added INTEGER,
  hpp_before NUMERIC,
  hpp_after  NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversion      NUMERIC;
  v_qty_base        INTEGER;
  v_stock_lama      INTEGER;
  v_hpp_lama        NUMERIC;
  v_hpp_baru        NUMERIC;
  v_nilai_lama      NUMERIC;
BEGIN

  -- 1. Validasi: produk ada?
  SELECT stock, price_cost
  INTO v_stock_lama, v_hpp_lama
  FROM products
  WHERE id = p_product_id AND is_deleted = FALSE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Produk tidak ditemukan'::TEXT, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- 2. Validasi: unit ada dan milik produk ini?
  SELECT conversion
  INTO v_conversion
  FROM product_units
  WHERE id = p_unit_id
    AND product_id = p_product_id
    AND is_deleted = FALSE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Satuan tidak ditemukan'::TEXT, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- 3. Validasi: input tidak boleh nol atau negatif
  IF p_qty_input <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Jumlah restock harus lebih dari 0'::TEXT, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  IF p_total_harga_beli <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Total harga beli harus lebih dari 0'::TEXT, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- 4. Hitung qty dalam satuan dasar
  v_qty_base := FLOOR(p_qty_input * v_conversion);

  -- 5. Hitung HPP baru (Weighted Average)
  v_nilai_lama := v_stock_lama * v_hpp_lama;
  v_hpp_baru   := (v_nilai_lama + p_total_harga_beli) / (v_stock_lama + v_qty_base);

  -- 6. Update stock dan price_cost (HPP) di tabel products
  UPDATE products
  SET
    stock      = stock + v_qty_base,
    price_cost = ROUND(v_hpp_baru, 2),
    updated_at = NOW()
  WHERE id = p_product_id;

  -- 7. Catat ke stock_history
 INSERT INTO stock_history (
  product_id,
  quantity_before,
  quantity_after,
  reference_type,
  created_by,
  unit_id,
  qty_input,
  harga_beli_input,
  harga_beli_base,
  hpp_before,
  hpp_after
) VALUES (
  p_product_id,
  v_stock_lama,
  v_stock_lama + v_qty_base,
  'restock',
  p_user_id,
  p_unit_id,
  p_qty_input,                                        
  p_total_harga_beli,                                 -- total bayar ke supplier
  ROUND(p_total_harga_beli / v_qty_base, 2),          -- harga beli per satuan dasar (pcs)
  ROUND(v_hpp_lama, 2),                               -- HPP sebelum restock
  ROUND(v_hpp_baru, 2)                                -- HPP setelah restock
);

  RETURN QUERY SELECT
    TRUE,
    'Restock berhasil'::TEXT,
    v_qty_base,
    ROUND(v_hpp_lama, 2),
    ROUND(v_hpp_baru, 2);

END;
$$;

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
