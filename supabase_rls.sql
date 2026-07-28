-- supabase_rls.sql
-- Run this script inside your Supabase Dashboard -> SQL Editor

-- ═══════════════════════════════════════
-- 1. Enable RLS on core tables
-- ═══════════════════════════════════════
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- 2. Students Policies
-- ═══════════════════════════════════════
-- Allow clients to insert new profiles (Registration)
CREATE POLICY "allow_insert_new_student"
  ON students FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow clients to read student profile (by phone, etc.)
CREATE POLICY "allow_read_students"
  ON students FOR SELECT
  TO anon
  USING (true);

-- BLOCK all client-side updates (prevents premium spoofing)
CREATE POLICY "deny_update_from_client"
  ON students FOR UPDATE
  TO anon
  USING (false);

-- ═══════════════════════════════════════
-- 3. Quiz Results Policies
-- ═══════════════════════════════════════
-- Allow clients to submit results
CREATE POLICY "allow_insert_own_results"
  ON quiz_results FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow clients to view leaderboard
CREATE POLICY "allow_read_all_results"
  ON quiz_results FOR SELECT
  TO anon
  USING (true);

-- ═══════════════════════════════════════
-- 4. Activation Codes Policies
-- ═══════════════════════════════════════
-- BLOCK client-side access entirely (claimed only via Edge Function)
CREATE POLICY "deny_read_codes"
  ON activation_codes FOR SELECT
  TO anon
  USING (false);

-- ═══════════════════════════════════════
-- 5. Device Transfer Requests Table & Policies
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS device_transfer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  new_device_id TEXT NOT NULL,
  reason TEXT DEFAULT 'تغيير الجهاز',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE device_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Allow clients to submit transfer requests
CREATE POLICY "allow_insert_transfer_request"
  ON device_transfer_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow clients to check their own request status
CREATE POLICY "allow_read_own_transfer_request"
  ON device_transfer_requests FOR SELECT
  TO anon
  USING (true);

-- ═══════════════════════════════════════
-- 6. Question Analytics Policies
-- ═══════════════════════════════════════
CREATE POLICY "allow_all_on_analytics"
  ON question_analytics FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════
-- 7. Postgres RPC Functions (Bypassing RLS securely via SECURITY DEFINER)
-- ═══════════════════════════════════════

-- 7.1 RPC for claiming activation codes
CREATE OR REPLACE FUNCTION claim_activation_code(code_to_claim TEXT, student_phone TEXT)
RETURNS JSON AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- 1. Check code existence and usage
  SELECT * INTO code_record FROM activation_codes 
  WHERE code = UPPER(TRIM(code_to_claim)) 
  LIMIT 1;

  IF code_record IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'رمز التفعيل هذا غير موجود!');
  END IF;

  IF code_record.is_used THEN
    RETURN json_build_object('success', false, 'message', 'رمز التفعيل هذا مستخدم مسبقاً!');
  END IF;

  -- 2. Mark code as used
  UPDATE activation_codes 
  SET is_used = true, 
      used_by_phone = student_phone, 
      used_at = NOW() 
  WHERE code = code_record.code;

  -- 3. Set student as premium
  UPDATE students 
  SET is_premium = true 
  WHERE phone = student_phone;

  RETURN json_build_object('success', true, 'message', 'تهانينا! تم تفعيل الباقة الكاملة بنجاح! 🌟');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 RPC for handling device transfers (60-day auto-transfer check)
CREATE OR REPLACE FUNCTION handle_device_transfer(student_phone TEXT, new_device_id TEXT)
RETURNS JSON AS $$
DECLARE
  approved_req RECORD;
  last_transfer RECORD;
  days_diff NUMERIC;
  remaining_days INT;
BEGIN
  -- 1. Check if there is an approved request for this phone and this device
  SELECT * INTO approved_req FROM device_transfer_requests 
  WHERE phone = student_phone 
    AND new_device_id = handle_device_transfer.new_device_id 
    AND status = 'approved'
  LIMIT 1;

  IF approved_req IS NOT NULL THEN
    -- Complete the transfer
    UPDATE students SET device_id = handle_device_transfer.new_device_id WHERE phone = student_phone;
    UPDATE device_transfer_requests SET status = 'completed', completed_at = NOW() WHERE id = approved_req.id;
    RETURN json_build_object('success', true, 'message', 'تم تفعيل حسابك على هذا الجهاز بعد موافقة الأستاذ!');
  END IF;

  -- 2. Check if the last completed transfer was < 60 days ago
  SELECT * INTO last_transfer FROM device_transfer_requests 
  WHERE phone = student_phone 
    AND status IN ('approved', 'completed')
  ORDER BY requested_at DESC 
  LIMIT 1;

  IF last_transfer IS NOT NULL THEN
    days_diff := EXTRACT(EPOCH FROM (NOW() - COALESCE(last_transfer.completed_at, last_transfer.requested_at))) / 86400;
    IF days_diff < 60 THEN
      remaining_days := CEIL(60 - days_diff);
      RETURN json_build_object(
        'success', false, 
        'needsTransfer', true, 
        'message', 'هذا الحساب تم نقله مؤخراً. لا يمكنك النقل التلقائي مجدداً إلا بعد ' || remaining_days || ' يوماً. يمكنك تقديم طلب نقل للمراجعة اليدوية.'
      );
    END IF;
  END IF;

  -- 3. Auto-transfer allowed!
  UPDATE students SET device_id = handle_device_transfer.new_device_id WHERE phone = student_phone;
  INSERT INTO device_transfer_requests (phone, new_device_id, reason, status, completed_at)
  VALUES (student_phone, handle_device_transfer.new_device_id, 'نقل تلقائي (كل شهرين)', 'completed', NOW());

  RETURN json_build_object('success', true, 'message', 'تم نقل الحساب تلقائياً للجهاز الجديد بنجاح!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
