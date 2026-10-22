import type {Route} from './+types/api.contact';
import {
  ContactSubmissionError,
  saveContactSubmission,
  verifyContactCaptcha,
} from '~/lib/contact.server';
import {enforceApiRateLimit} from '~/lib/api-rate-limit.server';

const ENQUIRY_TYPES = new Set([
  'Order support',
  'Product question',
  'Wholesale or gifting',
  'Visit the estate',
  'Other',
]);

const MAX_CONTACT_REQUEST_BYTES = 32_768;
const MAX_MESSAGE_CHARACTERS = 400;

function value(formData: FormData, key: string, maximum: number) {
  const entry = formData.get(key);
  return typeof entry === 'string' ? entry.trim().slice(0, maximum) : '';
}

async function limitedFormData(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (
    !contentType.startsWith('application/x-www-form-urlencoded') &&
    !contentType.startsWith('multipart/form-data')
  ) {
    throw new ContactSubmissionError('Unsupported request format.', 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTACT_REQUEST_BYTES) {
    throw new ContactSubmissionError('Your message is too large.', 413);
  }

  if (!request.body) return new FormData();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const {done, value: chunk} = await reader.read();
    if (done) break;
    received += chunk.byteLength;
    if (received > MAX_CONTACT_REQUEST_BYTES) {
      await reader.cancel();
      throw new ContactSubmissionError('Your message is too large.', 413);
    }
    chunks.push(chunk);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body,
  }).formData();
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    const formData = await limitedFormData(request);
    if (value(formData, 'website', 200)) return Response.json({ok: true});

    const messageEntry = formData.get('message');
    const message = typeof messageEntry === 'string' ? messageEntry.trim() : '';
    if (message.length > MAX_MESSAGE_CHARACTERS) {
      throw new ContactSubmissionError(
        `Please keep your message within ${MAX_MESSAGE_CHARACTERS} characters.`,
        400,
      );
    }

    const submission = {
      name: value(formData, 'name', 100),
      email: value(formData, 'email', 254).toLowerCase(),
      phone: value(formData, 'phone', 30),
      enquiryType: value(formData, 'enquiryType', 60),
      orderNumber: value(formData, 'orderNumber', 40),
      message,
    };
    if (
      submission.name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email) ||
      !ENQUIRY_TYPES.has(submission.enquiryType) ||
      submission.message.length < 10
    ) {
      throw new ContactSubmissionError('Please complete all required fields correctly.', 400);
    }

    const cache = await caches.open('api-rate-limits');
    const limited = await enforceApiRateLimit(request, cache, '/api/contact');
    if (limited) return limited;

    await verifyContactCaptcha(
      value(formData, 'cf-turnstile-response', 2048),
      request,
      context.env,
    );
    const enquiryId = await saveContactSubmission(submission, context.env);
    return Response.json(
      {
        ok: true,
        enquiryId,
        message: `Thank you. Your enquiry ${enquiryId} has been received. We will reply within two business days.`,
      },
      {headers: {'Cache-Control': 'no-store'}},
    );
  } catch (error) {
    console.error(
      'Contact submission failed',
      error instanceof ContactSubmissionError ? error.message : 'Unexpected error',
    );
    return Response.json(
      {
        error:
          error instanceof ContactSubmissionError
            ? error.message
            : 'Unable to send your message. Please try again.',
      },
      {
        status: error instanceof ContactSubmissionError ? error.status : 502,
        headers: {'Cache-Control': 'no-store'},
      },
    );
  }
}
