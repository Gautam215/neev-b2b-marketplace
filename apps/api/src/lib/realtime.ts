import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { logger } from './logger.js'

let socketServer: WebSocketServer | undefined
const socketOrganizations = new Map<WebSocket, { organizationId: string; isAlive: boolean }>()

export function attachRealtime(server: Server) {
  socketServer = new WebSocketServer({ server, path: '/ws', maxPayload: env.MAX_WS_MESSAGE_BYTES })
  socketServer.on('connection', (socket, request) => {
    const queryToken = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).searchParams.get('token')
    const headerToken = typeof request.headers.authorization === 'string' && request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : undefined
    const token = headerToken ?? queryToken
    try {
      if (!token) throw new Error('missing token')
      const claims = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { organizationId?: unknown; roles?: unknown }
      if (typeof claims.organizationId !== 'string' || !Array.isArray(claims.roles) || claims.roles.length === 0) throw new Error('incomplete access claims')
      socketOrganizations.set(socket, { organizationId: claims.organizationId, isAlive: true })
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
