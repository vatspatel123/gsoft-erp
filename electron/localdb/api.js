// Local stand-in for Supabase on the shop PC (local mode): /rest/v1 -> PostgREST, /auth/v1 -> local login.
// ponytail: no realtime yet (app keeps working; lists refresh on their own actions/timers). Add a LISTEN/NOTIFY feed if screens look stale.
const http = require('node:http')
const crypto = require('node:crypto')

let PORT, REST, SECRET, SERVICE

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
function sign(claims) {
  const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(claims)
  return head + '.' + crypto.createHmac('sha256', SECRET).update(head).digest('base64url')
}
function verify(tok) {
  const [h, p, s] = String(tok || '').split('.')
  if (!s) return null
  const good = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url')
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null
  const c = JSON.parse(Buffer.from(p, 'base64url').toString())
  return c.exp && c.exp < Date.now() / 1000 ? null : c
}

async function rpc(fn, args) {
  const r = await fetch(`${REST}/rpc/${fn}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}`, 'Content-Profile': 'local_auth', 'Accept-Profile': 'local_auth' },
  })
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`)
  return r.json()
}

const HOUR = 3600
function session(user) {
  const now = Math.floor(Date.now() / 1000)
  const base = { sub: user.id, email: user.email, aud: 'authenticated', app_metadata: user.app_metadata, user_metadata: user.user_metadata }
  return {
    access_token: sign({ ...base, role: 'authenticated', iat: now, exp: now + HOUR }),
    refresh_token: sign({ sub: user.id, typ: 'refresh', exp: now + 30 * 24 * HOUR }),
    token_type: 'bearer', expires_in: HOUR, expires_at: now + HOUR, user,
  }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Profile, Preference-Applied',
}
const send = (res, code, body) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)) }
const fail = (res, code, msg, extra = {}) => send(res, code, { error: extra.error || 'invalid_request', error_description: msg, msg, code, ...extra })
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })
const bearer = (req) => verify((req.headers.authorization || '').replace(/^Bearer /i, ''))

async function auth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '')
  const body = req.method === 'GET' ? {} : JSON.parse((await readBody(req)).toString() || '{}')
  if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
    const user = await rpc('login', { email: body.email || '', password: body.password || '' })
    return user ? send(res, 200, session(user)) : fail(res, 400, 'Invalid login credentials', { error: 'invalid_grant', error_code: 'invalid_credentials' })
  }
  if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const c = verify(body.refresh_token)
    const user = c?.typ === 'refresh' && await rpc('get_user', { uid: c.sub })
    return user ? send(res, 200, session(user)) : fail(res, 400, 'Invalid Refresh Token', { error: 'invalid_grant', error_code: 'refresh_token_not_found' })
  }
  const me = bearer(req)
  if (path === '/logout') return send(res, 204)
  if (path === '/user' && me?.sub) {
    if (req.method === 'GET') return send(res, 200, await rpc('get_user', { uid: me.sub }))
    if (req.method === 'PUT') {
      if (!body.password) return send(res, 200, await rpc('get_user', { uid: me.sub }))
      return send(res, 200, await rpc('set_password', { uid: me.sub, password: body.password }))
    }
  }
  if (path === '/user') return fail(res, 401, 'Not logged in', { error_code: 'no_authorization' })
  // recover / verify (forgot password by email) need the internet
  return fail(res, 503, 'Needs internet: this works only in cloud mode', { error_code: 'offline' })
}

async function rest(req, res, url) {
  const headers = { ...req.headers }
  delete headers.host; delete headers.apikey; delete headers['content-length']
  const claims = bearer(req)
  if (!claims) headers.authorization = `Bearer ${sign({ role: 'anon', exp: 4102444800 })}`
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req)
  const r = await fetch(REST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method, headers, body })
  const out = Buffer.from(await r.arrayBuffer())
  const h = { ...cors }
  r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(k)) h[k] = v })
  res.writeHead(r.status, h); res.end(out)
}

function start(opts) {
  PORT = opts.port; REST = opts.restUrl; SECRET = opts.secret
  SERVICE = sign({ role: 'service_role', iss: 'local', exp: 4102444800 })
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204)
    const url = new URL(req.url, 'http://x')
    try {
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url)
      if (url.pathname.startsWith('/rest/v1')) return await rest(req, res, url)
      return fail(res, 404, 'not found')
    } catch (e) {
      console.error(e)
      fail(res, 500, String(e.message || e))
    }
  }).listen(PORT, '127.0.0.1', () => console.log(`local database API on http://127.0.0.1:${PORT}`))
}

module.exports = { start, sign }
