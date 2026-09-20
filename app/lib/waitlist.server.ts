const ADMIN_API_VERSION = '2026-07';
const WAITLIST_TAGS = ['waitlist', 'chapter-1-waitlist'];

type ShopifyResponse<T> = {
  data?: T;
  errors?: {message: string}[];
};

type Customer = {id: string; email: string | null};

export class WaitlistError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function saveWaitlistSubscriber(
  email: string,
  env: Pick<Env, 'PUBLIC_STORE_DOMAIN' | 'WRIT_TO_CUSTOMER_CLIENT_ID' | 'WRIT_TO_CUSTOMER_CLIENT_SECRET'>,
  fetcher: typeof fetch = fetch,
) {
  const domain = env.PUBLIC_STORE_DOMAIN?.trim();
  const clientId = env.WRIT_TO_CUSTOMER_CLIENT_ID?.trim();
  const clientSecret = env.WRIT_TO_CUSTOMER_CLIENT_SECRET?.trim();
  if (!domain || !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(domain) || !clientId || !clientSecret) {
    throw new WaitlistError('Waitlist is not configured', 503);
  }

  const tokenResponse = await fetcher(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenResponse.ok) throw new WaitlistError('Unable to connect to Shopify');
  const tokenBody = (await tokenResponse.json()) as {access_token?: string};
  if (!tokenBody.access_token) throw new WaitlistError('Unable to connect to Shopify');

  async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetcher(`https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': tokenBody.access_token!,
      },
      body: JSON.stringify({query, variables}),
    });
    if (!response.ok) throw new WaitlistError('Unable to save your email');
    const result = (await response.json()) as ShopifyResponse<T>;
    if (result.errors?.length || !result.data) throw new WaitlistError('Unable to save your email');
    return result.data;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const searchEmail = normalizedEmail.replace(/["\\]/g, '\\$&');
  const findCustomer = async () => {
    const result = await graphql<{customers: {nodes: Customer[]}}>(
      `query WaitlistCustomer($query: String!) {
        customers(first: 5, query: $query) { nodes { id email } }
      }`,
      {query: `email:"${searchEmail}"`},
    );
    return result.customers.nodes.find((customer) => customer.email?.toLowerCase() === normalizedEmail);
  };

  let customer = await findCustomer();
  if (!customer) {
    const result = await graphql<{
      customerCreate: {customer: Customer | null; userErrors: {message: string}[]};
    }>(
      `mutation CreateWaitlistCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id email }
          userErrors { message }
        }
      }`,
      {
        input: {
          email: normalizedEmail,
          tags: WAITLIST_TAGS,
          emailMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN',
            consentUpdatedAt: new Date().toISOString(),
          },
        },
      },
    );
    customer = result.customerCreate.customer ?? (await findCustomer());
    if (!customer) throw new WaitlistError('Unable to save your email');
  } else {
    const tagsResult = await graphql<{
      tagsAdd: {userErrors: {message: string}[]};
    }>(
      `mutation TagWaitlistCustomer($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) { userErrors { message } }
      }`,
      {id: customer.id, tags: WAITLIST_TAGS},
    );
    if (tagsResult.tagsAdd.userErrors.length) throw new WaitlistError('Unable to save your email');

    const consentResult = await graphql<{
      customerEmailMarketingConsentUpdate: {userErrors: {message: string}[]};
    }>(
      `mutation SubscribeWaitlistCustomer($input: CustomerEmailMarketingConsentUpdateInput!) {
        customerEmailMarketingConsentUpdate(input: $input) { userErrors { message } }
      }`,
      {
        input: {
          customerId: customer.id,
          emailMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN',
            consentUpdatedAt: new Date().toISOString(),
          },
        },
      },
    );
    if (consentResult.customerEmailMarketingConsentUpdate.userErrors.length) {
      throw new WaitlistError('Unable to record email consent');
    }
  }
  return {ok: true};
}
