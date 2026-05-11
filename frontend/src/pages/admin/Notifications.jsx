import { useMemo, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import useSchoolData from "../../hooks/useSchoolData";
import { formatDate } from "../../utils/schoolMetrics";

const NOTICE_AUDIENCE_OPTIONS = ["all", "student", "teacher", "parent", "crm"];

const createDefaultDraft = () => ({
  title: "",
  message: "",
  audience: "all",
  date: new Date().toISOString().slice(0, 10),
});

function Notifications() {
  const { schoolData, deleteNotice, saveNotice } = useSchoolData();
  const { notices } = schoolData;
  const [draft, setDraft] = useState(() => createDefaultDraft());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return notices.filter((notice) => {
      const date = new Date(notice.date || notice.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [notices]);

  const targetedCount = useMemo(
    () =>
      notices.filter((notice) => {
        const audience = Array.isArray(notice.audience) ? notice.audience : ["all"];
        return !audience.includes("all");
      }).length,
    [notices]
  );

  const handleInput = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const publishNotice = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!draft.title.trim() || !draft.message.trim()) {
      setError("Title and message are required.");
      return;
    }

    setIsSaving(true);

    try {
      await saveNotice({
        title: draft.title,
        message: draft.message,
        audience: [draft.audience],
        date: draft.date,
      });

      setDraft(createDefaultDraft());
      setStatus("Notice published successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (notice) => {
    if (!window.confirm(`Delete notice: ${notice.title || "Untitled"}?`)) {
      return;
    }

    setStatus("");
    setError("");

    try {
      await deleteNotice(notice.id);
      setStatus("Notice deleted.");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Notice and Notification Center</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Manage announcements for all users, selected roles, and class-level communication workflows.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Notices</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{notices.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">This Month</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{thisMonthCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Targeted Notices</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{targetedCount}</p>
          </article>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Create Announcement Draft</h2>
            <p className="mt-1 text-sm text-slate-500">
              Publish announcements for all users or selected audiences.
            </p>

            <form onSubmit={publishNotice} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Title
                <input
                  name="title"
                  value={draft.title}
                  onChange={handleInput}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Holiday notice"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Audience
                <select
                  name="audience"
                  value={draft.audience}
                  onChange={handleInput}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  {NOTICE_AUDIENCE_OPTIONS.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience === "all" ? "All users" : audience}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Date
                <input
                  type="date"
                  name="date"
                  value={draft.date}
                  onChange={handleInput}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Message
                <textarea
                  name="message"
                  value={draft.message}
                  onChange={handleInput}
                  rows="5"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Write the complete announcement content here"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-[#7dc242] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6cae3c]"
              >
                {isSaving ? "Publishing..." : "Publish Notice"}
              </button>
            </form>

            {status ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {status}
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Published Notices</h2>
            <div className="mt-4 space-y-3">
              {notices.length ? (
                notices.map((notice) => (
                  <article key={notice.id} className="rounded-lg bg-slate-50 p-4">
                    <p className="font-semibold text-slate-800">{notice.title || "Notice"}</p>
                    <p className="mt-1 text-sm text-slate-600">{notice.message || "-"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(notice.date || notice.createdAt)} | Audience:{" "}
                      {Array.isArray(notice.audience) && notice.audience.length
                        ? notice.audience.join(", ")
                        : "All"}
                    </p>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(notice)}
                        className="rounded-md bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No published notices yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default Notifications;
