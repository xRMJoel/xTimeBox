// Dynamic CDN loading for jsPDF + autoTable + custom fonts
let jsPDFRef = null
let fontsRegistered = false

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { existing.remove() }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureJsPDF() {
  if (jsPDFRef) return jsPDFRef
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
      if (window.jspdf) { jsPDFRef = window.jspdf; return jsPDFRef }
    } catch (e) {
      console.warn('CDN failed, trying next:', e.message)
    }
  }
  throw new Error('Could not load PDF library from any CDN. Check your internet connection.')
}

/** Fetch a font file and return its base64 string */
async function fetchFontBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Register Montserrat and Nunito Sans with a jsPDF doc instance.
 * Uses Google Fonts static TTF URLs. Fonts are cached after first load.
 */
const fontCache = {}
async function registerFonts(doc) {
  // Static TTF files (not variable fonts) so jsPDF can render bold/normal correctly
  // Montserrat from the official GitHub repo, Nunito Sans from Google Fonts static serving
  const fonts = [
    { name: 'Montserrat', style: 'bold', urls: [
      'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-Bold.ttf',
      'https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf',
    ]},
    { name: 'Montserrat', style: 'normal', urls: [
      'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-Regular.ttf',
      'https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf',
    ]},
    { name: 'NunitoSans', style: 'bold', urls: [
      'https://cdn.jsdelivr.net/gh/googlefonts/nunitosans@v3.001/NunitoSans-Bold.ttf',
      'https://raw.githubusercontent.com/googlefonts/nunitosans/v3.001/NunitoSans-Bold.ttf',
    ]},
    { name: 'NunitoSans', style: 'normal', urls: [
      'https://cdn.jsdelivr.net/gh/googlefonts/nunitosans@v3.001/NunitoSans-Regular.ttf',
      'https://raw.githubusercontent.com/googlefonts/nunitosans/v3.001/NunitoSans-Regular.ttf',
    ]},
  ]

  for (const f of fonts) {
    const cacheKey = `${f.name}-${f.style}`
    if (fontCache[cacheKey]) {
      doc.addFileToVFS(`${cacheKey}.ttf`, fontCache[cacheKey])
      doc.addFont(`${cacheKey}.ttf`, f.name, f.style)
      continue
    }
    let loaded = false
    for (const url of f.urls) {
      try {
        const b64 = await fetchFontBase64(url)
        fontCache[cacheKey] = b64
        doc.addFileToVFS(`${cacheKey}.ttf`, b64)
        doc.addFont(`${cacheKey}.ttf`, f.name, f.style)
        loaded = true
        break
      } catch (e) {
        console.warn(`Font URL failed for ${cacheKey}:`, url, e.message)
      }
    }
    if (!loaded) console.warn(`Could not load ${cacheKey}, will fall back to helvetica`)
  }
}

/** Format a date string like "Fri, 6 Mar 2026" */
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** Paint the full page background dark */
function paintPageBg(doc) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, w, h, 'F')
}

/** Try to use a custom font, fall back to helvetica */
function useFont(doc, name, style) {
  try {
    doc.setFont(name, style)
  } catch {
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal')
  }
}

/** Shared autoTable config */
function tableDefaults(headerBg, primary, allCategories) {
  return {
    theme: 'plain',
    styles: { fontSize: 8, font: 'NunitoSans', cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }, textColor: [203, 213, 225], fillColor: [15, 23, 42] },
    headStyles: { fillColor: headerBg, textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: headerBg, textColor: primary, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [22, 33, 55] },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', textColor: [226, 232, 240] },
      [allCategories.length + 1]: { textColor: primary, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.column.index > 0) data.cell.styles.halign = 'right'
    },
    margin: { left: 14, right: 14 },
  }
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

  // Register custom fonts
  await registerFonts(doc)

  const primary = [0, 201, 255]
  const mid = [100, 116, 139]
  const headerBg = [30, 41, 59]
  const accent = [0, 160, 210]

  paintPageBg(doc)

  let y = 15

  // ── Title bar ──
  doc.setFillColor(...headerBg)
  doc.roundedRect(14, 8, pageW - 28, 22, 3, 3, 'F')
  useFont(doc, 'Montserrat', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('Monthly Project Report', 20, 18)
  useFont(doc, 'NunitoSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...primary)
  doc.text(`${projectName}  |  ${client}  |  ${monthLabel}`, 20, 25)
  y = 38

  // ── Summary cards ──
  const summaryItems = [
    { label: 'Total Days', value: grandTotal.toFixed(1), highlight: true },
    { label: 'Weeks', value: String(totalWeeks) },
    { label: 'Entries', value: String(totalEntries) },
    { label: 'Client', value: client || '-' },
  ]
  const cardGap = 4
  const boxW = (pageW - 28 - cardGap * 3) / 4
  summaryItems.forEach((item, i) => {
    const x = 14 + i * (boxW + cardGap)
    doc.setFillColor(...headerBg)
    doc.roundedRect(x, y, boxW, 16, 2, 2, 'F')
    if (item.highlight) {
      doc.setDrawColor(...accent)
      doc.setLineWidth(0.4)
      doc.roundedRect(x, y, boxW, 16, 2, 2, 'S')
    }
    useFont(doc, 'NunitoSans', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...mid)
    doc.text(item.label.toUpperCase(), x + 4, y + 5.5)
    useFont(doc, 'Montserrat', 'bold')
    doc.setFontSize(item.highlight ? 13 : 11)
    doc.setTextColor(item.highlight ? 0 : 255, item.highlight ? 201 : 255, 255)
    doc.text(item.value, x + 4, y + 12.5)
  })
  y += 24

  // ── Days by Category ──
  useFont(doc, 'Montserrat', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...mid)
  doc.text('DAYS BY CATEGORY', 14, y)
  y += 2

  const catBody = weekData.map((w) => [
    fmtDate(w.weekEnding),
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
    head: [['Week Ending', ...allCategories, 'Total']],
    body: catBody,
    foot: catFoot,
    ...tableDefaults(headerBg, primary, allCategories),
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Days by Reference ──
  if (referenceData.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      paintPageBg(doc)
      y = 14
    }

    useFont(doc, 'Montserrat', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...mid)
    doc.text('DAYS BY REFERENCE', 14, y)
    y += 2

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
      head: [['Reference', ...allCategories, 'Total']],
      body: refBody,
      foot: refFoot,
      ...tableDefaults(headerBg, primary, allCategories),
    })
  }

  // ── Footer on every page ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    if (i > 1) paintPageBg(doc)
    const ph = doc.internal.pageSize.getHeight()
    useFont(doc, 'NunitoSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...mid)
    doc.text(`xTimeBox  |  Generated ${new Date().toLocaleDateString('en-GB')}`, 14, ph - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, ph - 6, { align: 'right' })
  }

  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}_${monthLabel.replace(' ', '-')}.pdf`
  doc.save(filename)
}
