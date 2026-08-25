import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

type DtoClass = { prototype: object };

export function defineOptionalStringFields(
  target: DtoClass,
  fields: readonly string[],
  examples: Readonly<Record<string, string>> = {},
): void {
  for (const field of fields) {
    ApiPropertyOptional({ type: String, example: examples[field] })(target.prototype, field);
    IsOptional()(target.prototype, field);
    IsString()(target.prototype, field);
  }
}

/**
 * Required `p_*` field of an Oracle submit body. `description` is worth filling
 * in whenever the accepted values are not obvious from the example — the value
 * sets behind these procedures are not discoverable from the schema, and a
 * wrong one usually comes back as a bare ORA-20001 / ORA-01403.
 */
export function RequiredString(example?: string, description?: string): PropertyDecorator {
  return (target, propertyKey) => {
    ApiProperty({ type: String, example, description })(target, propertyKey as string);
    IsString()(target, propertyKey as string);
    IsNotEmpty()(target, propertyKey as string);
  };
}

export const ATTACHMENT_FIELDS = Array.from({ length: 10 }, (_, index) => index + 1).flatMap(
  (index) => [`p_file_name${index}`, `p_attachment${index}`],
);
