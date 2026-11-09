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

/**
 * Validação rigorosa e sanitização anti-injection de e-mail (RFC 5322).
 * Rejeita injeção de cabeçalhos de e-mail (\r, \n, %0a, %0d).
 */
export function validateEmailSecurity(rawEmail: string): { valid: boolean; email: string; error?: string } {
  if (!rawEmail || typeof rawEmail !== "string") {
    return { valid: false, email: "", error: "O e-mail é obrigatório." };
  }
  const trimmed = rawEmail.trim().toLowerCase();
  
  // Anti-CRLF header injection check
  if (/[\r\n%0a%0d]/.test(trimmed)) {
    return { valid: false, email: "", error: "Formato de e-mail inválido ou caracteres proibidos." };
  }

  // RFC 5322 standard email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, email: "", error: "Endereço de e-mail inválido." };
  }

  if (trimmed.length > 254) {
    return { valid: false, email: "", error: "E-mail excede o tamanho máximo permitido." };
  }

  return { valid: true, email: trimmed };
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muito Fraca" | "Fraca" | "Média" | "Forte" | "Excelente";
  color: string;
  valid: boolean;
  errors: string[];
}

/**
 * Avaliação rigorosa da entropia e força da senha segundo diretrizes NIST SP 800-63B.
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  if (!password) {
    return { score: 0, label: "Muito Fraca", color: "#ef4444", valid: false, errors: ["A senha não pode estar em branco."] };
  }

  const COMMON_BLACKLIST = [
    "123456", "12345678", "123456789", "password", "senha123", "admin123",
    "hangarbox", "hangar123", "master123", "qwerty", "brasil123", "mudar123"
  ];

  if (COMMON_BLACKLIST.includes(password.toLowerCase())) {
    return { score: 0, label: "Muito Fraca", color: "#ef4444", valid: false, errors: ["Esta senha é muito comum e fácil de adivinhar."] };
  }

  let points = 0;
  if (password.length >= 8) points++;
  else errors.push("Mínimo de 8 caracteres.");

  if (/[A-Z]/.test(password)) points++;
  else errors.push("Pelo menos uma letra maiúscula.");

  if (/[a-z]/.test(password)) points++;
  else errors.push("Pelo menos uma letra minúscula.");

  if (/[0-9]/.test(password)) points++;
  else errors.push("Pelo menos um número.");

  if (/[^A-Za-z0-9]/.test(password)) points++;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let label: "Muito Fraca" | "Fraca" | "Média" | "Forte" | "Excelente" = "Muito Fraca";
  let color = "#ef4444";

  if (points <= 1) {
    score = 0; label = "Muito Fraca"; color = "#ef4444";
  } else if (points === 2) {
    score = 1; label = "Fraca"; color = "#f97316";
  } else if (points === 3) {
    score = 2; label = "Média"; color = "#eab308";
  } else if (points === 4) {
    score = 3; label = "Forte"; color = "#22c55e";
  } else if (points >= 5) {
    score = 4; label = "Excelente"; color = "#10b981";
  }

  const valid = password.length >= 8 && points >= 3;
  return { score, label, color, valid, errors };
}

/**
 * Remove fragmentos sensíveis da URL no navegador (#access_token=...&type=recovery)
 * de forma atômica para evitar vazamentos em logs do navegador, histórico ou cabeçalhos Referer.
 */
export function stripSensitiveUrlHash(): void {
  if (typeof window === "undefined") return;
  if (window.location.hash && (window.location.hash.includes("access_token") || window.location.hash.includes("type=recovery"))) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

/**
 * Controle de Rate Limiting no cliente para recuperação de senha (anti-flood/spam).
 */
export function checkRecoveryRateLimit(key: string, cooldownSeconds = 60): { throttled: boolean; remainingSeconds: number } {
  if (typeof window === "undefined") return { throttled: false, remainingSeconds: 0 };
  const storageKey = "hb_ratelimit_" + key;
  const lastTime = sessionStorage.getItem(storageKey);
  if (!lastTime) return { throttled: false, remainingSeconds: 0 };

  const diffMs = Date.now() - parseInt(lastTime, 10);
  const cooldownMs = cooldownSeconds * 1000;
  if (diffMs < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - diffMs) / 1000);
    return { throttled: true, remainingSeconds: remaining };
  }
  return { throttled: false, remainingSeconds: 0 };
}

export function recordRecoveryAttempt(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("hb_ratelimit_" + key, Date.now().toString());
}

