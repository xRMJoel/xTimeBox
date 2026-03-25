#!/usr/bin/env node
/**
 * Download static TTF font files from Google Fonts for PDF export.
 * Run once: node scripts/download-pdf-fonts.mjs
 *
 * Uses a legacy User-Agent to request TTF format from the Google Fonts CSS API,
 * then parses the CSS to discover the font file URLs and downloads them.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'fonts')

// User-agent that triggers TTF format from Google Fonts
const TTF_UA = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)'

const FONTS = [
  {
    css: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap',
    files: {
      'Montserrat-Regular.ttf': { weight: '400' },
      'Montserrat-Bold.ttf': { weight: '700' },
    },
  },
  {
    css: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700&display=swap',
    files: {
      'NunitoSans-Regular.ttf': { weight: '400' },
      'NunitoSans-Bold.ttf': { weight: '700' },
    },
  },
]

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  for (const font of FONTS) {
    console.log(`Fetching CSS: ${font.css}`)
    const cssRes = await fetch(font.css, { headers: { 'User-Agent': TTF_UA } })
    const css = await cssRes.text()

    // Parse @font-face blocks
    const blocks = css.match(/@font-face\s*\{[^}]+\}/g) || []

    for (const [filename, { weight }] of Object.entries(font.files)) {
      // Find the block matching this weight
      const block = blocks.find((b) => b.includes(`font-weight: ${weight}`))
      if (!block) {
        console.warn(`  Could not find weight ${weight} in CSS for ${filename}`)
        continue
      }

      // Extract the URL
      const urlMatch = block.match(/url\(([^)]+)\)/)
      if (!urlMatch) {
        console.warn(`  No URL found in block for ${filename}`)
        continue
      }
      const url = urlMatch[1]
      console.log(`  Downloading ${filename} from ${url}`)

      const fontRes = await fetch(url)
      const buf = Buffer.from(await fontRes.arrayBuffer())
      const outPath = join(OUT_DIR, filename)
      writeFileSync(outPath, buf)
      console.log(`  Saved ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`)
    }
  }

  console.log('\nDone! Fonts saved to public/fonts/')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
