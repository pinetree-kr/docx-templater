import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>시그니처 문서 생성</h1>
      <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link 
          href="/info" 
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#0070f3',
            color: 'white',
            borderRadius: '8px',
            display: 'inline-block'
          }}
        >
          1. 정보 입력
        </Link>
        <Link 
          href="/signature" 
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#0070f3',
            color: 'white',
            borderRadius: '8px',
            display: 'inline-block'
          }}
        >
          2. 시그니처 그리기
        </Link>
        <Link 
          href="/document" 
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#0070f3',
            color: 'white',
            borderRadius: '8px',
            display: 'inline-block'
          }}
        >
          3. 문서 저장
        </Link>
      </nav>
    </main>
  )
}

