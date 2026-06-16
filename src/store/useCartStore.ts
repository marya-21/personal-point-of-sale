import { create } from 'zustand'
import type { CartItem, Product, ProductUnit } from '../types'

interface CartStore {
  items: CartItem[]
  addItem: (product: Product, unit: ProductUnit) => string | null
  removeItem: (productId: string, unitId: string) => void
  decreaseQty: (productId: string, unitId: string) => void
  clearCart: () => void
  getTotal: () => number
}

const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product: Product, unit: ProductUnit) => {
    const { items } = get()
    const existing = items.find((item) => item.productId === product.id && item.unitId === unit.id)

    const totalBaseQtyInCart = items
      .filter((item) => item.productId === product.id)
      .reduce((sum, item) => sum + item.qty * item.conversion, 0)

    const baseUnit = product.product_units?.find(u => u.is_base)
    const baseName = baseUnit?.name || 'unit'
    const remaining = product.stock - totalBaseQtyInCart

    if (existing) {
      const requiredBaseQty = totalBaseQtyInCart + unit.conversion
      if (requiredBaseQty > product.stock) {
        return `Stok ${product.name} tidak cukup (sisa ${remaining} ${baseName})`
      }
      set({
        items: items.map((item) =>
          item.productId === product.id && item.unitId === unit.id
            ? { ...item, qty: item.qty + 1 }
            : item
        ),
      })
      return null
    } else {
      if (product.stock <= 0) {
        return `Stok ${product.name} habis`
      }
      const requiredBaseQty = totalBaseQtyInCart + unit.conversion
      if (requiredBaseQty > product.stock) {
        return `Stok ${product.name} tidak cukup (sisa ${remaining} ${baseName})`
      }
      set({
        items: [
          ...items,
          {
            productId: product.id,
            unitId: unit.id,
            name: product.name,
            unitName: unit.name,
            price_sell: unit.price_sell,
            conversion: unit.conversion,
            stock: product.stock,
            price_cost: product.price_cost,
            qty: 1,
          },
        ],
      })
      return null
    }
  },

  removeItem: (productId: string, unitId: string) => {
    set({ items: get().items.filter((item) => !(item.productId === productId && item.unitId === unitId)) })
  },

  decreaseQty: (productId: string, unitId: string) => {
    const { items } = get()
    const existing = items.find((item) => item.productId === productId && item.unitId === unitId)
    if (!existing) return

    if (existing.qty === 1) {
      set({ items: items.filter((item) => !(item.productId === productId && item.unitId === unitId)) })
    } else {
      set({
        items: items.map((item) =>
          item.productId === productId && item.unitId === unitId
            ? { ...item, qty: item.qty - 1 }
            : item
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
