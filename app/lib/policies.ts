/** Content used when a policy has not been published in Shopify yet. */
export const POLICY_PAGES = [
  {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    field: 'privacyPolicy',
    fallbackBody: `
      <h2>Information we use</h2>
      <p>When you browse or place an order with Charaideo Reserves™, we may receive the contact, delivery, and order information you provide. We use it to process purchases, arrange delivery, answer enquiries, and provide customer support.</p>
      <h2>Store services</h2>
      <p>Our storefront and checkout use Shopify. Information needed to complete an order may also be shared with payment, delivery, and other service providers involved in fulfilling it. Those services process information according to their own terms and privacy practices.</p>
      <h2>Cookies and choices</h2>
      <p>Essential cookies help the store and cart work. Optional analytics and marketing technologies may be used according to the choices available through the store's privacy controls.</p>
      <h2>Questions about your data</h2>
      <p>To ask about information associated with your account or an order, email <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>. Include enough detail for us to identify your request, but do not email payment card details.</p>
    `,
  },
  {
    handle: 'refund-policy',
    title: 'Refund Policy',
    field: 'refundPolicy',
    fallbackBody: `
      <h2>Need help with an order?</h2>
      <p>If your tea arrives damaged, incomplete, or different from what you ordered, contact us at <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a> with your order number, a description of the issue, and photographs where useful.</p>
      <h2>Return and refund requests</h2>
      <p>Please contact us before sending an item back so we can review the request and provide the appropriate return instructions. We assess requests based on the product's condition, the order details, and applicable consumer law. We will confirm any approved refund and its method directly with you.</p>
      <h2>Contact</h2>
      <p>For questions about a cancellation, return, or refund, email <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a> or call <a href="tel:+918431988910">+91 84319 88910</a>.</p>
    `,
  },
  {
    handle: 'shipping-policy',
    title: 'Shipping Policy',
    field: 'shippingPolicy',
    fallbackBody: `
      <h2>Delivery options</h2>
      <p>Available shipping methods and charges are shown at checkout for the delivery address you enter. Please review the address and contact number before placing your order.</p>
      <h2>After your order</h2>
      <p>We prepare orders for dispatch and share delivery or tracking information when it is available. Delivery estimates can change because of location, carrier operations, holidays, or other circumstances outside our control.</p>
      <h2>Shipping questions</h2>
      <p>For an update or help with a delivery, contact <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a> with your order number. Charaideo Reserves™ is based in Ownguri Gaon, Rupai Siding, Assam 786153, India.</p>
    `,
  },
  {
    handle: 'terms-of-service',
    title: 'Terms of Service',
    field: 'termsOfService',
    fallbackBody: `
      <h2>Using this store</h2>
      <p>Charaideo Reserves™ provides information about its teas and accepts orders through this storefront. Please provide accurate account, contact, and delivery details when ordering, and use the site lawfully.</p>
      <h2>Products and orders</h2>
      <p>Product availability, prices, shipping charges, and the order total are presented during shopping and checkout. We may contact you if an order cannot be fulfilled as placed. Your order confirmation and the details displayed at checkout form the record of your purchase.</p>
      <h2>Site content</h2>
      <p>Product descriptions, images, branding, and other site content are provided for shopping and information. Please contact us before reusing Charaideo Reserves™ materials.</p>
      <h2>Contact</h2>
      <p>Questions about these terms or an order can be sent to <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>.</p>
    `,
  },
] as const;

export function getPolicyPage(handle: string | undefined) {
  return POLICY_PAGES.find((policy) => policy.handle === handle);
}
