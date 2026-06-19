import { useMutation, useQueryClient } from "@tanstack/react-query";
import { processCheckoutWithMargins } from "./marginService";
import { useAuth } from "../hooks/useAuth";
import type { CheckoutRequest } from "../types";

export const useCheckout = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (checkoutData: CheckoutRequest) => {
      if (!userId) throw new Error("User not authenticated");

      const result = await processCheckoutWithMargins(checkoutData, userId);

      if (!result.success) {
        throw new Error(result.error || "Checkout failed");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
