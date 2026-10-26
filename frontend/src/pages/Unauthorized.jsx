import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Unauthorized.css';

const Unauthorized = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="unauthorized-container">
            <div className="unauthorized-content">
                <div className="unauthorized-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </div>

                <h1>Access Denied</h1>
                <p className="unauthorized-message">
                    You don't have permission to access this page.
                </p>

                {user && (
                    <div className="user-info">
                        <p><strong>Current Role:</strong> {user.role?.roleName || 'Unknown'}</p>
                        <p className="help-text">
                            If you believe this is an error, please contact your administrator.
                        </p>
                    </div>
                )}

                <div className="unauthorized-actions">
                    <button onClick={() => navigate(-1)} className="btn-secondary">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Go Back
                    </button>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Go to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
