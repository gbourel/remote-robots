import { VERSION, NSIX_LOGIN_URL, COOKIE_DOMAIN, AUTH_COOKIE, debug } from './config.js';
import { sphero, dobot } from './robots.js';
import gui from './gui.js';
import ws from './websocket.js';

document.getElementById('version').textContent = VERSION;

let _pythonEditor = null; // Codemirror editor
let _nsix = false;    // If embedded in a nsix challenge

let _currentPrograms = [];

function logout() {
  const cookies = [AUTH_COOKIE];
  for (let cookie of cookies) {
    document.cookie=`${cookie}=; domain=${COOKIE_DOMAIN}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  location.reload();
}

function initClient(){
  gui.initClient();

  ws.loadUser(user => {
    // TODO session cache
    debug('  🥸 User loaded', user);

    if(user) {
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');
      if(location.hash && location.hash.match('#sphero')) {
        gui.loadCommands(true, sphero);
      } else if(location.hash && location.hash.match('#dobot')) {
        gui.loadCommands(true, dobot);
      }
    } else {
      document.getElementById('login').classList.remove('hidden');
      gui.displayMenu();
    }

    gui.hideLoading();
  });
}

ws.addHandler('btsender_connected', (data) => { gui.enableSend(data?.type); });
ws.addHandler('btsender_disconnected', (data) => { gui.disableSend(data?.type); });

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}


if(location.href.match('teacher.html')) {
  gui.initTeacher();
} else {
  initClient();
}
