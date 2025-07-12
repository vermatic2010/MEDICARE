const WebSocket = require('ws');
const http = require('http');

class VideoCallSignalingServer {
  constructor() {
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    this.users = new Map(); // userId -> { socket, role, appointmentId }
    this.appointments = new Map(); // appointmentId -> { doctor, patient }
    
    this.setupWebSocketHandlers();
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (socket) => {
      console.log('New WebSocket connection');
      
      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(socket, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      socket.on('close', () => {
        this.handleDisconnection(socket);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  handleMessage(socket, message) {
    console.log('Received message:', message.type);
    
    switch (message.type) {
      case 'register':
        this.handleUserRegistration(socket, message);
        break;
        
      case 'call-offer':
        this.handleCallOffer(socket, message);
        break;
        
      case 'call-answer':
        this.handleCallAnswer(socket, message);
        break;
        
      case 'ice-candidate':
        this.handleIceCandidate(socket, message);
        break;
        
      case 'call-ended':
        this.handleCallEnded(socket, message);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  handleUserRegistration(socket, message) {
    const { userId, role, appointmentId } = message;
    
    console.log(`🔵 Registering user: ${userId} as ${role} for appointment ${appointmentId}`);
    
    // Store user information
    this.users.set(userId, {
      socket,
      role,
      appointmentId,
      connected: true
    });
    
    // Associate user with appointment
    if (!this.appointments.has(appointmentId)) {
      this.appointments.set(appointmentId, {});
      console.log(`📅 Created new appointment entry for ${appointmentId}`);
    }
    
    const appointment = this.appointments.get(appointmentId);
    appointment[role] = userId;
    
    console.log(`📋 Appointment ${appointmentId} now has:`, appointment);
    
    // Send registration confirmation
    socket.send(JSON.stringify({
      type: 'user-registered',
      userId: userId,
      role: role
    }));

    // Notify about other users in the same appointment
    const otherUsers = this.getAppointmentUsers(appointmentId, userId);
    console.log(`👥 Found ${otherUsers.length} other users in appointment ${appointmentId}:`, otherUsers.map(u => ({ id: u.userId, role: u.role })));
    
    if (otherUsers.length > 0) {
      console.log(`📤 Sending user-joined message to ${userId} about other users`);
      socket.send(JSON.stringify({
        type: 'user-joined',
        users: otherUsers.map(u => ({ id: u.userId, role: u.role }))
      }));
      
      // Notify other users about this user joining
      console.log(`📤 Notifying ${otherUsers.length} other users about ${userId} joining`);
      otherUsers.forEach(user => {
        if (user.socket.readyState === WebSocket.OPEN) {
          console.log(`📤 Sending notification to ${user.userId} about ${userId} joining`);
          user.socket.send(JSON.stringify({
            type: 'user-joined',
            users: [{ id: userId, role: role }]
          }));
        }
      });
    }
    
    console.log(`✅ User ${userId} registered as ${role} for appointment ${appointmentId}`);
  }

  handleCallOffer(socket, message) {
    const { offer, appointmentId } = message;
    const callerUserId = this.getUserBySocket(socket);
    
    if (!callerUserId) return;
    
    // Find the other user in the same appointment
    const otherUsers = this.getAppointmentUsers(appointmentId, callerUserId);
    
    if (otherUsers.length === 0) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'No other user found in appointment'
      }));
      return;
    }
    
    // Send offer to the other user
    const targetUser = otherUsers[0];
    if (targetUser.socket.readyState === WebSocket.OPEN) {
      targetUser.socket.send(JSON.stringify({
        type: 'call-offer',
        offer: offer,
        from: callerUserId
      }));
    }
    
    console.log(`Call offer sent from ${callerUserId} to ${targetUser.userId}`);
  }

  handleCallAnswer(socket, message) {
    const { answer, to } = message;
    const answerUserId = this.getUserBySocket(socket);
    
    console.log(`Call answer from ${answerUserId} to ${to}`);
    
    if (!answerUserId) {
      console.log('Could not find answer user ID');
      return;
    }
    
    // Send answer to the caller
    const targetUser = this.users.get(to);
    if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
      console.log(`Sending call answer to ${to}`);
      targetUser.socket.send(JSON.stringify({
        type: 'call-answer',
        answer: answer,
        from: answerUserId
      }));
    } else {
      console.log(`Target user ${to} not found or socket not open`);
    }
    
    console.log(`Call answer sent from ${answerUserId} to ${to}`);
  }

  handleIceCandidate(socket, message) {
    const { candidate, to } = message;
    const senderUserId = this.getUserBySocket(socket);
    
    if (!senderUserId) return;
    
    // Forward ICE candidate to the target user
    const targetUser = this.users.get(to);
    if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
      targetUser.socket.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: candidate,
        from: senderUserId
      }));
    }
  }

  handleCallEnded(socket, message) {
    const { appointmentId } = message;
    const userId = this.getUserBySocket(socket);
    
    if (!userId) return;
    
    // Notify other users in the appointment that call ended
    const otherUsers = this.getAppointmentUsers(appointmentId, userId);
    otherUsers.forEach(user => {
      if (user.socket.readyState === WebSocket.OPEN) {
        user.socket.send(JSON.stringify({
          type: 'call-ended',
          from: userId
        }));
      }
    });
    
    console.log(`Call ended by ${userId} in appointment ${appointmentId}`);
  }

  handleDisconnection(socket) {
    const userId = this.getUserBySocket(socket);
    
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        // Notify other users in the same appointment
        const otherUsers = this.getAppointmentUsers(user.appointmentId, userId);
        otherUsers.forEach(otherUser => {
          if (otherUser.socket.readyState === WebSocket.OPEN) {
            otherUser.socket.send(JSON.stringify({
              type: 'user-disconnected',
              userId: userId
            }));
          }
        });
        
        // Clean up appointment if both users disconnected
        const appointment = this.appointments.get(user.appointmentId);
        if (appointment) {
          if (appointment.doctor === userId) {
            delete appointment.doctor;
          }
          if (appointment.patient === userId) {
            delete appointment.patient;
          }
          
          // Remove appointment if empty
          if (!appointment.doctor && !appointment.patient) {
            this.appointments.delete(user.appointmentId);
          }
        }
      }
      
      this.users.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  getUserBySocket(socket) {
    for (const [userId, user] of this.users.entries()) {
      if (user.socket === socket) {
        return userId;
      }
    }
    return null;
  }

  getAppointmentUsers(appointmentId, excludeUserId = null) {
    const users = [];
    for (const [userId, user] of this.users.entries()) {
      if (user.appointmentId === appointmentId && userId !== excludeUserId) {
        users.push({ userId, ...user });
      }
    }
    return users;
  }

  start(port = 3002) {
    this.server.listen(port, () => {
      console.log(`🎥 Video Call Signaling Server running on port ${port}`);
      console.log(`WebSocket endpoint: ws://localhost:${port}`);
    });
    
    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use!`);
        console.error('💡 Trying alternative port...');
        // Try next port
        const alternativePort = port + 1;
        if (alternativePort <= 3010) { // Limit attempts to avoid infinite loop
          setTimeout(() => this.start(alternativePort), 1000);
        } else {
          console.error('❌ Unable to find available port for video call server');
          console.error('💡 To fix this:');
          console.error('   1. Kill existing processes: taskkill /f /im node.exe');
          console.error('   2. Or restart your computer');
        }
        return;
      }
      console.error('❌ Video Call Server Error:', error);
    });
  }
}

module.exports = VideoCallSignalingServer;

// Auto-start the server when run directly
if (require.main === module) {
  const server = new VideoCallSignalingServer();
  server.start(3002);
}
