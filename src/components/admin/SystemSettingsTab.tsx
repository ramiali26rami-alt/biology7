import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Key, KeyRound, RefreshCw, Download, Save, Sparkles, Trash2, Info, Database
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

import { getAbsoluteUrl } from '../../utils/urlHelper';
import { Lesson } from '../../types';
import { getAdminAuthHeaders, supabase } from '../../utils/supabaseClient';

interface SystemSettingsTabProps {
  activeTab: 'keys' | 'helper';
  lang: 'ar' | 'en';
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  saveAllToServer: (lessonsToSave: Lesson[]) => Promise<void>;
}

interface ActivationKey {
  key: string;
  status: 'unused' | 'used';
  usedBy?: string;
  activatedAt?: string;
  deviceUuid?: string;
  distributor?: string;
  location?: string;
  created_at?: string;
}

export default function SystemSettingsTab({
  activeTab,
  lang,
  lessons,
  setLessons,
  saveAllToServer
}: SystemSettingsTabProps) {
  // ── Activation Keys Local States ──────────────────────────────────────────
  const [keysList, setKeysList] = useState<ActivationKey[]>([]);
  const [keysGenerateCount, setKeysGenerateCount] = useState<number>(10);
  const [distributor, setDistributor] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [keysLoading, setKeysLoading] = useState<boolean>(false);
  const [keysStatusMsg, setKeysStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Database Reset States and Handlers ─────────────────────────────────────
  const [dbResetLoading, setDbResetLoading] = useState(false);
  const [dbResetMsg, setDbResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleResetCurriculumToDefault = async () => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في إعادة ضبط المنهج بالكامل للملف الافتراضي؟ سيؤدي ذلك لحذف أي تعديلات أجريتها عبر لوحة التحكم.' : 'Are you sure you want to reset the curriculum to the default configuration? All modifications made from the admin dashboard will be deleted.')) {
      return;
    }
    setDbResetLoading(true);
    setDbResetMsg(null);
    try {
      // 1. Fetch default static curriculum configuration from browser path
      const defaultRes = await fetch('/lessons_config.json');
      if (!defaultRes.ok) {
        throw new Error('Failed to fetch default config file from static files');
      }
      const defaultData = await defaultRes.json();

      // 2. Post the default data directly to server save-config to overwrite the KV store
      const adminHeaders = await getAdminAuthHeaders();
      const saveRes = await fetch(getAbsoluteUrl('/api/save-config'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...adminHeaders
        },
        body: JSON.stringify(defaultData)
      });

      if (saveRes.ok) {
        // Clear local browser cache storage
        try {
          localStorage.removeItem('curriculum_data');
          sessionStorage.clear();
        } catch(e){}
        
        setDbResetMsg({
          type: 'success',
          text: lang === 'ar' ? 'تمت إعادة تعيين المنهج للملف الافتراضي بنجاح! سيتم إعادة تحميل الصفحة لتطبيق التغييرات.' : 'Curriculum reset successfully! Page will reload to apply changes.'
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error('Server save returned an error');
      }
    } catch (err: any) {
      console.error(err);
      setDbResetMsg({
        type: 'error',
        text: lang === 'ar' ? 'فشل في إعادة ضبط المنهج.' : 'Failed to reset curriculum.'
      });
    } finally {
      setDbResetLoading(false);
    }
  };


  // ── Coords Helper Local States ─────────────────────────────────────────────
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessons[0]?.id || '');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [editLabelAr, setEditLabelAr] = useState('');
  const [editDescAr, setEditDescAr] = useState('');
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [draggingArrowId, setDraggingArrowId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [detectedFolders, setDetectedFolders] = useState<{ path: string, name: string, files: string[] }[]>([]);

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);
  const activeDiagram = selectedLesson?.interactiveDiagrams?.find(d => d.imageFile === selectedImage);
  const imageUrl = selectedLesson && selectedImage ? getAssetUrl(selectedLesson, selectedImage) : '';

  // ── Fetch keys on mount/tab change ─────────────────────────────────────────
  const fetchKeys = async () => {
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const { data, error } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(data)) {
        const mappedKeys = data.map((row: any) => ({
          key: row.code,
          status: row.is_used ? 'used' : 'unused',
          usedBy: row.used_by_phone || '',
          activatedAt: row.used_at || '',
          deviceUuid: row.is_used ? 'bound' : '', // Sets lock indicator if code is used
          distributor: row.distributor || '',
          location: row.location || '',
          created_at: row.created_at || ''
        }));
        setKeysList(mappedKeys as any);
      }
    } catch (err: any) {
      console.error('Error fetching keys:', err);
      setKeysStatusMsg({
        type: 'error',
        text: err.message || (lang === 'ar' ? 'فشل في تحميل الأكواد.' : 'Failed to load keys.')
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    if (keysGenerateCount <= 0) return;
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const gen = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      const newKeys = [];
      for (let i = 0; i < keysGenerateCount; i++) {
        const code = `${gen(4)}-${gen(4)}-${gen(4)}`;
        newKeys.push({
          code,
          is_used: false,
          used_by_phone: null,
          used_at: null,
          distributor: distributor.trim() || null,
          location: location.trim() || null,
          created_at: new Date().toISOString()
        });
      }

      const { error } = await supabase
        .from('activation_codes')
        .insert(newKeys);

      if (error) throw error;

      setDistributor('');
      setLocation('');
      
      // Refresh list
      await fetchKeys();
      
      setKeysStatusMsg({
        type: 'success',
        text: lang === 'ar' ? `تم توليد ${keysGenerateCount} كود جديد بنجاح!` : `Successfully generated ${keysGenerateCount} new keys!`
      });
    } catch (err: any) {
      console.error('Error generating keys:', err);
      setKeysStatusMsg({
        type: 'error',
        text: err.message || (lang === 'ar' ? 'فشل في توليد الأكواد.' : 'Failed to generate keys.')
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleExportKeys = () => {
    if (keysList.length === 0) return;
    const txtContent = keysList.map(k => 
      `${k.key}\t[${k.status === 'unused' ? (lang === 'ar' ? 'غير مستخدم' : 'Unused') : (lang === 'ar' ? 'مستخدم' : 'Used')}]` +
      `\tالموزع: ${k.distributor || '-'}` +
      `\tالمنطقة: ${k.location || '-'}` +
      `\tتاريخ التوليد: ${k.created_at || '-'}` +
      `${k.usedBy ? `\tتاريخ التفعيل: ${k.activatedAt || '-'}\tبواسطة: ${k.usedBy}` : ''}`
    ).join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `biotech_activation_keys_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetDevice = async (key: string) => {
    const confirmMsg = lang === 'ar' 
      ? `هل أنت متأكد من رغبتك في إلغاء تفعيل هذا الكود (${key})؟ سيعود الكود غير مستخدم.`
      : `Are you sure you want to reset this key (${key})? The key will become unused again.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const codeIndex = keysList.findIndex(k => k.key === key);
      if (codeIndex === -1) return;
      const studentPhone = keysList[codeIndex].usedBy;

      const { error: codeError } = await supabase
        .from('activation_codes')
        .update({
          is_used: false,
          used_by_phone: null,
          used_at: null
        })
        .eq('code', key);

      if (codeError) throw codeError;

      if (studentPhone) {
        const { error: studentError } = await supabase
          .from('students')
          .update({ is_premium: false })
          .eq('phone', studentPhone);
        if (studentError) console.warn("Failed to reset student premium status:", studentError);
      }

      setKeysList(prev => prev.map(k => k.key === key ? { ...k, deviceUuid: undefined, status: 'unused', usedBy: '', activatedAt: '' } : k));
      setKeysStatusMsg({
        type: 'success',
        text: lang === 'ar' ? 'تم إلغاء التفعيل بنجاح!' : 'Successfully reset key status!'
      });
    } catch (err: any) {
      console.error('Error resetting key:', err);
      setKeysStatusMsg({
        type: 'error',
        text: err.message || (lang === 'ar' ? 'فشل في إلغاء التفعيل.' : 'Failed to reset key.')
      });
    }
  };

  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();
    }
  }, [activeTab]);

  // ── Coords Helper Logic ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(getAbsoluteUrl('/detected_assets.json'))
      .then(res => res.json())
      .then(data => {
        if (data && data.folders) {
          setDetectedFolders(data.folders);
        }
      })
      .catch(err => console.error("Error loading detected assets in helper:", err));
  }, []);

  useEffect(() => {
    setSelectedImage('');
    setClickedCoords(null);
    setCopied(false);
    setActiveHotspotId(null);
    setAiStatusMsg(null);
  }, [selectedLessonId]);

  useEffect(() => {
    setClickedCoords(null);
    setCopied(false);
    setActiveHotspotId(null);
    setAiStatusMsg(null);
  }, [selectedImage]);

  const handleSave = async () => {
    setSaveLoading(true);
    setLocalSaveStatus(null);
    try {
      await saveAllToServer(lessons);
      setLocalSaveStatus({
        type: 'success',
        text: lang === 'ar' ? 'تم حفظ تعديلات الرسم وقاعدة البيانات بنجاح! 💾 ✓' : 'Diagram edits & DB saved successfully! 💾 ✓'
      });
      setTimeout(() => setLocalSaveStatus(null), 4000);
    } catch (err) {
      setLocalSaveStatus({
        type: 'error',
        text: lang === 'ar' ? 'فشل حفظ التغييرات في قاعدة البيانات.' : 'Failed to save changes to DB.'
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDrag = (clientX: number, clientY: number, hotspotId: string, isDraggingArrow: boolean) => {
    if (!imageContainerRef.current || !selectedLesson || !selectedImage) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;

    const updatedDiagrams = (selectedLesson.interactiveDiagrams || []).map(diag => {
      if (diag.imageFile === selectedImage) {
        return {
          ...diag,
          hotspots: (diag.hotspots || []).map(h => {
            if (h.id === hotspotId) {
              if (isDraggingArrow) {
                return { ...h, arrowX: x, arrowY: y };
              } else {
                return { ...h, x, y };
              }
            }
            return h;
          })
        };
      }
      return diag;
    });

    setLessons(prev => prev.map(l => l.id === selectedLessonId ? { ...l, interactiveDiagrams: updatedDiagrams } : l));
  };

  useEffect(() => {
    const activeId = draggingHotspotId || draggingArrowId;
    if (!activeId) return;
    const isArrow = !!draggingArrowId;

    const onMouseMove = (e: MouseEvent) => {
      handleDrag(e.clientX, e.clientY, activeId, isArrow);
    };

    const onMouseUp = () => {
      setDraggingHotspotId(null);
      setDraggingArrowId(null);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault();
        handleDrag(e.touches[0].clientX, e.touches[0].clientY, activeId, isArrow);
      }
    };

    const onTouchEnd = () => {
      setDraggingHotspotId(null);
      setDraggingArrowId(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [draggingHotspotId, draggingArrowId, selectedLesson, selectedImage]);

  function getAssetUrl(lesson: Lesson, file: string) {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('//')) {
      return file;
    }
    const folderPath = lesson.folder;
    if (folderPath === '.' || folderPath === '/' || !folderPath) {
      return `/${file}`;
    }
    return `/${folderPath}/${file}`;
  }

  // Load available images for lesson
  const allImages: { value: string; label: string }[] = [];
  if (selectedLesson) {
    const folderPath = selectedLesson.folder.replace(/\\/g, '/');
    const folderAsset = detectedFolders.find(f => f.path.replace(/\\/g, '/').toLowerCase() === folderPath.toLowerCase());
    
    if (folderAsset && folderAsset.files) {
      const imgExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
      folderAsset.files.forEach(fileName => {
        const ext = '.' + fileName.split('.').pop()?.toLowerCase();
        if (imgExtensions.includes(ext)) {
          if (!allImages.some(img => img.value === fileName)) {
            allImages.push({ value: fileName, label: fileName });
          }
        }
      });
    }

    if (selectedLesson.diagramFile && !allImages.some(img => img.value === selectedLesson.diagramFile)) {
      allImages.push({ value: selectedLesson.diagramFile, label: `${selectedLesson.diagramFile} (الرسم الأساسي)` });
    }
    if (selectedLesson.interactiveDiagrams) {
      selectedLesson.interactiveDiagrams.forEach(diag => {
        if (diag.imageFile && !allImages.some(img => img.value === diag.imageFile)) {
          allImages.push({ value: diag.imageFile, label: `${diag.imageFile} (رسم تفاعلي)` });
        }
      });
    }
  }

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    if (activeHotspotId && activeDiagram) {
      const updatedHotspots = (activeDiagram.hotspots || []).map(h => 
        h.id === activeHotspotId ? { ...h, x, y } : h
      );
      const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
      updateLessonDiagram(updatedDiag);
      setAiStatusMsg({ type: 'success', text: lang === 'ar' ? 'تم نقل موضع النقطة بنجاح.' : 'Hotspot moved successfully.' });
    } else {
      setClickedCoords({ x, y });
      setCopied(false);
      setEditLabelAr('');
      setEditDescAr('');
    }
  };

  const handleCopy = () => {
    if (!clickedCoords) return;
    const textToCopy = `${clickedCoords.x.toFixed(1)}, ${clickedCoords.y.toFixed(1)}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateLessonDiagram = (updatedDiagram: any) => {
    const updatedLessons = lessons.map(l => {
      if (l.id === selectedLessonId) {
        const diags = l.interactiveDiagrams || [];
        const exists = diags.some(d => d.imageFile === selectedImage);
        const newDiags = exists
          ? diags.map(d => d.imageFile === selectedImage ? updatedDiagram : d)
          : [...diags, updatedDiagram];
        return { ...l, interactiveDiagrams: newDiags };
      }
      return l;
    });
    setLessons(updatedLessons);
  };

  const handleCreateDiagram = () => {
    if (!selectedLesson || !selectedImage) return;
    const newDiag = {
      imageFile: selectedImage,
      titleAr: selectedLesson.titleAr,
      hotspots: []
    };
    updateLessonDiagram(newDiag);
  };

  const handleAddHotspot = () => {
    if (!clickedCoords || !activeDiagram) return;
    const newId = `H${(activeDiagram.hotspots || []).length + 1}`;
    const newHotspot = {
      id: newId,
      x: clickedCoords.x,
      y: clickedCoords.y,
      arrowX: Math.round(Math.min(100, clickedCoords.x + 8) * 10) / 10,
      arrowY: Math.round(Math.min(100, clickedCoords.y + 8) * 10) / 10,
      labelAr: editLabelAr.trim() || `عنصر ${newId}`,
      descAr: editDescAr.trim() || 'لا يوجد شرح مضاف.'
    };
    const updatedDiag = {
      ...activeDiagram,
      hotspots: [...(activeDiagram.hotspots || []), newHotspot]
    };
    updateLessonDiagram(updatedDiag);
    setClickedCoords(null);
    setEditLabelAr('');
    setEditDescAr('');
  };

  const handleUpdateHotspot = () => {
    if (!activeHotspotId || !activeDiagram) return;
    const updatedHotspots = (activeDiagram.hotspots || []).map(h => 
      h.id === activeHotspotId 
        ? { ...h, labelAr: editLabelAr.trim(), descAr: editDescAr.trim() } 
        : h
    );
    const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
    updateLessonDiagram(updatedDiag);
    setActiveHotspotId(null);
    setEditLabelAr('');
    setEditDescAr('');
  };

  const handleDeleteHotspot = (id: string) => {
    if (!activeDiagram) return;
    const updatedHotspots = (activeDiagram.hotspots || []).filter(h => h.id !== id);
    const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
    updateLessonDiagram(updatedDiag);
    if (activeHotspotId === id) {
      setActiveHotspotId(null);
      setEditLabelAr('');
      setEditDescAr('');
    }
  };

  const handleAnalyzeDiagram = async () => {
    if (!selectedLesson || !selectedImage) return;
    const imageUrl = getAssetUrl(selectedLesson, selectedImage);
    if (!imageUrl) return;

    setAiLoading(true);
    setAiStatusMsg(null);

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to load image file from public assets.');
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const mimeType = blob.type || 'image/png';
          const adminHeaders = await getAdminAuthHeaders();

          const apiRes = await fetch(getAbsoluteUrl('/api/analyze-diagram'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-gemini-key': localApiKey,
              ...adminHeaders
            },
            body: JSON.stringify({ imageBase64: base64data, mimeType })
          });

          const data = await apiRes.json();
          if (!apiRes.ok || !data.success) {
            throw new Error(data.error || 'Gemini API failed to analyze the image.');
          }

          const generatedHotspots = data.hotspots.map((h: any) => ({
            id: h.partNumber || `H${Math.random().toString(36).substr(2, 4)}`,
            x: h.x,
            y: h.y,
            arrowX: Math.round(Math.min(100, h.x + 8) * 10) / 10,
            arrowY: Math.round(Math.min(100, h.y + 8) * 10) / 10,
            labelAr: h.partName,
            descAr: h.partDetails
          }));

          const updatedDiag = {
            imageFile: selectedImage,
            titleAr: activeDiagram?.titleAr || selectedLesson.titleAr,
            hotspots: generatedHotspots
          };

          updateLessonDiagram(updatedDiag);
          setAiStatusMsg({
            type: 'success',
            text: lang === 'ar' 
              ? `نجح التوليد! تم استكشاف ${generatedHotspots.length} نقاط تشريحية تفاعلية.`
              : `Success! Detected ${generatedHotspots.length} interactive anatomical hotspots.`
          });
        } catch (innerErr: any) {
          setAiStatusMsg({ type: 'error', text: innerErr.message });
        } finally {
          setAiLoading(false);
        }
      };

      reader.onerror = () => {
        throw new Error('Error reading image file conversion.');
      };
      
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setAiStatusMsg({ type: 'error', text: err.message });
      setAiLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (activeTab === 'keys') {
    return (
      <motion.div
        key="keys"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6 lg:col-span-3 text-right"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 dark:border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 justify-end">
              <span>{lang === 'ar' ? 'مولد وإدارة أكواد التفعيل' : 'Offline Keys & Activation Codes'}</span>
              <Key className="w-5 h-5 text-emerald-500" />
            </h2>
            <p className="text-xs text-slate-450 dark:text-slate-400 font-bold mt-1">
              {lang === 'ar' ? 'توليد أكواد التفعيل للطلاب وتتبع حالتها وإلغاء القفل المرتبط بالهاتف.' : 'Generate student activation codes and unlock device UUID bounds.'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportKeys}
              disabled={keysList.length === 0}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-900/60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير الأكواد (.txt)' : 'Export to Text'}</span>
            </button>
            <button
              onClick={fetchKeys}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-200 font-black text-xs px-3.5 py-2.5 rounded-app-btn active:scale-95 transition-all border border-slate-200 dark:border-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Generate Card */}
        <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-app-card border border-slate-150 dark:border-slate-800/80 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[10px] font-black text-slate-400 block">
                {lang === 'ar' ? 'عدد الأكواد المطلوبة:' : 'Number of Keys:'}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={keysGenerateCount}
                onChange={(e) => setKeysGenerateCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-center text-xs font-black focus:outline-none"
              />
            </div>
            
            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[10px] font-black text-slate-400 block">
                {lang === 'ar' ? 'اسم الموزع (اختياري):' : 'Distributor Name (Optional):'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'مثل: مكتبة خالد' : 'e.g. Khalid Bookshop'}
                value={distributor}
                onChange={(e) => setDistributor(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-right text-xs font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[10px] font-black text-slate-400 block">
                {lang === 'ar' ? 'المنطقة / المحافظة (اختياري):' : 'Location (Optional):'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'مثل: صنعاء' : 'e.g. Sanaa'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-right text-xs font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerateKeys}
              disabled={keysLoading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs px-6 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer border-0"
            >
              <KeyRound className="w-4 h-4" />
              <span>{lang === 'ar' ? 'توليد الأكواد الجديدة' : 'Generate Keys'}</span>
            </button>
          </div>
        </div>

        {keysStatusMsg && (
          <div className={`p-3 rounded-app-btn text-xs font-bold text-center border ${
            keysStatusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-155 dark:border-emerald-900'
              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-155 dark:border-rose-900'
          }`}>
            {keysStatusMsg.text}
          </div>
        )}

        {/* Database Management & Reset Card */}
        <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-app-card border border-slate-150 dark:border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>{lang === 'ar' ? 'إدارة قاعدة البيانات والمزامنة' : 'Database Management & Sync'}</span>
            </h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleResetCurriculumToDefault}
              disabled={dbResetLoading}
              className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900/60 font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إعادة ضبط المنهج للملف الافتراضي (حذف الكاش)' : 'Reset Curriculum to Default File'}</span>
            </button>
            
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('curriculum_data');
                  sessionStorage.clear();
                } catch(e){}
                alert(lang === 'ar' ? 'تم تفريغ الكاش المحلي للمتصفح بنجاح.' : 'Local browser cache cleared.');
                window.location.reload();
              }}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-250 dark:border-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تفريغ كاش المتصفح وإعادة التشغيل' : 'Clear Browser Cache & Reload'}</span>
            </button>
          </div>

          {dbResetMsg && (
            <div className={`p-3 rounded-app-btn text-xs font-bold text-center border ${
              dbResetMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-155 dark:border-emerald-900'
                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-155 dark:border-rose-900'
            }`}>
              {dbResetMsg.text}
            </div>
          )}
        </div>

        {/* Keys List Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-app-card overflow-hidden shadow-sm">
          {keysLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 font-bold text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span>{lang === 'ar' ? 'جاري تحديث الأكواد...' : 'Loading Keys...'}</span>
            </div>
          ) : keysList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold text-xs">
              {lang === 'ar' ? 'لا توجد أكواد تفعيل حالياً. ابدأ بتوليد بعضها أعلاه.' : 'No keys generated yet. Use generator box above.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-black">
                    <th className="py-3 px-4">{lang === 'ar' ? 'الكود' : 'Key'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'تاريخ التوليد' : 'Created At'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'الموزع' : 'Distributor'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'المنطقة' : 'Location'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'المستخدم' : 'Used By'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'تاريخ التفعيل' : 'Activated At'}</th>
                    <th className="py-3 px-4 text-center">{lang === 'ar' ? 'التحكم' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 font-bold text-slate-700 dark:text-slate-350">
                  {keysList.map((k) => (
                    <tr key={k.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-900 dark:text-white select-all">{k.key}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                        {k.created_at ? new Date(k.created_at).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{k.distributor || '-'}</td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{k.location || '-'}</td>
                      <td className="py-3 px-4">
                        {k.status === 'used' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                            {lang === 'ar' ? 'مستخدم' : 'Used'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                            {lang === 'ar' ? 'غير مستخدم' : 'Unused'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 truncate max-w-[120px]" title={k.usedBy}>{k.usedBy || '-'}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                        {k.activatedAt ? new Date(k.activatedAt).toLocaleString(lang === 'ar' ? 'ar-YE' : 'en-US') : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {k.status === 'used' ? (
                          <button
                            onClick={() => handleResetDevice(k.key)}
                            className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-app-btn text-[10px] font-black border border-amber-200 dark:border-amber-900/40 transition-colors active:scale-95"
                          >
                            {lang === 'ar' ? 'إلغاء تفعيل الكود 🔓' : 'Reset Lock 🔓'}
                          </button>
                        ) : (
                          <span className="text-slate-350 dark:text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Render Coords Helper Tab ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header configurations */}
      <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {lang === 'ar' ? 'محرر ومساعد الرسوم التفاعلية' : 'Interactive Diagrams Visual Editor'}
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            {lang === 'ar'
              ? 'اختر الدرس والصورة لإنشاء المخططات والتحكم بالنقاط البارزة يدوياً أو توليدها تلقائياً بالذكاء الاصطناعي.'
              : 'Choose lesson and image to manage hotspots manually or generate them using Gemini Vision.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'اختر الدرس:' : 'Select Lesson:'}
            </label>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
            >
              {lessons.map(l => (
                <option key={l.id} value={l.id}>
                  {l.id} - {lang === 'ar' ? l.titleAr : l.titleEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'اختر صورة من المجلد:' : 'Select Image from Folder:'}
            </label>
            <select
              value={selectedImage}
              onChange={(e) => setSelectedImage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
            >
              <option value="">{lang === 'ar' ? '-- اختر صورة للرسومات --' : '-- Select drawing image --'}</option>
              {allImages.map(img => (
                <option key={img.value} value={img.value}>
                  {img.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {imageUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Visual Canvas Card */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center gap-6 animate-fadeIn relative">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-app-card border border-slate-150 dark:border-slate-800/60 w-full">
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {lang === 'ar' ? 'إحداثيات النقطة النشطة:' : 'Selected Coordinates:'}
                </span>
                <span className="text-xs font-mono font-black text-slate-800 dark:text-white mt-1 block">
                  {clickedCoords 
                    ? `x: ${clickedCoords.x}% , y: ${clickedCoords.y}%` 
                    : activeHotspotId 
                      ? `${lang === 'ar' ? 'نقل النقطة النشطة' : 'Moving active hotspot'}: ${activeHotspotId} (${lang === 'ar' ? 'انقر على مكان جديد للنقل' : 'Click on new position to move'})`
                      : (lang === 'ar' ? 'انقر فوق أي مكان بالصورة لتحديد موضع جديد' : 'Click anywhere on image to pick a point')}
                </span>
              </div>
              
              {clickedCoords && (
                <div className="flex gap-2">
                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-350 flex items-center justify-center">
                    {clickedCoords.x}, {clickedCoords.y}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 font-black text-xs px-4 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {copied ? (lang === 'ar' ? 'تم النسخ! ✓' : 'Copied! ✓') : (lang === 'ar' ? 'نسخ الإحداثيات' : 'Copy Coords')}
                  </button>
                </div>
              )}
            </div>

            {/* Visual Canvas Element */}
            <div
              className={`relative border border-slate-200 dark:border-slate-800 rounded-app-card overflow-hidden max-w-full bg-slate-950/5 select-none flex items-center justify-center ${
                draggingHotspotId ? 'cursor-grabbing' : 'cursor-crosshair'
              }`}
              style={{ maxHeight: '70vh', minHeight: '300px' }}
            >
              <div
                ref={imageContainerRef}
                onClick={handleImageClick}
                className="relative inline-block max-w-full max-h-full cursor-crosshair"
              >
                <img
                  src={imageUrl}
                  alt="Interactive Diagram Preview"
                  className="max-h-[70vh] w-auto object-contain block"
                  draggable={false}
                  onError={() => alert(lang === 'ar' ? 'خطأ في تحميل ملف الصورة، تأكد من مطابقة الاسم والمسار في مجلد المنهج.' : 'Failed to load image. Verify filename and path in the curriculum directory.')}
                />
                
                {/* SVG overlay for arrow lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
                  <defs>
                    <marker
                      id="admin-arrow-head-default"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
                    </marker>
                    <marker
                      id="admin-arrow-head-active"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
                    </marker>
                  </defs>

                  {(activeDiagram?.hotspots || []).map((hotspot) => {
                    const hasArrow = hotspot.arrowX !== undefined && hotspot.arrowY !== undefined && hotspot.arrowX !== null && hotspot.arrowY !== null;
                    const isActive = activeHotspotId === hotspot.id;
                    const startX = hotspot.x;
                    const startY = hotspot.y;
                    const endX = hasArrow ? hotspot.arrowX! : startX + 10;
                    const endY = hasArrow ? hotspot.arrowY! : startY + 10;

                    if (!hasArrow && !isActive) return null;

                    return (
                      <line
                        key={`admin-arrow-${hotspot.id}`}
                        x1={`${startX}%`}
                        y1={`${startY}%`}
                        x2={`${endX}%`}
                        y2={`${endY}%`}
                        stroke={isActive ? '#f59e0b' : '#3b82f6'}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        strokeDasharray={isActive ? 'none' : '3 3'}
                        markerEnd={`url(#admin-arrow-head-${isActive ? 'active' : 'default'})`}
                        className="transition-all duration-150"
                        style={{
                          opacity: activeHotspotId ? (isActive ? 1 : 0.4) : 0.8
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Hotspots Marker components */}
                {(activeDiagram?.hotspots || []).map((hotspot) => {
                  const isActive = activeHotspotId === hotspot.id;
                  const isDragging = draggingHotspotId === hotspot.id;
                  return (
                    <button
                      key={hotspot.id}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveHotspotId(hotspot.id);
                        setClickedCoords(null);
                        setEditLabelAr(hotspot.labelAr);
                        setEditDescAr(hotspot.descAr);
                        setDraggingHotspotId(hotspot.id);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setActiveHotspotId(hotspot.id);
                        setClickedCoords(null);
                        setEditLabelAr(hotspot.labelAr);
                        setEditDescAr(hotspot.descAr);
                        setDraggingHotspotId(hotspot.id);
                      }}
                      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                      className={`absolute w-6 h-6 -mt-3 -ms-3 flex items-center justify-center z-20 group focus:outline-none ${
                        isDragging ? 'cursor-grabbing' : 'cursor-grab'
                      }`}
                      title={hotspot.labelAr}
                    >
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isActive ? 'bg-amber-400' : 'bg-emerald-400'
                      } ${isDragging ? '' : 'animate-ping'}`}></span>
                      <span className={`relative inline-flex rounded-full h-3.5 w-3.5 shadow-md border border-white text-[8px] font-black text-white items-center justify-center transition-transform ${
                        isActive ? 'bg-amber-500 scale-110' : 'bg-emerald-500'
                      } ${isDragging ? 'scale-125 ring-2 ring-white/50 bg-amber-500' : 'group-hover:scale-110'}`}>
                        {hotspot.id.replace('H', '')}
                      </span>
                    </button>
                  );
                })}

                {/* Arrow Head drag handle */}
                {(activeDiagram?.hotspots || []).map((hotspot) => {
                  const isActive = activeHotspotId === hotspot.id;
                  if (!isActive) return null;

                  const hasArrow = hotspot.arrowX !== undefined && hotspot.arrowY !== undefined && hotspot.arrowX !== null && hotspot.arrowY !== null;
                  const arrowX = hasArrow ? hotspot.arrowX! : hotspot.x + 10;
                  const arrowY = hasArrow ? hotspot.arrowY! : hotspot.y + 10;
                  const isDraggingArrow = draggingArrowId === hotspot.id;

                  return (
                    <button
                      key={`arrow-handle-${hotspot.id}`}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDraggingArrowId(hotspot.id);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setDraggingArrowId(hotspot.id);
                      }}
                      style={{ left: `${arrowX}%`, top: `${arrowY}%` }}
                      className={`absolute w-5 h-5 -mt-2.5 -ms-2.5 flex items-center justify-center z-30 focus:outline-none border border-amber-400 bg-amber-500 rounded-full shadow-lg cursor-pointer ${
                        isDraggingArrow ? 'bg-amber-600 scale-125 cursor-grabbing' : 'hover:scale-110 cursor-grab'
                      }`}
                      title={lang === 'ar' ? 'سهم التوجيه (اسحب للإشارة للعضو)' : 'Arrow tip (Drag to point to structure)'}
                    >
                      <span className="text-[8.5px] font-black text-white select-none">🡥</span>
                    </button>
                  );
                })}

                {/* Temporary click coord */}
                {clickedCoords && (
                  <div
                    className="absolute w-5 h-5 -mt-2.5 -ms-2.5 bg-red-500 border-2 border-white rounded-full shadow-lg shadow-red-500/50 animate-pulse pointer-events-none z-30"
                    style={{ left: `${clickedCoords.x}%`, top: `${clickedCoords.y}%` }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* AI analyzer & text hotspot editors */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-500" />
                {lang === 'ar' ? 'حفظ تعديلات الرسوم التفاعلية' : 'Save Interactive Diagram Edits'}
              </h3>
              
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {lang === 'ar'
                  ? 'عندما تنتهي من سحب وتعديل النقاط، اضغط هنا لحفظ كافة الإحداثيات والبيانات مباشرة لقاعدة بيانات الخادم.'
                  : 'After dragging and modifying hotspots, click below to save coordinates and data to the server DB.'}
              </p>

              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10"
              >
                {saveLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{lang === 'ar' ? 'حفظ التعديلات بصورة نهائية 💾' : 'Save Edits Permanently 💾'}</span>
              </button>

              {localSaveStatus && (
                <div className={`p-3 rounded-app-btn text-xs font-bold text-center border leading-relaxed ${
                  localSaveStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-500 border-emerald-150 dark:border-emerald-900'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 border-rose-155 dark:border-rose-900'
                }`}>
                  {localSaveStatus.text}
                </div>
              )}
            </div>

            {/* AI analysis Vision Box */}
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                {lang === 'ar' ? 'التحليل التلقائي بالذكاء البصري' : 'AI Multimodal Vision'}
              </h3>
              
              {!activeDiagram ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {lang === 'ar'
                      ? 'هذه الصورة غير مجهزة بعد كمخطط تفاعلي في قاعدة البيانات. اضغط أدناه لتهيئتها.'
                      : 'This image is not registered as an interactive diagram. Initialize it below.'}
                  </p>
                  <button
                    onClick={handleCreateDiagram}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2.5 rounded-app-btn shadow-md transition-all active:scale-95"
                  >
                    {lang === 'ar' ? 'إنشاء مخطط تفاعلي جديد' : 'Initialize Interactive Diagram'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {lang === 'ar'
                      ? 'سيقوم نموذج Gemini Vision بفحص صورة درس الأحياء، واستخراج النصوص التشريحية وإحداثياتها الدقيقة فوراً.'
                      : 'Gemini Vision will scan the diagram image, extracting labels and coordinate values.'}
                  </p>

                  <button
                    onClick={handleAnalyzeDiagram}
                    disabled={aiLoading || !localApiKey}
                    className={`w-full font-black text-xs py-2.5 rounded-app-btn transition-all flex items-center justify-center gap-2 ${
                      aiLoading 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-650 hover:bg-violet-755 text-white shadow-md shadow-violet-500/10'
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {lang === 'ar' ? 'جاري تحليل الصورة التشريحية...' : 'Analyzing diagram...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'تحليل الرسم بالذكاء الاصطناعي 🤖' : 'Analyze Diagram with AI 🤖'}
                      </>
                    )}
                  </button>
                  
                  {!localApiKey && (
                    <p className="text-[10px] text-red-500 font-bold">
                      {lang === 'ar' 
                        ? '⚠️ يرجى إدخال مفتاح Gemini API في شاشة الإعدادات لتفعيل هذه الميزة.' 
                        : '⚠️ Please provide a Gemini API key in settings to enable this feature.'}
                    </p>
                  )}

                  {aiStatusMsg && (
                    <div className={`p-3 rounded-app-btn text-xs font-bold leading-relaxed ${
                      aiStatusMsg.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-800' 
                        : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-150 dark:border-red-800'
                    }`}>
                      {aiStatusMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hotspots Edit Box */}
            {activeDiagram && (
              <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  {lang === 'ar' ? 'محرر النقاط التفاعلية' : 'Hotspots Editor'}
                </h3>

                {activeHotspotId ? (
                  <div className="space-y-3 bg-amber-500/5 p-4 rounded-app-card border border-amber-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">
                        {lang === 'ar' ? `تعديل النقطة النشطة: ${activeHotspotId}` : `Editing Hotspot: ${activeHotspotId}`}
                      </span>
                      <button 
                        onClick={() => {
                          setActiveHotspotId(null);
                          setEditLabelAr('');
                          setEditDescAr('');
                        }}
                        className="text-slate-400 hover:text-slate-650 text-xs font-bold"
                      >
                        {lang === 'ar' ? 'إلغاء التحديد' : 'Cancel'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'اسم العضو/التركيب:' : 'Structure Name (Ar):'}</label>
                      <input 
                        type="text"
                        value={editLabelAr}
                        onChange={(e) => setEditLabelAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'الوظيفة أو الشرح التفصيلي:' : 'Details / Function (Ar):'}</label>
                      <textarea 
                        rows={3}
                        value={editDescAr}
                        onChange={(e) => setEditDescAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateHotspot}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-2 rounded-app-btn transition-all"
                      >
                        {lang === 'ar' ? 'تحديث النقطة' : 'Update Hotspot'}
                      </button>
                      <button
                        onClick={() => handleDeleteHotspot(activeHotspotId)}
                        className="bg-red-500 hover:bg-red-600 text-white font-black text-xs px-3 py-2 rounded-app-btn transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : clickedCoords ? (
                  <div className="space-y-3 bg-emerald-500/5 p-4 rounded-app-card border border-emerald-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                        {lang === 'ar' ? 'إضافة نقطة جديدة' : 'Add New Hotspot'}
                      </span>
                      <button 
                        onClick={() => setClickedCoords(null)}
                        className="text-slate-400 hover:text-slate-655 text-xs font-bold"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>

                    <div className="text-[10px] font-mono font-bold text-slate-500">
                      Coordinates: x: {clickedCoords.x}%, y: {clickedCoords.y}%
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'اسم العضو/التركيب:' : 'Structure Name (Ar):'}</label>
                      <input 
                        type="text"
                        placeholder="مثال: القشرة المخية"
                        value={editLabelAr}
                        onChange={(e) => setEditLabelAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'الوظيفة أو الشرح التفصيلي:' : 'Details / Function (Ar):'}</label>
                      <textarea 
                        rows={3}
                        placeholder="اكتب وظيفته أو شرح مبسط عنه هنا..."
                        value={editDescAr}
                        onChange={(e) => setEditDescAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none leading-relaxed"
                      />
                    </div>

                    <button
                      onClick={handleAddHotspot}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2 rounded-app-btn transition-all"
                    >
                      {lang === 'ar' ? 'إدراج النقطة التفاعلية' : 'Insert Hotspot'}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-155 dark:border-slate-800 rounded-app-card text-center text-xs text-slate-400 font-bold leading-relaxed">
                    {lang === 'ar'
                      ? 'حدد نقطة بالنقر على الرسم لإضافتها، أو اضغط على أي علامة تفاعلية لتعديلها أو نقلها.'
                      : 'Click the image to insert a new hotspot, or select a marker to edit details or reposition.'}
                  </div>
                )}

                {/* Hotspots summary list */}
                {activeDiagram.hotspots && activeDiagram.hotspots.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      {lang === 'ar' ? `النقاط التفاعلية الحالية (${activeDiagram.hotspots.length}):` : `Anatomy Hotspots (${activeDiagram.hotspots.length}):`}
                    </span>
                    <div className="max-h-[30vh] overflow-y-auto space-y-1.5 scrollbar-none pe-1">
                      {activeDiagram.hotspots.map((h) => {
                        const isSelected = activeHotspotId === h.id;
                        return (
                          <div 
                            key={h.id}
                            onClick={() => {
                              setActiveHotspotId(h.id);
                              setClickedCoords(null);
                              setEditLabelAr(h.labelAr);
                              setEditDescAr(h.descAr);
                            }}
                            className={`p-2.5 rounded-app-btn border transition-all cursor-pointer text-xs font-bold flex justify-between items-center ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-150 dark:border-slate-800/80 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 text-white ${
                                isSelected ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}>
                                {h.id.replace('H', '')}
                              </span>
                              <span className="truncate">{h.labelAr}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium ms-2">
                              x: {h.x}%, y: {h.y}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : selectedLesson ? (
        <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-12 shadow-sm text-center text-slate-400 font-bold">
          {lang === 'ar' 
            ? 'الرجاء اختيار صورة من القائمة المنسدلة أعلاه لبدء التعديل البصري.' 
            : 'Please select an image from the dropdown above to start visual editing.'}
        </div>
      ) : null}
    </div>
  );
}
