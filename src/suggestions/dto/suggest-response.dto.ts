export class NerEntityDto {
  text!: string;
  label!: string;
  start!: number;
  end!: number;
}

export class SuggestItemDto {
  type!: 'completion' | 'tag' | 'entity';
  text!: string;
  score!: number;
}

export class SuggestResponseDto {
  suggestions!: SuggestItemDto[];
  entities!: NerEntityDto[];
}
