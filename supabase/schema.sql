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
-- 0e. Tabel Sessions (untuk menyimpan session login)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions USING btree (user_id);

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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_cost NUMERIC(15, 2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  created_by UUID,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 1b. Tabel Unit Produk (untuk multi-unit/satuan)
CREATE TABLE IF NOT EXISTS product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conversion NUMERIC(10, 4) NOT NULL CHECK (conversion > 0),
  is_base BOOLEAN NOT NULL DEFAULT FALSE,
  barcode TEXT UNIQUE,
  price_sell NUMERIC(15, 2) NOT NULL CHECK (price_sell >= 0),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1c. Tabel untuk menyimpan riwayat perubahan harga produk
CREATE TABLE IF NOT EXISTS product_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_price_cost NUMERIC,
    old_price_sell NUMERIC,
    new_price_cost NUMERIC,
    new_price_sell NUMERIC,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason VARCHAR(500)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_price_history_changed_at ON product_price_history USING btree (changed_at);

-- 1d. Tabel Stock History
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unit_id UUID REFERENCES product_units(id),
  qty_input NUMERIC,
  harga_beli_input NUMERIC,
  harga_beli_base NUMERIC,
  hpp_before NUMERIC,
  hpp_after NUMERIC
);

-- 2. Tabel Transaksi (Header)
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_price     NUMERIC(15, 2) NOT NULL,
  cash_amount     NUMERIC(15, 2) NOT NULL,
  change_amount   NUMERIC(15, 2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  payment_method  VARCHAR(50),
  notes           TEXT,
  voided          BOOLEAN DEFAULT FALSE,
  voided_by       UUID,
  voided_at       TIMESTAMPTZ,
  voided_reason   TEXT,
  total_cost      NUMERIC(15, 2)
);

-- 3. Tabel Item Transaksi (Detail)
CREATE TABLE IF NOT EXISTS transaction_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),
  unit_id               UUID REFERENCES product_units(id),
  qty                   INTEGER NOT NULL,
  subtotal              NUMERIC(15, 2) NOT NULL DEFAULT 0,
  price_sell_snapshot   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  hpp_snapshot          NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 4. Function untuk mengurangi stok secara atomik
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
  SELECT conversion INTO v_unit_conversion
  FROM product_units
  WHERE product_id = p_id AND name = p_stock_unit_name;

  IF v_unit_conversion IS NULL THEN
    v_unit_conversion := 1;
  END IF;

  v_base_qty := p_qty_input * v_unit_conversion;

  UPDATE products
  SET
    stock = stock + v_base_qty,
    price_cost = COALESCE(p_total_harga_beli, price_cost),
    updated_at = now()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- 4c. Function untuk create produk dengan units
CREATE OR REPLACE FUNCTION create_product_with_units(
  p_name             TEXT,
  p_total_harga_beli NUMERIC,
  p_qty_input        NUMERIC,
  p_stock_unit_name  TEXT,
  p_units            TEXT,
  p_user_id          UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id    UUID;
  v_conversion    NUMERIC;
  v_price_cost    NUMERIC;
  v_stock_base    INTEGER;
  v_units_json    JSONB;
  v_unit          JSONB;
BEGIN
  v_units_json := p_units::JSONB;

  -- VALIDASI
  IF p_name IS NULL OR p_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nama produk tidak boleh kosong'
    );
  END IF;

  IF p_qty_input IS NULL OR p_qty_input <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Qty harus lebih besar dari 0'
    );
  END IF;

  IF p_total_harga_beli IS NULL OR p_total_harga_beli <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Total harga beli harus lebih besar dari 0'
    );
  END IF;

  IF p_stock_unit_name IS NULL OR p_stock_unit_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pilih satuan untuk stok awal'
    );
  END IF;

  -- 1. Ambil konversi dari unit yang dipilih
  SELECT (u->>'conversion')::NUMERIC INTO v_conversion
  FROM jsonb_array_elements(v_units_json) u
  WHERE u->>'name' = p_stock_unit_name;

  IF v_conversion IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unit ' || p_stock_unit_name || ' tidak ditemukan'
    );
  END IF;

  -- 2. Hitung stok base dan HPP base
  v_stock_base := FLOOR(p_qty_input * v_conversion);
  v_price_cost := ROUND(p_total_harga_beli / v_stock_base, 2);

  -- 3. Insert produk
  v_product_id := gen_random_uuid();
  INSERT INTO products (id, name, price_cost, stock, created_by)
  VALUES (v_product_id, p_name, v_price_cost, v_stock_base, p_user_id);

  -- 4. Insert units
  FOR v_unit IN SELECT jsonb_array_elements(v_units_json)
  LOOP
    INSERT INTO product_units (
      product_id, name, conversion, is_base,
      barcode, price_sell
    ) VALUES (
      v_product_id,
      v_unit->>'name',
      (v_unit->>'conversion')::NUMERIC,
      COALESCE((v_unit->>'is_base')::BOOLEAN, false),
      NULLIF(v_unit->>'barcode', ''),
      (v_unit->>'price_sell')::NUMERIC
    );
  END LOOP;

  -- 5. Insert price history
  INSERT INTO product_price_history (
    product_id, new_price_cost,
    changed_by, reason
  ) VALUES (
    v_product_id, v_price_cost,
    p_user_id, 'Initial product creation'
  );

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'success', true,
    'price_cost_base', v_price_cost,
    'stock_base', v_stock_base
  );
END;
$$;

-- 4d. Function untuk update produk dengan unit
CREATE OR REPLACE FUNCTION update_product_with_units(
  p_product_id        UUID,
  p_name              TEXT,
  p_units_to_upsert   TEXT,
  p_units_to_delete   TEXT,
  p_user_id           UUID
) 
RETURNS JSONB 
LANGUAGE plpgsql 
AS $$
DECLARE
  v_unit JSONB;
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

  -- 4. Audit log - comment out if audit_logs table doesn't exist yet
  -- INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value)
  -- VALUES (
  --   p_user_id, 'update_product', 'products', p_product_id,
  --   jsonb_build_object('name', p_name)
  -- );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id
  );
END;
$$;

-- 4e. Function untuk restock produk dengan perhitungan HPP (Weighted Average)
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
    stock = stock + v_qty_base,
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
    p_total_harga_beli,
    ROUND(p_total_harga_beli / v_qty_base, 2),
    ROUND(v_hpp_lama, 2),
    ROUND(v_hpp_baru, 2)
  );

  RETURN QUERY SELECT
    TRUE,
    'Restock berhasil'::TEXT,
    v_qty_base,
    ROUND(v_hpp_lama, 2),
    ROUND(v_hpp_baru, 2);

END;
$$;

-- 4f. RPC Function untuk checkout dengan snapshot harga dan HPP
CREATE OR REPLACE FUNCTION process_checkout_with_margins(
  p_items TEXT,
  p_cash_amount DECIMAL,
  p_payment_method TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  success BOOLEAN,
  message TEXT,
  total_price DECIMAL,
  total_cost DECIMAL,
  total_margin DECIMAL,
  margin_percent DECIMAL,
  change_amount DECIMAL
) AS $$
DECLARE
  v_transaction_id UUID;
  v_total_price DECIMAL := 0;
  v_total_cost DECIMAL := 0;
  v_items_json JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_unit_id UUID;
  v_qty INTEGER;
  v_conversion NUMERIC;
  v_price_sell_snapshot DECIMAL;
  v_hpp_snapshot DECIMAL;
  v_subtotal DECIMAL;
  v_item_cost DECIMAL;
  v_stock_base INTEGER;
  v_qty_base INTEGER;
BEGIN
  -- Parse text to JSONB
  v_items_json := p_items::JSONB;

  -- Validate items & calculate totals
  FOR v_item IN SELECT jsonb_array_elements(v_items_json)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_unit_id := (v_item->>'unit_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    v_price_sell_snapshot := (v_item->>'price_sell_snapshot')::DECIMAL;
    v_hpp_snapshot := (v_item->>'hpp_snapshot')::DECIMAL;

    -- Get product stock & unit conversion
    SELECT stock INTO v_stock_base
    FROM products WHERE id = v_product_id AND is_deleted = FALSE;

    IF v_stock_base IS NULL THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Produk tidak ditemukan: ' || v_product_id::TEXT,
                            NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
      RETURN;
    END IF;

    -- Get unit conversion
    SELECT conversion INTO v_conversion
    FROM product_units WHERE id = v_unit_id AND product_id = v_product_id AND is_deleted = FALSE;

    IF v_conversion IS NULL THEN
      v_conversion := 1;
    END IF;

    -- Check stock in base units
    v_qty_base := v_qty * v_conversion;
    IF v_stock_base < v_qty_base THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Stok tidak cukup: ' || v_product_id::TEXT,
                            NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
      RETURN;
    END IF;

    -- Calculate item totals using snapshots
    v_subtotal := v_price_sell_snapshot * v_qty;
    v_item_cost := v_hpp_snapshot * v_qty;

    v_total_price := v_total_price + v_subtotal;
    v_total_cost := v_total_cost + v_item_cost;
  END LOOP;

  -- Validate payment
  IF p_cash_amount < v_total_price THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Jumlah uang tidak cukup',
                        NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;

  -- Create transaction
  v_transaction_id := gen_random_uuid();
  INSERT INTO transactions (
    id, total_price, cash_amount, change_amount, created_at, payment_method, notes, total_cost
  ) VALUES (
    v_transaction_id,
    v_total_price,
    p_cash_amount,
    p_cash_amount - v_total_price,
    CURRENT_TIMESTAMP,
    p_payment_method,
    p_notes,
    v_total_cost
  );

  -- Insert transaction items & decrement stock
  FOR v_item IN SELECT jsonb_array_elements(v_items_json)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_unit_id := (v_item->>'unit_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    v_subtotal := (v_item->>'subtotal')::DECIMAL;

    -- Explicitly parse snapshots with NULL check
    v_price_sell_snapshot := COALESCE((v_item->>'price_sell_snapshot')::NUMERIC, 0)::DECIMAL;
    v_hpp_snapshot := COALESCE((v_item->>'hpp_snapshot')::NUMERIC, 0)::DECIMAL;

    -- Validate snapshots are not zero
    IF v_price_sell_snapshot <= 0 OR v_hpp_snapshot <= 0 THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Snapshot values invalid: price_sell=' || v_price_sell_snapshot || ', hpp=' || v_hpp_snapshot,
                            NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
      RETURN;
    END IF;

    -- Get unit conversion
    SELECT conversion INTO v_conversion
    FROM product_units WHERE id = v_unit_id AND product_id = v_product_id;

    IF v_conversion IS NULL THEN
      v_conversion := 1;
    END IF;

    v_qty_base := v_qty * v_conversion;

    -- Insert transaction item dengan snapshots
    INSERT INTO transaction_items (
      transaction_id, product_id, unit_id, qty,
      price_sell_snapshot, hpp_snapshot, subtotal
    ) VALUES (
      v_transaction_id, v_product_id, v_unit_id, v_qty,
      v_price_sell_snapshot, v_hpp_snapshot, v_subtotal
    );

    -- Decrement stock dalam base units
    UPDATE products SET stock = stock - v_qty_base WHERE id = v_product_id;
  END LOOP;

  -- Return success
  RETURN QUERY SELECT
    v_transaction_id,
    TRUE,
    'Checkout berhasil'::TEXT,
    v_total_price,
    v_total_cost,
    v_total_price - v_total_cost,
    CASE
      WHEN v_total_price = 0 THEN 0
      ELSE ROUND(((v_total_price - v_total_cost) / v_total_price) * 100, 2)
    END,
    p_cash_amount - v_total_price;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC Functions untuk get products dengan active units only
CREATE OR REPLACE FUNCTION get_products_with_active_units()
RETURNS TABLE (
  id UUID,
  name TEXT,
  barcode TEXT,
  stock INTEGER,
  price_cost NUMERIC,
  created_at TIMESTAMPTZ,
  product_units JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    (SELECT pu_base.barcode FROM product_units pu_base
     WHERE pu_base.product_id = p.id AND pu_base.is_base = true AND pu_base.is_deleted = false
     LIMIT 1),
    p.stock,
    p.price_cost,
    p.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pu.id,
          'name', pu.name,
          'conversion', pu.conversion,
          'is_base', pu.is_base,
          'barcode', pu.barcode,
          'price_sell', pu.price_sell
        ) ORDER BY pu.price_sell ASC
      ) FILTER (WHERE pu.id IS NOT NULL),
      '[]'::jsonb
    ) AS product_units
  FROM products p
  LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.is_deleted = false
  WHERE p.is_deleted = false
  GROUP BY p.id, p.name, p.stock, p.price_cost, p.created_at
  ORDER BY p.name ASC;
$$;

CREATE OR REPLACE FUNCTION get_products_list()
RETURNS TABLE (
  id UUID,
  name TEXT,
  stock INTEGER,
  price_cost NUMERIC,
  product_units JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.stock,
    p.price_cost,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pu.id,
          'name', pu.name,
          'conversion', pu.conversion,
          'is_base', pu.is_base,
          'price_sell', pu.price_sell
        ) ORDER BY pu.price_sell ASC
      ) FILTER (WHERE pu.id IS NOT NULL),
      '[]'::jsonb
    ) AS product_units
  FROM products p
  LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.is_deleted = false
  WHERE p.is_deleted = false
  GROUP BY p.id, p.name, p.stock, p.price_cost
  ORDER BY p.name ASC;
$$;

CREATE OR REPLACE FUNCTION get_product_detail(p_product_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  stock INTEGER,
  price_cost NUMERIC,
  product_units JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.stock,
    p.price_cost,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pu.id,
          'name', pu.name,
          'conversion', pu.conversion,
          'is_base', pu.is_base,
          'barcode', pu.barcode,
          'price_sell', pu.price_sell
        ) ORDER BY pu.price_sell ASC
      ) FILTER (WHERE pu.id IS NOT NULL),
      '[]'::jsonb
    ) AS product_units
  FROM products p
  LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.is_deleted = false
  WHERE p.id = p_product_id AND p.is_deleted = false
  GROUP BY p.id, p.name, p.stock, p.price_cost;
$$;

-- 5. Migration untuk tabel yang sudah ada (jalankan jika table sudah dibuat sebelumnya):
-- ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES product_units(id);
-- ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS price_sell_snapshot NUMERIC(15, 2) DEFAULT 0;
-- ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS hpp_snapshot NUMERIC(15, 2) DEFAULT 0;
-- ALTER TABLE transactions ALTER COLUMN total_price TYPE NUMERIC(15, 2);
-- ALTER TABLE transactions ALTER COLUMN cash_amount TYPE NUMERIC(15, 2);
-- ALTER TABLE transactions ALTER COLUMN change_amount TYPE NUMERIC(15, 2);

-- 6. Enable Row Level Security (opsional, aktifkan jika pakai Auth)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- 7. Contoh data produk untuk testing
INSERT INTO products (name, price_cost, stock) VALUES
  ('Aqua 600ml', 2000, 100),
  ('Indomie Goreng', 2500, 200),
  ('Teh Botol Sosro 350ml', 3000, 150)
ON CONFLICT (id) DO NOTHING;

-- 8. Contoh data product_units untuk testing
INSERT INTO product_units (product_id, name, conversion, is_base, barcode, price_sell) VALUES
  ((SELECT id FROM products WHERE name = 'Aqua 600ml' LIMIT 1), 'Pcs', 1, true, '8991234567890', 3000),
  ((SELECT id FROM products WHERE name = 'Aqua 600ml' LIMIT 1), 'Karton (12 Pcs)', 12, false, '8991234567890-KTN', 34800),
  ((SELECT id FROM products WHERE name = 'Indomie Goreng' LIMIT 1), 'Pcs', 1, true, '8997002100104', 3500),
  ((SELECT id FROM products WHERE name = 'Indomie Goreng' LIMIT 1), 'Dus (24 Pcs)', 24, false, '8997002100104-DUS', 78000),
  ((SELECT id FROM products WHERE name = 'Teh Botol Sosro 350ml' LIMIT 1), 'Botol', 1, true, '8999999100110', 4000)
ON CONFLICT (barcode) DO NOTHING;