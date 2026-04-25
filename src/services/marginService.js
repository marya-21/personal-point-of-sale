import { supabase } from "./supabase";

// Create or Update Product with Audit
export const createOrUpdateProductWithAudit = async (productData, userId) => {
  const { data, error } = await supabase.rpc(
    "create_or_update_product_with_audit",
    {
      p_id: productData.id || null,
      p_barcode: productData.barcode,
      p_name: productData.name,
      p_price_cost: productData.price_cost,
      p_price_sell: productData.price_sell,
      p_user_id: userId,
      p_reason: productData.reason || null,
    },
  );

  if (error) throw error;
  return data;
};

// Checkout with Margins
export const processCheckoutWithMargins = async (checkoutData, userId) => {
  const { data, error } = await supabase.rpc("process_checkout_with_margins", {
    p_items: JSON.stringify(checkoutData.items),
    p_cash_amount: checkoutData.cash_amount,
    p_payment_method: checkoutData.payment_method,
    p_user_id: userId,
    p_notes: checkoutData.notes || null,
  });

  if (error) throw error;
  return data[0]; // RPC returns array
};

// Get Daily Margin Report
export const getDailyMarginReport = async (startDate, endDate) => {
  const { data, error } = await supabase.rpc("get_margin_report_daily", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return data;
};

// Get Product Margin Report
export const getProductMarginReport = async (startDate, endDate) => {
  const { data, error } = await supabase.rpc("get_margin_report_by_product", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return data;
};

// Get Product Price History
export const getProductPriceHistory = async (productId) => {
  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_id", productId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return data;
};

// Get Transaction Detail with Margins
export const getTransactionWithMargins = async (transactionId) => {
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (txError) throw txError;

  const { data: items, error: itemsError } = await supabase
    .from("transaction_items")
    .select(
      `
      *,
      products (id, name, barcode)
      `,
    )
    .eq("transaction_id", transactionId);

  if (itemsError) throw itemsError;

  return {
    ...transaction,
    items,
  };
};
