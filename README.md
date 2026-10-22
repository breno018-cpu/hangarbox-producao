# Hangar Box — Séries, Livros & Mais

Plataforma de comércio eletrônico para séries, livros e conteúdos digitais exclusivos com integração ao Mercado Pago (PIX e cartão) e Supabase.

## 🚀 Tecnologias

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Lucide Icons
- **Backend / Database**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Pagamentos**: Mercado Pago (Checkout transparente / PIX)
- **E-mails**: Resend

## 📦 Como executar localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure as variáveis de ambiente:**
   Crie ou edite o arquivo `.env`:
   ```env
   VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-anon"
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Build para produção:**
   ```bash
   npm run build
   ```

## 🛠️ Scripts disponíveis

- `npm run dev`: Inicia o servidor Vite local
- `npm run build`: Gera o build otimizado para produção
- `npm run lint`: Executa verificação do ESLint
- `npm run preview`: Visualiza o build de produção localmente
- `npm test`: Executa os testes automatizados com Vitest


<!-- Vercel Deployment Trigger: 2026-10-22T00:14:05.887Z -->
