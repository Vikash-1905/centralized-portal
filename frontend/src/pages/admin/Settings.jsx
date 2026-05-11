import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { fetchAdminSettings, saveAdminSettings } from "../../services/schoolApi";

const defaultSettings = {
  schoolName: "Centralized School",
  schoolCode: "CS-01",
  academicSession: "2026-2027",
  passwordMinLength: 6,
  enforceStrongPasswords: false,
  forceLogoutOnPasswordReset: false,
};

function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      setError("");

      try {
        const remoteSettings = await fetchAdminSettings();
        if (!isMounted) {
          return;
        }

        setSettings({ ...defaultSettings, ...(remoteSettings || {}) });
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSettings((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const savedSettings = await saveAdminSettings(settings);
      setSettings({ ...defaultSettings, ...(savedSettings || {}) });
      setMessage("Settings saved successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Settings Panel</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Configure school profile, session defaults, and security preferences for admin workflows.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading settings...
          </div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">School Information</h2>

            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                School Name
                <input
                  name="schoolName"
                  value={settings.schoolName}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                School Code
                <input
                  name="schoolCode"
                  value={settings.schoolCode}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Academic Session
                <input
                  name="academicSession"
                  value={settings.academicSession}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Security and Control</h2>

            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Minimum password length
                <input
                  type="number"
                  name="passwordMinLength"
                  value={settings.passwordMinLength}
                  onChange={handleChange}
                  min={6}
                  max={32}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="enforceStrongPasswords"
                  checked={settings.enforceStrongPasswords}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                Enforce strong password policy
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="forceLogoutOnPasswordReset"
                  checked={settings.forceLogoutOnPasswordReset}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                Force logout on credential reset
              </label>
            </div>
          </section>

          <section className="xl:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#7dc242] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6cae3c]"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>

            {message ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </section>
          </form>
        ) : null}

        {isLoading && error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

export default Settings;
