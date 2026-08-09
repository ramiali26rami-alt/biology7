import { supabase } from './supabaseClient';
import { SecureStorage, checkPremiumStatus } from './security';
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
    uuid = localStorage.getItem('client_device_uuid') || '';
  }
  return uuid;
}

// Register or restore a student with automatic 60-day device transfer checking
export async function registerStudent(
  name: string,
  phone: string,
  governorate: string
): Promise<{ success: boolean; message: string; isPremium?: boolean; needsTransfer?: boolean }> {
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
      if (existingStudent.device_id === deviceId) {
        // Device matches! Restore profile locally
        localStorage.setItem('student_name', existingStudent.name);
        localStorage.setItem('student_phone', formattedPhone);
        localStorage.setItem('student_governorate', existingStudent.governorate || '');
        
        const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
        SecureStorage.setItem('premium_status', JSON.stringify({
          unlocked: existingStudent.is_premium,
          activatedAt: Date.now(),
          deviceUuid
        }));
        SecureStorage.setItem('student_name', existingStudent.name);
        SecureStorage.setItem('premium_unlocked', existingStudent.is_premium ? 'true' : 'false');
        
        return { 
          success: true, 
          message: localStorage.getItem('lang') === 'en' ? 'Account restored successfully!' : 'تمت استعادة حسابك بنجاح!', 
          isPremium: existingStudent.is_premium 
        };
      } else {
        // Device mismatch! Call Postgres RPC function to process device transfer rules (e.g. 60-day check)
        const { data: transferResult, error: transferError } = await supabase.rpc('handle_device_transfer', {
          student_phone: formattedPhone,
          new_device_id: deviceId
        });

        if (transferError || !transferResult) {
          throw new Error(transferResult?.message || transferError?.message || 'Device transfer verification failed');
        }

        if (transferResult.success) {
          // Automatic or approved transfer completed! Log student in
          localStorage.setItem('student_name', existingStudent.name);
          localStorage.setItem('student_phone', formattedPhone);
          localStorage.setItem('student_governorate', existingStudent.governorate || '');
          
          const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
          SecureStorage.setItem('premium_status', JSON.stringify({
            unlocked: existingStudent.is_premium,
            activatedAt: Date.now(),
            deviceUuid
          }));
          SecureStorage.setItem('student_name', existingStudent.name);
          SecureStorage.setItem('premium_unlocked', existingStudent.is_premium ? 'true' : 'false');

          return {
            success: true,
            message: transferResult.message || (localStorage.getItem('lang') === 'en' ? 'Account transferred successfully!' : 'تم نقل حسابك للجهاز الجديد بنجاح!'),
            isPremium: existingStudent.is_premium
          };
        } else {
          // Transfer blocked (needs manual approval or was requested too early)
          return {
            success: false,
            needsTransfer: true,
            message: transferResult.message || (localStorage.getItem('lang') === 'en' 
              ? 'This number is registered on another device. You can request a transfer.'
              : 'هذا الرقم مسجّل على جهاز آخر. يمكنك تقديم طلب نقل الحساب.')
          };
        }
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
    
    const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
    SecureStorage.setItem('premium_status', JSON.stringify({
      unlocked: false,
      activatedAt: Date.now(),
      deviceUuid
    }));
    SecureStorage.setItem('student_name', newStudent.name);
    SecureStorage.setItem('premium_unlocked', 'false');

    return { success: true, message: localStorage.getItem('lang') === 'en' ? 'Registration completed successfully!' : 'تم التسجيل بنجاح!' };
  } catch (error: any) {
    logger.error('Error registering student:', error);
    return { success: false, message: (localStorage.getItem('lang') === 'en' ? 'Registration failed: ' : 'فشل التسجيل: ') + (error.message || 'Network error') };
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
    // Check if there is already a pending transfer request for this phone number
    const { data: pendingReq } = await supabase
      .from('device_transfer_requests')
      .select('*')
      .eq('phone', phone.trim())
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingReq) {
      return {
        success: false,
        message: isEn 
          ? 'You already have a pending transfer request under review.'
          : 'لديك طلب نقل معلق قيد المراجعة بالفعل.'
      };
    }

    const { data, error } = await supabase
      .from('device_transfer_requests')
      .insert([{
        phone: phone.trim(),
        new_device_id: newDeviceId,
        reason,
        status: 'pending',
        requested_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) throw error;
    return {
      success: true,
      requestId: data?.id,
      message: isEn 
        ? 'Device transfer request submitted successfully! It will be reviewed within 24 hours.'
        : 'تم إرسال طلب نقل الجهاز بنجاح! سيتم مراجعته من قِبل الأستاذ خلال 24 ساعة.'
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
      const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
      SecureStorage.setItem('premium_status', JSON.stringify({
        unlocked: isPremium,
        activatedAt: Date.now(),
        deviceUuid
      }));
      SecureStorage.setItem('premium_unlocked', isPremium ? 'true' : 'false');
      return isPremium;
    }
    return false;
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
    const { data, error } = await supabase.rpc('claim_activation_code', {
      code_to_claim: code.trim().toUpperCase(),
      student_phone: phone
    });

    if (error) throw error;
    if (data?.success) {
      const deviceUuid = localStorage.getItem('client_device_uuid') || 'default';
      SecureStorage.setItem('premium_status', JSON.stringify({
        unlocked: true,
        activatedAt: Date.now(),
        deviceUuid
      }));
      SecureStorage.setItem('premium_unlocked', 'true');
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
    const { data: results, error: resultsError } = await supabase
      .from('quiz_results')
      .select('student_phone, score, total_questions, lesson_id');
      
    if (resultsError) throw resultsError;
    
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('phone, name, governorate');
      
    if (studentsError) throw studentsError;

    const studentMap: Record<string, { phone: string; name: string; governorate: string; quizzesCount: number; totalScore: number; totalQuestions: number; completedLessons: Set<string> }> = {};
    
    students.forEach(s => {
      studentMap[s.phone] = {
        phone: s.phone,
        name: s.name,
        governorate: s.governorate || '',
        quizzesCount: 0,
        totalScore: 0,
        totalQuestions: 0,
        completedLessons: new Set()
      };
    });

    results?.forEach(r => {
      const phone = r.student_phone;
      if (studentMap[phone]) {
        studentMap[phone].quizzesCount += 1;
        studentMap[phone].totalScore += r.score;
        studentMap[phone].totalQuestions += r.total_questions;
        if (r.lesson_id) {
          studentMap[phone].completedLessons.add(r.lesson_id);
        }
      }
    });

    return Object.values(studentMap)
      .filter(s => s.quizzesCount > 0)
      .map(s => {
        const accuracy = s.totalQuestions > 0 ? Math.round((s.totalScore / s.totalQuestions) * 100) : 0;
        return {
          name: s.name,
          governorate: s.governorate,
          lessonsCount: s.completedLessons.size,
          quizzesCount: s.quizzesCount,
          totalScore: s.totalScore,
          accuracy: accuracy
        };
      })
      .sort((a, b) => {
        if (b.lessonsCount !== a.lessonsCount) return b.lessonsCount - a.lessonsCount;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return b.accuracy - a.accuracy;
      });
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    return [];
  }
}

// Log a single question's answer correctness for analytics
export async function logQuestionResult(questionId: string, lessonId: string, questionText: string, isCorrect: boolean): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('question_analytics')
      .select('wrong_count, correct_count')
      .eq('question_id', questionId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      await supabase
        .from('question_analytics')
        .update({
          wrong_count: data.wrong_count + (isCorrect ? 0 : 1),
          correct_count: data.correct_count + (isCorrect ? 1 : 0)
        })
        .eq('question_id', questionId);
    } else {
      await supabase
        .from('question_analytics')
        .insert([{
          question_id: questionId,
          lesson_id: lessonId,
          question_text: questionText,
          wrong_count: isCorrect ? 0 : 1,
          correct_count: isCorrect ? 1 : 0
        }]);
    }
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
