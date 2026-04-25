import { useState } from "react";
import { useCheckout } from "../services/checkoutService";
import { useProducts } from "../services/productService";
import useCartStore from "../store/useCartStore";
import { formatRupiah, formatNumber } from "../utils/formatCurrency";
import Cart from "../components/pos/Cart";
import ScannerListener from "../components/pos/ScannerListener";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

function CheckoutModal({ isOpen, onClose, total, onSuccess }) {
  const [cashAmount, setCashAmount] = useState("");
  const { items, clearCart } = useCartStore();
  const checkoutMutation = useCheckout();

  const cash = parseInt(cashAmount) || 0;
  const change = cash - total;
  const isValid = cash >= total;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;

    checkoutMutation.mutate(
      {
        items: items.map((item) => ({
          product_id: item.id,
          qty: item.qty,
        })),
        cash_amount: cash,
        payment_method: "cash",
      },
      {
        onSuccess: (data) => {
          clearCart();
          onSuccess(data);
        },
      },
    );
  };

  const handleClose = () => {
    setCashAmount("");
    checkoutMutation.reset();
    onClose();
  };

  const handleCashChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    setCashAmount(digits);
  };

  const displayCash = cashAmount ? formatNumber(parseInt(cashAmount)) : "";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Pembayaran">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Belanja</span>
            <span className="font-bold text-lg">{formatRupiah(total)}</span>
          </div>
        </div>

        <Input
          label="Jumlah Uang Tunai"
          type="text"
          inputMode="numeric"
          placeholder="Masukkan jumlah uang"
          value={displayCash}
          onChange={handleCashChange}
          autoFocus
        />

        {cashAmount && (
          <div
            className={`rounded-lg p-3 ${isValid ? "bg-green-50" : "bg-red-50"}`}
          >
            <div className="flex justify-between">
              <span className={isValid ? "text-green-700" : "text-red-700"}>
                Kembalian
              </span>
              <span
                className={`font-bold ${isValid ? "text-green-700" : "text-red-700"}`}
              >
                {isValid ? formatRupiah(change) : "Uang kurang!"}
              </span>
            </div>
          </div>
        )}

        {checkoutMutation.isError && (
          <p className="text-sm text-red-600">
            {checkoutMutation.error?.message ||
              "Gagal memproses transaksi. Coba lagi."}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="success"
            className="flex-1"
            disabled={!isValid || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? "Memproses..." : "Konfirmasi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SuccessModal({ isOpen, data, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaksi Berhasil">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {data && (
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Penjualan</span>
              <span className="font-semibold">
                {formatRupiah(data.total_price)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Modal</span>
              <span className="font-semibold">
                {formatRupiah(data.total_cost)}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-green-700">
                Margin
              </span>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {formatRupiah(data.total_margin)}
                </p>
                <p className="text-xs text-green-600">{data.margin_percent}%</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-gray-600 text-sm">Kembalian</p>
          <p className="text-3xl font-bold text-green-600">
            {data ? formatRupiah(data.change_amount) : ""}
          </p>
        </div>

        <Button variant="primary" className="w-full" onClick={onClose}>
          Transaksi Baru
        </Button>
      </div>
    </Modal>
  );
}

function Cashier() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { getTotal, addItem } = useCartStore();

  // Use service hook untuk products
  const { data: products = [], isLoading, isError } = useProducts();

  const filtered =
    products?.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) ?? [];

  const handleNotFound = (barcode) => {
    setNotFoundBarcode(barcode);
    setTimeout(() => setNotFoundBarcode(""), 3000);
  };

  const handleCheckoutSuccess = (data) => {
    setShowCheckout(false);
    setSuccessData(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat katalog produk...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-500">
          <p className="font-semibold">Gagal memuat produk</p>
          <p className="text-sm mt-1">
            Periksa koneksi internet dan refresh halaman
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <ScannerListener onNotFound={handleNotFound} />

      {/* Notification barcode tidak ditemukan */}
      {notFoundBarcode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm">
          Barcode <strong>{notFoundBarcode}</strong> tidak ditemukan
        </div>
      )}

      {/* Left Panel: Product Search */}
      <div className="flex-1 flex flex-col p-6 min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Kasir POS</h1>
        </div>

        <Input
          placeholder="Cari nama produk..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        <div className="flex-1 overflow-y-auto mt-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-8">
              Produk tidak ditemukan
            </p>
          ) : (
            filtered.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatRupiah(product.price_sell)}
                    <span
                      className={`ml-2 ${product.stock === 0 ? "text-red-500" : "text-gray-400"}`}
                    >
                      · Stok: {product.stock}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => addItem(product)}
                  disabled={product.stock === 0}
                  className="ml-3 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shrink-0"
                >
                  +
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-96 bg-white shadow-lg flex flex-col p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Keranjang Belanja
        </h2>
        <div className="flex-1 overflow-hidden">
          <Cart onCheckout={() => setShowCheckout(true)} />
        </div>
      </div>

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        total={getTotal()}
        onSuccess={handleCheckoutSuccess}
      />

      <SuccessModal
        isOpen={!!successData}
        data={successData}
        onClose={() => setSuccessData(null)}
      />
    </div>
  );
}

export default Cashier;
