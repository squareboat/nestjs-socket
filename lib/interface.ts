import { ModuleMetadata, Type } from '@nestjs/common';
import { RedisOptions } from 'ioredis';

export interface SocketOptions {
  isGlobal?: boolean;
  pubRedis: RedisOptions;
  subRedis: RedisOptions;
}

export interface SocketAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  isGlobal?: boolean;
  useExisting?: Type<SocketOptions>;
  useClass?: Type<SocketAsyncOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<SocketOptions> | SocketOptions;
  inject?: any[];
}

export interface SocketAsyncOptionsFactory {
  createOptions(): Promise<SocketOptions> | SocketOptions;
}

export type SocketIds = string[];
