import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import supabase from "./supabase";
import { createOrUpdateProductWithAudit } from "./marginService";

// Get all products with margin info
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
        margin_rp: product.price_sell - product.price_cost,
        margin_percent:
          product.price_sell > 0
            ? (
                ((product.price_sell - product.price_cost) /
                  product.price_sell) *
                100
              ).toFixed(2)
            : 0,
      }));
    },
  });
};

// Create product dengan audit
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData) => {
      const userId = (await supabase.auth.getUser()).data.user.id;
      return createOrUpdateProductWithAudit(productData, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

// Update product dengan audit
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData) => {
      const userId = (await supabase.auth.getUser()).data.user.id;
      return createOrUpdateProductWithAudit(productData, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};
