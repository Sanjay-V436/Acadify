"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F3EF] px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-block text-sm font-medium text-[#A4123F]">
          ← Back
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-[#A4123F]">Sign In</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#2B2B2E]">
              Institutional Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-[#2B2B2E]/20 bg-white px-3 py-2.5 text-[#2B2B2E] outline-none focus:border-[#A4123F]"
              placeholder="you@ch.amrita.edu"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#2B2B2E]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-[#2B2B2E]/20 bg-white px-3 py-2.5 text-[#2B2B2E] outline-none focus:border-[#A4123F]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#A4123F] py-2.5 font-medium text-white transition hover:bg-[#8a0f33] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}