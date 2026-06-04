// src/services/productService.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/types";
import { createOrUpdateProductWithAudit } from "./marginService";
import { supabase } from "./supabase";

type ProductMutationPayload = Product & {
  userId: string;
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
        .select("*")
        .eq("is_deleted", false)
        .order("name");

      if (error) throw error;

      // Calculate margin info on frontend
      return data.map((product) => ({
        ...product,
        margin_rp: (product.price || 0) - (product.cost_price || 0),
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
 * Create product dengan audit
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Omit<ProductMutationPayload, "id">>({
    mutationFn: async (payload) => {
      const { userId, ...productData } = payload;
      if (!userId) throw new Error("User not authenticated");

      const result = await createOrUpdateProductWithAudit(productData, userId);

      if (!result.success) {
        throw new Error(result.error || "Failed to create product");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

/**
 * Update product dengan audit
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ProductMutationPayload>({
    mutationFn: async (payload) => {
      const { userId, ...productData } = payload;
      if (!userId) throw new Error("User not authenticated");

      const result = await createOrUpdateProductWithAudit(productData, userId);

      if (!result.success) {
        throw new Error(result.error || "Failed to update product");
      }

      return result.data;
    },
    onSuccess: (_, productData) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productData.id] });
    },
  });
};

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
