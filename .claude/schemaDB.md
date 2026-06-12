# Database Schema

## Table: `products`

-- Description: Table untuk menyimpan data produk/barang.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode TEXT,
    name TEXT,
    price_sell INTEGER,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    price_cost NUMERIC
);

-- Indexes
CREATE INDEX idx_products_barcode_active ON public.products USING btree (barcode) WHERE (is_deleted = false)
CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode)
CREATE INDEX idx_products_price_cost ON public.products USING btree (price_cost)
CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)
```
## Table: `product_units`

-- Description: Menyimpan satuan/unit dari setiap produk, termasuk satuan dasar dan konversinya

```sql
create table product_units (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  name          text not null,
  conversion    numeric(10,4) not null check (conversion > 0),
  is_base       boolean not null default false,
  barcode       text unique,
  price_sell    numeric(15,2) not null check (price_sell >= 0),
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Constraints
alter table product_units
  add constraint uq_unit_name_per_product unique (product_id, name),
  add constraint chk_base_conversion check (not is_base or conversion = 1);

-- Index untuk barcode lookup (POS scanner)
create unique index idx_product_units_barcode
  on product_units(barcode) where barcode is not null;

-- Hanya boleh ada 1 base unit per produk
create unique index idx_one_base_unit_per_product
  on product_units(product_id) where is_base = true;
```
## Table: `transaction_items`

-- Description: Menyimpan detail item dari setiap transaksi

```sql
CREATE TABLE transaction_items (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_id UUID REFERENCES product_units(id),

    -- Quantity & Financial
    qty INTEGER NOT NULL CHECK (qty > 0),
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0),

    -- Snapshots (harga pada saat transaksi, tidak berubah meskipun harga produk berubah nanti)
    price_sell_snapshot NUMERIC NOT NULL CHECK (price_sell_snapshot >= 0),
    price_cost_snapshot NUMERIC NOT NULL CHECK (price_cost_snapshot >= 0),

    -- Margin calculations
    item_margin NUMERIC,
    item_margin_percent NUMERIC,

    -- Timestamps (opsional, tergantung kebutuhan)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transaction_items_product_id ON public.transaction_items USING btree (product_id)
CREATE INDEX idx_transaction_items_transaction_id ON public.transaction_items USING btree (transaction_id)
CREATE UNIQUE INDEX transaction_items_pkey ON public.transaction_items USING btree (id)
```
## Table: `product_price_history`
-- Description: Menyimpan histori perubahan harga produk (cost & sell)

```sql
create table product_price_history (
  -- Primary Key
  id uuid primary key default gen_random_uuid(),
  
  -- Relasi ke produk
  product_id uuid not null references products(id) on delete cascade,
  
  -- Relasi ke satuan (NULL untuk HPP base)
  unit_id uuid references product_units(id) on delete set null,
  
  -- Harga lama dan baru
  old_price_cost numeric(15,2),      -- HPP lama (modal)
  new_price_cost numeric(15,2),      -- HPP baru (modal)
  old_price_sell numeric(15,2),      -- Harga jual lama
  new_price_sell numeric(15,2),      -- Harga jual baru
  
  -- Jenis perubahan
  change_type text not null check (
    change_type in ('hpp_base', 'price_sell_unit', 'avco_restock', 'initial_create')
  ),
  
  -- Audit tracking
  changed_by uuid references users(id),
  changed_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now()
);

-- Indexes
CREATE INDEX idx_product_price_history_changed_at ON public.product_price_history USING btree (changed_at)
CREATE INDEX idx_product_price_history_product_id ON public.product_price_history USING btree (product_id)
CREATE UNIQUE INDEX product_price_history_pkey ON public.product_price_history USING btree (id)
create index idx_product_price_history_unit_id
  on product_price_history(unit_id);
create index idx_product_price_history_change_type
  on product_price_history(change_type);
```
## Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)
CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id)
CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs USING btree (user_id, "timestamp" DESC)
```


## Table: `margin_audit_log`

```sql
CREATE TABLE margin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL,
    product_id UUID,
    transaction_id UUID,
    changed_by UUID,
    old_value JSONB,
    new_value JSONB,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_margin_audit_log_action_type ON public.margin_audit_log USING btree (action_type)
CREATE INDEX idx_margin_audit_log_created_at ON public.margin_audit_log USING btree (created_at)
CREATE INDEX idx_margin_audit_log_product_id ON public.margin_audit_log USING btree (product_id)
CREATE INDEX idx_margin_audit_log_product_id ON public.margin_audit_log USING btree (product_id)
CREATE UNIQUE INDEX margin_audit_log_pkey ON public.margin_audit_log USING btree (id)
```
## Table: `permissions`
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name)
CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id)
```

## Table: `role_permissions`

```sql
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Indexes
CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (id)
CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON public.role_permissions USING btree (role_id, permission_id)
```
## Table: `role`
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name)
CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id)
```
## Table: `sessions`

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at)
CREATE INDEX idx_sessions_token_hash ON public.sessions USING btree (token_hash)
CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id)
CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)
CREATE UNIQUE INDEX sessions_token_hash_key ON public.sessions USING btree (token_hash)
```

## Table: `stock_history`
``` sql
CREATE TABLE stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unit_id UUID,
    qty_input NUMERIC,
    harga_beli_input NUMERIC,
    harga_beli_base NUMERIC,
    hpp_before NUMERIC,
    hpp_after NUMERIC
);

-- Indexes
CREATE UNIQUE INDEX stock_history_pkey ON public.stock_history USING btree (id)
create index idx_stock_history_product_created on stock_history(product_id, created_at desc);
create index idx_stock_history_reference_type on stock_history(reference_type);
```
## Table: `transactions`

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_price INTEGER NOT NULL CHECK (total_price >= 0),
    cash_amount INTEGER NOT NULL CHECK (cash_amount >= 0),
    change_amount INTEGER NOT NULL CHECK (change_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cashier_id UUID NOT NULL,
    payment_method VARCHAR(50),
    notes TEXT,
    voided BOOLEAN DEFAULT FALSE,
    voided_by UUID,
    voided_at TIMESTAMPTZ,
    voided_reason TEXT,
    total_cost NUMERIC NOT NULL CHECK (total_cost >= 0),
    total_margin NUMERIC NOT NULL,
    margin_percent NUMERIC NOT NULL,
    created_by UUID
);

-- Indexes
CREATE INDEX idx_transactions_cashier_created ON public.transactions USING btree (cashier_id, created_at DESC)
CREATE INDEX idx_transactions_created ON public.transactions USING btree (created_at DESC)
CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at)
CREATE INDEX idx_transactions_total_margin ON public.transactions USING btree (total_margin)
CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id)
```
## Table: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    encrypted_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role_id UUID,
    status VARCHAR(50) DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
```
## Functions

### create_or_update_product_with_audit

-- Description: Melakukan update data produk yang sudah ada (tidak untuk insert baru) dengan validasi dan pencatatan histori perubahan harga.

```sql
DECLARE
  v_product_id UUID;
  v_old_price_cost DECIMAL;
  v_old_price_sell DECIMAL;
  v_existing_barcode UUID;
BEGIN
  -- Update existing product
  IF p_id IS NOT NULL THEN
    SELECT id, price_cost, price_sell INTO v_product_id, v_old_price_cost, v_old_price_sell
    FROM products WHERE id = p_id;

    IF v_product_id IS NULL THEN
      RETURN QUERY SELECT p_id, FALSE, 'Produk tidak ditemukan'::VARCHAR;
      RETURN;
    END IF;

    -- Check barcode duplicate saat update (jika barcode berubah)
    IF p_barcode != (SELECT barcode FROM products WHERE id = p_id) THEN
      SELECT id INTO v_existing_barcode FROM products
      WHERE barcode = p_barcode AND id != p_id AND is_deleted = FALSE;

      IF v_existing_barcode IS NOT NULL THEN
        RETURN QUERY SELECT p_id, FALSE, 'Barcode sudah terdaftar di produk lain'::VARCHAR;
        RETURN;
      END IF;
    END IF;

    UPDATE products
    SET barcode = p_barcode,
        name = p_name,
        price_cost = p_price_cost,
        price_sell = p_price_sell,
        stock = p_stock,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id;

    -- Insert price history if prices changed
    IF v_old_price_cost != p_price_cost OR v_old_price_sell != p_price_sell THEN
      INSERT INTO product_price_history (
        product_id, old_price_cost, new_price_cost,
        old_price_sell, new_price_sell, changed_by, reason
      ) VALUES (
        p_id, v_old_price_cost, p_price_cost,
        v_old_price_sell, p_price_sell, p_user_id, p_reason
      );

      INSERT INTO margin_audit_log (
        action_type, product_id, changed_by,
        old_value, new_value, notes
      ) VALUES (
        'PRICE_CHANGE', p_id, p_user_id,
        jsonb_build_object('price_cost', v_old_price_cost, 'price_sell', v_old_price_sell),
        jsonb_build_object('price_cost', p_price_cost, 'price_sell', p_price_sell),
        p_reason
      );
    END IF;

    RETURN QUERY SELECT p_id, TRUE, 'Produk berhasil diperbarui'::VARCHAR;

  -- Create new product
  ELSE
    -- Check barcode duplicate saat create
    SELECT id INTO v_existing_barcode FROM products
    WHERE barcode = p_barcode AND is_deleted = FALSE;

    IF v_existing_barcode IS NOT NULL THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Barcode sudah terdaftar di produk lain'::VARCHAR;
      RETURN;
    END IF;

    v_product_id := gen_random_uuid();

    INSERT INTO products (id, barcode, name, price_cost, price_sell, stock)
    VALUES (v_product_id, p_barcode, p_name, p_price_cost, p_price_sell, p_stock);

    INSERT INTO product_price_history (
      product_id, old_price_cost, new_price_cost,
      old_price_sell, new_price_sell, changed_by, reason
    ) VALUES (
      v_product_id, NULL, p_price_cost,
      NULL, p_price_sell, p_user_id, 'Initial product creation'
    );

    INSERT INTO margin_audit_log (
      action_type, product_id, changed_by,
      new_value, notes
    ) VALUES (
      'PRODUCT_CREATE', v_product_id, p_user_id,
      jsonb_build_object('price_cost', p_price_cost, 'price_sell', p_price_sell, 'stock', p_stock),
      'Produk baru dibuat'
    );

    RETURN QUERY SELECT v_product_id, TRUE, 'Produk berhasil dibuat'::VARCHAR;
  END IF;
END;

### decrement_stock
BEGIN
  UPDATE products
  SET stock = stock - amount
  WHERE id = product_id AND stock >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak cukup untuk produk %', product_id;
  END IF;
END;
```

### get_margin_report_by_product

```sql
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.barcode,
    COALESCE(SUM(ti.qty), 0)::BIGINT as quantity_sold,
    COALESCE(SUM(ti.item_margin), 0)::DECIMAL as total_margin,
    COUNT(DISTINCT ti.transaction_id)::BIGINT as transaction_count
  FROM products p
  LEFT JOIN transaction_items ti ON p.id = ti.product_id
  LEFT JOIN transactions t ON ti.transaction_id = t.id
  WHERE DATE(t.created_at) BETWEEN p_start_date AND p_end_date
    AND t.voided = FALSE
  GROUP BY p.id, p.name, p.barcode
  ORDER BY total_margin DESC;
END;
```

### decrement_stock
```sql
BEGIN
  UPDATE products
  SET stock = stock - amount
  WHERE id = product_id AND stock >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak cukup untuk produk %', product_id;
  END IF;
END;
```

### get_margin_report_daily
``` sql
BEGIN
  RETURN QUERY
  SELECT 
    DATE(t.created_at) as report_date,
    COALESCE(SUM(t.total_price), 0)::DECIMAL as total_sales,
    COALESCE(SUM(t.total_cost), 0)::DECIMAL as total_cost,
    COALESCE(SUM(t.total_margin), 0)::DECIMAL as total_margin,
    CASE 
      WHEN COALESCE(SUM(t.total_price), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(t.total_margin), 0) / COALESCE(SUM(t.total_price), 0)) * 100, 2)
    END::DECIMAL as margin_percent,
    COUNT(t.id)::BIGINT as transaction_count
  FROM transactions t
  WHERE DATE(t.created_at) BETWEEN p_start_date AND p_end_date
    AND t.voided = FALSE
  GROUP BY DATE(t.created_at)
  ORDER BY report_date DESC;
END;
```

### get_user_permissions
``` sql
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN users u ON r.id = u.role_id
  WHERE u.id = user_id;
END;
```

### has_user_permission
``` sql
DECLARE
  permission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO permission_count
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN users u ON r.id = u.role_id
  WHERE u.id = user_id AND p.name = permission_name;
  
  RETURN permission_count > 0;
END;
```
### log_audit_action
``` sql
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_value, new_value)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_old_value, p_new_value)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
```

### process_checkout_with_margins
``` sql
DECLARE
  v_transaction_id UUID;
  v_total_price DECIMAL := 0;
  v_total_cost DECIMAL := 0;
  v_items_json JSONB; -- ← ADD THIS
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_price_sell DECIMAL;
  v_price_cost DECIMAL;
  v_item_subtotal DECIMAL;
  v_item_cost DECIMAL;
  v_item_margin DECIMAL;
  v_item_margin_percent DECIMAL;
  v_stock INTEGER;
BEGIN
  -- Parse text to JSONB
  v_items_json := p_items::JSONB; -- ← PARSE TEXT TO JSONB
  
  -- Validate items & calculate totals
  FOR v_item IN SELECT jsonb_array_elements(v_items_json)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    
    -- Get product with stock check
    SELECT price_sell, price_cost, stock 
    INTO v_price_sell, v_price_cost, v_stock
    FROM products WHERE id = v_product_id AND is_deleted = FALSE;
    
    IF v_price_sell IS NULL THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Product not found: ' || v_product_id::TEXT, 
                            NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
      RETURN;
    END IF;
    
    IF v_stock < v_qty THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient stock for: ' || v_product_id::TEXT,
                            NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
      RETURN;
    END IF;
    
    -- Calculate item values
    v_item_subtotal := v_price_sell * v_qty;
    v_item_cost := v_price_cost * v_qty;
    v_item_margin := v_item_subtotal - v_item_cost;
    v_item_margin_percent := CASE 
      WHEN v_item_subtotal = 0 THEN 0
      ELSE ROUND((v_item_margin / v_item_subtotal) * 100, 2)
    END;
    
    v_total_price := v_total_price + v_item_subtotal;
    v_total_cost := v_total_cost + v_item_cost;
  END LOOP;
  
  -- Validate payment
  IF p_cash_amount < v_total_price THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient payment amount',
                        NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;
  
  -- Create transaction
  v_transaction_id := gen_random_uuid();
  INSERT INTO transactions (
    id, total_price, total_cost, total_margin, margin_percent,
    cash_amount, change_amount, payment_method, created_by, created_at
  ) VALUES (
    v_transaction_id,
    v_total_price,
    v_total_cost,
    v_total_price - v_total_cost,
    CASE 
      WHEN v_total_price = 0 THEN 0
      ELSE ROUND(((v_total_price - v_total_cost) / v_total_price) * 100, 2)
    END,
    p_cash_amount,
    p_cash_amount - v_total_price,
    p_payment_method,
    p_user_id,
    CURRENT_TIMESTAMP
  );
  
  -- Insert transaction items & decrement stock
  FOR v_item IN SELECT jsonb_array_elements(v_items_json)  -- ← USE v_items_json
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    
    -- Get product prices (snapshot)
    SELECT price_sell, price_cost 
    INTO v_price_sell, v_price_cost
    FROM products WHERE id = v_product_id;
    
    v_item_subtotal := v_price_sell * v_qty;
    v_item_cost := v_price_cost * v_qty;
    v_item_margin := v_item_subtotal - v_item_cost;
    v_item_margin_percent := CASE 
      WHEN v_item_subtotal = 0 THEN 0
      ELSE ROUND((v_item_margin / v_item_subtotal) * 100, 2)
    END;
    
    -- Insert transaction item
    INSERT INTO transaction_items (
      transaction_id, product_id, qty,
      price_sell_snapshot, price_cost_snapshot,
      subtotal, item_margin, item_margin_percent
    ) VALUES (
      v_transaction_id, v_product_id, v_qty,
      v_price_sell, v_price_cost,
      v_item_subtotal, v_item_margin, v_item_margin_percent
    );
    
    -- Decrement stock
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id;
  END LOOP;
  
  -- Audit log
  INSERT INTO margin_audit_log (
    action_type, transaction_id, changed_by,
    new_value
  ) VALUES (
    'TRANSACTION_CREATE', v_transaction_id, p_user_id,
    jsonb_build_object(
      'total_margin', v_total_price - v_total_cost,
      'margin_percent', CASE 
        WHEN v_total_price = 0 THEN 0
        ELSE ROUND(((v_total_price - v_total_cost) / v_total_price) * 100, 2)
      END,
      'items_count', jsonb_array_length(v_items_json)
    )
  );
  
  -- Return success
  RETURN QUERY SELECT 
    v_transaction_id,
    TRUE,
    'Checkout successful'::VARCHAR,
    v_total_price,
    v_total_cost,
    v_total_price - v_total_cost,
    CASE 
      WHEN v_total_price = 0 THEN 0
      ELSE ROUND(((v_total_price - v_total_cost) / v_total_price) * 100, 2)
    END,
    p_cash_amount - v_total_price;
END;

verify_login

DECLARE
  v_user users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM users
  WHERE users.email = p_email AND status = 'active';

  IF NOT FOUND THEN RETURN; END IF;

  IF crypt(p_password, v_user.encrypted_password) = v_user.encrypted_password THEN
    UPDATE users SET last_login_at = now() WHERE id = v_user.id;

    RETURN QUERY
    SELECT
      v_user.id,
      v_user.email,
      v_user.full_name,
      r.name AS role_name,
      ARRAY(
        SELECT p.name::TEXT FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = v_user.role_id
      ) AS permissions
    FROM roles r WHERE r.id = v_user.role_id;
  END IF;
END;
```

### create_product_with_units
``` sql
DECLARE
  v_product_id    uuid;
  v_conversion    numeric;
  v_price_cost    numeric;
  v_stock_base    numeric;
  v_barcode       text;
  v_units_json    jsonb;
  v_unit          jsonb;
BEGIN
  v_units_json := p_units::jsonb;

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

  -- 1. Ambil barcode dari base unit
  SELECT NULLIF(u->>'barcode', '') INTO v_barcode
  FROM jsonb_array_elements(v_units_json) u
  WHERE (u->>'is_base')::boolean = true;

  -- 2. Ambil konversi dari unit yang dipilih
  SELECT (u->>'conversion')::numeric INTO v_conversion
  FROM jsonb_array_elements(v_units_json) u
  WHERE u->>'name' = p_stock_unit_name;

  IF v_conversion IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unit ' || p_stock_unit_name || ' tidak ditemukan'
    );
  END IF;

  -- 3. Hitung stok base dan HPP base
  v_stock_base := p_qty_input * v_conversion;
  v_price_cost := ROUND(p_total_harga_beli / v_stock_base, 2);

  -- 4. Insert produk
  v_product_id := gen_random_uuid();
  INSERT INTO products (id, name, price_cost, stock, barcode)
  VALUES (v_product_id, p_name, v_price_cost, v_stock_base, v_barcode);

  -- 5. Insert units
  FOR v_unit IN SELECT jsonb_array_elements(v_units_json)
  LOOP
    INSERT INTO product_units (
      product_id, name, conversion, is_base,
      barcode, price_sell
    ) VALUES (
      v_product_id,
      v_unit->>'name',
      (v_unit->>'conversion')::numeric,
      COALESCE((v_unit->>'is_base')::boolean, false),
      NULLIF(v_unit->>'barcode', ''),
      (v_unit->>'price_sell')::numeric
    );
  END LOOP;

  -- 6. Insert price history
  INSERT INTO product_price_history (
    product_id, old_price_cost, new_price_cost,
    changed_by, reason, change_type
  ) VALUES (
    v_product_id, NULL, v_price_cost,
    p_user_id, 'Initial product creation', 'initial_create'
  );

  -- 7. Insert audit log
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value)
  VALUES (
    p_user_id, 'create_product', 'products', v_product_id,
    jsonb_build_object(
      'name', p_name,
      'price_cost_base', v_price_cost,
      'stock_base', v_stock_base
    )
  );

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'success', true,
    'price_cost_base', v_price_cost,
    'stock_base', v_stock_base
  );
END;
```



