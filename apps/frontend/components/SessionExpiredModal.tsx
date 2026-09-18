"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function SessionExpiredModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setOpen(true);
    window.addEventListener("acadify:session-expired", handleSessionExpired);
    return () => window.removeEventListener("acadify:session-expired", handleSessionExpired);
  }, []);

  if (!open) return null;

  const signInAgain = () => {
    logout();
    setOpen(false);
    router.replace("/login");
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#2B2B2E]/35 p-5 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        className="w-full max-w-md rounded-2xl border border-[#2B2B2E]/10 bg-white p-7 shadow-2xl sm:p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#A4123F]/10 text-xl text-[#A4123F]">
          !
        </div>
        <h2 id="session-expired-title" className="mt-5 font-(--font-display) text-3xl text-[#2B2B2E]">
          Your session has expired
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#2B2B2E]/65">
          For your security, please sign in again to continue.
        </p>
        <button
          type="button"
          autoFocus
          onClick={signInAgain}
          className="mt-7 w-full rounded-xl bg-[#A4123F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8D0F36] focus:outline-none focus:ring-2 focus:ring-[#A4123F]/30"
        >
          Sign In Again
        </button>
      </div>
    </div>
  );
}
