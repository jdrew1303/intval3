'use strict'

/** @module ble */
/** Bluetooth Low Energy module */

const os = require('os')
const bleno = require('bleno')
const util = require('util')

const log = require('../log')('ble')
const wifi = require('../wifi')

const BLENO_DEVICE_NAME = process.env.BLENO_DEVICE_NAME || 'intval3'
const DEVICE_ID = process.env.DEVICE_ID || 'intval3'
const SERVICE_ID = process.env.SERVICE_ID || 'intval3_ble'
const CHAR_ID = process.env.CHAR_ID || 'intval3char'
const WIFI_ID = process.env.WIFI_ID || 'wifichar'
const NETWORK = os.networkInterfaces()
const MAC = getMac() || spoofMac()

let currentWifi = 'disconnected'

const chars = []

function createChar(name, uuid, prop, write, read) {
	function characteristic () {
		bleno.Characteristic.call(this, {
			uuid : uuid,
			properties: prop
		})
	}
	util.inherits(characteristic, bleno.Characteristic)
	if (prop.indexOf('read') !== -1) {
		//data, offset, withoutResponse, callback
		characteristic.prototype.onReadRequest = read
	}
	if (prop.indexOf('write') !== -1) {
		characteristic.prototype.onWriteRequest = write	
	}
	chars.push(new characteristic())
}

function createChars (onWrite, onRead) {
	createChar('intval3', CHAR_ID, ['read', 'write'], onWrite, onRead)
	createChar('wifi', WIFI_ID, ['read', 'write'], onWifiWrite, onWifiRead)
}

function onWifiWrite (data, offset, withoutResponse, callback) {
	let result
	let utf8
	let obj
	let ssid
	let pwd
	if (offset) {
		log.warn(`Offset scenario`)
		result = bleno.Characteristic.RESULT_ATTR_NOT_LONG
    	return callback(result)
 	}
 	utf8 = data.toString('utf8')
 	obj = JSON.parse(utf8)
 	ssid = obj.ssid
 	pwd = obj.pwd
 	log.info(`connecting to AP`, { ssid : ssid })
 	return wifi.setNetwork(ssid, pwd, (err, data) => {
 		if (err) {
 			log.error('Error configuring wifi', err)
 			result = bleno.Characteristic.RESULT_UNLIKELY_ERROR
			return callback(result)
 		}
 		currentWifi = ssid
 		log.info(`Connected to AP`, { ssid : ssid })
 		result = bleno.Characteristic.RESULT_SUCCESS
		return callback(result)
 	})
}

function onWifiRead (offset, callback) {
	const result = bleno.Characteristic.RESULT_SUCCESS
	const data = new Buffer(JSON.stringify(currentWifi))
	callback(result, data.slice(offset, data.length))
}

function getMac () {
	const colonRe = new RegExp(':', 'g')
	if (NETWORK && NETWORK.wlan0 && NETWORK.wlan0[0] && NETWORK.wlan0[0].mac) {
		return NETWORK.wlan0[0].mac.replace(colonRe, '')
	}
	return undefined
}

function spoofMac () {
	const fs = require('fs')
	const FSPATH = require.resolve('uuid')
	const IDFILE = os.homedir() + '/.intval3id'
	let uuid
	let UUIDPATH
	let TMP
	let MACTMP
	let dashRe
	delete require.cache[FSPATH]
	if (fs.existsSync(IDFILE)) {
		return fs.readFileSync(IDFILE, 'utf8')
	}
	uuid = require('uuid').v4
	UUIDPATH = require.resolve('uuid')
	delete require.cache[UUIDPATH]
	TMP = uuid()
	MACTMP = TMP.replace(dashRe, '').substring(0, 12)
	dashRe = new RegExp('-', 'g')
	fs.writeFileSync(IDFILE, MACTMP, 'utf8')
	return MACTMP
}


function capitalize (s) {
    return s[0].toUpperCase() + s.slice(1)
}

/** Class representing the bluetooth interface */
class BLE {
	/**
	* Establishes Bluetooth Low Energy services, accessible to process through this class
	*
	* @constructor
	*/
	constructor () {
		log.info('Starting bluetooth service')

		bleno.on('stateChange', state  => {
			const BLE_ID = `${DEVICE_ID}_${MAC}`
			log.info('stateChange', { state : state })
			if (state === 'poweredOn') {
				log.info('Starting advertising', { BLE_ID : BLE_ID })
				bleno.startAdvertising(BLENO_DEVICE_NAME, [BLE_ID])
			} else {
				bleno.stopAdvertising()
			}
		})

		bleno.on('advertisingStart', err => {
			log.info('advertisingStart', { res : (err ? 'error ' + err : 'success') })
			createChars(this._onWrite.bind(this), this._onRead.bind(this))
			if (!err) {
				bleno.setServices([
					new bleno.PrimaryService({
						uuid : SERVICE_ID, //hardcoded across panels
						characteristics : chars
					})
				])
			}
		})

		bleno.on('accept', clientAddress => {
			log.info('accept', { clientAddress : clientAddress })
		})

		bleno.on('disconnect', clientAddress => {
			log.info('disconnect', { clientAddress : clientAddress })
		})
	}
	_onWrite (data, offset, withoutResponse, callback) {
		let result
		let utf8
		let obj
		if (offset) {
			log.warn(`Offset scenario`)
			result = bleno.Characteristic.RESULT_ATTR_NOT_LONG
	    	return callback(result)
	 	}
	 	utf8 = data.toString('utf8')
 		obj = JSON.parse(utf8)
 		console.dir(obj)
	 	result = bleno.Characteristic.RESULT_SUCCESS
		return callback(result)
	}
	_onRead (offset, callback) {
		const result = bleno.Characteristic.RESULT_SUCCESS
		const data = new Buffer(JSON.stringify( { success : true } ))
		callback(result, data.slice(offset, data.length))
	}
	/**
	* Binds functions to events that are triggered by BLE messages
	*
	* @param {string} 		eventName 	Name of the event to to bind
	* @param {function} 	callback 	Invoked when the event is triggered
	*/
	on (eventName, callback) {
		this[`_on${capitalize(eventName)}`] = callback
	}
}

module.exports = new BLE()