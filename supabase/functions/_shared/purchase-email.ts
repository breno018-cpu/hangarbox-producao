import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { template as purchaseTpl } from './transactional-email-templates/purchase-confirmation.tsx'

const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'HangarBox <noreply@hangarboxx.com.br>'

async function sendViaResend(key: string, to: string, data: Record<string, any>, idem: string) {
  const html = await renderAsync(React.createElement(purchaseTpl.component, data))
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject: purchaseTpl.subject, html }),
  })
  if (!res.ok) throw new Error(`Resend [${res.status}]: ${await res.text()}`)
}

// Sends the purchase confirmation once per paid order and records the result on the order.
export async function sendPurchaseEmailOnce(supabase: any, orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, user_email, user_name, items, total, email_sent_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.status !== 'pago' || order.email_sent_at) return

  const raw = Array.isArray(order.items) ? order.items : []
  const ids = raw.map((i: any) => i.id).filter(Boolean)
  const { data: series } = ids.length
    ? await supabase.from('series').select('id, link_acesso').in('id', ids)
    : { data: [] }
  const linkMap = new Map((series || []).map((s: any) => [s.id, s.link_acesso]))
  const items = raw.map((i: any) => ({ titulo: i.titulo, preco: Number(i.preco || 0), link: linkMap.get(i.id) || i.link_acesso || '' }))

  let status = 'enviado'
  try {
    let resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      try {
        const { data: ss } = await supabase.from('site_settings').select('value').eq('key', 'resend_api_key').maybeSingle()
        if (ss?.value) resendKey = ss.value
      } catch {
        // Ignora erro se tabela não existir
      }
    }

    const data = { name: order.user_name, orderId: order.id, total: Number(order.total), items }
    if (resendKey) {
      await sendViaResend(resendKey, order.user_email, data, `purchase-confirmation-${order.id}`)
    } else {
      console.warn('RESEND_API_KEY not configured. Skipping purchase confirmation email.')
      status = 'nao_configurado'
    }
  } catch (e) {
    console.error('purchase email error', e)
    await supabase.from('orders').update({ email_status: 'falhou' }).eq('id', order.id)
    return
  }
  await supabase.from('orders').update({ email_status: status, email_sent_at: status === 'enviado' ? new Date().toISOString() : null }).eq('id', order.id)
}
