import { debug } from './config.js';
import gui from './gui.js';
import ws from './websocket.js';

let _currentPrograms = [];

let _localSocket = null;
/** Connection enseignant au serveur local. */
function localConnect(robot){
  _localSocket = new WebSocket(robot.server);
  debug('[LS] connection');
  // On new WS message
  _localSocket.onmessage = function (message) {
    if (!message) { return; }
    // if message has some data
    if (message.data) {
      const content = JSON.parse(message.data);
      debug(' [LS] message', content)
      _currentPrograms = content.programs;
      gui.refreshPrograms(robot, content)
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
    // TODO add home cmd action
    document.getElementById('title').innerHTML = 'Contrôle du robot : ' + robot.type ;
    _localSocket.send(JSON.stringify({'cmd': 'get_status'}));
  }
}

ws.addHandler('__add_program', (data) => {
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
});

ws.addHandler('__start_program', (data) => {
  debug('Start program !', JSON.stringify(data, '', ' '));
  if(_currentPrograms[0] && _currentPrograms[0].studentId === data.studentId) {
    programs.startPrgm(_currentPrograms[0]);
    // FIXME feedback
  } else {
    // FIXME error
  }
});


/** Connection au serveur local via webocket. */
const programs = {
  connect: (robot) => {
    // FIXME move remote ws connection from local connection file.
    ws.send('connect_btsender', { 'type': robot.type }, res => {
      debug(' [Connect] response', res);
      if(res.status === 'err') { return; }
      localConnect(robot);
    });
  },
  startPrgm: (prgm) => {
    debug('Start program', prgm);
    _localSocket.send(JSON.stringify({
      'cmd': 'start_program',
      'data': prgm
    }));
  },
  movePrgm: (prgm, delta) => {
    debug('Move program', prgm);
    let cmd = delta === 1 ? 'move_up' : 'move_down';
    _localSocket.send(JSON.stringify({
      'cmd': cmd,
      'data': prgm
    }));
  },
  deletePrgm: (prgm) => {
    debug('Delete program', prgm);
    _localSocket.send(JSON.stringify({
      'cmd': 'remove_program',
      'data': prgm
    }));
  }
}

export default programs;
