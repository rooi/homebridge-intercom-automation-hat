const EventEmitter = require('events');
const { PythonShell } = require('python-shell');

class IntercomDevice extends EventEmitter {
  constructor(log, options) {
    super();

    this.log = log;
    this.options = options || {};

    this.bellTimeout = this.options.bellTimeout || 1000;
    this.voltageLowLimit = this.options.voltageLowLimit || 0.03;
    this.pythonPath = this.options.pythonPath || '/home/pi/venvs/automationhat/bin/python';

    this.bellRang = false;
    this.pyshell = null;

    this.startPythonShell();
  }

  startPythonShell() {
    const scriptPath = __dirname + "/";

    this.log("Setting up python shell. scriptPath = " + scriptPath);

    this.pyshell = new PythonShell('intercom-automation-hat.py', {
      mode: 'text',
      pythonPath: this.pythonPath,
      pythonOptions: ['-u'],
      args: [this.voltageLowLimit],
      scriptPath: scriptPath
    });

    this.pyshell.on('message', (message) => {
      this.handlePythonMessage(message);
    });

    this.pyshell.on('stderr', (stderr) => {
      this.log(stderr);
    });

    this.pyshell.on('close', (code) => {
      this.log("pyshell close:");
      this.log(" " + code);
    });

    this.pyshell.on('error', (error) => {
      this.log("pyshell error:");
      this.log(" " + error);
    });
  }

  handlePythonMessage(message) {
    this.log(message);

    switch(message) {
      case 'doorbell on':
        if (!this.bellRang) {
          this.emit('doorbell');
        }
        this.bellRang = true;
        break;

      case 'doorbell off':
        if (this.bellRang) {
          setTimeout(() => {
            this.bellRang = false;
            this.emit('doorbellOff');
          }, this.bellTimeout);
        }
        break;
    }
  }

  lock() {
    this.log('Send lock to pyshell');

    if (this.pyshell) {
      this.pyshell.send('lock');
    }
  }

  unlock() {
    this.log('Send unlock to pyshell');

    if (this.pyshell) {
      this.pyshell.send('unlock');
    }
  }

  shutdown(signal) {
    this.log('Got %s, shutting down intercom device', signal);

    if (this.pyshell) {
      this.pyshell.terminate(signal);
    }
  }
}

module.exports = IntercomDevice;
