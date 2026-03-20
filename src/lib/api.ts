export const API_BASE_URL = "http://localhost:8080";

// Vite env читается только с префиксом VITE_
const API_URL = import.meta.env.VITE_API_URL || API_BASE_URL;

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`
    );
  }

  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`
    );
  }

  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`
    );
  }

  return res.json();
}