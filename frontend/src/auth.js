import { reactive } from "vue";
import client from "./api/client";
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from "./auth-storage";

export const authState = reactive({
  ready: false,
  enabled: false,
  token: getStoredAuthToken(),
});

let configPromise = null;

export async function ensureAuthConfig(force = false) {
  if (!force && authState.ready) {
    return authState;
  }
  if (!force && configPromise) {
    return configPromise;
  }

  configPromise = client.get("/auth/config")
    .then((result) => {
      authState.enabled = Boolean(result?.enabled);
      authState.ready = true;
      if (!authState.enabled) {
        authState.token = "";
        clearStoredAuthToken();
      }
      return authState;
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

export async function loginWithPassword(password) {
  const result = await client.post("/auth/login", { password });
  const token = String(result?.token || "");
  authState.enabled = Boolean(result?.enabled);
  authState.token = token;
  authState.ready = true;
  setStoredAuthToken(token);
  return result;
}

export function logout() {
  authState.token = "";
  clearStoredAuthToken();
}
