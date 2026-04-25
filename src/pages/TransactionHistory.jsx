import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { getTransactionWithMargins } from "../services/marginService";
import { formatRupiah } from "../utils/formatCurrency";
import Modal from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";

async function fetchTransactions({ dateFrom, dateTo, cashierId }) {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
  if (cashierId) query = query.eq("created_by", cashierId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function DetailModal({ transaction, onClose }) {
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
    <Modal isOpen={!!transaction} onClose={onClose} title="Detail Transaksi">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{dateStr}</p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">Gagal memuat detail</div>
        ) : detail?.data?.items ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">Produk</th>
                <th className="pb-2 font-medium text-center">Qty</th>
                <th className="pb-2 font-medium text-right">Harga Satuan</th>
                <th className="pb-2 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.data.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-900">
                    {item.products?.name ?? "—"}
                  </td>
                  <td className="py-2 text-center text-gray-600">{item.qty}</td>
                  <td className="py-2 text-right text-gray-900">
                    {formatRupiah(item.price_sell_snapshot)}
                  </td>
                  <td className="py-2 text-right text-gray-900">
                    {formatRupiah(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {detail?.data && (
          <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Penjualan</span>
              <span className="font-semibold">
                {formatRupiah(detail.data.total_price)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Modal</span>
              <span className="font-semibold">
                {formatRupiah(detail.data.total_cost)}
              </span>
            </div>
            <div className="bg-green-50 rounded p-2 flex justify-between">
              <span className="font-semibold text-green-700">Margin</span>
              <div className="text-right">
                <p className="font-bold text-green-700">
                  {formatRupiah(detail.data.total_margin)}
                </p>
                <p className="text-xs text-green-600">
                  {detail.data.margin_percent}%
                </p>
              </div>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span>Tunai</span>
              <span>{formatRupiah(detail.data.cash_amount)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Kembalian</span>
              <span>{formatRupiah(detail.data.change_amount)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TransactionHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selected, setSelected] = useState(null);

  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission("view_all_transactions");
  const cashierId = isAdmin ? null : user?.id;

  const {
    data: transactions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["transactions", dateFrom, dateTo, cashierId],
    queryFn: () => fetchTransactions({ dateFrom, dateTo, cashierId }),
  });

  const totalRevenue =
    transactions?.reduce((sum, t) => sum + t.total_price, 0) ?? 0;
  const totalCost =
    transactions?.reduce((sum, t) => sum + (t.total_cost || 0), 0) ?? 0;
  const totalMargin = totalRevenue - totalCost;
  const marginPercent =
    totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(2) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isAdmin ? "Riwayat Transaksi" : "Transaksi Saya"}
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
          onClick={() => {
            setDateFrom(today);
            setDateTo(today);
          }}
          className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Hari Ini
        </button>
      </div>

      {/* Ringkasan */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Jumlah Transaksi</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {transactions?.length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Total Penjualan</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatRupiah(totalRevenue)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Total Modal</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatRupiah(totalCost)}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 px-4 py-3">
            <p className="text-xs text-green-600 font-medium">Total Margin</p>
            <p className="text-2xl font-bold text-green-700 mt-1">
              {formatRupiah(totalMargin)}
            </p>
            <p className="text-xs text-green-600 mt-1">{marginPercent}%</p>
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
          <button onClick={() => refetch()} className="text-sm mt-2 underline">
            Coba lagi
          </button>
        </div>
      ) : transactions?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Tidak ada transaksi pada rentang tanggal ini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const date = new Date(tx.created_at);
            return (
              <button
                key={tx.id}
                onClick={() => setSelected(tx)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 px-4 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {formatRupiah(tx.total_price)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {date.toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-600">
                      <p>Tunai {formatRupiah(tx.cash_amount)}</p>
                      <p className="text-green-600">
                        Kembalian {formatRupiah(tx.change_amount)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded px-2 py-1">
                      <p className="text-xs font-semibold text-green-700">
                        {formatRupiah(tx.total_margin || 0)}
                      </p>
                      <p className="text-xs text-green-600">
                        {tx.margin_percent || 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DetailModal transaction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default TransactionHistory;
