import {
  formatArchiveDatePath,
  parseDateFromFilename,
  resolveArchiveDateParts,
  shouldUseContentArchiveDate,
} from '../src/utils/archiveDate.ts'

const now = new Date(2026, 7, 25)
const cases: Array<[string, string | null]> = [
  ['IMG_20260315_120001.jpg', '2026/03/15'],
  ['photo-2026-03-15.jpg', '2026/03/15'],
  ['截图2026年3月15日.png', '2026/03/15'],
  ['2026_03_15_vacation.webp', '2026/03/15'],
  ['2026.03.15.gif', '2026/03/15'],
  ['shot-20260315120001.jpg', '2026/03/15'],
  ['2026-03-15_12-30-00.jpeg', '2026/03/15'],
  ['IMG_20991231.jpg', null],
  ['no-date.png', null],
  ['report.pdf', null],
]

let failed = 0
for (const [name, expect] of cases) {
  const parsed = parseDateFromFilename(name, now)
  const path = parsed ? formatArchiveDatePath(parsed) : null
  const ok = path === expect
  if (!ok) failed += 1
  console.log(ok ? 'OK' : 'FAIL', name, '=>', path, 'expect', expect)
}

console.log('image jpg', shouldUseContentArchiveDate('a.jpg'), 'pdf', shouldUseContentArchiveDate('a.pdf'))
console.log('resolve img', resolveArchiveDateParts({ filename: 'IMG_20260315.jpg', now }))
console.log('resolve pdf', resolveArchiveDateParts({ filename: 'a.pdf', now }))

if (failed > 0) {
  console.error(`failed: ${failed}`)
  process.exit(1)
}
console.log('all passed')
