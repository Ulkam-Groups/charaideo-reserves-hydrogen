import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import type {Route} from './+types/account.profile';
import {requireCustomerAuthStatus} from '~/lib/customer-auth.server';
import {readProtectedForm} from '~/lib/protected-write.server';

export type ActionResponse = {
  error: string | null;
  customer: CustomerFragment | null;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Profile'}];
};

export async function loader({context}: Route.LoaderArgs) {
  await requireCustomerAuthStatus(context.customerAccount);

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  const form = await readProtectedForm(request, {methods: ['PUT'], maxBytes: 16 * 1024});
  if (form instanceof Response) return form;

  try {
    const customer: CustomerUpdateInput = {};
    const validInputKeys = ['firstName', 'lastName'] as const;
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key as any)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key as (typeof validInputKeys)[number]] = value;
      }
    }

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
  } catch {
    return data(
      {
        error: 'Unable to update your profile right now. Please try again.',
        customer: null,
      },
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const action = useActionData<ActionResponse>();
  const customer = action?.customer ?? account?.customer;

  return (
    <div className="account-profile">
      <header className="account-section-heading">
        <span className="eyebrow">Personal details</span>
        <h2>My profile</h2>
        <p>Keep your name current for correspondence and future orders.</p>
      </header>
      <Form method="PUT" className="account-form">
        <fieldset className="account-form-card">
          <legend>Personal information</legend>
          <div className="account-form-grid">
            <div className="account-field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="First name"
                defaultValue={customer.firstName ?? ''}
                minLength={2}
              />
            </div>
            <div className="account-field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
                defaultValue={customer.lastName ?? ''}
                minLength={2}
              />
            </div>
          </div>
        </fieldset>
        <fieldset className="account-form-card account-contact-card">
          <legend>Account contact</legend>
          <div className="account-form-grid">
            <div className="account-field">
              <label htmlFor="accountEmail">Email address</label>
              <input
                id="accountEmail"
                type="email"
                value={customer.emailAddress?.emailAddress ?? 'Not provided'}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="account-field">
              <label htmlFor="accountPhone">Phone number</label>
              <input
                id="accountPhone"
                type="tel"
                value={customer.phoneNumber?.phoneNumber ?? 'Not provided'}
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>
          <p className="account-field-note">
            Contact and sign-in details are protected by Shopify Customer Accounts.
          </p>
        </fieldset>
        {action?.error ? (
          <p className="account-form-message account-form-message--error" role="alert">{action.error}</p>
        ) : action?.customer ? (
          <p className="account-form-message account-form-message--success" role="status">Profile updated.</p>
        ) : null}
        <button className="account-button account-button--primary" type="submit" disabled={state !== 'idle'}>
          {state !== 'idle' ? 'Updating' : 'Update'}
        </button>
      </Form>
    </div>
  );
}
