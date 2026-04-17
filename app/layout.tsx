import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Application notes de frais Generale de Maintenance',
  description: 'Gestion des repas et notes de frais – Generale de Maintenance',
}

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
