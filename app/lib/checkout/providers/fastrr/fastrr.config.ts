export const FASTRR_ASSETS = {
  script:
    'https://fastrr-boost-ui.pickrr.com/assets/js/channels/shopify.js',
  stylesheet:
    'https://fastrr-boost-ui.pickrr.com/assets/styles/shopify.css',
} as const;

export const FASTRR_CSP = {
  styleSrc: ['https://fastrr-boost-ui.pickrr.com'],
  scriptSrc: [
    'https://fastrr-boost-ui.pickrr.com',
    'https://sr-cdn.shiprocket.in',
    'https://otpless.com',
  ],
  connectSrc: [
    'https://fastrr-boost-ui.pickrr.com',
    'https://sr-cdn.shiprocket.in',
    'https://uptime2.fastrr.com',
    'https://events.pickrr.com',
    'https://cred.club',
    'https://tez.google.com',
  ],
  frameSrc: ['https://fastrr-boost-ui.pickrr.com'],
  imgSrc: [
    'https://fastrr-boost-ui.pickrr.com',
    'https://sr-cdn.shiprocket.in',
  ],
} as const;
