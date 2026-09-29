import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const keyLength = 64
const cost = 32_768
const blockSize = 8
const parallelization = 1

function encoded(value: Buffer) {
  return value.toString('base64url')
}

function decoded(value: string) {
  return Buffer.from(value, 'base64url')
}

function derive(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, derived) => {
      if (error) reject(error)
      else resolve(derived as Buffer)
    })
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = await derive(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${cost}$${blockSize}$${parallelization}$${encoded(salt)}$${encoded(derived)}`
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false
  const [algorithm, costValue, blockValue, parallelValue, saltValue, digestValue] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !costValue || !blockValue || !parallelValue || !saltValue || !digestValue) return false
  const parsedCost = Number(costValue)
  const parsedBlock = Number(blockValue)
  const parsedParallel = Number(parallelValue)
  if (!Number.isSafeInteger(parsedCost) || !Number.isSafeInteger(parsedBlock) || !Number.isSafeInteger(parsedParallel)) return false
  try {
    const expected = decoded(digestValue)
    const actual = await derive(password, decoded(saltValue), expected.length, { N: parsedCost, r: parsedBlock, p: parsedParallel, maxmem: 64 * 1024 * 1024 })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
