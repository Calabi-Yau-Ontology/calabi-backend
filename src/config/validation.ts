import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  PORT?: string;

  @IsString()
  POSTGRES_HOST!: string;
  @IsString()
  POSTGRES_PORT!: string;
  @IsString()
  POSTGRES_USER!: string;
  @IsString()
  POSTGRES_PASSWORD!: string;
  @IsString()
  POSTGRES_DB!: string;

  @IsString()
  JWT_SECRET!: string;
  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsString()
  APP_NEO4J_URI!: string;
  @IsString()
  NEO4J_AUTH!: string;

  @IsString()
  ML_BASE_URL!: string;

  @IsString()
  GOOGLE_CLIENT_ID!: string;
  @IsString()
  GOOGLE_CLIENT_SECRET!: string;
  @IsString()
  GOOGLE_REDIRECT_URI!: string;

  @IsString()
  WIKIDATA_SPARQL_ENDPOINT?: string;
  @IsString()
  WIKIDATA_SEARCH_ENDPOINT?: string;
  @IsOptional()
  @IsString()
  WIKIDATA_LANGUAGE?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
