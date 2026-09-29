import { describe, expect, it } from 'vitest'

const { hashPassword, verifyPassword } = await import('../src/lib/passwords.js')

describe('password credentials', () => {
  it('hashes passwords with a non-reversible encoded salt', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/)
    expect(hash).not.toContain('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects a wrong password and malformed credential', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('wrong password', hash)).toBe(false)
    expect(await verifyPassword('correct horse battery staple', 'not-a-scrypt-hash')).toBe(false)
  })
})
