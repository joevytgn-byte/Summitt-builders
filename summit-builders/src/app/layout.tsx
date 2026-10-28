import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "Summit Builders — Construction CRM",
  description: "Construction operations and customer relationship management for Summit Builders.",
};

const themeScript = `try{var t=localStorage.getItem('summit-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#15181d" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
