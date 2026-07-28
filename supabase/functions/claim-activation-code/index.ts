import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, phone } = await req.json()
    if (!code || !phone) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if code exists and is not used
    const { data: codeData } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()

    if (!codeData) {
      return new Response(JSON.stringify({ success: false, message: 'رمز التفعيل هذا غير موجود!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (codeData.is_used) {
      return new Response(JSON.stringify({ success: false, message: 'رمز التفعيل هذا مستخدم مسبقاً!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Mark code as used
    await supabase
      .from('activation_codes')
      .update({
        is_used: true,
        used_by_phone: phone,
        used_at: new Date().toISOString()
      })
      .eq('code', codeData.code)

    // Set student as premium
    await supabase
      .from('students')
      .update({ is_premium: true })
      .eq('phone', phone)

    return new Response(JSON.stringify({
      success: true,
      message: 'تهانينا! تم تفعيل الباقة الكاملة بنجاح! 🌟'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
