import { NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getSupabaseAdmin } from '@/lib/supabase';

const SYSTEM_PROMPT =
  'Você é a IA especializada em precatórios da Premium Office, atuando como SDR. ' +
  'Seja educado, conciso e ajude o usuário a entender se faz sentido antecipar seu crédito, ' +
  'sempre com clareza, segurança jurídica e sem pressioná-lo a decidir.';

function toLangChainMessages(messages: { role: string; content: string }[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => (m.role === 'assistant' ? new AIMessage(m.content) : new HumanMessage(m.content)));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let sessionId: string | null = null;

  try {
    const { messages, clientSessionId } = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não está configurada no .env' }, { status: 500 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages vazio ou inválido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

    // Resolve a sessão para gravar a conversa; cria uma sessão anônima se o
    // chat ainda não passou pelo fluxo de captura de lead (/api/lead).
    if (clientSessionId) {
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('client_session_id', clientSessionId)
        .maybeSingle();

      if (existing) {
        sessionId = existing.id;
      } else {
        const { data: created, error: createError } = await supabase
          .from('chat_sessions')
          .insert({ client_session_id: clientSessionId, source: 'home' })
          .select('id')
          .single();
        if (!createError) sessionId = created.id;
      }
    }

    if (sessionId && lastUserMessage) {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: lastUserMessage.content,
        kind: 'text',
      });
    }

    const llm = new ChatOpenAI({ apiKey, model: 'gpt-4o-mini', temperature: 0.4 });
    const chain = [new SystemMessage(SYSTEM_PROMPT), ...toLangChainMessages(messages)];
    const response = await llm.invoke(chain);
    const aiText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    if (sessionId) {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiText,
        kind: 'text',
      });
    }

    await supabase.from('integration_events').insert({
      session_id: sessionId,
      service: 'openai',
      operation: 'chat.completion',
      status: 'success',
      latency_ms: Date.now() - startedAt,
      response_summary: { model: 'gpt-4o-mini' },
    });

    return NextResponse.json({ text: aiText, sessionId });
  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('integration_events').insert({
        session_id: sessionId,
        service: 'openai',
        operation: 'chat.completion',
        status: 'error',
        latency_ms: Date.now() - startedAt,
        error_message: String(error?.message ?? error),
      });
    } catch {
      // Falha ao registrar o próprio erro não deve mascarar a resposta de erro original.
    }
    return NextResponse.json({ error: 'Falha ao comunicar com a IA' }, { status: 500 });
  }
}
