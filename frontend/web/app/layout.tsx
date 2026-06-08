import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display face — brand surfaces only (landing, auth). A distinctive grotesque
// with newspaper/record heritage; deliberately not Inter, not an editorial serif.
const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000"),
  title: {
    default: "Aftermeet — Turn meetings into execution",
    template: "%s · Aftermeet",
  },
  description:
    "A calm, AI-powered workspace that turns meeting transcripts into summaries, action items, decisions, and ready-to-send minutes.",
  applicationName: "Aftermeet",
  openGraph: {
    title: "Aftermeet",
    description: "Turn meetings into execution.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101317" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "rounded-lg border border-border bg-popover text-popover-foreground shadow-float",
            },
          }}
        />
      </body>
    </html>
  );
}
