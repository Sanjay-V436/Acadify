"use client";

import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = <FolderOpen className="h-10 w-10 text-[#2B2B2E]/30" />,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2B2B2E]/20 bg-white/50 p-8 text-center my-4">
      <div className="mb-3 rounded-full bg-[#2B2B2E]/5 p-3">{icon}</div>
      <h3 className="text-base font-bold text-[#2B2B2E]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#2B2B2E]/60">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-lg bg-[#A4123F] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#830e32] transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
