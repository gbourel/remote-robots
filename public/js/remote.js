(function (){

const VERSION = 'v0.6.2';
document.getElementById('version').textContent = VERSION;

const host = window.location.host;
const dev = host.startsWith('localhost') || host.startsWith('ileauxsciences.test');
let debug = () => {};
if(dev || location.href.match('#debug')) {
  debug = console.info;
}

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge

let NSIX_LOGIN_URL = 'http://app.nsix.fr/connexion'
let LCMS_URL = 'https://webamc.nsix.fr';
let WS_URL = 'wss://webamc.nsix.fr';
let COOKIE_DOMAIN = '.nsix.fr';

if(dev) {
  NSIX_LOGIN_URL = 'http://ileauxsciences.test:4200/connexion';
  LCMS_URL = 'http://dev.ileauxsciences.test:9976';
  WS_URL = 'ws://dev.ileauxsciences.test:9976';
  COOKIE_DOMAIN = '.ileauxsciences.test';
}

let _user = null;
let _token = null;


let _over = false;  // python running

let _currentPrograms = [];

// WS variables

const responseCallbacks = {};
const handlers = {};

const KEEPALIVE_DELAY = 10000; // 10s
let _keepaliveTimeout = null;

let _ws = null;
let _idCounter = 0;

let _currentInfo = null; // Current robot info
const infos = {
  'sphero': {
    'server': 'ws://localhost:7007',
    'type': 'sphero',
    'path': '/#sphero',
    'title': 'Programmation du robot **Sphero** :',
    'defaultSrc': 'import sphero\n\norb = sphero.connect()\n\norb.set_rgb_led(0,120,0)\n\norb.move(0) # Se déplace direction 0°\norb.wait(1) # Attend 1s\n'
  },
  'dobot': {
    'server': 'ws://localhost:7008',
    'type': 'dobot',
    'path': '/#dobot',
    'title': 'Programmation du bras robotisé **Dobot magician** :',
    'defaultSrc': "import pydobot\n\ndevice = pydobot.Dobot()\n\n(x, y, z, r, j1, j2, j3, j4) = device.pose()\nprint(f'x:{x} y:{y} z:{z} r:{r} j1:{j1} j2:{j2} j3:{j3} j4:{j4}')\n\ndevice.move_to(x + 20, y, z, r, wait=True)\ndevice.move_to(x, y, z, r, wait=True)\n"
  },
};

function displayMenu() {
  const menu = document.getElementById('mainmenu');
  const progress = document.getElementById('progress');
  const main = document.getElementById('main');
  const instruction = document.getElementById('instruction');
  instruction.innerHTML = '';
  progress.classList.add('hidden');
  main.classList.add('hidden');
  menu.style.transform = 'translate(0, 0)';
}

let main = null;

function initPythonEditor() {
  _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
    value: "",
    mode:  "python",
    lineNumbers: true,
    theme: 'monokai',
    indentUnit: 4,
    extraKeys: {
      'Tab': (cm) => cm.execCommand("indentMore"),
      'Shift-Tab': (cm) => cm.execCommand("indentLess"),
      'Ctrl-Enter': runit
    }
  });
}


function displayCommands(info) {
  // const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const main = document.getElementById('main');
  const menu = document.getElementById('mainmenu');
  menu.style.transform = 'translate(0, 100vh)';
  main.classList.remove('hidden');

  let lastprog = localStorage.getItem(getProgKey(info.type));
  if(!_pythonEditor) { initPythonEditor(); }
  if(lastprog && lastprog.length) {
    _pythonEditor.setValue(lastprog);
  } else {
    _pythonEditor.setValue(info.defaultSrc);
  }
  instruction.innerHTML = marked.parse(info.title);
}

// Display login required popup
function loginRequired() {
  let lr = document.getElementById('login-required');
  lr.style.width = '100%';
  lr.onclick = hideLoginPopup;
  document.getElementById('login-popup').style.transform = 'translate(0,0)';
}

function hideLoginPopup() {
  document.getElementById('login-popup').style.transform = 'translate(0,-70vh)';
  document.getElementById('login-required').style.width = '0%';
}

// Load command view
function loadCommands(pushHistory, info){
  if(!_user) { return loginRequired(); }
  if(pushHistory) {
    history.pushState(null, '', info.path);
  }
  _currentInfo = info;
  displayCommands(info);
}


// Reload initial prog
function resetProg(){
  if(_exercise && _exercise.proposals && _exercise.proposals.length > 0) {
    if(_pythonEditor) {
      _pythonEditor.setValue(_exercise.proposals);
    }
  }
}

// On Python script completion
function onCompletion(mod) {
//   let nbFailed = _tests.length;
//   let table = document.importNode(document.querySelector('#results-table').content, true);
//   let lineTemplate = document.querySelector('#result-line');
//   if(_tests.length > 0 && _tests.length === _output.length) {
//     nbFailed = 0;
//     for (let i = 0 ; i < _tests.length; i++) {
//       let line = null;
//       if(_tests[i].option !== 'hide') {
//         line = document.importNode(lineTemplate.content, true);
//         let cells = line.querySelectorAll('td');
//         cells[0].textContent = _tests[i].python;
//         cells[1].textContent = _tests[i].value.trim();
//         cells[2].textContent = _output[i].trim();
//       }
//       if(_tests[i].value.trim() !== _output[i].trim()) {
//         nbFailed += 1;
//         line && line.querySelector('tr').classList.add('ko');
//       } else {
//         line && line.querySelector('tr').classList.add('ok');
//       }
//       if(line) {
//         let tbody = table.querySelector('tbody');
//         tbody.append(line);
//       }
//     }
//     if (nbFailed === 0) {
//       const answer = sha256(_output);
//       if(parent) {
//         parent.window.postMessage({
//           'answer': answer,
//           'from': 'pix'
//         }, '*');
//       }
//       registerSuccess(_exercise.id, answer);
//       displaySuccess();
//     }
//   }
//   const elt = document.createElement('div');
//   let content = '';
//   if(nbFailed > 0) {
//     elt.classList.add('failed');
//     content = `Résultat : ${_tests.length} test`;
//     if(_tests.length > 1) { content += 's'; }
//     content += `, ${nbFailed} échec`
//     if(nbFailed > 1) { content += 's'; }
//   } else {
//     elt.classList.add('success');
//     if(_tests.length > 1) {
//       content = `Succès des ${_tests.length} tests`;
//     } else {
//       content = `Succès de ${_tests.length} test`;
//     }
//   }
//   elt.innerHTML += `<div class="result">${content}</div>`;
//   if(_tests.find(t => t.option !== 'hide')){
//     elt.appendChild(table);
//   }
//   document.getElementById('output').appendChild(elt);
}

// Python script stdout
function outf(text) {
  if(text.startsWith('### END_OF_USER_INPUT ###')) {
    return _over = true;
  }
  if(_over === false) {
    document.getElementById('output').innerHTML += `<div>${text}</div>`;
  } else {
    _output.push(text.trim());
  }
}
// Load python modules
function builtinRead(x) {
  if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}

// Run python script
function runit() {
  if(_pythonEditor === null) { return; }
  let prog = _pythonEditor.getValue();
  let outputElt = document.getElementById('output');
  outputElt.classList.remove('hidden');
  outputElt.innerHTML = '';
  Sk.pre = 'output';
  Sk.configure({
    output: outf,
    read: builtinRead,
    __future__: Sk.python3
  });
  prog += "\nprint('### END_OF_USER_INPUT ###')";
  // for (let t of _tests) {
  //   let instruction = t.python.trim();
  //   if(!instruction.startsWith('print')) {
  //     instruction = `print(${instruction})`;
  //   }
  //   prog += "\n" + instruction;
  // }
  _output = [];
  _over = false;
  // if(prog.startsWith('import turtle')) {
    document.getElementById('pythonsrc').style.width = '50%';
    document.getElementById('turtlecanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  // }
  // if(prog.startsWith('import webgl')) {
  //   document.getElementById('webglcanvas').classList.remove('hidden');
  //   outputElt.style.width = '100%';
  // }
  Sk.misceval.asyncToPromise(function() {
    return Sk.importMainWithBody("<stdin>", false, prog, true);
  }).then(onCompletion,
  function(err) {
    // TODO use this hack to change line numbers if we want to prepend some python lines
    // eg. max = lambda _: 'Without using max !'
    // if(err.traceback) {
    //   err.traceback.forEach(tb => {
    //     console.info(tb)
    //     if(tb && tb.lineno > -1) {
    //       tb.lineno -= x;
    //     }
    //   });
    // }
    let msg = err.toString();
    if(!_over) {
      document.getElementById('output').innerHTML += `<div class="error">${msg}</div>`;
    } else {
      if(msg.startsWith('NameError: name')) {
        let idx = msg.lastIndexOf('on line');
        document.getElementById('output').innerHTML += `<div class="error">${msg.substring(0, idx)}</div>`;
      }
      onCompletion();
    }
  });
}

function login() {
  const current = location.href;
  location.href = `${NSIX_LOGIN_URL}?dest=${current}`;
}

/** Récupère le token de connexion depuis le cookie associé. */
function getAuthToken(){
  if(_token !== null) { return _token; }
  if(document.cookie) {
    const name = 'ember_simple_auth-session='
    let cookies = decodeURIComponent(document.cookie).split(';');
    for (let c of cookies) {
      let idx = c.indexOf(name);
      if(idx > -1) {
        let value = c.substring(name.length + idx);
        let json = JSON.parse(value);
        if(json.authenticated.access_token) {
          _token = json.authenticated.access_token;
        }
      }
    }
  }
  return _token;
}

/** Télécharge le profil utilisateur depuis le LCMS. */
function loadUser(cb) {
  let token = getAuthToken();
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

/** Renvoie la clef correspondant à l'utilisateur courant pour
 * l'enregistrement en cache du programme. */
function getProgKey(type){
  let key = type || 'prog'
  if(_user) {
    key += '_' + _user.studentId;
  }
  debug('[LS] progkey ' + key)
  return key;
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function toggleMenu(evt){
  let eltMenu = document.getElementById('profileMenu');
  if(eltMenu.classList.contains('hidden')){
    eltMenu.classList.remove('hidden');
    document.addEventListener('click', toggleMenu);
  } else {
    eltMenu.classList.add('hidden');
    document.removeEventListener('click', toggleMenu);
  }
  evt.stopPropagation();
}

function logout() {
  const cookies = ['ember_simple_auth-session', 'ember_simple_auth-session-expiration_time'];
  for (let cookie of cookies) {
    document.cookie=`${cookie}=; domain=${COOKIE_DOMAIN}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  location.reload();
}

//--------- SPHERO ---------//

const skSpheroLibs = {
  './sphero.js': './lib/skulpt/externals/sphero.js',
  './snap.js': './lib/skulpt/externals/snap.js'
};

function builtinRead(file) {
  if (skSpheroLibs[file] !== undefined) {
    return Sk.misceval.promiseToSuspension(
      fetch(skSpheroLibs[file]).then(
        function (resp){ return resp.text(); }
      ));
  }
  if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[file] === undefined) {
    throw "File not found: '" + file + "'";
  }
  return Sk.builtinFiles.files[file];
}

function enableSend(){
  let sb = document.getElementById('sendbtn');
  if (sb) {
    sb.disabled = false;
    sb.innerText='Envoyer';
  }
}

function disableSend(){
  let sb = document.getElementById('sendbtn');
  if (sb) {
    sb.disabled = true;
    sb.innerText='Serveur du professeur non trouvé';
  }
}

function sendProgram(){
  const prgm = _pythonEditor.getValue();
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  debug('[Send] Send program\n' + prgm);
  sendWS('send_program', { 'type': _currentInfo.type, 'program': prgm }, res => {
    debug('[Send] response', res);
    let relt = document.querySelector('#overlay .result');
    relt.innerHTML = 'Envoyé !';
    setTimeout(() => { overlay.classList.add('hidden'); }, 2000);
  });
}

function remoteRunProgram(){
  debug('[Start] Start program', _user.studentId);
  sendWS('start_program', { 'type': _currentInfo.type }, res => {
    debug('[Start] response', res);
  });
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

  (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtlecanvas';
  Sk.onAfterImport = function(library) {
    debug('[Skulpt] Imported', library);
  };

  marked.setOptions({
    gfm: true
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('checkbtn').addEventListener('click', runit);
  document.getElementById('sendbtn').addEventListener('click', sendProgram);
  document.getElementById('remoterunbtn').addEventListener('click', remoteRunProgram);
  document.getElementById('homebtn').addEventListener('click', () => { displayMenu(); history.pushState(null, '', '/'); });
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('login2').addEventListener('click', login);
  document.getElementById('sphero-cmd').addEventListener('click', () => loadCommands(true, infos.sphero));
  document.getElementById('dobot-cmd').addEventListener('click', () => loadCommands(true, infos.dobot));
  document.getElementById('profileMenuBtn').addEventListener('click', toggleMenu);

  // Save script on keystroke
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_pythonEditor){
        localStorage.setItem(getProgKey(_currentInfo ? _currentInfo.type : null), _pythonEditor.getValue());
      }
    }
  });
  // addEventListener('popstate', evt => {
  //   if(evt.state && evt.state.level) {
  //     loadExercises(evt.state.level);
  //   } else {
  //     displayMenu();
  //   }
  // });

  handlers['programs_status'] = [(data) => {
    debug('Programs status', JSON.stringify(data, '', ' '));
    if (_user && data?.type === _currentInfo?.type) {
      let btn = document.getElementById('remoterunbtn');
      let waitIdx = data.programs.studentIds.indexOf(_user.studentId);
      if (waitIdx < 0) {
        btn.classList.add('hidden');
      } else {
        btn.classList.remove('hidden');
        if (waitIdx === 0) {
          btn.innerHTML = '<span>Commander le robot</span><img src="img/play_white.png">';
          btn.disabled = false;
        } else {
          btn.innerText = `${waitIdx+1}ème dans la file d'attente`;
          btn.disabled = true;
        }
      }
    }
  }];


  loadUser(user => {
    // TODO session cache
    debug('User loaded', user);

    if(user) {
      _user = user;
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');
      connectWS(() => {
        if(_currentInfo) {
          sendWS('status_btsender', { 'type': _currentInfo.type }, res => {
            debug(' [Status] response', res);
            if(res.status === 'err') {
              disableSend();
            } else {
              enableSend();
            }
          });
        }
      });
      if(location.hash && location.hash.match('#sphero')) {
        loadCommands(true, infos.sphero);
      } else if(location.hash && location.hash.match('#dobot')) {
        loadCommands(true, infos.dobot);
      }
    } else {
      document.getElementById('login').classList.remove('hidden');
      _user = null;
      displayMenu();
    }

    hideLoading();
  });
}

//----- Programmes eleves -----/

async function startPrgm(prgm) {
  debug('Start program', prgm);
  _localSocket.send(JSON.stringify({
    'cmd': 'start_program',
    'data': prgm
  }));
}

async function movePrgm(prgm, delta) {
  debug('Start program', prgm);
  let cmd = delta === 1 ? 'move_up' : 'move_down';
  _localSocket.send(JSON.stringify({
    'cmd': cmd,
    'data': prgm
  }));
}

async function deletePrgm(prgm) {
  debug('Delete program', prgm);
  _localSocket.send(JSON.stringify({
    'cmd': 'remove_program',
    'data': prgm
  }));
}

async function refreshPrograms(status){
  let parent = document.getElementById('main-list');
  parent.innerHTML = '';
  debug('[PRGM] Status', status);
  let prgmStatus = { studentIds: [] }
  if(!status.programs || status.programs.length === 0) {
    _currentPrograms = []
    document.getElementById('empty-msg').classList.remove('hidden');
  } else {
    _currentPrograms = status.programs;
    document.getElementById('empty-msg').classList.add('hidden');
    for (let p of status.programs) {
      debug(' [PRGM] Refresh program', p);
      prgmStatus.studentIds.push(p.studentId);
      let lineTemplate = document.querySelector('#prgm-line');
      let line = document.importNode(lineTemplate.content, true);
      line.querySelector('.name').textContent = p.student;
      line.querySelector('.avatar').src = 'https://robohash.org/' + p.student.replace(' ', '_');
      line.querySelector('.state .start').addEventListener('click', () => startPrgm(p));
      line.querySelector('.up').addEventListener('click', () => movePrgm(p, 1));
      line.querySelector('.down').addEventListener('click', () => movePrgm(p, -1));
      line.querySelector('.delete').addEventListener('click', () => deletePrgm(p));

      if(p.state === 'READY') {
        line.querySelector('.prgm').classList.remove('grayscale');
        line.querySelector('.state .logo').classList.add('hidden');
        line.querySelector('.state .start').classList.remove('hidden');
      } else if(p.state === 'RUNNING') {
        line.querySelector('.prgm').classList.remove('grayscale');
        line.querySelector('.state .logo').classList.add('rotating');
        line.querySelector('.state .start').classList.add('hidden');
      } else {
        line.querySelector('.prgm').classList.add('grayscale');
        line.querySelector('.state .logo').classList.remove('rotating');
        line.querySelector('.state .start').classList.add('hidden');
      }
      parent.appendChild(line);
    }
  }
  // TODO send prgmStatus
  debug(' [PRGM] Send programs status', prgmStatus);
  sendWS('programs_status', { 'type': _currentInfo.type, 'status': prgmStatus });
}

let _localSocket = null;
/** Connection enseignant au serveur local. */
function localConnect(info){
  _localSocket = new WebSocket(info.server);
  debug('[LS] connection');
  // On new WS message
  _localSocket.onmessage = function (message) {
    if (!message) { return; }
    // if message has some data
    if (message.data) {
      const content = JSON.parse(message.data);
      debug(' [LS] message', content)
      refreshPrograms(content)
    }
  }

  _localSocket.onclose = function () {
    debug('[LS] disconnected');
    document.getElementById('missing-local-msg').classList.remove('hidden');
    document.getElementById('empty-msg').classList.add('hidden');
  }

  _localSocket.onopen = function () {
    debug('[LS] connected');
    document.getElementById('missing-local-msg').classList.add('hidden');
    document.getElementById('empty-msg').classList.remove('hidden');
    document.getElementById('sphero-connect').classList.add('hidden');
    document.getElementById('dobot-connect').classList.add('hidden');
    document.getElementById('title').innerHTML = 'Contrôle du robot : ' + info.type ;
    _localSocket.send(JSON.stringify({'cmd': 'get_status'}));
    // _localSocket.send(JSON.stringify({
    //   'cmd': 'add_program',
    //   'data' : {
    //    'id': '234',
    //    'student': 'Doe John',
    //    'program': 'import time\nimport sphero\n\norb = sphero.init()\n\norb.connect()\norb.set_rgb_led(120,0,0)\ntime.sleep(1)\n\norb.roll(30, 0)\n',
    //    'state': 'WAITING'
    //   }
    // }));
  }
}

/** Connection au serveur local via webocket. */
function connect(info) {
  _currentInfo = info;
  sendWS('connect_btsender', { 'type': _currentInfo.type }, res => {
    debug(' [Connect] response', res);
  });
  localConnect(info);
}

function initTeacher(){
  loadUser(async (user) => {
    // TODO session cache
    debug('User loaded', user);

    document.getElementById('sphero-connect').addEventListener('click', () => connect(infos.sphero));
    document.getElementById('dobot-connect').addEventListener('click', () => connect(infos.dobot));

    document.getElementById('empty-msg').classList.add('hidden');

    if(user) {
      _user = user;
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');
      // try {
      //   const res = await fetch(LOCAL_SERVER + '/status');
      //   const status = await res.json();
      //   refreshPrograms(status);
      // } catch(err) {
      //   console.error('Unable to connect to local command server', err);
      // }
    } else {
      document.getElementById('login').classList.remove('hidden');
      _user = null;
    }

    // displayMenu();
    connectWS(() => {
      if(_currentInfo) {
        sendWS('connect_btsender', { 'type': _currentInfo.type }, res => {
          debug(' [Connect] response', res);
        });
      }
    });
    hideLoading();
  });
}

handlers['__add_program'] = [(data) => {
  // Forward to local server
  debug('Add program !', JSON.stringify(data, '', ' '));
  _localSocket.send(JSON.stringify({
    'cmd': 'add_program',
    'data' : {
     'studentId': data.studentId,
     'student': data.student,
     'program': data.program,
     'state': 'WAITING'
    }
  }));
}];

handlers['__start_program'] = [(data) => {
  debug('Start program !', JSON.stringify(data, '', ' '));
  if(_currentPrograms[0] && _currentPrograms[0].studentId === data.studentId) {
    startPrgm(_currentPrograms[0]);
    // FIXME feedback
  } else {
    // FIXME error
  }
}];


let btn = document.getElementById('remoterunbtn');

handlers['btsender_connected'] = [enableSend];
handlers['btsender_disconnected'] = [disableSend];

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}


if(location.href.match('teacher.html')) {
  initTeacher();
} else {
  initClient();
}

/***** Web socket connection *****/

// Return next msg id
function getId () {
  return _idCounter++;
}

function getWSToken() {
  return new Promise((resolve, reject) => {
    let atok = getAuthToken();
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

// Manual connection
async function connectWS (cb) {
  if (_ws && _ws.readyState === _ws.OPEN) { // already connected
    return cb && cb();
  }
  let token = await getWSToken();
  if (!token) {
    debug('[WS] WS token not found');
    return cb && cb();
  }
  _ws = new WebSocket(WS_URL + '?' + token);
  debug('[WS] connection');
  // On new WS message
  _ws.onmessage = function (message) {
    debug(' [WS] message', message)
    if (!message) { return; }
    // if message has some data
    if (message.data) {
      const content = JSON.parse(message.data);
      // for response messages
      if (content.event === '__response') {
        const cb = responseCallbacks[content.src_id];
        if (cb) { cb(content.data); }
        delete responseCallbacks[content.src_id];
      } else {
        const list = handlers[content.event];
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
  }

  _ws.onclose = function () {
    debug('[WS] disconnected');
    // localStorage.removeItem(TOKEN)
  }

  if (cb) {
    _ws.onopen = function () {
      cb();
    }
  }
}

// Wait for WS connection to execute callback
function waitForConnection (cb) {
  setTimeout(() => {
    if (!_ws) {
      connectWS(cb)
    } else if (_ws.readyState === _ws.OPEN) {
      cb()
    } else if (_ws.readyState === _ws.CLOSED) {
      connectWS(cb)
    } else {
      waitForConnection(cb)
    }
  }, 100)
}

function sendWS (event, data, cb) {
  debug('[WS] Send', event, JSON.stringify(data))
  let msg = {
    event: event,
    data: data
  }
  if (cb && typeof cb === 'function') {
    msg.id = getId()
    responseCallbacks[msg.id] = cb
  }
  if(_keepaliveTimeout) {
    clearTimeout(_keepaliveTimeout);
    _keepaliveTimeout = null;
  }
  if (_ws && _ws.readyState === _ws.OPEN) {
    _ws.send(JSON.stringify(msg))
    _keepaliveTimeout = setTimeout(() => { sendWS('__keepAlive', null); }, KEEPALIVE_DELAY);
  } else if (_ws && _ws.readyState === _ws.CLOSED) {
    connectWS(() => {
      _ws.send(JSON.stringify(msg))
      _keepaliveTimeout = setTimeout(() => { sendWS('__keepAlive', null); }, KEEPALIVE_DELAY);
    })
  } else {
    waitForConnection(() => {
      if (_ws) {
        _ws.send(JSON.stringify(msg))
        _keepaliveTimeout = setTimeout(() => { sendWS('__keepAlive', null); }, KEEPALIVE_DELAY);
      }
      // FIXME else : missing WS ?
    })
  }
}

})();
