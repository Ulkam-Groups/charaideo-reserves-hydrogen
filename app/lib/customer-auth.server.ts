type CustomerAccountAuth = {
  handleAuthStatus(): Promise<unknown>;
};

export async function requireCustomerAuthStatus(customerAccount: CustomerAccountAuth) {
  await customerAccount.handleAuthStatus();
}
