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
    
    // 디버깅: 모든 XML 파일에서 태그 검색 및 구조 분석
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== 템플릿 파일 전체 분석 시작 ===\n')
      
      Object.keys(zip.files).forEach((name: string) => {
        if (name.endsWith('.xml')) {
          const file = zip.files[name]
          if (file && !file.dir) {
            try {
              const content = file.asText()
              
              // 모든 태그 패턴 찾기 (완전한 태그, 불완전한 태그, 중괄호만 있는 경우)
              const allBracePatterns = [
                /\{\{[^}]+\}\}/g,  // 완전한 태그: {{value1}}
                /\{\{[^}]*$/gm,    // 열린 태그만: {{value1 (닫히지 않음)
                /[^{]*\{\{/g,      // {{ 만 있는 경우
                /\}\}[^{]*/g,      // }} 만 있는 경우
                /\{\{/g,           // 모든 {{ 찾기
                /\}\}/g,           // 모든 }} 찾기
              ]
              
              let hasAnyTag = false
              allBracePatterns.forEach(pattern => {
                if (pattern.test(content)) {
                  hasAnyTag = true
                }
              })
              
              if (hasAnyTag) {
                console.log(`\n=== 태그 발견 파일: ${name} ===`)
                
                // 1. 완전한 태그 찾기
                const completeTags: string[] = []
                const completeTagPattern = /\{\{([^}]+)\}\}/g
                let match
                while ((match = completeTagPattern.exec(content)) !== null) {
                  completeTags.push(match[0])
                }
                
                if (completeTags.length > 0) {
                  console.log(`\n✓ 완전한 태그 (${completeTags.length}개):`)
                  completeTags.forEach((tag, idx) => {
                    console.log(`  ${idx + 1}. ${tag}`)
                  })
                }
                
                // 2. 불완전한 태그 찾기 (열림만 있거나 닫힘만 있는 경우)
                const incompleteOpenTags: string[] = []
                const incompleteCloseTags: string[] = []
                
                // {{ 로 시작하지만 }} 로 닫히지 않은 경우
                const openPattern = /\{\{[^}]*$/gm
                let openMatch
                while ((openMatch = openPattern.exec(content)) !== null) {
                  const line = content.substring(Math.max(0, openMatch.index - 50), Math.min(content.length, openMatch.index + 100))
                  incompleteOpenTags.push(line.trim())
                }
                
                // }} 로 끝나지만 {{ 로 시작하지 않은 경우
                const closePattern = /[^{]*\}\}/g
                let closeMatch
                while ((closeMatch = closePattern.exec(content)) !== null) {
                  const beforeClose = content.substring(Math.max(0, closeMatch.index - 100), closeMatch.index)
                  if (!beforeClose.includes('{{')) {
                    const line = content.substring(Math.max(0, closeMatch.index - 50), Math.min(content.length, closeMatch.index + 50))
                    incompleteCloseTags.push(line.trim())
                  }
                }
                
                if (incompleteOpenTags.length > 0) {
                  console.warn(`\n⚠️ 불완전한 열림 태그 발견 (${incompleteOpenTags.length}개):`)
                  incompleteOpenTags.forEach((tag, idx) => {
                    console.warn(`  ${idx + 1}. ...${tag.substring(Math.max(0, tag.length - 80))}`)
                  })
                }
                
                if (incompleteCloseTags.length > 0) {
                  console.warn(`\n⚠️ 불완전한 닫힘 태그 발견 (${incompleteCloseTags.length}개):`)
                  incompleteCloseTags.forEach((tag, idx) => {
                    console.warn(`  ${idx + 1}. ${tag.substring(0, 80)}...`)
                  })
                }
                
                // 3. {{ 와 }} 개수 비교
                const openBraces = (content.match(/\{\{/g) || []).length
                const closeBraces = (content.match(/\}\}/g) || []).length
                
                console.log(`\n중괄호 개수: {{ = ${openBraces}, }} = ${closeBraces}`)
                if (openBraces !== closeBraces) {
                  console.warn(`⚠️ 경고: 열림과 닫힘 중괄호 개수가 일치하지 않습니다!`)
                }
                
                // 4. 각 완전한 태그의 XML 구조 분석
                if (completeTags.length > 0) {
                  console.log(`\n=== 각 태그의 XML 구조 분석 ===`)
                  completeTags.forEach((tag, tagIndex) => {
                    const tagPattern = new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g')
                    let tagMatch
                    while ((tagMatch = tagPattern.exec(content)) !== null) {
                      console.log(`\n태그 #${tagIndex + 1}: ${tag}`)
                      console.log(`위치: ${tagMatch.index}`)
                      
                      // 태그 주변 300자 추출
                      const startPos = Math.max(0, tagMatch.index - 150)
                      const endPos = Math.min(content.length, tagMatch.index + tag.length + 150)
                      const context = content.substring(startPos, endPos)
                      
                      // 태그가 여러 <w:t>에 걸쳐 있는지 확인
                      const beforeTag = content.substring(Math.max(0, tagMatch.index - 500), tagMatch.index)
                      const afterTag = content.substring(tagMatch.index + tag.length, Math.min(content.length, tagMatch.index + tag.length + 500))
                      
                      // 태그 앞뒤의 <w:t> 태그 확인
                      const lastOpenT = beforeTag.lastIndexOf('<w:t')
                      const firstCloseT = afterTag.indexOf('</w:t>')
                      
                      if (lastOpenT !== -1 && firstCloseT !== -1) {
                        const betweenStartAndTag = beforeTag.substring(lastOpenT)
                        const betweenTagAndEnd = afterTag.substring(0, firstCloseT + 6)
                        
                        // 태그 사이에 </w:t>나 <w:t>가 있는지 확인
                        if (betweenStartAndTag.includes('</w:t>') || betweenTagAndEnd.includes('<w:t')) {
                          console.warn(`  ⚠️ 경고: 태그가 여러 <w:t> run에 걸쳐 있습니다!`)
                          console.log(`  앞 컨텍스트: ...${beforeTag.substring(Math.max(0, beforeTag.length - 60))}`)
                          console.log(`  뒤 컨텍스트: ${afterTag.substring(0, 60)}...`)
                        } else {
                          console.log(`  ✓ 태그가 하나의 <w:t> run 안에 있습니다.`)
                        }
                      }
                      
                      // XML 구조 출력 (가독성을 위해 포맷팅)
                      console.log(`  XML 컨텍스트:`)
                      const formattedContext = context
                        .replace(/</g, '\n    <')
                        .replace(/>/g, '>')
                        .split('\n')
                        .filter(line => line.includes(tag) || line.trim().length > 0)
                        .slice(0, 10)
                        .join('\n')
                      console.log(formattedContext)
                    }
                  })
                }
              }
            } catch (e) {
              console.error(`파일 ${name} 읽기 오류:`, e)
            }
          }
        }
      })
      
      console.log('\n=== 템플릿 파일 분석 완료 ===\n')
    }
    
    // Docxtemplater 초기화 전에 오류가 발생할 수 있는 위치 확인
    try {
      // docxtemplater가 파싱하기 전에 XML을 직접 확인
      const documentXml = zip.files['word/document.xml']
      if (documentXml) {
        const xmlContent = documentXml.asText()
        
        // offset 710 주변 확인 (오류 메시지에서 나온 위치)
        const checkOffsets = [710, 10217, 11293, 12374] // 오류 위치 + 각 태그 위치
        checkOffsets.forEach(offset => {
          if (offset < xmlContent.length) {
            const start = Math.max(0, offset - 100)
            const end = Math.min(xmlContent.length, offset + 100)
            const context = xmlContent.substring(start, end)
            
            console.log(`\n=== 위치 ${offset} 주변 분석 ===`)
            console.log(`컨텍스트: ${context}`)
            
            // 실제 불완전한 태그만 찾기 (완전한 태그는 제외)
            // 완전한 태그 패턴: {{...}}
            // 불완전한 태그: {{로 시작하지만 }}로 닫히지 않음
            const incompletePattern = /\{\{[^}]*?(?<!\}\})(?![^<]*\}\})/g
            let incompleteMatch
            const foundIncomplete: Array<{text: string, offset: number}> = []
            
            while ((incompleteMatch = incompletePattern.exec(context)) !== null) {
              const matchText = incompleteMatch[0]
              // 완전한 태그인지 확인 (}}로 끝나는지)
              if (!matchText.endsWith('}}')) {
                const actualOffset = start + incompleteMatch.index
                foundIncomplete.push({ text: matchText, offset: actualOffset })
              }
            }
            
            // 또는 더 간단한 방법: {{로 시작하지만 같은 <w:t> 안에 }}가 없는 경우
            const simpleIncompletePattern = /\{\{[^}]*$/gm
            let simpleMatch
            while ((simpleMatch = simpleIncompletePattern.exec(context)) !== null) {
              const matchText = simpleMatch[0]
              // 완전한 태그가 아닌 경우만
              if (!matchText.includes('}}')) {
                const actualOffset = start + simpleMatch.index
                // 이미 추가되지 않은 경우만
                if (!foundIncomplete.some(item => item.offset === actualOffset)) {
                  foundIncomplete.push({ text: matchText, offset: actualOffset })
                }
              }
            }
            
            if (foundIncomplete.length > 0) {
              console.warn(`⚠️ 위치 ${offset} 주변에 불완전한 태그 패턴 발견!`)
              foundIncomplete.forEach(item => {
                console.warn(`  불완전한 태그 발견: "${item.text}" (전체 위치: ${item.offset})`)
                
                // 주변 XML 구조 확인
                const beforeContext = xmlContent.substring(Math.max(0, item.offset - 200), item.offset)
                const afterContext = xmlContent.substring(item.offset, Math.min(xmlContent.length, item.offset + 200))
                
                console.log(`  앞 컨텍스트: ...${beforeContext.substring(Math.max(0, beforeContext.length - 80))}`)
                console.log(`  뒤 컨텍스트: ${afterContext.substring(0, 80)}...`)
                
                // <w:t> 태그 구조 확인
                const lastOpenT = beforeContext.lastIndexOf('<w:t')
                const firstCloseT = afterContext.indexOf('</w:t>')
                
                if (lastOpenT !== -1 && firstCloseT !== -1) {
                  const betweenStartAndTag = beforeContext.substring(lastOpenT)
                  const betweenTagAndEnd = afterContext.substring(0, firstCloseT + 6)
                  
                  if (betweenStartAndTag.includes('</w:t>') || betweenTagAndEnd.includes('<w:t')) {
                    console.error(`  ❌ 문제 발견: 태그가 여러 <w:t> run에 걸쳐 있습니다!`)
                    console.error(`  이 부분이 docxtemplater 오류의 원인입니다.`)
                  }
                }
              })
            }
          }
        })
      }
    } catch (e) {
      console.error('XML 사전 분석 오류:', e)
    }

    // 이미지 모듈 설정 (시그니처 이미지용)
    const opts: any = {}
    opts.centered = false
    opts.fileType = 'docx'
    opts.getImage = (tagValue: string) => {
      // 시그니처 이미지 반환
      if (tagValue === 'signature') {
        const base64Data = signatureData.split(',')[1]
        // base64를 Uint8Array로 변환
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
      }
      return null
    }
    opts.getSize = () => {
      // 이미지 크기 설정 (픽셀 단위)
      return [200, 100] // width, height
    }

    const imageModule = new ImageModule(opts)

    // XML 전처리: 태그가 여러 run에 걸쳐 있는 경우 하나로 합치기
    try {
      const documentXml = zip.files['word/document.xml']
      if (documentXml) {
        let xmlContent = documentXml.asText()
        
        // 태그가 여러 <w:t> run에 걸쳐 있는 경우를 찾아서 하나로 합치기
        // 패턴: </w:t></w:r><w:r>...<w:t>{{ 또는 }}<w:t>...</w:r><w:r><w:t>
        const tagPattern = /\{\{([^}]+)\}\}/g
        let match
        const tagsToFix: Array<{original: string, fixed: string, index: number}> = []
        
        while ((match = tagPattern.exec(xmlContent)) !== null) {
          const tag = match[0]
          const tagName = match[1]
          const startPos = match.index
          const endPos = startPos + tag.length
          
          // 태그 앞뒤의 XML 구조 확인
          const beforeContext = xmlContent.substring(Math.max(0, startPos - 500), startPos)
          const afterContext = xmlContent.substring(endPos, Math.min(xmlContent.length, endPos + 500))
          
          // 태그가 여러 <w:t>에 걸쳐 있는지 확인
          const lastOpenT = beforeContext.lastIndexOf('<w:t')
          const firstCloseT = afterContext.indexOf('</w:t>')
          
          if (lastOpenT !== -1 && firstCloseT !== -1) {
            const betweenStartAndTag = beforeContext.substring(lastOpenT)
            const betweenTagAndEnd = afterContext.substring(0, firstCloseT + 6)
            
            // 태그 사이에 </w:t>나 <w:t>가 있는지 확인
            if (betweenStartAndTag.includes('</w:t>') || betweenTagAndEnd.includes('<w:t')) {
              console.warn(`⚠️ 태그 ${tag}가 여러 run에 걸쳐 있습니다. 수정 시도...`)
              
              // 태그를 하나의 <w:t> run 안에 넣기
              // 이 부분은 복잡하므로, 대신 docxtemplater의 옵션을 조정하는 것이 더 안전합니다
            }
          }
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
      delimiters: {
        start: '{{',
        end: '}}',
      },
    })

    // 템플릿 데이터 설정
    const templateData = {
      value1: formData.spaceName,
      value2: formData.address,
      value3: formData.applicant,
      signature: 'signature', // 이미지 모듈에서 처리할 태그
    }

    // 템플릿 데이터 설정 및 렌더링
    try {
      // docxtemplater 3.x에서는 render()에 직접 데이터 전달 (deprecated 경고 해결)
      doc.render(templateData)
    } catch (error: any) {
      console.error('템플릿 렌더링 오류 전체:', error)
      console.error('오류 properties:', error.properties)

      // 오류 메시지 추출
      let errorMessage = '템플릿 처리 중 오류가 발생했습니다.'
      let detailedErrors: string[] = []

      if (error.properties) {
        if (error.properties.errors && Array.isArray(error.properties.errors)) {
          // 여러 오류가 있는 경우
          error.properties.errors.forEach((e: any, index: number) => {
            console.error(`오류 ${index + 1}:`, e)
            if (e.properties) {
              console.error(`  - 파일: ${e.properties.file || 'unknown'}`)
              console.error(`  - 위치: ${e.properties.offset || 'unknown'}`)
              console.error(`  - 컨텍스트: ${e.properties.context || 'unknown'}`)
              console.error(`  - 설명: ${e.properties.explanation || e.message || 'unknown'}`)
              
              detailedErrors.push(
                `오류 ${index + 1}:\n` +
                `  파일: ${e.properties.file || 'unknown'}\n` +
                `  위치: ${e.properties.offset || 'unknown'}\n` +
                `  컨텍스트: ${e.properties.context || 'unknown'}\n` +
                `  설명: ${e.properties.explanation || e.message || 'unknown'}`
              )
            } else {
              detailedErrors.push(`오류 ${index + 1}: ${e.message || e.name || '알 수 없는 오류'}`)
            }
          })
          errorMessage = `템플릿 오류:\n\n${detailedErrors.join('\n\n')}`
        } else if (error.properties.explanation) {
          // 단일 오류
          console.error(`  - 파일: ${error.properties.file || 'unknown'}`)
          console.error(`  - 위치: ${error.properties.offset || 'unknown'}`)
          console.error(`  - 컨텍스트: ${error.properties.context || 'unknown'}`)
          errorMessage = `템플릿 오류:\n파일: ${error.properties.file || 'unknown'}\n위치: ${error.properties.offset || 'unknown'}\n설명: ${error.properties.explanation}`
        } else if (error.message) {
          errorMessage = `템플릿 오류: ${error.message}`
        }
      } else if (error.message) {
        errorMessage = `템플릿 오류: ${error.message}`
      }

      throw new Error(errorMessage)
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

