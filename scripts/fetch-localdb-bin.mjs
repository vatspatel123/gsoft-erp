// Downloads the Windows database programs the installer carries for local mode
// (Postgres + PostgREST) into localdb-bin/win. Skips the download when they are already there.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PG = '@embedded-postgres/windows-x64@17.11.0-beta.19'
const POSTGREST = 'https://github.com/PostgREST/postgrest/releases/download/v16.6/postgrest-v16.6-windows-x86-64.zip'
const out = path.resolve('localdb-bin/win')
const tmp = path.resolve('localdb-bin/tmp')
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

if (!fs.existsSync(path.join(out, 'pgsql/bin/postgres.exe'))) {
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
  sh('npm', ['pack', PG, '--silent'], tmp)
  const tgz = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'))
  sh('tar', ['-xzf', tgz], tmp)
  fs.mkdirSync(out, { recursive: true })
  fs.rmSync(path.join(out, 'pgsql'), { recursive: true, force: true })
  fs.renameSync(path.join(tmp, 'package/native'), path.join(out, 'pgsql'))
}
if (!fs.existsSync(path.join(out, 'postgrest.exe'))) {
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
  const res = await fetch(POSTGREST)
  if (!res.ok) throw new Error('PostgREST download failed: ' + res.status)
  fs.writeFileSync(path.join(tmp, 'pgrst.zip'), Buffer.from(await res.arrayBuffer()))
  sh('tar', ['-xf', 'pgrst.zip'], tmp)
  fs.renameSync(path.join(tmp, 'postgrest.exe'), path.join(out, 'postgrest.exe'))
}
fs.rmSync(tmp, { recursive: true, force: true })
// pgAdmin's window libraries and a test plug-in come in the package; the database doesn't use them.
for (const f of fs.readdirSync(path.join(out, 'pgsql/bin'))) if (/^wx|^testplug/.test(f)) fs.rmSync(path.join(out, 'pgsql/bin', f))
for (const f of ['pgsql/bin/postgres.exe', 'pgsql/bin/initdb.exe', 'pgsql/bin/pg_ctl.exe', 'pgsql/lib/pgcrypto.dll', 'postgrest.exe'])
  if (!fs.existsSync(path.join(out, f))) throw new Error('missing ' + f)
console.log('local database programs ready in', out)
