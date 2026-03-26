// PDF export using html2canvas for real font rendering + jsPDF for PDF generation

let libsLoaded = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureLibs() {
  if (libsLoaded) return libsLoaded
  libsLoaded = (async () => {
    const cdns = [
      { jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', h2c: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js' },
      { jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' },
      { jspdf: 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js', h2c: 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js' },
    ]
    for (const cdn of cdns) {
      try {
        await loadScript(cdn.jspdf)
        await loadScript(cdn.h2c)
        if (window.jspdf && window.html2canvas) return { jsPDF: window.jspdf.jsPDF, html2canvas: window.html2canvas }
      } catch (e) {
        console.warn('CDN failed, trying next:', e.message)
      }
    }
    throw new Error('Could not load PDF libraries. Check your internet connection.')
  })()
  return libsLoaded
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Format a date string like "Fri, 6 Mar 2026" */
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** Build the HTML string for the report (light theme, real fonts) */
function buildReportHTML({
  projectName, client, monthLabel, grandTotal, grandTotalHours, totalWeeks, totalEntries,
  weekData, allCategories, referenceData,
}) {
  const primary = '#0891b2'   // cyan-600
  const accent = '#06b6d4'    // cyan-500
  const dark = '#0f172a'      // slate-900
  const mid = '#64748b'       // slate-500
  const light = '#f1f5f9'     // slate-100
  const border = '#e2e8f0'    // slate-200
  const headerBg = '#0f172a'

  const cellH = 'height:38px;line-height:38px;'
  const th = `style="${cellH}padding:0 12px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-family:'Nunito Sans',sans-serif"`
  const thLeft = `style="${cellH}padding:0 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-family:'Nunito Sans',sans-serif"`
  const td = `style="${cellH}padding:0 12px;text-align:right;font-size:12px;color:${dark};font-family:'Nunito Sans',sans-serif"`
  const tdLeft = `style="${cellH}padding:0 12px;text-align:left;font-size:12px;font-weight:600;color:${dark};font-family:'Nunito Sans',sans-serif"`
  const tdTotal = `style="${cellH}padding:0 12px;text-align:right;font-size:12px;font-weight:700;color:${primary};font-family:'Nunito Sans',sans-serif"`
  const tfLeft = `style="${cellH}padding:0 12px;text-align:left;font-size:12px;font-weight:700;color:${primary};font-family:'Montserrat',sans-serif"`
  const tf = `style="${cellH}padding:0 12px;text-align:right;font-size:12px;font-weight:700;color:${primary};font-family:'Nunito Sans',sans-serif"`

  const hasHours = grandTotalHours > 0

  // Category table rows
  const catRows = weekData.map((w, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : light
    const cells = allCategories.map(c =>
      `<td ${td}>${w.categories[c] ? w.categories[c].toFixed(1) : '-'}</td>`
    ).join('')
    const hoursCell = hasHours ? `<td ${td}>${w.totalHours > 0 ? w.totalHours + 'h' : '-'}</td>` : ''
    return `<tr style="background:${bg}"><td ${tdLeft}>${fmtDate(w.weekEnding)}</td>${cells}${hoursCell}<td ${tdTotal}>${w.total.toFixed(2)}</td></tr>`
  }).join('')

  const catFootCells = allCategories.map(c => {
    const t = weekData.reduce((s, w) => s + (w.categories[c] || 0), 0)
    return `<td ${tf}>${t > 0 ? t.toFixed(1) : '-'}</td>`
  }).join('')

  // Reference table rows
  const refRows = referenceData.map((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : light
    const cells = allCategories.map(c =>
      `<td ${td}>${r.categories[c] ? r.categories[c].toFixed(1) : '-'}</td>`
    ).join('')
    const hoursCell = hasHours ? `<td ${td}>${r.totalHours > 0 ? r.totalHours + 'h' : '-'}</td>` : ''
    return `<tr style="background:${bg}"><td ${tdLeft}>${escapeHtml(r.reference)}</td>${cells}${hoursCell}<td ${tdTotal}>${r.total.toFixed(2)}</td></tr>`
  }).join('')

  const refFootCells = allCategories.map(c => {
    const t = referenceData.reduce((s, r) => s + (r.categories[c] || 0), 0)
    return `<td ${tf}>${t > 0 ? t.toFixed(1) : '-'}</td>`
  }).join('')

  return `
<div style="width:1120px;padding:24px 32px;background:#ffffff;font-family:'Nunito Sans',system-ui,sans-serif;color:${dark}">
  <!-- Title -->
  <div style="background:${headerBg};border-radius:8px;padding:16px 24px;margin-bottom:20px">
    <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:22px;color:#ffffff">Monthly Project Report</div>
    <div style="font-family:'Nunito Sans',sans-serif;font-size:13px;color:${accent};margin-top:4px">${escapeHtml(projectName)}  |  ${escapeHtml(client)}  |  ${escapeHtml(monthLabel)}</div>
  </div>

  <!-- Summary cards -->
  <div style="display:flex;gap:12px;margin-bottom:20px">
    <div style="flex:1;background:${light};border:2px solid ${accent};border-radius:8px;padding:10px 16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${mid};font-family:'Nunito Sans',sans-serif">Total</div>
      <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:24px;color:${primary}">${hasHours ? grandTotalHours + 'hrs' : grandTotal.toFixed(1) + 'd'}</div>
      ${hasHours ? `<div style="font-size:11px;color:${mid};font-family:'Nunito Sans',sans-serif">${grandTotal.toFixed(2)} days</div>` : ''}
    </div>
    <div style="flex:1;background:${light};border-radius:8px;padding:10px 16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${mid};font-family:'Nunito Sans',sans-serif">Weeks</div>
      <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:24px;color:${dark}">${totalWeeks}</div>
    </div>
    <div style="flex:1;background:${light};border-radius:8px;padding:10px 16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${mid};font-family:'Nunito Sans',sans-serif">Entries</div>
      <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:24px;color:${dark}">${totalEntries}</div>
    </div>
    <div style="flex:1;background:${light};border-radius:8px;padding:10px 16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${mid};font-family:'Nunito Sans',sans-serif">Client</div>
      <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:16px;color:${dark};margin-top:4px">${escapeHtml(client || '-')}</div>
    </div>
  </div>

  <!-- Days by Category -->
  <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:${mid};margin-bottom:6px">Days by Category</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:6px;overflow:hidden;margin-bottom:20px">
    <thead>
      <tr style="background:${headerBg}">
        <th ${thLeft}>Week Ending</th>
        ${allCategories.map(c => `<th ${th}>${escapeHtml(c)}</th>`).join('')}
        ${hasHours ? `<th ${th}>Hours</th>` : ''}
        <th style="${cellH}padding:0 12px;text-align:right;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.05em;font-family:'Nunito Sans',sans-serif">Days</th>
      </tr>
    </thead>
    <tbody>${catRows}</tbody>
    <tfoot>
      <tr style="background:${light};border-top:2px solid ${border}">
        <td ${tfLeft}>Monthly Total</td>
        ${catFootCells}
        ${hasHours ? `<td ${tf}>${grandTotalHours}h</td>` : ''}
        <td ${tf}>${grandTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Days by Reference -->
  ${referenceData.length > 0 ? `
  <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:${mid};margin-bottom:6px">Days by Reference</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:6px;overflow:hidden;margin-bottom:20px">
    <thead>
      <tr style="background:${headerBg}">
        <th ${thLeft}>Reference</th>
        ${allCategories.map(c => `<th ${th}>${escapeHtml(c)}</th>`).join('')}
        ${hasHours ? `<th ${th}>Hours</th>` : ''}
        <th style="${cellH}padding:0 12px;text-align:right;font-size:11px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.05em;font-family:'Nunito Sans',sans-serif">Days</th>
      </tr>
    </thead>
    <tbody>${refRows}</tbody>
    <tfoot>
      <tr style="background:${light};border-top:2px solid ${border}">
        <td ${tfLeft}>Total</td>
        ${refFootCells}
        ${hasHours ? `<td ${tf}>${grandTotalHours}h</td>` : ''}
        <td ${tf}>${grandTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  ` : ''}

  <!-- Footer -->
  <div style="display:flex;justify-content:space-between;font-size:10px;color:${mid};font-family:'Nunito Sans',sans-serif;padding-top:8px;border-top:1px solid ${border}">
    <span>xTimeBox  |  Generated ${new Date().toLocaleDateString('en-GB')}</span>
    <span>${escapeHtml(projectName)} - ${escapeHtml(monthLabel)}</span>
  </div>
</div>`
}

/**
 * Export the Monthly Project Report as a PDF using html2canvas for real font rendering.
 */
export async function exportMonthlyProjectPDF(data) {
  const { jsPDF, html2canvas } = await ensureLibs()

  // Create a temporary off-screen container with the styled HTML
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.innerHTML = buildReportHTML(data)
  document.body.appendChild(container)

  // Wait a tick for fonts to apply to the new DOM elements
  await new Promise(r => setTimeout(r, 100))

  try {
    const canvas = await html2canvas(container.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    // A4 landscape dimensions in mm
    const pageW = 297
    const pageH = 210
    const margin = 8
    const contentW = pageW - margin * 2
    const contentH = pageH - margin * 2

    // Calculate how the canvas fits on pages
    const imgW = contentW
    const imgH = (canvas.height / canvas.width) * imgW
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    if (imgH <= contentH) {
      // Fits on one page
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH)
    } else {
      // Multi-page: slice the canvas
      const pageCanvasHeight = (contentH / imgH) * canvas.height
      let srcY = 0
      let page = 0

      while (srcY < canvas.height) {
        if (page > 0) doc.addPage()
        const sliceH = Math.min(pageCanvasHeight, canvas.height - srcY)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceH
        const ctx = sliceCanvas.getContext('2d')
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
        const destH = (sliceH / canvas.width) * imgW
        doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, destH)
        srcY += pageCanvasHeight
        page++
      }
    }

    const { projectName, monthLabel } = data
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}_${monthLabel.replace(' ', '-')}.pdf`
    doc.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}
