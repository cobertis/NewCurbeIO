import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response, text?: string) {
  if (!res.ok) {
    const errorText = text || (await res.text()) || res.statusText;
    
    // Check if response is JSON and contains deactivated flag
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.deactivated) {
        // Redirect to login immediately with deactivated message
        window.location.href = "/login?deactivated=true";
        throw new Error(errorData.message || "Account deactivated");
      }
    } catch (e) {
      // If JSON parsing fails, continue with original error
      if (e instanceof SyntaxError) {
        // JSON parse error, continue below
      } else {
        throw e; // Re-throw if it's the deactivated redirect
      }
    }
    
    throw new Error(`${res.status}: ${errorText}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Read the response text once
  const text = await res.text();
  
  // Check if response is ok, passing the text we already read
  if (!res.ok) {
    await throwIfResNotOk(res, text);
  }
  
  // Parse JSON response if content exists
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error('Failed to parse response as JSON:', text);
    return {};
  }
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
      // Auto-refresh strategy: keep data fresh without manual page reload
      staleTime: 60 * 1000, // Data is fresh for 60 seconds
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when connection is restored
      refetchOnMount: "always", // Always fetch fresh data when component mounts
      refetchIntervalInBackground: false, // Don't poll when tab is not visible
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
