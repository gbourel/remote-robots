
export const VERSION = 'v0.9.2';

const host = window.location.host;
export const dev = host.startsWith('localhost') || host.startsWith('nsix.test');
export const debug = (dev || location.href.match('#debug')) ? console.info : () => {};

export const AUTH_COOKIE = 'neossot';
export const NSIX_LOGIN_URL = dev ?  'http://nsix.test:5173/login' : 'https://www.nsix.fr/login'
export const LCMS_URL = dev ? 'http://nsix.test:5000/api' : 'https://lcms3.nsix.fr/api';
export const WS_URL = dev ? 'ws://nsix.test:5001' : 'wss://lcms.nsix.fr/websockets';
export const COOKIE_DOMAIN = dev ? '.nsix.test' : '.nsix.fr';
