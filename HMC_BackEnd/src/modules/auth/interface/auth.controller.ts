import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@core/auth/decorators/public.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/auth-user.interface';
import { AuthService } from '../application/auth.service';
import { LoginRequestDto, MeResponseDto, TokenResponseDto } from './dto/auth.dto';

/** Auth endpoints (op 1 + current identity). See Docs_Ai/API/README.md — Module: auth. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'op 1 — Login (out-of-band; dev placeholder)', operationId: 'auth_login' })
  @ApiOkResponse({ type: TokenResponseDto })
  login(@Body() dto: LoginRequestDto): Promise<TokenResponseDto> {
    return this.service.login(dto.username);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current authenticated identity', operationId: 'auth_me' })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: AuthenticatedUser): MeResponseDto {
    return this.service.me(user);
  }
}
