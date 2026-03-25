import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { formatRupiah } from '../utils/formatCurrency'
import Modal from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'

async function fetchTransactions({ dateFrom, dateTo, cashierId }) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
  if (cashierId) query = query.eq('cashier_id', cashierId)

  const { data, error } = await query
  if (error) throw error
  return data
}

async function fetchTransactionDetail(transactionId) {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('qty, subtotal, products(name, price_sell)')
    .eq('transaction_id', transactionId)

  if (error) throw error
  return data
}

function DetailModal({ transaction, onClose }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ['transaction-detail', transaction?.id],
    queryFn: () => fetchTransactionDetail(transaction.id),
    enabled: !!transaction,
  })

  if (!transaction) return null

  const dateStr = new Date(transaction.created_at).toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  return (
    <Modal isOpen={!!transaction} onClose={onClose} title="Detail Transaksi">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{dateStr}</p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">Produk</th>
                <th className="pb-2 font-medium text-center">Qty</th>
                <th className="pb-2 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items?.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-900">{item.products?.name ?? '—'}</td>
                  <td className="py-2 text-center text-gray-600">{item.qty}</td>
                  <td className="py-2 text-right text-gray-900">{formatRupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatRupiah(transaction.total_price)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tunai</span>
            <span>{formatRupiah(transaction.cash_amount)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Kembalian</span>
            <span>{formatRupiah(transaction.change_amount)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function TransactionHistory() {
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [selected, setSelected] = useState(null)

  const { user, hasPermission } = useAuth()
  const isAdmin = hasPermission('view_all_transactions')
  const cashierId = isAdmin ? null : user?.id

  const { data: transactions, isLoading, isError, refetch } = useQuery({
    queryKey: ['transactions', dateFrom, dateTo, cashierId],
    queryFn: () => fetchTransactions({ dateFrom, dateTo, cashierId }),
  })

  const totalRevenue = transactions?.reduce((sum, t) => sum + t.total_price, 0) ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isAdmin ? 'Riwayat Transaksi' : 'Transaksi Saya'}
      </h1>

      {/* Filter tanggal */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Dari</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Sampai</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setDateFrom(today); setDateTo(today) }}
          className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Hari Ini
        </button>
      </div>

      {/* Ringkasan */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{transactions?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Total Pendapatan</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatRupiah(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* List transaksi */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-red-500">
          <p className="font-semibold">Gagal memuat data</p>
          <button onClick={refetch} className="text-sm mt-2 underline">Coba lagi</button>
        </div>
      ) : transactions?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Tidak ada transaksi pada rentang tanggal ini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const date = new Date(tx.created_at)
            return (
              <button
                key={tx.id}
                onClick={() => setSelected(tx)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{formatRupiah(tx.total_price)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Tunai {formatRupiah(tx.cash_amount)}</p>
                    <p className="text-green-600">Kembalian {formatRupiah(tx.change_amount)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <DetailModal transaction={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export default TransactionHistory
