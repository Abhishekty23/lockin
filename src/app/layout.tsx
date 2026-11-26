import type { Metadata, Viewport } from "next";
import "@fontsource-variable/sora";
import "@fontsource-variable/manrope";
import "./globals.css";
import MotionProvider from "@/components/ui/MotionProvider";
import Spotlight from "@/components/ui/Spotlight";
import PwaRegister from "@/components/ui/PwaRegister";


const description =
  "Focus sessions, water, sleep, habits and goals in one place, with gentle reminders, streaks and insights. For anyone working on themselves.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lockin-liart-iota.vercel.app"),
  title: "LockIn | Track your whole day",
  description,
  applicationName: "LockIn",
  appleWebApp: { capable: true, title: "LockIn", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "LockIn", title: "LockIn | Track your whole day", description },
  twitter: { card: "summary_large_image", title: "LockIn | Track your whole day", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1130" },
    { media: "(prefers-color-scheme: light)", color: "#f1f3ff" },
  ],
};

// Sets the theme before the first paint, so there's no flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('lockin-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <MotionProvider>{children}</MotionProvider>
        <Spotlight />
        <PwaRegister />
      </body>
    </html>
  );
}
