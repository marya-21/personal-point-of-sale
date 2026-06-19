import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SquarePen, Trash, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import {
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useRestockProduct,
  fetchProductsList,
  fetchProductDetail,
} from "@/services/productService";
import { formatRupiah } from "../utils/formatCurrency";
import ProductForm from "@/components/inventory/ProductForm";
import RestockForm from "@/components/inventory/RestockForm";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth, usePermission } from "@/hooks/useAuth";
import { Product, ProductV2 } from "@/types";

type TopSellingItem = {
  name: string;
  qty: number;
};

async function fetchTopSelling(): Promise<TopSellingItem[]> {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("product_id, qty, products(name)");
  if (error) throw error;

  const totals: Record<string, TopSellingItem> = {};
  const rows = Array.isArray(data)
    ? (data as Array<{
      product_id: string;
      qty: number;
      products?: { name?: string };
    }>)
    : [];

  for (const item of rows) {
    const id = item.product_id;
    if (!totals[id]) totals[id] = { name: item.products?.name ?? "—", qty: 0 };
    totals[id].qty += item.qty;
  }

  return Object.values(totals).sort((a, b) => b.qty - a.qty);
}

const LOW_STOCK_THRESHOLD = 10;

function TopSellingPanel({ items }: { items: TopSellingItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const preview = items.slice(0, 4);

  return (
    <>
      <div className="bg-background rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Barang Terlaris</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            Belum ada data transaksi.
          </p>
        ) : (
          <ol className="space-y-2">
            {preview.map((item, i) => (
              <li key={item.name} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-800 flex-1 truncate">
                  {item.name}
                </span>
                <span className="text-xs text-gray-400">
                  {item.qty} terjual
                </span>
              </li>
            ))}
          </ol>
        )}
        {items.length > 4 && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            See more →
          </button>
        )}
      </div>

      <Dialog open={showAll} onOpenChange={() => setShowAll(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Barang Terlaris</DialogTitle>
          </DialogHeader>
          <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {items.map((item, i) => (
              <li
                key={item.name}
                className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0"
              >
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-800 flex-1">{item.name}</span>
                <span className="text-sm font-semibold text-gray-600">
                  {item.qty} terjual
                </span>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StockAlertPanel({ outOfStock, lowStock }: { outOfStock: Product[]; lowStock: Product[] }) {
  const [showAll, setShowAll] = useState(false);

  const combined = [
    ...outOfStock.map((p) => ({ ...p, _status: "habis" as const })),
    ...lowStock.map((p) => ({ ...p, _status: "mau_habis" as const })),
  ];
  const preview = combined.slice(0, 4);

  return (
    <>
      <div className="bg-background rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Stok</h2>
        {combined.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Semua stok aman.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${item._status === "habis" ? "bg-error" : "bg-warning"
                    }`}
                />
                <span className="text-sm text-gray-800 flex-1 truncate">
                  {item.name}
                </span>
                <span
                  className={`text-xs font-semibold ${item._status === "habis"
                    ? "text-error"
                    : "text-warning"
                    }`}
                >
                  {item.stock === 0 ? "Habis" : `Sisa ${item.stock}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {combined.length > 4 && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            See more →
          </button>
        )}
      </div>

      <Dialog open={showAll} onOpenChange={() => setShowAll(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stok Habis & Akan Habis</DialogTitle>
          </DialogHeader>
          {outOfStock.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase text-error mb-2 tracking-wider">
                Habis
              </p>
              <ul className="space-y-2">
                {outOfStock.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-error shrink-0" />
                    <span className="text-sm text-gray-800 flex-1">
                      {item.name}
                    </span>
                    <span className="text-sm font-semibold text-error">
                      Habis
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lowStock.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-warning mb-2 tracking-wider">
                Akan Habis (stok &lt; {LOW_STOCK_THRESHOLD})
              </p>
              <ul className="space-y-2">
                {lowStock.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                    <span className="text-sm text-gray-800 flex-1">
                      {item.name}
                    </span>
                    <span className="text-sm font-semibold text-warning">
                      Sisa {item.stock}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Inventory() {
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductV2 | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<(ProductV2 & { id: string }) | null>(null);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { user } = useAuth();
  const canCreate = usePermission("create_product");
  const canEdit = usePermission("edit_product");
  const canDelete = usePermission("delete_product");
  const canEditPrice = usePermission("edit_product_price");
  const canManage = canEdit || canDelete;

  // Use service hooks
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-list"],
    queryFn: fetchProductsList,
    staleTime: 5 * 60 * 1000,
  });
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const restockMutation = useRestockProduct();

  const { data: topSelling = [] } = useQuery({
    queryKey: ["top-selling"],
    queryFn: fetchTopSelling,
    staleTime: 5 * 60 * 1000,
  });

  const handleEdit = async (productId: string) => {
    try {
      const detail = await fetchProductDetail(productId);
      setEditingProduct(detail as any);
      setShowModal(true);
    } catch (error) {
      toast.error("Gagal memuat detail produk");
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const showSuccess = (type: "create" | "update") => {
    const message =
      type === "create"
        ? "Produk berhasil ditambahkan"
        : "Produk berhasil diperbarui";
    toast.success(message);
  };

  const handleSubmit = (data: {
    p_name: string;
    p_total_harga_beli: number | null;
    p_qty_input: number;
    p_stock_unit_name: string;
    p_units: string;
  }) => {
    const userId = user?.id;
    if (!userId) return;

    if (editingProduct?.id) {
      // Parse units dari string JSON
      const currentUnits = JSON.parse(data.p_units);
      const originalUnits = editingProduct.product_units || [];

      const unitsToUpsert = currentUnits.map((u: any) => ({
        name: u.name,
        conversion: u.conversion,
        is_base: u.is_base,
        barcode: u.barcode,
        price_sell: u.price_sell,
        ...(u.id && !u.id.startsWith('temp-') ? { id: u.id } : {}),
      }));

      const currentIds = new Set(
        currentUnits
          .filter((u: any) => u.id && !u.id.startsWith('temp-'))
          .map((u: any) => u.id)
      );
      const unitsToDelete = originalUnits.filter((u: any) => !currentIds.has(u.id));

      updateMutation.mutate(
        {
          productId: editingProduct.id,
          name: data.p_name,
          unitsToUpsert,
          unitsToDelete,
          userId,
        },
        {
          onSuccess: () => {
            showSuccess("update");
            setTimeout(handleCloseModal, 1000);
          },
        },
      );
    } else {
      createMutation.mutate(
        { ...data, userId },
        {
          onSuccess: () => {
            showSuccess("create");
            setTimeout(handleCloseModal, 1000);
          },
        },
      );
    }
  };

  const handleDelete = (productId: string, productName: string) => {
    setDeleteConfirm({ id: productId, name: productName });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id, {
        onSuccess: () => {
          toast.success("Produk berhasil dihapus");
          setDeleteConfirm(null);
        },
      });
    }
  };

  const handleRestock = async (productId: string) => {
    try {
      const detail = await fetchProductDetail(productId);
      setRestockingProduct(detail as any);
    } catch (error) {
      toast.error("Gagal memuat detail produk");
    }
  };

  const handleRestockSubmit = (data: {
    p_id: string;
    p_unit_id: string;
    p_qty_input: number;
    p_stock_unit_name: string;
    p_total_harga_beli: number | null;
  }) => {
    const userId = user?.id;
    if (!userId) return;

    restockMutation.mutate(
      { ...data, p_user_id: userId },
      {
        onSuccess: () => {
          toast.success("Stok berhasil ditambahkan");
          setRestockingProduct(null);
        },
      },
    );
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const outOfStock = products
    .filter((p) => p.stock === 0)
    .sort((a, b) => a.name.localeCompare(b.name)) as any as Product[];

  const lowStock = products
    .filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock) as any as Product[];

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isError = createMutation.isError || updateMutation.isError;
  const errorMessage =
    createMutation.error?.message || updateMutation.error?.message;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Manajemen Inventori
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} produk terdaftar
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          {/* Left: product table */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <Input
                placeholder="Cari nama produk atau barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p>Tidak ada produk ditemukan</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Harga Jual</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead className="text-right">Base Unit</TableHead>
                      {canManage && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatRupiah(product.price_sell_base)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-sm font-semibold ${product.stock === 0
                              ? "text-red-600"
                              : product.stock < LOW_STOCK_THRESHOLD
                                ? "text-yellow-600"
                                : "text-gray-900"
                              }`}
                          >
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {product.base_unit_name}
                          </span>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              {canEdit && (
                                <Button
                                  onClick={() => handleRestock(product.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="text-primary hover:text-muted hover:bg-primary rounded-full"
                                  disabled={restockMutation.isPending || deleteMutation.isPending}
                                  title="Tambah stok"
                                >
                                  <PackagePlus size={18} />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  onClick={() => handleEdit(product.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="text-primary hover:text-muted hover:bg-primary rounded-full"
                                  disabled={restockMutation.isPending || deleteMutation.isPending}
                                  title="Edit produk"
                                >
                                  <SquarePen />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  onClick={() => handleDelete(product.id, product.name)}
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-muted hover:bg-destructive rounded-full"
                                  disabled={restockMutation.isPending || deleteMutation.isPending}
                                  title="Hapus produk"
                                >
                                  <Trash />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Right: sidebar panels */}
          <div className="w-64 shrink-0 space-y-4">
            {canCreate && (
              <Button variant="primary" className="w-full" onClick={handleAdd}>
                + Tambah Produk
              </Button>
            )}
            <TopSellingPanel items={topSelling} />
            <StockAlertPanel outOfStock={outOfStock} lowStock={lowStock} />
          </div>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            initialData={editingProduct ?? undefined}
            onSubmit={handleSubmit}
            isPending={isPending}
            onCancel={handleCloseModal}
            canEditPrice={canEditPrice}
          />
          {isError && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={restockingProduct !== null} onOpenChange={() => setRestockingProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restock: {restockingProduct?.name}</DialogTitle>
          </DialogHeader>
          {restockingProduct && (
            <RestockForm
              product={restockingProduct}
              onCancel={() => setRestockingProduct(null)}
              onSubmit={handleRestockSubmit}
              isPending={restockMutation.isPending}
              canEditPrice={canEditPrice}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus produk "{deleteConfirm?.name}"? Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Inventory;
