import { getSchemaPath } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';

export const buildErrorSchema = (
  example: Partial<HttpErrorResponseDto>,
): { schema: Record<string, unknown> } => ({
  schema: {
    allOf: [{ $ref: getSchemaPath(HttpErrorResponseDto) }],
    example,
  },
});
