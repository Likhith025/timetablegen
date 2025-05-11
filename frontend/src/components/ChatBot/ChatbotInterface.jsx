import React, { useState, useRef, useEffect } from 'react';
import './ChatbotInterface.css';
import { useParams, useLocation } from 'react-router-dom';
import API_BASE_URL from '../../src';

const ChatbotInterface = ({ projectId: propProjectId }) => {
  const { id } = useParams();
  const location = useLocation();

  const getProjectIdFromUrl = () => {
    const pathParts = location.pathname.split('/');
    const lastSegment = pathParts[pathParts.length - 1];
    if (lastSegment && /^[0-9a-fA-F]{24}$/.test(lastSegment)) {
      return lastSegment;
    }
    return null;
  };

  const projectId = propProjectId || id || getProjectIdFromUrl();

  useEffect(() => {
    console.log('Current projectId:', projectId);
  }, [projectId]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm Chintu a timetable assistant. How can I help you today?", sender: "bot" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, sender: "user" }]);
    setInputValue('');
    setLoading(true);

    try {
      if (!projectId) {
        setMessages(prev => [...prev, {
          text: "Error: Could not determine timetable ID. Please make sure you're viewing a specific timetable.",
          sender: "bot"
        }]);
        setLoading(false);
        return;
      }

      if (pendingChanges &&
        (userMessage.toLowerCase().includes('yes') ||
          userMessage.toLowerCase().includes('confirm') ||
          userMessage.toLowerCase().includes('approve'))) {

        const response = await fetch(`${API_BASE_URL}/all/applyChanges`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            projectId,
            changeId: pendingChanges.changeId,
            approvedChanges: pendingChanges.proposedChanges
          })
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setMessages(prev => [...prev, {
            text: 'Changes have been applied successfully!',
            sender: "bot"
          }]);
          setPendingChanges(null);
        } else {
          setMessages(prev => [...prev, {
            text: `Failed to apply changes: ${data.message}`,
            sender: "bot"
          }]);
        }
      }
      else if (pendingChanges &&
        (userMessage.toLowerCase().includes('no') ||
          userMessage.toLowerCase().includes('cancel') ||
          userMessage.toLowerCase().includes('reject'))) {

        setMessages(prev => [...prev, {
          text: 'Changes have been cancelled. No modifications were made to the timetable.',
          sender: "bot"
        }]);
        setPendingChanges(null);
      }
      else {
        const response = await fetch(`${API_BASE_URL}/all/timetable/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            projectId,
            message: userMessage
          })
        });

        if (!response.ok) {
          let errorText = '';
          try {
            const errorData = await response.json();
            errorText = errorData.message || '';
          } catch (e) { }
          throw new Error(`Server error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (data.response) {
          setMessages(prev => [...prev, {
            text: data.response,
            sender: "bot"
          }]);
        } else if (data.success) {
          setMessages(prev => [...prev, {
            text: data.message,
            sender: "bot"
          }]);

          if (data.proposedChanges) {
            setPendingChanges({
              changeId: data.changeId,
              proposedChanges: data.proposedChanges
            });
            displayProposedChanges(data.proposedChanges);
          }
        } else {
          setMessages(prev => [...prev, {
            text: `I couldn't process that request: ${data.message || 'Unknown error'}`,
            sender: "bot"
          }]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        sender: "bot"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const displayProposedChanges = (changes) => {
    const { changeType, entityType, currentState, newState, potentialConflicts } = changes;
    let summaryText = "Here's what will change:\n\n";

    if (changeType === 'add') {
      summaryText += `Adding new ${entityType}:\n`;
      Object.entries(newState).forEach(([key, value]) => {
        if (key !== '_id' && value !== null && value !== undefined) {
          summaryText += `- ${key}: ${value}\n`;
        }
      });
    } else if (changeType === 'modify') {
      summaryText += `Modifying ${entityType}:\n`;
      Object.entries(newState).forEach(([key, value]) => {
        if (key !== '_id' && currentState && currentState[key] !== value &&
          value !== null && value !== undefined) {
          summaryText += `- ${key}: ${currentState[key]} → ${value}\n`;
        }
      });
    } else if (changeType === 'delete') {
      summaryText += `Deleting ${entityType}:\n`;
      if (currentState) {
        Object.entries(currentState).forEach(([key, value]) => {
          if (key !== '_id' && value !== null && value !== undefined) {
            summaryText += `- ${key}: ${value}\n`;
          }
        });
      }
    }

    if (potentialConflicts && potentialConflicts.length > 0) {
      summaryText += "\nPotential conflicts:\n";
      potentialConflicts.forEach(conflict => {
        summaryText += `- ${conflict}\n`;
      });
    }

    summaryText += "\nWould you like to apply these changes? (Yes/No)";

    setMessages(prev => [...prev, {
      text: summaryText,
      sender: "bot"
    }]);
  };

  const handleExportChat = () => {
    const chatData = {
      projectId,
      timestamp: new Date().toISOString(),
      messages
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${projectId || 'timetable'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chatbot-container">
      <button
        className={`chat-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={toggleChat}
      >
        <div className="toggle-icon">
          {isOpen ? '✕' : '💬'}
        </div>
        {!isOpen && <span className="toggle-label">Chintu</span>}
      </button>

      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3>Timetable Assistant</h3>
          {projectId && (
            <div className="timetable-info">Timetable ID: {projectId}</div>
          )}
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-bubble">
                {typeof msg.text === 'string' ? (
                  msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))
                ) : (
                  <pre>{JSON.stringify(msg.text, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-footer">
          <button className="export-btn" onClick={handleExportChat}>Export Chat</button>

          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={!projectId ? "No timetable selected" : "Type a message..."}
              disabled={loading || !projectId}
            />
            <button type="submit" disabled={loading || !inputValue.trim() || !projectId}>
              {loading ? (
                <span className="loading-icon">↻</span>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatbotInterface;
