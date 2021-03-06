"use strict";

/* Load Electron */
const ipcRenderer = window.ipcRenderer;
const remote = window.remote;
/* Load my modules */
const myMqtt = remote.require('./src/myMqtt.js');
const mySerial = remote.require('./src/mySerial.js');
var myParser = remote.require('./src/myParser.js');

/* HTML elements */
const updateComPortButton = document.getElementById('updateComPortListButton');
const selectComPort = document.getElementById("inputGroupComPort");
const selectBaudRate = document.getElementById("inputGroupBaudRate");
const startGetSerialDataToggle = document.getElementById('serialSwitch');
const serialConsole = document.getElementById('serialConsole');

const connectButton = document.getElementById('mqttSwitch');
const mqttConsole = document.getElementById('mqttConsole');
const transferSerial2MqttToggle = document.getElementById('transferSwitch');
const selectParserButton = document.getElementById('selectParserListButton');
const selectParser = document.getElementById("inputGroupParser");
const testPubButton = document.getElementById('testPublishButton');

/* Global variables */
var transferFlag;

function initialize(){
	transferFlag = false;
	initSerialPortsList();
	initParserList();

	mqttConsole.value = "MQTT Console Ready...\n";
	serialConsole.value = "Serial Console Ready...\n";
}

function initSerialPortsList(){
	// 選択ボックスをクリア
	var length = selectComPort.options.length;
	for (var i = length - 1; 0 <= i; i--) {
		// 逆順でないとうまくいかないので注意
		selectComPort.options[i].selected = false;
		selectComPort.options[i] = null;
	}
	// クリア完了
	// 未選択の選択肢を追加
	let op = document.createElement("option");
	op.value = "None";
	op.text = "None";
	selectComPort.appendChild(op);
	selectComPort.options[0].selected = true;	// Noneを選択状態に
}

function initParserList() {
	// 選択ボックスをクリア
	var length = selectParser.options.length;
	for (var i = length - 1; 0 <= i; i--) {
		// 逆順でないとうまくいかないので注意
		selectParser.options[i].selected = false;
		selectParser.options[i] = null;
	}
	// クリア完了
	// 未選択の選択肢を追加
	let op = document.createElement("option");
	op.value = "./src/myParser.js";
	op.text = "Default (CO2 Hiroshima Sensor)";
	selectParser.appendChild(op);
	selectParser.options[0].selected = true;	// Noneを選択状態に
}

function updateSerialPortsList(ports){
	initSerialPortsList();

	ports.forEach((port) => {
		// 選択欄に追加
		// マルチバイト文字は化ける
		let op = document.createElement("option");
		op.value = port.comName;
		op.text = port.manufacturer + " (" + port.comName + ")";
		selectComPort.appendChild(op);
	});
}

function updateSerialConsole(identifier, msg){
	if(serialConsole.value === null){
		serialConsole.value = "";
	}
	switch(identifier){
		case "open":
			serialConsole.value = "[Info] " + msg + "\n";
			break;
		case "close":
			serialConsole.value += "\n[Info] " + msg;
			if (startGetSerialDataToggle.checked === true){
				startGetSerialDataToggle.checked = false;
				closeSerialPort();
			}
			break;
		case "error":
			serialConsole.value += "\n[Error] " + msg;
			startGetSerialDataToggle.checked = false;
			closeSerialPort();
			break;
		case "data":
			serialConsole.value += msg + "\n";
			break;
		case "clear":
			serialConsole.value = "";
			break;
		default:
			serialConsole.value += msg + "\n";
	}

	/* 最大履歴の管理 */
	const maxLength = 10000;
	if (serialConsole.value.length > maxLength){
		var len = serialConsole.value.length - maxLength;
		var tmp = serialConsole.value;
		serialConsole.value = tmp.slice(len);
	}
	// スクロールを最下部に移動
	serialConsole.scrollTop = serialConsole.scrollHeight;
}

function transferSerial2Mqtt(serialMsg){
	if (myMqtt.isConnected() === false){
		return;
	}
	if (transferFlag === false){
		return;
	}

	var data = myParser.parse(serialMsg);
	if (data === null){
		return;
	}
	myMqtt.publish(data.topic, data.payload);
}

function updateMqttConsole(identifier, msg){
	if (mqttConsole.value === null) {
		mqttConsole.value = "";
	}
	switch (identifier) {
		case "connect":
			mqttConsole.value = "[Info] " + msg;
			transferSerial2MqttToggle.disabled = false;
			testPubButton.disabled = false;
			break;
		case "disconnect":
			mqttConsole.value += "\n[Info] " + msg;
			if (connectButton.checked === true){
				connectButton.checked = false;
				mqttDisconnect();
			}
			break;
		case "error":
			mqttConsole.value += "\n[Error] " + msg;
			connectButton.checked = false;
			mqttDisconnect();
			break;
		case "publish":
			mqttConsole.value += "[Info] " + msg;
			break;
		case "clear":
			mqttConsole.value = "";
			break;
		default:
			mqttConsole.value += msg + "\n";
	}

	/* 最大履歴の管理 */
	const maxLength = 10000;
	if (mqttConsole.value.length > maxLength) {
		var len = mqttConsole.value.length - maxLength;
		var tmp = mqttConsole.value;
		mqttConsole.value = tmp.slice(len);
	}
	// スクロールを最下部に移動
	mqttConsole.scrollTop = mqttConsole.scrollHeight;
}

function openSerialPort(){
	var portName = selectComPort.options[selectComPort.selectedIndex].value;
	if (portName === 'None') {
		startGetSerialDataToggle.checked = false;
		return;
	}
	// ポート選択と更新をロック
	selectComPort.disabled = true;
	updateComPortButton.disabled = true;
	selectBaudRate.disabled = true;

	// シリアル接続開始
	var baud = selectBaudRate.options[selectBaudRate.selectedIndex].value;
	mySerial.attachSerialPort(portName, Number(baud));
}

function closeSerialPort(){
	mySerial.detachSerialPort();
	// ポート選択と更新をアンロック
	selectComPort.disabled = false;
	updateComPortButton.disabled = false;
	selectBaudRate.disabled = false;
}

function mqttConnect(){
	var error_msg = "Invalid port number!\n"
	if (isNaN(inputPortNumber.value)){
		updateMqttConsole("error", error_msg);
		return;
	}
	var port = Number(inputPortNumber.value);
	if (port < 0 || 65535 < port){
		updateMqttConsole("error", error_msg);
		return;
	}

	// 入力を制限
	inputBrokerName.disabled = true;
	inputPortNumber.disabled = true;

	myMqtt.connect(inputBrokerName.value, port);
}

function mqttDisconnect(){
	myMqtt.disconnect();
	transferSerial2MqttToggle.checked = false;
	transferFlag = false;
	selectParser.disabled = false;
	selectParserButton.disabled = false;
	transferSerial2MqttToggle.checked = false;
	transferSerial2MqttToggle.disabled = true;

	// 入力制限を解除
	inputBrokerName.disabled = false;
	inputPortNumber.disabled = false;
	testPubButton.disabled = true;
}

function loadParserFile(fpath){
	var tmp = myParser;
	myParser = remote.require(fpath);
	try{
		//console.log("checking...")
		myParser.parse("test message");

		var length = selectParser.options.length;
		for(var i=0; i<length; i++){
			if (selectParser.options[i].value === fpath){
				//console.log("Already loaded!")
				throw "Parser already loaded"
			}
		}
	}
	catch (e) {
		//console.log("error");
		updateMqttConsole("error", "Error to load parser\n");
		myParser = tmp;
		return;
	}

	let op = document.createElement("option");
	op.value = fpath;
	op.text = fpath;
	selectParser.appendChild(op);

	var length = selectParser.options.length;
	selectParser.options[length - 1].selected = true;
	var msg = "[Info] Load new parser\n\t-> " + fpath;
	updateMqttConsole("load parser", msg);
}


/***********
 * イベント処理
************ */
function showOpenParserFileDialog() {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.js';
	input.onchange = function (event) {
		loadParserFile(event.target.files[0].path);
	};	
	input.click();
};


ipcRenderer.on("ch_serialport_show", function (evt, identifier, msg){
	updateSerialConsole(identifier, msg);
	
	// 転送するかチェック
	// MQTT側へ送信
	transferSerial2Mqtt(msg);
});

ipcRenderer.on("ch_mqtt", function (evt, identifier, msg){
	updateMqttConsole(identifier, msg);
});

ipcRenderer.on("ch_serialport_info", function (evt, ports){
	updateSerialPortsList(ports);
});

connectButton.addEventListener('change', function (){
	if (this.checked){
		mqttConnect();
	}
	else{
		mqttDisconnect();
	}
});

selectParserButton.addEventListener('click', function(){
	showOpenParserFileDialog();
});

selectParser.addEventListener('change', function(){
	var fpath = selectParser.options[selectParser.selectedIndex].value;
	var msg = "[Info] Change parser\n\t-> " + fpath;
	updateMqttConsole("load parser", msg);

	myParser = remote.require(fpath);
});

updateComPortButton.addEventListener('click', function(clickEvent){
	mySerial.fetchSerialPortInfo();
});

startGetSerialDataToggle.addEventListener('change', function(){
	if (this.checked){
		openSerialPort();
	}
	else{
		closeSerialPort();
	}
});

 transferSerial2MqttToggle.addEventListener('change', function (){
	if (this.checked){
		transferFlag = true;
		selectParser.disabled = true;
		selectParserButton.disabled = true;
	}
	else{
		transferFlag = false;
		selectParser.disabled = false;
		selectParserButton.disabled = false;
	}
});

testPubButton.addEventListener("click", function(){
	if (myMqtt.isConnected){
		myMqtt.publish("test", "testPubOK");
	}
});

// window読み込み完了時に呼び出し
window.addEventListener("load", function() {
	initialize();
	// シリアルポート情報を初期化
	mySerial.fetchSerialPortInfo();	
});

// window終了前に実行
window.addEventListener("beforeunload", function(){
	// シリアルポートを明示的に開放
	mySerial.detachSerialPort();
});

