import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
                            <p className="text-xs text-slate-500 mt-1">
                                We ran into an unexpected problem while rendering this page.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="p-3 bg-slate-50 rounded-xl text-left border border-slate-200 text-[11px] font-mono text-slate-700 max-h-32 overflow-y-auto">
                                {this.state.error.message || String(this.state.error)}
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                                <RefreshCw size={14} /> Reload Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                                <Home size={14} /> Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

