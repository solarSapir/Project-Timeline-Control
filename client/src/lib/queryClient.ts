import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { trackAction, logError } from "./error-logger";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  trackAction("API Request", { method, url });

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  try {
    await throwIfResNotOk(res);
  } catch (err: unknown) {
    if (!url.includes("/api/error-logs")) {
      const message = err instanceof Error ? err.message : String(err);
      logError(message, {
        errorSource: "api_error",
        apiEndpoint: url,
        apiMethod: method,
        apiPayload: data ? JSON.stringify(data).substring(0, 2000) : undefined,
        stackTrace: err instanceof Error ? err.stack : undefined,
      });
    }
    throw err;
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
