import { useQuery } from "@tanstack/react-query";
import { getDailyMarginReport, getProductMarginReport } from "./marginService";

export const useDailyMarginReport = (startDate, endDate) => {
  return useQuery({
    queryKey: ["marginReport", "daily", startDate, endDate],
    queryFn: () => getDailyMarginReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};

export const useProductMarginReport = (startDate, endDate) => {
  return useQuery({
    queryKey: ["marginReport", "products", startDate, endDate],
    queryFn: () => getProductMarginReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};
