export interface Product {
  id: string
  name: string
  barcode: string
  stock: number
  price_sell: number
  price_cost: number
  product_units?: ProductUnit[]
}

export interface CartItem {
  productId: string
  unitId: string
  name: string
  unitName: string
  price_sell: number
  conversion: number
  stock: number
  price_cost: number
  qty: number
}

export interface Transaction {
  id: string
  created_at: string
  total: number
  items: CartItem[]
  cashier_id: string
}

export type UserRole = 'admin' | 'cashier'

export interface AppUser {
  id: string
  email: string
  role: UserRole
}

export interface ProductUnit {
  id: string;              // uuid untuk unit yang sudah ada, atau temp id untuk baru
  name: string;
  conversion: number;      // 1 untuk base unit, locked
  is_base: boolean;
  barcode: string;
  price_sell: number;
}
export interface ProductV2 {
  id: string;
  name: string;
  price_cost: number;
  barcode: string; // !Temporary
  price_sell: number; // !Temporary
  stock: number;
  product_units: ProductUnit[];
}

export interface CheckoutItem {
  product_id: string
  unit_id: string
  qty: number
  subtotal: number
  price_sell_snapshot: number
  hpp_snapshot: number
}

export interface CheckoutRequest {
  items: CheckoutItem[]
  cash_amount: number
  payment_method: string
  notes: string
}