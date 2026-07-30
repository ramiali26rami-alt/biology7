import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React render:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mx-auto animate-pulse text-2xl">
              ⚠️
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">حدث خطأ غير متوقع</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
              نأسف لذلك، حصل تعطل مؤقت أثناء عرض الصفحة. اضغط على الزر أدناه للعودة للرئيسية وإعادة المحاولة.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3 rounded-app-btn shadow-md active:scale-95 transition-all cursor-pointer"
            >
              العودة للرئيسية وتحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
