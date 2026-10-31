import { SocketService } from './service';
import { SocketIds } from './interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketState {
  async add(key: string, value: string): Promise<boolean> {
    const redis = SocketService.redisClient;

    await redis.sadd(key, value);
    return true;
  }

  async getAll(key: string): Promise<SocketIds> {
    const redis = SocketService.redisClient;
    return redis.smembers(key);
  }

  async remove(key: string, value: string): Promise<void> {
    const redis = SocketService.redisClient;
    await redis.srem(key, value);
  }

  async clear(key: string): Promise<void> {
    const redis = SocketService.redisClient;
    await redis.del(key);
  }
}
