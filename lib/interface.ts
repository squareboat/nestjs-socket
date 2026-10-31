import { ModuleMetadata, Type } from '@nestjs/common';
import type { RedisOptions } from 'ioredis';

export interface SocketOptions {
  /** Register the module globally, so `SocketService` and `SocketState` can be injected in every module. */
  isGlobal?: boolean;
  /** ioredis options for the publisher connection. `SocketState` uses the same options for its own connection. */
  pubRedis: RedisOptions;
  /** ioredis options for the subscriber connection. */
  subRedis: RedisOptions;
}

export interface SocketAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** @deprecated Not used. */
  name?: string;
  isGlobal?: boolean;
  useExisting?: Type<SocketAsyncOptionsFactory>;
  useClass?: Type<SocketAsyncOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<SocketOptions> | SocketOptions;
  inject?: any[];
}

export interface SocketAsyncOptionsFactory {
  createOptions(): Promise<SocketOptions> | SocketOptions;
}

export type SocketIds = string[];
