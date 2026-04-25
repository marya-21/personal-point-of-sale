Dokumentasi database ini disusun berdasarkan skema ERD yang Anda lampirkan. Secara garis besar, sistem ini merupakan sistem **Point of Sale (POS) atau Manajemen Inventaris** yang mencakup modul produk, transaksi, manajemen stok, audit harga, serta sistem RBAC (*Role-Based Access Control*).

---

# Dokumentasi Database (Schema Overview)

## 1. Modul Produk & Harga
Modul ini menyimpan informasi inti barang dan riwayat perubahan harganya.

### `products`
Tabel utama penyimpan data barang.
* **id**: Primary Key (UUID).
* **barcode**: Kode unik produk (Text).
* **name**: Nama produk.
* **price_sell**: Harga jual saat ini.
* **price_cost**: Harga modal/pokok.
* **stock**: Jumlah stok tersedia.
* **is_deleted**: Soft delete flag.

### `product_price_history`
Mencatat setiap kali terjadi perubahan harga pada produk.
* **old_price_cost / new_price_cost**: Perubahan harga modal.
* **old_price_sell / new_price_sell**: Perubahan harga jual.
* **reason**: Alasan perubahan harga.

---

## 2. Modul Transaksi Penjualan
Modul ini menangani pencatatan transaksi keluar (penjualan).

### `transactions`
Header atau ringkasan transaksi.
* **total_price**: Total nilai belanja.
* **cash_amount**: Uang yang dibayarkan pelanggan.
* **change_amount**: Uang kembalian.
* **payment_method**: Metode pembayaran (Cash, Debit, dll).
* **voided**: Status jika transaksi dibatalkan.
* **total_margin**: Keuntungan bersih dari satu transaksi.

### `transaction_items`
Detail barang yang dibeli dalam satu transaksi.
* **transaction_id**: Relasi ke tabel `transactions`.
* **product_id**: Relasi ke tabel `products`.
* **qty**: Jumlah barang.
* **price_sell_snapshot**: Harga jual saat transaksi terjadi (penting untuk histori jika harga produk berubah di masa depan).

---

## 3. Modul Inventaris & Audit
Digunakan untuk melacak pergerakan stok dan perubahan data sensitif.

### `stock_history`
Log perubahan stok (masuk/keluar).
* **quantity_before / quantity_after**: Snapshot stok sebelum dan sesudah perubahan.
* **reference_type**: Jenis pergerakan (misal: 'sale', 'adjustment', 'restock').

### `margin_audit_log`
Log khusus untuk memantau perubahan pada nilai margin atau keuntungan produk.

### `audit_logs`
Log aktivitas umum sistem secara *granular* (Siapa melakukan apa pada data apa).

---

## 4. Modul User & Keamanan (RBAC)
Mengatur siapa yang bisa mengakses sistem dan tingkat aksesnya.

### `users`
Data pengguna/karyawan.
* **email**: Identitas login.
* **role_id**: Relasi ke peran pengguna.

### `roles` & `permissions`
* **roles**: Nama jabatan (admin, kasir, manager).
* **permissions**: Definisi aksi yang diizinkan (create_product, void_transaction, dll).
* **role_permissions**: Tabel penghubung (Pivot) antara Role dan Permission.

### `sessions`
Menyimpan data sesi login aktif, termasuk IP Address dan User Agent.

---

## Relasi Antar Tabel (Ringkasan)
* **One-to-Many**: `products` -> `transaction_items`
* **One-to-Many**: `transactions` -> `transaction_items`
* **One-to-Many**: `roles` -> `users`
* **Many-to-Many**: `roles` <-> `permissions` (via `role_permissions`)
* **One-to-Many**: `products` -> `product_price_history`

---
> **Catatan:** Semua tabel menggunakan `created_at` dan `updated_at` untuk keperluan audit waktu, serta mayoritas menggunakan `UUID` sebagai Primary Key untuk skalabilitas dan keamanan ID.