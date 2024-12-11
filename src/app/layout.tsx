import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js" async></script>
      </head>
      <body className="bg-[#0a0a0a] text-white">
        {children}
      </body>
    </html>
  )
} 