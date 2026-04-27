import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Out of the GC",
  description: "Plan your next group trip.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
