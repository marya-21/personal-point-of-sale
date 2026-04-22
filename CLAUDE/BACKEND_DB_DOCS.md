# Backend & Database Documentation — POS App

## Overview

Aplikasi ini adalah **frontend-only** yang berkomunikasi langsung dengan **Supabase** (PostgreSQL as a Service) tanpa custom backend server. Semua logika backend dijalankan melalui:

- **Supabase PostgREST** — REST API otomatis dari skema tabel PostgreSQL
- **Supabase RPC** — Pemanggilan stored function PostgreSQL
- **Supabase JS Client** — Library di frontend untuk query/mutasi data

---

## Tech Stack Backend

| Komponen | Teknologi | Keterangan |
|---|---|---|
| Database | PostgreSQL (via Supabase) | Cloud-hosted, managed |
| API Layer | PostgREST (auto-generated) | REST API dari skema tabel |
| Auth | Custom (bcrypt via pgcrypto) | Bukan Supabase Auth bawaan |
| Password Hashing | pgcrypto `crypt()` | bcrypt algorithm |
| Atomic Operations | PostgreSQL Stored Function | `decrement_stock` via `supabase.rpc()` |
| Session Storage | `localStorage` (browser) | Key: `pos_session` |

---

## Konfigurasi Koneksi

File: [src/services/supabase.js](src/services/supabase.js)

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Variabel environment disimpan di `.env` (tidak di-commit):

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Skema Database

### ERD (Entity Relationship)

```
roles ──< role_permissions >── permissions
  |
  └──< users
         |
         └──< transactions ──< transaction_items >── products
```

---

### Tabel: `roles`

Menyimpan daftar peran pengguna (kasir, admin, dll).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `name` | TEXT UNIQUE | Nama role, misal: `kasir`, `admin` |
| `created_at` | TIMESTAMPTZ | Default `now()` |

---

### Tabel: `permissions`

Menyimpan daftar izin akses yang bisa diberikan ke role.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `name` | TEXT UNIQUE | Nama izin, misal: `create_transaction` |
| `description` | TEXT | Deskripsi izin (opsional) |
| `resource` | TEXT NOT NULL | Grup resource, misal: `products`, `transactions` |
| `created_at` | TIMESTAMPTZ | Default `now()` |

**Daftar semua permissions:**

| Nama Permission | Resource | Digunakan Di |
|---|---|---|
| `create_transaction` | `transactions` | Halaman Kasir (`/cashier`) |
| `view_own_transactions` | `transactions` | Halaman Kasir (`/cashier`) |
| `view_all_transactions` | `transactions` | Halaman Riwayat (`/riwayat`) |
| `void_transaction` | `transactions` | Halaman Riwayat (`/riwayat`) |
| `delete_transaction` | `transactions` | Halaman Riwayat (`/riwayat`) |
| `view_products` | `products` | Halaman Inventori (`/inventory`) |
| `create_product` | `products` | Halaman Inventori — tombol Tambah Produk |
| `edit_product` | `products` | Halaman Inventori — tombol Edit |
| `edit_product_price` | `products` | Halaman Inventori — edit harga produk |
| `delete_product` | `products` | Halaman Inventori — tombol Hapus |
| `view_stock` | `stock` | Halaman Inventori — panel stok |
| `adjust_stock` | `stock` | Halaman Inventori — adjust stok manual |
| `view_users` | `users` | Manajemen User (belum dibuat) |
| `create_user` | `users` | Manajemen User (belum dibuat) |
| `edit_user` | `users` | Manajemen User (belum dibuat) |
| `delete_user` | `users` | Manajemen User (belum dibuat) |
| `manage_roles` | `roles` | Manajemen Role (belum dibuat) |
| `view_audit_log` | `audit` | Audit Log (belum dibuat) |

---

### Tabel: `role_permissions`

Tabel junction many-to-many antara `roles` dan `permissions`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `role_id` | UUID FK | Referensi ke `roles.id` |
| `permission_id` | UUID FK | Referensi ke `permissions.id` |

---

### Tabel: `users`

Menyimpan data pengguna aplikasi POS (bukan Supabase Auth).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `email` | TEXT UNIQUE | Email login |
| `password_hash` | TEXT | Hash bcrypt via pgcrypto |
| `full_name` | TEXT | Nama lengkap user |
| `role_id` | UUID FK | Referensi ke `roles.id` |
| `is_active` | BOOLEAN | Default `true`, user aktif/nonaktif |
| `created_at` | TIMESTAMPTZ | Default `now()` |

**Membuat user baru:**
```sql
INSERT INTO users (email, password_hash, full_name, role_id)
VALUES (
  'kasir@toko.com',
  crypt('password123', gen_salt('bf')),
  'Budi Santoso',
  (SELECT id FROM roles WHERE name = 'kasir')
);
```

---

### Tabel: `products`

Katalog produk yang dijual.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `barcode` | TEXT UNIQUE | Barcode produk (EAN-13, dll) |
| `name` | TEXT | Nama produk |
| `price_sell` | INTEGER | Harga jual dalam Rupiah |
| `stock` | INTEGER | Jumlah stok tersedia |
| `created_at` | TIMESTAMPTZ | Default `now()` |

---

### Tabel: `transactions`

Header/ringkasan setiap transaksi penjualan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `total_price` | INTEGER | Total belanja dalam Rupiah |
| `cash_amount` | INTEGER | Jumlah uang tunai yang dibayar |
| `change_amount` | INTEGER | Kembalian |
| `cashier_id` | UUID FK (nullable) | Referensi ke `users.id` |
| `created_at` | TIMESTAMPTZ | Waktu transaksi |

---

### Tabel: `transaction_items`

Detail item per transaksi (many-to-many antara transactions dan products).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `transaction_id` | UUID FK | Referensi ke `transactions.id` (CASCADE DELETE) |
| `product_id` | UUID FK | Referensi ke `products.id` |
| `qty` | INTEGER | Jumlah unit yang dibeli |
| `subtotal` | INTEGER | `price_sell * qty` saat transaksi |

---

## Stored Functions (RPC)

### `verify_login(p_email, p_password)`

Digunakan untuk autentikasi login. Memverifikasi password menggunakan bcrypt tanpa mengekspos `password_hash` ke frontend.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  user_id     UUID,
  email       TEXT,
  full_name   TEXT,
  role_name   TEXT,
  permissions TEXT[]
)
```

**Logika:**
1. Cari user berdasarkan email dan `is_active = true`
2. Verifikasi password dengan `crypt(p_password, password_hash) = password_hash`
3. Jika valid, kembalikan data user beserta array nama permissions dari role-nya
4. Jika tidak valid, kembalikan 0 baris (kosong)

**Dipanggil dari:** [src/auth/AuthContext.jsx](src/auth/AuthContext.jsx)
```js
const { data, error } = await supabase.rpc('verify_login', {
  p_email: email,
  p_password: password,
});
```

**Catatan SQL:** Kolom `permissions` harus di-cast ke `TEXT[]` secara eksplisit karena `permissions.name` bertipe `VARCHAR`:
```sql
ARRAY(
  SELECT p.name::TEXT FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  WHERE rp.role_id = v_user.role_id
) AS permissions
```

---

### `decrement_stock(product_id, amount)`

Mengurangi stok produk secara atomik untuk mencegah race condition saat dua kasir checkout produk yang sama secara bersamaan.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, amount INTEGER)
RETURNS void
```

**Logika:**
1. `UPDATE products SET stock = stock - amount WHERE id = product_id AND stock >= amount`
2. Jika tidak ada baris yang terupdate (`NOT FOUND`), raise exception "Stok tidak cukup"

**Dipanggil dari:** [src/pages/Cashier.jsx](src/pages/Cashier.jsx)
```js
await supabase.rpc('decrement_stock', {
  product_id: item.id,
  amount: item.qty,
})
```

---

## Autentikasi & Sesi

Aplikasi **tidak menggunakan Supabase Auth** (magic link / OAuth). Sistem auth dibangun sendiri menggunakan tabel `users` dan fungsi `verify_login`.

### Alur Login

```
User input email + password
        |
        v
supabase.rpc('verify_login')
        |
        v (PostgreSQL)
  crypt(input, stored_hash) == stored_hash?
        |
   Yes  |  No
        |   └──> return empty rows → { success: false }
        v
  Return: user_id, email, full_name, role_name, permissions[]
        |
        v (Frontend - AuthContext)
  Simpan ke state React + localStorage ('pos_session')
        |
        v
  Navigate ke /cashier
```

### Session Storage

Sesi disimpan di `localStorage` dengan key `pos_session`:

```json
{
  "user": {
    "id": "uuid",
    "email": "kasir@toko.com",
    "full_name": "Budi Santoso",
    "role": { "name": "kasir" }
  },
  "permissions": ["create_transaction"]
}
```

Sesi di-restore saat aplikasi dimuat ulang (di `useEffect` pada [src/auth/AuthContext.jsx](src/auth/AuthContext.jsx)).

### Logout

Menghapus state React dan `localStorage`:
```js
const logout = () => {
  setUser(null);
  setPermissions([]);
  localStorage.removeItem('pos_session');
};
```

---

## RBAC (Role-Based Access Control)

### Pemeriksaan Permission

Fungsi `hasPermission(name)` di `AuthContext` mengecek apakah nama permission ada di array yang dikembalikan saat login:

```js
const hasPermission = (name) => permissions.includes(name);
```

### Route Protection

Setiap halaman dilindungi oleh [src/components/auth/ProtectedRoute.jsx](src/components/auth/ProtectedRoute.jsx):

```
Request ke /cashier
        |
        v
  isAuthenticated?  No → redirect /login
        |
        v
  hasPermission('create_transaction')?  No → tampilkan "Akses Ditolak"
        |
        v
  Render <Cashier />
```

### Mapping Route → Permission

| Route | Permission Required | Halaman |
|---|---|---|
| `/cashier` | `create_transaction` | Kasir POS |
| `/inventory` | `view_products` | Manajemen Inventori |
| `/riwayat` | `view_all_transactions` | Riwayat Transaksi |

---

## Operasi Database per Halaman

### Kasir (`/cashier`)

| Operasi | Tabel | Method |
|---|---|---|
| Fetch semua produk | `products` | `SELECT * WHERE stock > -1` |
| Insert transaksi | `transactions` | `INSERT` |
| Insert item transaksi | `transaction_items` | `INSERT` (bulk) |
| Kurangi stok | `products` | RPC `decrement_stock` |

**Query Key TanStack Query:** `['products']` — di-cache selama 5 menit.

### Inventori (`/inventory`)

| Operasi | Tabel | Method |
|---|---|---|
| Fetch semua produk | `products` | `SELECT * ORDER BY name` |
| Fetch data terlaris | `transaction_items` + `products` | `SELECT` dengan join |
| Tambah / Edit produk | `products` | `UPSERT` (by id) |
| Hapus produk | `products` | `DELETE WHERE id = ?` |

**Query Key TanStack Query:** `['products']`, `['top-selling']`

### Riwayat Transaksi (`/riwayat`)

| Operasi | Tabel | Method |
|---|---|---|
| Fetch transaksi (filter tanggal) | `transactions` | `SELECT` dengan filter `created_at`, limit 100 |
| Fetch detail transaksi | `transaction_items` + `products` | `SELECT` dengan join |

**Query Key TanStack Query:** `['transactions', dateFrom, dateTo]`, `['transaction-detail', id]`

---

## Invalidasi Cache

Setelah mutasi, cache TanStack Query di-invalidate agar data di semua halaman tetap sync:

```js
queryClient.invalidateQueries({ queryKey: ['products'] })
```

Query key `['products']` **digunakan bersama** oleh halaman Kasir dan Inventori, sehingga perubahan produk di Inventori otomatis memperbarui katalog di Kasir.

---

## Dependency Supabase Extension

Ekstensi PostgreSQL yang harus aktif:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Digunakan untuk fungsi `crypt()` dan `gen_salt('bf')` pada hashing password bcrypt.

---

## File Setup Database

Semua DDL (Create Table, Create Function) ada di:

**[supabase/schema.sql](supabase/schema.sql)**

Cara menjalankan:
1. Buka Supabase Dashboard → SQL Editor → New Query
2. Paste isi file `schema.sql`
3. Klik **Run**

Note: 
-- RLS Nonaktifkan pada tabel-tabel yang diakses app, (app sudah punya access control sendiri via ProtectedRoute + permissions)
