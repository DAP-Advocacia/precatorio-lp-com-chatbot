import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { lead, clientSessionId } = await request.json();

    if (!lead?.nome || !lead?.cpf || !lead?.celular) {
      return NextResponse.json({ error: 'Dados de lead incompletos' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sessionKey = clientSessionId || `lp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .upsert(
        {
          client_session_id: sessionKey,
          source: 'home',
          lead_nome: lead.nome,
          lead_cpf: lead.cpf,
          lead_telefone: lead.celular,
          resultado: 'lead_qualificado',
        },
        { onConflict: 'client_session_id' }
      )
      .select('id')
      .single();

    if (error) throw error;

    // Estado (UF) do processo não tem coluna dedicada em chat_sessions; registrado
    // como evento para não exigir migração de schema compartilhado com outros sistemas.
    await supabase.from('integration_events').insert({
      session_id: session.id,
      service: 'infosimples',
      operation: 'lead.captured',
      status: 'success',
      request_summary: { estado: lead.estado ?? null },
    });

    // PENDÊNCIA: enriquecimento via API própria (CPF/Nome/Estado) ainda não integrado.
    // Quando os detalhes da API (URL, auth, formato) forem definidos, chamar aqui,
    // registrar o resultado em integration_events (service: 'infosimples') e
    // atualizar chat_sessions/bitrix_deal_id conforme o retorno.

    // Bitrix: este protótipo NÃO grava em bitrix_retry_queue. O projeto irmão
    // (Premium Office/precatorio-lp) já possui o processador real dessa fila
    // (lib/bitrixLead.ts) consumindo o mesmo Supabase — gravar aqui duplicaria
    // criação de card/lead em produção a partir de um ambiente de protótipo.
    // Payload simulado no formato real (LeadPayload), só logado para inspeção:
    const simulatedBitrixPayload = {
      nomeCompleto: lead.nome,
      cpf: lead.cpf,
      telefone: lead.celular,
      estado: lead.estado ?? undefined,
      persona: 'autor' as const,
      utms: {},
    };
    console.info('[bitrix:lead.create:SIMULADO] payload que seria enfileirado:', simulatedBitrixPayload);

    return NextResponse.json({ ok: true, sessionId: session.id, clientSessionId: sessionKey });
  } catch (error: any) {
    console.error('Erro na rota /api/lead:', error);
    return NextResponse.json({ error: 'Falha ao registrar lead' }, { status: 500 });
  }
}
