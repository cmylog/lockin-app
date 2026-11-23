import type { Metadata } from "next";
import "./globals.css";
import "./minimal.css";

export const metadata: Metadata = {
  title: "Lock In — Make today count",
  description: "Plan your day, build habits, and focus on what matters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
