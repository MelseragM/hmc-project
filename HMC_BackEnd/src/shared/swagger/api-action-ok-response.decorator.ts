import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

/**
 * Documents a submit/action endpoint's 200 response as the Sanaad action
 * envelope (`{ status, successflag, errormessage, httpStatusCode }`) produced
 * by `toSubmitResult`/`ResponseInterceptor`, with a real example captured from
 * a successful call (see api_test_work.json). Mirrors `ApiReadOkResponse`,
 * which documents the read envelope instead.
 */
export function ApiActionOkResponse(options: {
  description?: string;
  example: unknown;
}): MethodDecorator {
  const { description, example } = options;
  return applyDecorators(
    ApiOkResponse({
      description: description ?? 'Submit result (Sanaad action envelope).',
      schema: { example },
    }),
  );
}
