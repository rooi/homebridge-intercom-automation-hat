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

## Installation

If you are new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).
Specifically for running on a Raspberry, you will find a tutorial in the [homebridge-punt Wiki](https://github.com/cflurin/homebridge-punt/wiki/Running-Homebridge-on-a-Raspberry-Pi).

Assure you're using the most up-to-date version of Raspbian

Install Pimoroni automation (p)hat:
```sh
curl https://get.pimoroni.com/automationhat | bash
```

Install homebridge:
```sh
sudo npm install -g homebridge
```

Install homebridge-webos-tv:
```sh
sudo npm install -g homebridge-intercom-automation-hat
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
      "lockTimeout": "1000"
  }]
}
```
