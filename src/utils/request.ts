import axios from "axios";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import store from "@/store";
import { getAuthConfig } from "./auth-codes";

const AUTH_ENTRY_ENDPOINTS = [
  "/v1/auth/login",
  "/auth/login",
  "/v1/auth/register",
  "/auth/register",
  "/v1/auth/forgot-password",
  "/v1/auth/reset-password",
];

const AUTH_RESPONSE_CODES = new Set([401, 10002, 10003, 10004, 10006, 10012, 10015]);

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

let isHandling401 = false;
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const isAuthEntryRequest = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_ENTRY_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

const getResponseErrorMessage = (error: AxiosError, fallback = "请求失败") => {
  if (error.response && typeof error.response.data === "object") {
    const responseData = error.response.data as any;
    return responseData?.message || responseData?.error?.message || fallback;
  }

  return fallback;
};

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(token);
  });

  failedQueue = [];
};

service.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        if (/^[\x00-\x7F]*$/.test(token)) {
          const headers = (config.headers || {}) as any;
          headers.Authorization = `Bearer ${token}`;
          config.headers = headers;
        } else {
          console.error("Invalid token format detected, removing token");
          store.dispatch("auth/clearPermissions", null, { root: true });
        }
      } catch (requestError) {
        console.error("Error processing token:", requestError);
        store.dispatch("auth/clearPermissions", null, { root: true });
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.config.responseType === "blob") {
      return response;
    }

    const res = response.data;
    if (res?.code === 200) {
      return res.data;
    }

    const errorCode = res?.code || res?.errorCode;
    const errorMessage = res?.message || "请求失败";

    if (AUTH_RESPONSE_CODES.has(errorCode)) {
      if (isAuthEntryRequest(response.config.url)) {
        return Promise.reject(new Error(errorMessage));
      }

      handleAuthError(errorMessage, errorCode);
      return Promise.reject(new Error(errorMessage));
    }

    ElMessage.error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  },
  async (error: AxiosError) => {
    const originalRequest = (error.config || {}) as AxiosRequestConfig & {
      _retry?: boolean;
      headers?: any;
    };

    console.log("处理HTTP状态码", error.response?.status, originalRequest?.url);

    if (error.response?.status === 403) {
      ElMessage.error(getResponseErrorMessage(error, "访问被拒绝"));
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      const errorMessage = getResponseErrorMessage(error, "认证失败");

      if (isAuthEntryRequest(originalRequest?.url)) {
        return Promise.reject(new Error(errorMessage));
      }

      if (originalRequest.url?.includes("/auth/refresh-token")) {
        handleAuthError(errorMessage, 10012);
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (!token) {
              return Promise.reject(error);
            }

            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return service(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          await store.dispatch("user/refreshToken");
          const newToken = localStorage.getItem("token");

          if (!newToken) {
            throw new Error("刷新后未获取到新 token");
          }

          processQueue(null, newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return service(originalRequest);
        } catch (refreshError: any) {
          processQueue(refreshError, null);

          let refreshErrorMessage = "登录已过期，请重新登录";
          let refreshErrorCode: string | number | undefined = 10012;

          if (refreshError?.response?.data && typeof refreshError.response.data === "object") {
            refreshErrorMessage = refreshError.response.data.message || refreshErrorMessage;
            refreshErrorCode =
              refreshError.response.data.code || refreshError.response.data.errorCode || 10012;
          }

          handleAuthError(refreshErrorMessage, refreshErrorCode);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    ElMessage.error(getResponseErrorMessage(error));
    return Promise.reject(error);
  }
);

function handleAuthError(message: string, code?: string | number) {
  if (isHandling401) {
    return;
  }

  isHandling401 = true;
  const config = getAuthConfig(code);

  ElMessageBox.confirm(config.message || message, config.title, {
    confirmButtonText: config.confirmButtonText,
    showCancelButton: config.showCancelButton,
    type: config.type,
  }).finally(() => {
    try {
      store.dispatch("auth/clearPermissions", null, { root: true });
    } catch (clearError) {
      console.error("清理权限失败:", clearError);
    }

    if (config.needRedirect) {
      const getRedirectPath = () => {
        const { pathname, search } = window.location;
        if (pathname !== "/login") return pathname + search;

        const redirect = new URLSearchParams(search).get("redirect");
        return redirect && !redirect.includes("/login") ? decodeURIComponent(redirect) : "/";
      };

      const redirectUrl = `/login?redirect=${encodeURIComponent(getRedirectPath())}`;

      import("@/router")
        .then(({ default: router }) => {
          router.push(redirectUrl);
        })
        .catch((routerError) => {
          console.error("使用 router 跳转失败，改用 window.location:", routerError);
          window.location.href = redirectUrl;
        });
    }

    setTimeout(() => {
      isHandling401 = false;
    }, 800);
  });
}

const isBlob = (data: any): boolean => {
  return data instanceof Blob && data.type !== "application/json";
};

export const downloadFile = async (
  url: string,
  params?: any,
  filename?: string,
  config?: any
) => {
  const loadingInstance = ElLoading.service({
    text: "正在下载文件，请稍候...",
    background: "rgba(0, 0, 0, 0.7)",
  });

  try {
    const response = await service({
      url,
      method: "get",
      params,
      responseType: "blob",
      ...config,
    });

    if (isBlob(response.data)) {
      const blob = new Blob([response.data]);
      const link = document.createElement("a");

      link.href = window.URL.createObjectURL(blob);
      link.download = filename || "download";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      ElMessage.success("文件下载成功");
      return;
    }

    const text = await response.data.text();

    try {
      const errorData = JSON.parse(text);
      ElMessage.error(errorData.message || "下载失败");
    } catch {
      ElMessage.error("下载失败，请稍后重试");
    }
  } catch (downloadError: any) {
    console.error("文件下载错误:", downloadError);
    ElMessage.error(downloadError.message || "下载文件出现错误，请联系管理员");
  } finally {
    loadingInstance.close();
  }
};

export default function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  return service(config) as unknown as Promise<T>;
}
