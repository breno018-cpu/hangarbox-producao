import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

export interface EmailItem {
  titulo?: string
  preco?: number
  link?: string
}

export interface RelatedItem {
  titulo: string
  preco: number
  badge?: string
  link?: string
}

export interface PurchaseConfirmationProps {
  name?: string
  orderId?: string
  total?: number
  items?: EmailItem[]
  paidAt?: string
  customerEmail?: string
  relatedSeries?: RelatedItem[]
}

const brl = (v?: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const defaultRelated: RelatedItem[] = [
  {
    titulo: 'O Quarterback Perdido Retorna em Cena (Dublado)',
    preco: 24.9,
    badge: '🔥 Mais Vendido',
    link: 'https://hangarboxx.com.br',
  },
  {
    titulo: 'Prefiro Morrer a Te Amar de Novo (Dublado)',
    preco: 19.9,
    badge: '⭐ Avaliação 4.9',
    link: 'https://hangarboxx.com.br',
  },
  {
    titulo: 'Só Mais Uma Vez (Completo HD)',
    preco: 19.9,
    badge: '✨ Lançamento',
    link: 'https://hangarboxx.com.br',
  },
]

export const PurchaseConfirmationEmail = ({
  name,
  orderId,
  total,
  items = [],
  paidAt,
  customerEmail,
  relatedSeries = defaultRelated,
}: PurchaseConfirmationProps) => {
  const displayDate = paidAt || new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const orderShort = orderId ? `#HB-${orderId.slice(0, 8).toUpperCase()}` : '#HB-CONFIRMADO'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>Acesso Liberado! Sua compra na HangarBox foi confirmada via PIX 🎬</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* 1. Header Cinematográfico */}
          <Section style={header}>
            <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%' }}>
              <tr>
                <td align="left" style={{ verticalAlign: 'middle' }}>
                  <Text style={brand}>Hangar<span style={brandAccent}>Box</span></Text>
                  <Text style={brandSub}>Streaming & Catálogo Exclusivo</Text>
                </td>
                <td align="right" style={{ verticalAlign: 'middle' }}>
                  <span style={statusBadge}>
                    <span style={statusDot}>●</span> PIX APROVADO
                  </span>
                </td>
              </tr>
            </table>
          </Section>

          {/* Wrapper interno com padding controlado sem overflow */}
          <Section style={bodyPadding}>
            {/* 2. Banner de Boas-Vindas */}
            <Heading style={heroTitle}>Pagamento Aprovado com Sucesso!</Heading>
            <Text style={heroSubtitle}>
              Olá, <strong>{name || 'Assinante'}</strong>! Seu pagamento PIX foi aprovado e o seu acesso vitalício aos títulos está 100% liberado abaixo.
            </Text>

            {/* 3. Recibo Oficial */}
            <Section style={boxCard}>
              <Text style={sectionHeading}>📋 Dados Oficiais da Compra</Text>
              <table width="100%" cellPadding="0" cellSpacing="0" style={{ width: '100%', fontSize: '13px' }}>
                <tr>
                  <td style={tableLabel}>Pedido:</td>
                  <td style={tableValueMono}>{orderShort}</td>
                </tr>
                <tr>
                  <td style={tableLabel}>Data / Horário:</td>
                  <td style={tableValue}>{displayDate}</td>
                </tr>
                <tr>
                  <td style={tableLabel}>Forma de Pagamento:</td>
                  <td style={tableValue}>PIX Instantâneo</td>
                </tr>
                {customerEmail && (
                  <tr>
                    <td style={tableLabel}>E-mail Registrado:</td>
                    <td style={tableValueBreak}>{customerEmail}</td>
                  </tr>
                )}
                <tr>
                  <td style={tableLabel}>Tipo de Acesso:</td>
                  <td style={tableValueGreen}>Vitalício • Sem Mensalidades</td>
                </tr>
                <tr>
                  <td style={tableLabelBold}>Total Pago:</td>
                  <td style={tableValueBold}>{brl(total)}</td>
                </tr>
              </table>
            </Section>

            {/* 4. Títulos Comprados & Links Diretos */}
            <Text style={sectionHeadingSpacing}>🎬 Seus Títulos Liberados para Assistir</Text>
            <Text style={sectionDesc}>
              Clique no botão da sua série para abrir a pasta oficial (Mega / Drive / Player) e assistir online ou baixar em alta definição:
            </Text>

            {items.map((it, idx) => (
              <Section key={idx} style={itemCard}>
                <div style={cardItemBadge}>EPISÓDIOS COMPLETOS • 1080p FULL HD</div>
                <Text style={cardItemTitle}>{it.titulo || 'Série Adquirida'}</Text>
                <Text style={cardItemPrice}>Valor do título: <strong>{brl(it.preco)}</strong></Text>

                <div style={{ marginTop: '12px' }}>
                  {it.link ? (
                    <Button href={it.link} style={primaryButton}>
                      ▶ ASSISTIR AGORA (ACESSAR PASTA)
                    </Button>
                  ) : (
                    <Text style={mutedNote}>O link de acesso direto está sendo indexado.</Text>
                  )}
                </div>
              </Section>
            ))}

            {/* 5. Guia Rápido: Como Assistir */}
            <Section style={guideBox}>
              <Text style={guideHeading}>💡 Dicas Rápidas para Assistir</Text>
              <table width="100%" cellPadding="0" cellSpacing="0" style={{ width: '100%', fontSize: '12px' }}>
                <tr>
                  <td style={guideBullet}>📺</td>
                  <td style={guideText}>
                    <strong>Na Smart TV:</strong> Espelhe pelo celular via Chromecast / AirPlay ou abra o link direto no navegador da TV.
                  </td>
                </tr>
                <tr>
                  <td style={guideBullet}>📱</td>
                  <td style={guideText}>
                    <strong>No Celular / Tablet:</strong> Assista diretamente pelo navegador ou use o app do Mega/Drive para baixar e ver offline.
                  </td>
                </tr>
                <tr>
                  <td style={guideBullet}>💻</td>
                  <td style={guideText}>
                    <strong>No Computador:</strong> Assista em tela cheia com alta velocidade de carregamento e sem anúncios.
                  </td>
                </tr>
              </table>
            </Section>

            {/* 6. Cupom VIP de Fidelidade */}
            <Section style={couponBanner}>
              <div style={couponTag}>🎁 PRESENTE PARA SUA PRÓXIMA HISTÓRIA</div>
              <Text style={couponTitle}>Ganhe 15% de Desconto na Próxima Compra!</Text>
              <Text style={couponDesc}>Use o código abaixo no checkout ao escolher qualquer outra série:</Text>
              <div style={couponCodeBox}>CLIENTEVIP</div>
            </Section>

            {/* 7. Séries Relacionadas */}
            <Text style={sectionHeadingSpacing}>🍿 Outras Séries que Você Vai Amar</Text>
            <Text style={sectionDesc}>Títulos em alta recomendados para você:</Text>

            {relatedSeries.map((rel, i) => (
              <Section key={i} style={relatedCard}>
                <table width="100%" cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                  <tr>
                    <td style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                      {rel.badge && <span style={relatedBadge}>{rel.badge}</span>}
                      <Text style={relatedTitle}>{rel.titulo}</Text>
                      <Text style={relatedPrice}>Apenas {brl(rel.preco)} à vista</Text>
                    </td>
                    <td align="right" style={{ verticalAlign: 'middle', width: '100px' }}>
                      <Button href={rel.link || 'https://hangarboxx.com.br'} style={secondaryButton}>
                        Ver Série
                      </Button>
                    </td>
                  </tr>
                </table>
              </Section>
            ))}

            {/* 8. Suporte Prioritário */}
            <Section style={supportBox}>
              <Text style={supportTitle}>💬 Precisa de Ajuda ou Suporte com seu Acesso?</Text>
              <Text style={supportDesc}>
                Nossa equipe de suporte está à disposição para auxiliar com qualquer dúvida sobre links ou reprodução de vídeos.
              </Text>
              <Button
                href="https://wa.me/5583988222975?text=Olá!%20Acabei%20de%20comprar%20no%20HangarBox%20e%20preciso%20de%20suporte."
                style={whatsappButton}
              >
                Falar com Suporte no WhatsApp
              </Button>
            </Section>
          </Section>

          {/* 9. Rodapé Oficial */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerBrand}>HangarBox — Seu Catálogo de Séries & Streaming</Text>
            <Text style={footerText}>
              Este e-mail é o seu comprovante oficial de aquisição. Guarde esta mensagem para acessar seus episódios a qualquer momento.
            </Text>
            <Text style={footerLinks}>
              <a href="https://hangarboxx.com.br" style={footerLink}>Acessar Loja</a> •{' '}
              <a href="https://hangarboxx.com.br" style={footerLink}>Central de Ajuda</a> •{' '}
              <a href="https://hangarboxx.com.br" style={footerLink}>Termos</a>
            </Text>
            <Text style={footerCopy}>
              © 2026 HangarBox Inc. Todos os direitos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PurchaseConfirmationEmail,
  subject: 'Acesso Liberado! Sua compra na HangarBox foi confirmada 🎬',
  displayName: 'Confirmação de Compra Completa',
  previewData: {
    name: 'Breno Laurentino',
    orderId: 'c8f4219a-9e12-4a06-b333-5ca9ddb81485',
    total: 19.9,
    customerEmail: 'laurentinobreno08@gmail.com',
    items: [
      {
        titulo: 'Amor Proibido (Dublado - Temporada Completa)',
        preco: 19.9,
        link: 'https://hangarboxx.com.br',
      },
    ],
    relatedSeries: defaultRelated,
  },
} satisfies TemplateEntry

// --- Estilos Inline Sem Overflow Horizontal ---
const main: React.CSSProperties = {
  backgroundColor: '#0d0d12',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: '0',
  padding: '16px 8px',
  width: '100%',
}

const container: React.CSSProperties = {
  width: '100%',
  maxWidth: '540px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  overflow: 'hidden',
  border: '1px solid #e4e4e7',
}

const header: React.CSSProperties = {
  backgroundColor: '#09090b',
  padding: '20px',
  borderBottom: '2px solid #E31C25',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const brand: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 900,
  margin: '0',
  letterSpacing: '-0.5px',
}

const brandAccent: React.CSSProperties = {
  color: '#E31C25',
}

const brandSub: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '11px',
  margin: '2px 0 0 0',
  fontWeight: 500,
}

const statusBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: 'rgba(227, 28, 37, 0.15)',
  border: '1px solid rgba(227, 28, 37, 0.4)',
  borderRadius: '20px',
  padding: '5px 10px',
  color: '#f87171',
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap' as const,
}

const statusDot: React.CSSProperties = {
  color: '#ef4444',
  marginRight: '3px',
}

const bodyPadding: React.CSSProperties = {
  padding: '20px',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const heroTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#18181b',
  margin: '0 0 6px 0',
  letterSpacing: '-0.4px',
}

const heroSubtitle: React.CSSProperties = {
  fontSize: '13px',
  color: '#52525b',
  lineHeight: '20px',
  margin: '0 0 16px 0',
}

const boxCard: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '16px',
  backgroundColor: '#f8fafc',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  margin: '12px 0',
}

const sectionHeading: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#0f172a',
  margin: '0 0 10px 0',
}

const sectionHeadingSpacing: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#0f172a',
  margin: '20px 0 6px 0',
}

const sectionDesc: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  lineHeight: '18px',
  margin: '0 0 12px 0',
}

const tableLabel: React.CSSProperties = {
  color: '#64748b',
  padding: '3px 0',
  width: '42%',
  fontSize: '12px',
}

const tableValue: React.CSSProperties = {
  color: '#1e293b',
  fontWeight: 600,
  textAlign: 'right',
  padding: '3px 0',
  fontSize: '12px',
}

const tableValueBreak: React.CSSProperties = {
  color: '#1e293b',
  fontWeight: 600,
  textAlign: 'right',
  padding: '3px 0',
  fontSize: '11px',
  wordBreak: 'break-all' as const,
}

const tableValueMono: React.CSSProperties = {
  color: '#E31C25',
  fontFamily: 'monospace',
  fontWeight: 700,
  textAlign: 'right',
  padding: '3px 0',
  fontSize: '12px',
}

const tableValueGreen: React.CSSProperties = {
  color: '#ef4444',
  fontWeight: 700,
  textAlign: 'right',
  padding: '3px 0',
  fontSize: '12px',
}

const tableLabelBold: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '13px',
  padding: '6px 0 0 0',
  borderTop: '1px dashed #cbd5e1',
}

const tableValueBold: React.CSSProperties = {
  color: '#E31C25',
  fontWeight: 900,
  fontSize: '15px',
  textAlign: 'right',
  padding: '6px 0 0 0',
  borderTop: '1px dashed #cbd5e1',
}

const itemCard: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  backgroundColor: '#ffffff',
  border: '1.5px solid #e4e4e7',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '12px',
}

const cardItemBadge: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 800,
  color: '#E31C25',
  letterSpacing: '0.5px',
  marginBottom: '4px',
}

const cardItemTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 800,
  color: '#18181b',
  margin: '0 0 3px 0',
  lineHeight: '20px',
}

const cardItemPrice: React.CSSProperties = {
  fontSize: '11px',
  color: '#71717a',
  margin: '0',
}

const primaryButton: React.CSSProperties = {
  backgroundColor: '#E31C25',
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 800,
  padding: '12px 16px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'block',
  textAlign: 'center',
  letterSpacing: '0.3px',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const mutedNote: React.CSSProperties = {
  fontSize: '11px',
  color: '#a1a1aa',
  fontStyle: 'italic',
}

const guideBox: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '14px 16px',
  backgroundColor: '#18181b',
  borderRadius: '14px',
  border: '1px solid #27272a',
  margin: '14px 0',
}

const guideHeading: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: '#ef4444',
  margin: '0 0 8px 0',
}

const guideBullet: React.CSSProperties = {
  verticalAlign: 'top',
  width: '22px',
  fontSize: '14px',
  paddingTop: '1px',
}

const guideText: React.CSSProperties = {
  fontSize: '11px',
  color: '#f87171',
  lineHeight: '16px',
  paddingBottom: '6px',
}

const couponBanner: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '16px 14px',
  backgroundColor: '#fffbeb',
  borderRadius: '14px',
  border: '1.5px dashed #f59e0b',
  textAlign: 'center',
  margin: '14px 0',
}

const couponTag: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 800,
  color: '#b45309',
  letterSpacing: '0.8px',
}

const couponTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#78350f',
  margin: '4px 0 2px 0',
}

const couponDesc: React.CSSProperties = {
  fontSize: '11px',
  color: '#92400e',
  margin: '0 0 8px 0',
}

const couponCodeBox: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#ffffff',
  border: '1.5px solid #f59e0b',
  borderRadius: '8px',
  padding: '6px 18px',
  fontSize: '14px',
  fontWeight: 900,
  fontFamily: 'monospace',
  color: '#b45309',
  letterSpacing: '1.5px',
}

const relatedCard: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px 14px',
  marginBottom: '8px',
}

const relatedBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '9px',
  fontWeight: 700,
  color: '#b45309',
  backgroundColor: '#fef3c7',
  padding: '2px 6px',
  borderRadius: '4px',
  marginBottom: '2px',
}

const relatedTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#1e293b',
  margin: '0 0 2px 0',
  lineHeight: '17px',
}

const relatedPrice: React.CSSProperties = {
  fontSize: '11px',
  color: '#ef4444',
  fontWeight: 700,
  margin: '0',
}

const secondaryButton: React.CSSProperties = {
  backgroundColor: '#09090b',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 700,
  padding: '7px 12px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
  whiteSpace: 'nowrap' as const,
}

const supportBox: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '16px 14px',
  backgroundColor: '#f0fdf4',
  borderRadius: '14px',
  border: '1px solid #bbf7d0',
  textAlign: 'center',
  margin: '14px 0 6px 0',
}

const supportTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: '#166534',
  margin: '0 0 4px 0',
}

const supportDesc: React.CSSProperties = {
  fontSize: '11px',
  color: '#15803d',
  lineHeight: '16px',
  margin: '0 0 10px 0',
}

const whatsappButton: React.CSSProperties = {
  backgroundColor: '#25D366',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 800,
  padding: '9px 16px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}

const footer: React.CSSProperties = {
  backgroundColor: '#09090b',
  padding: '20px',
  textAlign: 'center',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const hr: React.CSSProperties = {
  borderColor: '#27272a',
  margin: '0 0 14px 0',
}

const footerBrand: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 700,
  margin: '0 0 4px 0',
}

const footerText: React.CSSProperties = {
  color: '#71717a',
  fontSize: '10px',
  lineHeight: '15px',
  margin: '0 0 10px 0',
}

const footerLinks: React.CSSProperties = {
  fontSize: '10px',
  color: '#a1a1aa',
  margin: '0 0 10px 0',
}

const footerLink: React.CSSProperties = {
  color: '#ef4444',
  textDecoration: 'none',
}

const footerCopy: React.CSSProperties = {
  color: '#52525b',
  fontSize: '9px',
  margin: '0',
}
