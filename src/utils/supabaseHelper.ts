import { supabase } from './supabaseClient';
import { SecureStorage } from './security';

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

// Get device UUID from local storage
export function getDeviceUuid(): string {
  let uuid = localStorage.getItem('client_device_uuid');
  if (!uuid) {
    uuid = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('client_device_uuid', uuid);
  }
  return uuid;
}

// 1. Register or restore a student
export async function registerStudent(name: string, phone: string, governorate: string): Promise<{ success: boolean; message: string; isPremium?: boolean }> {
  try {
    const deviceId = getDeviceUuid();
    const formattedPhone = phone.trim();

    // Check if student with this phone number already exists
    const { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingStudent) {
      // Reinstall scenario: check if device ID matches
      if (existingStudent.device_id === deviceId) {
        // Device matches! Restore profile locally
        localStorage.setItem('student_name', existingStudent.name);
        localStorage.setItem('student_email', ''); // clear or empty
        localStorage.setItem('student_phone', formattedPhone);
        localStorage.setItem('student_governorate', existingStudent.governorate || '');
        
        SecureStorage.setItem('student_name', existingStudent.name);
        SecureStorage.setItem('premium_unlocked', existingStudent.is_premium ? 'true' : 'false');
        localStorage.setItem('premium_unlocked', existingStudent.is_premium ? 'true' : 'false');
        
        return { 
          success: true, 
          message: 'تمت استعادة حسابك بنجاح!', 
          isPremium: existingStudent.is_premium 
        };
      } else {
        // Device mismatch!
        return { 
          success: false, 
          message: 'هذا الرقم مسجل بالفعل على جهاز هاتف آخر! يرجى التواصل مع الأستاذ لإعادة ضبط حسابك ونقله.' 
        };
      }
    }

    // New student: insert record
    const newStudent: StudentProfile = {
      phone: formattedPhone,
      name: name.trim(),
      governorate: governorate.trim(),
      device_id: deviceId,
      is_premium: false
    };

    const { error: insertError } = await supabase
      .from('students')
      .insert([newStudent]);

    if (insertError) throw insertError;

    // Save profile locally
    localStorage.setItem('student_name', newStudent.name);
    localStorage.setItem('student_phone', formattedPhone);
    localStorage.setItem('student_governorate', newStudent.governorate);
    
    SecureStorage.setItem('student_name', newStudent.name);
    SecureStorage.setItem('premium_unlocked', 'false');
    localStorage.setItem('premium_unlocked', 'false');

    return { success: true, message: 'تم التسجيل بنجاح!' };
  } catch (error: any) {
    console.error('Error registering student:', error);
    return { success: false, message: `فشل التسجيل: ${error.message || 'خطأ في الشبكة'}` };
  }
}

// 2. Check and sync active subscription from server
export async function checkStudentSubscription(): Promise<boolean> {
  const phone = localStorage.getItem('student_phone');
  if (!phone) return false;

  try {
    const { data, error } = await supabase
      .from('students')
      .select('is_premium')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const isPremium = data.is_premium;
      SecureStorage.setItem('premium_unlocked', isPremium ? 'true' : 'false');
      localStorage.setItem('premium_unlocked', isPremium ? 'true' : 'false');
      return isPremium;
    }
    return false;
  } catch (error) {
    console.warn('Error checking subscription from server, using cached status:', error);
    return SecureStorage.getItem('premium_unlocked') === 'true';
  }
}

// 3. Save quiz results (Offline-first approach)
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

  // 3.1 Save to local history list
  const historyKey = `quiz_history_${lessonId}`;
  const history = SecureStorage.getItem(historyKey) || [];
  history.push({ score, totalQuestions, date: newResult.completed_at });
  SecureStorage.setItem(historyKey, history);

  // 3.2 Add to unsynced queue
  const queueKey = 'unsynced_quiz_results';
  let queue: QuizResult[] = [];
  try {
    const stored = localStorage.getItem(queueKey);
    if (stored) queue = JSON.parse(stored);
  } catch {}
  queue.push(newResult);
  localStorage.setItem(queueKey, JSON.stringify(queue));

  // 3.3 Trigger sync in background (silent)
  syncUnsavedQuizResults().catch(() => {});
}

// 4. Sync local unsaved quiz results to server
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
    // Insert all pending results
    const { error } = await supabase
      .from('quiz_results')
      .insert(queue);

    if (error) throw error;

    // Success! Clear the queue
    localStorage.removeItem(queueKey);
    console.log(`Synced ${queue.length} quiz results to Supabase successfully.`);
  } catch (error) {
    console.warn('Failed to sync quiz results, keeping in offline queue:', error);
  }
}

// 5. Claim / use activation code
export async function claimActivationCode(code: string): Promise<{ success: boolean; message: string }> {
  const phone = localStorage.getItem('student_phone');
  if (!phone) {
    return { success: false, message: 'يرجى تسجيل الدخول أولاً!' };
  }

  const cleanedCode = code.trim().toUpperCase();

  try {
    // 5.1 Check if code exists and is not used
    const { data: codeData, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', cleanedCode)
      .maybeSingle();

    if (codeError) throw codeError;
    if (!codeData) {
      return { success: false, message: 'رمز التفعيل هذا غير موجود!' };
    }
    if (codeData.is_used) {
      return { success: false, message: 'رمز التفعيل هذا مستخدم مسبقاً!' };
    }

    // 5.2 Mark code as used
    const { error: updateCodeError } = await supabase
      .from('activation_codes')
      .update({
        is_used: true,
        used_by_phone: phone,
        used_at: new Date().toISOString()
      })
      .eq('code', cleanedCode);

    if (updateCodeError) throw updateCodeError;

    // 5.3 Set student as premium
    const { error: updateStudentError } = await supabase
      .from('students')
      .update({ is_premium: true })
      .eq('phone', phone);

    if (updateStudentError) throw updateStudentError;

    // Update local cache
    SecureStorage.setItem('premium_unlocked', 'true');
    localStorage.setItem('premium_unlocked', 'true');

    return { success: true, message: 'تهانينا! تم تفعيل الباقة الكاملة بنجاح! 🌟' };
  } catch (error: any) {
    console.error('Error claiming code:', error);
    return { success: false, message: `فشل التفعيل: ${error.message || 'خطأ في الشبكة'}` };
  }
}
