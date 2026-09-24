"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, DecodedUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<DecodedUser | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();

    const timer = setTimeout(() => {
      setMounted(true);
      setUser(currentUser);

      if (!currentUser) {
        router.replace("/login");
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [router]);

  if (!mounted || !user) return null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#F5F3EF]">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 pb-24 md:ml-64 md:p-8 md:pb-8">
          {children}
        </main>
        <SessionExpiredModal />
      </div>
    </ToastProvider>
  );
}