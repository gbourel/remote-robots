(function (){

const VERSION = 'v0.1.0';
document.getElementById('version').textContent = VERSION;

const host = window.location.host;
const dev = host.startsWith('localhost') || host.startsWith('ileauxsciences.test');

let debug = () => {};
if(dev) {
  debug = console.info;
}

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge

let NSIX_LOGIN_URL = 'http://app.nsix.fr/connexion'
let LCMS_URL = 'https://webamc.nsix.fr';
let WS_URL = 'wss://webamc.nsix.fr';
let COOKIE_DOMAIN = '.nsix.fr';
// Local storage identifiers

if(dev) {
  NSIX_LOGIN_URL = 'http://ileauxsciences.test:4200/connexion';
  LCMS_URL = 'http://dev.ileauxsciences.test:9976';
  WS_URL = 'ws://dev.ileauxsciences.test:9976';
  COOKIE_DOMAIN = '.ileauxsciences.test';
}

let _user = null;
let _token = null;

// Callback on exercise achievement
function displaySuccess() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.remove('hidden');
}

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
    value: "import sphero\n\norb = sphero.connect()",
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

function displayCommands() {
  // const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const main = document.getElementById('main');
  const menu = document.getElementById('mainmenu');
  menu.style.transform = 'translate(0, 100vh)';
  main.classList.remove('hidden');

  // if (_exercise) {
  //   let prog = '';
  let lastprog = localStorage.getItem(getProgKey());
  if(!_pythonEditor) {
    initPythonEditor();
  }
  if(lastprog && lastprog.length) {
    _pythonEditor.setValue(lastprog);
  }
  instruction.innerHTML = marked.parse('Les fonctions disponibles sont détaillées ici : ');
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
function loadCommands(pushHistory){
  if(!_user) { return loginRequired(); }
  // if(pushHistory) {
  //   history.pushState({'level': level}, '', `/#niveau${level}`);
  // }
  displayCommands();
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
  let nbFailed = _tests.length;
  let table = document.importNode(document.querySelector('#results-table').content, true);
  let lineTemplate = document.querySelector('#result-line');
  if(_tests.length > 0 && _tests.length === _output.length) {
    nbFailed = 0;
    for (let i = 0 ; i < _tests.length; i++) {
      let line = null;
      if(_tests[i].option !== 'hide') {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        cells[0].textContent = _tests[i].python;
        cells[1].textContent = _tests[i].value.trim();
        cells[2].textContent = _output[i].trim();
      }
      if(_tests[i].value.trim() !== _output[i].trim()) {
        nbFailed += 1;
        line && line.querySelector('tr').classList.add('ko');
      } else {
        line && line.querySelector('tr').classList.add('ok');
      }
      if(line) {
        let tbody = table.querySelector('tbody');
        tbody.append(line);
      }
    }
    if (nbFailed === 0) {
      const answer = sha256(_output);
      if(parent) {
        parent.window.postMessage({
          'answer': answer,
          'from': 'pix'
        }, '*');
      }
      registerSuccess(_exercise.id, answer);
      displaySuccess();
    }
  }
  const elt = document.createElement('div');
  let content = '';
  if(nbFailed > 0) {
    elt.classList.add('failed');
    content = `Résultat : ${_tests.length} test`;
    if(_tests.length > 1) { content += 's'; }
    content += `, ${nbFailed} échec`
    if(nbFailed > 1) { content += 's'; }
  } else {
    elt.classList.add('success');
    if(_tests.length > 1) {
      content = `Succès des ${_tests.length} tests`;
    } else {
      content = `Succès de ${_tests.length} test`;
    }
  }
  elt.innerHTML += `<div class="result">${content}</div>`;
  if(_tests.find(t => t.option !== 'hide')){
    elt.appendChild(table);
  }
  document.getElementById('output').appendChild(elt);
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
  outputElt.innerHTML = '';
  Sk.pre = 'output';
  Sk.configure({
    output: outf,
    read: builtinRead,
    __future__: Sk.python3
  });
  prog += "\nprint('### END_OF_USER_INPUT ###')";
  for (let t of _tests) {
    let instruction = t.python.trim();
    if(!instruction.startsWith('print')) {
      instruction = `print(${instruction})`;
    }
    prog += "\n" + instruction;
  }
  _output = [];
  _over = false;
  if(prog.startsWith('import turtle')) {
    document.getElementById('turtlecanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  }
  if(prog.startsWith('import webgl')) {
    document.getElementById('webglcanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  }
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
        _token = json.authenticated.access_token;
      }
    }
  }
  return _token;
}

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
      // console.info(JSON.stringify(data, '', ' '));
      // console.info(data.student);
      cb(data.student);
    }).catch(err => {
      console.warn('Unable to fetch user', err);
      cb(null);
    });
  } else {
    cb(null);
  }
}

function getProgKey(){
  let key = 'prog'
  if(_user) {
    key += '_' + _user.studentId;
  }
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

// function updateAchievements() {
//   if(!_user || !_user.exercises) { return; }
//   for (let i=1; i<4 ; i++){
//     let elt = document.querySelector(`#level-${i} .percent`);
//     let total =  _user.exercises[`level${i}`];
//     let done = 0;
//     for (let r of _user.results){
//       if(r.level === i && r.done) {
//         done++;
//       }
//     }
//     let percent = 100.0 * done / total;
//     let stars = Math.round(percent/20);
//     let starsContent = '';
//     for(let i = 1; i <= 5; i++){
//       let color = 'text-gray-400';
//       if(i <= stars) { color = 'text-yellow-500'; }
//       starsContent += `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 fill-current ${color}"><path d="M8.128 19.825a1.586 1.586 0 0 1-1.643-.117 1.543 1.543 0 0 1-.53-.662 1.515 1.515 0 0 1-.096-.837l.736-4.247-3.13-3a1.514 1.514 0 0 1-.39-1.569c.09-.271.254-.513.475-.698.22-.185.49-.306.776-.35L8.66 7.73l1.925-3.862c.128-.26.328-.48.577-.633a1.584 1.584 0 0 1 1.662 0c.25.153.45.373.577.633l1.925 3.847 4.334.615c.29.042.562.162.785.348.224.186.39.43.48.704a1.514 1.514 0 0 1-.404 1.58l-3.13 3 .736 4.247c.047.282.014.572-.096.837-.111.265-.294.494-.53.662a1.582 1.582 0 0 1-1.643.117l-3.865-2-3.865 2z"></path></svg>`;
//     }
//     elt.innerHTML = `&nbsp; ${Math.round(percent)} % terminé`;
//     document.querySelector(`#level-${i} .stars`).innerHTML = starsContent;
//     document.querySelector(`#level-${i} .achievement`).title = `${done} / ${total} réussi${(done > 0) ? 's' : ''}`;
//   }
// }


const skExternalLibs = {
  './data.js': './lib/skulpt/externals/data.js',
  './snap.js': './lib/skulpt/externals/snap.js'
};

function builtinRead(file) {
  // console.log("Attempting file: " + Sk.ffi.remapToJs(file));
  if (skExternalLibs[file] !== undefined) {
    return Sk.misceval.promiseToSuspension(
      fetch(skExternalLibs[file]).then(
        function (resp){ return resp.text(); }
      ));
  }
  if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[file] === undefined) {
    throw "File not found: '" + file + "'";
  }
  return Sk.builtinFiles.files[file];
}

function sendProgram(){
  const prgm = _pythonEditor.getValue();
  debug('Send program\n' + prgm);
}

function init(){
  let purl = new URL(window.location.href);
  if(purl && purl.searchParams) {
    let index = purl.searchParams.get("index");
    if(index) {
      _exerciseIdx = index;
    }
    let challenge = purl.searchParams.get('challenge');
  }

  (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtlecanvas';
  Sk.onAfterImport = function(library) {
    console.info('Imported', library);
  };

  marked.setOptions({
    gfm: true
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('sendbtn').addEventListener('click', sendProgram);
  document.getElementById('homebtn').addEventListener('click', () => { displayMenu(); history.pushState(null, '', '/'); });
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('login2').addEventListener('click', login);
  document.getElementById('commands').addEventListener('click', () => loadCommands(true));
  document.getElementById('profileMenuBtn').addEventListener('click', toggleMenu);

  // Save script on keystroke
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_pythonEditor){
        localStorage.setItem(getProgKey(), _pythonEditor.getValue());
      }
    }
  });
  addEventListener('popstate', evt => {
    if(evt.state && evt.state.level) {
      loadExercises(evt.state.level);
    } else {
      displayMenu();
    }
  });

  loadUser((user) => {
    // TODO session cache
    debug('User loaded', user);

    if(user) {
      _user = user;
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');
    } else {
      document.getElementById('login').classList.remove('hidden');
      _user = null;
    }

    displayMenu();
    hideLoading();
  });
}

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}

init();


/***** Web socket connection *****/

const responseCallbacks = {};
const handlers = {};

let ws = null;
let idCounter = 0;


// Return next msg id
function getId () {
  return idCounter++;
}

// Manual connection
function connectWS (cb) {
  if (ws && ws.readyState === ws.OPEN) { // already connected
    return cb && cb();
  }
  let token = getAuthToken();
  debug('Token', token)
  if (!token) {
    debug('Auth token not found');
    return cb && cb();
  }
  ws = new WebSocket(WS_URL + '?' + token);
  debug('Websocket connection');
  // On new WS message
  ws.onmessage = function (message) {
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
          list.forEach(h => {
            if (h) { h(content.data); }
          })
        }
      }
    }
  }

  ws.onclose = function () {
    debug('Disconnected');
    // localStorage.removeItem(TOKEN)
  }

  if (cb) {
    ws.onopen = function () {
      cb();
    }
  }
}

function sendWS (event, data, cb) {
  debug('WSService send', event, JSON.stringify(data))
  let msg = {
    event: event,
    data: data
  }
  if (cb && typeof cb === 'function') {
    msg.id = getId()
    responseCallbacks[msg.id] = cb
  }
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  } else if (ws && ws.readyState === ws.CLOSED) {
    connect(() => {
      ws.send(JSON.stringify(msg))
    })
  } else {
    waitForConnection(() => {
      if (ws) {
        ws.send(JSON.stringify(msg))
      }
      // FIXME else : missing WS ?
    })
  }
}

connectWS(() => {
  ws.send('get_user', user => { console.info('Found', user); });
});

})();
