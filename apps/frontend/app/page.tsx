import Link from "next/link";
import Image from "next/image";

/**
 * Acadify landing page — a structural replica of the myAmrita splash screen.
 *
 * Layout notes:
 *  - The centered content column is vertically + horizontally centered in
 *    a 100vh box: wordmark → tagline → divider rule → LOGIN control.
 *  - The wordmark is a single-color "ACADIFY" (all caps), unlike the
 *    original's two-tone "my" + "AMRITA" split.
 *  - A single large campus image is centered behind the whole page as a
 *    quiet backdrop, rendered grayscale + low-opacity so it reads as a
 *    faint watermark rather than a loud color photo.
 */

const campusPhoto = "/campus/building-2.png";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#F5F3EF]">
      {/* Watermark background — one large centered image, spans the whole page */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[95vh] w-[95vw]">
          <Image
            src={campusPhoto}
            alt="Campus courtyard illustration"
            fill
            className="object-contain opacity-20 grayscale contrast-125"
            sizes="100vw"
            priority
            loading="eager"
          />
        </div>
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
        <div className="flex flex-col items-center text-center">
          {/* Wordmark — single color, all caps */}
          <div className="flex items-end">
            <span className="text-5xl font-bold tracking-wide text-[#A4123F] sm:text-6xl">
              ACADIFY
            </span>
          </div>

          {/* Tagline */}
          <p className="mt-5 text-xl font-medium tracking-wide text-[#2B2B2E] sm:text-2xl">
            MENTORSHIP · RESOURCES · PROJECTS
          </p>

          {/* Divider — same role as the original's Line1.gif rule */}
          <div className="mt-5 h-px w-72 bg-[#2B2B2E]/30 sm:w-96" />

          {/* Login control */}
          <Link href="/login" className="group mt-8 flex items-center gap-5">
            <span className="text-4xl font-medium tracking-wide text-[#A4123F] transition group-hover:text-[#8a0f33]">
              LOGIN
            </span>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8A33D] text-white shadow-md transition group-hover:bg-[#d1922f]">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}