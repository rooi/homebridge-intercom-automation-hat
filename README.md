# homebridge-intercom-automation-hat

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![homebridge-intercom-automation-hat](https://badgen.net/npm/v/homebridge-intercom-automation-hat?icon=npm)](https://www.npmjs.com/package/homebridge-intercom-automation-hat)

Homebridge plugin for controlling an intercom lock and doorbell using a Pimoroni Automation HAT / Automation HAT Mini and Raspberry Pi GPIO.

Features:
- Doorbell detection using analog input
- Lock control using relay output
- Support for Automation HAT and Automation HAT Mini
- Configurable Python virtual environment support
- Compatible with Raspberry Pi Zero 2

Adapted from / credits to:  Luke Hoersten
https://github.com/lukehoersten/homekit-door
https://medium.com/dirigible/siri-controlled-1970s-intercom-door-ecd7a6b0df31

Using a
[Raspberry Pi Zero W](https://www.raspberrypi.org/products/raspberry-pi-zero-w/) and
[Pimoroni Automation pHAT](https://shop.pimoroni.com/products/automation-phat) or 
[Pimoroni Automation HAT Mini](https://shop.pimoroni.com/products/automation-hat-mini),
make a simple circuit-based door lock and door bell intercom into a
Siri-controlled HomeKit smart accessory. Siri integration is provided
by [HomeBridge](https://github.com/homebridge/homebridge).

## Connecting wires to the automation phat
* Connect the intercom's ground wire to the automation phat ground
* Connect the intercom's door opener (high) to automation phat output one
* Connect the intercom's doorbell wire (high) to automation phat analog one


## Installation

If you are new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).
Specifically for running on a Raspberry, you will find a tutorial in the [homebridge Wiki](https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Raspbian).

Assure you're using the most up-to-date version of Raspbian

1. Install Homebridge
Install Homebridge using the official [instructions](https://homebridge.io/)

2. Install system dependencies
```sh
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
```

3. Create Python virtual environment
A Python virtual environment is recommended to avoid package conflicts on modern Raspberry Pi OS versions.
```sh
mkdir -p /home/pi/venvs

python3 -m venv /home/pi/venvs/automationhat
```
Activate the virtual environment:
```sh
source /home/pi/venvs/automationhat/bin/activate
```
Upgrade pip:
```sh
pip install --upgrade pip
```
Install Automation HAT Python library:
```sh
pip install automationhat
```
Test installation:
```sh
python -c "import automationhat; print('automationhat OK')"
```
Deactivate the virtual environment:
```sh
deactivate
```

4. Install plugin
Install using Homebridge UI or manually:
```sh
sudo npm install -g homebridge-intercom-automation-hat
```

When running this plugin using homebride-config-ui you need to set permission to access i2c and gpio:
First install homebridge-config-ui-x according to their instructions. Then open a terminal and execute the following two commands and reboot afterwards:
```
sudo adduser homebridge i2c
sudo adduser homebridge gpio
```


## Configuration

Add the accessory in `config.json` in your home directory inside `.homebridge`.

Example configuration:

```js
{
  "platforms":
  [{
      "platform": "IntercomAutomationHAT",
      "name": "Intercom",
      "bellTimeout": "1000",
      "lockTimeout": "1000",
      "voltageLowLimit": "0.25",
      "pythonPath": "/home/pi/venvs/automationhat/bin/python",
  }]
}
```
