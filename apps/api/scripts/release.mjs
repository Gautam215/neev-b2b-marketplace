import { spawn } from 'node:child_process'

const timeoutMs = Number(process.env.RELEASE_TIMEOUT_MS ?? process.env.STARTUP_TIMEOUT_MS ?? 120_000)
const command = (name) => process.platform === 'win32' ? `${name}.cmd` : name

function run(name, args, label, limit = timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command(name), args, { stdio: 'inherit', env: process.env })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${label} timed out after ${limit}ms`))
    }, limit)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`${label} failed${signal ? ` with ${signal}` : ` with exit code ${code ?? 'unknown'}`}`))
    })
  })
}

async function waitForReady(port, limit = timeoutMs) {
  const deadline = Date.now() + limit
  let lastError = 'health endpoint did not respond'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`, { signal: AbortSignal.timeout(5_000) })
      const body = await response.json()
      if (response.ok && body.status === 'ready') return
      lastError = `health status ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`release health check failed: ${lastError}`)
}

let server
let stopping = false

async function stop(code) {
  if (stopping) return
  stopping = true
  if (server && !server.killed) {
    server.kill('SIGTERM')
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000))
      server.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    if (!server.killed) server.kill('SIGKILL')
  }
  process.exit(code)
}

async function main() {
  // Importing the compiled config validates all required variables before any write.
  const { env } = await import('../dist/config/env.js')
  await run('node_modules/.bin/prisma', ['migrate', 'deploy'], 'Prisma migration')
  if (env.SEED_ON_START) await run('node_modules/.bin/tsx', ['scripts/seed-mongoose.ts'], 'MongoDB seed', env.SEED_TIMEOUT_MS)

  server = spawn(process.execPath, ['dist/server.js'], { stdio: 'inherit', env: process.env })
  server.once('exit', (code) => {
    if (!stopping) process.exit(code ?? 1)
  })
  await waitForReady(env.PORT, env.STARTUP_TIMEOUT_MS)
  console.log('Release checks passed; API is ready')
}

process.once('SIGTERM', () => void stop(0))
process.once('SIGINT', () => void stop(0))

main().catch(async (error) => {
  console.error(`Release failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  await stop(1)
})
