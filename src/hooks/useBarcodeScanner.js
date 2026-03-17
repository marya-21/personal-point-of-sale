import { useEffect, useRef } from 'react'

// Barcode scanner bekerja seperti keyboard yang mengetik cepat dan
// diakhiri dengan tombol Enter. Hook ini menangkap pola tersebut.
// Threshold: karakter yang datang dalam < 50ms dianggap dari scanner.
const SCAN_TIMEOUT_MS = 50

function useBarcodeScanner(onScan) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      const now = Date.now()
      const timeDiff = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // Jika jeda terlalu lama, anggap input baru (reset buffer)
      if (timeDiff > 500 && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim()
        if (barcode.length > 0) {
          onScan(barcode)
        }
        bufferRef.current = ''
        return
      }

      // Hanya tambahkan karakter printable
      if (e.key.length === 1) {
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan])
}

export default useBarcodeScanner
