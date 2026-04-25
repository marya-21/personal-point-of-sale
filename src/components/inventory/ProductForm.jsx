import React, { useMemo, useState } from "react";
import { formatNumber, formatRupiah } from "../../utils/formatCurrency";
import Input from "../ui/Input";
import Button from "../ui/Button";

//  Form for create/edit product with margin calculation
function ProductForm({ initialData, onCancel, onSubmit, isPending }) {
  const [form, setForm] = useState(
    initialData || {
      barcode: "",
      name: "",
      price_cost: "",
      price_sell: "",
      stock: "",
    },
  );

  // Calculate margin whenever prices change
  const margin = useMemo(() => {
    const cost = parseInt(form.price_cost) || 0;
    const sell = parseInt(form.price_sell) || 0;

    const margin_rp = sell - cost;
    const margin_percent = sell > 0 ? ((margin_rp / sell) * 100).toFixed(2) : 0;

    return {
      margin_rp,
      margin_percent,
    };
  }, [form.price_cost, form.price_sell]);

  //   List functions
  const isMarginNegative = margin.margin_rp < 0;

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const fieldName = e.target.name;
    setForm((prev) => ({
      ...prev,
      [fieldName]: raw,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      price_cost: parseInt(form.price_cost) || 0,
      price_sell: parseInt(form.price_sell) || 0,
      stock: parseInt(form.stock) || 0,
    });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Barcode"
        name="barcode"
        value={form.barcode}
        onChange={handleChange}
        required
        placeholder="Contoh: 8991234567890"
      />

      <Input
        label="Nama Produk"
        name="name"
        value={form.name}
        onChange={handleChange}
        required
        placeholder="Contoh: Aqua 600ml"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Harga Pokok (Rp)"
          name="price_cost"
          type="text"
          inputMode="numeric"
          value={form.price_cost === "" ? "" : formatNumber(form.price_cost)}
          onChange={handlePriceChange}
          required
          placeholder="Contoh: 8.000"
        />

        <Input
          label="Harga Jual (Rp)"
          name="price_sell"
          type="text"
          inputMode="numeric"
          value={form.price_sell === "" ? "" : formatNumber(form.price_sell)}
          onChange={handlePriceChange}
          required
          placeholder="Contoh: 12.000"
        />
      </div>

      {/* Margin Display */}
      <div
        className={`rounded-lg p-3 ${
          isMarginNegative
            ? "bg-red-50 border border-red-200"
            : "bg-green-50 border border-green-200"
        }`}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p
              className={`text-xs font-semibold ${isMarginNegative ? "text-red-600" : "text-green-600"}`}
            >
              Margin (Rp)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${isMarginNegative ? "text-red-700" : "text-green-700"}`}
            >
              {formatRupiah(margin.margin_rp)}
            </p>
          </div>
          <div>
            <p
              className={`text-xs font-semibold ${isMarginNegative ? "text-red-600" : "text-green-600"}`}
            >
              Margin (%)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${isMarginNegative ? "text-red-700" : "text-green-700"}`}
            >
              {margin.margin_percent}%
            </p>
          </div>
        </div>

        {isMarginNegative && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            ⚠️ Harga jual lebih rendah dari harga pokok!
          </p>
        )}
      </div>

      <Input
        label="Stok Awal"
        name="stock"
        type="number"
        value={form.stock}
        onChange={handleChange}
        required
        placeholder="Contoh: 100"
      />

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={isPending || isMarginNegative}
        >
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      {isMarginNegative && (
        <p className="text-xs text-red-600 text-center">
          Tidak bisa simpan produk dengan margin negatif
        </p>
      )}
    </form>
  );
}

export default ProductForm;
