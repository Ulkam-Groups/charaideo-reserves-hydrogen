export const RAZORPAY_ASSETS = {
  script: 'https://checkout.razorpay.com/v1/magic-checkout.js',
} as const;

export const RAZORPAY_CSP = {
  styleSrc: ['https://checkout.razorpay.com', 'https://*.razorpay.com'],
  scriptSrc: ['https://checkout.razorpay.com', 'https://cdn.razorpay.com'],
  connectSrc: [
    'https://api.razorpay.com',
    'https://checkout.razorpay.com',
    'https://*.razorpay.com',
  ],
  frameSrc: [
    'https://api.razorpay.com',
    'https://checkout.razorpay.com',
    'https://*.razorpay.com',
  ],
  imgSrc: ['https://checkout.razorpay.com', 'https://*.razorpay.com'],
} as const;
