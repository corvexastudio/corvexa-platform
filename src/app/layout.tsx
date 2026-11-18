import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/providers/query-provider"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL('https://captodesk.com'),
  title: "CaptoDesk | Free Online Booking Link & Live Arrival Tracker for Local Crews",
  description: "Turn Google Maps and Instagram visitors into booked jobs in 2 minutes. Get a free booking link, Uber-style live truck arrival texts, driveway Apple Pay, and auto Google reviews. First 3 jobs free.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/brand/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/brand/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "CaptoDesk | Free Online Booking Link & Live Arrival Tracker for Local Crews",
    description: "Turn Google Maps and Instagram visitors into booked jobs in 2 minutes. Get a free booking link, Uber-style live truck arrival texts, driveway Apple Pay, and auto Google reviews. First 3 jobs free.",
    url: "https://captodesk.com",
    siteName: "CaptoDesk",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "CaptoDesk - Free Online Booking Link & Live Arrival Tracker for Local Crews",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CaptoDesk | Free Online Booking Link & Live Arrival Tracker for Local Crews",
    description: "Turn Google Maps and Instagram visitors into booked jobs in 2 minutes. Get a free booking link, Uber-style live truck arrival texts, driveway Apple Pay, and auto Google reviews. First 3 jobs free.",
    images: ["/opengraph-image.png"],
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-sans)] bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster richColors position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
