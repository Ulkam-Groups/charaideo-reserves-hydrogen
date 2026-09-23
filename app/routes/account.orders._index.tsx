import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/account.orders._index';
import {useRef} from 'react';
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {formatDateLong} from '~/lib/formatDate';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
  type OrderFilterParams,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';

type OrdersLoaderData = {
  customer: CustomerOrdersFragment;
  filters: OrderFilterParams;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    context.monitor?.failure('customer_account.query.failure', {operation: 'orders', reason: errors?.length ? 'graphql' : 'missing_result'});
    throw Error('Customer orders not found');
  }

  return {customer: data.customer, filters};
}

export default function Orders() {
  const {customer, filters} = useLoaderData<OrdersLoaderData>();
  const {orders} = customer;

  return (
    <div className="orders">
      <header className="account-section-heading account-section-heading--with-rule">
        <span className="eyebrow">Tea journeys</span>
        <h2>Your orders</h2>
        <p>Follow recent selections from our cabinet to your table.</p>
      </header>
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

function OrdersTable({
  orders,
  filters,
}: {
  orders: CustomerOrdersFragment['orders'];
  filters: OrderFilterParams;
}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="account-orders-list" aria-live="polite">
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders} resourcesClassName="account-order-cards">
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

function EmptyOrders({hasFilters = false}: {hasFilters?: boolean}) {
  return (
    <div className="account-empty">
      <span aria-hidden="true">◇</span>
      {hasFilters ? (
        <>
          <h3>No matching journeys.</h3>
          <p>Try a different order or confirmation number.</p>
          <Link className="text-link" to="/account/orders">Clear filters →</Link>
        </>
      ) : (
        <>
          <h3>Your tea shelf is waiting.</h3>
          <p>You haven&apos;t placed an order yet. Begin with a reserve selected for your daily ritual.</p>
          <Link className="account-button account-button--primary" to="/collections/all">Explore the collection</Link>
        </>
      )}
    </div>
  );
}

function OrderSearchForm({
  currentFilters,
}: {
  currentFilters: OrderFilterParams;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="order-search-form"
      aria-label="Search orders"
    >
      <fieldset className="order-search-fieldset">
        <legend className="order-search-legend">Find an order</legend>

        <div className="order-search-inputs">
          <div className="account-field">
            <label htmlFor="order-number">Order number</label>
            <input id="order-number" type="search" name={ORDER_FILTER_FIELDS.NAME} placeholder="e.g. 1042" defaultValue={currentFilters.name || ''} className="order-search-input" />
          </div>
          <div className="account-field">
            <label htmlFor="confirmation-number">Confirmation number</label>
            <input id="confirmation-number" type="search" name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER} placeholder="Enter confirmation number" defaultValue={currentFilters.confirmationNumber || ''} className="order-search-input" />
          </div>
        </div>

        <div className="order-search-buttons">
          <button className="account-button account-button--primary" type="submit" disabled={isSearching}>
            {isSearching ? 'Searching' : 'Search'}
          </button>
          {hasFilters && (
            <button
              className="account-button account-button--quiet"
              type="button"
              disabled={isSearching}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  return (
    <article className="account-order-card">
      <div className="account-order-card-index">
        <span>Order</span>
        <strong>#{order.number}</strong>
      </div>
      <div className="account-order-card-main">
        <p className="account-order-date">Placed {formatDateLong(order.processedAt)}</p>
        {order.confirmationNumber && <p>Confirmation · {order.confirmationNumber}</p>}
        <div className="account-order-statuses">
          <span>{order.financialStatus}</span>
          {fulfillmentStatus && <span>{fulfillmentStatus}</span>}
        </div>
      </div>
      <div className="account-order-card-total">
        <span>Total</span>
        <Money data={order.totalPrice} />
      </div>
      <Link className="account-order-link" to={`/account/orders/${btoa(order.id)}`}>View details <span aria-hidden="true">→</span></Link>
    </article>
  );
}
