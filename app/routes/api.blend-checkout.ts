const retired = () =>
  Response.json(
    {
      error:
        'Custom blend checkout is no longer available. Use the standard product cart.',
    },
    {
      status: 410,
      headers: {'Cache-Control': 'no-store'},
    },
  );

export const loader = retired;
export const action = retired;
