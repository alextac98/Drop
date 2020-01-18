class Session {
    peerConnection = null;
    // remotePeerConnection = null;
    constructor(session_id, isSender){
        this.session_id = session_id;
        console.log('Session ID: ' + session_id);

        this.peerConnection = new RTCPeerConnection(null);
        this.peerConnection.onicecandiate

        this.peerConnection.addEventListener('icecandidate', this._handleConnection);
        this.pPeerConnection.addEventListener(
            'iceconnectionstatechange', this._handleConnectionChange);
        this.peerConnection.addEventListener('filesent', this._handleFileReceive);

    }

    sendFile(){

    }

    _handleFileReceive(event){

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