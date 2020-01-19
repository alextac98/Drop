class Session {
    // remotePeerConnection = null;
    constructor(session_id, isSender){
        this.session_id = session_id;
        console.log('Session ID: ' + session_id);

        this.peerConnection = new RTCPeerConnection(null);
        this.peerConnection.onicecandiate = this._handleIceCandidate;
        this.peerConnection.ondatachannel = this._handleConnection;

        this.peerConnection.addEventListener('icecandidate', this._handleConnection);
        this.pPeerConnection.addEventListener(
            'iceconnectionstatechange', this._handleConnectionChange);
        this.peerConnection.addEventListener('filesent', this._handleFileReceive);

    }

    sendFile(){

    }

    _handleIceCandidate(event){
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

    _handleConnection(event) {
        
    }

    _handleConnectionChange(event) {

    }

}

class Room {

    constructor(room_id) {
        io.connect();
    }

}