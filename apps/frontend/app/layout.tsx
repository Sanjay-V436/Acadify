import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acadify",
  description: "Academic intelligence platform — Chennai Campus",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}