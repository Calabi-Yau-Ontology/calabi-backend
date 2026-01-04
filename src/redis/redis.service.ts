import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type Redis as RedisClient, type RedisOptions } from 'ioredis';

type RedisConfig = {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClient;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<RedisConfig>('redis') ?? {
      host: 'localhost',
      port: 6379,
    };

    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      keyPrefix: redisConfig.keyPrefix || undefined,
      lazyConnect: false,
    };

    this.client = new Redis(options);
    this.registerLogging();
  }

  getClient(): RedisClient {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis quit encountered an error: ${message}`);
    }
  }

  private registerLogging(): void {
    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });
    this.client.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis client error: ${message}`);
    });
    this.client.on('reconnecting', () => {
      this.logger.warn('Redis client reconnecting...');
    });
  }
}
