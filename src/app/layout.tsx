import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ACLC WMS — Motorcycle Parts & Oils Warehouse System',
  description: 'ACLC enterprise warehouse, sales, quotation, dispatch, and credit management system for motorcycle parts and oil distribution.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
