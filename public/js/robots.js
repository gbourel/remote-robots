import { debug } from './config.js';

/** Base class for robots. */
class Robot {
  constructor(server, type, path, title, defaultSrc) {
    this._server = server;
    this._type = type;
    this._path = path;
    this._title = title;
    this._defaultSrc = defaultSrc;
  }
  get type() { return this._type; }
  get server() { return this._server; }
  get type() { return this._type; }
  get path() { return this._path; }
  get title() { return this._title; }
  get defaultSrc() { return this._defaultSrc; }
}

export const sphero = new Robot('ws://localhost:7007', 'sphero', '/#sphero',
  'Programmation du robot **Sphero** :',
  'import sphero\n\norb = sphero.connect()\n\norb.set_rgb_led(0,120,0)\n\norb.move(0) # Se déplace direction 0°\norb.wait(1) # Attend 1s\n');

export const dobot = new Robot('ws://localhost:7008', 'dobot', '/#dobot',
  'Programmation du bras robotisé **Dobot magician** :',
  "import pydobot\n\ndevice = pydobot.Dobot()\n\n(x, y, z, r, j1, j2, j3, j4) = device.pose()\nprint(f'x:{x} y:{y} z:{z} r:{r} j1:{j1} j2:{j2} j3:{j3} j4:{j4}')\n\ndevice.move_to(x + 20, y, z, r, wait=True)\ndevice.move_to(x, y, z, r, wait=True)\n");
