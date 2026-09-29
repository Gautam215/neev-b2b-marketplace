import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { env } from '../config/env.js'
import { logger } from './logger.js'
import { prisma } from './prisma.js'
import { userMatchesAccessToken, verifyAccessToken } from '../middleware/auth.js'

let socketServer: WebSocketServer | undefined
const socketOrganizations = new Map<WebSocket, { organizationId: string; userId: string; isAlive: boolean }>()

export function attachRealtime(server: Server) {
  socketServer = new WebSocketServer({ server, path: '/ws', maxPayload: env.MAX_WS_MESSAGE_BYTES })
  socketServer.on('connection', async (socket, request) => {
    const headerToken = typeof request.headers.authorization === 'string' && request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : undefined
    const protocolHeader = request.headers['sec-websocket-protocol']
    const protocolValues = typeof protocolHeader === 'string' ? protocolHeader.split(',').map((value) => value.trim()) : []
    const protocolToken = protocolValues[0] === 'bearer' ? protocolValues[1] : undefined
    const token = headerToken ?? protocolToken
    try {
      if (!token) throw new Error('missing token')
      const claims = verifyAccessToken(token)
      if (env.AUTH_REQUIRE_USER_LOOKUP) {
        const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, organizationId: true, roles: true, isActive: true } })
        if (!user || !userMatchesAccessToken(claims, user)) throw new Error('user is not active')
      }
      socketOrganizations.set(socket, { organizationId: claims.organizationId, userId: claims.sub, isAlive: true })
      socket.send(JSON.stringify({ type: 'connected', organizationId: claims.organizationId }))
    } catch {
      logger.warn({ event: 'security.websocket_rejected', remoteAddress: request.socket.remoteAddress }, 'websocket authentication rejected')
      socket.close(1008, 'Authentication required')
      return
    }
    socket.on('pong', () => {
      const state = socketOrganizations.get(socket)
      if (state) state.isAlive = true
    })
    socket.on('error', (error) => logger.warn({ err: error, event: 'websocket.error' }, 'websocket error'))
    socket.on('close', () => socketOrganizations.delete(socket))
  })
  const heartbeat = setInterval(() => {
    for (const socket of socketServer?.clients ?? []) {
      const state = socketOrganizations.get(socket)
      if (!state) continue
      if (!state.isAlive) {
        socket.terminate()
        socketOrganizations.delete(socket)
        continue
      }
      state.isAlive = false
      socket.ping()
    }
  }, 30_000)
  heartbeat.unref()
  socketServer.on('close', () => clearInterval(heartbeat))
  logger.info('websocket realtime server attached at /ws')
}

export function publish(organizationId: string, type: string, data: unknown) {
  if (!socketServer) return
  const message = JSON.stringify({ type, data })
  for (const socket of socketServer.clients) {
    if (socket.readyState === WebSocket.OPEN && socketOrganizations.get(socket)?.organizationId === organizationId) socket.send(message)
  }
}
