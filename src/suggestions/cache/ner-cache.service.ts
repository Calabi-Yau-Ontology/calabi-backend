import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import type { NERResponseDto } from '../dto/ner-response.dto';

const CACHE_KEY_PREFIX = 'suggestions:ner:';
const DEFAULT_CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

type NerCachePayload = {
  userId: string;
  text: string;
  ner: NERResponseDto;
  createdAt: number;
};

@Injectable()
export class NerCacheService {
  private readonly logger = new Logger(NerCacheService.name);
  private readonly client: Redis;

  constructor(private readonly redisService: RedisService) {
    this.client = this.redisService.getClient();
  }

  async store(
    userId: string,
    text: string,
    ner: NERResponseDto,
    options?: { token?: string; ttlSeconds?: number },
  ): Promise<string> {
    const token = options?.token ?? randomUUID();
    const entry: NerCachePayload = {
      userId,
      text,
      ner,
      createdAt: Date.now(),
    };
    const key = this.buildKey(token);
    const ttlSeconds = options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    await this.client.set(key, JSON.stringify(entry), 'EX', ttlSeconds);
    return token;
  }

  async resolve(token: string, userId: string): Promise<NERResponseDto | null> {
    const entry = await this.load(token);
    if (!entry || entry.userId !== userId) return null;
    return entry.ner;
  }

  async consume(token: string, userId: string): Promise<NERResponseDto | null> {
    const key = this.buildKey(token);
    const entry = await this.load(token);
    if (!entry || entry.userId !== userId) return null;
    await this.client.del(key).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to delete consumed NER cache: ${message}`);
    });
    return entry.ner;
  }

  async refreshTTL(token: string, ttlSeconds?: number): Promise<void> {
    if (!token) return;
    const key = this.buildKey(token);
    const seconds = ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    await this.client.expire(key, seconds).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to refresh NER cache TTL: ${message}`);
    });
  }

  async remove(token: string): Promise<void> {
    if (!token) return;
    await this.client.del(this.buildKey(token)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to remove NER cache entry: ${message}`);
    });
  }

  private async load(token: string): Promise<NerCachePayload | null> {
    const raw = await this.client.get(this.buildKey(token));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NerCachePayload;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to parse NER cache payload: ${message}`);
      return null;
    }
  }

  private buildKey(token: string): string {
    return `${CACHE_KEY_PREFIX}${token}`;
  }
}
