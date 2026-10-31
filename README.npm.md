## NestJS Socket

Run your NestJS [Socket.IO](https://socket.io) gateways on more than one app instance.

This package gives you:

- `RedisIoAdapter`: a Nest WebSocket adapter that uses [`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/). Events sent with `server.emit()`, `server.to(room).emit()` and `server.fetchSockets()` reach clients connected to any instance.
- `SocketState`: keeps sets of socket ids in Redis (for example one set per user), so every instance can find the sockets of a user.

## Installation

```sh
# npm
npm i @squareboat/nestjs-socket @nestjs/websockets @nestjs/platform-socket.io

# yarn
yarn add @squareboat/nestjs-socket @nestjs/websockets @nestjs/platform-socket.io
```

Requires Node.js 20.19+ or 22.12+ and NestJS 10, 11 or 12. Install `@nestjs/websockets` and `@nestjs/platform-socket.io` at the same major version as your `@nestjs/core`. The package uses Socket.IO 4 and ioredis 6, which supports Redis 6.2 and later (ioredis 5 also supported older servers).

## Configuration

### Synchronous Registration

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { SbSocketModule } from "@squareboat/nestjs-socket";

const redis = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB || 0),
};

@Module({
  imports: [
    SbSocketModule.register({
      isGlobal: true,
      pubRedis: redis,
      subRedis: redis,
      adapterOptions: { key: `myapp-${process.env.NODE_ENV}` },
    }),
  ],
})
export class AppModule {}
```

`pubRedis` and `subRedis` are [ioredis options](https://github.com/redis/ioredis#connect-to-redis). The adapter opens one connection with each. `SocketState` opens its own connection with the `pubRedis` options.

`adapterOptions` are passed to [`@socket.io/redis-adapter`](https://github.com/socketio/socket.io-redis-adapter#options). **Redis pub/sub ignores `db`**: two apps (or staging and production) on the same Redis with the same `key` (default `"socket.io"`) receive each other's events, even with different `db` numbers. Give each app and environment its own `key`, and the same `key` to all instances of one app.

With `isGlobal: true`, `SocketState` and `SocketService` can be injected in every module. Without it, call `register()` once in a module of your own that re-exports `SbSocketModule`, and import that module where you need them. Each `register()` call opens another Redis connection.

```typescript
// src/socket.module.ts
@Module({
  imports: [SbSocketModule.register({ pubRedis: redis, subRedis: redis })],
  exports: [SbSocketModule],
})
export class SocketModule {}
```

### Asynchronous Registration

Use `registerAsync()` to read the options from `@nestjs/config` or another module. `imports` lists the modules that provide what your factory needs.

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SbSocketModule } from "@squareboat/nestjs-socket";

@Module({
  imports: [
    ConfigModule.forRoot(),
    SbSocketModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redis = {
          host: config.get("REDIS_HOST"),
          port: Number(config.get("REDIS_PORT", 6379)),
          password: config.get("REDIS_PASSWORD"),
        };
        return { pubRedis: redis, subRedis: redis };
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

You can also use a class that implements `SocketAsyncOptionsFactory`, with `useClass` (the module creates it) or `useExisting` (an exported provider of one of the `imports`):

```typescript
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SocketAsyncOptionsFactory, SocketOptions } from "@squareboat/nestjs-socket";

@Injectable()
export class SocketConfig implements SocketAsyncOptionsFactory {
  constructor(private config: ConfigService) {}

  createOptions(): SocketOptions {
    const redis = { host: this.config.get("REDIS_HOST"), port: Number(this.config.get("REDIS_PORT", 6379)) };
    return { pubRedis: redis, subRedis: redis };
  }
}

// in your module
SbSocketModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  useClass: SocketConfig,
});
```

Pass `isGlobal` to `registerAsync()` itself; it is not read from the options your factory returns.

### Use the Redis adapter

Create the adapter in `main.ts`. It can reuse the options you registered above:

```typescript
// src/main.ts
import { NestFactory } from "@nestjs/core";
import { RedisIoAdapter, SocketOptions, SquareboatSocket } from "@squareboat/nestjs-socket";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const options = app.get<SocketOptions>(SquareboatSocket.socketOptions);
  const redisIoAdapter = new RedisIoAdapter(options, app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(3000);
}
bootstrap();
```

If `connectToRedis()` is not called, the app still starts but uses Socket.IO's in-memory adapter (a warning is logged), so events do not reach clients on other instances.

`app.close()` disconnects this instance's sockets (so `handleDisconnect()` runs), then closes the adapter's and `SocketState`'s Redis connections. When Redis does not answer, each connection is dropped after a second.

## Usage

Keep the socket ids of each user in `SocketState` and send to them from any instance:

```typescript
// src/chat.gateway.ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SocketState } from "@squareboat/nestjs-socket";

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly socketState: SocketState) {}

  async handleConnection(client: Socket) {
    // authenticate the client here, e.g. verify client.handshake.auth.token
    client.data.userId = await this.userIdFor(client);
    await this.socketState.add(`user:${client.data.userId}`, client.id);
  }

  async handleDisconnect(client: Socket) {
    // call SocketState before any other await: during app.close() Redis is closed soon after
    await this.socketState.remove(`user:${client.data.userId}`, client.id);
  }

  @SubscribeMessage("message")
  async onMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { to: string; text: string }) {
    const socketIds = await this.socketState.getAll(`user:${body.to}`);
    // server.to([]) would send to every client
    if (socketIds.length) {
      this.server.to(socketIds).emit("message", { from: client.data.userId, text: body.text });
    }
    return { delivered: socketIds.length };
  }

  private async userIdFor(client: Socket): Promise<string> {
    // your authentication
    return client.handshake.auth.userId;
  }
}
```

Add the gateway to the `providers` of a module, as with any Nest gateway.

### SocketState

| Method                   | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `add(key, socketId)`     | Adds a socket id to the set at `key`. Returns true. |
| `getAll(key)`            | Returns all socket ids at `key` (`string[]`).       |
| `remove(key, socketId)`  | Removes one socket id from the set at `key`.        |
| `clear(key)`             | Deletes the set at `key`.                           |

The keys are plain Redis keys in the `pubRedis` `db`, so choose names that do not clash with your other data. When an instance stops without closing, the ids of its sockets stay in Redis; sending to an id that is no longer connected does nothing.

**Shutdown:** `SocketState`'s connection is closed in `onApplicationShutdown`. Calls after that (for example from a `handleDisconnect()` that awaited something else first) log a warning and do nothing: `add()` returns false, `getAll()` returns `[]`. On NestJS 10, `SbSocketModule`'s `onApplicationShutdown` runs before your module's, so do shutdown cleanup with `SocketState` in `beforeApplicationShutdown`.

### SocketService

`SocketService` holds the ioredis connection that `SocketState` uses, as `socketService.client`, if you need other Redis commands. `SocketService.redisClient` (static) points to the connection of the most recently started module.

## Upgrading from 0.1.x

- NestJS 7, 8 and 9 and Node.js before 20.19 (and 22.0 to 22.11) are no longer supported.
- `@nestjs/platform-socket.io` is now a peer dependency (0.1.x pulled in version 9). Install it and `@nestjs/websockets` at your NestJS major.
- ioredis 5 was replaced by ioredis 6, which supports Redis 6.2 and later.
- `app.close()` now closes the Redis connections (0.1.x left them open, so the process did not exit). `SocketState` calls after that warn and do nothing; see Shutdown above.
- `register()` and `registerAsync()` now export `SocketState` and `SocketService`; before, they could not be injected outside the module.
- `registerAsync()` now uses `imports`, and `useClass` works.
- `SocketState` no longer logs keys and socket ids with `console.log`.

## Contributing

To know about contributing to this package, read the guidelines [here](./CONTRIBUTING.md)

## About Us

We are a bunch of dreamers, designers, and futurists. We are high on collaboration, low on ego, and take our happy hours seriously. We'd love to hear more about your product. Let's talk and turn your great ideas into something even greater! We have something in store for everyone. [☎️ 📧 Connect with us!](https://squareboat.com/contact)

## License

The MIT License. Please see License File for more information. Copyright © 2020 SquareBoat.

Made with ❤️ by [Squareboat](https://squareboat.com)
