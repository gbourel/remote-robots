import { debug } from './config.js';

/** Base class for robots. */
class Robot {
  constructor(server, type, path, title, defaultSrc, skLibs, runOpts) {
    this._server = server;
    this._type = type;
    this._path = path;
    this._title = title;
    this._defaultSrc = defaultSrc;
    this._skLibs = skLibs || {};
    this._runOpts = runOpts || {};
  }
  get type() { return this._type; }
  get server() { return this._server; }
  get path() { return this._path; }
  get title() { return this._title; }
  get defaultSrc() { return this._defaultSrc; }
  get skLibs() { return this._skLibs; }
  get runOpts() { return this._runOpts; }
}

export const sphero = new Robot(
  'ws://localhost:7007',
  'sphero',
  '/#sphero',
  'Programmation du robot **Sphero** :',
  'import sphero\n\norb = sphero.connect()\n\norb.set_rgb_led(0,120,0)\n\norb.move(0) # Se déplace direction 0°\norb.wait(1) # Attend 1s\n',
  {
    './sphero.js': './lib/skulpt/externals/sphero.js'
  }, {
    'turtle': true
  }
);

export const dobot = new Robot(
  'ws://localhost:7008',
  'dobot',
  '/#dobot',
  'Programmation du bras robotisé **Dobot magician** :',
  "import pydobot\n\ndevice = pydobot.Dobot()\n\n(x, y, z, r, j1, j2, j3, j4) = device.pose() # Position du bras\nprint('Coordonnées actuelles: (', x, y, z, ')')\n\ndevice.move_to(x + 40, y, z + 50, r) # Déplace le bras\n(x, y, z, r, j1, j2, j3, j4) = device.pose()\nprint('Coordonnées 2: (', x, y, z, ')')\n\ndevice.move_to(x, y, z, r) # Retour au point de départ\n\n",
  {
    './pydobot.js': './lib/skulpt/externals/dobot.js'
  }
);

export const robots = [sphero, dobot];
