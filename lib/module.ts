import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { RedisIoAdapter } from './adapter';
import { SquareboatSocket } from './constant';
import {
  SocketAsyncOptions,
  SocketAsyncOptionsFactory,
  SocketOptions,
} from './interface';
import { SocketService } from './service';
import { SocketState } from './socketState';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class SbSocketModule {
  /**
   * Register options
   * @param options
   */
  static register(options: SocketOptions): DynamicModule {
    return {
      global: options.isGlobal || false,
      module: SbSocketModule,
      imports: [],
      providers: [
        SocketService,
        SocketState,
        { provide: SquareboatSocket.socketOptions, useValue: options },
      ],
      exports: [],
    };
  }

  /**
   * Register Async Options
   */
  static registerAsync(options: SocketAsyncOptions): DynamicModule {
    return {
      global: options.isGlobal || false,
      module: SbSocketModule,
      imports: [],
      providers: [
        this.createOptionsProvider(options),
        SocketService,
        SocketState,
      ],
      exports: [],
    };
  }

  private static createOptionsProvider(options: SocketAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: SquareboatSocket.socketOptions,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = [
      (options.useClass || options.useExisting) as Type<SocketOptions>,
    ];

    return {
      provide: SquareboatSocket.socketOptions,
      useFactory: async (optionsFactory: SocketAsyncOptionsFactory) =>
        await optionsFactory.createOptions(),
      inject,
    };
  }
}
