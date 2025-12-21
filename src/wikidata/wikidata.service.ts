import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import {
  PID_TO_REL,
  WikidataNeighbor,
  WikidataSearchItem,
} from './wikidata.types';

@Injectable()
export class WikidataService {
  private readonly logger = new Logger(WikidataService.name);

  private readonly sparqlEndpoint: string;
  private readonly searchEndpoint: string;
  private readonly maxNeighbors: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.sparqlEndpoint =
      this.config.get<string>('WIKIDATA_SPARQL_ENDPOINT') ??
      'https://query.wikidata.org/sparql';
    this.searchEndpoint =
      this.config.get<string>('WIKIDATA_SEARCH_ENDPOINT') ??
      'https://www.wikidata.org/w/api.php';

    this.maxNeighbors = Number(this.config.get('WIKIDATA_MAX_NEIGHBORS') ?? 200);
  }

  /**
   * canonical_en 기반 검색 (language=en 고정)
   */
  async searchByEnglishLabel(query: string, limit = 5): Promise<WikidataSearchItem[]> {
    const q = query.trim();
    if (!q) return [];

    const params = {
      action: 'wbsearchentities',
      format: 'json',
      language: 'en',
      uselang: 'en',
      search: q,
      limit,
    };

    try {
      console.log('Wikidata search params:', params);
      const res$ = this.http.get(this.searchEndpoint, {
        params,
      });
      const { data } = await firstValueFrom(res$);

      const items = (data?.search ?? []) as any[];
      return items
        .map((it) => ({
          id: String(it.id),
          label: String(it.label ?? ''),
          description: it.description ? String(it.description) : undefined,
        }))
        .filter((it) => it.id && it.label);
    } catch (e: any) {
      this.logger.error(`Wikidata search failed: ${e?.message ?? e}`, e?.stack);
      return [];
    }
  }

  /**
   * qid 기준 neighbors fetch
   * - 최대 maxNeighbors로 제한
   */
  async fetchNeighbors(qid: string): Promise<WikidataNeighbor[]> {
    const fromQid = qid.trim();
    if (!/^Q\d+$/.test(fromQid)) return [];

    const sparql = `
      SELECT ?property ?propertyLabel ?value ?valueLabel WHERE {
          VALUES ?item { wd:${fromQid} }
          ?item ?p ?value .
          ?property wikibase:directClaim ?p .
          VALUES ?property { wd:P31 wd:P279 wd:P527 wd:P3712 }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
        }
      LIMIT ${this.maxNeighbors}
    `;

    try {
      console.log('Wikidata SPARQL query:', sparql);
      const res$ = this.http.get(this.sparqlEndpoint, {
        params: {
          format: 'json',
          query: sparql,
        },
      });

      const { data } = await firstValueFrom(res$);
      console.log('Wikidata SPARQL data:', data);
      const bindings = data?.results?.bindings ?? [];

      const neighbors: WikidataNeighbor[] = [];

      for (const row of bindings) {
        const propertyIri: string = row.property.value; // e.g. "http://www.wikidata.org/prop/direct/P31"
        const valueIri: string = row.value.value;       // e.g. "http://www.wikidata.org/entity/Q12345"
        const valueLabel: string = row.valueLabel?.value ?? '';

        const pid = propertyIri.split('/').pop(); // "P31" etc.
        const neighborQid = valueIri.split('/').pop();   // "Qxxxx"

        if (!neighborQid || !valueLabel) continue;

        let relation: WikidataNeighbor['rel'] | null = null;
        if (pid === 'P31') relation = 'INSTANCE_OF';
        else if (pid === 'P279') relation = 'SUBCLASS_OF';
        else if (pid === 'P527') relation = 'HAS_PART';
        else if (pid === 'P3712') relation = 'HAS_GOAL';

        if (!relation) continue;

        neighbors.push({
          neighborQid: neighborQid,
          neighborLabel: valueLabel,
          rel: relation,
        });
      }

      return neighbors;
    } catch (e: any) {
      this.logger.error(`Wikidata SPARQL failed: ${e?.message ?? e}`, e?.stack);
      return [];
    }
  }
}
