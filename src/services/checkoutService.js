// src/services/checkoutService.js

import { useMutation, useQueryClient } from "@tanstack/react-query";
import supabase from "./supabase";
import { processCheckoutWithMargins } from "./marginService";

export const useCheckout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkoutData) => {
      const userId = (await supabase.auth.getUser()).data.user.id;
      return processCheckoutWithMargins(checkoutData, userId);
    },
    onSuccess: () => {
      // Invalidate products (stock changed)
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Invalidate transactions
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
