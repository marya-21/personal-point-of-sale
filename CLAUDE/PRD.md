# Product Requirements Document (PRD) - POS System

## 1. Project Overview
A high-efficiency web-based Point of Sale (POS) system designed for retail environments. The primary focus is transaction speed using barcode scanners and high accuracy in inventory and financial management.

### Vision
To provide a seamless, cache-first experience for cashiers while maintaining robust audit trails and management tools for administrators.

---

## 2. Target Audience & Roles
The system implements Role-Based Access Control (RBAC) with the following personas:
- **Admin**: Full system access, user management, and sensitive data oversight.
- **Manager**: Product management, price adjustments, and financial reporting.
- **Kasir (Cashier)**: Focused on creating transactions and viewing local stock.
- **Warehouse**: Inventory receiving, stock opname, and manual adjustments.
- **Accounting**: Financial reporting, audit logs, and inventory valuation.

---

## 3. Core Features

### A. Cashier Module
- **Barcode Scanning**: HID scanner support with fast buffer processing and Enter detection.
- **Cart Management**: Real-time addition, removal, and quantity adjustments (handled via Zustand).
- **Checkout**: Atomic transaction processing with stock reduction.
- **Payment Processing**: Support for Cash and Debit with automatic change calculation.
- **Thermal Printing**: Support for printing receipts (Roadmap).

### B. Inventory & Product Management
- **Product Registry**: CRUD operations for products with barcode identifiers.
- **Price History**: Tracking every change in cost and selling price with reasons.
- **Stock Tracking**: Automated stock reduction on sales and manual adjustments for warehouse staff.
- **Soft Deletion**: Products are flagged as deleted rather than removed to maintain historical integrity.

### C. Audit & Security
- **Row Level Security (RLS)**: Database-level protection ensuring data isolation between roles.
- **Audit Logs**: Immutable records of sensitive system activities.
- **Margin Audit**: Special monitoring for changes in product profit margins.
- **Session Management**: 30-minute inactivity auto-logout and multi-session tracking.

---

## 4. Technical Architecture

### Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS v4.
- **State Management**: 
  - **Zustand**: Client-side state (Cart, User Preferences).
  - **TanStack Query (v5)**: Server-side state and caching (Cache-First Architecture).
- **Backend**: Supabase (PostgreSQL, Auth, Realtime).

### Data Flow (Cache-First)
1. **Sync**: Products are fetched into local memory on app load.
2. **Scan**: Scanner input is captured and matched against the local cache (zero latency).
3. **Action**: Found products are added to the Zustand cart.
4. **Checkout**: Data is pushed to Supabase; stock is reduced via atomic RPC functions.

---

## 5. Database Schema Highlights
- **`products`**: UUID keys, barcodes, price snapshots, and stock levels.
- **`transactions` & `items`**: Header-detail relationship with margin calculation per transaction.
- **`product_price_history`**: Audit trail for price fluctuations.
- **`audit_logs` & `stock_history`**: Immutable system logs for forensics.

---

## 6. Business Rules
- **Price Integrity**: Selling price cannot be lower than cost price without Admin authorization.
- **Stock Atomicity**: Stock reduction must use database functions (`decrement_stock`) to prevent race conditions.
- **Void Logic**: Voiding a transaction restores stock and logs the movement in `stock_history`.
- **RBAC Enforcement**: Permissions are checked at both UI and Database (RLS) levels.

---

## 7. Roadmap
- [ ] Real-time stock updates via Supabase Channels.
- [ ] Thermal printer integration (ESC/POS).
- [ ] Exportable financial reports (Excel/PDF).
- [ ] Dashboard for sales visualization and trends.
- [ ] Advanced inventory valuation (FIFO/LIFO).
