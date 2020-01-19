'use strict'
let pc;
let localConnection;
let sendChannel;
let receiveChannel;
let fileReader;

let receiveBuffer = [];
let receivedSize = 0;

let bytesPrev = 0;
let timestampPrev = 0;
let timestampStart;
let statsInterval = null;
let bitrateMax = 0;

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

const progress_sendProgress = document.querySelector('progress#sendProgress');
const progress_receiveProgress = document.querySelector('progress#receiveProgress');
const span_statusMessage = document.querySelector('span#status');
const div_bitRate = document.querySelector('div#bitrate');
const anchor_download = document.querySelector('a#download');

button_sendFile.addEventListener('click', () => sendData());

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

    pc.addEventListener('datachannel', receiveChannelCallback);

    sendChannel = pc.createDataChannel('sendDataChannel');
    sendChannel.binaryType = 'arraybuffer';

    sendChannel.addEventListener('open', onSendChannelStateChange);
    sendChannel.addEventListener('close', onSendChannelStateChange);
    sendChannel.addEventListener('error', error => console.error('Error in sendChannel: ', error));

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

function sendData() {
  console.log('Sending file!');
  const file = fileInput.files[0];
  console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

  // Handle 0 size files.
  span_statusMessage.textContent = '';
  anchor_download.textContent = '';
  if (file.size === 0) {
    div_bitRate.innerHTML = '';
    span_statusMessage.textContent = 'File is empty, please select a non-empty file';
    closeDataChannels();
    return;
  }
  progress_sendProgress.max = file.size;
  progress_receiveProgress.max = file.size;
  const chunkSize = 16384;
  fileReader = new FileReader();
  let offset = 0;
  fileReader.addEventListener('error', error => console.error('Error reading file:', error));
  fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
  fileReader.addEventListener('load', e => {
    console.log('FileRead.onload ', e);
    sendChannel.send(e.target.result);
    offset += e.target.result.byteLength;
    progress_sendProgress.value = offset;
    if (offset < file.size) {
      readSlice(offset);
    }
  });
  const readSlice = o => {
    console.log('readSlice ', o);
    const slice = file.slice(offset, o + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };
  readSlice(0);
}

function onSendChannelStateChange() {
  const readyState = sendChannel.readyState;
  console.log(`Send channel state is: ${readyState}`);
  // if (readyState === 'open') {
  //   sendData();
  // }
}

async function onReceiveChannelStateChange() {
  const readyState = receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);
  if (readyState === 'open') {
    timestampStart = (new Date()).getTime();
    timestampPrev = timestampStart;
    statsInterval = setInterval(displayStats, 500);
    await displayStats();
  }
}

function receiveChannelCallback(event){
  console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.binaryType = 'arraybuffer';
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;

  receivedSize = 0;
  bitrateMax = 0;
  anchor_download.textContent = '';
  anchor_download.removeAttribute('download');
  if (anchor_download.href) {
    URL.revokeObjectURL(anchor_download.href);
    anchor_download.removeAttribute('href');
  }
}

function onReceiveMessageCallback(event){
  console.log(`Received Message ${event.data.byteLength}`);
  receiveBuffer.push(event.data);
  receivedSize += event.data.byteLength;

  progress_receiveProgress.value = receivedSize;

  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
  // const file = fileInput.files[0];
  // if (receivedSize === file.size) {
    const received = new Blob(receiveBuffer);
    receiveBuffer = [];

    anchor_download.href = URL.createObjectURL(received);
    anchor_download.download = "download.pdf";
    // anchor_download.textContent =
    //   `Click to download '${file.name}' (${file.size} bytes)`;
    anchor_download.textContent =
      `Click to download`;
    anchor_download.style.display = 'block';

    const bitrate = Math.round(receivedSize * 8 /
      ((new Date()).getTime() - timestampStart));
    div_bitRate.innerHTML =
      `<strong>Average Bitrate:</strong> ${bitrate} kbits/sec (max: ${bitrateMax} kbits/sec)`;

    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }

    closeDataChannels();
  // }
}

function closeDataChannels() {
  console.log('Closing data channels');
  sendChannel.close();
  console.log(`Closed data channel with label: ${sendChannel.label}`);
  if (receiveChannel) {
    receiveChannel.close();
    console.log(`Closed data channel with label: ${receiveChannel.label}`);
  }
  // re-enable the file select
  input_fileInput.disabled = false;
  button_abort.disabled = true;
  button_sendFile.disabled = false;
}

// display bitrate statistics.
async function displayStats() {
  if (pc && pc.iceConnectionState === 'connected') {
    const stats = await pc.getStats();
    let activeCandidatePair;
    stats.forEach(report => {
      if (report.type === 'transport') {
        activeCandidatePair = stats.get(report.selectedCandidatePairId);
      }
    });
    if (activeCandidatePair) {
      if (timestampPrev === activeCandidatePair.timestamp) {
        return;
      }
      // calculate current bitrate
      const bytesNow = activeCandidatePair.bytesReceived;
      const bitrate = Math.round((bytesNow - bytesPrev) * 8 /
        (activeCandidatePair.timestamp - timestampPrev));
      div_bitRate.innerHTML = `<strong>Current Bitrate:</strong> ${bitrate} kbits/sec`;
      timestampPrev = activeCandidatePair.timestamp;
      bytesPrev = bytesNow;
      if (bitrate > bitrateMax) {
        bitrateMax = bitrate;
      }
    }
  }
}