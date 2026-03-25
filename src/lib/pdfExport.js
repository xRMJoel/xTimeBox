// Dynamic CDN loading for jsPDF + autoTable
let jsPDFRef = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { existing.remove() } // remove stale tags so we can retry
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureJsPDF() {
  if (jsPDFRef) return jsPDFRef

  // Try multiple CDNs in case one is blocked
  const cdns = [
    {
      jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    },
    {
      jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    },
    {
      jspdf: 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
      autotable: 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    },
  ]

  for (const cdn of cdns) {
    try {
      await loadScript(cdn.jspdf)
      await loadScript(cdn.autotable)
      if (window.jspdf) {
        jsPDFRef = window.jspdf
        return jsPDFRef
      }
    } catch (e) {
      console.warn('CDN failed, trying next:', e.message)
    }
  }

  throw new Error('Could not load PDF library from any CDN. Check your internet connection.')
}

/**
 * Export the Monthly Project Report as a styled PDF.
 */
export async function exportMonthlyProjectPDF({
  projectName, client, monthLabel, grandTotal, totalWeeks, totalEntries,
  weekData, allCategories, referenceData,
}) {
  const { jsPDF } = await ensureJsPDF()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Colours
  const primary = [0, 201, 255]      // cyan
  const mid = [100, 116, 139]        // slate-500
  const headerBg = [30, 41, 59]      // slate-800

  let y = 15

  // ── Title bar ──
  doc.setFillColor(...headerBg)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('Monthly Project Report', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...primary)
  doc.text(`${projectName}  ·  ${client}  ·  ${monthLabel}`, 14, 22)
  y = 36

  // ── Summary row ──
  const summaryItems = [
    { label: 'Total Days', value: grandTotal.toFixed(1) },
    { label: 'Weeks', value: String(totalWeeks) },
    { label: 'Entries', value: String(totalEntries) },
    { label: 'Client', value: client || '-' },
  ]
  const boxW = (pageW - 28 - 12) / 4
  doc.setFontSize(8)
  summaryItems.forEach((item, i) => {
    const x = 14 + i * (boxW + 4)
    doc.setFillColor(30, 41, 59)
    doc.roundedRect(x, y, boxW, 16, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mid)
    doc.text(item.label.toUpperCase(), x + 4, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text(item.value, x + 4, y + 12)
    doc.setFontSize(8)
  })
  y += 24

  // ── Days by Category table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...mid)
  doc.text('DAYS BY CATEGORY', 14, y)
  y += 3

  const catHead = [['Week Ending', ...allCategories, 'Total']]
  const catBody = weekData.map((w) => [
    w.weekEnding,
    ...allCategories.map((c) => w.categories[c] ? w.categories[c].toFixed(1) : '-'),
    w.total.toFixed(1),
  ])
  const catFoot = [[
    'Monthly Total',
    ...allCategories.map((c) => {
      const t = weekData.reduce((s, w) => s + (w.categories[c] || 0), 0)
      return t > 0 ? t.toFixed(1) : '-'
    }),
    grandTotal.toFixed(1),
  ]]

  doc.autoTable({
    startY: y,
    head: catHead,
    body: catBody,
    foot: catFoot,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [226, 232, 240] },
    headStyles: { fillColor: headerBg, textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [20, 30, 48], textColor: primary, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [20, 27, 45] },
    columnStyles: {
      0: { halign: 'left' },
      [allCategories.length + 1]: { textColor: primary, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.column.index > 0) data.cell.styles.halign = 'right'
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Days by Reference table ──
  if (referenceData.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = 15
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...mid)
    doc.text('DAYS BY REFERENCE', 14, y)
    y += 3

    const refHead = [['Reference', ...allCategories, 'Total']]
    const refBody = referenceData.map((r) => [
      r.reference,
      ...allCategories.map((c) => r.categories[c] ? r.categories[c].toFixed(1) : '-'),
      r.total.toFixed(1),
    ])
    const refFoot = [[
      'Total',
      ...allCategories.map((c) => {
        const t = referenceData.reduce((s, r) => s + (r.categories[c] || 0), 0)
        return t > 0 ? t.toFixed(1) : '-'
      }),
      grandTotal.toFixed(1),
    ]]

    doc.autoTable({
      startY: y,
      head: refHead,
      body: refBody,
      foot: refFoot,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [226, 232, 240] },
      headStyles: { fillColor: headerBg, textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [20, 30, 48], textColor: primary, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [20, 27, 45] },
      columnStyles: {
        0: { halign: 'left' },
        [allCategories.length + 1]: { textColor: primary, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.column.index > 0) data.cell.styles.halign = 'right'
      },
      margin: { left: 14, right: 14 },
    })
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(...mid)
    doc.text(`xTimeBox  ·  Generated ${new Date().toLocaleDateString('en-GB')}`, 14, ph - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, ph - 6, { align: 'right' })
  }

  // Save
  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}_${monthLabel.replace(' ', '-')}.pdf`
  doc.save(filename)
}
