// Builds a minimal, valid single-page PDF containing the given text, with a correct xref
// table so the backend's `pypdf`-based extraction can actually parse it — mirrors
// `backend/tests/pdf_helpers.py`'s `make_pdf`/`make_words_pdf`, reimplemented here so
// Playwright e2e specs can generate genuinely distinct, extractable "documents" on the fly
// instead of uploading non-PDF byte buffers that always fail extraction
// (018-ui-polish-batch — several new entire-corpus e2e tests need multiple real documents).
export function makePdf(text: string): Buffer {
  const objects: Buffer[] = [
    Buffer.from('<</Type/Catalog/Pages 2 0 R>>'),
    Buffer.from('<</Type/Pages/Kids[3 0 R]/Count 1>>'),
    Buffer.from(
      '<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>' +
        '/MediaBox[0 0 600 800]/Contents 5 0 R>>',
    ),
    Buffer.from('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'),
  ]

  const stream = text ? Buffer.from(`BT /F1 12 Tf 10 700 Td (${text}) Tj ET`) : Buffer.alloc(0)
  objects.push(
    Buffer.concat([
      Buffer.from(`<</Length ${stream.length}>>\nstream\n`),
      stream,
      Buffer.from('\nendstream'),
    ]),
  )

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n')]
  const offsets: number[] = [0]
  let position = chunks[0].length

  objects.forEach((obj, index) => {
    offsets.push(position)
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      obj,
      Buffer.from('\nendobj\n'),
    ])
    chunks.push(chunk)
    position += chunk.length
  })

  const xrefOffset = position
  const count = objects.length + 1
  const xrefLines = [`xref\n0 ${count}\n`, '0000000000 65535 f \n']
  for (const offset of offsets.slice(1)) {
    xrefLines.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  }
  chunks.push(Buffer.from(xrefLines.join('')))
  chunks.push(Buffer.from(`trailer\n<</Size ${count}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`))

  return Buffer.concat(chunks)
}

export function makeWordsPdf(wordCount: number, word = 'word'): Buffer {
  return makePdf(Array.from({ length: wordCount }, () => word).join(' '))
}
