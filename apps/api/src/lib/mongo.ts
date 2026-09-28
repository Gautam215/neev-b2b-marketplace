import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { MongoClient, type Collection, type Db } from 'mongodb'
import { env } from '../config/env.js'

const algorithm = 'aes-256-gcm'
const ivBytes = 12
const collectionNamePattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

export type EncryptedMongoDocument = {
  _id: string
  version: 1
  iv: string
  authTag: string
  ciphertext: string
  createdAt: Date
  updatedAt: Date
}

function assertKey(key: Buffer) {
  if (key.length !== 32) throw new Error('MongoDB encryption key must be exactly 32 bytes')
}

export function decodeMongoEncryptionKey(encoded = env.MONGODB_ENCRYPTION_KEY): Buffer {
  if (!encoded) throw new Error('MONGODB_ENCRYPTION_KEY is required for encrypted MongoDB data')
  const key = Buffer.from(encoded, 'base64')
  assertKey(key)
  return key
}

export function encryptMongoDocument(value: unknown, key: Buffer = decodeMongoEncryptionKey()) {
  assertKey(key)
  const iv = randomBytes(ivBytes)
  const cipher = createCipheriv(algorithm, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return {
    version: 1 as const,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function decryptMongoDocument<T>(document: Pick<EncryptedMongoDocument, 'version' | 'iv' | 'authTag' | 'ciphertext'>, key: Buffer = decodeMongoEncryptionKey()): T {
  assertKey(key)
  if (document.version !== 1) throw new Error('Unsupported MongoDB encrypted document version')
  const decipher = createDecipheriv(algorithm, key, Buffer.from(document.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(document.authTag, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(document.ciphertext, 'base64')), decipher.final()])
  return JSON.parse(plaintext.toString('utf8')) as T
}

let client: MongoClient | undefined
let database: Db | undefined

export const isMongoConfigured = () => Boolean(env.MONGODB_URL)

export async function connectMongo() {
  if (!env.MONGODB_URL || client) return
  decodeMongoEncryptionKey()
  const nextClient = new MongoClient(env.MONGODB_URL, {
    maxPoolSize: env.MONGODB_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })
  await nextClient.connect()
  client = nextClient
  database = nextClient.db(env.MONGODB_DATABASE)
}

export async function pingMongo() {
  if (!env.MONGODB_URL) return
  if (!database) throw new Error('MongoDB is not connected')
  await database.command({ ping: 1 })
}

export async function closeMongo() {
  const currentClient = client
  client = undefined
  database = undefined
  if (currentClient) await currentClient.close()
}

function encryptedCollection(name: string): Collection<EncryptedMongoDocument> {
  if (!collectionNamePattern.test(name)) throw new Error('Invalid encrypted MongoDB collection name')
  if (!database) throw new Error('MongoDB is not connected')
  return database.collection<EncryptedMongoDocument>(name)
}

export async function putEncryptedMongoDocument(collectionName: string, id: string, value: unknown) {
  const now = new Date()
  const encrypted = encryptMongoDocument(value)
  await encryptedCollection(collectionName).updateOne(
    { _id: id },
    { $set: { ...encrypted, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
}

export async function getEncryptedMongoDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const document = await encryptedCollection(collectionName).findOne({ _id: id })
  return document ? decryptMongoDocument<T>(document) : null
}
