import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form"
import { formatRupiah, formatNumber, } from "../../utils/formatCurrency";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Product } from "@/types";

interface ProductFormProps {
  initialData?: Product;
  onCancel: () => void;
  onSubmit: (data: Product) => void;
  isPending?: boolean;
}

//  Form for create/edit product with margin calculation
function ProductForm({ initialData, onCancel, onSubmit, isPending }: ProductFormProps) {
  const { control, handleSubmit, watch } = useForm<Product>({
    defaultValues: initialData || {
      barcode: "",
      name: "",
      price_cost: 0,
      price_sell: 0,
      stock: 0,
    },
  });

  const [costPriceDisplay, setCostPriceDisplay] = useState(
    initialData?.price_cost ? formatNumber(initialData.price_cost) : ""
  );
  const [priceDisplay, setPriceDisplay] = useState(
    initialData?.price_sell ? formatNumber(initialData.price_sell) : ""
  );

  const cost_price = watch("price_cost") || 0;
  const price_sell = watch("price_sell") || 0;

  // Calculate margin whenever prices change
  const margin = useMemo(() => {
    const margin_rp = price_sell - cost_price;
    const margin_percent = price_sell > 0 ? ((margin_rp / price_sell) * 100).toFixed(2) : 0;

    return {
      margin_rp,
      margin_percent,
    };
  }, [cost_price, price_sell]);

  const isMarginNegative = margin.margin_rp < 0;

  const handlePriceChange = (value: string, onChange: (value: number) => void, setDisplay: (value: string) => void) => {
    const raw = value.replace(/[^0-9]/g, "");
    if (raw !== "") {
      const num = parseInt(raw, 10);
      setDisplay(formatNumber(num));
      return onChange(num);
    }
    setDisplay("");
    return onChange(0);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Controller
        name="barcode"
        control={control}
        render={({ field }) =>
          <Input
            {...field}
            label="Barcode"
            required
            placeholder="Contoh: 8991234567890"
          // aria-invalid={fieldState.invalid}
          />}
      />
      <Controller
        name="name"
        control={control}
        render={({ field }) =>
          <Input
            {...field}
            label="Nama Produk"
            required
            placeholder="Contoh: 8991234567890"
          />}
      />
      <div className="grid grid-cols-2 gap-3">
        <Controller name="price_cost" control={control} render={({ field }) =>
          <Input
            value={costPriceDisplay}
            label="Harga Pokok (Rp)"
            type="text"
            inputMode="numeric"
            required
            min={1}
            onChange={(e) => handlePriceChange(e.target.value, field.onChange, setCostPriceDisplay)}
            placeholder="Contoh: 8000"
          />}
        />
        <Controller name="price_sell" control={control} render={({ field }) =>
          <Input
            value={priceDisplay}
            label="Harga Jual (Rp)"
            type="text"
            inputMode="numeric"
            required
            min={1}
            onChange={(e) => handlePriceChange(e.target.value, field.onChange, setPriceDisplay)}
            placeholder="Contoh: 12000"
          />} />
      </div>

      {/* Margin Display */}
      <div
        className={`rounded-lg p-3 ${isMarginNegative
          ? "bg-warning-light border border-warning"
          : "bg-success-light border border-success"
          }`}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p
              className={`text-xs font-semibold ${isMarginNegative ? "text-warning" : "text-success"}`}
            >
              Margin (Rp)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${isMarginNegative ? "text-warning" : "text-success"}`}
            >
              {formatRupiah(margin.margin_rp)}
            </p>
          </div>
          <div>
            <p
              className={`text-xs font-semibold ${isMarginNegative ? "text-warning" : "text-success"}`}
            >
              Margin (%)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${isMarginNegative ? "text-warning" : "text-success"}`}
            >
              {margin.margin_percent}%
            </p>
          </div>
        </div>

        {isMarginNegative && (
          <p className="text-xs text-warning mt-2 font-medium">
            ⚠️ Harga jual lebih rendah dari harga pokok!
          </p>
        )}
      </div>
      <Controller name="stock" control={control} render={({ field }) =>
        <Input
          {...field}
          label="Stok Awal"
          type="number"
          inputMode="numeric"
          required
          min={1}
          placeholder="Contoh: 100"
        />}
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
        <p className="text-xs text-warning text-center">
          Tidak bisa simpan produk dengan margin negatif
        </p>
      )}
    </form>
  );
}

export default ProductForm;
