import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import useBarcodeScanner from '../../hooks/useBarcodeScanner'
import useCartStore from '../../store/useCartStore'

// Komponen ini tidak merender apapun secara visual.
// Tugasnya hanya mendengarkan scan dan mencari produk di cache.
function ScannerListener({ onNotFound }) {
  const queryClient = useQueryClient()
  const { addItem } = useCartStore()

  const handleScan = useCallback(
    (barcode) => {
      // Cari di cache TanStack Query (tidak ada request API baru)
      const products = queryClient.getQueryData(['products'])
      if (!products) return

      const found = products.find((p) => p.barcode === barcode)
      if (found) {
        addItem(found)
      } else {
        onNotFound?.(barcode)
      }
    },
    [queryClient, addItem, onNotFound]
  )

  useBarcodeScanner(handleScan)

  return null
}

export default ScannerListener
