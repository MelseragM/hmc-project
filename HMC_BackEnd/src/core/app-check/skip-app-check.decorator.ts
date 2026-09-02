import { SetMetadata } from '@nestjs/common';

export const SKIP_APP_CHECK_KEY = 'skipAppCheck';

/**
 * Exempt a route from App Check.
 *
 * For endpoints that are not called by the app: uptime probes, the diagnostics
 * consoles, anything a monitor or a human hits with curl. Every mobile route —
 * including login — should stay covered, since blocking scripted credential
 * attempts is a large part of the point.
 */
export const SkipAppCheck = () => SetMetadata(SKIP_APP_CHECK_KEY, true);
