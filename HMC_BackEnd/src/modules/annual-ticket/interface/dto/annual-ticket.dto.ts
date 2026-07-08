import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** op 67 — Submit annual-ticket request (placeholder fields; TODO(bind)). */
export class SubmitTicketRequestDto {
  @ApiProperty({ example: 'DOH-LON', description: 'Destination code.' })
  @IsString()
  destination!: string;

  @ApiPropertyOptional({ example: 'ECONOMY', description: 'Ticket class code.' })
  @IsOptional()
  @IsString()
  ticketClass?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfTickets?: number;
}
