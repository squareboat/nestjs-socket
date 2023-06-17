import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { SocketOptions } from "./interface";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(private readonly config: SocketOptions, app: any) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis({ ...this.config.pubRedis });
    const subClient = new Redis({ ...this.config.subRedis });

    await Promise.allSettled([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
