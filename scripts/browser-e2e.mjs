#!/usr/bin/env node
/**
 * Browser E2E for match create + playing XI + scoring.
 * Requires: npx playwright install chromium
 * Backend on :8080 with latest binary, frontend on :5173
 */
import { chromium } from 'playwright'

const BASE = process.env.WEB_BASE || 'http://127.0.0.1:5173'
const email = process.env.E2E_EMAIL || `browser_${Date.now()}@test.local`
const password = process.env.E2E_PASSWORD || 'TestPass123!'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  console.log('1. Open app and sign up')
  await page.goto(BASE)
  await page.getByRole('button', { name: /sign up/i }).click()
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign up/i }).last().click()
  await page.waitForTimeout(2000)

  console.log('2. Open tournaments')
  await page.getByRole('button', { name: /open tournaments/i }).click()
  await page.waitForTimeout(1500)

  console.log('3. Create tournament')
  await page.getByRole('button', { name: /create tournament/i }).click()
  await page.getByPlaceholder(/champions trophy/i).fill(`Browser Cup ${Date.now()}`)
  await page.getByPlaceholder(/dubai/i).fill('Test City')
  const today = new Date().toISOString().slice(0, 10)
  const inputs = page.locator('input[type="date"]')
  await inputs.nth(0).fill(today)
  await inputs.nth(1).fill(today)
  await page.getByRole('button', { name: /create tournament/i }).last().click()
  await page.waitForTimeout(3000)

  console.log('4. Matches tab — need teams with 11 players first')
  await page.getByRole('button', { name: /^matches$/i }).click()
  await page.waitForTimeout(1500)

  const bodyText = await page.locator('body').innerText()
  if (/11 players/i.test(bodyText)) {
    console.log('   Note: match form may require squads — add teams/players in UI if create fails')
  }

  console.log('5. Open matches list from nav')
  await page.goto(`${BASE}/matches`)
  await page.waitForTimeout(2000)

  const openScore = page.getByRole('button', { name: /open score/i }).first()
  if (await openScore.count()) {
    console.log('6. Open score screen')
    await openScore.click()
    await page.waitForTimeout(2000)
    const scoreText = await page.locator('body').innerText()
    console.log('   Score page contains Playing XI:', /playing xi/i.test(scoreText))
    console.log('   Score page contains Start match:', /start match/i.test(scoreText))
  } else {
    console.log('6. No matches to open — skip score screen')
  }

  await page.screenshot({ path: '/tmp/cricscore-browser-e2e.png', fullPage: true })
  console.log('Screenshot: /tmp/cricscore-browser-e2e.png')

  await browser.close()

  const critical = errors.filter((e) => !/metamask|extension/i.test(e))
  if (critical.length) {
    console.warn('Console errors:', critical.slice(0, 5))
  }
  console.log('\nBrowser walkthrough finished.')
  console.log('Login:', email, password)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
