'use strict'
let pc;
let localConnection;
let sendChannel;
let fileReader;

var debug = true;
var isChannelReady = false;
var isHost = false;
var isStarted = false;
var localStream;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var room = prompt('Enter room name');

////////////////////////////////////////////////
// ---------- Set up HTML Elements ---------- //
////////////////////////////////////////////////
const input_fileInput = document.querySelector('input#fileInput');
const button_sendFile = document.querySelector('button#sendFile');
const button_abort = document.querySelector('button#abortButton');

button_sendFile.addEventListener('click', () => sendFile());

button_abort.addEventListener('click', () => {
  console.log('Abort read!');
});

input_fileInput.addEventListener('change', () => {
  const file = input_fileInput.files[0];
  if (!file) {
    console.log('No file chosen');
  } else {
    button_sendFile.disabled = false;
  }
});

////////////////////////////////////////////////
// ---------- Socket.io Connection ---------- //
////////////////////////////////////////////////

var socket = io.connect();
if (room !== ''){
  socket.emit('create or join', room);
  console.log('Attempt made to create or join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isHost = true;
  createPeerConnection();
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
  isHost = false;
  createPeerConnection();
  sendWebRTCOffer();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

///////////////////////////////////////////////////
// ---------- Socket.io Send/Receive ----------- //
///////////////////////////////////////////////////

function sendMessage(message){
  if (debug) console.log('Client sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('Client received a message:', message);
  if (message === 'got user media') {

  } else if (message.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    sendWebRTCAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted){
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted){
    // TODO: Add shutdown procedure
  }
});

//////////////////////////////////////////////////
// ---------- Manage Peer Connection ---------- //
//////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;

    var sendChannel = pc.createDataChannel('sendDataChannel');
    sendChannel.binaryType = 'arraybuffer';

    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
  isStarted = true;
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function sendWebRTCOffer() {
  // Send offer to peer
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  console.log('Sent offer to peer');
}

function sendWebRTCAnswer() {
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
  console.log('Sent answer to peer');
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function onCreateSessionDescriptionError(error) {
  console.log('create session description: ', event);
}


////////////////////////////////////////////////////////
// ----------- File Send/Receive Functions ---------- //
////////////////////////////////////////////////////////

function sendFile() {
  console.log('Sending file!');
}
