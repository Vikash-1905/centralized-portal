import axios from "axios";
import { AUTH_STORAGE_KEY } from "../constants/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return config;
    }

    const session = JSON.parse(raw);
    if (!session?.token) {
      return config;
    }

    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${session.token}`;
    return config;
  } catch {
    return config;
  }
});

export default api;
