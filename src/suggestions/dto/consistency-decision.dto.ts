import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

export enum ConsistencyDecisionAction {
  Applied = 'applied',
  Ignored = 'ignored',
}

export class ConsistencyDecisionRequestDto {
  @ApiProperty({
    description: '결정을 반영할 일정 ID',
    example: '8c05fe4b-34dc-45fd-9b31-c5fcf768f9d5',
  })
  @IsUUID()
  eventId!: string;

  @ApiProperty({
    description: '추천 반영 여부',
    enum: ConsistencyDecisionAction,
    example: ConsistencyDecisionAction.Applied,
  })
  @IsEnum(ConsistencyDecisionAction)
  action!: ConsistencyDecisionAction;
}

export class ConsistencyDecisionResponseDto {
  @ApiProperty({ description: '처리 완료 여부', example: true })
  acknowledged!: boolean;
}
