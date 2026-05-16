let { PythonShell } = require('python-shell');

let PlatformAccessory;
let hap;
let Service;
let Characteristic;
let UUIDGen;

const PLUGIN_NAME = "homebridge-intercom-automation-hat";
const PLATFORM_NAME = "IntercomAutomationHAT";

module.exports = function(homebridge) {
  PlatformAccessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  Service = hap.Service;
  Characteristic = hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, IntercomPlatform);
};

function IntercomPlatform(log, config, api) {
  this.log = log;
  this.config = config || {};
  this.api = api;

  this.log("IntercomPlatform constructor");

  this.bellTimeout = this.config['bellTimeout'] || 1000;
  this.lockTimeout = this.config['lockTimeout'] || 1000;
  this.voltageLowLimit = this.config['voltageLowLimit'] || 0.03;
  this.pythonPath = this.config['pythonPath'] || '/home/pi/venvs/automationhat/bin/python';
  this.name = this.config['name'] || 'Intercom';

  this.manufacturer = 'Raspberry Pi';
  this.modelName = 'Zero W';
  this.serialNumber = 'SN000001';
  this.firmwareRevision = 'FW000001';
  this.bellRang = false;

  this.pyshell = null;

  this.startPythonShell();

  process.on('SIGINT', () => {
    this.shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    this.shutdown('SIGTERM');
  });
}

IntercomPlatform.prototype = {
  startPythonShell: function() {
    const scriptPath = __dirname + "/";

    this.log("Setting up python shell. scriptPath = " + scriptPath);

    this.pyshell = new PythonShell('intercom-automation-hat.py', {
      mode: 'text',
      pythonPath: this.pythonPath,
      pythonOptions: ['-u'],
      args: [this.voltageLowLimit],
      scriptPath: scriptPath
    });

    this.pyshell.on('stderr', function(stderr) {
      this.log(stderr);
    }.bind(this));

    this.pyshell.on('close', function(code) {
      this.log("pyshell close:");
      this.log(" " + code);
    }.bind(this));

    this.pyshell.on('error', function(error) {
      this.log("pyshell error:");
      this.log(" " + error);
    }.bind(this));
  },

  shutdown: function(signal) {
    this.log('Got %s, shutting down', signal);

    if (this.pyshell) {
      this.pyshell.terminate(signal);
    }
  },

  lock: function() {
    this.log('Send lock to pyshell');

    if (this.pyshell) {
      this.pyshell.send('lock');
    }
  },

  unlock: function() {
    this.log('Send unlock to pyshell');

    if (this.pyshell) {
      this.pyshell.send('unlock');
    }
  },

  listenDoorbell: function(doorbellOnCallback, doorbellOffCallback) {
    if (!this.pyshell) {
      this.log('Cannot listen to doorbell: pyshell is not running');
      return;
    }

    this.pyshell.on('message', function(message) {
      this.log(message);

      switch(message) {
        case 'doorbell on':
          if (!this.bellRang) {
            doorbellOnCallback();
          }
          this.bellRang = true;
          break;

        case 'doorbell off':
          if (this.bellRang) {
            setTimeout(function() {
              this.bellRang = false;
              doorbellOffCallback();
            }.bind(this), this.bellTimeout);
          }
          break;
      }
    }.bind(this));
  },

  accessories: function(callback) {
    this.log("Creating IntercomPlatform accessories...");

    this.accessories = [];

    const lockAccessory = new IntercomLockAccessory(this.log, this.config);
    lockAccessory.prepareLockAccessory();
    lockAccessory.prepareLockService();
    lockAccessory.connectLockUnlock(
      this.lock.bind(this),
      this.unlock.bind(this)
    );

    const doorbellAccessory = new IntercomDoorbellAccessory(this.log, this.config);
    doorbellAccessory.prepareDoorbellAccessory();
    const doorbellService = doorbellAccessory.prepareDoorbellService();

    doorbellAccessory.connectListeningToDoorbell(
      this.listenDoorbell.bind(this),
      doorbellService
    );

    this.accessories.push(lockAccessory);
    this.accessories.push(doorbellAccessory);

    callback(this.accessories);
  }
};

class IntercomLockAccessory {
  constructor(log, config) {
    this.log = log;
    this.config = config || {};
    this.lockTimeout = this.config['lockTimeout'] || 1000;

    this.name = this.config['name'] || 'Intercom';
    this.name += "Lock";

    this.log("IntercomLockAccessory constructor");
  }

  prepareLockAccessory() {
    this.log('prepareLockAccessory');

    const uuid = UUIDGen.generate(this.name + "LockAccessory");

    this.intercomLockAccessory = new PlatformAccessory(
      this.name,
      uuid,
      hap.Categories.LOCK
    );

    this.intercomLockAccessory.on('identify', function(callback) {
      this.identify(callback);
    }.bind(this));
  }

  prepareLockService() {
    this.log('prepareLockService');

    this.lockService = new Service.LockMechanism(this.name, 'Door lock');

    this.lockService
      .setCharacteristic(
        Characteristic.LockTargetState,
        Characteristic.LockTargetState.SECURED
      )
      .setCharacteristic(
        Characteristic.LockCurrentState,
        Characteristic.LockCurrentState.SECURED
      )
      .getCharacteristic(Characteristic.LockTargetState)
      .on('set', this.setDoorTargetState.bind(this));

    this.intercomLockAccessory.addService(this.lockService);

    return this.lockService;
  }

  connectLockUnlock(lock, unlock) {
    this.lock = lock;
    this.unlock = unlock;
  }

  setDoorTargetState(state, callback) {
    switch(state) {
      case Characteristic.LockTargetState.UNSECURED:
        this.unlockDoor();
        break;

      case Characteristic.LockTargetState.SECURED:
        this.lockDoor();
        break;
    }

    callback();
  }

  unlockDoor() {
    this.unlock();

    this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .updateValue(Characteristic.LockCurrentState.UNSECURED);

    setTimeout(function() {
      this.log("unlock timeout door");

      this.lock();

      this.lockService
        .getCharacteristic(Characteristic.LockTargetState)
        .setValue(Characteristic.LockTargetState.SECURED);
    }.bind(this), this.lockTimeout);
  }

  lockDoor() {
    this.lock();

    this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .updateValue(Characteristic.LockCurrentState.SECURED);
  }

  identify(callback) {
    this.log('identify intercom lock');
    callback();
  }

  getServices() {
    return [this.lockService];
  }
}

class IntercomDoorbellAccessory {
  constructor(log, config) {
    this.log = log;
    this.config = config || {};

    this.name = this.config['name'] || 'Intercom';
    this.name += "Bell";

    this.log("IntercomBellAccessory constructor");
  }

  prepareDoorbellAccessory() {
    this.log('prepareBellAccessory');

    const uuid = UUIDGen.generate(this.name + "BellAccessory");

    this.intercomDoorbellAccessory = new PlatformAccessory(
      this.name,
      uuid,
      hap.Categories.VIDEO_DOORBELL
    );

    this.intercomDoorbellAccessory.on('identify', function(callback) {
      this.identify(callback);
    }.bind(this));
  }

  prepareDoorbellService() {
    this.log('prepareDoorbellService');

    this.doorbellService = new Service.Doorbell(this.name, 'Doorbell');

    this.intercomDoorbellAccessory.addService(this.doorbellService);

    return this.doorbellService;
  }

  connectListeningToDoorbell(listenDoorbell, doorbellService) {
    this.log("connectListeningToDoorbell");

    this.listenDoorbell = listenDoorbell;

    this.listenDoorbell(
      function() {
        doorbellService
          .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
          .updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      },
      function() {}
    );
  }

  identify(callback) {
    this.log('identify intercom doorbell');

    this.doorbellService
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .setValue(0);

    callback();
  }

  getServices() {
    return [this.doorbellService];
  }
}
