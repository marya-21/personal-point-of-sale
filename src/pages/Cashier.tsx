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
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { usePermission } from "@/hooks/useAuth";
import { ShoppingCart, Package, Layers, Barcode, Search } from "lucide-react";
import { ProductV2 } from "@/types";
import { toast } from "sonner";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

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
            <span className="text-display font-extrabold font-mono">{formatRupiah(total)}</span>
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
            <p className="text-caption contents mt-5 font-semibold text-n-500">Kembalian</p>
            <p className="text-display font-extrabold text-success">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { getTotal, addItem, items } = useCartStore();
  const isAdmin = usePermission("view_all_transactions");

  const { data: products = [], isLoading, isError } = useProducts();

  const badgeVariant = (stock: number) => {
    if (stock === 0) return "destructive";
    if (stock <= 5) return "warning";
    return "success";
  }

  const stockStatusText = (stock: number) => {
    if (stock === 0) return "Habis";
    if (stock <= 5) return "Sisa";
    return "Stok";
  }

  const filtered =
    products?.filter((p: ProductV2) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) ?? [];

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
      <ScannerListener />

      {/* Left Panel: Product Search */}
      <div className="flex-1 flex flex-col p-6 min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-n-900">Kasir POS</h1>
        </div>

        <InputGroup>
          <InputGroupButton >
            <Search />
          </InputGroupButton>
          <InputGroupInput
            id="password"
            type='text'
            placeholder="Cari atau scan produk"
            autoComplete="current-password"
            className="pr-3 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-textfield-decoration-container]:hidden"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </InputGroup>


        <div className="flex-1 overflow-y-auto mt-6">
          {filtered.length === 0 ? (
            <ProductNotFoundMessage />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((product: ProductV2) => {
                const selectedUnit =
                  product.product_units.find(
                    (unit) => unit.id === selectedUnitIds[product.id],
                  ) ?? product.product_units[0];

                return (
                  <Card
                    key={product.id}
                    className={`flex flex-col overflow-hidden hover:shadow-md transition-shadow ${product.stock === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <div className="flex-1 p-4 flex flex-col gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-body font-semibold text-n-900 line-clamp-2 mb-1 truncate">
                            {product.name}
                          </p>
                          <Badge variant={badgeVariant(product.stock)}>
                            {stockStatusText(product.stock)} {product.stock > 99 ? "99+" : product.stock}
                          </Badge>
                        </div>

                        {/* <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-caption font-semibold text-n-500">
                            SKU {product.sku || "N/A"}
                          </p>
                      </div> */}
                      </div>

                      <div className="grid gap-3">
                        <div>
                          <p className="text-caption font-semibold uppercase tracking-[0.15em] text-n-500 mb-2">
                            Pilih Satuan
                          </p>

                          <div className="grid grid-cols-3 gap-2">
                            {product.product_units.map((unit) => {
                              const isActive = unit.id === selectedUnit?.id;
                              return (
                                <button
                                  key={unit.id}
                                  type="button"
                                  onClick={() => setSelectedUnitIds((prev) => ({ ...prev, [product.id]: unit.id }))}
                                  className={`rounded-sm cursor-pointer border px-3 py-2 text-xs font-semibold transition ${isActive ? "border-n-100 bg-n-100" : "border-n-200 bg-n-0 text-n-700 hover:bg-n-50"}`}
                                >
                                  {unit.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="rounded-md border border-n-200 bg-n-50 p-4">
                          <p className="text-display font-extrabold text-n-900">
                            {selectedUnit ? formatRupiah(selectedUnit.price_sell) : "-"}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-n-500">
                            {selectedUnit && (
                              <Badge variant="outline" >
                                <Layers size={10} className="mr-1" />
                                Isi {selectedUnit.conversion} {product.product_units[0]?.name || "Pcs"}
                              </Badge>
                            )}
                            {selectedUnit?.barcode && (
                              <Badge variant="outline" >
                                <Barcode size={10} className="mr-1" />
                                {selectedUnit.barcode}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <Button
                          type="button"
                          variant="primary"
                          className="w-full text-xs"
                          disabled={product.stock === 0}
                          onClick={() => {
                            if (!selectedUnit) return;
                            const err = addItem(product, selectedUnit);
                            if (err) toast.warning(err);
                          }}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Tambah
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )
          }
        </div >
      </div >

      {/* Right Panel: Cart */}
      < div className="w-96 bg-n-0 border-l border-n-200 flex flex-col p-6" >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-body font-semibold text-n-900">
            Keranjang
          </h2>
          {items.length > 0 && (
            <Badge variant="info">
              {items.length} item
            </Badge>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <Cart onCheckout={() => setShowCheckout(true)} />
        </div>
      </div >

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
    </div >
  );
}

export default Cashier;
