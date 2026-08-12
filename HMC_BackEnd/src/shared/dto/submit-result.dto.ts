import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SuccessFlag } from '../domain/submit-result';

/**
 * Swagger model for the action/submit envelope (see `SanaadActionEnvelope`)
 * returned by `_PR`/`_PKG` calls — the actual wire shape a client receives.
 * Not `implements SubmitResult`: the domain `SubmitResult` type still carries
 * both `errormessage`/`errormessageAr` internally (so `ResponseInterceptor`
 * can pick one), but only the resolved `message` ever reaches the client.
 */
export class SubmitResultDto {
  @ApiProperty({ enum: ['S', 'N'], example: 'S' })
  successflag!: SuccessFlag;

  @ApiProperty({ enum: ['success', 'error'], example: 'success' })
  status!: 'success' | 'error';

  @ApiProperty({
    example: 'Success',
    description: 'errormessage (en) or errormessageAr (ar), depending on the request `lang` (default en).',
  })
  message!: string;

  @ApiPropertyOptional({ type: Object })
  result?: Record<string, unknown>;
}
