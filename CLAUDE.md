1. Context & Overview
Project ini adalah aplikasi Point of Sale (POS) berbasis web yang dirancang untuk efisiensi transaksi kasir menggunakan alat pemindai (barcode scanner). 
Fokus utama adalah kecepatan fetching data dan akurasi manajemen keranjang belanja (cart), dan fokus ke fungsi lalu styling.

- User Role: Kasir (Transaksi) & Admin (Manajemen Produk/Stok).
- Hardware: Mendukung Barcode Scanner (HID) dan Printer Thermal.

Note: Saya adalah seorang FE yang belum terlalu paham BE

2. Tech Stack
Framework: React (Vite)

Styling: Tailwind CSS.

Database & Auth: Supabase (PostgreSQL).

Server State Management: TanStack Query (v5) — Digunakan untuk caching katalog produk dari server ke memori lokal browser agar pencarian barcode bersifat instan.

Client State Management: Zustand — Digunakan untuk mengelola logika keranjang belanja (tambah, kurang, hapus, dan hitung total).

3. Architecture & Data Flow
Aplikasi menggunakan pola Cache-First Architecture:

Sync: TanStack Query menarik data dari tabel products Supabase saat aplikasi dimuat.

Scan: useBarcodeScanner (Custom Hook) menangkap input keyboard scanner.

Find: Aplikasi mencari barcode di dalam cache TanStack Query (lokal), bukan melakukan request API baru setiap kali scan.

Action: Jika ditemukan, data produk dikirim ke Zustand Store untuk ditambahkan ke keranjang.

Checkout: Menggunakan TanStack Mutation untuk mengirim data transaksi ke tabel transactions dan transaction_items, serta mengurangi stok produk secara atomik.

4. Database Schema (Supabase)
SQL
-- Produk
products (id, barcode UNIQUE, name, price_sell, stock)
-- Transaksi (Header)
transactions (id, total_price, cash_amount, change_amount, created_at)
-- Detail Transaksi (Items)
transaction_items (id, transaction_id, product_id, qty, subtotal)

5. Folder Structure
.env                          # Credentials Supabase (JANGAN di-commit)
supabase/
└── schema.sql                # SQL setup tabel & function — jalankan di Supabase SQL Editor
src/
├── components/
│   ├── pos/
│   │   ├── Cart.jsx          # Keranjang belanja dengan +/-/hapus item
│   │   └── ScannerListener.jsx # Listener scan → cari di cache TanStack Query
│   └── ui/
│       ├── Button.jsx        # Reusable: variant primary/danger/success/secondary/ghost
│       ├── Input.jsx         # Reusable: input dengan label
│       └── Modal.jsx         # Overlay modal dengan Esc & backdrop click support
├── hooks/
│   └── useBarcodeScanner.js  # Tangkap buffer keyboard cepat + deteksi Enter
├── pages/
│   ├── Cashier.jsx           # Halaman kasir: scan + checkout + modal pembayaran
│   ├── Inventory.jsx         # CRUD produk + search by nama/barcode
│   └── TransactionHistory.jsx # Riwayat transaksi: filter tanggal + detail item
├── services/
│   └── supabase.js           # Supabase client (baca env VITE_SUPABASE_*)
├── store/
│   └── useCartStore.js       # Zustand: addItem, removeItem, decreaseQty, clearCart, getTotal
└── utils/
    └── formatCurrency.js     # formatRupiah(amount) — pakai Intl.NumberFormat id-ID

6. Commands
npm run dev       # Jalankan dev server
npm run build     # Build production
npm run preview   # Preview hasil build

7. Key Conventions
- Tailwind CSS v4 (bukan v3): setup pakai @tailwindcss/vite plugin, bukan postcss.
  Import di CSS: @import "tailwindcss" (bukan @tailwind base/components/utilities)
- QueryKey ['products'] dipakai bersama di Cashier dan Inventory.
  Gunakan queryClient.invalidateQueries({ queryKey: ['products'] }) setelah mutasi.
- ScannerListener mencari barcode di cache via queryClient.getQueryData(['products']),
  BUKAN request API baru. Jangan ubah pola ini.
- Supabase function atomik: decrement_stock(product_id UUID, amount INTEGER)
  Dipanggil via supabase.rpc() saat checkout untuk kurangi stok tanpa race condition.
- formatRupiah() dari utils/formatCurrency.js untuk semua tampilan harga.

8. Key Business Logic
Barcode Scanner: Alat scan bekerja sebagai keyboard. Hook harus menangkap rentetan karakter cepat dan mendeteksi kunci "Enter" sebagai akhir kode.

Real-time Stock: Jika memungkinkan, gunakan fitur Realtime Supabase agar stok di layar kasir terupdate jika admin mengubah data di halaman lain.

Offline Handling: Keranjang belanja disimpan di Zustand agar transaksi tidak hilang jika koneksi internet tidak stabil selama proses pemindaian.

9. Fitur Belum Dibuat (Roadmap)
- Realtime stock update via supabase.channel() di Cashier
- Autentikasi (Role: kasir vs admin — pisah akses halaman Inventory)
- Integrasi printer thermal
- Export laporan penjualan
- Di halaman inventory otomatis buka detail barang jika langsung melakukan scan
- brainstorm tentang pembuatan dashboard

