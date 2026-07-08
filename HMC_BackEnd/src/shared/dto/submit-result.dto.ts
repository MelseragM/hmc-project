import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmitResult, SuccessFlag } from '../domain/submit-result';

/** Swagger model for the action/submit envelope returned by `_PR`/`_PKG` calls. */
export class SubmitResultDto implements SubmitResult {
  @ApiProperty({ enum: ['S', 'N'], example: 'S' })
  successflag!: SuccessFlag;

  @ApiProperty({ enum: ['success', 'error'], example: 'success' })
  status!: 'success' | 'error';

  @ApiProperty({ example: 'Success' })
  errormessage!: string;

  @ApiPropertyOptional()
  errormessageAr?: string;

  @ApiPropertyOptional({ type: Object })
  result?: Record<string, unknown>;
}
