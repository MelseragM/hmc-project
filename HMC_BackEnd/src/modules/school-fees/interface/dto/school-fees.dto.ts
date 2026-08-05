import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { ProfileQueryDto } from '@shared/dto/common-query.dto';

/** op 52 — `?enum&acadyrstrtdt&lang` */
export class SchoolChildrenQueryDto extends ProfileQueryDto {
  @ApiProperty({ example: '20200202', description: 'Academic year start date token (yyyymmdd).' })
  @Matches(/^\d{8}$/, { message: 'acadyrstrtdt must be yyyymmdd.' })
  acadyrstrtdt!: string;
}


