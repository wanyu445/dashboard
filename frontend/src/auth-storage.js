const STORAGE_KEY = "dashboard.auth.token";

export function getStoredAuthToken() {
  return typeof window === "undefined" ? "" : String(window.localStorage.getItem(STORAGE_KEY) || "");
}

export function setStoredAuthToken(token) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(token || ""));
  }
}

export function clearStoredAuthToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
