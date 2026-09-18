"use client";

import { FormEvent, useState } from "react";

interface Mentor {
  name?: string;
  department?: string;
  confidence_score?: number;
  reasoning?: string;
  availableSlots?: number;
  maxStudents?: number;
}

interface RecommendationResponse {
  mentors?: Mentor[];
}

export default function MentorRecommendationPage() {
  const [projectTitle, setProjectTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMentors([]);
    setIsPending(true);

    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch("http://localhost:3000/mentor-recommendation", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_title: projectTitle,
          description,
        }),
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}.`;

        try {
          const errorData = (await response.json()) as { message?: string | string[] };
          if (errorData.message) {
            message = Array.isArray(errorData.message)
              ? errorData.message.join(", ")
              : errorData.message;
          }
        } catch {
          // Keep the status-based message when the response is not JSON.
        }

        throw new Error(message);
      }

      const data = (await response.json()) as RecommendationResponse;
      setMentors(data.mentors ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to find mentors. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F3EF] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8A33D]">
            Acadify
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#A4123F] sm:text-4xl">
            Find Your Mentor
          </h1>
          <p className="mt-3 max-w-2xl text-[#2B2B2E]/70">
            Tell us about your project and we will recommend faculty members
            whose expertise and availability fit your work.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#2B2B2E]/10 sm:p-8"
        >
          <div>
            <label
              htmlFor="project-title"
              className="block text-sm font-semibold text-[#2B2B2E]"
            >
              Project Title
            </label>
            <input
              id="project-title"
              name="project_title"
              type="text"
              required
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              placeholder="e.g. Sustainable Campus Navigation"
              className="mt-2 block w-full rounded-md border border-[#2B2B2E]/20 px-4 py-3 text-[#2B2B2E] outline-none transition placeholder:text-[#2B2B2E]/40 focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="project-description"
              className="block text-sm font-semibold text-[#2B2B2E]"
            >
              Project Description <span className="font-normal text-[#2B2B2E]/50">(optional)</span>
            </label>
            <textarea
              id="project-description"
              name="description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share the goals, methods, or technologies involved."
              className="mt-2 block w-full resize-y rounded-md border border-[#2B2B2E]/20 px-4 py-3 text-[#2B2B2E] outline-none transition placeholder:text-[#2B2B2E]/40 focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 w-full rounded-md bg-[#A4123F] px-5 py-3 font-semibold text-white transition hover:bg-[#8D0F36] focus:outline-none focus:ring-2 focus:ring-[#A4123F] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Searching Mentors..." : "Find Mentors"}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {mentors.length > 0 && (
          <section className="mt-10" aria-labelledby="recommendations-heading">
            <h2
              id="recommendations-heading"
              className="text-2xl font-bold text-[#A4123F]"
            >
              Recommended Mentors
            </h2>
            <div className="mt-4 space-y-4">
              {mentors.map((mentor, index) => {
                const availableSlots = mentor.availableSlots ?? 0;
                const maxStudents = mentor.maxStudents ?? 0;
                const confidence = ((mentor.confidence_score ?? 0) * 100).toFixed(1);

                return (
                  <article
                    key={`${mentor.name ?? "mentor"}-${index}`}
                    className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#2B2B2E]/10"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[#2B2B2E]">
                          {mentor.name ?? "Faculty Mentor"}
                        </h3>
                        <p className="mt-1 text-sm text-[#2B2B2E]/65">
                          {mentor.department ?? "Department unavailable"}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-[#E8A33D]/20 px-3 py-1 text-sm font-semibold text-[#8A5B0B]">
                        {confidence}% match
                      </span>
                    </div>

                    <div className="mt-5 rounded-md bg-gray-100 px-4 py-3 text-sm leading-6 text-[#2B2B2E]/75">
                      {mentor.reasoning ?? "Recommended based on your project details."}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#2B2B2E]/75">
                        Available capacity: {availableSlots} out of {maxStudents}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 font-semibold ${
                          availableSlots > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {availableSlots > 0 ? "Accepting Students" : "Slots Full"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}