import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

/**
 * Documents a read endpoint's 200 response as the Sanaad success envelope
 * (`{ result, opstatus: 0, status: 'success', httpStatusCode: 200 }`) produced by
 * the ResponseInterceptor, with a real example payload.
 *
 * `example` is the inner `result` value — the raw payload the controller returns
 * — so the documented example matches exactly what a client receives over HTTP,
 * envelope included. Examples are captured from real successful calls
 * (see api_test.json), never fabricated.
 */
export function ApiReadOkResponse(options: {
  description?: string;
  example: unknown;
}): MethodDecorator {
  const { description, example } = options;
  return applyDecorators(
    ApiOkResponse({
      description: description ?? 'Successful read (Sanaad success envelope).',
      schema: {
        example: {
          result: example,
          opstatus: 0,
          status: 'success',
          httpStatusCode: 200,
        },
      },
    }),
  );
}
