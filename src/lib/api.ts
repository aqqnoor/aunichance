function getToken() {
  return localStorage.getItem("token");
}

// Vite env тек VITE_ префикспен оқылады
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
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
    throw new Error(`API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`);
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
    throw new Error(`API ${res.status} ${res.statusText} :: ${API_URL}${path} :: ${text}`);
  }
  return res.json();
}
