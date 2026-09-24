"use client";

import React from "react";

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#2B2B2E]/10 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs animate-pulse">
      <div className="h-4 w-1/3 rounded bg-gray-200 mb-3" />
      <div className="h-8 w-1/2 rounded bg-gray-200 mb-2" />
      <div className="h-3 w-2/3 rounded bg-gray-100" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[#2B2B2E]/10 bg-white overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-100 border-b border-[#2B2B2E]/10" />
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="h-4 w-1/4 rounded bg-gray-200" />
            <div className="h-4 w-1/5 rounded bg-gray-200" />
            <div className="h-4 w-1/6 rounded bg-gray-200" />
            <div className="h-6 w-16 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
