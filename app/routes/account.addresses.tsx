import type {CustomerAddressInput} from '@shopify/hydrogen/customer-account-api-types';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
import {
  data as routeData,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type Fetcher,
} from 'react-router';
import type {Route} from './+types/account.addresses';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {requireCustomerAuthStatus} from '~/lib/customer-auth.server';
import {readProtectedForm} from '~/lib/protected-write.server';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Addresses'}];
};

export async function loader({context}: Route.LoaderArgs) {
  await requireCustomerAuthStatus(context.customerAccount);

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;
  let submittedAddressId = '';

  const form = await readProtectedForm(request, {
    methods: ['POST', 'PUT', 'DELETE'],
    maxBytes: 16 * 1024,
  });
  if (form instanceof Response) return form;

  try {
    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }
    submittedAddressId = addressId;

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return routeData(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address: CustomerAddressInput = {};
    const keys: (keyof CustomerAddressInput)[] = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            return routeData(
              {
                error: {
                  [addressId]: data.customerAddressCreate.userErrors[0].message,
                },
              },
              {status: 400},
            );
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return {
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch {
          return routeData(
            {error: {[addressId]: 'Unable to create this address right now.'}},
            {status: 400},
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            return routeData(
              {
                error: {
                  [addressId]: data.customerAddressUpdate.userErrors[0].message,
                },
              },
              {status: 400},
            );
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch {
          return routeData(
            {error: {[addressId]: 'Unable to update this address right now.'}},
            {status: 400},
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            return routeData(
              {
                error: {
                  [addressId]: data.customerAddressDelete.userErrors[0].message,
                },
              },
              {status: 400},
            );
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return {error: null, deletedAddress: addressId};
        } catch {
          return routeData(
            {error: {[addressId]: 'Unable to delete this address right now.'}},
            {status: 400},
          );
        }
      }

      default: {
        return routeData(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch {
    return routeData(
      {
        error: {
          [submittedAddressId]:
            'Unable to update this address right now. Please try again.',
        },
      },
      {status: 400},
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="account-addresses">
      <header className="account-section-heading">
        <span className="eyebrow">Delivery book</span>
        <h2>Addresses</h2>
        <p>Save the places where you gather, gift, and share tea.</p>
      </header>
      <div className="account-address-layout">
        <section className="account-address-new" aria-labelledby="new-address-title">
          <h3 id="new-address-title">Add a new address</h3>
          <NewAddressForm key={addresses.nodes.length} />
        </section>
        <section className="account-address-saved" aria-labelledby="saved-addresses-title">
          <h3 id="saved-addresses-title">Saved addresses</h3>
          {!addresses.nodes.length ? (
            <div className="account-empty account-empty--compact">
              <span aria-hidden="true">◇</span>
              <p>You have no saved delivery addresses yet.</p>
            </div>
          ) : (
            <ExistingAddresses addresses={addresses} defaultAddress={defaultAddress} />
          )}
        </section>
      </div>
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  } as CustomerAddressInput;

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <button
          className="account-button account-button--primary"
          disabled={stateForMethod('POST') !== 'idle'}
          formMethod="POST"
          type="submit"
        >
          {stateForMethod('POST') !== 'idle' ? 'Creating' : 'Save address'}
        </button>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  return (
    <div className="account-address-list">
      {addresses.nodes.map((address) => (
        <AddressForm
          key={address.id}
          addressId={address.id}
          address={address}
          defaultAddress={defaultAddress}
        >
          {({stateForMethod}) => (
            <>
              <button
                className="account-button account-button--primary"
                disabled={stateForMethod('PUT') !== 'idle'}
                formMethod="PUT"
                type="submit"
              >
                {stateForMethod('PUT') !== 'idle' ? 'Saving' : 'Save'}
              </button>
              <button
                className="account-button account-button--quiet"
                disabled={stateForMethod('DELETE') !== 'idle'}
                formMethod="DELETE"
                type="submit"
              >
                {stateForMethod('DELETE') !== 'idle' ? 'Deleting' : 'Delete'}
              </button>
            </>
          )}
        </AddressForm>
      ))}
    </div>
  );
}

export function AddressForm({
  addressId,
  address,
  defaultAddress,
  children,
}: {
  addressId: AddressFragment['id'];
  address: CustomerAddressInput;
  defaultAddress: CustomerFragment['defaultAddress'];
  children: (props: {
    stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
  }) => React.ReactNode;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  const fieldPrefix = `address-${String(addressId).replace(/[^a-zA-Z0-9]/g, '')}`;
  const displayName = [address.firstName, address.lastName].filter(Boolean).join(' ');
  return (
    <Form id={addressId} className="account-form account-address-form">
      <fieldset className="account-form-card">
        <legend>
          {addressId === 'NEW_ADDRESS_ID' ? 'New address' : displayName || 'Delivery address'}
          {isDefaultAddress && <span className="account-default-badge">Default</span>}
        </legend>
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <div className="account-form-grid">
          <AddressInput prefix={fieldPrefix} label="First name" name="firstName" autoComplete="given-name" defaultValue={address.firstName} required />
          <AddressInput prefix={fieldPrefix} label="Last name" name="lastName" autoComplete="family-name" defaultValue={address.lastName} required />
          <AddressInput prefix={fieldPrefix} label="Company" name="company" autoComplete="organization" defaultValue={address.company} />
          <AddressInput prefix={fieldPrefix} label="Address line 1" name="address1" autoComplete="address-line1" defaultValue={address.address1} required wide />
          <AddressInput prefix={fieldPrefix} label="Address line 2" name="address2" autoComplete="address-line2" defaultValue={address.address2} wide />
          <AddressInput prefix={fieldPrefix} label="City" name="city" autoComplete="address-level2" defaultValue={address.city} required />
          <AddressInput prefix={fieldPrefix} label="State / Province" name="zoneCode" autoComplete="address-level1" defaultValue={address.zoneCode} required />
          <AddressInput prefix={fieldPrefix} label="Postal code" name="zip" autoComplete="postal-code" defaultValue={address.zip} required />
          <AddressInput prefix={fieldPrefix} label="Country code" name="territoryCode" autoComplete="country" defaultValue={address.territoryCode} placeholder="IN" maxLength={2} required />
          <AddressInput prefix={fieldPrefix} label="Phone" name="phoneNumber" autoComplete="tel" defaultValue={address.phoneNumber} placeholder="+91 98765 43210" pattern="^\+?[1-9]\d{3,14}$" type="tel" />
        </div>
        <label className="account-checkbox" htmlFor={`${fieldPrefix}-defaultAddress`}>
          <input
            defaultChecked={isDefaultAddress}
            id={`${fieldPrefix}-defaultAddress`}
            name="defaultAddress"
            type="checkbox"
          />
          <span>Set as default delivery address</span>
        </label>
        {error ? (
          <p className="account-form-message account-form-message--error" role="alert">{error}</p>
        ) : null}
        <div className="account-form-actions">
          {children({stateForMethod: (method) => (formMethod === method ? state : 'idle')})}
        </div>
      </fieldset>
    </Form>
  );
}

function AddressInput({
  prefix,
  label,
  name,
  defaultValue,
  wide = false,
  ...inputProps
}: {
  prefix: string;
  label: string;
  name: string;
  defaultValue?: string | null;
  wide?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'defaultValue'>) {
  const id = `${prefix}-${name}`;
  return (
    <div className={`account-field${wide ? ' account-field--wide' : ''}`}>
      <label htmlFor={id}>{label}{inputProps.required && <span aria-hidden="true"> *</span>}</label>
      <input id={id} name={name} defaultValue={defaultValue ?? ''} type="text" {...inputProps} />
    </div>
  );
}
