// src/services/checkoutService.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { processCheckoutWithMargins } from "./marginService";
import { useAuth } from "../hooks/useAuth";

/**
 * Checkout mutation with margin calculation
 */
export const useCheckout = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (checkoutData) => {
      if (!userId) throw new Error("User not authenticated");

      const result = await processCheckoutWithMargins(checkoutData, userId);

      if (!result.success) {
        throw new Error(result.error || "Checkout failed");
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate caches after checkout completed
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
