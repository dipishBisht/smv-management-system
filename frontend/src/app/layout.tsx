import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { ServerWakeup } from "@/components/ServerWakeup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optronix Visits",
  description: "Sales meeting and visit management",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ServerWakeup />
      </body>
    </html>
  );
}
