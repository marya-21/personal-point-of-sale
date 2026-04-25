// src/services/checkoutService.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { processCheckoutWithMargins } from "./marginService";
import { supabase } from "./supabase";

/**
 * Checkout mutation with margin calculation
 */
export const useCheckout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkoutData) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const result = await processCheckoutWithMargins(checkoutData, user.id);

      if (!result.success) {
        throw new Error(result.error || "Checkout failed");
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate caches setelah checkout berhasil
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
