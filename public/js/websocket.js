import { WS_URL, LCMS_URL, debug } from './config.js';

const KEEPALIVE_DELAY = 10000; // 10s

export default class WS {
  #ws = null;
  #idCounter = 0;
  #token = null;
  #responseCallbacks = {};
  #handlers = {};
  #keepaliveTimeout = null;

  constructor() {
    debug('[WS] => New websocket controller instance.');
  }

  addHandler (type, handler) {
    if(!type) { return console.error('Missing type to add handler.'); }
    if(!handler) { return console.error('Missing handler to add for type', type); }
    if (!this.#handlers[type]) { this.#handlers[type] = []; }
    this.#handlers[type].push(handler);
  }

  async connect (cb) {
    if (this.#ws && this.#ws.readyState === this.#ws.OPEN) { // already connected
      return cb && cb();
    }
    let token = await this.#getWSToken();
    if (!token) {
      debug('[WS] WS token not found');
      return cb && cb();
    }
    this.#ws = new WebSocket(WS_URL + '?' + token);
    debug('[WS] connection');
    // On new WS message
    this.#ws.onmessage = (message) => {
      debug(' [WS] message', message)
      if (!message) { return; }
      // if message has some data
      if (message.data) {
        const content = JSON.parse(message.data);
        // for response messages
        if (content.event === '__response') {
          const cb = this.#responseCallbacks[content.src_id];
          if (cb) { cb(content.data); }
          delete this.#responseCallbacks[content.src_id];
        } else {
          const list = this.#handlers[content.event];
          if (list) {
            if(Array.isArray(list)){
              list.forEach(h => {
                if (h) { h(content.data); }
              })
            } else {
              list(content.data);
            }
          } else {
            debug(' [WS] Missing handler for event', content.event);
          }
        }
      }
    };

    this.#ws.onclose = () => {
      debug('[WS] disconnected');
      // localStorage.removeItem(TOKEN)
    };

    if (cb) {
      this.#ws.onopen = () => { cb(); };
    }
  }

  send (event, data, cb) {
    debug('[WS] Send', event, JSON.stringify(data))
    let msg = {
      event: event,
      data: data
    }
    if (cb && typeof cb === 'function') {
      msg.id = this.#getId()
      this.#responseCallbacks[msg.id] = cb
    }
    if(this.#keepaliveTimeout) {
      clearTimeout(this.#keepaliveTimeout);
      this.#keepaliveTimeout = null;
    }
    if (this.#ws && this.#ws.readyState === this.#ws.OPEN) {
      this.#ws.send(JSON.stringify(msg))
      this.#keepaliveTimeout = setTimeout(() => { this.send('__keepAlive', null); }, KEEPALIVE_DELAY);
    } else if (this.#ws && this.#ws.readyState === this.#ws.CLOSED) {
      connectWS(() => {
        this.#ws.send(JSON.stringify(msg))
        this.#keepaliveTimeout = setTimeout(() => { this.send('__keepAlive', null); }, KEEPALIVE_DELAY);
      })
    } else {
      this.#waitForConnection(() => {
        if (this.#ws) {
          this.#ws.send(JSON.stringify(msg))
          this.#keepaliveTimeout = setTimeout(() => { this.send('__keepAlive', null); }, KEEPALIVE_DELAY);
        }
        // FIXME else : missing WS ?
      })
    }
  }

  /** Télécharge le profil utilisateur depuis le LCMS. */
  loadUser(cb) {
    let token = this.#getAuthToken();
    if(token) {
      const meUrl = LCMS_URL + '/students/profile';
      const req = new Request(meUrl);
      fetch(req, {
        'headers': {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }).then(res => {
        let json = null;
        if(res.status === 200) {
          json = res.json();
        }
        return json;
      }).then(data => {
        cb(data.student);
      }).catch(err => {
        console.warn('Unable to fetch user', err);
        cb(null);
      });
    } else {
      cb(null);
    }
  }

  // Return next msg id
  #getId () {
    return this.#idCounter++;
  }

  // Wait for WS connection to execute callback
  #waitForConnection (cb) {
    setTimeout(() => {
      if (!this.#ws) {
        this.connectWS(cb)
      } else if (this.#ws.readyState === this.#ws.OPEN) {
        cb()
      } else if (this.#ws.readyState === this.#ws.CLOSED) {
        this.connectWS(cb)
      } else {
        this.#waitForConnection(cb)
      }
    }, 100)
  }

  /** Récupère le token de connexion depuis le cookie associé. */
  #getAuthToken() {
    if(this.#token !== null) { return this.#token; }
    if(document.cookie) {
      const name = 'ember_simple_auth-session='
      let cookies = decodeURIComponent(document.cookie).split(';');
      for (let c of cookies) {
        let idx = c.indexOf(name);
        if(idx > -1) {
          let value = c.substring(name.length + idx);
          let json = JSON.parse(value);
          if(json.authenticated.access_token) {
            this.#token = json.authenticated.access_token;
          }
        }
      }
    }
    return this.#token;
  }

  #getWSToken() {
    return new Promise((resolve, reject) => {
      let atok = this.#getAuthToken();
      if(!atok) {
        debug('[WS] Auth token not found');
        return resolve(null);
      }
      fetch(LCMS_URL + '/api/nsixSignin', {
        'method': 'POST',
        'headers': {
          'Authorization': 'Bearer ' + atok,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }).then(res => {
        let json = null;
        if(res.status === 200) {
          json = res.json();
        }
        return json;
      }).then(data => {
        debug('[WS] Signed in', data);
        resolve(data.token);
      }).catch(err => {
        debug('[WS] Unable to fetch token', err);
        resolve(null);
      });
      return null;
    });
  }
}
