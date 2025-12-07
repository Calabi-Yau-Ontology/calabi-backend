export class NerEntityDto {
  text!: string;
  label!: string;
  start!: number;
  end!: number;
}

export class NerResponseDto {
  entities!: NerEntityDto[];
}
