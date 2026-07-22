"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Send, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ChatMode = "admin" | "worker" | "customer";
type ProfileRole = "admin" | "worker" | "customer";
type ConversationType = "customer_worker" | "admin_worker" | "admin_customer";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: ProfileRole;
};

type Participant = ProfileRow & {
  subtitle?: string;
};

type PresenceMeta = {
  profile_id?: string;
  full_name?: string | null;
  role?: ProfileRole;
  online_at?: string;
};

type ConversationRow = {
  id: string;
  type: ConversationType;
  customer_id: string | null;
  worker_id: string | null;
  admin_id: string | null;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type LocalChatStore = {
  conversations: ConversationRow[];
  messages: MessageRow[];
};

type CustomerJobRow = {
  customer?: ProfileRow | ProfileRow[] | null;
};

type WorkerJobRow = {
  worker?: { profiles?: ProfileRow | ProfileRow[] | null } | { profiles?: ProfileRow | ProfileRow[] | null }[] | null;
};

const modeCopy: Record<ChatMode, { title: string; description: string; empty: string }> = {
  admin: {
    title: "Tin nhắn",
    description: "Admin chat trực tiếp với thợ và khách hàng.",
    empty: "Chọn thợ hoặc khách hàng để bắt đầu trao đổi.",
  },
  worker: {
    title: "Chat",
    description: "Trao đổi với admin hoặc khách hàng đã có công việc.",
    empty: "Chọn admin hoặc khách hàng để nhắn tin.",
  },
  customer: {
    title: "Chat",
    description: "Trao đổi với admin hoặc thợ phụ trách công việc của bạn.",
    empty: "Chọn admin hoặc thợ để nhắn tin.",
  },
};

const LOCAL_CHAT_STORAGE_KEY = "alotho.local-chat.v1";

function getDisplayName(profile?: Pick<ProfileRow, "full_name" | "email" | "phone"> | null) {
  return profile?.full_name || profile?.phone || profile?.email || "Người dùng";
}

function getRoleLabel(role: ProfileRole) {
  if (role === "admin") return "Admin";
  if (role === "worker") return "Thợ";
  return "Khách hàng";
}

function getOnlineLabel(isOnline: boolean) {
  return isOnline ? "Đang online" : "Offline";
}

function buildPresenceIds(state: Record<string, PresenceMeta[]>) {
  return new Set(
    Object.entries(state)
      .filter(([, metas]) => metas.length > 0)
      .map(([key, metas]) => metas[0]?.profile_id || key)
  );
}

function getConversationType(currentRole: ProfileRole, participantRole: ProfileRole): ConversationType | null {
  if (currentRole === "admin" && participantRole === "worker") return "admin_worker";
  if (currentRole === "admin" && participantRole === "customer") return "admin_customer";
  if (currentRole === "worker" && participantRole === "admin") return "admin_worker";
  if (currentRole === "customer" && participantRole === "admin") return "admin_customer";
  if (
    (currentRole === "worker" && participantRole === "customer") ||
    (currentRole === "customer" && participantRole === "worker")
  ) {
    return "customer_worker";
  }
  return null;
}

function buildConversationPayload(currentUser: ProfileRow, participant: Participant) {
  const type = getConversationType(currentUser.role, participant.role);
  if (!type) return null;

  const payload: {
    type: ConversationType;
    customer_id?: string;
    worker_id?: string;
    admin_id?: string;
  } = { type };

  if (currentUser.role === "admin") payload.admin_id = currentUser.id;
  if (currentUser.role === "worker") payload.worker_id = currentUser.id;
  if (currentUser.role === "customer") payload.customer_id = currentUser.id;

  if (participant.role === "admin") payload.admin_id = participant.id;
  if (participant.role === "worker") payload.worker_id = participant.id;
  if (participant.role === "customer") payload.customer_id = participant.id;

  return payload;
}

function conversationMatchesParticipant(conversation: ConversationRow, currentUser: ProfileRow, participant: Participant) {
  const payload = buildConversationPayload(currentUser, participant);
  if (!payload || conversation.type !== payload.type) return false;
  return (
    (payload.admin_id ? conversation.admin_id === payload.admin_id : conversation.admin_id === null) &&
    (payload.worker_id ? conversation.worker_id === payload.worker_id : conversation.worker_id === null) &&
    (payload.customer_id ? conversation.customer_id === payload.customer_id : conversation.customer_id === null)
  );
}

function uniqueParticipants(participants: Participant[]) {
  const map = new Map<string, Participant>();
  participants.forEach((participant) => {
    if (!map.has(participant.id)) map.set(participant.id, participant);
  });
  return Array.from(map.values()).sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), "vi"));
}

function isMissingChatTables(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message || "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("conversations") || message.includes("chat_messages");
}

function readLocalChatStore(): LocalChatStore {
  if (typeof window === "undefined") return { conversations: [], messages: [] };

  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (!raw) return { conversations: [], messages: [] };
    const parsed = JSON.parse(raw) as Partial<LocalChatStore>;
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { conversations: [], messages: [] };
  }
}

function writeLocalChatStore(store: LocalChatStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(store));
}

function getLocalConversationId(payload: NonNullable<ReturnType<typeof buildConversationPayload>>) {
  return [
    "local",
    payload.type,
    payload.admin_id || "none",
    payload.worker_id || "none",
    payload.customer_id || "none",
  ].join(":");
}

function getLocalConversationsForProfile(profileId: string) {
  const store = readLocalChatStore();
  return store.conversations
    .filter((conversation) => (
      conversation.admin_id === profileId ||
      conversation.worker_id === profileId ||
      conversation.customer_id === profileId
    ))
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
}

function getOrCreateLocalConversation(payload: NonNullable<ReturnType<typeof buildConversationPayload>>) {
  const store = readLocalChatStore();
  const id = getLocalConversationId(payload);
  const existing = store.conversations.find((conversation) => conversation.id === id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const conversation: ConversationRow = {
    id,
    type: payload.type,
    admin_id: payload.admin_id || null,
    worker_id: payload.worker_id || null,
    customer_id: payload.customer_id || null,
    updated_at: now,
  };

  writeLocalChatStore({
    ...store,
    conversations: [conversation, ...store.conversations],
  });

  return conversation;
}

export default function ChatWorkspace({ mode }: { mode: ChatMode }) {
  const supabase = useMemo(() => createClient(), []);
  const [currentUser, setCurrentUser] = useState<ProfileRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeRole, setActiveRole] = useState<"all" | "worker" | "customer">("all");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [activeConversation, setActiveConversation] = useState<ConversationRow | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [onlineProfileIds, setOnlineProfileIds] = useState<Set<string>>(new Set());
  const [presenceNotice, setPresenceNotice] = useState("");
  const previousOnlineProfileIdsRef = useRef<Set<string>>(new Set());

  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) || null;
  const filteredParticipants = participants.filter((participant) => activeRole === "all" || participant.role === activeRole);
  const onlineParticipantCount = participants.filter((participant) => onlineProfileIds.has(participant.id)).length;

  const fetchConversations = async (profileId: string) => {
    const { data, error: conversationsError } = await supabase
      .from("conversations")
      .select("*")
      .or(`customer_id.eq.${profileId},worker_id.eq.${profileId},admin_id.eq.${profileId}`)
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      if (isMissingChatTables(conversationsError)) {
        setMigrationNeeded(true);
        return getLocalConversationsForProfile(profileId);
      }
      else setError("Không thể tải cuộc trò chuyện: " + conversationsError.message);
      return [];
    }

    return (data || []) as ConversationRow[];
  };

  const fetchParticipants = async (profile: ProfileRow) => {
    if (mode === "admin") {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role")
        .in("role", ["worker", "customer"])
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;
      return uniqueParticipants((data || []) as Participant[]);
    }

    const participantRows: Participant[] = [];

    const { data: admins, error: adminError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .eq("role", "admin");

    if (!adminError) {
      participantRows.push(
        ...((admins || []) as ProfileRow[]).map((admin) => ({
          ...admin,
          subtitle: "Hỗ trợ từ hệ thống",
        }))
      );
    }

    if (mode === "worker") {
      const { data: workerRecord } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", profile.id)
        .single();

      if (workerRecord?.id) {
        const { data: jobs } = await supabase
          .from("jobs")
          .select("customer:profiles!customer_id(id, full_name, email, phone, role)")
          .eq("worker_id", workerRecord.id);

        ((jobs || []) as CustomerJobRow[]).forEach((job) => {
          const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
          if (customer) participantRows.push({ ...customer, subtitle: "Khách hàng đã có job" });
        });
      }
    }

    if (mode === "customer") {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("worker:workers(user_id, profiles(id, full_name, email, phone, role))")
        .eq("customer_id", profile.id)
        .not("worker_id", "is", null);

      ((jobs || []) as WorkerJobRow[]).forEach((job) => {
        const worker = Array.isArray(job.worker) ? job.worker[0] : job.worker;
        const profileRow = Array.isArray(worker?.profiles) ? worker?.profiles[0] : worker?.profiles;
        if (profileRow) participantRows.push({ ...profileRow, subtitle: "Thợ phụ trách job" });
      });
    }

    return uniqueParticipants(participantRows);
  };

  const bootstrap = async () => {
    setLoading(true);
    setError("");
    setMigrationNeeded(false);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setError("Bạn cần đăng nhập để sử dụng chat.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        setError("Không thể tải hồ sơ người dùng.");
        return;
      }

      const typedProfile = profile as ProfileRow;
      setCurrentUser(typedProfile);

      const [nextParticipants, nextConversations] = await Promise.all([
        fetchParticipants(typedProfile),
        fetchConversations(typedProfile.id),
      ]);

      setParticipants(nextParticipants);
      setConversations(nextConversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu chat.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    setError("");

    if (migrationNeeded || conversationId.startsWith("local:")) {
      const store = readLocalChatStore();
      setMessages(store.messages.filter((message) => message.conversation_id === conversationId));
      setLoadingMessages(false);
      return;
    }

    const { data, error: messagesError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      if (isMissingChatTables(messagesError)) setMigrationNeeded(true);
      else setError("Không thể tải tin nhắn: " + messagesError.message);
      setMessages([]);
    } else {
      setMessages((data || []) as MessageRow[]);
    }

    setLoadingMessages(false);
  };

  const openConversation = async (participant: Participant): Promise<ConversationRow | null> => {
    if (!currentUser) return null;
    setSelectedParticipantId(participant.id);
    setActiveConversation(null);
    setMessages([]);
    setError("");

    const existing = conversations.find((conversation) => conversationMatchesParticipant(conversation, currentUser, participant));
    if (existing) {
      setActiveConversation(existing);
      loadMessages(existing.id);
      return existing;
    }

    const payload = buildConversationPayload(currentUser, participant);
    if (!payload) {
      setError("Chưa hỗ trợ kiểu chat này.");
      return null;
    }

    if (migrationNeeded) {
      const localConversation = getOrCreateLocalConversation(payload);
      setConversations(getLocalConversationsForProfile(currentUser.id));
      setActiveConversation(localConversation);
      loadMessages(localConversation.id);
      return localConversation;
    }

    const { data, error: createError } = await supabase
      .from("conversations")
      .insert(payload)
      .select("*")
      .single();

    if (createError) {
      if (isMissingChatTables(createError)) {
        setMigrationNeeded(true);
        const localConversation = getOrCreateLocalConversation(payload);
        setConversations(getLocalConversationsForProfile(currentUser.id));
        setActiveConversation(localConversation);
        loadMessages(localConversation.id);
        return localConversation;
      }
      setError("Không thể tạo cuộc trò chuyện: " + createError.message);
      return null;
    }

    const createdConversation = data as ConversationRow;
    setConversations((prev) => [createdConversation, ...prev]);
    setActiveConversation(createdConversation);
    setMessages([]);
    return createdConversation;
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !selectedParticipant || !draft.trim() || sending) return;

    let conversation =
      activeConversation && conversationMatchesParticipant(activeConversation, currentUser, selectedParticipant)
        ? activeConversation
        : null;
    if (!conversation) {
      conversation = await openConversation(selectedParticipant);
    }

    if (!conversation) return;

    const body = draft.trim();
    setSending(true);
    setDraft("");

    if (migrationNeeded || conversation.id.startsWith("local:")) {
      const store = readLocalChatStore();
      const now = new Date().toISOString();
      const message: MessageRow = {
        id: `local-message:${now}:${store.messages.length}`,
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        body,
        created_at: now,
      };
      const nextConversations = store.conversations.map((item) =>
        item.id === conversation.id ? { ...item, updated_at: now } : item
      );
      writeLocalChatStore({
        conversations: nextConversations,
        messages: [...store.messages, message],
      });
      setMessages((prev) => [...prev, message]);
      setConversations(getLocalConversationsForProfile(currentUser.id));
      setSending(false);
      return;
    }

    const { data, error: sendError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        body,
      })
      .select("*")
      .single();

    if (sendError) {
      setDraft(body);
      setError("Không thể gửi tin nhắn: " + sendError.message);
    } else if (data) {
      setMessages((prev) => [...prev, data as MessageRow]);
      const refreshed = await fetchConversations(currentUser.id);
      setConversations(refreshed);
    }

    setSending(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeConversation?.id) return;

    const interval = window.setInterval(() => {
      loadMessages(activeConversation.id);
    }, 6000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel("chat-online-users", {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const nextOnlineProfileIds = buildPresenceIds(channel.presenceState() as Record<string, PresenceMeta[]>);
      const previousOnlineProfileIds = previousOnlineProfileIdsRef.current;
      const newlyOnline = participants.find(
        (participant) => nextOnlineProfileIds.has(participant.id) && !previousOnlineProfileIds.has(participant.id)
      );

      setOnlineProfileIds(nextOnlineProfileIds);
      previousOnlineProfileIdsRef.current = nextOnlineProfileIds;

      if (newlyOnline) {
        setPresenceNotice(`${getDisplayName(newlyOnline)} đang online, bạn có thể chat ngay.`);
        window.setTimeout(() => setPresenceNotice(""), 5000);
      }
    });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;

      await channel.track({
        profile_id: currentUser.id,
        full_name: currentUser.full_name,
        role: currentUser.role,
        online_at: new Date().toISOString(),
      } satisfies PresenceMeta);
    });

    return () => {
      setOnlineProfileIds(new Set());
      previousOnlineProfileIdsRef.current = new Set();
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [currentUser, participants, supabase]);

  return (
    <div className="min-h-[calc(100dvh-5rem)] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-container">
            <MessageCircle size={24} />
            <h1 className="text-2xl font-extrabold text-on-surface">{modeCopy[mode].title}</h1>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{modeCopy[mode].description}</p>
        </div>
        <button
          onClick={bootstrap}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <RefreshCw size={16} />
          {onlineParticipantCount > 0 ? `${onlineParticipantCount} online` : "Làm mới"}
        </button>
      </div>

      {presenceNotice && (
        <div className="mb-4 rounded-lg border border-success-container bg-success-container/60 p-4 text-sm font-semibold text-success">
          {presenceNotice}
        </div>
      )}

      {migrationNeeded && (
        <div className="mb-4 rounded-lg border border-warning-container bg-warning-container/70 p-4 text-sm font-semibold text-warning">
          Database chưa có bảng chat, nên hệ thống đang dùng chế độ chat tạm trên trình duyệt để chạy thử. Muốn chat thật giữa nhiều máy/tài khoản, hãy chạy file migration `supabase/migration_chat.sql`.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-error-container bg-error-container/70 p-4 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <div className="grid min-h-[680px] overflow-hidden rounded-lg border border-outline-variant bg-white shadow-card lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-outline-variant bg-surface-container-lowest lg:border-b-0 lg:border-r">
          {mode === "admin" && (
            <div className="grid grid-cols-2 gap-2 border-b border-outline-variant p-3">
              <button
                onClick={() => setActiveRole("worker")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${activeRole === "worker" ? "bg-primary-container text-white" : "bg-white text-on-surface-variant"}`}
              >
                Thợ
              </button>
              <button
                onClick={() => setActiveRole("customer")}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${activeRole === "customer" ? "bg-primary-container text-white" : "bg-white text-on-surface-variant"}`}
              >
                Khách hàng
              </button>
            </div>
          )}

          <div className="max-h-[280px] overflow-y-auto p-3 lg:max-h-[680px]">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-container" />
                ))}
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">
                Chưa có người để chat.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredParticipants.map((participant) => {
                  const isActive = participant.id === selectedParticipantId;
                  const isOnline = onlineProfileIds.has(participant.id);
                  const participantConversation = currentUser
                    ? conversations.find((conversation) => conversationMatchesParticipant(conversation, currentUser, participant))
                    : null;

                  return (
                    <button
                      key={participant.id}
                      onClick={() => openConversation(participant)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        isActive
                          ? "border-primary-container bg-primary-fixed shadow-sm"
                          : "border-transparent bg-white hover:border-outline-variant hover:bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            participant.role === "admin"
                              ? "bg-primary-container text-white"
                              : participant.role === "worker"
                                ? "bg-success-container text-success"
                                : "bg-secondary-container text-white"
                          }`}>
                            {participant.role === "admin" ? <ShieldCheck size={19} /> : participant.role === "worker" ? <Wrench size={19} /> : <UserRound size={19} />}
                          </div>
                          <span
                            className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              isOnline ? "bg-success" : "bg-outline-variant"
                            }`}
                            aria-label={getOnlineLabel(isOnline)}
                            title={getOnlineLabel(isOnline)}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-extrabold text-on-surface">{getDisplayName(participant)}</div>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-semibold text-on-surface-variant">
                              {participant.subtitle || getRoleLabel(participant.role)}
                            </span>
                            <span className={`shrink-0 text-[11px] font-extrabold ${isOnline ? "text-success" : "text-on-surface-variant"}`}>
                              {getOnlineLabel(isOnline)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {participantConversation?.updated_at && (
                        <div className="mt-2 text-[11px] font-semibold text-on-surface-variant">
                          Cập nhật {new Date(participantConversation.updated_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col bg-linear-to-b from-white to-surface-container-lowest">
          {selectedParticipant ? (
            <>
              <div className="flex items-center gap-3 border-b border-outline-variant bg-white px-4 py-3">
                <div className="relative shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                    {selectedParticipant.role === "worker" ? <Wrench size={21} /> : selectedParticipant.role === "admin" ? <ShieldCheck size={21} /> : <UserRound size={21} />}
                  </div>
                  <span
                    className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                      onlineProfileIds.has(selectedParticipant.id) ? "bg-success" : "bg-outline-variant"
                    }`}
                    aria-label={getOnlineLabel(onlineProfileIds.has(selectedParticipant.id))}
                    title={getOnlineLabel(onlineProfileIds.has(selectedParticipant.id))}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-on-surface">{getDisplayName(selectedParticipant)}</h2>
                  <p className={`truncate text-xs font-semibold ${
                    onlineProfileIds.has(selectedParticipant.id) ? "text-success" : "text-on-surface-variant"
                  }`}>
                    {getRoleLabel(selectedParticipant.role)} - {getOnlineLabel(onlineProfileIds.has(selectedParticipant.id))}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="text-sm font-semibold text-on-surface-variant">Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto mb-3 text-on-surface-variant" size={34} />
                      <p className="text-sm font-semibold text-on-surface-variant">Chưa có tin nhắn. Gửi lời nhắn đầu tiên.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === currentUser?.id;
                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-lg px-4 py-2.5 shadow-sm ${
                          isMine
                            ? "rounded-br-md bg-primary-container text-white"
                            : "rounded-bl-md bg-white text-on-surface ring-1 ring-outline-variant"
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                          <div className={`mt-1 text-[10px] font-semibold ${isMine ? "text-white/70" : "text-on-surface-variant"}`}>
                            {new Date(message.created_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-outline-variant bg-white p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Nhập tin nhắn..."
                    rows={2}
                    className="input-field min-h-[48px] flex-1 resize-none !rounded-lg !py-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Gửi tin nhắn"
                  >
                    <Send size={19} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div>
                <MessageCircle className="mx-auto mb-3 text-on-surface-variant" size={42} />
                <h2 className="text-lg font-extrabold text-on-surface">Chọn cuộc trò chuyện</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{modeCopy[mode].empty}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
