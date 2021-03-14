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
    analog_value = automationhat.analog.one.read()
    doorbell_on_state = abs(analog_value) > voltageLowLimit

    if doorbell_on_state:
        logging.info("doorbell analog value: {}; ringing: {}; voltage > {}: ".format(analog_value, doorbell_on_state, voltageLowLimit))

    if doorbell_on_state != thread_local.doorbell_on_state:
        thread_local.doorbell_on_state = doorbell_on_state
        print("doorbell on") if doorbell_on_state else print("doorbell off")


if __name__ == "__main__":
    main()
