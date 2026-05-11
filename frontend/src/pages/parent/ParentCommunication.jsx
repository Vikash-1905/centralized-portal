import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatDate } from "../../utils/schoolMetrics";
import { useParentDashboardData } from "./parentDashboardShared";
import {
  sendParentMessage,
  fetchParentMessages,
} from "../../services/schoolApi";

function IconChat({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconBell({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function IconSend({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconCheck({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconClock({ className = "h-3.5 w-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function formatMessageTime(isoDate) {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function ParentCommunication() {
  const { dashboard, loading, error } = useParentDashboardData();

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const parentId = dashboard?.parent?.id || "";
  const teachers = dashboard?.teachers || [];
  const notices = dashboard?.notices || [];
  const children = dashboard?.children || [];
  const firstChild = children[0] || null;

  const loadMessages = useCallback(async () => {
    if (!parentId) return;
    setMessagesLoading(true);
    try {
      const data = await fetchParentMessages(parentId);
      setMessages(data);
    } catch {
      // silent – messages not critical
    } finally {
      setMessagesLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    if (parentId) {
      void loadMessages();
    }
  }, [parentId, loadMessages]);

  const handleSend = async () => {
    if (!messageBody.trim()) return;

    const teacher = teachers.find((t) => t.id === selectedTeacher);
    if (!teacher) {
      setSendError("Please select a teacher.");
      return;
    }

    setSending(true);
    setSendError("");
    setSendSuccess(false);

    try {
      const newMsg = await sendParentMessage({
        parentId: dashboard.parent.id,
        parentName: dashboard.parent.name,
        teacherId: teacher.id,
        teacherName: teacher.name,
        childId: firstChild?.studentId || "",
        childName: firstChild?.name || "",
        subject: messageSubject.trim() || "General",
        body: messageBody.trim(),
      });

      setMessages((prev) => [newMsg, ...prev]);
      setMessageBody("");
      setMessageSubject("");
      setSendSuccess(true);

      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse">
          <div className="h-8 w-44 rounded bg-slate-200" />
          <div className="mt-6 h-64 rounded-2xl bg-slate-100" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          No data available.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Communication</h1>
          <p className="mt-1 text-slate-500">Stay connected with your child&apos;s school</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          {/* ─── Message Teacher Panel ─── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconChat className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-semibold text-slate-900">Message Teacher</h2>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Send a message to your child&apos;s class or subject teacher.
              </p>

              <div className="mt-4 space-y-3">
                {/* Teacher Select */}
                <div>
                  <label htmlFor="comm-teacher-select" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Select Teacher
                  </label>
                  <select
                    id="comm-teacher-select"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">— Choose a teacher —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject || "Class Teacher"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="comm-subject-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Subject
                  </label>
                  <input
                    id="comm-subject-input"
                    type="text"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    placeholder="e.g. Regarding attendance"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label htmlFor="comm-message-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Message
                  </label>
                  <textarea
                    id="comm-message-input"
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                {/* Success / Error */}
                {sendSuccess ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                    <IconCheck className="h-4 w-4" />
                    Message sent successfully!
                  </div>
                ) : null}

                {sendError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                    {sendError}
                  </div>
                ) : null}

                {/* Send Button */}
                <button
                  type="button"
                  disabled={sending || !messageBody.trim()}
                  onClick={handleSend}
                  className="flex items-center gap-2 rounded-lg bg-[#7dc242] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <IconSend className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ─── Message History ─── */}
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Message History
              </h3>

              {messagesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="h-3 w-32 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : messages.length ? (
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {messages.map((msg) => (
                    <article
                      key={msg.id}
                      className={`rounded-lg border p-3 ${
                        msg.direction === "parent-to-teacher"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-blue-200 bg-blue-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            To: {msg.teacherName || "Teacher"}
                            {msg.childName ? ` • Re: ${msg.childName}` : ""}
                          </p>
                          <p className="text-xs font-medium text-slate-500">{msg.subject}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <IconClock className="h-3 w-3" />
                          {formatMessageTime(msg.sentAt)}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{msg.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                  No messages sent yet. Send your first message above!
                </div>
              )}
            </div>
          </section>

          {/* ─── Announcements Panel ─── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <IconBell className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">School Announcements</h2>
              {notices.filter((n) => n.isNew).length > 0 ? (
                <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {notices.filter((n) => n.isNew).length} new
                </span>
              ) : null}
            </div>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {notices.length ? (
                notices.map((notice) => (
                  <article
                    key={notice.id}
                    className={`rounded-lg border p-4 transition ${
                      notice.isNew
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                      {notice.isNew ? (
                        <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          NEW
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{notice.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDate(notice.date)}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No announcements to display.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default ParentCommunication;
