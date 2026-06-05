import { create } from 'zustand'
import type { CartItem, Product } from '../types'

interface CartStore {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  decreaseQty: (productId: string) => void
  clearCart: () => void
  getTotal: () => number
}

const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product) => {
    const { items } = get()
    const existing = items.find((item) => item.id === product.id)

    if (existing) {
      if (existing.qty >= product.stock) return
      set({
        items: items.map((item) =>
          item.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        ),
      })
    } else {
      if (product.stock <= 0) return
      set({ items: [...items, { ...product, qty: 1 }] })
    }
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((item) => item.id !== productId) })
  },

  decreaseQty: (productId: string) => {
    const { items } = get()
    const existing = items.find((item) => item.id === productId)
    if (!existing) return

    if (existing.qty === 1) {
      set({ items: items.filter((item) => item.id !== productId) })
    } else {
      set({
        items: items.map((item) =>
          item.id === productId ? { ...item, qty: item.qty - 1 } : item
        ),
      })
    }
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price_sell * item.qty, 0)
  },
}))

export default useCartStore
