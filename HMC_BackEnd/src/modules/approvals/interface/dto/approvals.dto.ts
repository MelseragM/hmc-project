import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { ApprovalDecision } from '../../domain/approvals.repository';

/** Query for detail/history routes carrying only `lang` (id is a path param). */
export class ApprovalDetailQueryDto extends LangQueryDto {}

/** op 22 — Approve/Reject decision. */
export class ApproveRejectRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], example: 'APPROVE' })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: ApprovalDecision;

  @ApiPropertyOptional({ example: 'Approved as per policy.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

/** op 71 — Reassign approval. */
export class ReassignApprovalRequestDto {
  @ApiProperty({ example: 'V-OTHERSUP', description: 'Username to reassign the task to.' })
  @IsString()
  @IsNotEmpty()
  assignTo!: string;

  @ApiPropertyOptional({ example: 'Out of office.' })
  @IsOptional()
  @IsString()
  comment?: string;
}
