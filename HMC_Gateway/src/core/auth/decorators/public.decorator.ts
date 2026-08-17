import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route out of the global JwtAuthGuard (e.g. the pre-login auth journey, /health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
