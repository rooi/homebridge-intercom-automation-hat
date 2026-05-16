const IntercomDevice = require('./intercom-device');

let hap;
let Service;
let Characteristic;
let UUIDGen;
let PlatformAccessory;

const PLUGIN_NAME = "homebridge-intercom-automation-hat";
const PLATFORM_NAME = "IntercomAutomationHAT";

module.exports = function(homebridge) {
  hap = homebridge.hap;
  Service = hap.Service;
  Characteristic = hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  PlatformAccessory = homebridge.platformAccessory;

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

  this.accessories = new Map();

  this.homeKitDoorbellService = null;
  this.matterBellSensorUuid = null;

  this.matterAvailable = this.api.isMatterAvailable ? this.api.isMatterAvailable() : !!this.api.matter;
  this.matterEnabled = this.api.isMatterEnabled ? this.api.isMatterEnabled() : !!this.api.matter;
  this.enableMatter = this.config['enableMatter'] || false;

  if (this.matterAvailable) {
    this.log('Matter API is available');
  } else {
    this.log('Matter API is not available');
  }

  if (this.matterEnabled) {
    this.log('Matter is enabled for this bridge');
  } else {
    this.log('Matter is not enabled for this bridge');
  }

  if (this.enableMatter && !this.api.matter) {
    this.log.warn('Matter is enabled in plugin config, but api.matter is not available');
  }

  this.device = new IntercomDevice(this.log, {
    bellTimeout: this.bellTimeout,
    voltageLowLimit: this.voltageLowLimit,
    pythonPath: this.pythonPath
  });

  this.api.on('didFinishLaunching', () => {
    this.log('didFinishLaunching');

    this.discoverDevices();
    this.configureDoorbellEventHandling();

    if (this.enableMatter) {
      this.setupMatterDevices().catch((error) => {
        this.log.error('Failed to setup Matter devices:', error);
      });
    }
  });

  this.api.on('shutdown', () => {
    this.shutdown('SIGTERM');
  });
}

IntercomPlatform.prototype = {
  configureAccessory: function(accessory) {
    this.log('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  },

  discoverDevices: function() {
    this.log("Discovering Intercom accessories...");

    this.setupLockAccessory();
    this.setupDoorbellAccessory();
  },

  setupLockAccessory: function() {
    const lockName = this.name + "Lock";
    const lockUuid = UUIDGen.generate(lockName + "LockAccessory");

    let accessory = this.accessories.get(lockUuid);

    if (accessory) {
      this.log('Restoring existing lock accessory:', accessory.displayName);
    } else {
      this.log('Creating new lock accessory:', lockName);

      accessory = new PlatformAccessory(
        lockName,
        lockUuid,
        hap.Categories.LOCK
      );

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    this.configureLockInformationService(accessory);
    this.configureLockService(accessory, lockName);
  },

  setupDoorbellAccessory: function() {
    const doorbellName = this.name + "Bell";
    const doorbellUuid = UUIDGen.generate(doorbellName + "BellAccessory");

    let accessory = this.accessories.get(doorbellUuid);

    if (accessory) {
      this.log('Restoring existing doorbell accessory:', accessory.displayName);
    } else {
      this.log('Creating new doorbell accessory:', doorbellName);

      accessory = new PlatformAccessory(
        doorbellName,
        doorbellUuid,
        hap.Categories.VIDEO_DOORBELL
      );

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    this.configureDoorbellInformationService(accessory);
    this.configureDoorbellService(accessory, doorbellName);
  },

  configureLockInformationService: function(accessory) {
    accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.modelName)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber + '-LOCK')
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
  },

  configureDoorbellInformationService: function(accessory) {
    accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.modelName)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber + '-BELL')
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
  },

  configureLockService: function(accessory, lockName) {
    let lockService = accessory.getService(Service.LockMechanism);

    if (!lockService) {
      lockService = accessory.addService(Service.LockMechanism, lockName, 'Door lock');
    }

    lockService
      .setCharacteristic(
        Characteristic.LockTargetState,
        Characteristic.LockTargetState.SECURED
      )
      .setCharacteristic(
        Characteristic.LockCurrentState,
        Characteristic.LockCurrentState.SECURED
      );

    lockService
      .getCharacteristic(Characteristic.LockTargetState)
      .removeAllListeners('set')
      .on('set', (state, callback) => {
        this.setDoorTargetState(lockService, state, callback);
      });
  },

  configureDoorbellService: function(accessory, doorbellName) {
    let doorbellService = accessory.getService(Service.Doorbell);

    if (!doorbellService) {
      doorbellService = accessory.addService(Service.Doorbell, doorbellName, 'Doorbell');
    }

    this.homeKitDoorbellService = doorbellService;
  },

  configureDoorbellEventHandling: function() {
    this.device.removeAllListeners('doorbell');

    this.device.on('doorbell', () => {
      if (this.homeKitDoorbellService) {
        this.homeKitDoorbellService
          .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
          .updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }

      if (this.matterBellSensorUuid && this.api.matter) {
        this.log('Matter bell sensor active');

        this.api.matter.updateAccessoryState(
          this.matterBellSensorUuid,
          this.api.matter.clusterNames.BooleanState || 'booleanState',
          { stateValue: true }
        ).catch((error) => {
          this.log.error('Failed to update Matter bell sensor active state:', error);
        });

        setTimeout(() => {
          this.log('Matter bell sensor inactive');

          this.api.matter.updateAccessoryState(
            this.matterBellSensorUuid,
            this.api.matter.clusterNames.BooleanState || 'booleanState',
            { stateValue: false }
          ).catch((error) => {
            this.log.error('Failed to update Matter bell sensor inactive state:', error);
          });
        }, this.bellTimeout);
      }
    });
  },

  setupMatterDevices: async function() {
    if (!this.api.matter) {
      this.log.warn('Matter support is enabled in plugin config, but api.matter is not available');
      return;
    }

    const matterLockName = this.name + " Matter Lock";
    const matterLockUuid = UUIDGen.generate(this.name + "MatterLock");

    const matterBellSensorName = this.name + " Matter Bell Sensor";
    const matterBellSensorUuid = UUIDGen.generate(this.name + "MatterBellSensor");

    this.matterBellSensorUuid = matterBellSensorUuid;

    this.log('Registering Matter lock:', matterLockName);
    this.log('Registering Matter bell contact sensor:', matterBellSensorName);

    await this.api.matter.registerPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [
        {
          UUID: matterLockUuid,
          displayName: matterLockName,
          deviceType: this.api.matter.deviceTypes.DoorLock,
          manufacturer: this.manufacturer,
          model: this.modelName,
          serialNumber: this.serialNumber + '-MATTER-LOCK',
          firmwareRevision: this.firmwareRevision,
          clusters: {
            doorLock: {
              lockState: 1
            }
          },
          handlers: {
            doorLock: {
              lockDoor: async () => {
                this.log('Matter lockDoor command received');

                this.device.lock();

                return {
                  lockState: 1
                };
              },

              unlockDoor: async () => {
                this.log('Matter unlockDoor command received');

                this.device.unlock();

                setTimeout(() => {
                  this.log('Matter unlock timeout door');

                  this.device.lock();

                  this.api.matter.updateAccessoryState(
                    matterLockUuid,
                    this.api.matter.clusterNames.DoorLock,
                    { lockState: 1 }
                  ).catch((error) => {
                    this.log.error('Failed to update Matter lock state after timeout:', error);
                  });
                }, this.lockTimeout);

                return {
                  lockState: 2
                };
              }
            }
          },
          context: {
            type: 'lock'
          }
        },
        {
          UUID: matterBellSensorUuid,
          displayName: matterBellSensorName,
          deviceType: this.api.matter.deviceTypes.ContactSensor,
          manufacturer: this.manufacturer,
          model: this.modelName,
          serialNumber: this.serialNumber + '-MATTER-BELL',
          firmwareRevision: this.firmwareRevision,
          clusters: {
            booleanState: {
              stateValue: false
            }
          },
          context: {
            type: 'bell-sensor'
          }
        }
      ]
    );

    this.log('Matter lock registered');
    this.log('Matter bell contact sensor registered');
  },

  setDoorTargetState: function(lockService, state, callback) {
    switch(state) {
      case Characteristic.LockTargetState.UNSECURED:
        this.unlockDoor(lockService);
        break;

      case Characteristic.LockTargetState.SECURED:
        this.lockDoor(lockService);
        break;
    }

    callback();
  },

  unlockDoor: function(lockService) {
    this.device.unlock();

    lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .updateValue(Characteristic.LockCurrentState.UNSECURED);

    setTimeout(() => {
      this.log("unlock timeout door");

      this.device.lock();

      lockService
        .getCharacteristic(Characteristic.LockTargetState)
        .setValue(Characteristic.LockTargetState.SECURED);
    }, this.lockTimeout);
  },

  lockDoor: function(lockService) {
    this.device.lock();

    lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .updateValue(Characteristic.LockCurrentState.SECURED);
  },

  shutdown: function(signal) {
    this.device.shutdown(signal);
  }
};
