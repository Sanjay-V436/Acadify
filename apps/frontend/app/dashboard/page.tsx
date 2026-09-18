"use client";

import { useEffect, useState } from "react";
import { authFetch, getCurrentUser, DecodedUser } from "@/lib/auth";

export default function DashboardOverview() {
  const [user] = useState<DecodedUser | null>(() => getCurrentUser());
  const [projectCount, setProjectCount] = useState("0");

  useEffect(() => {
    if (user?.role !== "STUDENT") return;

    const timer = setTimeout(() => {
      void authFetch("/projects")
        .then(async (response) => {
          if (!response.ok) return;
          const projects = (await response.json()) as unknown[];
          setProjectCount(String(projects.length));
        })
        .catch(() => {
          // Keep the overview available when the projects service is unavailable.
        });
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#2B2B2E]">
        Welcome, {user.email.split("@")[0]}
      </h1>
      <p className="mt-1 text-sm text-[#2B2B2E]/60">
        {user.role === "STUDENT" && "Here's an overview of your academic activity."}
        {user.role === "FACULTY" && "Here's an overview of your mentoring and resources."}
        {user.role === "ADMIN" && "Here's an overview of the platform."}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {user.role === "STUDENT" && (
          <>
            <StatCard label="Active Projects" value={projectCount} />
            <StatCard label="Resources Available" value="—" />
            <StatCard label="Mentor Matches Found" value="0" />
          </>
        )}
        {user.role === "FACULTY" && (
          <>
            <StatCard label="Current Students" value="—" />
            <StatCard label="Projects Mentoring" value="0" />
            <StatCard label="Resources Uploaded" value="0" />
          </>
        )}
        {user.role === "ADMIN" && (
          <>
            <StatCard label="Total Users" value="—" />
            <StatCard label="Total Faculty" value="—" />
            <StatCard label="Total Students" value="—" />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2B2B2E]/10 bg-white p-5">
      <p className="text-sm text-[#2B2B2E]/50">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#A4123F]">{value}</p>
    </div>
  );
}