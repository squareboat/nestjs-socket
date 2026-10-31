import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SquareboatSocket } from './constant';
import { SocketOptions } from './interface';
import { closeRedis } from './utils';

@Injectable()
export class SocketService implements OnApplicationShutdown {
  /** Redis connection (made from `pubRedis`) of the most recently started module. */
  static redisClient: Redis;

  /** Redis connection (made from `pubRedis`) that `SocketState` uses. */
  readonly client: Redis;

  constructor(
    @Inject(SquareboatSocket.socketOptions) private options: SocketOptions,
  ) {
    this.client = new Redis(this.options.pubRedis);
    SocketService.redisClient = this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    await closeRedis(this.client);
  }
}
