import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function fetchTransactions({ dateFrom, dateTo }) {
  let query = supabase
    .from("transactions")
    .select("*, transaction_items(id, qty, products(id, name))")
    .order("created_at", { ascending: false })
    .limit(100);

  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export const useTransactions = (dateFrom, dateTo) => {
  return useQuery({
    queryKey: ["transactions", dateFrom, dateTo],
    queryFn: () => fetchTransactions({ dateFrom, dateTo }),
    enabled: !!dateFrom && !!dateTo,
  });
};
