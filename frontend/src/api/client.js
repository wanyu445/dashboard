import axios from "axios";
import { clearStoredAuthToken, getStoredAuthToken } from "../auth-storage";

const client = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error?.response?.status === 401 && error?.config?.url !== "/auth/login") {
      clearStoredAuthToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
      }
    }
    const message = error?.response?.data?.message || error.message || "请求失败";
    return Promise.reject(new Error(message));
  }
);

export default client;
