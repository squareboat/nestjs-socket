import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { SocketOptions } from './interface';
import { closeRedis, isClosing } from './utils';

const logger = new Logger('RedisIoAdapter');

/** Commands @socket.io/redis-adapter sends without handling the returned promise. */
const UNHANDLED_COMMANDS = ['publish', 'subscribe', 'psubscribe', 'unsubscribe', 'punsubscribe'];

/**
 * Socket.IO adapter that uses `@socket.io/redis-adapter`, so events sent with
 * `server.emit()` / `server.to(room).emit()` reach clients on every app instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;
  private readonly servers = new Set<any>();

  constructor(
    private readonly config: SocketOptions,
    app: any,
  ) {
    super(app);
  }

  /** Create the publisher and subscriber connections. Call it before `app.useWebSocketAdapter()`. */
  async connectToRedis(): Promise<void> {
    const pubClient = new Redis({ ...this.config.pubRedis });
    const subClient = new Redis({ ...this.config.subRedis });

    await Promise.allSettled([pubClient.connect(), subClient.connect()]);

    handleCommandErrors(pubClient);
    handleCommandErrors(subClient);
    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient, this.config.adapterOptions);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    this.servers.add(server);
    return server;
  }

  /** Called by Nest on `app.close()`, after the Socket.IO servers are closed. */
  async dispose(): Promise<void> {
    // With forceCloseConnections, Nest does not close the servers and the sockets would
    // disconnect later, after Redis is closed. Disconnect this instance's sockets now, so
    // handleDisconnect() runs while Redis is still up.
    for (const server of this.servers) disconnectLocalSockets(server);
    this.servers.clear();
    await super.dispose();
    await Promise.all([closeRedis(this.pubClient), closeRedis(this.subClient)]);
  }
}

function disconnectLocalSockets(server: any): void {
  const namespaces = server?._nsps instanceof Map ? [...server._nsps.values()] : [];
  for (const nsp of namespaces) nsp.local?.disconnectSockets(true);
}

/**
 * The Redis adapter ignores the promises of these commands, so a failure (Redis down, or
 * a broadcast after app.close()) would be an unhandled rejection that ends the process.
 */
function handleCommandErrors(client: Redis): void {
  let warnedClosed = false;
  for (const name of UNHANDLED_COMMANDS) {
    const command = (client as any)[name];
    if (typeof command !== 'function') continue;
    (client as any)[name] = function (this: Redis, ...args: unknown[]) {
      const result = command.apply(this, args);
      if (result && typeof result.catch === 'function') {
        result.catch((err: Error) => {
          if (!isClosing(client)) {
            logger.error(`Redis ${name} failed: ${err?.message ?? err}`);
          } else if (!warnedClosed) {
            warnedClosed = true;
            logger.warn(`Redis ${name} after the app was closed: the Redis connection is closed, so it is dropped`);
          }
        });
      }
      return result;
    };
  }
}
