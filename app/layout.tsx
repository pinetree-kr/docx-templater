import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Build Sign Form',
  description: '시그니처 문서 생성 도구',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

