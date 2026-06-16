import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Product } from '../../types'
import useBarcodeScanner from '../../hooks/useBarcodeScanner'
import useCartStore from '../../store/useCartStore'

function ScannerListener({ onNotFound, onStockError }) {
  const queryClient = useQueryClient()
  const { addItem } = useCartStore()

  const handleScan = useCallback(
    (barcode: string) => {
      const products = queryClient.getQueryData<Product[]>(['products']) ?? []

      let foundProduct = null
      let foundUnit = null

      for (const product of products) {
        const unit = product.product_units?.find((u) => u.barcode === barcode)
        if (unit) {
          foundProduct = product
          foundUnit = unit
          break
        }
      }

      if (foundProduct && foundUnit) {
        const err = addItem(foundProduct, foundUnit)
        if (err) onStockError?.(err)
      } else {
        onNotFound?.(barcode)
      }
    },
    [queryClient, addItem, onNotFound, onStockError]
  )

  useBarcodeScanner(handleScan)

  return null
}

export default ScannerListener
