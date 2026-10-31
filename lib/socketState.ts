import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { SocketIds } from './interface';
import { SocketService } from './service';
import { isClosing } from './utils';

const logger = new Logger('SocketState');

/**
 * Keeps sets of socket ids in Redis, e.g. one set per user, so that every
 * app instance can find the sockets of a user.
 *
 * After `app.close()` the Redis connection is closed: calls then log a warning
 * and do nothing (`add()` returns false, `getAll()` returns []).
 */
@Injectable()
export class SocketState {
  constructor(private readonly socketService: SocketService) {}

  /** Add a socket id to the set stored at `key`. */
  async add(key: string, value: string): Promise<boolean> {
    return this.run('add', false, async (redis) => {
      await redis.sadd(key, value);
      return true;
    });
  }

  /** All socket ids stored at `key`. */
  async getAll(key: string): Promise<SocketIds> {
    return this.run('getAll', [], (redis) => redis.smembers(key));
  }

  /** Remove one socket id from the set stored at `key`. */
  async remove(key: string, value: string): Promise<void> {
    return this.run('remove', undefined, async (redis) => {
      await redis.srem(key, value);
    });
  }

  /** Remove the whole set stored at `key`. */
  async clear(key: string): Promise<void> {
    return this.run('clear', undefined, async (redis) => {
      await redis.del(key);
    });
  }

  private get redis(): Redis {
    return this.socketService.client;
  }

  private async run<T>(method: string, closedValue: T, command: (redis: Redis) => Promise<T>): Promise<T> {
    const redis = this.redis;
    if (!isClosing(redis)) {
      try {
        return await command(redis);
      } catch (err) {
        if (!isClosing(redis)) throw err;
      }
    }
    logger.warn(`${method}() after the app was closed: the Redis connection is closed, so it did nothing`);
    return closedValue;
  }
}
