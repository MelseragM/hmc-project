import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { LangQueryDto } from './lang-query.dto';

/**
 * `?enum=<employeeNumber>&lang=` — the most common read query in the mapping.
 * `enum` is the employee number (a.k.a. personid); some ops pass the username form.
 */
export class ProfileQueryDto extends LangQueryDto {
  @ApiProperty({ example: '053613', description: 'Employee number (enum / personid).' })
  @IsString()
  @IsNotEmpty()
  enum!: string;
}

/** `?username=<oracleUsername>&lang=` — used by user-scoped LOV reads. */
export class LovUserQueryDto extends LangQueryDto {
  @ApiProperty({ example: 'V-NFERNANDO', description: 'Oracle username form.' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}
