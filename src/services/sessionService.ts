import { supabase } from "./supabase";

/**
 * Generate raw session token (UUID)
 * Token ini disimpan di localStorage client
 */
function generateSessionToken() {
  return crypto.randomUUID();
}

/**
 * Hash token dengan SHA-256
 * Simpan ke DB
 */
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get client IP (best effort)
 */
async function getClientIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Create session di database
 * Return raw token untuk disimpan di client
 */
export async function createSession(userId) {
  try {
    const rawToken = generateSessionToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { error } = await supabase.from("sessions").insert({
      user_id: userId,
      token_hash: tokenHash,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent,
      expires_at: expiresAt.toISOString(),
      last_activity: new Date().toISOString(),
    });

    if (error) throw error;

    // Return raw token (BUKAN hash) ke client
    return { success: true, token: rawToken, expiresAt, error: null };
  } catch (err) {
    console.error("[Session Create Error]", err);
    return { success: false, token: null, expiresAt: null, error: err.message };
  }
}

/**
 * Validate session token
 * Hash raw token dari client, lalu compare dengan database
 */
export async function validateSession(rawToken) {
  try {
    const tokenHash = await hashToken(rawToken);

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (error) {
      console.warn("[Session Validation] Token not found");
      return { valid: false, session: null };
    }

    // Check expired
    if (new Date(data.expires_at) < new Date()) {
      console.warn("[Session Validation] Token expired");
      // Auto cleanup expired session
      await supabase.from("sessions").delete().eq("token_hash", tokenHash);
      return { valid: false, session: null };
    }

    return { valid: true, session: data };
  } catch (err) {
    console.error("[Session Validate Error]", err);
    return { valid: false, session: null };
  }
}

/**
 * Update last_activity & extend expires_at
 */
export async function updateSessionActivity(rawToken) {
  try {
    const tokenHash = await hashToken(rawToken);
    const now = new Date();
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // Extend 1 hour

    const { error } = await supabase
      .from("sessions")
      .update({
        last_activity: now.toISOString(),
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("token_hash", tokenHash);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err) {
    console.error("[Session Update Activity Error]", err);
    return { success: false, error: err.message };
  }
}

/**
 * Destroy session (logout)
 */
export async function destroySession(rawToken) {
  try {
    const tokenHash = await hashToken(rawToken);

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("token_hash", tokenHash);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err) {
    console.error("[Session Destroy Error]", err);
    return { success: false, error: err.message };
  }
}
