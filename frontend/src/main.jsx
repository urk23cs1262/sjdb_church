import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Prevent Google Translate DOM mutation crashes in React
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      return child;
    }
    try {
      return originalRemoveChild.apply(this, arguments);
    } catch (err) {
      return child;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    try {
      return originalInsertBefore.apply(this, arguments);
    } catch (err) {
      return newNode;
    }
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function (newChild, oldChild) {
    if (oldChild && oldChild.parentNode !== this) {
      return oldChild;
    }
    try {
      return originalReplaceChild.apply(this, arguments);
    } catch (err) {
      return oldChild;
    }
  };

  window.addEventListener('error', (event) => {
    if (
      event?.message?.includes('removeChild') ||
      event?.message?.includes('insertBefore') ||
      event?.message?.includes('Node cannot be found') ||
      event?.message?.includes('not a child of this node')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] min-h-screen w-full flex items-center justify-center bg-slate-50/90 backdrop-blur-sm p-4 text-center overflow-y-auto">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm sm:max-w-md space-y-4 my-auto mx-auto flex flex-col items-center justify-center text-center">
            <h2 className="text-xl font-bold text-church-royal-blue">Page View Restored</h2>
            <p className="text-xs text-gray-600 leading-relaxed">The translation view updated. Tap below to reload the page view cleanly.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="btn-gold px-6 py-3.5 text-xs sm:text-sm font-bold w-full rounded-xl shadow-gold justify-center"
            >
              Reload Page View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
