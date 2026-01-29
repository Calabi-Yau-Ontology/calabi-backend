import { ApiProperty } from '@nestjs/swagger';
import type { ConceptType } from '../constants/concept.types';

export class UnclassifiedMentionDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  type: ConceptType;
}

export class UnclassifiedContextEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  title?: string | null;

  @ApiProperty({ required: false, nullable: true })
  startTime?: string | null;

  @ApiProperty()
  activityClassified: boolean;
}

export class UnclassifiedContextDto {
  @ApiProperty()
  contextEvent: UnclassifiedContextEventDto;

  @ApiProperty({ type: [UnclassifiedMentionDto] })
  unclassifiedMentions: UnclassifiedMentionDto[];
}
