// src/services/productService.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProductUnit } from "@/types";
import { supabase } from "./supabase";

type ProductMutationPayload = {
  userId: string;
  p_name: string;
  p_total_harga_beli: number | null;
  p_qty_input: number;
  p_stock_unit_name: string;
  p_units: string;
  id?: string; // For updates
  reason?: string;
};

/**
 * Fetch all products with margin calculations
 */
export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          barcode,
          stock,
          price_sell,
          price_cost,
          product_units(id, name, conversion, is_base, barcode, price_sell)
        `)
        .eq("is_deleted", false)
        .order("name");

      if (error) throw error;

      // Calculate margin info on frontend
      return data.map((product) => ({
        ...product,
        margin_rp: (product.price_sell || 0) - (product.price_cost || 0),
        margin_percent:
          product.price_sell > 0
            ? (
                ((product.price_sell - (product.price_cost || 0)) /
                  product.price_sell) *
                100
              ).toFixed(2)
            : 0,
      }));
    },
  });
};

/**
 * Fetch single product
 */
export const useProduct = (productId: string | null) => {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) throw error;

      return {
        ...data,
        margin_rp: (data.price_sell || 0) - (data.price_cost || 0),
        margin_percent:
          data.price_sell > 0
            ? (
                ((data.price_sell - (data.price_cost || 0)) / data.price_sell) *
                100
              ).toFixed(2)
            : 0,
      };
    },
    enabled: !!productId,
  });
};

/**
 * Create product dengan RPC
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Omit<ProductMutationPayload, "id">>({
    mutationFn: async (payload) => {
      const { userId, ...rpcData } = payload;
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await supabase.rpc("create_product_with_units", {
        p_user_id: userId,
        ...rpcData,
      });

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

/**
 * Update product dengan RPC
 */
// export const useUpdateProduct = () => {
//   const queryClient = useQueryClient();

//   return useMutation<any, Error, ProductMutationPayload>({
//     mutationFn: async (payload) => {
//       const { userId, id, ...rpcData } = payload;
//       if (!userId) throw new Error("User not authenticated");
//       if (!id) throw new Error("Product ID is required for update");

//       const { data, error } = await supabase.rpc("update_product_with_units", {
//         p_id: id,
//         p_user_id: userId,
//         ...rpcData,
//       });

//       if (error) throw error;

//       return data;
//     },
//     onSuccess: (_, productData) => {
//       queryClient.invalidateQueries({ queryKey: ["products"] });
//       if (productData.id) {
//         queryClient.invalidateQueries({ queryKey: ["product", productData.id] });
//       }
//     },
//   });
// };

/**
 * Delete product (soft delete)
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (productId) => {
      const { error } = await supabase
        .from("products")
        .update({ is_deleted: true, updated_at: new Date() })
        .eq("id", productId);

      if (error) throw error;

      return { success: true, data: null, error: null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

/**
 * Restock product dengan process_restock function (HPP weighted average)
 */
export const useRestockProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, {
    p_id: string;
    p_unit_id: string;
    p_user_id: string;
    p_qty_input: number;
    p_stock_unit_name: string;
    p_total_harga_beli: number | null;
  }>({
    mutationFn: async (data) => {
      const { p_id, p_unit_id, p_user_id, p_qty_input, p_total_harga_beli } = data;

      const { data: result, error } = await supabase.rpc("process_restock", {
        p_product_id: p_id,
        p_unit_id,
        p_qty_input,
        p_total_harga_beli: p_total_harga_beli || 0,
        p_user_id,
        p_notes: null,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["product", vars.p_id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

/**
 * Fetch list untuk tabel
 */
export async function fetchProductsList() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      stock,
      price_cost,
      product_units(id, name, conversion, is_base, price_sell)
    `)
     .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (error) throw error

  // Transform: ambil base unit info
  return data.map(p => {
    const baseUnit = p.product_units.find(u => u.is_base)
    return {
      id: p.id,
      name: p.name,
      stock: p.stock,
      price_cost: p.price_cost,
      base_unit_name: baseUnit?.name || '',
      price_sell_base: baseUnit?.price_sell || 0
    }
  })
}

/**
 * Fetch detail untuk edit modal
 */
export async function fetchProductDetail(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      stock,
      price_cost,
      product_units(id, name, conversion, is_base, barcode, price_sell)
    `)
    .eq('id', productId)
    .single()

  if (error) throw error
  return data
}


export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      name,
      unitsToUpsert,
      unitsToDelete,
      userId,
    }: {
      productId: string;
      name: string;
      unitsToUpsert: ProductUnit[];
      unitsToDelete: ProductUnit[];
      userId: string;
    }) => {
      const { data, error } = await supabase.rpc('update_product_with_units', {
        p_product_id: productId,
        p_name: name,
        p_units_to_upsert: JSON.stringify(unitsToUpsert),
        p_units_to_delete: JSON.stringify(unitsToDelete),
        p_user_id: userId
      })

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["products-list"] })
      if (variables.productId) {
        queryClient.invalidateQueries({ queryKey: ["product", variables.productId] })
      }
    },
  })
}
