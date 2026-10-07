"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth";

type Role = "STUDENT" | "FACULTY";

type Project = {
  id: string;
  title: string;
  description: string;
  domain: string;
  technologies: string[];
  githubUrl?: string | null;
  liveDemoUrl?: string | null;
};

type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  bio?: string | null;
  programme?: string | null;
  studentId?: string | null;
  currentSemester?: number | null;
  academicInterests: string[];
  careerInterests: string[];
  skills: string[];
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  department?: { name: string; code: string } | null;
  projects: Project[];
  facultyProfile?: {
    designation?: string | null;
    bio?: string | null;
    qualification?: string | null;
    experienceYears?: number | null;
    researchInterests: string[];
    currentResearch?: string | null;
    skills: string[];
    specialization?: string | null;
    preferredDomains: string[];
    preferredTechnologies: string[];
    availableForProjects: boolean;
    maxStudents: number;
    currentStudents: number;
    availableSlots?: number;
    facultyWebpageUrl?: string | null;
    googleScholarUrl?: string | null;
    orcidUrl?: string | null;
    linkedinUrl?: string | null;
  } | null;
  availableSlots?: number;
};

type EditForm = Record<string, string | number | boolean | string[]>;

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<EditForm>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      void authFetch("/profiles/me")
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load your profile");
          setProfile((await response.json()) as Profile);
        })
        .catch((requestError) =>
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load your profile",
          ),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const completion = useMemo(
    () => (profile ? calculateCompletion(profile) : 0),
    [profile],
  );

  function beginEditing() {
    if (!profile) return;
    const faculty = profile.facultyProfile;
    setForm({
      name: profile.name,
      bio: profile.bio ?? "",
      programme: profile.programme ?? "",
      studentId: profile.studentId ?? "",
      academicInterests: profile.academicInterests,
      careerInterests: profile.careerInterests,
      skills: profile.skills,
      githubUrl: profile.githubUrl ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      portfolioUrl: profile.portfolioUrl ?? "",
      designation: faculty?.designation ?? "",
      qualification: faculty?.qualification ?? "",
      experienceYears: faculty?.experienceYears ?? "",
      researchInterests: faculty?.researchInterests ?? [],
      specialization: faculty?.specialization ?? "",
      currentResearch: faculty?.currentResearch ?? "",
      preferredDomains: faculty?.preferredDomains ?? [],
      preferredTechnologies: faculty?.preferredTechnologies ?? [],
      availableForProjects: faculty?.availableForProjects ?? true,
      maxStudents: faculty?.maxStudents ?? 5,
      currentStudents: faculty?.currentStudents ?? 0,
      facultyWebpageUrl: faculty?.facultyWebpageUrl ?? "",
      googleScholarUrl: faculty?.googleScholarUrl ?? "",
      orcidUrl: faculty?.orcidUrl ?? "",
      facultyLinkedinUrl: faculty?.linkedinUrl ?? "",
    });
    setError("");
    setSuccess("");
    setEditing(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (profile?.role === "FACULTY") {
      const max = Number(form.maxStudents ?? 5);
      const current = Number(form.currentStudents ?? 0);
      if (max < 0 || current < 0) {
        setError("Student counts must be non-negative.");
        return;
      }
      if (current > max) {
        setError("Currently mentoring students cannot exceed maximum students.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        linkedinUrl:
          profile?.role === "FACULTY"
            ? form.facultyLinkedinUrl
            : form.linkedinUrl,
      };
      delete payload.facultyLinkedinUrl;
      const response = await authFetch("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      setProfile((await response.json()) as Profile);
      setEditing(false);
      setSuccess("Profile saved successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your profile",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ProfileSkeleton />;
  if (!profile)
    return <Notice tone="error">{error || "Profile unavailable."}</Notice>;

  const faculty = profile.facultyProfile;
  const isFaculty = profile.role === "FACULTY" && faculty;
  const interests = isFaculty
    ? faculty.researchInterests
    : profile.academicInterests;
  const skills = isFaculty ? faculty.skills : profile.skills;

  return (
    <div className="mx-auto min-h-full max-w-295 pb-12 font-(--font-manrope)">
      <header className="flex flex-col justify-between gap-6 border-b border-[#2B2B2E]/10 pb-8 sm:flex-row sm:items-end">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#A4123F] to-[#6F0B2B] text-xl font-extrabold text-white shadow-sm">
            {initials(profile.name)}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8A33D]">
              {isFaculty ? "Faculty profile" : "Student profile"}
            </p>
            <h1 className="mt-1 font-(--font-display) text-4xl tracking-tight text-[#2B2B2E]">
              {profile.name}
            </h1>
            <p className="mt-1 text-sm text-[#2B2B2E]/60">{profile.email}</p>
            <p className="mt-2 text-sm text-[#2B2B2E]/65">
              {isFaculty
                ? [faculty.designation, profile.department?.name]
                    .filter(Boolean)
                    .join(" · ")
                : [profile.department?.name, profile.programme]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={beginEditing}
          className="rounded-xl bg-[#A4123F] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8D0F36] focus:outline-none focus:ring-2 focus:ring-[#A4123F]/25"
        >
          Edit Profile
        </button>
      </header>

      {success && <Notice tone="success">{success}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <Section title="About">
            <p className="text-sm leading-7 text-[#2B2B2E]/70">
              {(isFaculty ? faculty.bio : profile.bio) ||
                "Add a short introduction so people can understand your academic direction."}
            </p>
          </Section>
          <Section
            title={
              isFaculty ? "Professional information" : "Academic information"
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {isFaculty ? (
                <>
                  <Detail label="Designation" value={faculty.designation} />
                  <Detail label="Department" value={profile.department?.name} />
                  <Detail label="Qualification" value={faculty.qualification} />
                  <Detail
                    label="Specialization"
                    value={faculty.specialization}
                  />
                  <Detail
                    label="Experience"
                    value={
                      faculty.experienceYears
                        ? `${faculty.experienceYears} years`
                        : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <Detail label="Department" value={profile.department?.name} />
                  <Detail label="Programme" value={profile.programme} />
                  <Detail label="Student ID" value={profile.studentId} />
                  <Detail
                    label="Semester"
                    value={
                      profile.currentSemester
                        ? `Semester ${profile.currentSemester}`
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          </Section>
          <Section title={isFaculty ? "Research interests" : "Interests"}>
            <TagList
              items={interests}
              empty={
                isFaculty
                  ? "No research interests added"
                  : "No academic interests added"
              }
            />
          </Section>
          <Section title={isFaculty ? "Areas of expertise" : "Skills"}>
            <TagList
              items={skills}
              empty={isFaculty ? "No expertise added" : "No skills added"}
            />
          </Section>
          {isFaculty ? (
            <>
              <MentorAvailabilitySection
                faculty={faculty}
                onUpdateSuccess={(updated) => setProfile(updated)}
              />
              <Section title="Mentoring details">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Detail
                    label="Preferred areas"
                    value={
                      faculty.preferredDomains.join(", ") || "Not specified"
                    }
                  />
                  <Detail
                    label="Preferred technologies"
                    value={
                      faculty.preferredTechnologies.join(", ") || "Not specified"
                    }
                  />
                </div>
              </Section>
              <Links
                links={[
                  ["Faculty webpage", faculty.facultyWebpageUrl],
                  ["Google Scholar", faculty.googleScholarUrl],
                  ["ORCID", faculty.orcidUrl],
                  ["LinkedIn", faculty.linkedinUrl],
                ]}
              />
            </>
          ) : (
            <>
              <Section title="Career interests">
                <TagList
                  items={profile.careerInterests}
                  empty="No career interests added"
                />
              </Section>
              <Section title="Projects">
                <ProjectList projects={profile.projects} />
              </Section>
              <Links
                links={[
                  ["GitHub", profile.githubUrl],
                  ["LinkedIn", profile.linkedinUrl],
                  ["Portfolio", profile.portfolioUrl],
                ]}
              />
            </>
          )}
        </div>
        <aside className="h-fit rounded-2xl border border-[#2B2B2E]/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E8A33D]">
            Profile strength
          </p>
          <div className="mt-4 flex items-end justify-between">
            <span className="font-(--font-display) text-4xl text-[#2B2B2E]">
              {completion}%
            </span>
            <span className="text-xs font-semibold text-[#2B2B2E]/50">
              complete
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F5F3EF]">
            <div
              className="h-full rounded-full bg-[#A4123F] transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-[#2B2B2E]/60">
            {isFaculty
              ? "Complete your research profile to improve mentor matching."
              : "Complete your profile to improve mentor recommendations."}
          </p>
        </aside>
      </div>
      {editing && (
        <EditModal
          profile={profile}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={saveProfile}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function MentorAvailabilitySection({
  faculty,
  onUpdateSuccess,
}: {
  faculty: NonNullable<Profile["facultyProfile"]>;
  onUpdateSuccess: (updatedProfile: Profile) => void;
}) {
  const [form, setForm] = useState<{
    availableForProjects: boolean;
    maxStudents: number | "";
    currentStudents: number | "";
  }>({
    availableForProjects: faculty.availableForProjects ?? true,
    maxStudents: faculty.maxStudents ?? 5,
    currentStudents: faculty.currentStudents ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm({
      availableForProjects: faculty.availableForProjects ?? true,
      maxStudents: faculty.maxStudents ?? 5,
      currentStudents: faculty.currentStudents ?? 0,
    });
  }, [
    faculty.availableForProjects,
    faculty.maxStudents,
    faculty.currentStudents,
  ]);

  const maxVal =
    form.maxStudents === "" ? NaN : Number(form.maxStudents);
  const currentVal =
    form.currentStudents === "" ? NaN : Number(form.currentStudents);

  const availableSlots =
    !isNaN(maxVal) && !isNaN(currentVal)
      ? Math.max(0, maxVal - currentVal)
      : 0;

  const isExceedingMax =
    !isNaN(maxVal) && !isNaN(currentVal) && currentVal > maxVal;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isNaN(maxVal) || maxVal < 0) {
      setError("Maximum students must be a non-negative number.");
      return;
    }
    if (isNaN(currentVal) || currentVal < 0) {
      setError("Currently mentoring students must be a non-negative number.");
      return;
    }
    if (currentVal > maxVal) {
      setError("Currently mentoring students cannot exceed maximum students.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify({
          availableForProjects: Boolean(form.availableForProjects),
          maxStudents: maxVal,
          currentStudents: currentVal,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const updated = (await response.json()) as Profile;
      onUpdateSuccess(updated);
      setSuccess("Mentor availability saved successfully.");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update mentor availability.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#2B2B2E]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#A4123F]">
            MENTOR AVAILABILITY
          </h2>
          <p className="mt-1 text-xs text-[#2B2B2E]/60">
            Configure student capacity limits and availability for academic mentorship.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#F5F3EF] px-3 py-1 text-xs font-bold text-[#2B2B2E]/70">
          <span
            className={`h-2 w-2 rounded-full ${
              form.availableForProjects && availableSlots > 0
                ? "bg-emerald-500"
                : "bg-[#A4123F]"
            }`}
          />
          {form.availableForProjects
            ? `${availableSlots} slot${availableSlots === 1 ? "" : "s"} open`
            : "Mentorship paused"}
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Accepting New Projects */}
          <div className="flex flex-col justify-between rounded-xl border border-[#2B2B2E]/10 bg-[#FAFAF8] p-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/60">
                Accepting New Projects
              </label>
              <p className="mt-1 text-[11px] text-[#2B2B2E]/50">
                Toggle to accept or pause incoming projects
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                id="toggle-accepting-projects"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    availableForProjects: !prev.availableForProjects,
                  }))
                }
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#A4123F]/25 ${
                  form.availableForProjects ? "bg-[#A4123F]" : "bg-[#2B2B2E]/25"
                }`}
                role="switch"
                aria-checked={form.availableForProjects}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    form.availableForProjects
                      ? "translate-x-6"
                      : "translate-x-0"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-extrabold tracking-wide ${
                  form.availableForProjects
                    ? "text-[#A4123F]"
                    : "text-[#2B2B2E]/45"
                }`}
              >
                {form.availableForProjects ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Maximum Students */}
          <div className="flex flex-col justify-between rounded-xl border border-[#2B2B2E]/10 bg-[#FAFAF8] p-4">
            <div>
              <label
                htmlFor="max-students-input"
                className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/60"
              >
                Maximum Students
              </label>
              <p className="mt-1 text-[11px] text-[#2B2B2E]/50">
                Recommended range: 0–20
              </p>
            </div>
            <div className="mt-3">
              <input
                id="max-students-input"
                type="number"
                min={0}
                max={20}
                value={form.maxStudents}
                onChange={(e) => {
                  const val =
                    e.target.value === "" ? "" : Number(e.target.value);
                  setForm((prev) => ({ ...prev, maxStudents: val }));
                }}
                className="w-full rounded-xl border border-[#2B2B2E]/15 bg-white px-3.5 py-2 text-base font-bold text-[#2B2B2E] outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
                required
              />
            </div>
          </div>

          {/* Currently Mentoring Students */}
          <div className="flex flex-col justify-between rounded-xl border border-[#2B2B2E]/10 bg-[#FAFAF8] p-4">
            <div>
              <label
                htmlFor="current-students-input"
                className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/60"
              >
                Currently Mentoring Students
              </label>
              <p className="mt-1 text-[11px] text-[#2B2B2E]/50">
                Recommended range: 0–20
              </p>
            </div>
            <div className="mt-3">
              <input
                id="current-students-input"
                type="number"
                min={0}
                max={20}
                value={form.currentStudents}
                onChange={(e) => {
                  const val =
                    e.target.value === "" ? "" : Number(e.target.value);
                  setForm((prev) => ({ ...prev, currentStudents: val }));
                }}
                className={`w-full rounded-xl border bg-white px-3.5 py-2 text-base font-bold text-[#2B2B2E] outline-none transition focus:ring-2 ${
                  isExceedingMax
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[#2B2B2E]/15 focus:border-[#A4123F] focus:ring-[#A4123F]/20"
                }`}
                required
              />
            </div>
          </div>

          {/* Available Slots [READ ONLY] */}
          <div className="flex flex-col justify-between rounded-xl border border-[#2B2B2E]/10 bg-[#F5F3EF] p-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/60">
                  Available Slots
                </label>
                <span className="rounded bg-[#2B2B2E]/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#2B2B2E]/70">
                  READ ONLY
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#2B2B2E]/50">
                Calculated (Max − Currently Mentoring)
              </p>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-(--font-display) text-3xl font-extrabold text-[#2B2B2E]">
                {availableSlots}
              </span>
              <span className="text-xs font-semibold text-[#2B2B2E]/50">
                / {!isNaN(maxVal) ? maxVal : 0} slots
              </span>
            </div>
          </div>
        </div>

        {isExceedingMax && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
            Currently mentoring students cannot exceed maximum students.
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            {success}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            id="save-availability-btn"
            disabled={saving || isExceedingMax}
            className="rounded-xl bg-[#A4123F] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#8D0F36] focus:outline-none focus:ring-2 focus:ring-[#A4123F]/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EditModal({
  profile,
  form,
  setForm,
  saving,
  onSave,
  onClose,
}: {
  profile: Profile;
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  saving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const faculty = profile.role === "FACULTY";
  const update = (key: string, value: string | number | boolean | string[]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2B2B2E]/35 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E8A33D]">
              Profile settings
            </p>
            <h2 className="mt-1 font-(--font-display) text-3xl text-[#2B2B2E]">
              Edit profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl text-[#2B2B2E]/45 hover:text-[#A4123F]"
          >
            ×
          </button>
        </div>
        <form onSubmit={onSave} className="mt-7 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              value={String(form.name ?? "")}
              onChange={(value) => update("name", value)}
              required
            />
            <Field
              label="Email"
              value={profile.email}
              onChange={() => undefined}
              disabled
            />
          </div>
          <Field
            label="Short bio"
            value={String(form.bio ?? "")}
            onChange={(value) => update("bio", value)}
            textarea
            maxLength={500}
          />
          {faculty ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Designation"
                  value={String(form.designation ?? "")}
                  onChange={(value) => update("designation", value)}
                />
                <Field
                  label="Qualification"
                  value={String(form.qualification ?? "")}
                  onChange={(value) => update("qualification", value)}
                />
                <Field
                  label="Specialization"
                  value={String(form.specialization ?? "")}
                  onChange={(value) => update("specialization", value)}
                />
                <Field
                  label="Experience (years)"
                  type="number"
                  value={String(form.experienceYears ?? "")}
                  onChange={(value) =>
                    update("experienceYears", value ? Number(value) : "")
                  }
                />
              </div>
              <Field
                label="Current research"
                value={String(form.currentResearch ?? "")}
                onChange={(value) => update("currentResearch", value)}
                textarea
              />
              <ChipField
                label="Research interests"
                items={StringList(form.researchInterests)}
                onChange={(items) => update("researchInterests", items)}
              />
              <ChipField
                label="Areas of expertise"
                items={StringList(form.skills)}
                onChange={(items) => update("skills", items)}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <ChipField
                  label="Preferred domains"
                  items={StringList(form.preferredDomains)}
                  onChange={(items) => update("preferredDomains", items)}
                />
                <ChipField
                  label="Preferred technologies"
                  items={StringList(form.preferredTechnologies)}
                  onChange={(items) => update("preferredTechnologies", items)}
                />
              </div>
              <div className="rounded-xl border border-[#2B2B2E]/10 bg-[#FAFAF8] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#A4123F]">
                    Mentor Availability
                  </p>
                  <label className="flex items-center gap-2.5 text-xs font-bold text-[#2B2B2E]">
                    <input
                      type="checkbox"
                      checked={Boolean(form.availableForProjects)}
                      onChange={(event) =>
                        update("availableForProjects", event.target.checked)
                      }
                      className="h-4 w-4 accent-[#A4123F]"
                    />
                    Accepting New Projects
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold text-[#2B2B2E]/70">
                      Maximum Students (0–20)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={String(form.maxStudents ?? 5)}
                      onChange={(e) => update("maxStudents", Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[#2B2B2E]/15 bg-white px-3.5 py-2 text-sm font-bold text-[#2B2B2E] outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2B2B2E]/70">
                      Currently Mentoring (0–20)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={String(form.currentStudents ?? 0)}
                      onChange={(e) => update("currentStudents", Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[#2B2B2E]/15 bg-white px-3.5 py-2 text-sm font-bold text-[#2B2B2E] outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#2B2B2E]/70">
                        Available Slots
                      </label>
                      <span className="rounded bg-[#2B2B2E]/10 px-1 py-0.5 text-[9px] font-bold uppercase text-[#2B2B2E]/60">
                        Read Only
                      </span>
                    </div>
                    <div className="mt-1 flex h-[38px] items-center rounded-xl border border-[#2B2B2E]/10 bg-[#F5F3EF] px-3.5 text-sm font-extrabold text-[#2B2B2E]">
                      {Math.max(
                        0,
                        Number(form.maxStudents ?? 5) - Number(form.currentStudents ?? 0)
                      )}
                    </div>
                  </div>
                </div>
                {Number(form.currentStudents ?? 0) > Number(form.maxStudents ?? 5) && (
                  <p className="text-xs font-semibold text-red-600">
                    Currently mentoring students cannot exceed maximum students.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Programme"
                  value={String(form.programme ?? "")}
                  onChange={(value) => update("programme", value)}
                />
                <Field
                  label="Student ID"
                  value={String(form.studentId ?? "")}
                  onChange={(value) => update("studentId", value)}
                />
              </div>
              <ChipField
                label="Skills"
                items={StringList(form.skills)}
                onChange={(items) => update("skills", items)}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <ChipField
                  label="Academic interests"
                  items={StringList(form.academicInterests)}
                  onChange={(items) => update("academicInterests", items)}
                />
                <ChipField
                  label="Career interests"
                  items={StringList(form.careerInterests)}
                  onChange={(items) => update("careerInterests", items)}
                />
              </div>
            </>
          )}
          <div className="grid gap-5 border-t border-[#2B2B2E]/10 pt-5 sm:grid-cols-2">
            {(faculty
              ? [
                  ["Faculty webpage", "facultyWebpageUrl"],
                  ["Google Scholar", "googleScholarUrl"],
                  ["ORCID", "orcidUrl"],
                  ["LinkedIn", "facultyLinkedinUrl"],
                ]
              : [
                  ["GitHub", "githubUrl"],
                  ["LinkedIn", "linkedinUrl"],
                  ["Portfolio", "portfolioUrl"],
                ]
            ).map(([label, key]) => (
              <Field
                key={key}
                label={label}
                value={String(form[key] ?? "")}
                onChange={(value) => update(key, value)}
                type="url"
              />
            ))}
          </div>
          <div className="flex justify-end gap-3 border-t border-[#2B2B2E]/10 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#2B2B2E]/15 px-4 py-2.5 text-sm font-semibold text-[#2B2B2E]/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#A4123F] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  type = "text",
  required = false,
  disabled = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  const className =
    "mt-2 w-full rounded-xl border border-[#2B2B2E]/15 px-4 py-3 text-sm text-[#2B2B2E] outline-none transition placeholder:text-[#2B2B2E]/35 focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20 disabled:bg-[#F5F3EF]";
  return (
    <div>
      <label className="text-sm font-bold text-[#2B2B2E]">
        {label}
        {required && <span className="ml-1 text-[#A4123F]">*</span>}
      </label>
      {textarea ? (
        <textarea
          required={required}
          maxLength={maxLength}
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-none`}
        />
      ) : (
        <input
          required={required}
          disabled={disabled}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </div>
  );
}
function ChipField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setInput("");
  };
  return (
    <div>
      <label className="text-sm font-bold text-[#2B2B2E]">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-2 rounded-full bg-[#A4123F]/8 px-3 py-1.5 text-xs font-semibold text-[#A4123F]"
          >
            {item}
            <button
              type="button"
              onClick={() =>
                onChange(items.filter((current) => current !== item))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder="Type and press Enter"
        className="mt-3 w-full rounded-xl border border-[#2B2B2E]/15 px-4 py-3 text-sm outline-none focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
      />
    </div>
  );
}
function StringList(value: EditForm[string]) {
  return Array.isArray(value) ? value : [];
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#2B2B2E]/10 bg-white p-6 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#A4123F]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#2B2B2E]/45">
        {label}
      </p>
      <p className="mt-1 text-sm text-[#2B2B2E]/75">
        {value || "Not provided"}
      </p>
    </div>
  );
}
function TagList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-[#F5F3EF] px-3 py-1.5 text-xs font-semibold text-[#2B2B2E]/75"
        >
          {item}
        </span>
      ))}
    </div>
  ) : (
    <p className="text-sm text-[#2B2B2E]/50">{empty}</p>
  );
}
function ProjectList({ projects }: { projects: Project[] }) {
  return projects.length ? (
    <div className="grid gap-3 sm:grid-cols-2">
      {projects.map((project) => (
        <Link
          key={project.id}
          href="/dashboard/projects"
          className="rounded-xl border border-[#2B2B2E]/10 p-4 transition hover:border-[#A4123F]/30 hover:bg-[#F5F3EF]/50"
        >
          <p className="font-semibold text-[#2B2B2E]">{project.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#2B2B2E]/60">
            {project.description}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#A4123F]">
            {project.domain}
          </p>
        </Link>
      ))}
    </div>
  ) : (
    <p className="text-sm text-[#2B2B2E]/50">
      No projects yet. Add your academic projects to showcase your work.
    </p>
  );
}
function Links({ links }: { links: [string, string | null | undefined][] }) {
  const available = links.filter(([, url]) => url);
  return (
    <Section title="Links">
      {available.length ? (
        <div className="flex flex-wrap gap-3">
          {available.map(([label, url]) => (
            <a
              key={label}
              href={url!}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[#2B2B2E]/15 px-4 py-2.5 text-sm font-semibold text-[#2B2B2E]/70 hover:border-[#A4123F]/40 hover:text-[#A4123F]"
            >
              {label} ↗
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#2B2B2E]/50">
          Add professional links to complete your profile.
        </p>
      )}
    </Section>
  );
}
function calculateCompletion(profile: Profile) {
  const faculty = profile.facultyProfile;
  const fields = faculty
    ? [
        profile.name,
        profile.email,
        profile.department?.name,
        faculty.designation,
        faculty.qualification,
        faculty.bio,
        faculty.specialization,
        faculty.researchInterests.length,
        faculty.skills.length,
        faculty.facultyWebpageUrl,
      ]
    : [
        profile.name,
        profile.email,
        profile.department?.name,
        profile.programme,
        profile.currentSemester,
        profile.bio,
        profile.skills.length,
        profile.academicInterests.length,
        profile.projects.length,
        profile.githubUrl,
      ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}
function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={`mt-5 rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
    >
      {children}
    </p>
  );
}
function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-24 rounded-2xl bg-white" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-white lg:col-span-2" />
        <div className="h-48 rounded-2xl bg-white" />
      </div>
    </div>
  );
}
async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return body.message
      ? Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
      : "Could not save your profile";
  } catch {
    return "Could not save your profile";
  }
}
