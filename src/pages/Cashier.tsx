import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckout } from "@/services/checkoutService";
import { useProducts } from "@/services/productService";
import useCartStore from "@/store/useCartStore";
import { formatRupiah, formatNumber } from "@/utils/formatCurrency";
import Cart from "@/components/pos/Cart";
import ScannerListener from "@/components/pos/ScannerListener";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { ButtonGroup } from "@/ui/button-group";
import { Input } from "@/ui/input";
import { usePermission } from "@/hooks/useAuth";
import { ShoppingCart } from "lucide-react";
import { ProductV2 } from "@/types";

function CheckoutModal({ isOpen, onClose, total, onSuccess }: any) {
  const [cashAmount, setCashAmount] = useState("");
  const { items, clearCart } = useCartStore();
  const checkoutMutation = useCheckout();

  const cash = parseInt(cashAmount) || 0;
  const change = cash - total;
  const isValid = cash >= total;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;

    const checkoutItems = items.map((item) => ({
      product_id: item.productId,
      unit_id: item.unitId,
      qty: item.qty,
      subtotal: item.price_sell * item.qty,
      price_sell_snapshot: item.price_sell,
      hpp_snapshot: item.price_cost * item.conversion,
    }));

    console.log("Checkout Items:", checkoutItems);

    checkoutMutation.mutate(
      {
        items: checkoutItems,
        cash_amount: cash,
        payment_method: "cash",
        notes: "",
      },
      {
        onSuccess: (data) => {
          clearCart();
          setCashAmount("");
          checkoutMutation.reset();
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

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setCashAmount(digits);
  };

  const displayCash = cashAmount ? formatNumber(parseInt(cashAmount)) : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-n-50 rounded-lg p-4 space-y-3 border border-n-200">
            <div className="flex justify-between">
              <span className="text-caption font-semibold text-n-500">Total Belanja</span>
              <span className="text-display font-extrabold font-mono">{formatRupiah(total)}</span>
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
              className={`rounded-lg p-3 border ${isValid ? "bg-success-bg border-success-bd" : "bg-danger-bg border-danger-bd"}`}
            >
              <div className="flex justify-between">
                <span className={`text-caption ${isValid ? "text-success" : "text-danger"}`}>
                  Kembalian
                </span>
                <span className={`text-body font-bold font-mono ${isValid ? "text-success" : "text-danger"}`}>
                  {isValid ? formatRupiah(change) : "Uang kurang!"}
                </span>
              </div>
            </div>
          )}

          {checkoutMutation.isError && (
            <p className="text-body text-danger">
              {checkoutMutation.error?.message ||
                "Gagal memproses transaksi. Coba lagi."}
            </p>
          )}

          <ButtonGroup fullWidth orientation="horizontal" className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid || checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? "Memproses..." : "Konfirmasi"}
            </Button>
          </ButtonGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuccessModal({ isOpen, data, onClose }: any) {
  const isAdmin = usePermission("view_all_transactions");
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transaksi Berhasil</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-success-bg border border-success-bd rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-success"
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
            <div className="space-y-3 bg-n-50 rounded-lg p-4 border border-n-200">
              <div className="flex justify-between text-caption">
                <span className="text-n-500">Total Penjualan</span>
                <span className="text-body font-semibold font-mono">
                  {formatRupiah(data.total_price)}
                </span>
              </div>
              {isAdmin && (
                <>
                  <div className="flex justify-between text-caption">
                    <span className="text-n-500">Total Modal</span>
                    <span className="text-body font-semibold font-mono">
                      {formatRupiah(data.total_cost)}
                    </span>
                  </div>
                  <div className="border-t border-n-200 pt-3 flex justify-between">
                    <span className="text-caption text-success">
                      Margin
                    </span>
                    <div className="text-right">
                      <p className="text-display text-success font-mono">
                        {formatRupiah(data.total_margin)}
                      </p>
                      <p className="text-caption text-success/80">
                        {data.margin_percent}%
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <p className="text-caption font-semibold text-n-500">Kembalian</p>
            <p className="text-display font-extrabold text-success font-mono">
              {data ? formatRupiah(data.change_amount) : ""}
            </p>
          </div>

          <Button variant="primary" className="w-full" onClick={onClose}>
            Transaksi Baru
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Cashier() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState("");
  const [stockError, setStockError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { getTotal, addItem } = useCartStore();
  const isAdmin = usePermission("view_all_transactions");

  const { data: products = [], isLoading, isError } = useProducts();

  const filtered =
    products?.filter((p: ProductV2) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) ?? [];

  const handleNotFound = (barcode: string) => {
    setNotFoundBarcode(barcode);
    setTimeout(() => setNotFoundBarcode(""), 3000);
  };

  const handleStockError = (msg: string) => {
    setStockError(msg);
    setTimeout(() => setStockError(""), 3000);
  };

  const handleCheckoutSuccess = (data: any) => {
    setShowCheckout(false);
    setSuccessData(data);
  };

  const ProductNotFoundMessage = () =>
    isAdmin ? (
      <div className="flex flex-col items-center mt-8 space-y-3">
        <p className="text-center">
          <span className="font-medium text-n-800">Produk tidak ditemukan</span> <br />
          <span className="text-n-400 text-sm">klik tombol dibawah untuk menambah produk baru</span>
        </p>
        <Button
          variant="primary"
          className="w-40"
          onClick={() => navigate("/inventory?modal=add")}
        >
          + Tambah Produk
        </Button>
      </div>
    ) : (
      <p className="text-center">
        <span className="font-medium text-n-800">Produk tidak ditemukan</span> <br />
        <span className="text-n-400 text-sm">hubungi admin untuk menambah produk yang anda cari</span>
      </p>
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-n-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-n-400 text-sm">Memuat katalog produk...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-n-50">
        <div className="text-center text-danger">
          <p className="font-semibold">Gagal memuat produk</p>
          <p className="text-sm mt-1 text-n-500">
            Periksa koneksi internet dan refresh halaman
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-n-100">
      <ScannerListener onNotFound={handleNotFound} onStockError={handleStockError} />

      {/* Toast notifications */}
      {notFoundBarcode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-danger text-n-0 px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
          Barcode <strong>{notFoundBarcode}</strong> tidak ditemukan
        </div>
      )}
      {stockError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-warning text-n-0 px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
          {stockError}
        </div>
      )}

      {/* Left Panel: Product Search */}
      <div className="flex-1 flex flex-col p-6 min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-n-900">Kasir POS</h1>
        </div>

        <Input
          placeholder="Cari nama produk..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        <div className="flex-1 overflow-y-auto mt-3 space-y-2">
          {filtered.length === 0 ? (
            <ProductNotFoundMessage />
          ) : (
            filtered.map((product: ProductV2) => (
              <div
                key={product.id}
                className="flex flex-col bg-n-0 rounded-lg px-4 py-3 shadow-sm border border-n-200"
              >
                <div className="mb-3">
                  <p className="font-semibold text-n-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-sm">
                    <span
                      className={`font-medium ${product.stock === 0 ? "text-danger" : "text-n-500"}`}
                    >
                      Stok: {product.stock}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {product?.product_units?.map((unit) => (
                    <Button
                      key={unit.id}
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const err = addItem(product, unit)
                        if (err) handleStockError(err)
                      }}
                      disabled={product.stock === 0}
                      title="Tambah ke keranjang"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {unit.name} — <span className="font-mono">{formatRupiah(unit.price_sell)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-96 bg-n-0 border-l border-n-200 flex flex-col p-6">
        <h2 className="text-lg font-semibold text-n-900 mb-4">
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
