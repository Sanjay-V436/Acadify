"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, getCurrentUser, DecodedUser } from "@/lib/auth";
import {
  getStudents,
  getFaculty,
  getClasses,
  getSubjects,
  getDepartments,
} from "@/lib/admin-api";
import { Users, GraduationCap, School, BookOpen, Building2, ArrowRight, UserPlus, FileSpreadsheet, PlusCircle, BookmarkPlus, GitFork } from "lucide-react";

export default function DashboardOverview() {
  const [user] = useState<DecodedUser | null>(() => getCurrentUser());
  const [projectCount, setProjectCount] = useState("0");

  // Admin Dashboard stats
  const [adminStats, setAdminStats] = useState({
    departmentsCount: "...",
    classesCount: "...",
    subjectsCount: "...",
    facultyCount: "...",
    studentsCount: "...",
    loading: true,
  });

  useEffect(() => {
    if (!user) return;

    if (user.role === "STUDENT") {
      void authFetch("/projects")
        .then(async (response) => {
          if (!response.ok) return;
          const projects = (await response.json()) as unknown[];
          setProjectCount(String(projects.length));
        })
        .catch(() => {});
    }

    if (user.role === "ADMIN") {
      void (async () => {
        try {
          const [deptRes, classRes, subjRes, facRes, stuRes] = await Promise.allSettled([
            getDepartments("", 1, 1),
            getClasses({ page: 1, limit: 1 }),
            getSubjects({ page: 1, limit: 1 }),
            getFaculty({ page: 1, limit: 1 }),
            getStudents({ page: 1, limit: 1 }),
          ]);

          setAdminStats({
            departmentsCount: deptRes.status === "fulfilled" ? String(deptRes.value.meta.total) : "—",
            classesCount: classRes.status === "fulfilled" ? String(classRes.value.meta.total) : "—",
            subjectsCount: subjRes.status === "fulfilled" ? String(subjRes.value.meta.total) : "—",
            facultyCount: facRes.status === "fulfilled" ? String(facRes.value.meta.total) : "—",
            studentsCount: stuRes.status === "fulfilled" ? String(stuRes.value.meta.total) : "—",
            loading: false,
          });
        } catch {
          setAdminStats((prev) => ({ ...prev, loading: false }));
        }
      })();
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#2B2B2E] tracking-tight">
          Welcome back, {user.email.split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-[#2B2B2E]/70">
          {user.role === "STUDENT" && "Here's an overview of your academic activity."}
          {user.role === "FACULTY" && "Here's an overview of your mentoring and resources."}
          {user.role === "ADMIN" && "Acadify Administration Workspace & Operational Overview"}
        </p>
      </div>

      {user.role === "STUDENT" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Active Projects" value={projectCount} icon={<BookOpen className="h-5 w-5 text-[#A4123F]" />} />
          <StatCard label="Resources Available" value="—" icon={<School className="h-5 w-5 text-[#A4123F]" />} />
          <StatCard label="Mentor Matches Found" value="0" icon={<Users className="h-5 w-5 text-[#A4123F]" />} />
        </div>
      )}

      {user.role === "FACULTY" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Current Students" value="—" icon={<GraduationCap className="h-5 w-5 text-[#A4123F]" />} />
          <StatCard label="Projects Mentoring" value="0" icon={<BookOpen className="h-5 w-5 text-[#A4123F]" />} />
          <StatCard label="Resources Uploaded" value="0" icon={<School className="h-5 w-5 text-[#A4123F]" />} />
        </div>
      )}

      {user.role === "ADMIN" && (
        <>
          {/* Admin Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Departments"
              value={adminStats.departmentsCount}
              subtext="Academic divisions"
              icon={<Building2 className="h-5 w-5 text-[#A4123F]" />}
            />
            <StatCard
              label="Classes"
              value={adminStats.classesCount}
              subtext="Active cohorts"
              icon={<School className="h-5 w-5 text-[#A4123F]" />}
            />
            <StatCard
              label="Subjects"
              value={adminStats.subjectsCount}
              subtext="Curriculum subjects"
              icon={<BookOpen className="h-5 w-5 text-[#A4123F]" />}
            />
            <StatCard
              label="Faculty"
              value={adminStats.facultyCount}
              subtext="Teaching staff"
              icon={<Users className="h-5 w-5 text-[#A4123F]" />}
            />
            <StatCard
              label="Students"
              value={adminStats.studentsCount}
              subtext="Enrolled students"
              icon={<GraduationCap className="h-5 w-5 text-[#A4123F]" />}
            />
          </div>

          {/* Quick Actions Panel */}
          <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-[#2B2B2E]">Academic Workflow Shortcuts</h2>
            <p className="mt-1 text-xs text-[#2B2B2E]/60 mb-5">
              Access the six core admin modules in sequential operational order.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuickActionCard
                title="1. Departments"
                description="Manage departments & codes"
                href="/dashboard/admin/departments"
                icon={<Building2 className="h-5 w-5 text-[#A4123F]" />}
              />
              <QuickActionCard
                title="2. Classes"
                description="Configure batch cohorts & sections"
                href="/dashboard/admin/classes"
                icon={<PlusCircle className="h-5 w-5 text-[#A4123F]" />}
              />
              <QuickActionCard
                title="3. Subjects"
                description="Catalog subjects by department & semester"
                href="/dashboard/admin/subjects"
                icon={<BookmarkPlus className="h-5 w-5 text-[#A4123F]" />}
              />
              <QuickActionCard
                title="4. Faculty"
                description="Create faculty profiles & credentials"
                href="/dashboard/admin/faculty"
                icon={<UserPlus className="h-5 w-5 text-[#A4123F]" />}
              />
              <QuickActionCard
                title="5. Students"
                description="Bulk CSV import & single creation"
                href="/dashboard/admin/students"
                icon={<FileSpreadsheet className="h-5 w-5 text-[#A4123F]" />}
              />
              <QuickActionCard
                title="6. Teaching Assignments"
                description="Map faculty to class subjects"
                href="/dashboard/admin/teaching-assignments"
                icon={<GitFork className="h-5 w-5 text-[#A4123F]" />}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs transition hover:border-[#A4123F]/30 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2B2B2E]/60">{label}</p>
        {icon && <div className="rounded-lg bg-[#A4123F]/10 p-2">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-extrabold text-[#2B2B2E]">{value}</p>
      {subtext && <p className="mt-1 text-xs text-[#2B2B2E]/50">{subtext}</p>}
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-lg border border-[#2B2B2E]/10 bg-[#F5F3EF]/40 p-4 transition hover:border-[#A4123F]/40 hover:bg-white hover:shadow-sm"
    >
      <div className="rounded-lg bg-white p-2.5 shadow-xs border border-[#2B2B2E]/10 group-hover:bg-[#A4123F]/10 transition">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-[#2B2B2E] group-hover:text-[#A4123F] transition flex items-center justify-between">
          {title}
          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#A4123F]" />
        </h3>
        <p className="mt-0.5 text-xs text-[#2B2B2E]/60">{description}</p>
      </div>
    </Link>
  );
}