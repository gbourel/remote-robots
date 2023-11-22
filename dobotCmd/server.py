import asyncio
import websockets
import json
import subprocess
import sqlite3

import time

import pydobot

SERVER_HOST = "localhost"
SERVER_PORT = 7008

print("Communication avec bras robotisé Dobot")

# TODO vérification que le user appartient au groupe "dialout" ?
# sudo usermod -a -G dialout $USER

status = {
  'dobot': {},
  'programs': []
}

# Base de données de stockage des programmes eleves
DB_FILE="programs_dobot.db"
db = sqlite3.connect(DB_FILE)
cur = db.cursor()

def debug(msg):
  """Debug log."""
  print(msg)
  return

def initDB():
  """ Init local SQLite database."""
  cur.execute("""
    CREATE TABLE IF NOT EXISTS programs (
      id integer primary key,
      studentId integer NOT NULL,
      student character varying(255),
      state character varying(255),
      program text,
      createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  """);
  print("DB initialized: " + DB_FILE)
  for row in cur.execute("SELECT * FROM programs WHERE state=\"WAITING\" OR state=\"RUNNING\" OR state=\"READY\";"):
    data = {
      'id': row[0],
      'studentId': row[1],
      'student': row[2],
      'state': row[3],
      'program': row[4]
    }
    print('Program found', data)
    status["programs"].append(data)
  if (len(status["programs"]) > 0 and status["programs"][0]["state"] != 'READY'):
    status["programs"][0]["state"] = 'READY'


async def get_status(ws, data=None):
  """Returns current status containing : programs list."""
  return status

async def add_program(ws, data=None):
  """Append program to current waiting list."""
  debug(f"Add program {json.dumps(data)}\n")
  if(len(status["programs"]) > 0):
    data["state"] = "WAITING"
  else:
    data["state"] = "READY"

  r1 = cur.execute(f'SELECT id FROM programs WHERE studentId="{data["studentId"]}" AND (state="WAITING" OR state="READY");')
  existing = r1.fetchone()
  if existing is None :
    val = cur.execute("INSERT INTO programs(studentId, student, state, program) VALUES(?,?,?,?)",
      (data['studentId'], data["student"], data["state"], data['program']))
    data["id"] = cur.lastrowid
    status["programs"].append(data)
  else:
    val = cur.execute("UPDATE programs SET program=? WHERE id=?",
      (data['program'], existing[0]))
    for p in status["programs"]:
      if p["id"] == existing[0]:
        p["program"] = data["program"]
    print('Program updated')
  db.commit()

  return status

async def start_program(ws, data=None):
  """Start program with provided id."""
  # print("Data ", data)
  print(f"\nStart program {data['id']} {data['student']}:\n\n")
  for prgm in status["programs"]:
    if prgm["id"] == data["id"]:
      prgm["state"] = "RUNNING"
      result = None
      await ws.send(json.dumps(status))
      try:
        with open('remote_prgm.py', 'w') as file:
          file.write(prgm["program"])
        p = subprocess.run(['python3', 'remote_prgm.py'], shell=False, check=False, capture_output=True)
        result = {
          "id": prgm["id"],
          "studentId": data['studentId'],
          "returncode": p.returncode,
          "stdout": p.stdout.decode(),
          "stderr": p.stderr.decode()
        }
        print(result["stdout"])
        print(result["stderr"])
        prgm["state"] = "DONE"
      except Exception as e:
        print(f"Error {e}")
        prgm["state"] = "ERROR"
      status["programs"].remove(prgm)
      val = cur.execute("UPDATE programs SET state=? WHERE id=?", (prgm["state"], prgm["id"]))
      db.commit()
      if len(status["programs"]) > 0:
        status["programs"][0]["state"] = 'READY'
      print('\n\nDone\n')
      ret = status.copy()
      ret["result"] = result
      await ws.send(json.dumps(ret))
  return status

async def remove_program(ws, data=None):
  """Remove program with provided id."""
  debug(f"Remove program {data}.")
  status["programs"].remove(data)
  val = cur.execute(f'UPDATE programs SET state="DELETED" WHERE id={data["id"]}')
  db.commit()
  return status

async def move_up(ws, data=None):
  """Move up program with provided id inwiating list."""
  idx = status["programs"].index(data)
  if idx > 0:
    print(status["programs"][idx-1])
    if status["programs"][idx-1]["state"] == 'READY':
      status["programs"][idx-1]["state"] = 'WAITING'
      status["programs"][idx]["state"] = 'READY'
    status["programs"][idx-1], status["programs"][idx] = status["programs"][idx], status["programs"][idx-1]
  return status

async def move_down(ws, data=None):
  """Move down program with provided id inwiating list."""
  idx = status["programs"].index(data)
  if idx < len(status["programs"])-1:
    if status["programs"][idx]["state"] == 'READY':
      status["programs"][idx]["state"] = 'WAITING'
      status["programs"][idx+1]["state"] = 'READY'
    status["programs"][idx+1], status["programs"][idx] = status["programs"][idx], status["programs"][idx+1]
  return status

handlers = {
  'add_program': add_program,
  'get_status': get_status,
  'start_program': start_program,
  'remove_program': remove_program,
  'move_up': move_up,
  'move_down': move_down
}

async def handler(websocket, path):
  """Creates websockets handler."""
  while True:
    data = await websocket.recv()
    msg = json.loads(data)
    res = None
    try:
      handler = handlers[msg["cmd"]]
      if "data" in msg:
        res = await handler(websocket, msg["data"])
      else:
        res = await handler(websocket)
    except Exception as e:
      print(f"Handler error for command {msg['cmd']}")
      print(e)
      res = { 'error': 'command error'}
    if res:
      await websocket.send(json.dumps(res))

def initDobot():
  """Init dobot status."""
  with open('remote_prgm.py', 'w') as file:
    file.write('import pydobot\nd=pydobot.Dobot()\nd.set_home_cmd()')
  p = subprocess.run(['python3', 'remote_prgm.py'], shell=False, check=False, capture_output=True)
  return

initDB()
start_server = websockets.serve(handler, SERVER_HOST, SERVER_PORT)

initDobot()

print("En attente d'un programme...")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
