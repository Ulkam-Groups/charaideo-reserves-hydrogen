const DEFAULT_ADMIN_API_VERSION = '2026-07';
const CONTACT_METAOBJECT_TYPE = 'contact_submission';

type ContactSubmission = {
  name: string;
  email: string;
  phone: string;
  enquiryType: string;
  orderNumber: string;
  message: string;
};

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{message: string}>;
};

function createEnquiryId(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const date = ['year', 'month', 'day']
    .map((type) => dateParts.find((part) => part.type === type)?.value ?? '')
    .join('');
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
  return `CR-${date}-${suffix}`;
}

export class ContactSubmissionError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function getAdminAccessToken(env: Env, fetcher: typeof fetch) {
  const domain = env.SHOPIFY_ADMIN_STORE_DOMAIN?.trim() || env.PUBLIC_STORE_DOMAIN?.trim();
  const clientId = env.SHOPIFY_ADMIN_CLIENT_ID?.trim() || env.WRIT_TO_CUSTOMER_CLIENT_ID?.trim();
  const clientSecret =
    env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim() || env.WRIT_TO_CUSTOMER_CLIENT_SECRET?.trim();
  if (domain && clientId && clientSecret) {
    const response = await fetcher(`https://${domain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const body = (await response.json()) as {access_token?: string};
    if (response.ok && body.access_token) return body.access_token;
    console.error('Contact form Shopify token exchange failed', {status: response.status});
  }

  const permanentToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (permanentToken) return permanentToken;
  if (!domain) {
    throw new ContactSubmissionError('Contact form storage is not configured', 503);
  }
  throw new ContactSubmissionError('Contact form storage is not configured', 503);
}

export async function verifyContactCaptcha(
  token: string,
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) throw new ContactSubmissionError('Contact form CAPTCHA is not configured', 503);
  if (!token) throw new ContactSubmissionError('Please complete the security check', 400);

  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: request.headers.get('oxygen-buyer-ip') ?? '',
    }),
  });
  const result = (await response.json()) as {success?: boolean};
  if (!response.ok || !result.success) {
    throw new ContactSubmissionError('Security check failed. Please try again.', 400);
  }
}

export async function saveContactSubmission(
  submission: ContactSubmission,
  env: Env,
  fetcher: typeof fetch = fetch,
) {
  const enquiryId = createEnquiryId();
  const domain = env.SHOPIFY_ADMIN_STORE_DOMAIN?.trim() || env.PUBLIC_STORE_DOMAIN?.trim();
  if (!domain || !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain)) {
    throw new ContactSubmissionError('Contact form storage is not configured', 503);
  }
  const accessToken = await getAdminAccessToken(env, fetcher);
  const configuredVersion = env.SHOPIFY_ADMIN_API_VERSION?.trim();
  const apiVersion =
    configuredVersion && /^\d{4}-\d{2}$/.test(configuredVersion)
      ? configuredVersion
      : DEFAULT_ADMIN_API_VERSION;

  async function graphql<T>(
    operation: string,
    query: string,
    variables: Record<string, unknown>,
  ) {
    const response = await fetcher(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({query, variables}),
    });
    const result = (await response.json()) as ShopifyGraphqlResponse<T>;
    if (!response.ok || result.errors?.length || !result.data) {
      console.error('Contact form Shopify GraphQL failed', {
        operation,
        status: response.status,
        errors: result.errors?.map(({message}) => message) ?? [],
      });
      throw new ContactSubmissionError('Unable to save your message');
    }
    return result.data;
  }

  const result = await graphql<{
    metaobjectCreate: {
      metaobject: {id: string} | null;
      userErrors: Array<{message: string}>;
    };
  }>(
    'CreateContactSubmission',
    `mutation CreateContactSubmission($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { message }
      }
    }`,
    {
      metaobject: {
        type: CONTACT_METAOBJECT_TYPE,
        fields: [
          {key: 'enquiry_id', value: enquiryId},
          {key: 'name', value: submission.name},
          {key: 'email', value: submission.email},
          ...(submission.phone ? [{key: 'phone', value: submission.phone}] : []),
          {key: 'enquiry_type', value: submission.enquiryType},
          ...(submission.orderNumber
            ? [{key: 'order_number', value: submission.orderNumber}]
            : []),
          {key: 'message', value: submission.message},
          {key: 'submitted_at', value: new Date().toISOString()},
          {key: 'source', value: 'Hydrogen contact page'},
        ],
      },
    },
  );
  if (!result.metaobjectCreate.metaobject || result.metaobjectCreate.userErrors.length) {
    console.error('Contact form Shopify mutation rejected', {
      operation: 'CreateContactSubmission',
      errors: result.metaobjectCreate.userErrors.map(({message}) => message),
    });
    throw new ContactSubmissionError('Unable to save your message');
  }
  return enquiryId;
}
