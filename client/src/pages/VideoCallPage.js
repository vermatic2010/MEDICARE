import React, { useState, useEffect } from 'react';
import VideoCall from '../components/VideoCall';
import './VideoCallPage.css';

const VideoCallPage = ({ user, role, onNavigate }) => {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      let response;
      
      if (role === 'doctor') {
        response = await fetch(`http://localhost:3001/api/doctors/appointments/${user?.id || 1}`);
      } else {
        response = await fetch(`http://localhost:3001/api/patients/appointments/${user?.id || 1}`);
      }
      
      const data = await response.json();
      
      // Show all upcoming appointments (API already filters for future appointments)
      const filteredAppointments = data.appointments || [];
      
      setAppointments(filteredAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCall = (appointment) => {
    setSelectedAppointment(appointment);
    setIsInCall(true);
  };

  const handleEndCall = () => {
    setIsInCall(false);
    setSelectedAppointment(null);
  };

  const formatDateTime = (dateTime) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <div className="video-call-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (isInCall && selectedAppointment) {
    return (
      <div className="video-call-page">
        <VideoCall
          user={user}
          role={role}
          appointmentId={999}
          onEndCall={handleEndCall}
        />
      </div>
    );
  }

  return (
    <div className="video-call-page">
      <div className="video-call-header">
        <h2>� Telehealth Center</h2>
        <p>Select an appointment to join a video consultation</p>
      </div>

      <div className="role-indicator">
        <span className={`role-badge ${role}`}>
          {role === 'doctor' ? '👨‍⚕️ Doctor' : '👤 Patient'}
        </span>
        <span className="user-name">{user?.full_name || user?.username || 'Anonymous'}</span>
      </div>

      {appointments.length === 0 ? (
        <div className="no-appointments">
          <div className="no-appointments-icon">📅</div>
          <h3>No Upcoming Appointments</h3>
          <p>
            {role === 'doctor' 
              ? "You don't have any upcoming appointments for telehealth consultations."
              : "You don't have any upcoming appointments. Book an appointment to start a telehealth consultation with your doctor."
            }
          </p>
          <button 
            className="book-appointment-btn"
            onClick={() => onNavigate('triage')}
          >
            {role === 'doctor' ? 'View All Appointments' : 'Book Appointment'}
          </button>
        </div>
      ) : (
        <div className="appointments-grid">
          {appointments.map((appointment) => {
            const { date, time } = formatDateTime(appointment.appointment_time);
            const appointmentDate = new Date(appointment.appointment_time);
            const now = new Date();
            const isToday = appointmentDate.toDateString() === now.toDateString();
            const isPast = appointmentDate < now;
            const isUpcoming = appointmentDate > now && !isToday;
            // TEMPORARY: Enable all appointments for testing
            const canJoin = true; // Original: isToday && Math.abs(appointmentDate - now) <= 30 * 60 * 1000;
            
            return (
              <div 
                key={appointment.id} 
                className={`appointment-card joinable`}
              >
                <div className="appointment-header">
                  <div className="appointment-id">
                    Appointment #{appointment.id}
                  </div>
                  <div className={`appointment-status ${isPast ? 'past' : isToday ? 'today' : 'upcoming'}`}>
                    {isPast ? 'Past' : isToday ? 'Today' : 'Upcoming'}
                  </div>
                </div>

                <div className="appointment-details">
                  <div className="appointment-time">
                    <span className="date">📅 {date}</span>
                    <span className="time">🕐 {time}</span>
                  </div>

                  <div className="appointment-participants">
                    {role === 'doctor' ? (
                      <div className="participant">
                        <span className="participant-role">👤 Patient:</span>
                        <span className="participant-name">
                          {appointment.patient_name || 'Unknown Patient'}
                        </span>
                      </div>
                    ) : (
                      <div className="participant">
                        <span className="participant-role">👨‍⚕️ Doctor:</span>
                        <span className="participant-name">
                          Dr. {appointment.doctor_name || 'Unknown Doctor'}
                        </span>
                        {appointment.doctor_specialization && (
                          <span className="participant-specialty">
                            ({appointment.doctor_specialization})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {appointment.notes && (
                    <div className="appointment-notes">
                      <strong>Notes:</strong> {appointment.notes}
                    </div>
                  )}
                </div>

                <div className="appointment-actions">
                  {canJoin ? (
                    <button 
                      className="join-call-btn"
                      onClick={() => handleJoinCall(appointment)}
                    >
                      � Join Consultation
                    </button>
                  ) : isPast ? (
                    <button className="call-ended-btn" disabled>
                      📞 Call Ended
                    </button>
                  ) : isUpcoming ? (
                    <button className="call-pending-btn" disabled>
                      ⏰ Call Not Yet Available
                    </button>
                  ) : (
                    <button className="call-pending-btn" disabled>
                      ⏰ Call Window Closed
                    </button>
                  )}
                </div>

                {/* TEMPORARY: Removed availability restriction for testing */}
                {false && isToday && !canJoin && !isPast && (
                  <div className="call-availability">
                    <small>
                      Telehealth consultation will be available 30 minutes before appointment time
                    </small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="video-call-info">
        <h3>📋 Telehealth Instructions</h3>
        <div className="instructions-grid">
          <div className="instruction-item">
            <span className="instruction-icon">🎥</span>
            <div>
              <strong>Camera & Microphone:</strong>
              <p>Make sure your camera and microphone are working before joining the call.</p>
            </div>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">🌐</span>
            <div>
              <strong>Internet Connection:</strong>
              <p>Ensure you have a stable internet connection for the best call quality.</p>
            </div>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">⏰</span>
            <div>
              <strong>Call Window:</strong>
              <p>Telehealth consultations are available 30 minutes before and after appointment time.</p>
            </div>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">🔧</span>
            <div>
              <strong>Controls:</strong>
              <p>Use the call controls to mute/unmute, turn camera on/off, or end the call.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;
