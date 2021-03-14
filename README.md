# homebridge-intercom-automation-hat
Homebridge plugin to expose an intercom's doorbell and opener through an Raspberry Pi and Pimoroni Automation (p)Hat

Adapted from / credits to:  Luke Hoersten
https://github.com/lukehoersten/homekit-door
https://medium.com/dirigible/siri-controlled-1970s-intercom-door-ecd7a6b0df31

Using
a
[Raspberry Pi Zero W](https://www.raspberrypi.org/products/raspberry-pi-zero-w/) and
[Pimoroni Automation pHAT](https://shop.pimoroni.com/products/automation-phat),
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

Install Pimoroni automation (p)hat:
```sh
curl https://get.pimoroni.com/automationhat | bash
```

Install homebridge:
```sh
sudo npm install -g homebridge
```

Install homebridge-intercom-automation-hat:
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
      "lockTimeout": "1000",
      "voltageLowLimit": "0.03"
  }]
}
```
