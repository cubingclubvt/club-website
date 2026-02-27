import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});


export const metadata: Metadata = {
  title: "Cubing Club at VT",
  description: "The Rubik's Cube Solving Club at Virginia Tech",
  icons: {
      icon: "/favicon.ico",
    },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} antialiased 
        flex flex-col min-h-screen`}
      >

        <header className={""}>
          <Navigation />
        </header>

        <main className="flex-grow bg-slate-700">
           {children}
        </main>

        <footer className="">
          <Footer />
        </footer>

      </body>
    </html>
  );
}
