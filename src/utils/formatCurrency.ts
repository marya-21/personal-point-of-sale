export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Format angka dengan pemisah ribuan tanpa prefix "Rp" — untuk tampilan di input field
export function formatNumber(amount) {
  return new Intl.NumberFormat('id-ID').format(amount)
}
