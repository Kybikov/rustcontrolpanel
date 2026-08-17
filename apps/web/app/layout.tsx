import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Rust Control · Operations console",
  description: "Live operational control for Rust server fleets.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} dark antialiased`}>
      <body>
        {children}
      </body>
    </html>
  )
}
