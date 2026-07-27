export interface DecodedUser {
  userId: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "ADMIN";
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
}