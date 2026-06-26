import { useState } from "react";
import { Controller, useForm } from "react-hook-form"
import { z } from "zod";
import { Trash, ChevronRight, ChevronLeft } from "lucide-react";
import { formatNumber, } from "@/utils/formatCurrency";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { ProductV2, ProductUnit } from "@/types";

// Local UI-only extended unit type
interface UnitRow extends ProductUnit {
  relativeConversion: number;
  referenceUnitId: string;
}

// Compute absolute conversion by walking the reference chain
function computeAbsolute(
  unitId: string,
  allUnits: UnitRow[],
  visited = new Set<string>()
): number {
  if (visited.has(unitId)) return 1; // Cycle detected
  visited.add(unitId);

  const unit = allUnits.find(u => u.id === unitId);
  if (!unit) return 1;

  // Base unit or no reference
  if (unit.is_base || unit.referenceUnitId === "") return 1;

  const refUnit = allUnits.find(u => u.id === unit.referenceUnitId);
  if (!refUnit) return 1;

  const refAbsolute = computeAbsolute(unit.referenceUnitId, allUnits, visited);
  return unit.relativeConversion * refAbsolute;
}

interface ProductFormProps {
  initialData?: ProductV2;
  onCancel: () => void;
  onSubmit: (data: {
    p_name: string;
    p_total_harga_beli: number | null;
    p_qty_input: number;
    p_stock_unit_name: string;
    p_units: string;
  }) => void;
  isPending?: boolean;
  canEditPrice?: boolean;
}

const required_field_str = "Wajib di isi"

const formProductSchema = z.object({
  name: z.string().min(1, required_field_str),
  unit: z.object({
    name: z.string().min(1, "Nama satuan wajib diisi"),
    price: z.coerce.number().min(1, "Harga jual wajib diisi dan minimal 1"),
    referenceUnitId: z.string(),
    barcode: z.string().optional(),
  }).optional(),
  stock: z.coerce.number().min(1, "Stok awal minimal 1").optional(),
  price_cost: z.coerce.number().min(0).optional(),
});

type TFormProductSchema = z.infer<typeof formProductSchema>;

const toTitleCase = (str: string) =>
  str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

//  Form for create/edit product with margin calculation
function ProductForm({ initialData, onCancel, onSubmit, isPending, canEditPrice }: ProductFormProps) {
  const isEditMode = !!initialData;
  const [step, setStep] = useState<1 | 2>(1);

  const { control, handleSubmit, watch, trigger } = useForm<TFormProductSchema>({
    defaultValues: {
      name: initialData?.name || "",
      stock: isEditMode ? 0 : undefined,
      price_cost: isEditMode ? undefined : 0,
    },
  });

  const baseUnitId = "temp-1";
  const [units, setUnits] = useState<UnitRow[]>(() => {
    if (initialData && initialData.product_units.length > 0) {
      // Edit mode: back-calculate UI fields from absolute conversions
      const baseUnit = initialData.product_units.find(u => u.is_base);
      return initialData.product_units.map(u => ({
        ...u,
        relativeConversion: u.conversion,
        referenceUnitId: u.is_base ? "" : (baseUnit?.id || ""),
      }));
    }

    // Create mode: new empty base unit
    return [
      {
        id: baseUnitId,
        name: "",
        conversion: 1,
        is_base: true,
        barcode: "",
        price_sell: 0,
        relativeConversion: 1,
        referenceUnitId: "",
      },
    ];
  });

  // Track touched fields per unit to show validation errors only after user interaction
  const [touchedUnitFields, setTouchedUnitFields] = useState<Record<string, Set<string>>>({});

  const markFieldTouched = (unitId: string, fieldName: string) => {
    setTouchedUnitFields(prev => ({
      ...prev,
      [unitId]: new Set([...(prev[unitId] || new Set()), fieldName])
    }));
  };

  const isFieldTouched = (unitId: string, fieldName: string) => {
    return touchedUnitFields[unitId]?.has(fieldName) ?? false;
  };

  const [stockUnitId, setStockUnitId] = useState<string>("temp-1");

  const stock_qty = Number(watch("stock")) || 0;
  const total_purchase_cost = Number(watch("price_cost")) || 0;

  const selectedStockUnit = units.find(u => u.id === stockUnitId) ?? units[0];
  const baseUnit = units.find(u => u.is_base) ?? units[0];
  const baseQtyPreview = stock_qty * selectedStockUnit.conversion;

  const handleUnitChange = (index: number, field: keyof UnitRow, value: any) => {
    const newUnits = [...units];
    const unitId = newUnits[index].id;
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnits(newUnits);
    markFieldTouched(unitId, field);
    setUnitErrors("");
  };

  const handleAddUnit = () => {
    const newUnit: UnitRow = {
      id: `temp-${Date.now()}`,
      name: "",
      conversion: 1,
      is_base: false,
      barcode: "",
      price_sell: 0,
      relativeConversion: 1,
      referenceUnitId: "", // Empty, user must select
    };
    setUnits([...units, newUnit]);
  };

  const handleRemoveUnit = (index: number) => {
    if (units.length > 1) {
      const removedUnit = units[index];
      const baseUnit = units.find(u => u.is_base) || units[0];

      // Don't allow deleting base unit
      if (removedUnit.is_base) return;

      // Reassign units that reference the removed unit - reset to empty (user must re-select)
      const updatedUnits = units
        .filter((_, i) => i !== index)
        .map(u =>
          u.referenceUnitId === removedUnit.id
            ? { ...u, referenceUnitId: "", relativeConversion: 1 }
            : u
        );

      setUnits(updatedUnits);

      // Clear touched state for removed unit
      setTouchedUnitFields(prev => {
        const newState = { ...prev };
        delete newState[removedUnit.id];
        return newState;
      });

      // Reset stockUnitId if removed unit was selected
      if (removedUnit.id === stockUnitId) {
        setStockUnitId(baseUnit.id);
      }
    }
  };

  const [unitErrors, setUnitErrors] = useState<string>("");

  const validateUnits = (): boolean => {
    setUnitErrors("");

    // Cek setiap unit harus punya unit name, relativeConversion, harga jual, dan reference (non-base)
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.name.trim()) {
        setUnitErrors(`Baris ${i + 1}: Nama satuan tidak boleh kosong`);
        return false;
      }
      if (!unit.is_base) {
        if (!unit.referenceUnitId) {
          setUnitErrors(`Baris ${i + 1}: Harus pilih satuan acuan`);
          return false;
        }
        if (unit.relativeConversion < 1) {
          setUnitErrors(`Baris ${i + 1}: Isi harus ≥ 1`);
          return false;
        }
      }
      if (unit.price_sell <= 0) {
        setUnitErrors(`Baris ${i + 1}: Harga jual harus diisi`);
        return false;
      }
    }

    // Cek nama unit tidak duplikat
    const unitNames = units.map(u => u.name.trim().toLowerCase()).filter(n => n);
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

  const handleNextStep = async () => {
    const isNameValid = await trigger("name");
    if (!isNameValid) return;
    if (!validateUnits()) return;
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleFormSubmit = handleSubmit((data) => {
    if (isEditMode) {
      // Edit mode: submit with minimal data
      const unitsPayload = units.map(u => ({
        ...(u.id && !u.id.startsWith('temp-') && { id: u.id }),
        name: toTitleCase(u.name),
        conversion: computeAbsolute(u.id, units),
        is_base: u.is_base,
        barcode: u.barcode,
        price_sell: u.price_sell,
      }));

      const baseUnitName = toTitleCase(baseUnit.name || "");
      onSubmit({
        p_name: toTitleCase(data.name),
        p_total_harga_beli: null,
        p_qty_input: 0,
        p_stock_unit_name: baseUnitName,
        p_units: JSON.stringify(unitsPayload),
      } as any);
    } else {
      // Create mode: validate and submit full data
      if (canEditPrice && total_purchase_cost <= 0) {
        setUnitErrors("Total Harga Beli harus diisi");
        return;
      }

      if (!validateUnits()) {
        return;
      }

      const selectedUnitName = toTitleCase(selectedStockUnit.name || "");
      const unitsPayload = units.map(u => ({
        name: toTitleCase(u.name),
        conversion: computeAbsolute(u.id, units),
        is_base: u.is_base,
        barcode: u.barcode,
        price_sell: u.price_sell,
      }));

      onSubmit({
        p_name: productName,
        p_total_harga_beli: canEditPrice && total_purchase_cost > 0 ? total_purchase_cost : null,
        p_qty_input: stock_qty,
        p_stock_unit_name: selectedUnitName,
        p_units: JSON.stringify(unitsPayload),
      } as any);
    }
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[calc(100vh-150px)] overflow-y-auto">
      {/* Stepper (only for create mode) */}
      {!isEditMode && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
              1
            </div>
            <div className={`flex-1 h-1 transition-colors ${step >= 2 ? 'bg-primary' : 'bg-gray-200'
              }`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
              2
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs font-medium text-gray-700">
            <span>Informasi Produk</span>
            <span>Stok & Harga</span>
          </div>
        </div>
      )}

      {/* Step 1: Product Name & Units (visible in both create & edit) */}
      {(step === 1 || isEditMode) && (
        <>
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
                  placeholder="Cnt: Aqua 600ml"
                />
                {fieldState.error && (
                  <p className="text-xs text-red-600 mt-1">{fieldState.error.message}</p>
                )}
              </>
            }
          />
          {/* Units Cards */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Satuan Jual</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddUnit}
              >
                + Tambah Satuan
              </Button>
            </div>

            <div className="space-y-3">
              {(() => {
                // Compute ALL row errors first (to detect all duplicates)
                const rowErrors: Record<string, string> = {};
                const nameCounts: Record<string, string[]> = {}; // Map name -> array of unit ids

                // First pass: count all names and collect unit ids
                for (const u of units) {
                  const nameTrimmed = u.name.trim().toLowerCase();
                  if (!u.name.trim()) {
                    rowErrors[u.id] = "Nama satuan tidak boleh kosong";
                  } else {
                    if (!nameCounts[nameTrimmed]) {
                      nameCounts[nameTrimmed] = [];
                    }
                    nameCounts[nameTrimmed].push(u.id);
                  }
                }

                // Second pass: mark ALL units with duplicate names
                for (const [name, unitIds] of Object.entries(nameCounts)) {
                  if (unitIds.length > 1) {
                    for (const id of unitIds) {
                      rowErrors[id] = "Nama satuan sudah digunakan";
                    }
                  }
                }

                // Third pass: check other validations
                for (const u of units) {
                  if (!u.is_base) {
                    if (!u.referenceUnitId) {
                      rowErrors[u.id] = (rowErrors[u.id] ? rowErrors[u.id] + "; " : "") + "Harus pilih satuan acuan";
                    }
                    if (u.relativeConversion < 1) {
                      rowErrors[u.id] = (rowErrors[u.id] ? rowErrors[u.id] + "; " : "") + "Isi harus ≥ 1";
                    }
                  }
                }

                return units.map((unit, index) => {
                  const availableRefs = units.slice(0, index);
                  const absoluteConv = computeAbsolute(unit.id, units);
                  const baseUnit = units.find(u => u.is_base) || units[0];

                  return (
                    <div
                      key={unit.id}
                      className="border border-gray-300 bg-gray-50 rounded-lg p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <Input
                            label="Nama Satuan"
                            value={unit.name}
                            onChange={(e) => handleUnitChange(index, "name", e.target.value)}
                            required
                            placeholder={unit.is_base ? "Cnt: Pcs/Btg/Ons" : "Cnt: Box, Pack, Lusin"}
                            className={isFieldTouched(unit.id, "name") && !unit.name.trim() ? "border-red-400" : ""}
                          />
                          {isFieldTouched(unit.id, "name") && !unit.name.trim() && (
                            <p className="text-xs text-red-600 mt-1">Nama satuan tidak boleh kosong</p>
                          )}
                          {isFieldTouched(unit.id, "name") && unit.name.trim() && rowErrors[unit.id]?.includes("sudah digunakan") && (
                            <p className="text-xs text-red-600 mt-1">Nama satuan sudah digunakan</p>
                          )}
                        </div>
                        {!unit.is_base && (
                          <Button
                            type="button"
                            onClick={() => handleRemoveUnit(index)}
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-red-600 hover:bg-red-100 ml-2 flex-shrink-0"
                            title="Hapus satuan"
                          >
                            <Trash size={18} />
                          </Button>
                        )}
                      </div>

                      {unit.is_base && (
                        <div className="mb-3 inline-block bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide">
                          Satuan Terkecil
                        </div>
                      )}

                      {!unit.is_base && (
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span>1</span>
                            <span className="font-medium">{unit.name || "satuan ini"}</span>
                            <span>berisi</span>
                            <input
                              type="number"
                              value={unit.relativeConversion}
                              onChange={(e) => handleUnitChange(index, "relativeConversion", Math.max(1, parseInt(e.target.value) || 1))}
                              className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${isFieldTouched(unit.id, "relativeConversion") && unit.relativeConversion < 1 ? "border-red-400" : "border-gray-300"}`}
                              min="1"
                            />
                            <select
                              value={unit.referenceUnitId}
                              onChange={(e) => handleUnitChange(index, "referenceUnitId", e.target.value)}
                              className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${isFieldTouched(unit.id, "referenceUnitId") && !unit.referenceUnitId ? "border-red-400" : "border-gray-300"}`}
                            >
                              <option value="">Pilih satuan acuan</option>
                              {availableRefs.map(ref => (
                                <option key={ref.id} value={ref.id}>
                                  {ref.name || "(belum diberi nama)"}
                                </option>
                              ))}
                            </select>
                          </div>
                          {isFieldTouched(unit.id, "relativeConversion") && unit.relativeConversion < 1 && (
                            <p className="text-xs text-red-600">Isi harus ≥ 1</p>
                          )}
                          {isFieldTouched(unit.id, "referenceUnitId") && !unit.referenceUnitId && (
                            <p className="text-xs text-red-600">Harus pilih satuan acuan</p>
                          )}
                          <div className="text-sm text-gray-600 italic">
                            = {absoluteConv} {baseUnit.name || "satuan terkecil"} (dihitung otomatis)
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Harga Jual *</label>
                          <div className={`flex items-center border rounded ${isFieldTouched(unit.id, "price_sell") && unit.price_sell <= 0 ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`}>
                            <span className="text-gray-600 mr-2 ml-2">Rp</span>
                            <input
                              type="text"
                              value={formatNumber(unit.price_sell)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                handleUnitChange(index, "price_sell", raw ? parseInt(raw) : 0);
                              }}
                              className="flex-1 px-2 py-2 text-sm text-right focus:outline-none bg-transparent"
                              inputMode="numeric"
                              placeholder="0"
                            />
                          </div>
                          {isFieldTouched(unit.id, "price_sell") && unit.price_sell <= 0 && (
                            <p className="text-xs text-red-600 mt-1">Harga jual harus lebih dari 0</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Barcode (opsional)</label>
                          <input
                            type="text"
                            value={unit.barcode}
                            onChange={(e) => handleUnitChange(index, "barcode", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            placeholder="8991234567890"
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {unitErrors && (
              <div className="mt-4 p-3 bg-red-50 border border-red-400 rounded text-sm text-red-700 font-medium flex items-start gap-2">
                <span className="text-lg leading-none">⚠</span>
                <span>{unitErrors}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Step 2: Stock & Price (create mode only) */}
      {step === 2 && !isEditMode && (
        <>
          {/* Stock */}
          <div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Controller
                  name="stock"
                  control={control}
                  rules={{ required: "Stok awal wajib diisi", min: { value: 1, message: "Stok minimal 1" } }}
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
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
                = {baseQtyPreview} {baseUnit.name} (satuan terkecil)
              </p>
            )}
          </div>
          {canEditPrice && (
            <div>
              <Controller
                name="price_cost"
                control={control}
                rules={{ required: "Field wajib diisi" }}
                render={({ field, fieldState }) =>
                  <>
                    <Input
                      label="Total Harga Beli"
                      type="text"
                      inputMode="numeric"
                      value={field.value ? formatNumber(field.value) : ""}
                      required
                      placeholder="Contoh: 480.000"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        field.onChange(raw ? parseInt(raw) : 0);
                      }}
                    />
                    {fieldState.error && (
                      <p className="text-xs text-red-600 mt-1">{fieldState.error.message}</p>
                    )}
                  </>
                }
              />
            </div>
          )}
        </>
      )}

      {/* Footer Buttons */}
      <div className="flex gap-3 pt-2">
        {!isEditMode && step === 2 && (
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handlePrevStep}
          >
            <ChevronLeft size={18} className="mr-1" />
            Kembali
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className={!isEditMode && step === 2 ? "hidden" : "flex-1"}
          onClick={onCancel}
        >
          Batal
        </Button>
        {!isEditMode && step === 1 && (() => {
          // Compute inline errors for "Lanjut" button disabled state
          const rowErrors: Record<string, string> = {};
          const nameCounts: Record<string, string[]> = {};

          // First pass: count names and collect unit ids
          for (const u of units) {
            const nameTrimmed = u.name.trim().toLowerCase();
            if (!u.name.trim()) {
              rowErrors[u.id] = "Nama tidak boleh kosong";
            } else {
              if (!nameCounts[nameTrimmed]) {
                nameCounts[nameTrimmed] = [];
              }
              nameCounts[nameTrimmed].push(u.id);
            }
          }

          // Second pass: mark ALL duplicates
          for (const [, unitIds] of Object.entries(nameCounts)) {
            if (unitIds.length > 1) {
              for (const id of unitIds) {
                rowErrors[id] = "Nama sudah digunakan";
              }
            }
          }

          // Third pass: check other validations
          for (const u of units) {
            if (!u.is_base) {
              if (!u.referenceUnitId) {
                rowErrors[u.id] = (rowErrors[u.id] ? rowErrors[u.id] + "; " : "") + "Harus pilih satuan acuan";
              }
              if (u.relativeConversion < 1) {
                rowErrors[u.id] = (rowErrors[u.id] ? rowErrors[u.id] + "; " : "") + "Isi harus ≥ 1";
              }
            }
          }

          const hasErrors = Object.keys(rowErrors).length > 0 || units.length === 0;

          return (
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleNextStep}
              disabled={hasErrors}
            >
              Lanjut
              <ChevronRight size={18} className="ml-1" />
            </Button>
          );
        })()}
        {(isEditMode || step === 2) && (
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isPending || unitErrors !== ""}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        )}
      </div>
    </form>
  );
}

export default ProductForm;
