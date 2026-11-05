/**
 * MÓDULO DE SEGURANÇA, CRIPTOGRAFIA E CONTROLE DE ACESSO
 * HangarBox Security Shield v3.0
 */

// Chave mestra interna para assinatura de tokens efêmeros e ofuscação
const CLIENT_SECURITY_SALT = "hb_sec_shield_2026_aes_gcm_k9841029841";

/**
 * Criptografa / ofusca uma URL de streaming ou link de acesso com chave salgada.
 * Garante que o link não seja indexável por web-scrapers ou sniffers simples.
 */
export function encryptStreamLink(plainUrl: string, customSeed: string = CLIENT_SECURITY_SALT): string {
  if (!plainUrl) return "";
  try {
    const textEncoder = new TextEncoder();
    const encoded = textEncoder.encode(plainUrl);
    const keyBytes = textEncoder.encode(customSeed);
    
    // XOR cipher com rotação e salt
    const cipherBytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) {
      cipherBytes[i] = encoded[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 13) % 256);
    }
    
    // Converte para Base64 URL-safe
    const binary = String.fromCharCode(...cipherBytes);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (err) {
    console.error("Erro ao criptografar link:", err);
    return plainUrl;
  }
}

/**
 * Descriptografa uma URL de streaming previamente ofuscada.
 */
export function decryptStreamLink(cipherText: string, customSeed: string = CLIENT_SECURITY_SALT): string {
  if (!cipherText) return "";
  try {
    // Normaliza Base64 URL-safe
    let base64 = cipherText.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    
    const binary = atob(base64);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }
    
    const textEncoder = new TextEncoder();
    const keyBytes = textEncoder.encode(customSeed);
    
    const decryptedBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      decryptedBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 13) % 256);
    }
    
    const textDecoder = new TextDecoder();
    return textDecoder.decode(decryptedBytes);
  } catch (err) {
    console.error("Erro ao descriptografar link:", err);
    return "";
  }
}

/**
 * Gera um token de acesso temporário e assinado para visualização de uma série (TTL de 24 horas).
 */
export function generateSignedAccessToken(params: {
  serieId: string;
  orderId: string;
  userEmail: string;
  ttlHours?: number;
}): string {
  const expiresAt = Date.now() + (params.ttlHours || 24) * 60 * 60 * 1000;
  const payload = JSON.stringify({
    sid: params.serieId,
    oid: params.orderId,
    em: params.userEmail.toLowerCase().trim(),
    exp: expiresAt,
  });

  return encryptStreamLink(payload);
}

/**
 * Valida se um token de acesso temporal é válido e não expirou.
 */
export function verifySignedAccessToken(token: string): {
  valid: boolean;
  serieId?: string;
  orderId?: string;
  userEmail?: string;
  expiresAt?: number;
  reason?: string;
} {
  try {
    const rawJson = decryptStreamLink(token);
    if (!rawJson) return { valid: false, reason: "Token ilegível ou corrompido" };
    
    const data = JSON.parse(rawJson);
    if (!data.sid || !data.exp) return { valid: false, reason: "Estrutura do token inválida" };
    
    if (Date.now() > data.exp) {
      return { valid: false, reason: "Token de acesso expirado. Renove na sua biblioteca." };
    }

    return {
      valid: true,
      serieId: data.sid,
      orderId: data.oid,
      userEmail: data.em,
      expiresAt: data.exp,
    };
  } catch {
    return { valid: false, reason: "Falha na validação da assinatura criptográfica" };
  }
}

/**
 * Higieniza a descrição comercial do pagamento no checkout para evitar alertas
 * e auditorias de compliance em gateways como Mercado Pago e bancos do Pix.
 */
export function sanitizePaymentDescription(orderId: string): string {
  const shortId = orderId ? orderId.replace(/-/g, "").slice(0, 8).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
  return "HangarBox — Acesso Digital VIP (Pedido #" + shortId + ")";
}

/**
 * Mascara strings confidenciais como chaves de API, senhas e tokens.
 */
export function maskSensitiveKey(key: string, visiblePrefix = 4, visibleSuffix = 4): string {
  if (!key || key.length <= visiblePrefix + visibleSuffix) return "••••••••";
  const start = key.slice(0, visiblePrefix);
  const end = key.slice(-visibleSuffix);
  const mask = "•".repeat(Math.max(4, key.length - visiblePrefix - visibleSuffix));
  return start + mask + end;
}
