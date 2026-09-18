"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DecodedUser, logout } from "@/lib/auth";
import { useRouter } from "next/navigation";

const navByRole: Record<string, { label: string; href: string }[]> = {
  STUDENT: [
    { label: "Overview", href: "/dashboard" },
    { label: "Find a Mentor", href: "/dashboard/mentor-recommendation" },
    { label: "My Projects", href: "/dashboard/projects" },
    { label: "Resources", href: "/dashboard/resources" },
    { label: "My Profile", href: "/dashboard/profile" },
  ],
  FACULTY: [
    { label: "Overview", href: "/dashboard" },
    { label: "My Profile", href: "/dashboard/profile" },
    { label: "My Projects", href: "/dashboard/projects" },
    { label: "Resources", href: "/dashboard/resources" },
  ],
  ADMIN: [
    { label: "Overview", href: "/dashboard" },
    { label: "Users", href: "/dashboard/admin/users" },
    { label: "Departments", href: "/dashboard/admin/departments" },
    { label: "Subjects", href: "/dashboard/admin/subjects" },
    { label: "Analytics", href: "/dashboard/admin/analytics" },
  ],
};

export default function Sidebar({ user }: { user: DecodedUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navByRole[user.role] || [];

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 flex h-16 flex-row border-t border-[#2B2B2E]/10 bg-white/95 shadow-[0_-4px_18px_rgba(43,43,46,0.06)] backdrop-blur md:inset-y-0 md:right-auto md:h-screen md:w-64 md:flex-col md:justify-between md:border-r md:border-t-0 md:bg-white md:shadow-none">
      <div className="flex min-w-0 flex-1 md:block">
        <div className="hidden border-b border-[#2B2B2E]/10 px-6 py-5 md:block">
          <span className="font-(--font-manrope) text-[25px] font-extrabold tracking-[-0.75px] text-[#A4123F]">ACADIFY</span>
        </div>

        <nav className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto p-2 md:flex-col md:gap-1 md:overflow-visible md:p-3">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center justify-center rounded-md px-3 py-2 text-xs font-medium transition md:justify-start md:px-4 md:py-2.5 md:text-sm ${
                  active
                    ? "bg-[#A4123F]/10 text-[#A4123F]"
                    : "text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center border-l border-[#2B2B2E]/10 p-2 md:block md:border-l-0 md:border-t md:p-4">
        <p className="mb-1 hidden truncate text-xs text-[#2B2B2E]/50 md:block">{user.email}</p>
        <p className="mb-3 hidden text-xs font-medium uppercase tracking-wide text-[#E8A33D] md:block">
          {user.role}
        </p>
        <button
          onClick={handleLogout}
          className="rounded-md border border-[#A4123F]/30 px-3 py-2 text-xs text-[#A4123F] hover:bg-[#A4123F]/5 md:w-full md:text-sm"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}