import useCartStore from '../../store/useCartStore'
import { formatRupiah } from '../../utils/formatCurrency'
import Button from '../ui/Button'

function CartItem({ item }) {
  const { addItem, decreaseQty, removeItem } = useCartStore()

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        <p className="text-xs text-gray-500">{formatRupiah(item.price_sell)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => decreaseQty(item.id)}
          className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 font-bold cursor-pointer"
        >
          -
        </button>
        <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
        <button
          onClick={() => addItem(item)}
          className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700 font-bold cursor-pointer"
        >
          +
        </button>
      </div>
      <div className="text-right min-w-[80px]">
        <p className="text-sm font-semibold text-gray-900">
          {formatRupiah(item.price_sell * item.qty)}
        </p>
      </div>
      <button
        onClick={() => removeItem(item.id)}
        className="text-red-400 hover:text-red-600 text-lg cursor-pointer ml-1"
      >
        &times;
      </button>
    </div>
  )
}

function Cart({ onCheckout }) {
  const { items, clearCart, getTotal } = useCartStore()
  const total = getTotal()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M17 21a1 1 0 100-2 1 1 0 000 2zm-10 0a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        <p className="text-sm">Keranjang kosong</p>
        <p className="text-xs mt-1">Scan produk untuk mulai transaksi</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
        <span className="text-sm text-gray-500">{items.length} item</span>
        <button
          onClick={clearCart}
          className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
        >
          Hapus Semua
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <div className="flex justify-between items-center mb-4">
          <span className="text-base font-semibold text-gray-700">Total</span>
          <span className="text-xl font-bold text-gray-900">{formatRupiah(total)}</span>
        </div>
        <Button
          variant="success"
          className="w-full py-3 text-base"
          onClick={onCheckout}
          disabled={items.length === 0}
        >
          Bayar
        </Button>
      </div>
    </div>
  )
}

export default Cart
