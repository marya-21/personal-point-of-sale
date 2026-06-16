import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formatNumber } from "@/utils/formatCurrency";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { ProductV2, ProductUnit } from "@/types";

interface RestockFormProps {
  product: ProductV2 & { id: string };
  onCancel: () => void;
  onSubmit: (data: {
    p_id: string;
    p_unit_id: string;
    p_qty_input: number;
    p_stock_unit_name: string;
    p_total_harga_beli: number | null;
  }) => void;
  isPending?: boolean;
  canEditPrice?: boolean;
}

function RestockForm({ product, onCancel, onSubmit, isPending, canEditPrice }: RestockFormProps) {
  const { control, handleSubmit, watch } = useForm<any>({
    defaultValues: {
      qty: "",
      price_cost: 0,
    },
  });

  const baseUnit = product.product_units.find(u => u.is_base) ?? product.product_units[0];
  const [stockUnitId, setStockUnitId] = useState<string>("");

  const qty = Number(watch("qty")) || 0;
  const totalCost = Number(watch("price_cost")) || 0;
  const selectedUnit = product.product_units.find(u => u.id === stockUnitId) ?? baseUnit;
  const baseQtyPreview = selectedUnit ? qty * selectedUnit.conversion : 0;

  const handleFormSubmit = handleSubmit((data) => {
    if (canEditPrice && totalCost <= 0 && !canEditPrice) {
      return;
    }

    const selectedUnitName = selectedUnit.name || "";
    onSubmit({
      p_id: product.id,
      p_unit_id: stockUnitId,
      p_qty_input: qty,
      p_stock_unit_name: selectedUnitName,
      p_total_harga_beli: canEditPrice && totalCost > 0 ? totalCost : null,
    });
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Controller
              name="qty"
              control={control}
              rules={{ required: "Qty wajib diisi", min: { value: 1, message: "Qty minimal 1" } }}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    label="Qty Ditambah"
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    placeholder="Contoh: 10"
                  />
                  {fieldState.error && (
                    <p className="text-xs text-red-600 mt-1">{fieldState.error.message}</p>
                  )}
                </>
              )}
            />
          </div>
          <div className="w-36">
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={stockUnitId}
              onChange={(e) => setStockUnitId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Pilih Unit</option>
              {product.product_units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name || "(base)"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedUnit && selectedUnit.id !== baseUnit.id && (
          <p className="text-xs text-gray-600 mt-2">
            = {baseQtyPreview} {baseUnit.name} (satuan dasar)
          </p>
        )}
      </div>

      {canEditPrice && (
        <div>
          <Controller
            name="price_cost"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  label="Total Harga Beli"
                  type="text"
                  inputMode="numeric"
                  value={field.value ? formatNumber(field.value) : ""}
                  placeholder="Contoh: 480.000"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    field.onChange(raw ? parseInt(raw) : 0);
                  }}
                />
              </>
            )}
          />
        </div>
      )}

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
          disabled={isPending}
        >
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

export default RestockForm;
