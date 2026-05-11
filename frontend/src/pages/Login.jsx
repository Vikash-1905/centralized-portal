import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDefaultRouteForRole } from "../constants/auth";
import useAuth from "../hooks/useAuth";

const SIGNUP_INITIAL_STATE = {
  schoolName: "",
  adminName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();

  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupForm, setSignupForm] = useState(SIGNUP_INITIAL_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  const [isLoadingSignup, setIsLoadingSignup] = useState(false);

  const isSignupMode = authMode === "signup";

  const handleSignupInputChange = (event) => {
    const { name, value } = event.target;
    setSignupForm((current) => ({ ...current, [name]: value }));
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!signupForm.schoolName.trim()) {
      setErrorMessage("School name is required.");
      return;
    }

    if (!signupForm.adminName.trim()) {
      setErrorMessage("Admin name is required.");
      return;
    }

    if (!signupForm.email.trim()) {
      setErrorMessage("Admin email is required.");
      return;
    }

    if (!signupForm.password.trim()) {
      setErrorMessage("Admin password is required.");
      return;
    }

    if (signupForm.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoadingSignup(true);

    try {
      const user = await signup({
        schoolName: signupForm.schoolName,
        adminName: signupForm.adminName,
        email: signupForm.email,
        password: signupForm.password,
      });
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoadingSignup(false);
    }
  };

  const switchMode = (nextMode) => {
    setAuthMode(nextMode);
    setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoadingLogin(true);

    try {
      const user = await login(email, password);
      const requestedPath = location.state?.from?.pathname;
      const nextPath =
        requestedPath && requestedPath !== "/login"
          ? requestedPath
          : getDefaultRouteForRole(user.role);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoadingLogin(false);
    }
  };

  return (
    <div
      className="auth-theme relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_20%_20%,#daf3e6_0,#cbead8_32%,#c4e5d2_70%,#bddfcb_100%)] px-4 py-6 lg:flex lg:h-screen lg:items-center lg:justify-center lg:py-8"
      style={{ fontFamily: '"Manrope", sans-serif' }}
    >
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-12 h-56 w-56 rounded-full bg-teal-300/30 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[34px] border border-emerald-100 bg-white/80 shadow-[0_34px_70px_-42px_rgba(15,118,110,0.7)] backdrop-blur-sm lg:h-[min(84vh,680px)] lg:flex-row">
        <section className="relative flex flex-1 flex-col items-center justify-center bg-[#d9f1e2] p-6 sm:p-10 lg:basis-[54%] lg:px-8 lg:py-7">
          <div className="absolute left-7 top-8 h-24 w-24 rounded-full bg-emerald-100/70 blur-2xl" />
          <div className="absolute bottom-8 right-8 h-20 w-20 rounded-full bg-emerald-200/70 blur-xl" />

          <div className="relative mx-auto w-full max-w-[840px]">
            <div className="login-carousel-shell relative overflow-hidden px-2 sm:px-3 lg:px-4">
              <div className="login-carousel-track">
                <div className="login-carousel-item">
                  <img
                    src="/images/Login-Image1.png"
                    alt="Student growth dashboard illustration"
                    className="h-[clamp(220px,44vh,520px)] w-full object-contain sm:h-[clamp(300px,46vh,520px)]"
                  />
                </div>

                <div className="login-carousel-item">
                  <img
                    src="/images/Login-Image2.png"
                    alt="Learning activity highlights"
                    className="h-[clamp(220px,44vh,520px)] w-full object-contain sm:h-[clamp(300px,46vh,520px)]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 text-center md:mt-8 lg:mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-700">
              Guided Learning Journeys
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
              Track classes, performance, and communication from one centralized academic workspace.
            </p>
          </div>

        </section>

        <section className="flex flex-1 items-center bg-white p-6 sm:p-10 lg:basis-[46%] lg:px-12 lg:py-8">
          <div className="mx-auto w-full max-w-[360px] lg:max-h-full lg:overflow-y-auto lg:pr-1">
            <h1 className="text-3xl font-bold text-slate-800 sm:text-[2rem]">
              {isSignupMode
                ? "Launch Your School Workspace"
                : "Welcome to Centralized Portal"}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500 sm:text-base">
              {isSignupMode
                ? "Create a new school tenant and start as its administrator."
                : "Sign in with your assigned credentials to continue."}
            </p>

            {errorMessage ? (
              <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {isSignupMode ? (
              <form onSubmit={handleSignupSubmit} className="mt-7 space-y-4.5">
                <label className="block text-xs font-medium text-slate-500">
                  School name
                  <input
                    type="text"
                    name="schoolName"
                    placeholder="Enter school name"
                    className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.05rem] text-slate-700 outline-none transition focus:border-emerald-500"
                    value={signupForm.schoolName}
                    required
                    onChange={handleSignupInputChange}
                  />
                </label>

                <label className="block text-xs font-medium text-slate-500">
                  Admin full name
                  <input
                    type="text"
                    name="adminName"
                    placeholder="Enter full name"
                    className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.05rem] text-slate-700 outline-none transition focus:border-emerald-500"
                    value={signupForm.adminName}
                    required
                    onChange={handleSignupInputChange}
                  />
                </label>

                <label className="block text-xs font-medium text-slate-500">
                  Admin email
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email"
                    className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.05rem] text-slate-700 outline-none transition focus:border-emerald-500"
                    value={signupForm.email}
                    required
                    onChange={handleSignupInputChange}
                  />
                </label>

                <label className="block text-xs font-medium text-slate-500">
                  Password
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter password"
                    className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.05rem] text-slate-700 outline-none transition focus:border-emerald-500"
                    value={signupForm.password}
                    required
                    onChange={handleSignupInputChange}
                  />
                </label>

                <label className="block text-xs font-medium text-slate-500">
                  Confirm password
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.05rem] text-slate-700 outline-none transition focus:border-emerald-500"
                    value={signupForm.confirmPassword}
                    required
                    onChange={handleSignupInputChange}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isLoadingSignup}
                  className="touch-target mx-auto mt-6 block w-full max-w-xs rounded-full bg-[#7dc242] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70 sm:w-52"
                >
                  {isLoadingSignup ? "Creating school..." : "Create School & Continue"}
                </button>

                <div className="pt-2 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-semibold text-emerald-700 transition hover:text-emerald-800"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  <label className="block text-xs font-medium text-slate-500">
                    Username or email
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.08rem] text-slate-700 outline-none transition focus:border-emerald-500"
                      value={email}
                      required
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs font-medium text-slate-500">
                    Password
                    <input
                      type="password"
                      placeholder="Enter your password"
                      className="mt-1.5 w-full border-b border-slate-300 bg-transparent px-0 pb-2.5 pt-1 text-[1.08rem] text-slate-700 outline-none transition focus:border-emerald-500"
                      value={password}
                      required
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>

                  <div className="-mt-1.5 text-right">
                    <p className="text-xs font-medium text-emerald-600">Forgot password?</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoadingLogin}
                    className="touch-target mx-auto mt-4 block w-full max-w-xs rounded-full bg-[#7dc242] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#6cae3c] disabled:cursor-not-allowed disabled:opacity-70 sm:w-44"
                  >
                    {isLoadingLogin ? "Signing in..." : "Sign In"}
                  </button>

                  <div className="pt-1 text-center text-sm text-slate-500">
                    New school?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-semibold text-emerald-700 transition hover:text-emerald-800"
                    >
                      Sign Up
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
