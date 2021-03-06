#!/bin/bash

echo "Running intval3 dependency install script"
sudo apt update
sudo apt install git ufw nginx jq -y

echo "Installing node.js dependencies.."
sudo apt install nodejs npm -y
sudo npm install -g n
sudo n 9.9.0
sudo npm install -g npm@latest
sudo npm install -g pm2 node-gyp node-pre-gyp

echo "Installing bluetooth dependencies..."
sudo apt install bluetooth bluez libbluetooth-dev libudev-dev -y

sudo mkdir -p /root/state

echo "Finished installing intval3 dependencies"
