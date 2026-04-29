import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import {
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProducts,
} from "../services/productService";
import { formatRupiah } from "../utils/formatCurrency";
import ProductForm from "../components/inventory/ProductForm";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import { useAuth, usePermission } from "../hooks/useAuth";

async function fetchTopSelling() {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("product_id, qty, products(name)");
  if (error) throw error;

  const totals = {};
  for (const item of data) {
    const id = item.product_id;
    if (!totals[id]) totals[id] = { name: item.products?.name ?? "—", qty: 0 };
    totals[id].qty += item.qty;
  }

  return Object.values(totals).sort((a, b) => b.qty - a.qty);
}

const LOW_STOCK_THRESHOLD = 10;

function TopSellingPanel({ items }) {
  const [showAll, setShowAll] = useState(false);
  const preview = items.slice(0, 4);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4">
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

      <Modal
        isOpen={showAll}
        onClose={() => setShowAll(false)}
        title="Barang Terlaris"
      >
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
      </Modal>
    </>
  );
}

function StockAlertPanel({ outOfStock, lowStock }) {
  const [showAll, setShowAll] = useState(false);

  const combined = [
    ...outOfStock.map((p) => ({ ...p, _status: "habis" })),
    ...lowStock.map((p) => ({ ...p, _status: "mau_habis" })),
  ];
  const preview = combined.slice(0, 4);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Stok</h2>
        {combined.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Semua stok aman.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item._status === "habis" ? "bg-red-500" : "bg-yellow-400"
                  }`}
                />
                <span className="text-sm text-gray-800 flex-1 truncate">
                  {item.name}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    item._status === "habis"
                      ? "text-red-600"
                      : "text-yellow-600"
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

      <Modal
        isOpen={showAll}
        onClose={() => setShowAll(false)}
        title="Stok Habis & Akan Habis"
      >
        {outOfStock.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase text-red-600 mb-2 tracking-wider">
              Habis
            </p>
            <ul className="space-y-2">
              {outOfStock.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-sm text-gray-800 flex-1">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-red-600">
                    Habis
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {lowStock.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-yellow-600 mb-2 tracking-wider">
              Akan Habis (stok &lt; {LOW_STOCK_THRESHOLD})
            </p>
            <ul className="space-y-2">
              {lowStock.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                  <span className="text-sm text-gray-800 flex-1">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-yellow-600">
                    Sisa {item.stock}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}

function Inventory() {
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const canCreate = usePermission("create_product");
  const canEdit = usePermission("edit_product");
  const canDelete = usePermission("delete_product");
  const isAdmin = usePermission("view_all_transactions");
  const canManage = canEdit || canDelete;

  // Use service hooks
  const { data: products = [], isLoading } = useProducts();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const { data: topSelling = [] } = useQuery({
    queryKey: ["top-selling"],
    queryFn: fetchTopSelling,
    staleTime: 5 * 60 * 1000,
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowModal(true);
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

  const handleSubmit = (data) => {
    if (editingProduct?.id) {
      updateMutation.mutate(
        { ...data, id: editingProduct.id, userId: user?.id },
        { onSuccess: handleCloseModal },
      );
    } else {
      createMutation.mutate(
        { ...data, userId: user?.id },
        { onSuccess: handleCloseModal },
      );
    }
  };

  const handleDelete = (product) => {
    if (window.confirm(`Hapus produk "${product.name}"?`)) {
      deleteMutation.mutate(product.id);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search),
  );

  const outOfStock = products
    .filter((p) => p.stock === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const lowStock = products
    .filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock);

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
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Barcode
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        H. Pokok
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        H. Jual
                      </th>
                      {isAdmin && (
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Margin
                        </th>
                      )}
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Stok
                      </th>
                      {canManage && <th className="py-3 px-4" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-500 font-mono">
                            {product.barcode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatRupiah(product.price_cost || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatRupiah(product.price_sell)}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="text-right">
                              <span
                                className={`text-sm font-semibold ${
                                  product.margin_rp < 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {formatRupiah(product.margin_rp)}
                              </span>
                              <p
                                className={`text-xs ${
                                  product.margin_rp < 0
                                    ? "text-red-500"
                                    : "text-green-500"
                                }`}
                              >
                                {product.margin_percent}%
                              </p>
                            </div>
                          </td>
                        )}

                        <td className="py-3 px-4 text-right">
                          <span
                            className={`text-sm font-semibold ${
                              product.stock === 0
                                ? "text-red-600"
                                : product.stock < LOW_STOCK_THRESHOLD
                                  ? "text-yellow-600"
                                  : "text-gray-900"
                            }`}
                          >
                            {product.stock}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-end">
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  className="text-sm py-1 px-3"
                                  onClick={() => handleEdit(product)}
                                >
                                  Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="danger"
                                  className="text-sm py-1 px-3"
                                  onClick={() => handleDelete(product)}
                                  disabled={deleteMutation.isPending}
                                >
                                  Hapus
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
      >
        <ProductForm
          initialData={editingProduct}
          onSubmit={handleSubmit}
          isPending={isPending}
          onCancel={handleCloseModal}
        />
        {isError && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      </Modal>
    </div>
  );
}

export default Inventory;
