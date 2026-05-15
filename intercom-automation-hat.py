#!/usr/bin/env python3

import time
import automationhat
import sys

import queue
import threading

import logging

logging.basicConfig(level=logging.INFO)
voltageLowLimit = float(sys.argv[1])

def main():
    command_queue = queue.LifoQueue()
    read_thread = threading.Thread(target=read_loop, args=[command_queue])
    read_thread.start()
    run_loop(command_queue)


def read_loop(command_queue):
    while True:
        command_queue.put_nowait(sys.stdin.readline().rstrip('\n'))


def run_loop(command_queue):
    thread_local = threading.local()
    thread_local.doorbell_on_state = False
    thread_local.moving_average_voltage = 0.0

    while True:
        run_command(command_queue)
        read_doorbell(thread_local)


def run_command(command_queue):
    try:
        command = command_queue.get(timeout=0.1)
    except queue.Empty:
        pass
    else:
        automationhat.output.one.on() if command == "unlock" else automationhat.output.one.off()


def read_doorbell(thread_local):

    samples = []

    for i in range(20):
        analog_value = automationhat.analog.one.read()
        samples.append(abs(analog_value))
        time.sleep(0.01)

    level = sum(samples) / len(samples)

    doorbell_on_state = level > voltageLowLimit

    if doorbell_on_state:
        logging.info("doorbell AC level: {:.2f} > {:.2f}".format(level, voltageLowLimit))

    if doorbell_on_state != thread_local.doorbell_on_state:
        thread_local.doorbell_on_state = doorbell_on_state

        print("doorbell on") if doorbell_on_state else print("doorbell off")


if __name__ == "__main__":
    main()
