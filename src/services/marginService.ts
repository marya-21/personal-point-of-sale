import { supabase } from "./supabase";

/**
 * Create or Update Product with Audit Log
 * @param {Object} productData - {id?, barcode, name, price_cost, price_sell, reason?}
 * @param {string} userId - User ID dari auth
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const createOrUpdateProductWithAudit = async (productData, userId) => {
  try {
    const { data, error } = await supabase.rpc(
      "create_or_update_product_with_audit",
      {
        p_barcode: productData.barcode,
        p_name: productData.name,
        p_price_cost: productData.price_cost,
        p_price_sell: productData.price_sell,
        p_user_id: userId,
        p_id: productData.id || null,
        p_reason: productData.reason || null,
        p_stock: productData.stock,
      },
    );

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: data[0]?.success || false,
      data: data[0] || null,
      error: data[0]?.message || null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Process Checkout with Margins
 * @param {Object} checkoutData - {items: [{product_id, qty}], cash_amount, payment_method, notes?}
 * @param {string} userId - User ID dari auth
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const processCheckoutWithMargins = async (checkoutData, userId) => {
  try {
    const { data, error } = await supabase.rpc(
      "process_checkout_with_margins",
      {
        p_items: JSON.stringify(checkoutData.items),
        p_cash_amount: parseFloat(checkoutData.cash_amount),
        p_payment_method: checkoutData.payment_method,
        p_user_id: userId,
        p_notes: checkoutData.notes || null,
      },
    );

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    const result = data[0];
    return {
      success: result?.success || false,
      data: result || null,
      error: result?.message || null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Get Daily Margin Report
 * @param {string} startDate - Format: YYYY-MM-DD
 * @param {string} endDate - Format: YYYY-MM-DD
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getDailyMarginReport = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase.rpc("get_margin_report_daily", {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Get Product Margin Report
 * @param {string} startDate - Format: YYYY-MM-DD
 * @param {string} endDate - Format: YYYY-MM-DD
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getProductMarginReport = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase.rpc("get_margin_report_by_product", {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Get Product Price History
 * @param {string} productId - Product UUID
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getProductPriceHistory = async (productId) => {
  try {
    const { data, error } = await supabase
      .from("product_price_history")
      .select("*")
      .eq("product_id", productId)
      .order("changed_at", { ascending: false });

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Get Transaction Detail with Margins
 * @param {string} transactionId - Transaction UUID
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getTransactionWithMargins = async (transactionId) => {
  try {
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError) {
      return {
        success: false,
        data: null,
        error: txError.message,
      };
    }

    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select(
        `
        *,
        products:product_id (id, name, barcode)
        `,
      )
      .eq("transaction_id", transactionId);

    if (itemsError) {
      return {
        success: false,
        data: null,
        error: itemsError.message,
      };
    }

    return {
      success: true,
      data: {
        ...transaction,
        items,
      },
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};

/**
 * Get Margin Audit Log
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getMarginAuditLog = async () => {
  try {
    const { data, error } = await supabase
      .from("margin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message,
    };
  }
};
