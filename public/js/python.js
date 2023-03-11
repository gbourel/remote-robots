import { debug } from './config.js';

let _over = false;  // python running after end of user input
let _output = [];     // Current script stdout

(Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtlecanvas';
Sk.onAfterImport = function(library) {
  debug('[Skulpt] Imported', library);
};

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

// function builtinRead(x) {
//   if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
//     throw "File not found: '" + x + "'";
//   return Sk.builtinFiles["files"][x];
// }


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

// Run python script
export function runit(prog) {
  debug('[Python] runit', prog);
  if(!prog) { return console.error('Cannot run empty program'); }
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
