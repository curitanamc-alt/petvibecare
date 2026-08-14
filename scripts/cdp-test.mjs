// Drives headless Chrome over CDP (node:global WebSocket) to verify the
// logged-in client portal and admin dashboard actually render.
// Usage: start `chrome --headless=new --remote-debugging-port=9222` first,
// then `node scripts/cdp-test.mjs`.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BASE = 'http://127.0.0.1:9333'

async function connect() {
  const targets = await (await fetch(`${BASE}/json`)).json()
  const page = targets.find((t) => t.type === 'page' && (t.url === 'about:blank' || t.url.startsWith('http://localhost:5173'))) || targets.find((t) => t.type === 'page')
  if (!page) throw new Error('No page target found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id
    pending.set(myId, res)
    ws.send(JSON.stringify({ id: myId, method, params }))
  })
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.result?.value
  }
  return { send, evalJs }
}

async function loginAndDump(label, role, email, password, url, needles) {
  const cdp = await connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' })
  await sleep(2500)
  // sign in through the real UI (native setter + input event so React state updates)
  await cdp.evalJs(`(() => {
    const setVal = (sel, val) => {
      const el = document.querySelector(sel)
      if (!el) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    const okE = setVal('input[type=email]', '${email}')
    const okP = setVal('input[type=password]', '${password}')
    document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    return okE && okP
  })()`)
  await sleep(3000)
  console.log('after login, path:', await cdp.evalJs('location.pathname'))
  // now on the portal/admin after redirect — navigate explicitly to the target page
  await cdp.send('Page.navigate', { url })
  await sleep(4000)
  const text = (await cdp.evalJs('document.body.innerText')) || ''
  const found = needles.map((n) => `${n}: ${text.includes(n) ? 'YES' : 'no'}`)
  console.log(`\n=== ${label} ===`)
  console.log(found.join('\n'))
  console.log('URL now:', await cdp.evalJs('location.pathname'))
  console.log('--- page text (first 400 chars) ---')
  console.log(text.replace(/\s+/g, ' ').slice(0, 400))
}

// client portal
await loginAndDump(
  'CLIENT PORTAL /portal',
  'client', 'client@petvibe.ph', 'password123',
  'http://localhost:5173/portal',
  ['Welcome back', 'Bella', 'Mochi', 'Upcoming appointments', 'Book one now'],
)

// client bookings page
await loginAndDump(
  'CLIENT /portal/bookings',
  'client', 'client@petvibe.ph', 'password123',
  'http://localhost:5173/portal/bookings',
  ['My Bookings', 'PV-1001', 'Confirmed', 'No-show'],
)

// admin dashboard
await loginAndDump(
  'ADMIN /admin',
  'staff', 'admin@petvibe.ph', 'password123',
  'http://localhost:5173/admin',
  ['Good', 'Total pets', 'Today', 'Pending approvals', 'Walk-in / ER'],
)

// admin appointments
await loginAndDump(
  'ADMIN /admin/appointments',
  'staff', 'admin@petvibe.ph', 'password123',
  'http://localhost:5173/admin/appointments',
  ['Appointments', 'PV-1001', 'PV-1002', 'No-show', 'Confirm'],
)

process.exit(0)
