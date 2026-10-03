import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "CaptoDesk | 24/7 Digital Front Desk & Lead Recovery",
  description: "Automated missed-call text-back and Google review system for local service businesses and contractors.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-sans)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
