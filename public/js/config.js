
export const VERSION = 'v0.8.0';

const host = window.location.host;
export const dev = host.startsWith('localhost') || host.startsWith('ileauxsciences.test');
export const debug = (dev || location.href.match('#debug')) ? console.info : () => {};

export const NSIX_LOGIN_URL = dev ? 'http://ileauxsciences.test:4200/connexion' : 'http://app.nsix.fr/connexion'
export const LCMS_URL = dev ? 'http://dev.ileauxsciences.test:9976' : 'https://webamc.nsix.fr';
export const WS_URL = dev ? 'ws://dev.ileauxsciences.test:9976' : 'wss://webamc.nsix.fr';
export const COOKIE_DOMAIN = dev ? '.ileauxsciences.test' : '.nsix.fr';
