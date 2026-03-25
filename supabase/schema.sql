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
