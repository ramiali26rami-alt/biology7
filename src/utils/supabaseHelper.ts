import { ensureAuthenticatedSession, supabase } from './supabaseClient';
import { SecureStorage, checkPremiumStatus, setPremiumUnlockedState } from './security';
import { logger } from './logger';

export interface StudentProfile {
  phone: string;
  name: string;
  governorate: string;
  device_id: string;
  is_premium: boolean;
  created_at?: string;
}

export interface QuizResult {
  lesson_id: string;
  score: number;
  total_questions: number;
  student_phone: string;
  completed_at?: string;
}

// Get device UUID from secure storage
export function getDeviceUuid(): string {
  let uuid = localStorage.getItem('client_device_uuid');
  if (!uuid) {
    // Calling SecureStorage will initialize client_device_uuid securely
    SecureStorage.getItem('client_device_uuid');
    uuid = localStorage.getItem('client_device_uuid');
  }
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem('client_device_uuid', uuid);
  }
  return uuid;
}

function saveStudentLocally(phone: string, student: any): void {
  const name = student?.name || '';
  const governorate = student?.governorate || '';
  const isPremium = !!student?.isPremium;
  localStorage.setItem('student_name', name);
  localStorage.setItem('student_phone', phone);
  localStorage.setItem('student_governorate', governorate);
  SecureStorage.setItem('premium_status', JSON.stringify({
    unlocked: isPremium,
    activatedAt: Date.now(),
    deviceUuid: getDeviceUuid()
  }));
  SecureStorage.setItem('student_name', name);
  setPremiumUnlockedState(isPremium);
}

// Register or restore a student with automatic 60-day device transfer checking
export async function registerStudent(
  name: string,
  phone: string,
  governorate: string
): Promise<{ success: boolean; message: string; isPremium?: boolean; needsTransfer?: boolean; recoveryCode?: string }> {
  try {
    await ensureAuthenticatedSession();
    const deviceId = getDeviceUuid();
    const formattedPhone = phone.trim();
    const { data, error } = await supabase.rpc('register_or_restore_student', {
      student_name: name.trim(),
      student_phone: formattedPhone,
      student_governorate: governorate.trim(),
      student_device_id: deviceId
    });
    if (error) throw error;

    if (data?.success) {
      saveStudentLocally(formattedPhone, data.student);
      return {
        success: true,
        message: data.message,
        isPremium: !!data.student?.isPremium,
        recoveryCode: data.recoveryCode
      };
    }

    if (data?.needsTransfer) {
      const { data: transferData, error: transferError } = await supabase.rpc('handle_device_transfer', {
        student_phone: formattedPhone,
        new_device_id: deviceId
      });
      if (!transferError && transferData?.success) {
        saveStudentLocally(formattedPhone, transferData.student);
        return {
          success: true,
          message: transferData.message,
          isPremium: !!transferData.student?.isPremium,
          recoveryCode: transferData.recoveryCode
        };
      }
    }

    return {
      success: false,
      needsTransfer: !!data?.needsTransfer,
      message: data?.message || (localStorage.getItem('lang') === 'en' ? 'Registration failed.' : 'تعذر إكمال التسجيل.')
    };
  } catch (error: any) {
    logger.error('Error registering student:', error);
    return { success: false, message: (localStorage.getItem('lang') === 'en' ? 'Registration failed: ' : 'فشل التسجيل: ') + (error.message || 'Network error') };
  }
}

/** Transfer the account immediately when the student proves ownership with the one-time recovery code. */
export async function recoverStudentAccount(
  phone: string,
  recoveryCode: string
): Promise<{ success: boolean; message: string; isPremium?: boolean; recoveryCode?: string; locked?: boolean }> {
  const formattedPhone = phone.trim();
  const isEn = localStorage.getItem('lang') === 'en';
  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc('transfer_with_recovery_code', {
      student_phone: formattedPhone,
      new_device_id: getDeviceUuid(),
      recovery_code: recoveryCode.trim()
    });
    if (error) throw error;
    if (data?.success) {
      saveStudentLocally(formattedPhone, data.student);
    }
    return {
      success: !!data?.success,
      message: data?.message || (isEn ? 'Unable to verify the recovery code.' : 'تعذر التحقق من رمز الاسترداد.'),
      isPremium: !!data?.student?.isPremium,
      recoveryCode: data?.recoveryCode,
      locked: !!data?.locked
    };
  } catch (error: any) {
    logger.error('Error recovering student account:', error);
    return {
      success: false,
      message: isEn ? 'Unable to recover the account right now.' : 'تعذر استرداد الحساب حالياً.'
    };
  }
}

/** Create a new recovery code for the student already bound to this session. */
export async function rotateMyRecoveryCode(): Promise<{ success: boolean; message: string; recoveryCode?: string }> {
  const isEn = localStorage.getItem('lang') === 'en';
  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc('rotate_recovery_code');
    if (error) throw error;
    return {
      success: !!data?.success,
      message: data?.message || (isEn ? 'Unable to create a recovery code.' : 'تعذر إنشاء رمز الاسترداد.'),
      recoveryCode: data?.recoveryCode
    };
  } catch (error: any) {
    logger.error('Error rotating recovery code:', error);
    return {
      success: false,
      message: isEn ? 'Unable to create a recovery code right now.' : 'تعذر إنشاء رمز الاسترداد حالياً.'
    };
  }
}

// Request manual device transfer from admin
export async function requestDeviceTransfer(
  phone: string,
  reason: string = 'تغيير الجهاز'
): Promise<{ success: boolean; message: string; requestId?: string }> {
  const newDeviceId = getDeviceUuid();
  const isEn = localStorage.getItem('lang') === 'en';
  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc('request_device_transfer', {
      student_phone: phone.trim(),
      new_device_id: newDeviceId,
      transfer_reason: reason
    });
    if (error) throw error;
    return {
      success: !!data?.success,
      requestId: data?.requestId,
      message: data?.message || (isEn ? 'Unable to submit the request.' : 'تعذر إرسال الطلب.')
    };
  } catch (error: any) {
    return {
      success: false,
      message: (isEn ? 'Failed to submit request: ' : 'فشل إرسال الطلب: ') + (error.message || 'Network error')
    };
  }
}

// Check and sync active subscription from server
export async function checkStudentSubscription(): Promise<boolean> {
  const phone = (localStorage.getItem('student_phone') || '').trim().replace(/\s+/g, '');
  if (!phone) return checkPremiumStatus();

  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase
      .from('students')
      .select('is_premium')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const isPremium = !!data.is_premium;
      const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
      SecureStorage.setItem('premium_status', JSON.stringify({
        unlocked: isPremium,
        activatedAt: Date.now(),
        deviceUuid
      }));
      setPremiumUnlockedState(isPremium);
      return isPremium;
    }
    return checkPremiumStatus();
  } catch (error) {
    logger.warn('Error checking subscription from server, using cached status:', error);
    return checkPremiumStatus();
  }
}

// Save quiz results (Offline-first approach)
export async function saveQuizResult(lessonId: string, score: number, totalQuestions: number): Promise<void> {
  const phone = localStorage.getItem('student_phone');
  if (!phone) return;

  const newResult: QuizResult = {
    student_phone: phone,
    lesson_id: lessonId,
    score,
    total_questions: totalQuestions,
    completed_at: new Date().toISOString()
  };

  const historyKey = `quiz_history_${lessonId}`;
  const history = SecureStorage.getItem(historyKey) || [];
  history.push({ score, totalQuestions, date: newResult.completed_at });
  SecureStorage.setItem(historyKey, history);

  const queueKey = 'unsynced_quiz_results';
  let queue: QuizResult[] = [];
  try {
    const stored = localStorage.getItem(queueKey);
    if (stored) queue = JSON.parse(stored);
  } catch {}
  queue.push(newResult);
  localStorage.setItem(queueKey, JSON.stringify(queue));

  syncUnsavedQuizResults().catch(() => {});
}

// Sync local unsaved quiz results to server
export async function syncUnsavedQuizResults(): Promise<void> {
  const queueKey = 'unsynced_quiz_results';
  let queue: QuizResult[] = [];
  try {
    const stored = localStorage.getItem(queueKey);
    if (!stored) return;
    queue = JSON.parse(stored);
  } catch {
    return;
  }

  if (queue.length === 0) return;

  try {
    await ensureAuthenticatedSession();
    const { error } = await supabase
      .from('quiz_results')
      .insert(queue);

    if (error) throw error;

    localStorage.removeItem(queueKey);
    logger.info(`Synced ${queue.length} quiz results to Supabase successfully.`);
  } catch (error) {
    logger.warn('Failed to sync quiz results, keeping in offline queue:', error);
  }
}

// Claim / use activation code via secure Postgres RPC function
export async function claimActivationCode(code: string): Promise<{ success: boolean; message: string }> {
  const phone = localStorage.getItem('student_phone');
  if (!phone) {
    return { success: false, message: localStorage.getItem('lang') === 'en' ? 'Please log in first!' : 'يرجى تسجيل الدخول أولاً!' };
  }

  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc('claim_activation_code', {
      code_to_claim: code.trim().toUpperCase()
    });

    if (error) throw error;
    if (data?.success) {
      const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
      SecureStorage.setItem('premium_status', JSON.stringify({
        unlocked: true,
        activatedAt: Date.now(),
        deviceUuid
      }));
      setPremiumUnlockedState(true);
    }
    return {
      success: data?.success ?? false,
      message: data?.message ?? (localStorage.getItem('lang') === 'en' ? 'Activation failed' : 'فشل التفعيل')
    };
  } catch (error: any) {
    logger.error('Error claiming code:', error);
    return {
      success: false,
      message: (localStorage.getItem('lang') === 'en' ? 'Activation failed: ' : 'فشل التفعيل: ') + (error.message || 'Network error')
    };
  }
}

// Fetch leaderboard standings
export async function getLeaderboard(): Promise<any[]> {
  try {
    await ensureAuthenticatedSession();
    const { data, error } = await supabase.rpc('get_leaderboard');
    if (error) throw error;
    return (data || []).map((row: any) => ({
      name: row.name,
      governorate: row.governorate,
      lessonsCount: Number(row.lessons_count || 0),
      quizzesCount: Number(row.quizzes_count || 0),
      totalScore: Number(row.total_score || 0),
      accuracy: Number(row.accuracy || 0)
    }));
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    return [];
  }
}

// Log a single question's answer correctness for analytics
export async function logQuestionResult(questionId: string, lessonId: string, questionText: string, isCorrect: boolean): Promise<void> {
  try {
    await ensureAuthenticatedSession();
    const { error } = await supabase.rpc('record_question_result', {
      p_question_id: questionId,
      p_lesson_id: lessonId,
      p_question_text: questionText,
      p_is_correct: isCorrect
    });
    if (error) throw error;
  } catch (err) {
    logger.error('Error logging question result:', err);
  }
}

// Fetch ranked list of difficult questions
export async function getDifficultQuestions(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('question_analytics')
      .select('*');
    if (error) throw error;
    
    return (data || [])
      .map(q => {
        const total = q.correct_count + q.wrong_count;
        const failureRate = total > 0 ? Math.round((q.wrong_count / total) * 100) : 0;
        return {
          ...q,
          total,
          failureRate
        };
      })
      .filter(q => q.wrong_count > 0)
      .sort((a, b) => b.failureRate - a.failureRate || b.wrong_count - a.wrong_count);
  } catch (err) {
    logger.error('Error fetching difficult questions:', err);
    return [];
  }
}

// Upload media files (images, diagrams, PDFs) directly to Supabase storage bucket
export async function uploadMediaToSupabase(file: File, folder = 'curriculum'): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop() || 'webp';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${folder}/${Date.now()}_${cleanFileName}`;
    
    const { data, error } = await supabase.storage
      .from('biology-assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('biology-assets')
      .getPublicUrl(path);

    return { success: true, url: publicData.publicUrl };
  } catch (err: any) {
    console.error('Failed to upload media to Supabase storage:', err);
    return { success: false, error: err.message || 'Upload failed' };
  }
}

