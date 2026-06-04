export interface Product {
  id: string
  name: string
  barcode: string
  stock: number
  price_sell: number
  price_cost: number
}

export interface CartItem extends Product {
  quantity: number
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
