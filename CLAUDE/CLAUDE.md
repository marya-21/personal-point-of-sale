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

Session & Auto-Logout:
- Custom auth via localStorage (pos_session + pos_last_activity), bukan Supabase Auth.
- Auto-logout setelah 30 menit tidak ada aktivitas; dicek tiap 1 menit via setInterval.
- Logout (manual/otomatis) hapus localStorage dan panggil queryClient.clear().

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
    ├── auth/
        |__ ProtectRoute.jsx
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


