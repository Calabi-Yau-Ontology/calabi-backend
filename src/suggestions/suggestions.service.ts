import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { RunNerDto } from './dto/run-ner.dto';
import { NerResponseDto } from './dto/ner-response.dto';

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const mlConfig = this.configService.get('ml');
    this.baseUrl = mlConfig?.baseUrl ?? 'http://localhost:8001';
  }

  /**
   * Calabi-ML 서버의 /nlp/ner 엔드포인트를 호출해서
   * 엔티티 리스트를 가져온다.
   */
  async runNer(dto: RunNerDto): Promise<NerResponseDto> {
    const url = `${this.baseUrl}/nlp/ner`;

    try {
      const response$ = this.httpService.post<NerResponseDto>(url, {
        text: dto.text,
      });

      const { data } = await firstValueFrom(response$);
      return data;
    } catch (error) {
      const err = error as AxiosError;
      this.logger.error(
        `NER request failed: ${err.message}`,
        err.stack,
      );

      // 여기선 그냥 빈 entities 반환 (MVP)
      // 나중에 에러 클래스로 던져도 됨
      return { entities: [] };
    }
  }
}
