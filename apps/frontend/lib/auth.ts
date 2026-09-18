export interface DecodedUser {
  userId: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "ADMIN";
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
let refreshPromise: Promise<boolean | null> | null = null;
let sessionExpiryNotified = false;

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken");
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = window.localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 401) return false;
      if (!response.ok) return null;

      const tokens = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };

      if (!tokens.accessToken || !tokens.refreshToken) return false;

      window.localStorage.setItem("accessToken", tokens.accessToken);
      window.localStorage.setItem("refreshToken", tokens.refreshToken);
      sessionExpiryNotified = false;
      return true;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function notifySessionExpired() {
  if (sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  window.dispatchEvent(new Event("acadify:session-expired"));
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const request = (token: string | null) =>
    fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let response = await request(getAccessToken());
  if (response.status !== 401) return response;

  const refreshed = await refreshAccessToken();
  if (refreshed === false) {
    notifySessionExpired();
    return response;
  }

  if (refreshed === null) return response;

  response = await request(getAccessToken());
  if (response.status === 401) notifySessionExpired();
  return response;
}

export function getCurrentUser(): DecodedUser | null {
  // Prevent access to localStorage during server-side rendering
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem("accessToken");

  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as {
      sub: string;
      email: string;
      role: DecodedUser["role"];
    };

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    console.error("Invalid JWT:", error);
    return null;
  }
}

export function logout() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  sessionExpiryNotified = false;
}