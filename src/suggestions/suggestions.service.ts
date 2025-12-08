import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { Event } from '../events/entities/event.entity';
import { SuggestRequestDto } from './dto/suggest-request.dto';
import { SuggestResponseDto } from './dto/suggest-response.dto';

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {
    const mlConfig = this.configService.get('ml');
    this.baseUrl = mlConfig.baseUrl;
  }

  /**
   * 단순 NER 프록시 (이미 구현돼 있다면 그대로 두면 됨)
   */
  async runNer(text: string) {
    const url = `${this.baseUrl}/nlp/ner`;

    try {
      const response$ = this.httpService.post(url, { text });
      const { data } = await firstValueFrom(response$);
      return data;
    } catch (error) {
      const err = error as AxiosError;
      this.logger.error(`NER request failed: ${err.message}`, err.stack);
      return { entities: [] };
    }
  }

  /**
   * 과거 이벤트에서 history / popular_tags 생성 후
   * ML 서버 /nlp/suggest 호출
   */
  async runSuggest(
    userId: string,
    dto: SuggestRequestDto,
  ): Promise<SuggestResponseDto> {
    // 1) 과거 이벤트 가져오기 (최근 50개 정도)
    const events = await this.eventsRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    // console.log(events);

    const history: string[] = [];
    const tagCounts: Record<string, number> = {};

    for (const ev of events) {
      if (ev.title) {
        history.push(ev.title);
        this.collectTagsFromText(ev.title, tagCounts);
      }
      if (ev.description) {
        this.collectTagsFromText(ev.description, tagCounts);
      }
    }
    // console.log(events);
    // tag frequency 상위 N개
    const popularTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const url = `${this.baseUrl}/nlp/suggest`;

    const payload = {
      user_id: userId,
      text: dto.text,
      context: {
        field: dto.field ?? 'title',
        cursor_position: dto.cursorPosition ?? dto.text.length,
        extra: {
          history,
          popular_tags: popularTags,
        },
      },
    };

    try {
      const response$ = this.httpService.post<SuggestResponseDto>(url, payload);
      const { data } = await firstValueFrom(response$);
      return data;
    } catch (error) {
      const err = error as AxiosError;
      console.log(err)
      this.logger.error(`Suggest request failed: ${err.message}`, err.stack);
      // 실패 시 fallback: 빈 추천 + NER 결과도 빈 배열
      return { suggestions: [], entities: [] };
      // return err;
    }
  }

  /**
   * 아주 단순한 "과거 태그" 추출:
   * - 공백 기준 토큰화
   * - 길이 2 이상 토큰만
   */
  private collectTagsFromText(
    text: string,
    counts: Record<string, number>,
  ): void {
    const tokens = text
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    for (const token of tokens) {
      const key = token;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
}
