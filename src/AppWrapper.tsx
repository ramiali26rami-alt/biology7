/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Capacitor } from '@capacitor/core';

interface AppWrapperProps {
  children: React.ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const isNative = Capacitor.isNativePlatform();
  const isAdminPath = 
    window.location.pathname.startsWith('/admin') || 
    window.location.hash.startsWith('#/admin') ||
    window.location.search.includes('admin=true');
  const isLocalDev = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1';

  if (!isNative && !isAdminPath && !isLocalDev) {
    return (
      <div 
        className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none"
        dir="rtl"
      >
        <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/50 p-8 rounded-3xl shadow-2xl backdrop-blur-md space-y-6">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto border border-rose-500/20">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-10 h-10"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-black text-rose-450">عذراً، الوصول غير مصرح</h2>
            <p className="text-sm font-semibold text-slate-350 leading-relaxed">
              هذا التطبيق متاح فقط عبر النسخة الرسمية للهواتف الذكية. يرجى فتح التطبيق من خلال هاتفك المحمول لقراءة الدروس والمذاكرة.
            </p>
          </div>
          <div className="pt-2 text-xs font-bold text-slate-500">
            Biotech Biology &copy; 2026
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
