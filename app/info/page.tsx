'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function InfoPage() {
  const [formData, setFormData] = useState({
    spaceName: '',
    address: '',
    applicant: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 로컬 스토리지에 입력 데이터 저장
    localStorage.setItem('formData', JSON.stringify(formData))
    // 다음 단계로 이동
    window.location.href = '/signature'
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>정보 입력</h1>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label 
            htmlFor="spaceName" 
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            청구인 공간명 *
          </label>
          <input
            type="text"
            id="spaceName"
            name="spaceName"
            value={formData.spaceName}
            onChange={handleChange}
            required
            placeholder="예: 갤러리카페520"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        <div>
          <label 
            htmlFor="address" 
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            주소 *
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            placeholder="예: 충북 충주시 성터5길20 2층"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        <div>
          <label 
            htmlFor="applicant" 
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            신청자(대표) *
          </label>
          <input
            type="text"
            id="applicant"
            name="applicant"
            value={formData.applicant}
            onChange={handleChange}
            required
            placeholder="예: 주경옥"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Link 
            href="/"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#666',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            취소
          </Link>
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0070f3',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            다음 단계
          </button>
        </div>
      </form>
    </main>
  )
}

