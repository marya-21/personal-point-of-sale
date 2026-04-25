Draf dokumentasi **Database Policies (RLS - Row Level Security)** dan **Business Logic Policies**. Dokumentasi ini berfokus pada aturan akses data dan integritas bisnis untuk sistem POS tersebut.

---

# Dokumentasi Database Policy & Access Control

Dokumentasi ini menjelaskan aturan keamanan (Policy) yang diterapkan pada tabel-tabel utama untuk memastikan integritas data dan pembatasan akses berdasarkan peran pengguna (*RBAC*).

## 1. Kebijakan Keamanan Global (RLS)
Semua tabel dalam skema ini wajib mengaktifkan **Row Level Security (RLS)**. Secara umum, akses dibagi menjadi:
- **Admin**: Akses penuh (CRUD) pada semua tabel.
- **Manager**: Akses penuh pada produk dan laporan, namun terbatas pada pengaturan sistem.
- **Kasir (Staff)**: Akses baca pada produk, akses buat (Create) pada transaksi, dan dilarang mengubah histori/audit.

---

## 2. Policy Per Tabel

### A. Tabel `products`
| Aksi | Policy | Keterangan |
| :--- | :--- | :--- |
| **SELECT** | Authenticated Users | Semua staf yang login bisa melihat daftar produk dan stok. |
| **INSERT/UPDATE** | Role: Admin, Manager | Hanya level manager ke atas yang boleh menambah barang atau mengubah harga modal. |
| **DELETE** | Soft Delete Only | Data tidak boleh dihapus permanen (`is_deleted = true`). |

### B. Tabel `transactions` & `transaction_items`
| Aksi | Policy | Keterangan |
| :--- | :--- | :--- |
| **SELECT** | Owner / Admin | Kasir hanya bisa melihat transaksi yang mereka buat hari ini. Admin bisa melihat semua. |
| **INSERT** | Role: Kasir, Admin | Diizinkan saat melakukan proses checkout. |
| **UPDATE** | Deny All (kecuali Void) | Transaksi yang sudah selesai tidak boleh diubah datanya, kecuali kolom `voided`. |

### C. Tabel `audit_logs` & `stock_history`
| Aksi | Policy | Keterangan |
| :--- | :--- | :--- |
| **SELECT** | Role: Admin | Hanya admin yang boleh melakukan audit forensik data. |
| **INSERT** | System Generated | Dipicu otomatis oleh *Database Trigger* saat terjadi perubahan data. |
| **UPDATE/DELETE** | Immutable | Data histori tidak boleh diubah atau dihapus oleh siapapun (termasuk Admin) untuk menjaga validitas audit. |

---

## 3. Aturan Bisnis (Business Logic Policies)

### 1. Kebijakan Perubahan Harga (`product_price_history`)
Setiap kali kolom `price_sell` atau `price_cost` pada tabel `products` diperbarui, sistem wajib:
- Menyimpan nilai lama ke `old_price`.
- Menyimpan nilai baru ke `new_price`.
- Mencatat `changed_by` (ID pengguna yang mengubah) dan `reason`.

### 2. Kebijakan Pengurangan Stok
- **Transaksi Berhasil**: Stok pada `products` berkurang otomatis sesuai jumlah `qty` di `transaction_items`.
- **Void Transaksi**: Jika transaksi di-void (`voided = true`), stok harus dikembalikan (restock) secara otomatis dan dicatat di `stock_history`.

### 3. Kebijakan Keamanan User (`sessions`)
- Satu akun hanya boleh memiliki maksimal 3 sesi aktif (opsional, tergantung kebutuhan).
- Sesi otomatis berakhir (expired) jika `expires_at` terlampaui.
- Setiap login wajib mencatat `ip_address` dan `user_agent` untuk melacak perangkat yang digunakan kasir.

### 4. Kebijakan Margin
- Sistem tidak boleh mengizinkan `price_sell` lebih rendah dari `price_cost` kecuali mendapatkan otorisasi khusus dari Admin (untuk mencegah kerugian).
- Perubahan pada nilai margin yang signifikan akan memicu log ke `margin_audit_log`.

---

## 4. Matriks Akses Peran (RBAC)

| Modul | Kasir | Manager | Admin |
| :--- | :---: | :---: | :---: |
| Lihat Stok | ✅ | ✅ | ✅ |
| Ubah Harga | ❌ | ✅ | ✅ |
| Void Transaksi | ❌ | ✅ | ✅ |
| Tarik Laporan Profit | ❌ | ✅ | ✅ |
| Manajemen User | ❌ | ❌ | ✅ |
| Hapus Log Audit | ❌ | ❌ | ❌ |
