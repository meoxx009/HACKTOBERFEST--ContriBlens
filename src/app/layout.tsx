import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContribLens — Security findings → beginner pull requests",
  description:
    "Paste any public GitHub repo. Get verified findings, a plain-English explanation, and a beginner-ready PR plan with tests and skills.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      style={{ backgroundColor: "#000000", color: "#F5F3ED", colorScheme: "dark" }}
    >
      <body
        style={{ backgroundColor: "#000000", color: "#F5F3ED" }}
        className="page-atmosphere text-textPrimary antialiased selection:bg-electricTangerine selection:text-black"
      >
        {children}
      </body>
    </html>
  );
}
