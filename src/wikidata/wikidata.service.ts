import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

type WikidataSearchResult = {
  id: string;       // Q번호 (예: "Q12345")
  label: string;    // 라벨
  description?: string;
};

type WikidataNeighbor = {
  id: string;           // Q번호
  label: string;
  relation: 'INSTANCE_OF' | 'SUBCLASS_OF' | 'HAS_PART' | 'HAS_GOAL';
};

@Injectable()
export class WikidataService {
  private readonly logger = new Logger(WikidataService.name);
  private readonly sparqlEndpoint: string;
  private readonly searchEndpoint: string;
  private readonly language: string;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    const cfg = this.configService.get('wikidata');
    this.sparqlEndpoint = cfg.sparqlEndpoint;
    this.searchEndpoint = cfg.searchEndpoint;
    this.language = cfg.language || 'ko,en';
  }

  /**
   * 텍스트(label)로 Wikidata 엔티티 검색 → QID 하나 반환
   */
  async searchEntity(label: string): Promise<WikidataSearchResult | null> {
    const params = {
      action: 'wbsearchentities',
      format: 'json',
      language: this.language.split(',')[0],
      search: label,
      limit: 1,
      origin: '*',
    };

    try {
      const res$ = this.http.get(this.searchEndpoint, { params });
      const { data } = await firstValueFrom(res$);

      if (!data?.search?.length) return null;

      const first = data.search[0];
      return {
        id: first.id, // "Qxxxx"
        label: first.label,
        description: first.description,
      };
    } catch (e) {
      const err = e as AxiosError;
      this.logger.error(`Wikidata search failed: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * 주어진 QID에 대해 instance of / subclass of / has part / has goal 이웃을 가져온다.
   */
  async fetchNeighbors(qid: string): Promise<WikidataNeighbor[]> {
    const query = `
      SELECT ?property ?propertyLabel ?value ?valueLabel WHERE {
        VALUES ?item { wd:${qid} }
        ?item ?p ?value .
        ?property wikibase:directClaim ?p .
        VALUES ?property { wd:P31 wd:P279 wd:P527 wd:P3712 }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${this.language}" . }
      }
    `;

    const params = {
      query,
      format: 'json',
    };

    try {
      const res$ = this.http.get(this.sparqlEndpoint, { params });
      const { data } = await firstValueFrom(res$);
      const results = data?.results?.bindings ?? [];

      const neighbors: WikidataNeighbor[] = [];

      for (const row of results) {
        const propertyIri: string = row.property.value; // e.g. "http://www.wikidata.org/prop/direct/P31"
        const valueIri: string = row.value.value;       // e.g. "http://www.wikidata.org/entity/Q12345"
        const valueLabel: string = row.valueLabel?.value ?? '';

        const pid = propertyIri.split('/').pop(); // "P31" etc.
        const qid2 = valueIri.split('/').pop();   // "Qxxxx"

        if (!qid2 || !valueLabel) continue;

        let relation: WikidataNeighbor['relation'] | null = null;
        if (pid === 'P31') relation = 'INSTANCE_OF';
        else if (pid === 'P279') relation = 'SUBCLASS_OF';
        else if (pid === 'P527') relation = 'HAS_PART';
        else if (pid === 'P3712') relation = 'HAS_GOAL';

        if (!relation) continue;

        neighbors.push({
          id: qid2,
          label: valueLabel,
          relation,
        });
      }

      return neighbors;
    } catch (e) {
      const err = e as AxiosError;
      this.logger.error(`Wikidata neighbors fetch failed: ${err.message}`, err.stack);
      return [];
    }
  }
}
