import { ApiProperty } from '@nestjs/swagger';

export class UnclassifiedConceptDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ required: false, nullable: true })
  createdAt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  mentionCount?: number | null;

  @ApiProperty({ required: false, nullable: true })
  lastMentionedAt?: string | null;
}
