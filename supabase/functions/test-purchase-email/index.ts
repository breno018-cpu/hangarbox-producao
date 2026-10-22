import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { template } from '../_shared/transactional-email-templates/purchase-confirmation.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let toEmail = (body?.to || body?.user_email || 'laurentinobreno08@gmail.com').toString().trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(toEmail)) {
    return new Response(JSON.stringify({ error: 'Endereço de e-mail inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isTest = body?.is_test === true || (!body?.items && !body?.order_id && !body?.orderId)
  const subject = isTest ? ('[TESTE] ' + template.subject) : template.subject

  const orderData = body?.items
    ? {
        name: body.name || body.user_name || 'Cliente',
        orderId: body.orderId || body.order_id || 'HB-CONFIRMADO',
        total: Number(body.total || 0),
        items: Array.isArray(body.items)
          ? body.items.map((it: any) => ({
              titulo: it.titulo || it.title || 'Série',
              preco: Number(it.preco || it.price || 0),
              link: it.link || it.link_acesso || '',
            }))
          : [],
      }
    : template.previewData

  const fromEmail = Deno.env.get('RESEND_FROM') || 'HangarBox <noreply@hangarboxx.com.br>'
  const html = await renderAsync(React.createElement(template.component, orderData))

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
    }),
  })

  const resText = await res.text()
  return new Response(resText, {
    status: res.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
