# POS System (Point of Sale)

A modern, fast, and secure web-based POS system built with React, Tailwind CSS, and Supabase. Designed specifically for efficiency with barcode scanners and robust stock management.

## 🚀 Key Features
- **Fast Scanning**: Cache-first architecture using TanStack Query for instant barcode lookups.
- **Role-Based Access**: Multi-role support (Admin, Manager, Kasir, Warehouse, Accounting).
- **Audit Trails**: Complete history of price changes, stock movements, and system logs.
- **Reliable Cart**: Client-side state management with Zustand to prevent data loss.
- **Secure**: Row Level Security (RLS) and atomic stock operations.

## 🛠 Tech Stack
- **Frontend**: React (Vite)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **State**: TanStack Query v5 & Zustand

## 🏁 Getting Started

### Prerequisites
- Node.js (Latest LTS)
- Supabase Account

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Setup environment variables in `.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure
- `src/components/pos`: Core POS logic and UI.
- `src/hooks`: Custom hooks like `useBarcodeScanner`.
- `src/store`: Zustand stores for cart and session.
- `CLAUDE/`: Detailed documentation for database, roles, and policies.

## 📜 Role Matrix Summary
| Feature | Kasir | Admin | Warehouse | Accounting |
| :--- | :---: | :---: | :---: | :---: |
| Create Transaction | ✓ | ✓ | - | - |
| View Stock | ✓ | ✓ | ✓ | - |
| Adjust Stock | - | ✓ | ✓ | - |
| View Financials | - | ✓ | - | ✓ |
| Manage Users | - | ✓ | - | - |

## 🛠 Development Commands
- `npm run build`: Production build.
- `npm run preview`: Preview production build locally.
