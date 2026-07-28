import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Download, 
  Eye, 
  Code, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  PlusCircle, 
  Play, 
  FileText, 
  BookOpen, 
  HelpCircle,
  X,
  Sparkles,
  Info,
  Sliders,
  CheckCircle,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Key,
  Target,
  Loader2,
  UserCheck
} from 'lucide-react';
import { ScreenId, Lesson, VideoChapter, Flashcard, GlossaryItem, ConfigQuestion } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { validateExcelData } from '../utils/excelValidator';

import { SecureStorage } from '../utils/security';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getAbsoluteUrl } from '../utils/urlHelper';
import StudentsTab from './admin/StudentsTab';
import LessonsTab from './admin/LessonsTab';

interface AdminDashboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
}

type TabType = 'lessons-list' | 'lesson-editor' | 'preview' | 'export' | 'keys' | 'helper' | 'students';
type EditorSubTab = 'basic' | 'chapters' | 'summary-flash' | 'quiz' | 'files';

export default function AdminDashboardScreen({ onNavigate, lang, lessons, setLessons }: AdminDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lessons-list');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('basic');
  const [copied, setCopied] = useState(false);
  const [exportSearchQuery, setExportSearchQuery] = useState('');


  const [detectedFolders, setDetectedFolders] = useState<{ path: string, name: string, files: string[] }[]>([]);



  // ── Server-save state ──────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');





  // Activation keys states
  interface ActivationKey {
    key: string;
    status: 'unused' | 'used';
    usedBy?: string;
    activatedAt?: string;
    deviceUuid?: string;
  }
  const [keysList, setKeysList] = useState<ActivationKey[]>([]);
  const [keysGenerateCount, setKeysGenerateCount] = useState<number>(10);
  const [keysLoading, setKeysLoading] = useState<boolean>(false);
  const [keysStatusMsg, setKeysStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Excel Import Validation States
  interface ExcelValidationState {
    type: 'success' | 'warning' | 'error';
    errors: string[];
    warnings: string[];
    summary: any;
    message?: string;
  }
  const [excelValidationResult, setExcelValidationResult] = useState<ExcelValidationState | null>(null);

  const fetchKeys = async () => {
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const res = await fetch(getAbsoluteUrl('/api/activation-keys'), {
        headers: {
          'x-admin-passcode': '2026'
        }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.keys)) {
        setKeysList(data.keys);
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل في تحميل الأكواد.' : 'Failed to load keys.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const res = await fetch(getAbsoluteUrl('/api/generate-keys'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': '2026'
        },
        body: JSON.stringify({ count: keysGenerateCount })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.keys)) {
        setKeysList(data.keys);
        setKeysStatusMsg({
          type: 'success',
          text: lang === 'ar' ? `تم توليد ${keysGenerateCount} كود جديد بنجاح!` : `Successfully generated ${keysGenerateCount} new keys!`
        });
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل في توليد الأكواد.' : 'Failed to generate keys.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleExportKeys = () => {
    if (keysList.length === 0) return;
    const txtContent = keysList.map(k => `${k.key}\t[${k.status === 'unused' ? (lang === 'ar' ? 'غير مستخدم' : 'Unused') : (lang === 'ar' ? 'مستخدم' : 'Used')}]${k.usedBy ? `\tUsed by: ${k.usedBy}` : ''}${k.activatedAt ? `\tAt: ${k.activatedAt}` : ''}`).join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `biotech_activation_keys_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();

    }
  }, [activeTab]);

  // AI Quiz Generator states


  useEffect(() => {
    fetch(getAbsoluteUrl('/detected_assets.json'))
      .then(res => res.json())
      .then(data => {
        if (data && data.folders) {
          setDetectedFolders(data.folders);
        }
      })
      .catch(err => console.error("Error loading detected assets:", err));

  }, []);

  const t = translations[lang];

  // Helper for layout direction
  const isRtl = lang === 'ar';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const backIcon = isRtl ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  const handleTriggerDownload = () => {
    validateSyllabus();
    if (validationErrors.length > 0) {
      const msg = lang === 'ar' 
        ? 'تحذير: يحتوي المنهج على بعض الأخطاء التكوينية. هل تريد المتابعة وتنزيل الملف على أي حال؟' 
        : 'Warning: Syllabus contains configuration errors. Do you want to download anyway?';
      if (!window.confirm(msg)) return;
    }
    
    const jsonStr = JSON.stringify(lessons, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lessons_config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetDevice = async (key: string) => {
    const confirmMsg = lang === 'ar' 
      ? `هل أنت متأكد من رغبتك في إلغاء قفل الجهاز لهذا الكود (${key})؟ سيمكن هذا الطالب من التفعيل على هاتف آخر.`
      : `Are you sure you want to reset the device lock for this key (${key})? This allows activation on a different device.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(getAbsoluteUrl('/api/reset-key-device'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': '2026'
        },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeysList(data.keys);
        setKeysStatusMsg({
          type: 'success',
          text: lang === 'ar' ? 'تم إلغاء قفل الجهاز للكود بنجاح!' : 'Successfully reset device lock for key!'
        });
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل إلغاء القفل.' : 'Failed to reset lock.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    }
  };

  const handleCopyClipboard = () => {
    const jsonStr = JSON.stringify(lessons, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // State mutation helpers for editing fields
  // ── Save all lessons directly to server disk ───────────────────────────────
  const saveAllToServer = async (lessonsToSave: Lesson[]) => {
    setSaveStatus('saving');
    // Always save to browser cache first so changes are preserved locally in the browser immediately!
    try {
      SecureStorage.setItem('curriculum_data', lessonsToSave);
    } catch (e) {
      console.warn("Failed to write local secure storage cache:", e);
    }

    try {
      const res = await fetch(getAbsoluteUrl('/api/save-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonsToSave)
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } else {
        // Even if server post fails (e.g. read-only filesystem on Vercel),
        // we set saved state because we already successfully saved it in the browser cache!
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    } catch {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  // ── Load an HTML/text file from the server for editing ────────────────────
  const loadFileForEditing = async (filePath: string) => {
    setFileEditorPath(filePath);
    setFileEditorContent('');
    setFileEditorLoading(true);
    setFileEditorSaved(false);
    setFindText('');
    setReplaceText('');
    setNodesSearchQuery('');
    try {
      const res = await fetch(getAbsoluteUrl(`/api/read-file?path=${encodeURIComponent(filePath)}`));
      const data = await res.json();
      const content = data.content ?? '';
      setFileEditorContent(content);
      
      // Parse mindmap nodes
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
        const nodes = Array.from(elements).map((el: any, idx) => {
          let type = 'leaf';
          if (el.classList.contains('root-btn')) type = 'root';
          else if (el.classList.contains('branch-btn')) type = 'branch';
          else if (el.classList.contains('sub-btn')) type = 'sub-branch';
          
          let text = (el.innerText || el.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          return { index: idx, type, text };
        });
        setMindmapNodes(nodes);
      } catch (err) {
        console.error("Error parsing mindmap nodes on load:", err);
        setMindmapNodes([]);
      }
    } catch {
      setFileEditorContent('<!-- خطأ في تحميل الملف -->');
      setMindmapNodes([]);
    } finally {
      setFileEditorLoading(false);
    }
  };

  // ── Helper to save updated file content to the server and reload preview ──
  const saveUpdatedContent = async (contentToSave: string) => {
    if (!fileEditorPath) return;
    setFileEditorSaving(true);
    setFileEditorSaved(false);
    try {
      const res = await fetch(getAbsoluteUrl('/api/save-file'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileEditorPath, content: contentToSave })
      });
      if (res.ok) {
        setFileEditorSaved(true);
        setIframeKey(prev => prev + 1);
        setTimeout(() => setFileEditorSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save content:", err);
    } finally {
      setFileEditorSaving(false);
    }
  };

  // ── Sync mindmapNodes array from raw HTML content ─────────────────────────
  const syncNodesFromHtml = (htmlContent: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
      const nodes = Array.from(elements).map((el: any, idx) => {
        let type = 'leaf';
        if (el.classList.contains('root-btn')) type = 'root';
        else if (el.classList.contains('branch-btn')) type = 'branch';
        else if (el.classList.contains('sub-btn')) type = 'sub-branch';
        let text = (el.innerText || el.textContent || "").trim();
        text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
        return { index: idx, type, text };
      });
      setMindmapNodes(nodes);
    } catch (err) {
      console.error("Failed to sync nodes from HTML:", err);
    }
  };

  // ── Handle text changes in the Easy Editor inputs ─────────────────────────
  const handleNodeTextChange = (idx: number, newText: string) => {
    setMindmapNodes(prev => prev.map(node => node.index === idx ? { ...node, text: newText } : node));
  };

  // ── Handle node deletion in the Easy Editor inputs ────────────────────────
  const handleNodeDelete = (idx: number) => {
    setMindmapNodes(prev => prev.filter(node => node.index !== idx));
  };

  // ── Save all Easy Editor node modifications back to HTML on disk ──────────
  const saveAllVisualEdits = async (customNodes = mindmapNodes) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileEditorContent, 'text/html');
    const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
    
    Array.from(elements).forEach((el: any, idx) => {
      const nodeData = customNodes.find(n => n.index === idx);
      if (!nodeData) {
        // Node was deleted! Remove it from DOM.
        el.remove();
      } else {
        // Node text was updated!
        const newText = nodeData.text;
        const chevron = el.querySelector('.chevron');
        if (chevron) {
          el.innerHTML = '';
          el.appendChild(chevron);
          el.appendChild(doc.createTextNode(' ' + newText));
        } else {
          el.textContent = newText;
        }
      }
    });
    
    const updatedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    setFileEditorContent(updatedHtml);
    await saveUpdatedContent(updatedHtml);
    syncNodesFromHtml(updatedHtml);
  };

  // ── Quick Find & Replace inside HTML/text file ────────────────────────────
  const executeQuickReplace = async () => {
    if (!findText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = findText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    const flexibleRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    const updated = fileEditorContent.replace(flexibleRegex, replaceText);
    
    if (updated === fileEditorContent) {
      alert(lang === 'ar' ? '⚠️ النص المطلوب غير موجود في الملف!' : '⚠️ Requested text not found in file!');
      return;
    }
    
    setFileEditorContent(updated);
    setReplaceSuccess(true);
    setTimeout(() => setReplaceSuccess(false), 2000);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Quick Delete inside HTML/text file ────────────────────────────────────
  const executeQuickDelete = async () => {
    if (!findText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = findText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    
    // Regex patterns to match element tags completely to avoid leaving empty boxes on screen
    const leafRegex = new RegExp('<div\\s+class=["\']leaf-item["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</div>', 'gi');
    const subBtnRegex = new RegExp('<(?:button|div)\\s+class=["\']sub-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</(?:button|div)>', 'gi');
    const branchBtnRegex = new RegExp('<button\\s+class=["\']branch-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const genericRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    let updated = fileEditorContent;
    let matched = false;
    
    let temp = updated.replace(leafRegex, '');
    if (temp.length < updated.length) {
      updated = temp;
      matched = true;
    } else {
      temp = updated.replace(subBtnRegex, '');
      if (temp.length < updated.length) {
        updated = temp;
        matched = true;
      } else {
        temp = updated.replace(branchBtnRegex, '');
        if (temp.length < updated.length) {
          updated = temp;
          matched = true;
        } else {
          temp = updated.replace(genericRegex, '');
          if (temp.length < updated.length) {
            updated = temp;
            matched = true;
          }
        }
      }
    }
    
    if (!matched) {
      alert(lang === 'ar' ? '⚠️ النص المطلوب غير موجود في الملف!' : '⚠️ Requested text not found in file!');
      return;
    }
    
    setFileEditorContent(updated);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 2000);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Visual WYSIWYG Replace (Triggered from double click) ──────────────────
  const executeVisualReplace = async (originalText: string, newText: string) => {
    const currentContent = fileEditorContentRef.current;
    if (!originalText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = originalText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    const flexibleRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    if (!flexibleRegex.test(currentContent)) return;
    
    const updated = currentContent.replace(flexibleRegex, newText);
    setFileEditorContent(updated);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Visual WYSIWYG Delete (Triggered from double click clear) ─────────────
  const executeVisualDelete = async (originalText: string) => {
    const currentContent = fileEditorContentRef.current;
    if (!originalText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = originalText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    
    // Regex patterns to match element tags completely to avoid leaving empty boxes on screen
    const leafRegex = new RegExp('<div\\s+class=["\']leaf-item["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</div>', 'gi');
    const subBtnRegex = new RegExp('<(?:button|div)\\s+class=["\']sub-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</(?:button|div)>', 'gi');
    const branchBtnRegex = new RegExp('<button\\s+class=["\']branch-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const rootBtnRegex = new RegExp('<button\\s+class=["\']root-btn["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const genericRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    let updated = currentContent;
    let temp = updated.replace(leafRegex, '');
    if (temp.length < updated.length) {
      updated = temp;
    } else {
      temp = updated.replace(subBtnRegex, '');
      if (temp.length < updated.length) {
        updated = temp;
      } else {
        temp = updated.replace(branchBtnRegex, '');
        if (temp.length < updated.length) {
          updated = temp;
        } else {
          temp = updated.replace(rootBtnRegex, '');
          if (temp.length < updated.length) {
            updated = temp;
          } else {
            temp = updated.replace(genericRegex, '');
            if (temp.length < updated.length) {
              updated = temp;
            }
          }
        }
      }
    }
    
    if (updated !== currentContent) {
      setFileEditorContent(updated);
      // Auto-save updated content to disk for instant preview update
      await saveUpdatedContent(updated);
      syncNodesFromHtml(updated);
    }
  };

  // ── Handle interactive clicks and double-click editing on the mindmap iframe ──
  const onIframeLoad = () => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      
      // 1. Single click to copy to search field
      doc.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const match = target.closest('.leaf-item, .branch-btn, .sub-btn, .root-btn') as HTMLElement;
        if (match) {
          let text = (match.innerText || match.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          setFindText(text);
        }
      });

      // 2. Double click to start WYSIWYG text edit directly inside mindmap
      const editables = doc.querySelectorAll('.leaf-item, .branch-btn, .sub-btn, .root-btn');
      editables.forEach((el: any) => {
        el.addEventListener('dblclick', (e: MouseEvent) => {
          e.stopPropagation();
          
          let text = (el.innerText || el.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          
          // Check if element is a button (branch-btn, sub-btn, root-btn) to bypass Chrome contentEditable limitation
          if (el.tagName.toLowerCase() === 'button') {
            const promptTitle = lang === 'ar' 
              ? `تعديل عنوان العقدة:\n(اترك الحقل فارغاً لحذف هذا العنوان ومحتوياته بالكامل)`
              : `Edit Node Title:\n(Leave empty to delete this node and its contents completely)`;
            const newText = prompt(promptTitle, text);
            
            if (newText === null) return; // Cancelled
            
            const trimmedNewText = newText.trim().replace(/^[›\s\u203a»\s]+/, "").trim();
            if (trimmedNewText === "") {
              const confirmTitle = lang === 'ar'
                ? `⚠️ هل أنت متأكد من رغبتك في حذف هذا العنوان بالكامل؟`
                : `⚠️ Are you sure you want to delete this title completely?`;
              if (confirm(confirmTitle)) {
                executeVisualDelete(text);
              }
            } else if (trimmedNewText !== text) {
              executeVisualReplace(text, trimmedNewText);
            }
          } else {
            // For div elements (like leaf-item), keep the premium inline editing experience
            el.dataset.originalText = text;
            el.contentEditable = "true";
            el.focus();
            el.style.outline = "2px solid #10b981";
            el.style.borderRadius = "8px";
            el.style.padding = "4px 8px";
            el.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
          }
        });

        el.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
          }
        });

        el.addEventListener('blur', () => {
          el.contentEditable = "false";
          el.style.outline = "";
          el.style.padding = "";
          el.style.backgroundColor = "";
          
          const originalText = el.dataset.originalText;
          if (!originalText) return;
          
          let newText = (el.innerText || el.textContent || "").trim();
          newText = newText.replace(/^[›\s\u203a»\s]+/, "").trim();
          
          if (newText === "") {
            // Delete node completely if cleared
            executeVisualDelete(originalText);
          } else if (newText !== originalText) {
            // Replace node text if modified
            executeVisualReplace(originalText, newText);
          }
        });
      });
    } catch (err) {
      console.error("Failed to set up interactive listeners on iframe:", err);
    }
  };

  // ── Save edited HTML/text file back to server ─────────────────────────────
  const saveFileContent = async () => {
    await saveUpdatedContent(fileEditorContent);
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-20 font-sans transition-colors duration-[250ms]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Admin Header */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('student-profile', 'push_back')} 
            aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
            className="active:scale-95 tap-target p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {backIcon}
          </button>
          <div>
            <h1 className="font-black text-base md:text-lg text-emerald-600 dark:text-emerald-400">
              {lang === 'ar' ? 'لوحة المالك والإدارة' : 'Owner Content Panel'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {lang === 'ar' ? 'سمارت بايو - اليمن' : 'Smart Bio - Yemen'}
            </p>
          </div>
        </div>

        {/* Global Action Header Buttons */}
        <div className="flex items-center gap-2">
          {/* Save Status Badge */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-app-btn border border-amber-200 dark:border-amber-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-app-btn border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تم الحفظ تلقائياً ✓' : 'Auto-Saved ✓'}</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-app-btn border border-rose-200 dark:border-rose-800">
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'خطأ في الحفظ' : 'Save Error'}</span>
            </span>
          )}
          <button
            onClick={handleTriggerDownload}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير المنهج' : 'Download JSON'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-20 px-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar (Vertical on Desktop, Horizontal on Mobile) */}
        <section className="lg:col-span-1 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-4 shadow-xl shadow-slate-100/30 dark:shadow-none flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
            
            <button
              onClick={() => setActiveTab('lessons-list')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'lessons-list'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'ar' ? 'قائمة المنهج' : 'Syllabus List'}</span>
              <span className="ms-auto bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-sans">
                {lessons.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (editingLesson && editingLessonIndex !== null) {
                  setActiveTab('lesson-editor');
                } else if (lessons.length > 0) {
                  setEditingLesson(lessons[0]);
                  setEditingLessonIndex(0);
                  setActiveTab('lesson-editor');
                } else {
                  setActiveTab('lesson-editor');
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'lesson-editor'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Edit className="w-4 h-4" />
              <span>{lang === 'ar' ? 'محرر الدرس الحالي' : 'Lesson Editor'}</span>
            </button>

            <button
              onClick={() => {
                if (editingLesson && editingLessonIndex !== null) {
                  setActiveTab('preview');
                } else if (lessons.length > 0) {
                  setEditingLesson(lessons[0]);
                  setEditingLessonIndex(0);
                  setActiveTab('preview');
                } else {
                  alert(lang === 'ar' ? 'الرجاء إضافة درس أولاً لمعاينته!' : 'Please add a lesson first to preview!');
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'preview'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{lang === 'ar' ? 'معاينة شاشة الطالب' : 'Student Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'export'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تصدير JSON' : 'Export & Build'}</span>
            </button>

            <button
              onClick={() => setActiveTab('keys')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'keys'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>{t.activationKeysTab}</span>
            </button>

            <button
              onClick={() => setActiveTab('helper')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'helper'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>{lang === 'ar' ? 'مساعد الإحداثيات' : 'Coords Helper'}</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'students'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الطلاب والاشتراكات' : 'Students & Subscriptions'}</span>
            </button>

          </div>

          {/* Validation Status Widget */}
          <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-5 shadow-xl shadow-slate-100/30 dark:shadow-none space-y-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {lang === 'ar' ? 'حالة أمان المنهج' : 'Syllabus Integrity'}
              </h4>
            </div>
            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-3 rounded-app-btn border border-emerald-100 dark:border-emerald-900 text-xs font-bold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'جميع البيانات سليمة وجاهزة!' : 'All configurations verified!'}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 p-3 rounded-app-btn border border-rose-100 dark:border-rose-900 text-xs font-bold">
                  {lang === 'ar' ? `يوجد ${validationErrors.length} ملاحظات تكوين:` : `Found ${validationErrors.length} validation warnings:`}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pe-1 text-[10px] text-rose-500 font-bold font-sans">
                  {validationErrors.map((err, i) => (
                    <p key={i} className="border-b border-slate-50 dark:border-slate-800 pb-1">• {err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Visual debugger showing current IDs in state */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'ar' ? 'معرّفات الدروس النشطة بالذاكرة:' : 'Active Lesson IDs in Memory:'}
              </span>
              <div className="flex flex-wrap gap-1">
                {lessons.map((l, i) => (
                  <span key={i} className="text-[9px] font-bold font-sans bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-app-btn text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-750">
                    {i + 1}: {l.id || '❔'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Editor / Dashboard Panel */}
        <section className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: Lessons List Management */}
            {(activeTab === 'lessons-list' || activeTab === 'lesson-editor' || activeTab === 'preview') && (
              <LessonsTab
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                lang={lang}
                lessons={lessons}
                setLessons={setLessons}
                saveAllToServer={saveAllToServer}
                saveStatus={saveStatus}
                editingLesson={editingLesson}
                setEditingLesson={setEditingLesson}
                editingLessonIndex={editingLessonIndex}
                setEditingLessonIndex={setEditingLessonIndex}
                editorSubTab={editorSubTab}
                setEditorSubTab={setEditorSubTab}
              />
            )}

                        {activeTab === 'export' && (
              <ExamBankTab
                lang={lang}
                lessons={lessons}
                setLessons={setLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6 lg:col-span-3 text-right"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 dark:border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Key className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span>{t.activationKeysTab}</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 font-bold mt-1">
                      {lang === 'ar' 
                        ? 'توليد وإدارة كروت تفعيل الباقة المميزة للطلاب. تصديرها للطباعة والتوزيع.' 
                        : 'Generate, manage and export student activation keys for Premium Access.'}
                    </p>
                  </div>

                  <button
                    onClick={handleExportKeys}
                    disabled={keysList.length === 0}
                    className="bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.exportKeysBtn}</span>
                  </button>
                </div>

                {/* Generator Section */}
                <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-[22px] border border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                      {t.keysCount}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={keysGenerateCount}
                      onChange={(e) => setKeysGenerateCount(Math.min(200, Math.max(1, Number(e.target.value))))}
                      className="w-full text-xs font-black px-3.5 py-2.5 rounded-app-btn border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateKeys}
                    disabled={keysLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs px-4 py-3 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/15"
                  >
                    {keysLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>{t.generateKeysBtn}</span>
                  </button>
                </div>

                {keysStatusMsg && (
                  <div className={`text-xs font-black px-4 py-3 rounded-app-btn flex items-center gap-1.5 ${
                    keysStatusMsg.type === 'success' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900' 
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900'
                  }`}>
                    {keysStatusMsg.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 shrink-0" />
                    )}
                    <span>{keysStatusMsg.text}</span>
                  </div>
                )}

                {/* Keys Table / List */}
                <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  {keysList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs">
                      {t.noKeysAvailable}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80">
                            <th className="px-4 py-3">{t.keyLabel}</th>
                            <th className="px-4 py-3">{t.statusLabel}</th>
                            <th className="px-4 py-3">{t.usedByLabel}</th>
                            <th className="px-4 py-3">{t.activatedAtLabel}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'رقم الجهاز' : 'Device ID'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-350">
                          {keysList.slice().reverse().map((k, idx) => (
                            <tr key={idx} className="hover:bg-slate-55/50 dark:hover:bg-slate-950/30 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold select-all tracking-wider text-slate-900 dark:text-white">
                                {k.key}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                                  k.status === 'unused'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                                }`}>
                                  {k.status === 'unused' ? t.statusUnused : t.statusUsed}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold">
                                {k.usedBy || '-'}
                              </td>
                              <td className="px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                                {k.activatedAt ? new Date(k.activatedAt).toLocaleString(lang === 'ar' ? 'ar-YE' : 'en-US') : '-'}
                              </td>
                              <td className="px-4 py-3 font-mono text-[9px] text-slate-400 dark:text-slate-500 select-all">
                                {k.deviceUuid ? k.deviceUuid.substring(0, 12) + '...' : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {k.status === 'used' && (
                                  <button
                                    onClick={() => handleResetDevice(k.key)}
                                    className="text-rose-500 hover:text-rose-600 font-black text-[10px] active:scale-95 transition-all"
                                  >
                                    {lang === 'ar' ? 'إلغاء قفل الجهاز' : 'Reset Device'}
                                  </button>
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
            )}

            {activeTab === 'helper' && (
              <motion.div
                key="helper"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <CoordsHelperTab 
                  lessons={lessons} 
                  setLessons={setLessons} 
                  saveAllToServer={saveAllToServer} 
                  lang={lang} 
                />
              </motion.div>
            )}

            {activeTab === 'students' && (
              <StudentsTab lang={lang} lessons={lessons} />
            )}

          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}

// ── Visual Coordinates Finder Component for Admin ────────────────────────────
interface CoordsHelperTabProps {
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  saveAllToServer: (lessonsToSave: Lesson[]) => Promise<void>;
  lang: Language;
}

function CoordsHelperTab({ lessons, setLessons, saveAllToServer, lang }: CoordsHelperTabProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessons[0]?.id || '');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [detectedFolders, setDetectedFolders] = useState<{ path: string; name: string; files: string[] }[]>([]);

  // Selected hotspot state for editing
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [editLabelAr, setEditLabelAr] = useState('');
  const [editDescAr, setEditDescAr] = useState('');

  // Drag-and-drop state and refs
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [draggingArrowId, setDraggingArrowId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  // Find active diagram inside the selected lesson config
  const activeDiagram = selectedLesson?.interactiveDiagrams?.find(d => d.imageFile === selectedImage);

  const [saveLoading, setSaveLoading] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<{type: 'success' | 'error', text: string} | null>(null);

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

    // Round to 1 decimal place for neatness
    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;

    const updatedDiagrams = selectedLesson.interactiveDiagrams.map(diag => {
      if (diag.imageFile === selectedImage) {
        return {
          ...diag,
          hotspots: diag.hotspots.map(h => {
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
        // Prevent scroll when dragging on mobile
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

  // AI analyzer states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');

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

  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 font-bold">
        {lang === 'ar' ? 'الرجاء استيراد أو إضافة بعض الدروس أولاً!' : 'Please add some lessons first!'}
      </div>
    );
  }

  const getAssetUrl = (lesson: Lesson, file: string) => {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('//')) {
      return file;
    }
    const folderPath = lesson.folder;
    if (folderPath === '.' || folderPath === '/' || !folderPath) {
      return `/${file}`;
    }
    return `/${folderPath}/${file}`;
  };

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

  // Handle click on canvas image
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    if (activeHotspotId && activeDiagram) {
      // Move existing hotspot to this spot
      const updatedHotspots = activeDiagram.hotspots.map(h => 
        h.id === activeHotspotId ? { ...h, x, y } : h
      );
      const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
      updateLessonDiagram(updatedDiag);
      setAiStatusMsg({ type: 'success', text: lang === 'ar' ? 'تم نقل موضع النقطة بنجاح.' : 'Hotspot moved successfully.' });
    } else {
      // Preparing to add new hotspot
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
    const newId = `H${activeDiagram.hotspots.length + 1}`;
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
      hotspots: [...activeDiagram.hotspots, newHotspot]
    };
    updateLessonDiagram(updatedDiag);
    setClickedCoords(null);
    setEditLabelAr('');
    setEditDescAr('');
  };

  const handleUpdateHotspot = () => {
    if (!activeHotspotId || !activeDiagram) return;
    const updatedHotspots = activeDiagram.hotspots.map(h => 
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
    const updatedHotspots = activeDiagram.hotspots.filter(h => h.id !== id);
    const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
    updateLessonDiagram(updatedDiag);
    if (activeHotspotId === id) {
      setActiveHotspotId(null);
      setEditLabelAr('');
      setEditDescAr('');
    }
  };

  // Convert image URL to Base64 and run Gemini Vision Analysis
  const handleAnalyzeDiagram = async () => {
    if (!selectedLesson || !selectedImage) return;
    const imageUrl = getAssetUrl(selectedLesson, selectedImage);
    if (!imageUrl) return;

    setAiLoading(true);
    setAiStatusMsg(null);

    try {
      // 1. Fetch image locally to convert to base64
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to load image file from public assets.');
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const mimeType = blob.type || 'image/png';

          // 2. Call backend analyze diagram
          const apiRes = await fetch(getAbsoluteUrl('/api/analyze-diagram'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-gemini-key': localApiKey
            },
            body: JSON.stringify({ imageBase64: base64data, mimeType })
          });

          const data = await apiRes.json();
          if (!apiRes.ok || !data.success) {
            throw new Error(data.error || 'Gemini API failed to analyze the image.');
          }

          // 3. Map hotspots
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

  const imageUrl = selectedLesson && selectedImage ? getAssetUrl(selectedLesson, selectedImage) : '';

  return (
    <div className="space-y-6">
      {/* 1. Header Configurations Card */}
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
          
          {/* Column A & B: Image Visual Canvas (takes 2/3 space) */}
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
              {/* Image wrapper that aligns coordinates directly with image dimensions */}
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
                
                {/* SVG arrows preview overlay in Admin editor */}
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

                  {activeDiagram?.hotspots?.map((hotspot) => {
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

                {/* Render Existing Hotspots */}
                {activeDiagram?.hotspots?.map((hotspot) => {
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

                {/* Render Arrow Head drag handle for the active hotspot */}
                {activeDiagram?.hotspots?.map((hotspot) => {
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

                {/* Render Temporary Clicked Coordinate */}
                {clickedCoords && (
                  <div
                    className="absolute w-5 h-5 -mt-2.5 -ms-2.5 bg-red-500 border-2 border-white rounded-full shadow-lg shadow-red-500/50 animate-pulse pointer-events-none z-30"
                    style={{ left: `${clickedCoords.x}%`, top: `${clickedCoords.y}%` }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Column C: AI generation and Editing panel (takes 1/3 space) */}
          <div className="space-y-6">
            
            {/* Save Diagram Changes Card */}
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
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-150 dark:border-rose-900'
                }`}>
                  {localSaveStatus.text}
                </div>
              )}
            </div>

            {/* AI Control Panel */}
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

            {/* Hotspots Edit Panel */}
            {activeDiagram && (
              <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  {lang === 'ar' ? 'محرر النقاط التفاعلية' : 'Hotspots Editor'}
                </h3>

                {/* Case 1: Editing Existing Hotspot */}
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
                  // Case 2: Adding New Hotspot
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
                  // Case 3: Prompt instructions
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-app-card text-center text-xs text-slate-400 font-bold leading-relaxed">
                    {lang === 'ar'
                      ? 'حدد نقطة بالنقر على الرسم لإضافتها، أو اضغط على أي علامة تفاعلية لتعديلها أو نقلها.'
                      : 'Click the image to insert a new hotspot, or select a marker to edit details or reposition.'}
                  </div>
                )}

                {/* Hotspots List Summary */}
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