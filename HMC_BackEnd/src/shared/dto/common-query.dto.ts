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

/**
 * `?person_id=<personId>&lang=` — used where the caller identifies the
 * employee by Oracle's numeric PERSON_ID rather than username/employee number
 * (see api_test_work.json "use": "person_id").
 */
export class PersonIdQueryDto extends LangQueryDto {
  @ApiProperty({ example: '852709', description: 'Oracle PERSON_ID (numeric).' })
  @IsString()
  @IsNotEmpty()
  person_id!: string;
}
