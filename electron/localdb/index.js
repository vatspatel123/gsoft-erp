// Local mode: the shop's database runs on this PC (fast, works without internet) and a
// copy goes to the cloud a few times a day. Off until switched on in Settings.
//
//   this PC:  Postgres (port 54329) -> PostgREST (54330) -> api.js (54321, looks like Supabase)
//   cloud:    gets every changed row (local_sync.changes) on the backup timer / "Sync now" / quit.
const { app, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const http = require('http')
const { spawn, execFile } = require('child_process')
const { Client } = require('pg')
const api = require('./api')

// ponytail: one shop, one cloud project. Not a secret (the password is asked for and kept encrypted).
const CLOUD = { host: 'aws-1-ap-south-1.pooler.supabase.com', port: 5432, database: 'postgres', user: 'postgres.cogrniduhhoeepdkesjx' }
const PG_PORT = 54329, REST_PORT = 54330, API_PORT = 54321
const BACKUP_EVERY_MS = 4 * 60 * 60 * 1000   // 2-3 backups in a shop day, plus one on start and one on close
const isWin = process.platform === 'win32'
// A test build (package.json "localdbTestBuild": true) never writes to the cloud: for trying
// local mode on another PC while the shop keeps working on the cloud.
const TEST_BUILD = (() => { try { return require('../../package.json').localdbTestBuild === true } catch { return false } })()

const root = () => path.join(app.getPath('userData'), 'localdb')
const dataDir = () => path.join(root(), 'pgdata')
const cfgFile = () => path.join(root(), 'config.json')
const keyFile = () => path.join(root(), 'cloud.key')
const exe = (n) => n + (isWin ? '.exe' : '')
const pgBin = (n) => app.isPackaged ? path.join(process.resourcesPath, 'localdb', 'pgsql', 'bin', exe(n))
  : path.join(process.env.LOCALDB_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin', n)
const restBin = () => app.isPackaged ? path.join(process.resourcesPath, 'localdb', exe('postgrest'))
  : (process.env.LOCALDB_POSTGREST || '/opt/homebrew/bin/postgrest')
const env = () => ({ ...process.env, ...(isWin ? {} : { LC_ALL: 'en_US.UTF-8' }) })

function readCfg() { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } catch { return {} } }
function writeCfg(patch) {
  const next = { ...readCfg(), ...patch }
  fs.mkdirSync(root(), { recursive: true })
  fs.writeFileSync(cfgFile() + '.tmp', JSON.stringify(next, null, 1))
  fs.renameSync(cfgFile() + '.tmp', cfgFile())
  return next
}

function run(file, args) {
  return new Promise((ok, fail) => execFile(file, args, { env: env(), windowsHide: true, timeout: 120000 }, (err, stdout, stderr) => {
    if (!err) return ok(stdout)
    // 0xC0000135: Windows could not find a DLL, almost always the Microsoft Visual C++ runtime.
    if (err.code === 3221225781 || err.code === -1073741515) return fail(new Error('This PC needs the free "Microsoft Visual C++ Redistributable (x64)" from microsoft.com. Install it, then try again.'))
    fail(new Error(`${path.basename(file)}: ${(stderr || stdout || err.message).toString().trim().slice(-600)}`))
  }))
}

const localPg = (db = 'shop') => new Client({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', password: readCfg().pgPassword, database: db })
// LOCALDB_TEST_CLOUD: tests point the backup at a throwaway database, never the shop's.
const cloudPg = (password) => new Client(process.env.LOCALDB_TEST_CLOUD && !app.isPackaged
  ? { ...JSON.parse(process.env.LOCALDB_TEST_CLOUD), password }
  : { ...CLOUD, password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
async function withPg(client, fn) { client.on('error', () => {}); await client.connect(); try { return await fn(client) } finally { await client.end().catch(() => {}) } }

function saveCloudPassword(pw) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows could not protect the password on this PC')
  fs.writeFileSync(keyFile(), safeStorage.encryptString(pw))
}
function cloudPassword() {
  try { return safeStorage.decryptString(fs.readFileSync(keyFile())) } catch { return null }
}

// ---------- start / stop ----------
let rest = null, apiServer = null, running = false, timer = null

async function pgRunning() {
  try { await run(pgBin('pg_ctl'), ['status', '-D', dataDir()]); return true } catch { return false }
}
async function startPg() {
  if (!(await pgRunning())) await run(pgBin('pg_ctl'), ['start', '-w', '-t', '60', '-D', dataDir(), '-l', path.join(root(), 'postgres.log')])
}
function waitHttp(url, ms) {
  const until = Date.now() + ms
  return new Promise((ok, fail) => {
    const tryOnce = () => http.get(url, (r) => { r.resume(); ok() }).on('error', () =>
      Date.now() > until ? fail(new Error('the local database service did not start')) : setTimeout(tryOnce, 300))
    tryOnce()
  })
}
// Database changes shipped with an update (the same SQL the owner runs in the cloud), applied
// once on this PC's copy. File names sort in date order.
async function migrate(local) {
  await local.query('create table if not exists local_sync.migrations (name text primary key, at timestamptz not null default now())')
  const dir = path.join(__dirname, 'migrations')
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if ((await local.query('select 1 from local_sync.migrations where name = $1', [f])).rowCount) continue
    await local.query('begin')
    try {
      await local.query(fs.readFileSync(path.join(dir, f), 'utf8'))
      await local.query('insert into local_sync.migrations (name) values ($1)', [f])
      await local.query('commit')
    } catch (e) { await local.query('rollback').catch(() => {}); throw new Error(`Update ${f} could not be applied: ${e.message}`) }
  }
}

async function startServices() {
  const cfg = readCfg()
  await startPg()
  await withPg(localPg(), migrate)
  if (!rest) {
    const conf = path.join(root(), 'postgrest.conf')
    fs.writeFileSync(conf, [
      `db-uri = "postgres://authenticator:${cfg.pgPassword}@127.0.0.1:${PG_PORT}/shop"`,
      'db-schemas = "public,local_auth"', 'db-anon-role = "anon"', `jwt-secret = "${cfg.secret}"`,
      `server-port = ${REST_PORT}`, 'server-host = "127.0.0.1"', 'db-pool = 10'].join('\n'))
    rest = spawn(restBin(), [conf], { env: env(), windowsHide: true, stdio: 'ignore' })
    rest.on('exit', () => { rest = null })
  }
  await waitHttp(`http://127.0.0.1:${REST_PORT}/`, 30000)
  if (!apiServer) apiServer = api.start({ port: API_PORT, restUrl: `http://127.0.0.1:${REST_PORT}`, secret: cfg.secret })
  running = true
}

async function stop() {
  if (timer) { clearInterval(timer); timer = null }
  if (apiServer) { apiServer.close(); apiServer = null }
  if (rest) { rest.kill(); rest = null }
  // Postgres must be told to stop (not killed) so nothing is half-written, and so an
  // update can replace its files.
  if (fs.existsSync(dataDir()) && (await pgRunning())) await run(pgBin('pg_ctl'), ['stop', '-w', '-m', 'fast', '-D', dataDir()]).catch(() => {})
  running = false
}

/** Called before the window opens. Null = cloud mode (nothing to start). */
async function boot() {
  const cfg = readCfg()
  if (!cfg.enabled) return null
  await startServices()
  setTimeout(() => sync().catch(() => {}), 2 * 60 * 1000)
  timer = setInterval(() => sync().catch(() => {}), BACKUP_EVERY_MS)
  return rendererConfig()
}

function rendererConfig() {
  const cfg = readCfg()
  if (!cfg.enabled || !running) return null
  return { url: `http://127.0.0.1:${API_PORT}`, anonKey: api.sign({ role: 'anon', iss: 'local', exp: 4102444800 }) }
}

// ---------- copying ----------
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"'

async function columns(c, schema, table) {
  const { rows } = await c.query(
    `select column_name from information_schema.columns where table_schema = $1 and table_name = $2 and is_generated = 'NEVER' order by ordinal_position`, [schema, table])
  return rows.map(r => r.column_name)
}
async function cloudTables(c) {
  const { rows } = await c.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)
  return [['auth', 'users'], ['auth', 'identities'], ...rows.map(r => ['public', r.table_name])]
}
/** Same rows, same values: count + a fingerprint of every row's text (over the columns both sides have). */
async function fingerprint(c, schema, table, cols) {
  const row = `row(${cols.map(x => 't.' + q(x)).join(',')})::text`
  const { rows } = await c.query(`select count(*)::int n, md5(coalesce(string_agg(${row}, '|' order by ${row}), '')) h from ${q(schema)}.${q(table)} t`)
  return rows[0]
}

/** Copies the cloud database to this PC and checks every table. Cloud is only read. */
async function setup(password, progress = () => {}) {
  if (readCfg().enabled) throw new Error('This PC already runs the shop database')
  if (!fs.existsSync(pgBin('pg_ctl'))) throw new Error('The local database files are missing from this install')
  progress('Checking the cloud connection…')
  await withPg(cloudPg(password), c => c.query('select 1'))

  await stop()
  fs.rmSync(dataDir(), { recursive: true, force: true })
  fs.mkdirSync(root(), { recursive: true })
  const pgPassword = crypto.randomBytes(18).toString('hex')
  writeCfg({ enabled: false, pgPassword, secret: crypto.randomBytes(32).toString('hex') })
  const pwFile = path.join(root(), 'pw.tmp')
  try {
    progress('Creating the database on this PC…')
    fs.writeFileSync(pwFile, pgPassword)
    await run(pgBin('initdb'), ['-D', dataDir(), '-U', 'postgres', '-E', 'UTF8', '--auth=scram-sha-256', `--pwfile=${pwFile}`,
      '--locale-provider=icu', '--icu-locale=en-US', '--locale=C', '--no-instructions'])
    fs.appendFileSync(path.join(dataDir(), 'postgresql.conf'),
      `\nport = ${PG_PORT}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\nmax_connections = 40\ntimezone = 'Asia/Kolkata'\n`)
    await startPg()
    await withPg(localPg('postgres'), c => c.query('create database shop'))
    await withPg(localPg(), async (local) => {
      await local.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
      await migrate(local)
      await local.query(`alter role authenticator password '${pgPassword}'`)

      await withPg(cloudPg(password), async (cloud) => {
        await cloud.query(`begin read only isolation level repeatable read; set local timezone = 'UTC'`)
        await local.query(`set timezone = 'UTC'`)
        const tables = await cloudTables(cloud)
        let i = 0
        for (const [schema, table] of tables) {
          progress(`Copying ${table} (${++i}/${tables.length})…`)
          const cloudCols = new Set(await columns(cloud, schema, table))
          const cols = (await columns(local, schema, table)).filter(c => cloudCols.has(c))
          const { rows } = await cloud.query(`select coalesce(json_agg(t), '[]')::text j from ${q(schema)}.${q(table)} t`)
          const list = cols.map(q).join(',')
          await local.query('begin; set local session_replication_role = replica')
          await local.query(`insert into ${q(schema)}.${q(table)} (${list}) select ${list} from json_populate_recordset(null::${q(schema)}.${q(table)}, $1::json)`, [rows[0].j])
          await local.query('commit')
        }
        progress('Checking every table against the cloud…')
        const wrong = []
        for (const [schema, table] of tables) {
          const cloudCols = new Set(await columns(cloud, schema, table))
          const cols = (await columns(local, schema, table)).filter(c => cloudCols.has(c))
          const [a, b] = [await fingerprint(cloud, schema, table, cols), await fingerprint(local, schema, table, cols)]
          if (a.n !== b.n || a.h !== b.h) wrong.push(`${table} (cloud ${a.n}, this PC ${b.n})`)
        }
        await cloud.query('rollback')
        if (wrong.length) throw new Error('Copy did not match the cloud: ' + wrong.join(', '))
      })
      await local.query('truncate local_sync.changes')
    })
    saveCloudPassword(password)
    writeCfg({ enabled: true, since: new Date().toISOString(), lastSync: new Date().toISOString(), lastSyncError: null })
    progress('Done')
  } catch (e) {
    await stop()
    fs.rmSync(dataDir(), { recursive: true, force: true })
    writeCfg({ enabled: false })
    throw e
  } finally {
    fs.rmSync(pwFile, { force: true })
  }
}

// ---------- backup to the cloud ----------
let syncing = null
/** Sends every row changed on this PC to the cloud: added and edited rows are written as they
 *  are here, rows deleted here are deleted there. One transaction: all or nothing. */
function sync() {
  if (!syncing) syncing = doSync().finally(() => { syncing = null })
  return syncing
}
async function doSync() {
  if (!readCfg().enabled || !running) return { ok: false, error: 'Local mode is off' }
  if (TEST_BUILD) return record({ ok: false, error: 'Test build: backup to the cloud is switched off on this PC' })
  const password = cloudPassword()
  if (!password) return record({ ok: false, error: 'Cloud password not saved on this PC' })
  try {
    return await withPg(localPg(), async (local) => {
      const { rows: [{ upto }] } = await local.query('select coalesce(max(id), 0)::bigint upto from local_sync.changes')
      const { rows: groups } = await local.query('select tbl, array_agg(distinct pk) pks from local_sync.changes where id <= $1 group by tbl', [upto])
      if (!groups.length) return record({ ok: true, sent: 0 })
      let sent = 0
      await withPg(cloudPg(password), async (cloud) => {
        await cloud.query(`begin; set local session_replication_role = replica; set local statement_timeout = '300s'`)
        try {
          for (const { tbl, pks } of groups) {
            const { rows: [k] } = await local.query(
              `select a.attname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
               where c.contype = 'p' and c.conrelid = ('public.' || quote_ident($1))::regclass`, [tbl])
            const key = k.attname
            const cloudCols = new Set(await columns(cloud, 'public', tbl))
            const cols = (await columns(local, 'public', tbl)).filter(c => cloudCols.has(c))
            const { rows: [d] } = await local.query(
              `select coalesce(json_agg(t), '[]')::text j, coalesce(array_agg(t.${q(key)}::text), '{}') present
               from public.${q(tbl)} t where t.${q(key)}::text = any($1)`, [pks])
            const list = cols.map(q).join(',')
            const set = cols.filter(c => c !== key).map(c => `${q(c)} = excluded.${q(c)}`).join(',')
            if (d.present.length) {
              await cloud.query(`insert into public.${q(tbl)} (${list}) select ${list} from json_populate_recordset(null::public.${q(tbl)}, $1::json)
                 on conflict (${q(key)}) do ${set ? 'update set ' + set : 'nothing'}`, [d.j])
            }
            const gone = pks.filter(p => !d.present.includes(p))
            if (gone.length) await cloud.query(`delete from public.${q(tbl)} where ${q(key)}::text = any($1)`, [gone])
            sent += pks.length
          }
          await cloud.query('commit')
        } catch (e) { await cloud.query('rollback').catch(() => {}); throw e }
      })
      await local.query('delete from local_sync.changes where id <= $1', [upto])
      return record({ ok: true, sent })
    })
  } catch (e) {
    return record({ ok: false, error: String(e.message || e) })
  }
}
function record(r) {
  writeCfg(r.ok ? { lastSync: new Date().toISOString(), lastSyncError: null } : { lastSyncError: r.error, lastSyncTry: new Date().toISOString() })
  return r
}

async function status() {
  const cfg = readCfg()
  let pending = null
  if (cfg.enabled && running) {
    try { pending = await withPg(localPg(), async c => (await c.query('select count(distinct (tbl, pk))::int n from local_sync.changes')).rows[0].n) } catch { /* shown as unknown */ }
  }
  return { available: fs.existsSync(pgBin('pg_ctl')), testBuild: TEST_BUILD, enabled: !!cfg.enabled, running, since: cfg.since || null,
    lastSync: cfg.lastSync || null, lastSyncError: cfg.lastSyncError || null, pending, syncing: !!syncing }
}

/** Back to cloud mode: only after everything is in the cloud. This PC's copy is kept as a backup folder. */
async function disable() {
  const r = TEST_BUILD ? { ok: true } : await sync()
  if (!r.ok) throw new Error('Backup to the cloud failed, so local mode stays on: ' + r.error)
  const s = await status()
  if (s.pending && !TEST_BUILD) throw new Error('Some changes are still waiting to go to the cloud. Try again.')
  await stop()
  const kept = path.join(root(), 'pgdata-' + new Date().toISOString().slice(0, 10) + '-' + Date.now())
  fs.renameSync(dataDir(), kept)
  writeCfg({ enabled: false })
}

module.exports = { boot, stop, sync, setup, status, disable, rendererConfig }
