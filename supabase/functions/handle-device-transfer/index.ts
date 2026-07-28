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
    const { phone, deviceId } = await req.json()
    if (!phone || !deviceId) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Check if there is an approved request for this phone and this device
    const { data: approvedReq } = await supabase
      .from('device_transfer_requests')
      .select('*')
      .eq('phone', phone)
      .eq('new_device_id', deviceId)
      .eq('status', 'approved')
      .maybeSingle()

    if (approvedReq) {
      // Complete the transfer
      await supabase.from('students').update({ device_id: deviceId }).eq('phone', phone)
      await supabase.from('device_transfer_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', approvedReq.id)
      return new Response(JSON.stringify({ success: true, message: 'تم تفعيل حسابك على هذا الجهاز بعد موافقة الأستاذ!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Check if the last completed transfer was < 60 days ago
    const { data: lastTransfers } = await supabase
      .from('device_transfer_requests')
      .select('*')
      .eq('phone', phone)
      .in('status', ['approved', 'completed'])
      .order('requested_at', { ascending: false })

    if (lastTransfers && lastTransfers.length > 0) {
      const lastTransferDate = new Date(lastTransfers[0].completed_at || lastTransfers[0].requested_at)
      const daysDiff = (Date.now() - lastTransferDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysDiff < 60) {
        const remainingDays = Math.ceil(60 - daysDiff)
        return new Response(JSON.stringify({
          success: false,
          needsTransfer: true,
          message: `هذا الحساب تم نقله مؤخراً. لا يمكنك النقل التلقائي مجدداً إلا بعد ${remainingDays} يوماً. يمكنك تقديم طلب نقل للمراجعة اليدوية.`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 3. Auto-transfer allowed!
    await supabase.from('students').update({ device_id: deviceId }).eq('phone', phone)
    await supabase.from('device_transfer_requests').insert([{
      phone,
      new_device_id: deviceId,
      reason: 'نقل تلقائي (كل شهرين)',
      status: 'completed',
      completed_at: new Date().toISOString()
    }])

    return new Response(JSON.stringify({ success: true, message: 'تم نقل الحساب تلقائياً للجهاز الجديد بنجاح!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
