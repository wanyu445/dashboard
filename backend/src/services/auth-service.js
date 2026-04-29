const crypto = require("crypto");

function createAuthService(config) {
  const password = String(config.authPassword || "");
  const enabled = password.length > 0;
  const sessionTtlMs = Math.max(1, Number(config.authSessionDays) || 30) * 24 * 60 * 60 * 1000;

  return {
    enabled,
    sessionTtlMs,
    verifyPassword(candidate) {
      if (!enabled) {
        return true;
      }
      return safeEqual(String(candidate || ""), password);
    },
    createSessionToken() {
      const payload = {
        exp: Date.now() + sessionTtlMs,
      };
      const encodedPayload = encodePayload(payload);
      const signature = signPayload(encodedPayload, password);
      return `${encodedPayload}.${signature}`;
    },
    verifyAuthorizationHeader(headerValue) {
      if (!enabled) {
        return true;
      }
      const token = extractBearerToken(headerValue);
      return verifySessionToken(token, password);
    },
  };
}

function extractBearerToken(headerValue) {
  const text = String(headerValue || "").trim();
  const match = text.match(/^Bearer\s+(.+)$/iu);
  return match ? match[1].trim() : "";
}

function verifySessionToken(token, password) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = String(token).split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, password);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return Number(payload?.exp) > Date.now();
  } catch {
    return false;
  }
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signPayload(encodedPayload, password) {
  return crypto.createHmac("sha256", password).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { createAuthService };
