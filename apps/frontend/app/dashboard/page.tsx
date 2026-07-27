"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  }, []);

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