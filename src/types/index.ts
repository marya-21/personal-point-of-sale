export interface Product {
  id: string
  name: string
  barcode: string
  price: number
  stock: number
  cost_price?: number
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
