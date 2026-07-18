import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTransactionWithMargins } from "../services/marginService";
import { formatRupiah } from "../utils/formatCurrency";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../hooks/useAuth";
import { useTransactions } from "../services/transactionService";

function DetailModal({ transaction, onClose, isAdmin }: any) {
  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["transaction-detail", transaction?.id],
    queryFn: () => getTransactionWithMargins(transaction.id),
    enabled: !!transaction,
  });

  if (!transaction) return null;

  const dateStr = new Date(transaction.created_at).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <Dialog open={!!transaction} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Transaksi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-caption text-n-400">{dateStr}</p>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-accent-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-body text-danger">Gagal memuat detail</div>
          ) : detail?.data?.items ? (
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-n-200 text-left text-n-400">
                  <th className="pb-2 text-caption font-medium">Produk</th>
                  <th className="pb-2 text-caption font-medium text-center">Qty</th>
                  <th className="pb-2 text-caption font-medium text-right">Harga Satuan</th>
                  <th className="pb-2 text-caption font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-n-100">
                {detail.data.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 text-body text-n-800">
                      {item.products?.name ?? "—"}
                    </td>
                    <td className="py-2 text-body text-center text-n-500 font-mono font-bold">{item.qty}</td>
                    <td className="py-2 text-body text-right text-n-800 font-mono font-bold">
                      {formatRupiah(item.price_sell_snapshot)}
                    </td>
                    <td className="py-2 text-body text-right text-n-800 font-mono font-bold">
                      {formatRupiah(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {detail?.data && (
            <div className="border-t border-n-200 pt-4 space-y-2">
              <div className="flex justify-between text-caption">
                <span className="text-n-500">Total Penjualan</span>
                <span className="text-body font-semibold font-mono">
                  {formatRupiah(detail.data.total_price)}
                </span>
              </div>
              {isAdmin && (
                <>
                  <div className="flex justify-between text-caption">
                    <span className="text-n-500">Total Modal</span>
                    <span className="text-body font-semibold font-mono">
                      {formatRupiah(detail.data.total_cost)}
                    </span>
                  </div>
                  <div className="bg-success-bg border border-success-bd rounded-lg p-2 flex justify-between">
                    <span className="text-caption font-semibold text-success">Margin</span>
                    <div className="text-right">
                      <p className="text-display font-bold text-success font-mono">
                        {formatRupiah(detail.data.total_margin)}
                      </p>
                      <p className="text-caption text-success/80">
                        {detail.data.margin_percent}%
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between border-t border-n-200 pt-2">
                <span className="text-n-600">Tunai</span>
                <span className="font-mono">{formatRupiah(detail.data.cash_amount)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Kembalian</span>
                <span className="font-mono">{formatRupiah(detail.data.change_amount)}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransactionHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selected, setSelected] = useState(null);

  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("view_all_transactions");

  const {
    data: transactions,
    isLoading,
    isError,
    refetch,
  } = useTransactions(dateFrom, dateTo);

  const totalRevenue =
    transactions?.reduce((sum, t) => sum + t.total_price, 0) ?? 0;
  const totalCost =
    transactions?.reduce((sum, t) => sum + (t.total_cost || 0), 0) ?? 0;
  const totalMargin = totalRevenue - totalCost;
  const marginPercent =
    totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(2) : 0;

  return (
    <div className="height-screen bg-n-100 p-8">
      <h1 className="text-title font-bold text-n-900 mb-6">
        {isAdmin ? "Riwayat Transaksi" : "Transaksi Saya"}
      </h1>

      {/* Filter tanggal */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-caption text-n-500">Dari</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-n-200 rounded-lg px-3 py-2 text-body bg-n-0 text-n-800 focus:outline-none focus:ring-2 focus:ring-accent-600/30 focus:border-accent-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-caption text-n-500">Sampai</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-n-200 rounded-lg px-3 py-2 text-body bg-n-0 text-n-800 focus:outline-none focus:ring-2 focus:ring-accent-600/30 focus:border-accent-600"
          />
        </div>
        <button
          onClick={() => {
            setDateFrom(today);
            setDateTo(today);
          }}
          className="px-3 py-2 text-body text-accent-600 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors font-medium"
        >
          Hari Ini
        </button>
      </div>

      {/* Ringkasan */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-n-0 rounded-xl border border-n-200 px-4 py-3">
            <p className="text-caption font-semibold text-n-400">Jumlah Transaksi</p>
            <p className="text-display font-extrabold text-n-900 mt-1">
              {transactions?.length ?? 0}
            </p>
          </div>
          <div className="bg-n-0 rounded-xl border border-n-200 px-4 py-3">
            <p className="text-caption font-semibold text-n-400">Omzet Penjualan</p>
            <p className="text-display font-extrabold text-accent-600 mt-1">
              {formatRupiah(totalRevenue)}
            </p>
          </div>

          {isAdmin && (
            <>
              <div className="bg-n-0 rounded-xl border border-n-200 px-4 py-3">
                <p className="text-caption font-semibold text-n-400">Modal Produk</p>
                <p className="text-display font-extrabold text-n-800 mt-1">
                  {formatRupiah(totalCost)}
                </p>
              </div>
              <div className="bg-success-bg rounded-xl border border-success-bd px-4 py-3">
                <p className="text-caption font-semibold text-success dash-underline-tooltip">
                  Keuntungan
                </p>
                <p className="text-display font-extrabold text-success mt-1">
                  {formatRupiah(totalMargin)}
                </p>
                <p className="text-caption font-semibold text-success/70 mt-1">
                  {marginPercent}% dari penjualan
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* List transaksi */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-danger">
          <p className="font-semibold">Gagal memuat data</p>
          <button onClick={() => refetch()} className="text-sm mt-2 underline text-n-500">
            Coba lagi
          </button>
        </div>
      ) : transactions?.length === 0 ? (
        <div className="text-center py-16 text-n-400">
          <p>Tidak ada transaksi pada rentang tanggal ini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(transactions || []).map((tx) => {
            const date = new Date(tx.created_at);
            return (
              <button
                key={tx.id}
                onClick={() => setSelected(tx)}
                className="cursor-pointer w-full text-left bg-n-0 rounded-xl border border-n-200 px-4 py-4 hover:border-accent-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-n-900">
                      {tx.transaction_items?.length > 0
                        ? tx.transaction_items
                          .map((item: any) => `${item.products?.name || "—"}`)
                          .join(", ")
                        : "—"}
                    </p>
                    <p className="text-xs text-n-400 mt-0.5">
                      {tx.transaction_items?.length} item
                    </p>
                    <p className="text-xs text-n-300 mt-0.5">
                      {date.toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-n-900 font-mono">
                      {formatRupiah(tx.total_price)}
                    </p>
                    <div className="text-xs text-n-500 font-mono">
                      <p>Tunai {formatRupiah(tx.cash_amount)}</p>
                      <p className="text-success">
                        Kembalian {formatRupiah(tx.change_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DetailModal
        transaction={selected}
        onClose={() => setSelected(null)}
        isAdmin={isAdmin}
      />
    </div>
  );
}

export default TransactionHistory;
