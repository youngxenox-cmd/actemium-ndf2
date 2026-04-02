import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Application notes de frais Generale de Maintenance',
  description: 'Gestion des repas et notes de frais – Generale de Maintenance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
