// src/services/marginReportService.js
import { useQuery } from "@tanstack/react-query";
import { getDailyMarginReport, getProductMarginReport } from "./marginService";

/**
 * Hook untuk fetch daily margin report
 */
export const useDailyMarginReport = (startDate, endDate) => {
  return useQuery({
    queryKey: ["marginReport", "daily", startDate, endDate],
    queryFn: async () => {
      const result = await getDailyMarginReport(startDate, endDate);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch daily report");
      }

      return result.data;
    },
    enabled: !!startDate && !!endDate,
  });
};

/**
 * Hook untuk fetch product margin report
 */
export const useProductMarginReport = (startDate, endDate) => {
  return useQuery({
    queryKey: ["marginReport", "products", startDate, endDate],
    queryFn: async () => {
      const result = await getProductMarginReport(startDate, endDate);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch product report");
      }

      return result.data;
    },
    enabled: !!startDate && !!endDate,
  });
};
