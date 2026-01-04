import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import type { NERResponseDto } from '../dto/ner-response.dto';

const CACHE_KEY_PREFIX = 'suggestions:ner:';
const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

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
  ): Promise<string> {
    const token = randomUUID();
    const entry: NerCachePayload = {
      userId,
      text,
      ner,
      createdAt: Date.now(),
    };
    const key = this.buildKey(token);
    await this.client.set(key, JSON.stringify(entry), 'EX', CACHE_TTL_SECONDS);
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
