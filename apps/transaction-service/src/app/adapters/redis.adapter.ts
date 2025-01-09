import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly configService: ConfigService;

  constructor(app: INestApplication) {
    super();
    this.configService = app.get(ConfigService);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: this.configService.get('REDIS_URL'),
      password: this.configService.get('REDIS_PASSWORD'),
    });

    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis adapter connected successfully');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  bindClientConnect(server: Server, callback: (socket: Socket) => void) {
    server.on('connection', callback);
  }
  bindMessageHandlers(
    client: Socket,
    handlers: { message: string; callback: (data: unknown) => void }[],
    transform: (data: unknown) => unknown
  ) {
    const handlersMap = handlers.reduce<
      Record<string, { callback: (data: unknown) => void }>
    >((map, handler) => {
      map[handler.message] = handler;
      return map;
    }, {});

    client.on('message', (channel: string, data: unknown) => {
      if (handlersMap[channel]) {
        handlersMap[channel].callback(transform(data));
      }
    });
  }
  async close(server: Server): Promise<void> {
    await server.close();
  }
}
