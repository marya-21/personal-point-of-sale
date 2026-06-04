export function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Format angka dengan pemisah ribuan tanpa prefix "Rp" — untuk tampilan di input field
export function formatNumber(amount: number) {
  return new Intl.NumberFormat('id-ID').format(amount)
}
// Konversi string dengan format ribuan (misal "12.000") menjadi number (12000)
export const toNumber = (str: string) => Number(String(str).replace(/\./g, ''));

