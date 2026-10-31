import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
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
      exports: [SocketService, SocketState],
    };
  }

  /**
   * Register Async Options
   */
  static registerAsync(options: SocketAsyncOptions): DynamicModule {
    return {
      global: options.isGlobal || false,
      module: SbSocketModule,
      imports: options.imports || [],
      providers: [
        this.createOptionsProvider(options),
        ...(options.useClass
          ? [{ provide: options.useClass, useClass: options.useClass }]
          : []),
        SocketService,
        SocketState,
      ],
      exports: [SocketService, SocketState],
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
      (options.useClass || options.useExisting) as Type<SocketAsyncOptionsFactory>,
    ];

    return {
      provide: SquareboatSocket.socketOptions,
      useFactory: async (optionsFactory: SocketAsyncOptionsFactory) =>
        await optionsFactory.createOptions(),
      inject,
    };
  }
}
