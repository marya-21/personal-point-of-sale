import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

async function fetchTransactions({ dateFrom, dateTo, cashierId }) {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
  if (cashierId) query = query.eq("created_by", cashierId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export const useTransactions = (dateFrom, dateTo, cashierId) => {
  return useQuery({
    queryKey: ["transactions", dateFrom, dateTo, cashierId],
    queryFn: () => fetchTransactions({ dateFrom, dateTo, cashierId }),
    enabled: !!dateFrom && !!dateTo,
  });
};
