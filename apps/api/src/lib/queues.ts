import { Job, Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import { logger } from './logger.js'
import { processPaymentWebhook, processReconciliation } from './payment-webhook-processor.js'

export const queueNames = {
  paymentWebhooks: 'neev.payment-webhooks',
  reconciliation: 'neev.reconciliation',
} as const

export type PaymentWebhookJob = {
  gateway: string
  eventId: string
  eventType: 'payment.captured' | 'payment.failed'
  paymentIntentId: string
  orderId: string
  providerRef: string
  amount: number
  currency: 'INR'
  // Queue payloads cross a JSON boundary, so dates must be serialized.
  occurredAt: string
}

export type ReconciliationJob = { orderId: string }

const queueOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { age: 86_400, count: 1000 },
  removeOnFail: { age: 604_800, count: 5000 },
}

let paymentWebhookQueue: Queue<PaymentWebhookJob, unknown, string> | undefined
let reconciliationQueue: Queue<ReconciliationJob, unknown, string> | undefined
let workers: Worker[] = []

function createConnection() {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

function getPaymentWebhookQueue() {
  return paymentWebhookQueue ??= new Queue<PaymentWebhookJob, unknown, string>(queueNames.paymentWebhooks, { connection: createConnection(), defaultJobOptions: queueOptions })
}

function getReconciliationQueue() {
  return reconciliationQueue ??= new Queue<ReconciliationJob, unknown, string>(queueNames.reconciliation, { connection: createConnection(), defaultJobOptions: queueOptions })
}

async function addOnce<T>(queue: Queue<T, unknown, string>, name: string, data: T, jobId: string) {
  const existing = await queue.getJob(jobId)
  return existing ?? queue.add(name as never, data as never, { jobId })
}

export function paymentWebhookJobId(data: Pick<PaymentWebhookJob, 'gateway' | 'eventId'>) {
  return `payment:${data.gateway}:${data.eventId}`
}

export function reconciliationJobId(orderId: string) {
  return `reconcile:${orderId}`
}

export function enqueuePaymentWebhook(data: PaymentWebhookJob) {
  return addOnce(getPaymentWebhookQueue(), 'process-payment-webhook', data, paymentWebhookJobId(data))
}

export function enqueueReconciliation(orderId: string) {
  return addOnce(getReconciliationQueue(), 'reconcile-order', { orderId }, reconciliationJobId(orderId))
}

export function startQueueWorkers() {
  if (workers.length > 0) return
  const paymentWorker = new Worker<PaymentWebhookJob>(queueNames.paymentWebhooks, (job) => processPaymentWebhook(job.data), { connection: createConnection(), concurrency: 5 })
  const reconciliationWorker = new Worker<ReconciliationJob>(queueNames.reconciliation, (job) => processReconciliation(job.data.orderId), { connection: createConnection(), concurrency: 2 })
  for (const worker of [paymentWorker, reconciliationWorker]) {
    worker.on('completed', (job) => logger.info({ jobId: job.id, queue: job.queueName }, 'background job completed'))
    worker.on('failed', (job, error) => logger.error({ err: error, jobId: job?.id, queue: job?.queueName }, 'background job failed'))
    worker.on('error', (error) => logger.error({ err: error }, 'background worker error'))
  }
  workers = [paymentWorker, reconciliationWorker]
  logger.info({ queues: Object.values(queueNames) }, 'background queue workers started')
}

export async function closeQueues() {
  const closing = [
    ...workers.map((worker) => worker.close()),
    ...(paymentWebhookQueue ? [paymentWebhookQueue.close()] : []),
    ...(reconciliationQueue ? [reconciliationQueue.close()] : []),
  ]
  await Promise.allSettled(closing)
  workers = []
  paymentWebhookQueue = undefined
  reconciliationQueue = undefined
}

export type QueueJob = Job<PaymentWebhookJob | ReconciliationJob>
