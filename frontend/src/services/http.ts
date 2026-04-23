import { useSessionStore } from "../store/session-store";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = useSessionStore.getState().token;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  if (!response.ok) {
    const fallback = { message: "Request failed" };
    const payload = (await response.json().catch(() => fallback)) as { message?: string };
    throw new Error(payload.message ?? fallback.message);
  }

  return (await response.json()) as T;
}
