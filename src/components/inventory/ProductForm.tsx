import { useState } from "react";
import { Controller, useForm } from "react-hook-form"
import { Trash } from "lucide-react";
import { formatRupiah, formatNumber, } from "@/utils/formatCurrency";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { Product, ProductUnit } from "@/types";

interface ProductFormProps {
  initialData?: Product;
  onCancel: () => void;
  onSubmit: (data: Product & { units: ProductUnit[]; stock_unit_id: string; total_purchase_cost?: number }) => void;
  isPending?: boolean;
  canEditPrice?: boolean;
}

//  Form for create/edit product with margin calculation
function ProductForm({ initialData, onCancel, onSubmit, isPending, canEditPrice }: ProductFormProps) {
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
  const [totalPurchaseCostDisplay, setTotalPurchaseCostDisplay] = useState("");

  const [units, setUnits] = useState<ProductUnit[]>([
    {
      id: "temp-1",
      name: "",
      conversion: 1,
      is_base: true,
      barcode: initialData?.barcode || "",
      price_sell: initialData?.price_sell || 0,
      hpp_derived: initialData?.price_cost || 0,
      margin_rp: 0,
      margin_pct: 0,
    },
  ]);

  const [stockUnitId, setStockUnitId] = useState<string>("temp-1");

  const stock_qty = watch("stock") || 0;
  const total_purchase_cost = parseInt(totalPurchaseCostDisplay.replace(/[^0-9]/g, "")) || 0;

  const selectedStockUnit = units.find(u => u.id === stockUnitId) ?? units[0];
  const baseUnit = units.find(u => u.is_base) ?? units[0];
  const baseQtyPreview = stock_qty * selectedStockUnit.conversion;

  // Total Harga Beli previews
  const costPerSelectedUnit = stock_qty > 0 ? total_purchase_cost / stock_qty : 0;
  const costPerBaseUnit = stock_qty > 0 && selectedStockUnit.conversion > 0
    ? total_purchase_cost / (stock_qty * selectedStockUnit.conversion)
    : 0;


  const handleUnitChange = (index: number, field: keyof ProductUnit, value: any) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
  };

  const handleAddUnit = () => {
    const newUnit: ProductUnit = {
      id: `temp-${Date.now()}`,
      name: "",
      conversion: 1,
      is_base: false,
      barcode: "",
      price_sell: 0,
      hpp_derived: 0,
      margin_rp: 0,
      margin_pct: 0,
    };
    setUnits([...units, newUnit]);
  };

  const handleRemoveUnit = (index: number) => {
    if (units.length > 1) {
      const removedUnit = units[index];
      setUnits(units.filter((_, i) => i !== index));
      // Reset stockUnitId if removed unit was selected
      if (removedUnit.id === stockUnitId) {
        setStockUnitId("temp-1");
      }
    }
  };

  const [unitErrors, setUnitErrors] = useState<string>("");

  const validateUnits = (): boolean => {
    setUnitErrors("");

    // Cek setiap unit harus punya unit name, conversion, harga jual
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.name.trim()) {
        setUnitErrors(`Baris ${i + 1}: Nama satuan tidak boleh kosong`);
        return false;
      }
      if (!unit.is_base && unit.conversion <= 0) {
        setUnitErrors(`Baris ${i + 1}: Isi/Conv harus > 0`);
        return false;
      }
      if (unit.price_sell <= 0) {
        setUnitErrors(`Baris ${i + 1}: Harga jual harus diisi`);
        return false;
      }
    }

    // Cek nama unit tidak duplikat
    const unitNames = units.map(u => u.name.trim()).filter(n => n);
    const uniqueNames = new Set(unitNames);
    if (unitNames.length !== uniqueNames.size) {
      setUnitErrors("Nama satuan tidak boleh duplikat.");
      return false;
    }

    // Cek barcode unik (hanya jika ada nilai)
    const barcodesWithValue = units
      .map((u) => u.barcode)
      .filter((b) => b.trim() !== "");
    const uniqueBarcodes = new Set(barcodesWithValue);

    if (barcodesWithValue.length !== uniqueBarcodes.size) {
      setUnitErrors("Ada barcode yang duplikat");
      return false;
    }

    return true;
  };

  const handleFormSubmit = handleSubmit((data) => {
    if (!validateUnits()) {
      return;
    }
    // Kirim data produk + units + unit referensi untuk stok awal + total harga beli
    onSubmit({
      ...data,
      units,
      stock_unit_id: stockUnitId,
      ...(canEditPrice && total_purchase_cost > 0 && { total_purchase_cost }),
    } as any);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <Controller
        name="name"
        control={control}
        rules={{ required: "Nama produk wajib diisi" }}
        render={({ field, fieldState }) =>
          <>
            <Input
              {...field}
              label="Nama Produk"
              required
              placeholder="Cnt: 8991234567890"
            />
            {fieldState.error && (
              <p className="text-xs text-red-600 mt-1">{fieldState.error.message}</p>
            )}
          </>
        }
      />
      {/* SKU/Unit Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Varian Unit</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddUnit}
          >
            + Tambah Unit
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <Table className="w-full">
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-primary border-b-primary">
                <TableHead className="text-primary-foreground">Unit</TableHead>
                <TableHead className="text-primary-foreground">Isi/Conv</TableHead>
                <TableHead className="text-primary-foreground">Barcode</TableHead>
                <TableHead className="text-primary-foreground">H. Jual (Rp)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit, index) => (
                <TableRow key={unit.id}>
                  <TableCell className="py-2">
                    <input
                      type="text"
                      value={unit.name}
                      onChange={(e) => handleUnitChange(index, "name", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={unit.is_base ? "PCS/Btg/Ons" : "Box, Pack, Lusin"}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <input
                      type="number"
                      value={unit.conversion}
                      onChange={(e) => handleUnitChange(index, "conversion", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      min="1"
                      disabled={unit.is_base}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <input
                      type="text"
                      value={unit.barcode}
                      onChange={(e) => handleUnitChange(index, "barcode", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="8991234567890"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <input
                      type="text"
                      value={formatNumber(unit.price_sell)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        handleUnitChange(index, "price_sell", raw ? parseInt(raw) : 0);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                      inputMode="numeric"
                    />
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Button
                      type="button"
                      onClick={() => handleRemoveUnit(index)}
                      disabled={unit.is_base}
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-muted hover:bg-destructive rounded-full"
                      title="Hapus unit"
                    >
                      <Trash size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {unitErrors && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {unitErrors}
          </div>
        )}
      </div>
      <div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Controller
              name="stock"
              control={control}
              rules={{ required: true, min: { value: 0, message: "Stok tidak boleh negatif" } }}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    label="Stok Awal"
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    placeholder="Contoh: 100"
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
              disabled={units.length <= 1}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name || "(base)"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedStockUnit.id !== baseUnit.id && (
          <p className="text-xs text-gray-600 mt-2">
            = {baseQtyPreview} {baseUnit.name} (satuan dasar)
          </p>
        )}
      </div>
      {canEditPrice && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Harga Beli (Rp)</label>
          <input
            type="text"
            value={totalPurchaseCostDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setTotalPurchaseCostDisplay(raw ? formatNumber(parseInt(raw)) : "");
            }}
            inputMode="numeric"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Contoh: 480.000"
          />
          {total_purchase_cost > 0 && stock_qty > 0 && (
            <div className="text-xs text-gray-600 mt-2 space-y-1">
              <p>= {formatRupiah(costPerSelectedUnit)} / {selectedStockUnit.name || "..."}</p>
              <p>= {formatRupiah(costPerBaseUnit)} / {baseUnit.name} (satuan dasar)</p>
            </div>
          )}
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
          disabled={isPending || unitErrors !== ""}
        >
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

export default ProductForm;
