import { Injectable } from '@nestjs/common';
import { SocketIds } from './interface';
import { SocketService } from './service';

/**
 * Keeps sets of socket ids in Redis, e.g. one set per user, so that every
 * app instance can find the sockets of a user.
 */
@Injectable()
export class SocketState {
  constructor(private readonly socketService: SocketService) {}

  /** Add a socket id to the set stored at `key`. */
  async add(key: string, value: string): Promise<boolean> {
    await this.socketService.client.sadd(key, value);
    return true;
  }

  /** All socket ids stored at `key`. */
  async getAll(key: string): Promise<SocketIds> {
    return this.socketService.client.smembers(key);
  }

  /** Remove one socket id from the set stored at `key`. */
  async remove(key: string, value: string): Promise<void> {
    await this.socketService.client.srem(key, value);
  }

  /** Remove the whole set stored at `key`. */
  async clear(key: string): Promise<void> {
    await this.socketService.client.del(key);
  }
}
