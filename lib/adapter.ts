import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { SocketOptions } from './interface';
import { closeRedis } from './utils';

/**
 * Socket.IO adapter that uses `@socket.io/redis-adapter`, so events sent with
 * `server.emit()` / `server.to(room).emit()` reach clients on every app instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;

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

    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  /** Called by Nest on `app.close()`, after the Socket.IO servers are closed. */
  async dispose(): Promise<void> {
    await super.dispose();
    await Promise.all([closeRedis(this.pubClient), closeRedis(this.subClient)]);
  }
}
