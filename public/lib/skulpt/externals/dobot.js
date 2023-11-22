
function $builtinmodule(name) {
  // Depends on other modules ?
  // Sk.importModule('turtle', false, true);

  const mod = {};

  let _x = 50;
  let _y = 0;
  let _z = 0;
  let _r = 0;

  function initDobot(self) {
  	// Sk.TurtleGraphics.module.colormode.func_code(255);
  }

  function pose(self) {
  	return new Sk.builtin.tuple([
  		new Sk.builtin.int_(_x),
  		new Sk.builtin.int_(_y),
			new Sk.builtin.int_(_z),
			new Sk.builtin.int_(_r),
			new Sk.builtin.int_(0),
			new Sk.builtin.int_(0),
			new Sk.builtin.int_(0),
			new Sk.builtin.int_(0)
		]);
	}

  function suck(self, active) {
    return;
  }

  function move_to(self, x, y, z, r) {
	 	_x = x;
	 	_y = y;
	 	_z = z;
		_r = r;
		return;
  }
  move_to.co_varnames = ['self', 'x', 'y', 'z', 'r'];

  function DobotWrapper($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(initDobot);
    $loc.pose = new Sk.builtin.func(pose);
    $loc.move_to = new Sk.builtin.func(move_to);
    $loc.suck = new Sk.builtin.func(suck);
  }

  mod.Dobot = Sk.misceval.buildClass(mod, DobotWrapper, "Dobot", []);

  mod.__name__ = new Sk.builtin.str("pydobot");

  return mod;
};
