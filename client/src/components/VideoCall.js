import React, { useState, useRef, useEffect } from 'react';
import './VideoCall.css';

const VideoCall = ({ user, role, appointmentId, onEndCall }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [callStatus, setCallStatus] = useState('Initializing...');
  const [currentUserId] = useState(role === 'doctor' ? 'doctor1' : 'patient1'); // Fixed user ID for testing
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const websocketRef = useRef(null);
  const remoteUserIdRef = useRef(null); // Use ref to avoid closure issues

  // WebRTC configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    console.log('VideoCall initialized with:', { 
      userId: currentUserId, 
      role, 
      appointmentId 
    });
    initializeWebSocket();
    return () => {
      cleanup();
    };
  }, []);

  const initializeWebSocket = () => {
    // Connect to WebSocket signaling server
    websocketRef.current = new WebSocket('ws://localhost:3002');
    
    websocketRef.current.onopen = () => {
      console.log('WebSocket connected');
      console.log('Registering user:', { userId: currentUserId, role, appointmentId });
      
      // Register user with server
      websocketRef.current.send(JSON.stringify({
        type: 'register',
        userId: currentUserId,
        role: role,
        appointmentId: appointmentId
      }));
      setCallStatus('Ready to call');
    };

    websocketRef.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await handleSignalingMessage(message);
    };

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setCallStatus('Connection error');
    };

    websocketRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setCallStatus('Disconnected');
    };
  };

  const handleSignalingMessage = async (message) => {
    switch (message.type) {
      case 'user-registered':
        console.log('User registered successfully');
        setCallStatus('Connected. Looking for other participants...');
        break;
        
      case 'call-offer':
        setCallStatus('Incoming call...');
        setRemoteUserId(message.from);
        remoteUserIdRef.current = message.from; // Store in ref as well
        console.log('Call offer received from:', message.from);
        console.log('Set remoteUserId to:', message.from);
        await handleIncomingCall(message.offer);
        break;
        
      case 'call-answer':
        console.log('Call answer received from:', message.from);
        setRemoteUserId(message.from);
        remoteUserIdRef.current = message.from; // Store in ref as well
        await handleCallAnswer(message.answer);
        break;
        
      case 'ice-candidate':
        await handleIceCandidate(message.candidate);
        break;
        
      case 'call-ended':
        handleCallEnded();
        break;
        
      case 'user-joined':
        console.log('User joined message received:', message);
        if (message.users) {
          const otherUsers = message.users.filter(u => u.id !== currentUserId);
          console.log('Current user:', currentUserId, 'Other users found:', otherUsers);
          if (otherUsers.length > 0) {
            console.log(`Found ${otherUsers.length} other user(s) in appointment ${appointmentId}`);
            const otherUser = otherUsers[0];
            setRemoteUserId(otherUser.id); // Set the remote user ID
            remoteUserIdRef.current = otherUser.id; // Store in ref as well
            
            // Only doctor should initiate the call to avoid conflicts
            if (role === 'doctor') {
              setCallStatus('Patient available. Starting call...');
              // Auto-start call as doctor with a small delay
              setTimeout(() => {
                console.log('Doctor initiating call to patient');
                startCall();
              }, 1000);
            } else {
              setCallStatus('Doctor available. Waiting for call...');
              console.log('Patient waiting for doctor to initiate call');
            }
          } else {
            setCallStatus(`Waiting for ${role === 'doctor' ? 'patient' : 'doctor'} to join...`);
          }
        }
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const startCall = async () => {
    try {
      // Prevent multiple call attempts
      if (isCallActive) {
        console.log('Call already active, skipping start call');
        return;
      }
      
      setCallStatus('Starting call...');
      console.log('Starting call initiation process');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('Media stream obtained:', stream);
      console.log('Audio tracks:', stream.getAudioTracks());
      console.log('Video tracks:', stream.getVideoTracks());
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Ensure local video plays
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
      }

      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      // Add debugging for connection state
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state change:', peerConnectionRef.current.connectionState);
      };
      
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state change:', peerConnectionRef.current.iceConnectionState);
      };
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Handle incoming stream
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Remote stream received:', event.streams[0]);
        const remoteStream = event.streams[0];
        console.log('Remote audio tracks:', remoteStream.getAudioTracks());
        console.log('Remote video tracks:', remoteStream.getVideoTracks());
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          // Ensure the video plays
          remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
        }
        setIsConnected(true);
        setCallStatus('Connected');
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          safeSendMessage({
            type: 'ice-candidate',
            candidate: event.candidate,
            to: remoteUserIdRef.current // Use ref value
          });
        }
      };

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      safeSendMessage({
        type: 'call-offer',
        offer: offer,
        appointmentId: appointmentId
      });

      setIsCallActive(true);
      setCallStatus('Calling...');
      console.log('Call offer sent, waiting for answer from:', remoteUserIdRef.current);
      
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('Failed to start call');
    }
  };

  const handleIncomingCall = async (offer) => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('Media stream obtained (incoming call):', stream);
      console.log('Audio tracks (incoming):', stream.getAudioTracks());
      console.log('Video tracks (incoming):', stream.getVideoTracks());
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Ensure local video plays
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
      }

      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      // Add debugging for connection state
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state change (incoming):', peerConnectionRef.current.connectionState);
      };
      
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state change (incoming):', peerConnectionRef.current.iceConnectionState);
      };
      
      // Add local stream
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection (incoming):', track.kind);
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Handle incoming stream
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Remote stream received in incoming call:', event.streams[0]);
        const remoteStream = event.streams[0];
        console.log('Remote audio tracks (incoming):', remoteStream.getAudioTracks());
        console.log('Remote video tracks (incoming):', remoteStream.getVideoTracks());
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          // Ensure the video plays
          remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
        }
        setIsConnected(true);
        setCallStatus('Connected');
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          safeSendMessage({
            type: 'ice-candidate',
            candidate: event.candidate,
            to: remoteUserIdRef.current // Use ref value
          });
        }
      };

      // Set remote description and create answer
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      safeSendMessage({
        type: 'call-answer',
        answer: answer,
        to: remoteUserIdRef.current // Use ref value
      });

      setIsCallActive(true);
      setCallStatus('Connected');
      console.log('Call answer sent to:', remoteUserIdRef.current);
      console.log('Current remoteUserId value:', remoteUserIdRef.current);
      
    } catch (error) {
      console.error('Error handling incoming call:', error);
      setCallStatus('Failed to answer call');
    }
  };

  const handleCallAnswer = async (answer) => {
    try {
      console.log('Processing call answer, updating status to Connected');
      await peerConnectionRef.current.setRemoteDescription(answer);
      setIsConnected(true);
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error handling call answer:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const endCall = () => {
    safeSendMessage({
      type: 'call-ended',
      appointmentId: appointmentId
    });
    handleCallEnded();
  };

  const handleCallEnded = () => {
    cleanup();
    setIsCallActive(false);
    setIsConnected(false);
    setCallStatus('Call ended');
    onEndCall?.();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMutedState = !isMuted;
        audioTrack.enabled = !newMutedState; // enabled = opposite of muted
        setIsMuted(newMutedState);
        console.log('Audio track enabled:', audioTrack.enabled, 'Muted state:', newMutedState);
      } else {
        console.log('No audio track found');
      }
    } else {
      console.log('No local stream available');
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoOffState = !isVideoOff;
        videoTrack.enabled = !newVideoOffState; // enabled = opposite of video off
        setIsVideoOff(newVideoOffState);
        console.log('Video track enabled:', videoTrack.enabled, 'Video off state:', newVideoOffState);
      } else {
        console.log('No video track found');
      }
    } else {
      console.log('No local stream available');
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
  };

  // Helper function to safely send WebSocket messages
  const safeSendMessage = (message) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    } else if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
      // Wait for connection to open
      setTimeout(() => safeSendMessage(message), 100);
    } else {
      console.warn('WebSocket not available, cannot send message:', message.type);
    }
  };

  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <h3>� Telehealth Consultation - {role === 'doctor' ? 'Doctor' : 'Patient'} View</h3>
        <div className="call-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          {callStatus}
        </div>
      </div>

      <div className="video-streams">
        <div className="remote-video-container">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          {!isConnected && (
            <div className="video-placeholder">
              <div className="placeholder-avatar">
                👤
              </div>
              <p>Waiting for {role === 'doctor' ? 'patient' : 'doctor'}...</p>
            </div>
          )}
        </div>

        <div className="local-video-container">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
          <div className="video-label">You</div>
        </div>
      </div>

      <div className="video-controls">
        {!isCallActive ? (
          <button 
            className="start-call-btn"
            onClick={startCall}
            disabled={callStatus.includes('error') || callStatus.includes('Disconnected')}
          >
            📞 Start Call
          </button>
        ) : (
          <div className="call-controls">
            <button 
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            
            <button 
              className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Turn on video' : 'Turn off video'}
            >
              {isVideoOff ? '📹' : '📷'}
            </button>
            
            <button 
              className="control-btn end-call"
              onClick={endCall}
              title="End call"
            >
              📞❌
            </button>
          </div>
        )}
      </div>

      <div className="appointment-info">
        <p><strong>Appointment ID:</strong> {appointmentId}</p>
        <p><strong>User:</strong> {user?.full_name || user?.username || 'Anonymous'}</p>
        <p><strong>Role:</strong> {role}</p>
      </div>
    </div>
  );
};

export default VideoCall;
