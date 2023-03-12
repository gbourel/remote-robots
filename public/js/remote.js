import { VERSION, NSIX_LOGIN_URL, COOKIE_DOMAIN, debug } from './config.js';
import { sphero, dobot } from './robots.js';
import gui from './gui.js';
import ws from './websocket.js';

document.getElementById('version').textContent = VERSION;

let _pythonEditor = null; // Codemirror editor
let _nsix = false;    // If embedded in a nsix challenge

let _currentPrograms = [];

function login() {
  const current = location.href;
  location.href = `${NSIX_LOGIN_URL}?dest=${current}`;
}

function logout() {
  const cookies = ['ember_simple_auth-session', 'ember_simple_auth-session-expiration_time'];
  for (let cookie of cookies) {
    document.cookie=`${cookie}=; domain=${COOKIE_DOMAIN}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  location.reload();
}

function initClient(){
  // let purl = new URL(window.location.href);
  // if(purl && purl.searchParams) {
  //   let index = purl.searchParams.get("command");
  //   console.info('index', index)
  //   if(index) {
  //     _exerciseIdx = index;
  //   }
  // }
  // addEventListener('popstate', evt => {
  //   if(evt.state && evt.state.level) {
  //     loadExercises(evt.state.level);
  //   } else {
  //     displayMenu();
  //   }
  // });
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

ws.addHandler('btsender_connected', gui.enableSend);
ws.addHandler('btsender_disconnected', gui.disableSend);

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
