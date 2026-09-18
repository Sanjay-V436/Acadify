"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentUser,
  logout,
  DecodedUser,
} from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<DecodedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      router.replace("/login");
      return;
    }

    // Defer state updates to avoid synchronous setState inside the effect
    // which can cause cascading renders.
    const t = setTimeout(() => {
      setUser(currentUser);
      setLoading(false);
    }, 0);

    return () => clearTimeout(t);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#A4123F]">
          ACADIFY
        </h1>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[#2B2B2E]/70">
            {user.email}
          </span>

          <button
            onClick={handleLogout}
            className="rounded-md border border-[#A4123F]/30 px-4 py-2 text-sm text-[#A4123F] hover:bg-[#A4123F]/5"
          >
            Log Out
          </button>
        </div>
      </header>

      {user.role === "STUDENT" && (
        <StudentDashboard user={user} />
      )}

      {user.role === "FACULTY" && (
        <FacultyDashboard user={user} />
      )}

      {user.role === "ADMIN" && (
        <AdminDashboard user={user} />
      )}
    </div>
  );
}

function StudentDashboard({
  user,
}: {
  user: DecodedUser;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#2B2B2E]">
        Student Dashboard
      </h2>

      <p className="mt-2 text-[#2B2B2E]/60">
        Welcome, <strong>{user.email}</strong>.
      </p>

      <p className="mt-2 text-[#2B2B2E]/60">
        Mentor recommendations, study resources, and your
        projects will appear here.
      </p>

      <Link
        href="/dashboard/mentor-recommendation"
        className="mt-8 block rounded-lg border-2 border-[#E8A33D] bg-[#A4123F] p-6 text-white shadow-sm transition hover:bg-[#8D0F36] focus:outline-none focus:ring-2 focus:ring-[#E8A33D] focus:ring-offset-2"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-block rounded-full bg-[#E8A33D] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2B2B2E]">
              Flagship Feature
            </span>
            <h3 className="mt-3 text-2xl font-bold">Find Project Mentor</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
              Get matched with faculty based on research alignment and live
              slot availability
            </p>
          </div>

          <span className="shrink-0 text-sm font-bold text-[#E8A33D]">
            Launch Matching &rarr;
          </span>
        </div>
      </Link>
    </div>
  );
}

function FacultyDashboard({
  user,
}: {
  user: DecodedUser;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#2B2B2E]">
        Faculty Dashboard
      </h2>

      <p className="mt-2 text-[#2B2B2E]/60">
        Welcome, <strong>{user.email}</strong>.
      </p>

      <p className="mt-2 text-[#2B2B2E]/60">
        Manage your uploaded resources and mentored
        projects here.
      </p>
    </div>
  );
}

function AdminDashboard({
  user,
}: {
  user: DecodedUser;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#2B2B2E]">
        Admin Dashboard
      </h2>

      <p className="mt-2 text-[#2B2B2E]/60">
        Welcome, <strong>{user.email}</strong>.
      </p>

      <p className="mt-2 text-[#2B2B2E]/60">
        Manage users, departments, subjects, and platform
        analytics here.
      </p>
    </div>
  );
}