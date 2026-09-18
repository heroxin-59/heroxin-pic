/**
 * Capture /images desktop + mobile for Impeccable finish review.
 * Uses system Chrome via playwright-core channel (no Chromium download).
 */
import { chromium } from 'playwright-core'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const outDir = path.join(root, '.impeccable', 'review')
const base = process.env.REVIEW_BASE || 'http://127.0.0.1:5173'
const prefix = process.env.REVIEW_PREFIX || 'file/'

async function readAccessPassword() {
  if (process.env.REVIEW_PASSWORD) return process.env.REVIEW_PASSWORD
  if (process.env.APP_ACCESS_PASSWORD) return process.env.APP_ACCESS_PASSWORD
  try {
    const env = await readFile(path.join(root, '.env.local'), 'utf8')
    const m = env.match(/^APP_ACCESS_PASSWORD=(.*)$/m)
    if (m) return m[1].trim()
  } catch {
    // ignore
  }
  return ''
}

function svgDataUrl(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 70% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 65% 48%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="32" y="64" fill="white" font-size="36" font-family="sans-serif">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function makeRecords() {
  const days = [
    { date: '2026-09-17', place: '上海 · 外滩', count: 4 },
    { date: '2026-09-12', place: '杭州 · 西湖', count: 3 },
    { date: '2026-08-30', place: '苏州', count: 5 },
  ]
  const records = []
  const places = []
  let n = 0
  for (const day of days) {
    for (let i = 0; i < day.count; i += 1) {
      n += 1
      const name = `${day.date.replaceAll('-', '')}_${String(i + 1).padStart(2, '0')}.jpg`
      const key = `${prefix}${day.date.replaceAll('-', '/')}/${name}`
      records.push({
        id: key,
        name,
        extension: 'jpg',
        mimeType: 'image/jpeg',
        category: 'image',
        size: 120000 + n * 1000,
        key,
        url: svgDataUrl(`demo ${n}`, 200 + n * 12),
        uploadedAt: `${day.date}T1${i}:00:00.000Z`,
      })
      places.push({ key, locationLabel: day.place })
    }
  }
  return { records, places }
}

async function unlockGate(page, password) {
  const gate = page.locator('.access-gate')
  if ((await gate.count()) === 0) return
  if (!password) {
    throw new Error('Access gate is on; set REVIEW_PASSWORD / APP_ACCESS_PASSWORD')
  }
  await page.fill('input[placeholder="访问口令"]', password)
  await page.click('button:has-text("进入")')
  await page.waitForSelector('.access-gate', { state: 'detached', timeout: 10000 })
}

async function seedPlaces(page, places) {
  await page.waitForFunction(() => typeof window.__seedAlbumMeta === 'function', null, {
    timeout: 10000,
  })
  await page.evaluate((placeList) => {
    window.__seedAlbumMeta(placeList.map((row) => ({ key: row.key, locationLabel: row.locationLabel })))
  }, places)
  // wait for spine place text
  await page.waitForSelector('.image-album__spine-place', { timeout: 5000 }).catch(() => {})
}

async function capture(page, viewport, file, places) {
  await page.setViewportSize(viewport)
  await page.goto(`${base}/images`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.image-album, .images-view__empty, .el-result', { timeout: 15000 })
  if ((await page.locator('.el-result').count()) > 0) {
    const retry = page.locator('button:has-text("重试")')
    if ((await retry.count()) > 0) {
      await retry.click()
      await page.waitForTimeout(1500)
    }
  }
  await seedPlaces(page, places)
  await page.waitForTimeout(600)
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      .el-message, .el-notification { display: none !important; }
      .image-album__tile { background: linear-gradient(145deg, #b3d2ff, #2f7dff) !important; }
      .image-album__tile img { opacity: 0.85; }
    `,
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: file, fullPage: true })
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const password = await readAccessPassword()
  const { records, places } = makeRecords()
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext()

  await context.addInitScript(
    ({ prefixKey, records }) => {
      const DB_NAME = 'heroxin-pic'
      const STORE = 'file-list-snapshots'
      const openReq = indexedDB.open(DB_NAME, 1)
      openReq.onupgradeneeded = () => {
        const db = openReq.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'prefix' })
        }
      }
      openReq.onsuccess = () => {
        const db = openReq.result
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({
          prefix: prefixKey.endsWith('/') ? prefixKey : `${prefixKey}/`,
          records,
          savedAt: new Date().toISOString(),
        })
        tx.oncomplete = () => db.close()
      }
    },
    { prefixKey: prefix, records },
  )

  const page = await context.newPage()
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await unlockGate(page, password)
  await page.waitForTimeout(400)

  await capture(page, { width: 1440, height: 900 }, path.join(outDir, 'desktop.png'), places)
  await capture(page, { width: 390, height: 844 }, path.join(outDir, 'mobile.png'), places)

  await browser.close()
  console.log('Wrote', path.join(outDir, 'desktop.png'), path.join(outDir, 'mobile.png'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
