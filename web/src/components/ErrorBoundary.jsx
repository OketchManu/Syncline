// web/src/components/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You can also log to an error reporting service here
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Error UI
      return (
        <div style={{ 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #05080f 0%, #0a0f1e 100%)',
          color: '#f0f4ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: "'DM Sans', system-ui, sans-serif"
        }}>
          <div style={{ 
            maxWidth: '600px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '40px 30px',
            textAlign: 'center'
          }}>
            {/* Error Icon */}
            <div style={{ 
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={40} color="#ef4444" />
            </div>

            {/* Error Title */}
            <h1 style={{ 
              fontSize: '24px',
              fontWeight: '800',
              color: '#f0f4ff',
              margin: '0 0 12px',
              letterSpacing: '-0.02em'
            }}>
              Oops! Something went wrong
            </h1>

            {/* Error Description */}
            <p style={{ 
              fontSize: '14px',
              color: '#94a3b8',
              margin: '0 0 28px',
              lineHeight: '1.6'
            }}>
              We encountered an unexpected error. Don't worry, your data is safe. 
              Try refreshing the page or returning to the home page.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ 
                marginBottom: '28px',
                textAlign: 'left',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <summary style={{ 
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#ef4444',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>
                  Show Error Details
                </summary>
                <pre style={{ 
                  fontSize: '11px',
                  color: '#94a3b8',
                  overflow: 'auto',
                  margin: 0,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
                  transition: 'transform 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <RefreshCw size={16} />
                Refresh Page
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#f0f4ff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Home size={16} />
                Go Home
              </button>
            </div>

            {/* Help Text */}
            <p style={{ 
              fontSize: '12px',
              color: '#64748b',
              margin: '24px 0 0',
              lineHeight: '1.5'
            }}>
              If this problem persists, please contact support at{' '}
              <a 
                href="mailto:support@syncline.app"
                style={{ 
                  color: '#7c3aed',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                support@syncline.app
              </a>
            </p>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;