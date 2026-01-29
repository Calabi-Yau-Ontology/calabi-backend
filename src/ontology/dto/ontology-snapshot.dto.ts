import { ApiProperty } from '@nestjs/swagger';

export class OClassDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  labelKo?: string | null;

  @ApiProperty({ required: false, nullable: true })
  labelEn?: string | null;

  @ApiProperty({ required: false, nullable: true })
  facet?: string | null;

  @ApiProperty({ required: false, nullable: true })
  kind?: string | null;

  @ApiProperty({ required: false, nullable: true })
  isRoot?: boolean | null;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  seedVersion?: string | null;
}

export class OClassEdgeDto {
  @ApiProperty()
  childId: string;

  @ApiProperty()
  parentId: string;
}

export class OntologySnapshotResponseDto {
  @ApiProperty({ required: false, nullable: true })
  seedVersion?: string | null;

  @ApiProperty({ type: [String] })
  conceptTypes: string[];

  @ApiProperty({ type: [OClassDto] })
  oClasses: OClassDto[];

  @ApiProperty({ type: [OClassEdgeDto] })
  subclassEdges: OClassEdgeDto[];
}
