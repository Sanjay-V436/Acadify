"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth";

interface Mentor {
  faculty_id: string;
  name: string;
  designation?: string;
  department?: string;
  confidence_score: number;
  semantic_similarity?: number;
  match_level?: "High" | "Moderate" | "Low";
  why_matched?: string[];
  why_not_higher?: string[];
  technical_overlap?: string[];
  domain_overlap?: string[];
  missing_expertise?: string[];
  strengths?: string[];
  limitations?: string[];
  summary?: string;
  recommendation_reason?: string;
  reasoning?: string;
  available_slots: number | null;
  availableSlots?: number;
  max_students?: number;
  maxStudents?: number;
}

export default function MentorRecommendationPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [aiAnalysisAvailable, setAiAnalysisAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authFetch("/mentor-recommendation", {
        method: "POST",
        body: JSON.stringify({
          project_title: title,
          description: description || "",
          top_k: 5,
        }),
      });
      if (!res.ok) throw new Error("Could not fetch recommendations");
      const data = await res.json();
      setMentors(data.recommendations || data.mentors || []);
      setAiAnalysisAvailable(data.ai_analysis_available === true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not fetch recommendations");
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (facultyId: string) => {
    setExpandedDetails((current) => {
      const next = new Set(current);
      if (next.has(facultyId)) {
        next.delete(facultyId);
      } else {
        next.add(facultyId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-full w-full pb-12 font-(--font-manrope)">
      <style>{`
        @keyframes mentor-reveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mentor-shimmer {
          0%, 100% { opacity: 0.48; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="mb-8 max-w-[1180px]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A33D]">Acadify · Mentor matching</p>
        <h1 className="mt-2 font-(--font-display) text-4xl tracking-tight text-[#2B2B2E]">
          Find a mentor who gets the idea.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#2B2B2E]/60">
        Describe your project idea to get matched with faculty by research fit.
        </p>
      </div>

      <div className="max-w-[1180px] rounded-2xl border border-[#2B2B2E]/10 bg-white/80 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title (e.g. AI Based Smart Irrigation using IoT)"
          className="w-full rounded-xl border border-[#2B2B2E]/15 bg-white px-4 py-3 text-[#2B2B2E] placeholder:text-[#2B2B2E]/40 outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={3}
          className="w-full resize-none rounded-xl border border-[#2B2B2E]/15 bg-white px-4 py-3 text-[#2B2B2E] placeholder:text-[#2B2B2E]/40 outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
        />
          <div className="flex items-center justify-between gap-4 px-1 pt-1">
            <p className="text-xs text-[#2B2B2E]/45">Your project stays private to the matching flow.</p>
            <button
              onClick={handleSearch}
              disabled={loading || !title}
              className="rounded-xl bg-[#A4123F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8a0f33] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Searching..." : "Find Mentors"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {loading ? (
        <div className="mt-10 max-w-[1180px] space-y-4" aria-label="Loading mentor recommendations">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-[#2B2B2E]/8 border-l-4 border-l-[#2B2B2E]/15 bg-white p-6 shadow-sm"
              style={{ animation: "mentor-shimmer 1.4s ease-in-out infinite", animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#2B2B2E]/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/5 rounded-full bg-[#2B2B2E]/10" />
                  <div className="h-3 w-3/5 rounded-full bg-[#2B2B2E]/8" />
                </div>
                <div className="h-9 w-9 rounded-full bg-[#E8A33D]/20" />
              </div>
              <div className="mt-6 h-3 w-4/5 rounded-full bg-[#2B2B2E]/8" />
              <div className="mt-3 h-3 w-3/5 rounded-full bg-[#2B2B2E]/8" />
              <div className="mt-6 h-10 rounded-xl bg-[#2B2B2E]/6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 max-w-[1180px] space-y-4">
        {mentors.map((m, index) => {
          const isExpanded = expandedDetails.has(m.faculty_id);
          const matchLevel = m.match_level ?? "Moderate";
          const matchTone = {
            High: { border: "border-l-[#E8A33D]", icon: "✓", badge: "bg-[#E8A33D] text-[#2B2B2E]" },
            Moderate: { border: "border-l-[#C58A45]", icon: "·", badge: "bg-[#C58A45] text-white" },
            Low: { border: "border-l-[#9A9895]", icon: "·", badge: "bg-[#9A9895] text-white" },
          }[matchLevel];
          const similarity = Math.round((m.semantic_similarity ?? m.confidence_score) * 100);
          const availableSlots = m.available_slots ?? m.availableSlots ?? 0;
          const maxStudents = m.max_students ?? m.maxStudents;

          return (
          <div
            key={m.faculty_id}
            className={`group relative overflow-hidden rounded-2xl border border-[#2B2B2E]/10 border-l-4 bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg sm:p-6 ${matchTone.border}`}
            style={{ animation: "mentor-reveal 500ms ease-out both", animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/80 bg-linear-to-br from-[#A4123F] to-[#6F0B2B] text-sm font-bold text-white ring-1 ring-[#A4123F]/20">
                {m.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-(--font-display) text-xl tracking-tight text-[#2B2B2E]">{m.name}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${matchTone.badge}`}>
                    <span className="text-sm leading-none">{matchTone.icon}</span>
                    {matchLevel}
                  </span>
                </div>
                {(m.designation || m.department) && (
                  <p className="mt-1 text-sm leading-5 text-[#2B2B2E]/60">
                    {[m.designation, m.department].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#E8A33D ${similarity * 3.6}deg, #F0EDEA 0deg)` }}
                title={`Semantic similarity: ${similarity}%`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#A4123F]">{similarity}%</span>
              </div>
            </div>

            {aiAnalysisAvailable ? (
              <div className="mt-6 space-y-5 text-sm text-[#2B2B2E]/75">
                <RecommendationList title="Why this mentor matches" items={m.why_matched} primary />
                <RecommendationChips title="Technical overlap" items={m.technical_overlap} tone="maroon" />
                <RecommendationChips title="Domain overlap" items={m.domain_overlap} tone="gold" />
                <button
                  type="button"
                  onClick={() => toggleDetails(m.faculty_id)}
                  aria-expanded={isExpanded}
                  className="flex items-center gap-2 text-xs font-semibold text-[#2B2B2E]/55 transition hover:text-[#A4123F]"
                >
                  <span className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>›</span>
                  {isExpanded ? "Hide details" : "Show details"}
                </button>
                <div className={`grid transition-all duration-300 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="min-h-0 overflow-hidden space-y-5">
                    <RecommendationList title="Why the match is not higher" items={m.why_not_higher} />
                    <RecommendationList title="Missing expertise" items={m.missing_expertise} />
                  </div>
                </div>
                {m.summary && (
                  <div className="rounded-xl border border-[#E8A33D]/20 bg-[#F5F3EF]/70 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A4123F]">AI Summary</p>
                    <p className="mt-1 leading-6">{m.summary}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-6 rounded-xl bg-[#F5F3EF] px-4 py-3 text-sm leading-6 text-[#2B2B2E]/75">
                {m.reasoning || "Semantic match found from the faculty research profile."}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-[#2B2B2E]/8 pt-4 text-xs">
              <span className="font-medium text-[#2B2B2E]/55">
                Availability · {availableSlots}{maxStudents !== undefined ? ` of ${maxStudents}` : " slots"}
              </span>
              <span className={`font-semibold ${availableSlots > 0 ? "text-emerald-700" : "text-[#A4123F]"}`}>
                {availableSlots > 0 ? "Accepting students" : "Slots full"}
              </span>
            </div>
          </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

function RecommendationList({
  title,
  items,
  primary = false,
}: {
  title: string;
  items?: string[];
  primary?: boolean;
}) {
  if (!items?.length) return null;

  return (
    <div>
      <p className={primary ? "font-medium text-[#2B2B2E]" : "text-xs font-semibold uppercase tracking-[0.08em] text-[#2B2B2E]/55"}>{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationChips({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone: "maroon" | "gold";
}) {
  if (!items?.length) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#2B2B2E]/55">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${title}-${index}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${tone === "maroon" ? "bg-[#A4123F]/8 text-[#A4123F]" : "bg-[#E8A33D]/18 text-[#8A5B0B]"}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}