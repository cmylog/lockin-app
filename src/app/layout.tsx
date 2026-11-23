import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lock In — Make today count",
  description: "Focus on one task at a time, with daily tasks and habits close by.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
