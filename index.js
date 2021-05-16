let {PythonShell} = require('python-shell')

let PlatformAccessory, Accessory, hap, Service, Characteristic, UUIDGen;

let pyshell = null;

const PLUGIN_NAME = "homebridge-intercom-automation-hat";
const PLATFORM_NAME = "IntercomAutomationHAT";

module.exports = function (homebridge) {
    PlatformAccessory = homebridge.platformAccessory;
    Accessory = homebridge.hap.Accessory;
    hap = homebridge.hap;
    Service = hap.Service;
    Characteristic = hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, IntercomPlatform);
    homebridge.registerAccessory(PLUGIN_NAME, PLATFORM_NAME + "LockAccessory", IntercomLockAccessory);
    homebridge.registerAccessory(PLUGIN_NAME, PLATFORM_NAME + "BellAccessory", IntercomDoorbellAccessory);
}

function IntercomPlatform(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
        
    this.log("IntercomPlatform constructor");
    
    //device configuration
    this.bellTimeout = this.config['bellTimeout'] || 1000; // milliseconds - 1 sec
    this.lockTimeout = this.config['lockTimeout'] || 1000; // milliseconds - 1 sec
    this.voltageLowLimit = this.config['voltageLowLimit'] || 0.03; // V
    this.name = this.config['name'] || 'Intercom';

    //setup variables
    var scriptPath = __dirname + "/";
    
    //get Device info
    this.manufacturer = 'Raspberry Pi';
    this.modelName = 'Zero W';
    this.serialNumber = 'SN000001';
    this.firmwareRevision = 'FW000001';
    
    this.bellRang = false;

    // Prepare to kill pyshell
    process.on('SIGINT', () => { this.shutdown('SIGINT') })
    process.on('SIGTERM', () => { this.shutdown('SIGTERM') })

    this.log("Setting up pyhton shell. scriptPath = " + scriptPath);
    
    // Create pyshell
    pyshell = new PythonShell('intercom-automation-hat.py', {
        mode: 'text',
        pythonPath: '/usr/bin/python3',
        pythonOptions: ['-u'], // get print results in real-time
        args: [this.voltageLowLimit],
        scriptPath: scriptPath//'../../homebridge-intercom-automation-hat'
    });
    
    pyshell.on('stderr', function (stderr) {
      // handle stderr (a line of text from stderr)
        this.log(stderr);
    }.bind(this));
    
    pyshell.on('close', function (stderr) {
      // handle stderr (a line of text from stderr)
        this.log("pyshell close:");
        this.log("               " + stderr);
    }.bind(this));
    
    pyshell.on('error', function (stderr) {
      // handle stderr (a line of text from stderr)
        this.log("pyshell error:");
        this.log("               " + stderr);
    }.bind(this));
    
    //this.pyshell.on('message', function (message) {
    //  // received a message sent from the Python script (a simple "print" statement)
    //  console.log(message);
    //});
}

IntercomPlatform.prototype = {
    
    shutdown: function(signal) {
        this.log('Got %s, shutting down', signal)
        pyshell.terminate(signal)
        setImmediate(() => { process.exit(0) })
    },
    
    lock: function() {
        this.log('Send lock to pyshell');
        pyshell.send('lock');
    },

    unlock: function() {
        this.log('Send unlock to pyshell');
        pyshell.send('unlock');
    },
    
    listenDoorbell: function(doorbellOnCallback, doorbellOffCallback) {
        pyshell.on('message', function (message) {
            this.log(message);
            switch(message) {
            case 'doorbell on':
                if(!this.bellRang) doorbellOnCallback();
                this.bellRang = true;
                break;
            case 'doorbell off':
                if(this.bellRang) {
                    var that = this;
                    setTimeout(function() {
                        that.bellRang = false;
                        doorbellOffCallback();
                    }, this.bellTimeout);
                }
                break;
            }
        }.bind(this));
    },

    accessories: function(callback) {
        this.log("Creating IntercomPlatform accessories...");
          
        this.accessories = [];

        // Lock
        var lockAccessory = new IntercomLockAccessory(this.log, this.config);
        lockAccessory.prepareLockAccessory();
        var lockService = lockAccessory.prepareLockService();
        lockAccessory.connectLockUnlock(this.lock, this.unlock);

        // Door
        var doorbellAccessory = new IntercomDoorbellAccessory(this.log, this.config);
        doorbellAccessory.prepareDoorbellAccessory();
        var doorbellService =  doorbellAccessory.prepareDoorbellService();
        doorbellAccessory.connectListingToDoorbel.call(this, this.listenDoorbell, doorbellService);

        this.accessories.push(lockAccessory);
        this.accessories.push(doorbellAccessory);

        callback(this.accessories);
    }
};


class IntercomLockAccessory {
    constructor(log, config) {
        this.log = log;
        this.config = config;
        this.lockTimeout = this.config['lockTimeout'] || 1000; // milliseconds - 1 sec
        
        this.name = this.config['name'] || 'Intercom';
        this.name += "Lock";
            
        this.log("IntercomLockAccessory constructor");
    }

    prepareLockAccessory() {
        this.log('prepareLockAccessory');
        let uuid = UUIDGen.generate(this.name + "LockAccessory");
        this.intercomLockAccessory = new PlatformAccessory(this.name, uuid, Accessory.Categories.LOCK);
        
        this.intercomLockAccessory.on('identify', function(callback){
            this.identify.call(this,callback);
        })
    }
        
    prepareLockService(lock, unlock) {
        this.log('prepareLockService');
        
        this.lockService = new Service.LockMechanism(this.name, 'Door lock');

        this.lockService.setCharacteristic(Characteristic.LockTargetState, Characteristic.LockTargetState.SECURED) // force initial state
            .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED)
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
        
        this.lockService.getCharacteristic(Characteristic.LockCurrentState)
            .updateValue(Characteristic.LockCurrentState.UNSECURED);
        
        var that = this;
        setTimeout(function() {
            that.log("unlock timeout door");
            that.lock(); // just for safety...
            that.lockService.getCharacteristic(Characteristic.LockTargetState)
                            .setValue(Characteristic.LockTargetState.SECURED);
        }, this.lockTimeout);
    }

    lockDoor() {
        this.lock();
        this.lockService.getCharacteristic(Characteristic.LockCurrentState)
                        .updateValue(Characteristic.LockCurrentState.SECURED);
    }
    
    identify(callback) {
        this.log('identify intercom lock');
        callback();
    }
    
    // Get Services
    getServices() {
        return [this.lockService];
    }
}
    
class IntercomDoorbellAccessory {
    constructor(log, config) {
        this.log = log;
        this.config = config;
        
        this.name = this.config['name'] || 'Intercom';
        this.name += "Bell";
            
        this.log("IntercomBellAccessory constructor");
    }

    prepareDoorbellAccessory() {
        this.log('prepareBellAccessory');
        let uuid = UUIDGen.generate(this.name + "BellAccessory");
        this.intercomDoorbellAccessory = new PlatformAccessory(this.name, uuid, Accessory.Categories.VIDEO_DOORBELL);
        
        this.intercomDoorbellAccessory.on('identify', function(callback){
            this.identify.call(this,callback);
        })
    }
    
    prepareDoorbellService() {
        this.log('prepareDoorbellService');
        this.doorbellService = new Service.Doorbell(this.name, 'Doorbell');
        
        //this.doorbellService.setCharacteristic(Characteristic.ProgrammableSwitchEvent, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
        
        this.intercomDoorbellAccessory.addService(this.doorbellService);
        
        return this.doorbellService;
    }
    
    connectListingToDoorbel(listenDoorbell, doorbellService) {
        this.log("connectListingToDoorbel");
        
        this.listenDoorbell = listenDoorbell;
        
        this.listenDoorbell(
            function() {
                doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                                    .updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
            },
            function() {});
    }
        
    identify(callback) {
        this.log('identify intercom doorbell');
        
        this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(0);
        callback();
    }
    
    // Get Services
    getServices() {
        return [this.doorbellService];
    }
}
