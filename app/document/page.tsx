'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
// @ts-ignore - docxtemplater 타입 정의 없음
import Docxtemplater from 'docxtemplater'
// @ts-ignore - pizzip 타입 정의 없음
import PizZip from 'pizzip'
// @ts-ignore - docxtemplater-image-module-free 타입 정의 없음
import ImageModule from 'docxtemplater-image-module-free'

interface FormData {
  spaceName: string
  address: string
  applicant: string
}

type FileFormat = 'docx' | 'pdf'

export default function DocumentPage() {
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [fileFormat, setFileFormat] = useState<FileFormat>('docx')

  useEffect(() => {
    // 저장된 시그니처와 입력 데이터 불러오기
    const savedSignature = localStorage.getItem('signature')
    const savedFormData = localStorage.getItem('formData')

    if (savedSignature) {
      setSignatureData(savedSignature)
    }
    if (savedFormData) {
      setFormData(JSON.parse(savedFormData))
    }
  }, [])

  const base64ToBlob = (base64: string): Blob => {
    const base64Data = base64.split(',')[1]
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: 'image/png' })
  }

  const generateDocx = async (): Promise<Blob> => {
    if (!formData || !signatureData) {
      throw new Error('필수 데이터가 없습니다.')
    }

    // 템플릿 파일 로드
    const templateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/document/template.docx`)
    const templateArrayBuffer = await templateResponse.arrayBuffer()

    // PizZip으로 템플릿 압축 해제
    const zip = new PizZip(templateArrayBuffer)

    // 이미지 모듈 설정 (시그니처 이미지용)
    // docxtemplater-image-module-free는 값이 객체일 때 getImage를 호출합니다
    const opts: any = {}
    opts.centered = false
    opts.fileType = 'docx'
    const imageOpts: any = {
      fileType: 'docx',
      centered: false,
      getImage: (tagValue: any) => {
        if (!tagValue) return null
        const base64Data = signatureData.includes(',')
          ? signatureData.split(',')[1]
          : signatureData
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
      },
      getSize: (img: any, tagValue: any) => {
        return [80, 80]
      }
    }

    const imageModule = new ImageModule(imageOpts)


    // XML 전처리: {{signature}} 텍스트 태그가 없으면 추가
    // {{value3}} (인) 앞에 {{signature}} 텍스트 태그 추가 (이미지가 (인) 위에 오도록)
    try {
      const documentXml = zip.files['word/document.xml']
      if (documentXml) {
        let xmlContent = documentXml.asText()
        let modified = false


        if (modified) {
          // 수정된 XML을 zip에 다시 저장
          zip.file('word/document.xml', xmlContent)
          console.log('✓ XML이 수정되었습니다.')
        }
      }
    } catch (e) {
      console.warn('XML 전처리 중 오류 (무시하고 계속):', e)
    }

    // Docxtemplater로 템플릿 처리
    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
      // 태그가 여러 run에 걸쳐 있어도 처리할 수 있도록 옵션 추가
      // delimiters: {
      //   start: '{{',
      //   end: '}}',
      // },
    })

    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // 템플릿 데이터 설정
    // signature 필드는 이미지 모듈이 처리합니다
    // docxtemplater-image-module-free는 값이 객체이고 type이 'image'일 때 getImage를 호출합니다
    const templateData = {
      year: year,
      month: month,
      day: day,
      value1: formData.spaceName,
      value2: formData.address,
      value3: formData.applicant,
      // signature: {
      //   type: 'image', // 이미지 모듈이 인식하는 형식
      //   data: 'signature', // getImage에서 이 값을 확인합니다
      //   width: 80,
      //   height: 80,
      // },
      signature: signatureData
    }

    // 템플릿 데이터 설정 및 렌더링
    try {
      // docxtemplater 3.x에서는 render()에 직접 데이터 전달 (deprecated 경고 해결)
      doc.render(templateData)
    } catch (error: any) {
      console.error('템플릿 렌더링 오류 전체:', error)
      console.error('오류 properties:', error.properties)
    }

    // DOCX 파일 생성
    const generatedDocx = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    return generatedDocx as Blob
  }

  const generatePDF = async (): Promise<Blob> => {
    if (!formData || !signatureData) {
      throw new Error('필수 데이터가 없습니다.')
    }

    const today = new Date()
    const dateString = `${today.getFullYear()}년 ${String(today.getMonth() + 1).padStart(2, '0')}월 ${String(today.getDate()).padStart(2, '0')}일`

    // PDF 생성
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin

    // 날짜 (우측 정렬)
    doc.setFontSize(12)
    doc.text(dateString, pageWidth - margin, yPosition, { align: 'right' })
    yPosition += 20

    // 청구인 공간명
    doc.text(`청구인 공간명 : ${formData.spaceName}`, margin, yPosition)
    yPosition += 10

    // 주소
    doc.text(`주소: ${formData.address}`, margin, yPosition)
    yPosition += 10

    // 신청자(대표)
    doc.text(`신청자(대표) : ${formData.applicant}`, margin, yPosition)
    yPosition += 20

    // 시그니처 이미지 추가 (base64 문자열을 직접 사용)
    const img = new Image()
    img.src = signatureData

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const imgWidth = 60
    const imgHeight = 30

    // 시그니처 이미지를 먼저 배치
    doc.addImage(signatureData, 'PNG', margin, yPosition, imgWidth, imgHeight)

    // 2002(인) 텍스트를 이미지 옆에 배치 (이미지 너비 + 여백)
    const textX = margin + imgWidth + 5
    const textY = yPosition + imgHeight / 2 + 3 // 이미지 중앙에 맞춤
    doc.text('2002(인)', textX, textY)

    yPosition += imgHeight + 10

    // PDF를 Blob으로 변환
    const pdfBlob = doc.output('blob')
    return pdfBlob
  }

  const handleSave = async () => {
    if (!signatureData) {
      alert('시그니처가 없습니다. 이전 단계로 돌아가서 시그니처를 그려주세요.')
      return
    }

    if (!formData) {
      alert('입력 정보가 없습니다. 첫 번째 단계로 돌아가서 정보를 입력해주세요.')
      return
    }

    setIsGenerating(true)

    try {
      const dateStr = new Date().toISOString().split('T')[0]

      if (fileFormat === 'docx') {
        const blob = await generateDocx()
        const fileName = `신청서_${formData.spaceName}_${dateStr}.docx`
        saveAs(blob, fileName)
      } else {
        const blob = await generatePDF()
        const fileName = `신청서_${formData.spaceName}_${dateStr}.pdf`
        saveAs(blob, fileName)
      }

      alert('문서가 저장되었습니다.')
    } catch (error: any) {
      console.error('문서 저장 중 오류:', error)
      const errorMessage = error?.message || error?.toString() || '알 수 없는 오류가 발생했습니다.'
      alert(`문서 저장 중 오류가 발생했습니다.\n\n${errorMessage}\n\n템플릿 파일의 태그가 올바르게 작성되었는지 확인해주세요.`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>문서 저장</h1>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>시그니처 미리보기</h2>
        {signatureData ? (
          <div style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: '#f9f9f9'
          }}>
            <img
              src={signatureData}
              alt="시그니처"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        ) : (
          <p style={{ color: '#999' }}>시그니처가 없습니다.</p>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>입력 정보</h2>
        {formData ? (
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: '#f9f9f9'
          }}>
            <p><strong>청구인 공간명:</strong> {formData.spaceName}</p>
            <p><strong>주소:</strong> {formData.address}</p>
            <p><strong>신청자(대표):</strong> {formData.applicant}</p>
          </div>
        ) : (
          <p style={{ color: '#999' }}>입력 정보가 없습니다.</p>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>저장 형식 선택</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="fileFormat"
              value="docx"
              checked={fileFormat === 'docx'}
              onChange={(e) => setFileFormat(e.target.value as FileFormat)}
              style={{ cursor: 'pointer' }}
            />
            <span>DOCX</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="fileFormat"
              value="pdf"
              checked={fileFormat === 'pdf'}
              onChange={(e) => setFileFormat(e.target.value as FileFormat)}
              style={{ cursor: 'pointer' }}
            />
            <span>PDF</span>
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Link
          href="/signature"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#666',
            color: 'white',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'inline-block'
          }}
        >
          이전
        </Link>
        <button
          onClick={handleSave}
          disabled={isGenerating || !signatureData}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isGenerating || !signatureData ? '#ccc' : '#0070f3',
            color: 'white',
            borderRadius: '4px',
            border: 'none',
            cursor: isGenerating || !signatureData ? 'not-allowed' : 'pointer',
            fontSize: '1rem'
          }}
        >
          {isGenerating ? '생성 중...' : '문서 저장'}
        </button>
      </div>
    </main>
  )
}

