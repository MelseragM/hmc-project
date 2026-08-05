import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LangQueryDto } from '@shared/dto/lang-query.dto';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';
import { ApprovalDecision, ReassignType } from '../../domain/approvals.repository';

/** Query for detail routes carrying only `lang` (id is a path param). */
export class ApprovalDetailQueryDto extends LangQueryDto {}

/**
 * op 70 — action history. ACTION_HISTORY_V is keyed by ITEM_TYPE + ITEM_KEY;
 * the path parameter carries the item key and the type defaults to the HR
 * self-service workflow.
 */
export class ActionHistoryQueryDto extends LangQueryDto {
  @ApiPropertyOptional({ example: 'HRSSA', default: 'HRSSA' })
  @IsOptional()
  @IsString()
  itemType?: string;
}

/** op 69 — worklist summary is scoped to a single notification. */
export class WorklistSummaryQueryDto extends ProfileQueryDto {
  @ApiPropertyOptional({ example: '123888822' })
  @IsOptional()
  @IsString()
  notificationId?: string;
}

/**
 * op 22 — Approve/Reject. APPROVE_REJECT_PR needs the workflow item type and
 * key in addition to the notification id taken from the route.
 */
export class ApproveRejectRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], example: 'APPROVE' })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: ApprovalDecision;

  @ApiProperty({ example: '18873561', description: 'Workflow item key of the request.' })
  @IsString()
  @IsNotEmpty()
  itemKey!: string;

  @ApiPropertyOptional({ example: 'HRSSA', default: 'HRSSA' })
  @IsOptional()
  @IsString()
  itemType?: string;

  @ApiPropertyOptional({ example: 'Approved as per policy.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

/** op 71 — Reassign approval (delegate or transfer). */
export class ReassignApprovalRequestDto {
  @ApiProperty({ example: 'V-OTHERSUP', description: 'Username to reassign the task to.' })
  @IsString()
  @IsNotEmpty()
  assignTo!: string;

  @ApiPropertyOptional({ enum: ['DELEGATE', 'TRANSFER'], default: 'DELEGATE' })
  @IsOptional()
  @IsIn(['DELEGATE', 'TRANSFER'])
  type?: ReassignType;

  @ApiPropertyOptional({ example: 'Out of office.' })
  @IsOptional()
  @IsString()
  comment?: string;
}
