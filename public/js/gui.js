import { debug, NSIX_LOGIN_URL, AUTH_COOKIE, COOKIE_DOMAIN } from './config.js';
import { sphero, dobot } from './robots.js';
import ws from './websocket.js';
import programs from './programs.js';

let _currentRobot = null; // Current robot info

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout

/** Renvoie la clef correspondant à l'utilisateur courant pour
 * l'enregistrement en cache du programme. */
function getProgKey(type){
  let key = type || 'prog'
  if(ws.user) {
    key += '_' + ws.user.externalId;
  }
  debug('[LS] progkey ' + key)
  return key;
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

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
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

function sendProgram(){
  const prgm = _pythonEditor.getValue();
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  debug('[Send] Send program\n' + prgm);
  ws.send('send_program', { 'type': _currentRobot.type, 'program': prgm }, res => {
    debug('[Send] response', res);
    let relt = document.querySelector('#overlay .result');
    relt.innerHTML = 'Envoyé !';
    setTimeout(() => { overlay.classList.add('hidden'); }, 2000);
  });
}

function remoteRunProgram(){
  if(!ws.user) { return console.error('No current user.'); }
  debug('[Start] Start program for', ws.user.externalId);
  ws.send('start_program', { 'type': _currentRobot.type }, res => {
    debug('[Start] response', res);
  });
}

function login() {
  const current = location.href;
  location.href = `${NSIX_LOGIN_URL}?dest=${current}`;
}
function logout() {
  const cookies = [AUTH_COOKIE];
  for (let cookie of cookies) {
    document.cookie=`${cookie}=; domain=${COOKIE_DOMAIN}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  location.reload();
}

const gui = {
  hideLoading: () => {
    document.getElementById('loading').classList.add('hidden');
  },
  initClient: async () => {
    const python = await import('./python.js');

    marked.setOptions({
      gfm: true
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('profileMenuBtn').addEventListener('click', logout);
    document.getElementById('checkbtn').addEventListener('click', () => {
      python.runit(_pythonEditor.getValue(), _currentRobot);
    });
    document.getElementById('sendbtn').addEventListener('click', sendProgram);
    document.getElementById('remoterunbtn').addEventListener('click', remoteRunProgram);
    document.getElementById('homebtn').addEventListener('click', () => { gui.displayMenu(); history.pushState(null, '', '/'); });
    document.getElementById('login').addEventListener('click', login);
    document.getElementById('login2').addEventListener('click', login);
    document.getElementById('sphero-cmd').addEventListener('click', () => gui.loadCommands(true, sphero));
    document.getElementById('dobot-cmd').addEventListener('click', () => gui.loadCommands(true, dobot));

    // Save script on keystroke
    document.addEventListener('keyup', evt => {
      if(evt.target && evt.target.nodeName === 'TEXTAREA') {
        if(_pythonEditor){
          localStorage.setItem(getProgKey(_currentRobot ? _currentRobot.type : null), _pythonEditor.getValue());
        }
      }
    });

    ws.addHandler('programs_status', (data) => {
      debug('Programs status', JSON.stringify(data, '', ' '));
      if (ws.user && data?.type === _currentRobot?.type) {
        let btn = document.getElementById('remoterunbtn');
        let waitIdx = data.programs.externalIds.indexOf(ws.user.externalId);
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
        if(data?.output && data?.output.studentId === ws.user.externalId) {
          let parent = document.getElementById('remote-output');
          parent.querySelector('.stdout').innerText = data.output.stdout;
          parent.querySelector('.stderr').innerText = data.output.stderr;
          parent.classList.remove('hidden');
        }
      }
    });
  },
  displayMenu: () => {
    const menu = document.getElementById('mainmenu');
    const progress = document.getElementById('progress');
    const main = document.getElementById('main');
    const instruction = document.getElementById('instruction');
    instruction.innerHTML = '';
    progress.classList.add('hidden');
    main.classList.add('hidden');
    menu.style.transform = 'translate(0, 0)';
  },
  initPythonEditor: async () => {
    const python = await import('./python.js');

    if(_pythonEditor) { return _pythonEditor; }
    _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
      value: "",
      mode:  "python",
      lineNumbers: true,
      theme: 'monokai',
      indentUnit: 4,
      extraKeys: {
        'Tab': (cm) => cm.execCommand("indentMore"),
        'Shift-Tab': (cm) => cm.execCommand("indentLess"),
        'Ctrl-Enter': () => { python.runit(_pythonEditor.getValue(), _currentRobot); }
      }
    });
  },
  // Load command view
  loadCommands: (pushHistory, robot) => {
    if(!ws.loggedIn) { return loginRequired(); }
    if(pushHistory) {
      history.pushState(null, '', robot.path);
    }
    _currentRobot = robot;
    gui.displayCommands(robot);
  },
  displayCommands: async (robot) => {
    // const title = document.getElementById('title');
    const instruction = document.getElementById('instruction');
    const main = document.getElementById('main');
    const menu = document.getElementById('mainmenu');
    menu.style.transform = 'translate(0, 100vh)';
    main.classList.remove('hidden');

    let lastprog = localStorage.getItem(getProgKey(robot.type));
    if(!_pythonEditor) { await gui.initPythonEditor(); }
    if(lastprog && lastprog.length) {
      _pythonEditor.setValue(lastprog);
    } else {
      _pythonEditor.setValue(robot.defaultSrc);
    }
    instruction.innerHTML = marked.parse(robot.title);
    if(robot) {
      ws.send('status_btsender', { 'type': robot.type }, res => {
        debug(' [Status] robot response', res);
        if(res.status === 'err') {
          gui.disableSend();
        } else {
          gui.enableSend();
        }
      });
    }
  },
  enableSend: () => {
    let sb = document.getElementById('sendbtn');
    if (sb) {
      sb.disabled = false;
      sb.innerText='Envoyer';
    }
  },
  disableSend: () => {
    let sb = document.getElementById('sendbtn');
    if (sb) {
      sb.disabled = true;
      sb.innerText='Serveur de commande du robot non trouvé';
      document.getElementById('remoterunbtn').classList.add('hidden');
    }
  },

  initTeacher: () => {
    ws.loadUser(async (user) => {
      // TODO session cache
      debug('User loaded', user);

      if (user && user.role === 'enseignant') {
        document.getElementById('teachers-only').remove();
      }

      document.getElementById('sphero-connect').addEventListener('click', () => {
        programs.connect(sphero);
      });
      document.getElementById('dobot-connect').addEventListener('click', () => {
        programs.connect(dobot);
      });

      document.getElementById('empty-msg').classList.add('hidden');

      if(user) {
        document.getElementById('username').innerHTML = user.firstName || 'Moi';
        document.getElementById('profile-menu').classList.remove('hidden');

      } else {
        document.getElementById('login').classList.remove('hidden');
      }

      gui.hideLoading();
    });
  },
  async refreshPrograms(robot, status) {
    _currentRobot = robot;
    let parent = document.getElementById('main-list');
    parent.innerHTML = '';
    debug('[PRGM] Status', status);
    let prgmStatus = { externalIds: [] }
    if(!status.programs || status.programs.length === 0) {
      document.getElementById('empty-msg').classList.remove('hidden');
    } else {
      document.getElementById('empty-msg').classList.add('hidden');
      for (let p of status.programs) {
        debug(' [PRGM] Refresh program', p);
        prgmStatus.externalIds.push(p.studentId);
        let lineTemplate = document.querySelector('#prgm-line');
        let line = document.importNode(lineTemplate.content, true);
        line.querySelector('.name').textContent = p.student;
        line.querySelector('.avatar').src = 'https://robohash.org/' + p.student.replace(' ', '_');
        line.querySelector('.state .start').addEventListener('click', () => programs.startPrgm(p));
        line.querySelector('.up').addEventListener('click', () => programs.movePrgm(p, 1));
        line.querySelector('.down').addEventListener('click', () => programs.movePrgm(p, -1));
        line.querySelector('.delete').addEventListener('click', () => programs.deletePrgm(p));

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
    let res = { 'type': _currentRobot.type, 'status': prgmStatus, 'output': status.result }
    debug(' [PRGM] Send programs status', res);
    ws.send('programs_status', res);
  }
}

export default gui;
