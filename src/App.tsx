import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, CheckCheck, ChevronDown, CircleHelp, LoaderCircle, LockKeyhole,
  MessageCircle, MoreHorizontal, Paperclip, Plus, Search, Send, Settings2, ShieldCheck,
  Smartphone, Smile, X,
} from 'lucide-react';
import { createGreenApi, GreenApiConfig, isSupportedPhone, normalizePhone } from './api';

type Message = {
  id: string;
  text: string;
  direction: 'in' | 'out';
  time: number;
  pending?: boolean;
};
type Conversation = {
  chatId: string;
  phone: string;
  name: string;
  messages: Message[];
  updatedAt: number;
};

const defaultApiUrl = '';
const initialConfig: GreenApiConfig = { apiUrl: defaultApiUrl, idInstance: '', apiTokenInstance: '' };

function formatTime(time: number) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(time);
}

function shortPhone(phone: string) {
  if (phone.startsWith('7') && phone.length === 11) return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  if (phone.startsWith('375') && phone.length === 12) return `+375 ${phone.slice(3, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`;
  return phone ? `+${phone}` : 'Новый чат';
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2) || 'M').toUpperCase();
}

function App() {
  const [config, setConfig] = useState<GreenApiConfig>(initialConfig);
  const [formConfig, setFormConfig] = useState<GreenApiConfig>(initialConfig);
  const [connected, setConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [phone, setPhone] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const api = useMemo(() => connected ? createGreenApi(config) : null, [connected, config]);
  const activeChat = conversations.find((conversation) => conversation.chatId === activeChatId) ?? null;
  const filteredConversations = conversations.filter((conversation) =>
    `${conversation.name} ${conversation.phone}`.toLowerCase().includes(search.toLowerCase()),
  );

  const appendIncoming = useCallback((chatId: string, text: string, time: number, messageId?: string, name?: string, incomingPhone?: string) => {
    if (!chatId || !text.trim()) return;
    setConversations((current) => {
      const found = current.find((conversation) => conversation.chatId === chatId);
      if (found?.messages.some((message) => messageId && message.id === messageId)) return current;
      const incomingMessage: Message = { id: messageId || `in-${time}-${Math.random()}`, text, direction: 'in', time };
      if (found) {
        return current.map((conversation) => conversation.chatId === chatId
          ? { ...conversation, messages: [...conversation.messages, incomingMessage], updatedAt: time }
          : conversation,
        ).sort((a, b) => b.updatedAt - a.updatedAt);
      }
      const newConversation: Conversation = {
        chatId,
        phone: incomingPhone || '',
        name: name || incomingPhone ? (name || shortPhone(incomingPhone || '')) : 'Контакт MAX',
        messages: [{ id: messageId || `in-${time}-${Math.random()}`, text, direction: 'in', time }],
        updatedAt: time,
      };
      return [newConversation, ...current];
    });
  }, []);

  useEffect(() => {
    if (!api || !connected) return;
    const controller = new AbortController();
    let stopped = false;
    const poll = async () => {
      while (!stopped) {
        try {
          const notification = await api.receiveNotification(controller.signal);
          if (!notification) continue;
          const body = notification.body;
          if (body?.typeWebhook === 'incomingMessageReceived' && body.messageData?.typeMessage === 'textMessage') {
            const text = body.messageData.textMessageData?.textMessage || '';
            const sender = body.senderData;
            if (sender?.chatId) {
              const senderPhone = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : '';
              appendIncoming(sender.chatId, text, (body.timestamp || Date.now() / 1000) * 1000, body.idMessage, sender.chatName || sender.senderName, senderPhone);
            }
          }
          if (notification.receiptId !== undefined && notification.receiptId !== null) {
            await api.deleteNotification(notification.receiptId);
          }
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          setNotice({ text: error instanceof Error ? error.message : 'Не удалось получить сообщения.', kind: 'error' });
          await new Promise((resolve) => window.setTimeout(resolve, 3500));
        }
      }
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [api, connected, appendIncoming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeChat?.messages.length]);

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    const cleanUrl = formConfig.apiUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setNotice({ text: 'Укажите полный адрес API, например https://1103.api.green-api.com', kind: 'error' });
      return;
    }
    if (!formConfig.idInstance.trim() || !formConfig.apiTokenInstance.trim()) {
      setNotice({ text: 'Заполните idInstance и apiTokenInstance из личного кабинета GREEN-API.', kind: 'error' });
      return;
    }
    setConnecting(true);
    setNotice(null);
    try {
      const candidate = { ...formConfig, apiUrl: cleanUrl };
      const state = await createGreenApi(candidate).getStateInstance();
      if (state.stateInstance !== 'authorized') {
        throw new Error(`Инстанс не авторизован (статус: ${state.stateInstance || 'неизвестен'}). Проверьте подключение аккаунта MAX в GREEN-API.`);
      }
      setConfig(candidate);
      setFormConfig(candidate);
      setConnected(true);
      setSettingsOpen(false);
      setNotice({ text: 'GREEN-API подключён. Теперь создайте чат по номеру телефона.', kind: 'success' });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Не удалось подключить GREEN-API.', kind: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  const handleCreateChat = async (event: FormEvent) => {
    event.preventDefault();
    if (!api || !connected) {
      setSettingsOpen(true);
      setNotice({ text: 'Сначала подключите GREEN-API.', kind: 'error' });
      return;
    }
    const cleanPhone = normalizePhone(phone);
    if (!isSupportedPhone(cleanPhone)) {
      setNotice({ text: 'Введите номер MAX в международном формате: +7XXXXXXXXXX или +375XXXXXXXXX.', kind: 'error' });
      return;
    }
    setCreatingChat(true);
    setNotice(null);
    try {
      const result = await api.checkAccount(cleanPhone);
      if (result.status === false) throw new Error(result.reason || 'Инстанс не готов. Проверьте авторизацию в GREEN-API.');
      if (!result.exist || !result.chatId) throw new Error('Аккаунт MAX по этому номеру не найден. Проверьте номер и повторите попытку.');
      const name = shortPhone(cleanPhone);
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.chatId === result.chatId);
        if (existing) return current.map((conversation) => conversation.chatId === result.chatId ? { ...conversation, phone: cleanPhone, name } : conversation);
        return [{ chatId: result.chatId!, phone: cleanPhone, name, messages: [], updatedAt: Date.now() }, ...current];
      });
      setActiveChatId(result.chatId);
      setPhone('');
      setNotice({ text: 'Чат создан. Можно отправлять текстовое сообщение.', kind: 'success' });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Не удалось создать чат.', kind: 'error' });
    } finally {
      setCreatingChat(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeChat || !api || sending) return;
    if (text.length > 4000) {
      setNotice({ text: 'Максимальная длина сообщения — 4000 символов.', kind: 'error' });
      return;
    }
    setSending(true);
    setDraft('');
    const localId = `local-${Date.now()}`;
    const sentAt = Date.now();
    const outgoingMessage: Message = { id: localId, text, direction: 'out', time: sentAt, pending: true };
    setConversations((current) => current.map((conversation) => conversation.chatId === activeChat.chatId
      ? { ...conversation, messages: [...conversation.messages, outgoingMessage], updatedAt: sentAt }
      : conversation,
    ).sort((a, b) => b.updatedAt - a.updatedAt));
    setNotice(null);
    try {
      const result = await api.sendMessage(activeChat.chatId, text);
      setConversations((current) => current.map((conversation) => conversation.chatId === activeChat.chatId
        ? { ...conversation, messages: conversation.messages.map((message) => message.id === localId ? { ...message, id: result.idMessage || localId, pending: false } : message) }
        : conversation,
      ));
    } catch (error) {
      setConversations((current) => current.map((conversation) => conversation.chatId === activeChat.chatId
        ? { ...conversation, messages: conversation.messages.filter((message) => message.id !== localId) }
        : conversation,
      ));
      setDraft(text);
      setNotice({ text: error instanceof Error ? error.message : 'Не удалось отправить сообщение.', kind: 'error' });
    } finally {
      setSending(false);
      draftRef.current?.focus();
    }
  };

  const handleComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Основная навигация">
        <div className="brand-mark"><MessageCircle size={22} strokeWidth={2.5} /></div>
        <button className="rail-button active" aria-label="Чаты"><MessageCircle size={21} /></button>
        <button className="rail-button" aria-label="Контакты" onClick={() => setNotice({ text: 'В этом тестовом интерфейсе доступен только обмен сообщениями.', kind: 'success' })}><Smartphone size={20} /></button>
        <div className="rail-spacer" />
        <button className="rail-button" aria-label="Настройки" onClick={() => setSettingsOpen(true)}><Settings2 size={20} /></button>
        <div className="rail-avatar">M</div>
      </aside>

      <section className="inbox-panel">
        <div className="inbox-top">
          <div>
            <div className="eyebrow">ЛИЧНЫЕ СООБЩЕНИЯ</div>
            <h1>Чаты <span>{conversations.length || ''}</span></h1>
          </div>
          <button className="icon-button create-button" title="Новый чат" onClick={() => document.getElementById('new-phone')?.focus()}><Plus size={19} /></button>
        </div>
        <form className="new-chat-form" onSubmit={handleCreateChat}>
          <div className="new-chat-label"><span className="online-dot" />Новый чат</div>
          <div className="phone-row">
            <input id="new-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Номер телефона" inputMode="tel" aria-label="Номер телефона получателя" />
            <button className="mini-send" type="submit" disabled={creatingChat || !connected} title="Проверить номер и открыть чат">
              {creatingChat ? <LoaderCircle className="spin" size={16} /> : <ArrowLeft className="send-arrow" size={16} />}
            </button>
          </div>
          <p className="form-hint">Международный формат: +7 или +375</p>
        </form>
        <div className="list-search"><Search size={16} /><input aria-label="Поиск по чатам" placeholder="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
        <div className="section-caption">ВСЕ СООБЩЕНИЯ <ChevronDown size={13} /></div>
        <div className="conversation-list">
          {filteredConversations.length ? filteredConversations.map((conversation) => {
            const last = conversation.messages[conversation.messages.length - 1];
            return (
              <button key={conversation.chatId} className={`conversation-item ${activeChatId === conversation.chatId ? 'selected' : ''}`} onClick={() => setActiveChatId(conversation.chatId)}>
                <div className="contact-avatar">{initials(conversation.name)}</div>
                <div className="conversation-copy">
                  <div className="conversation-heading"><strong>{conversation.name}</strong><time>{last ? formatTime(last.time) : ''}</time></div>
                  <div className="last-message">{last?.direction === 'out' && <CheckCheck size={14} className="read-tick" />}{last?.text || conversation.phone}</div>
                </div>
              </button>
            );
          }) : <div className="empty-list"><div className="empty-icon"><MessageCircle size={22} /></div><strong>{search ? 'Ничего не найдено' : 'Пока нет чатов'}</strong><span>{search ? 'Измените запрос поиска' : 'Введите номер выше, чтобы начать диалог'}</span></div>}
        </div>
        <button className="connection-card" onClick={() => setSettingsOpen(true)}>
          <span className={`connection-icon ${connected ? 'connected' : ''}`}><ShieldCheck size={17} /></span>
          <span className="connection-copy"><strong>{connected ? 'GREEN-API подключён' : 'Подключить GREEN-API'}</strong><small>{connected ? 'Ключи хранятся только в памяти' : 'Нужны данные инстанса'}</small></span>
          <MoreHorizontal size={18} className="connection-more" />
        </button>
      </section>

      <section className="chat-panel">
        {activeChat ? <>
          <header className="chat-header">
            <button className="mobile-back icon-button" onClick={() => setActiveChatId(null)} aria-label="Назад к чатам"><ArrowLeft size={18} /></button>
            <div className="contact-avatar header-avatar">{initials(activeChat.name)}</div>
            <div className="chat-person"><strong>{activeChat.name}</strong><span><i />MAX · личный чат</span></div>
            <div className="header-actions"><button className="icon-button" aria-label="Информация" onClick={() => setNotice({ text: `chatId: ${activeChat.chatId}`, kind: 'success' })}><CircleHelp size={19} /></button><button className="icon-button" aria-label="Дополнительно"><MoreHorizontal size={21} /></button></div>
          </header>
          <div className="message-area">
            <div className="date-divider"><span>Сегодня</span></div>
            {!activeChat.messages.length && <div className="chat-start"><div className="chat-start-avatar">{initials(activeChat.name)}</div><strong>{activeChat.name}</strong><span>Это начало вашей переписки</span><div className="secure-note"><LockKeyhole size={13} />Сообщения проходят через GREEN-API</div></div>}
            {activeChat.messages.map((message) => (
              <div key={message.id} className={`message-row ${message.direction === 'out' ? 'outgoing' : 'incoming'}`}>
                <div className="message-bubble"><p>{message.text}</p><div className="message-meta"><time>{formatTime(message.time)}</time>{message.direction === 'out' && (message.pending ? <Check size={13} className="pending-tick" /> : <CheckCheck size={14} className="message-tick" />)}</div></div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="composer-wrap">
            <div className="composer">
              <button className="composer-tool" title="Вложения отключены: поддерживается только текст" disabled><Paperclip size={19} /></button>
              <textarea ref={draftRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKey} placeholder="Напишите сообщение..." rows={1} maxLength={4000} aria-label="Текст сообщения" />
              <span className="char-count">{draft.length > 3500 ? `${draft.length}/4000` : ''}</span>
              <button className="composer-tool smile-tool" title="Поддерживаются только текстовые сообщения" disabled><Smile size={19} /></button>
              <button className="send-button" onClick={() => void handleSend()} disabled={!draft.trim() || sending} aria-label="Отправить сообщение">{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={17} />}</button>
            </div>
            <div className="composer-caption">Enter — отправить <span>·</span> Shift + Enter — новая строка</div>
          </div>
        </> : <div className="welcome-state">
          <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
          <div className="welcome-logo"><MessageCircle size={36} strokeWidth={2} /></div>
          <div className="welcome-kicker">ВАШИ СООБЩЕНИЯ MAX</div>
          <h2>Диалог начинается<br />с одного сообщения</h2>
          <p>Подключите GREEN-API, укажите номер телефона<br />и продолжите общение здесь.</p>
          <button className="welcome-action" onClick={() => setSettingsOpen(true)}>{connected ? 'Создать новый чат' : 'Подключить аккаунт'}<ArrowLeft size={16} /></button>
          <div className="welcome-foot"><LockKeyhole size={13} />Ключи доступа не сохраняются</div>
        </div>}
        {notice && <div className={`toast ${notice.kind}`} role="status"><span>{notice.kind === 'error' ? <X size={16} /> : <Check size={16} />}</span><p>{notice.text}</p><button onClick={() => setNotice(null)} aria-label="Закрыть уведомление"><X size={15} /></button></div>}
      </section>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-heading"><div className="modal-icon"><ShieldCheck size={21} /></div><button className="icon-button close-modal" onClick={() => setSettingsOpen(false)} aria-label="Закрыть"><X size={19} /></button></div>
          <div className="modal-kicker">БЕЗОПАСНОЕ ПОДКЛЮЧЕНИЕ</div>
          <h2 id="settings-title">Подключить GREEN-API</h2>
          <p className="modal-description">Данные инстанса доступны в личном кабинете GREEN-API. Они используются только в этом окне браузера.</p>
          <form className="settings-form" onSubmit={handleConnect}>
            <label>Адрес API <span>из настроек инстанса</span><input type="url" value={formConfig.apiUrl} onChange={(event) => setFormConfig({ ...formConfig, apiUrl: event.target.value })} placeholder="https://1103.api.green-api.com" autoComplete="url" required /></label>
            <label>idInstance<input value={formConfig.idInstance} onChange={(event) => setFormConfig({ ...formConfig, idInstance: event.target.value })} placeholder="Например, 1101000001" autoComplete="off" required /></label>
            <label>apiTokenInstance<input type="password" value={formConfig.apiTokenInstance} onChange={(event) => setFormConfig({ ...formConfig, apiTokenInstance: event.target.value })} placeholder="Ключ доступа инстанса" autoComplete="new-password" required /></label>
            <div className="privacy-note"><LockKeyhole size={14} /><span>Не отправляем ключи на сторонний сервер и не сохраняем их в localStorage.</span></div>
            <button className="connect-button" type="submit" disabled={connecting}>{connecting ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{connected ? 'Сохранить и подключиться' : 'Подключиться'}</button>
          </form>
          <a className="console-link" href="https://console.green-api.com/" target="_blank" rel="noreferrer">Открыть личный кабинет GREEN-API <ArrowLeft size={14} /></a>
        </section>
      </div>}
      <div className="disclaimer"><span className="online-dot" />Только текстовые сообщения <span>·</span> GREEN-API</div>
    </main>
  );
}

export default App;
