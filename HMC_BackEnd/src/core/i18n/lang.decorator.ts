import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { toLang } from '@shared/domain/lang';
import type { Lang as LangCode } from '@shared/domain/lang';

/**
 * Resolves the request language from `?lang=en|ar` (default `en`).
 * Usage: `method(@Lang() lang: Lang)`.
 */
export const Lang = createParamDecorator((_data: unknown, ctx: ExecutionContext): LangCode => {
  const req = ctx.switchToHttp().getRequest<{ query?: { lang?: string } }>();
  return toLang(req.query?.lang);
});
