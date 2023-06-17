import { Inject, Injectable } from "@nestjs/common";
import { SquareboatSocket } from "./constant";
import { Redis } from "ioredis";
import { SocketOptions } from "./interface";

@Injectable()
export class SocketService {
  static redisClient: Redis;

  constructor(
    @Inject(SquareboatSocket.socketOptions) private options: SocketOptions
  ) {
    SocketService.redisClient = new Redis(this.options.pubRedis);
  }
}
