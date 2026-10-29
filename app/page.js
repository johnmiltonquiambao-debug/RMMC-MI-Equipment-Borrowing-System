"use client";

import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Download,
  FileBarChart,
  Filter,
  HardDrive,
  Laptop,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Pencil,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InstallAppButton from "./install-app-button";

const MEMBER_NAV_ITEMS = [
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "loans", label: "My borrowing", icon: ArrowLeftRight },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "account", label: "Account settings", icon: Settings },
];

const ADMIN_NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "loans", label: "My borrowing", icon: ArrowLeftRight },
  { id: "reservations", label: "Reservations", icon: CalendarDays },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
];

const ADMIN_ITEMS = [
  { id: "requests", label: "Manage requests", icon: ClipboardList },
  { id: "members", label: "Members & roles", icon: UsersRound },
];

const ACTIVE_BORROWING = ["pending", "approved", "checked_out", "return_requested"];

const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value))
    : "—";

const initials = (value = "") =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

const getErrorMessage = (error) => {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/email rate limit exceeded|too many requests/i.test(message)) {
    return "Supabase has temporarily limited email delivery. Wait before requesting another email. If this continues, ask your administrator to configure SMTP in Supabase Auth settings.";
  }
  if (/error sending confirmation email|error sending.*email/i.test(message)) {
    return "Supabase could not send the confirmation email. Check Authentication → Email → SMTP Settings and the email provider's delivery logs, then try again later.";
  }
  return message;
};

function StatusPill({ value }) {
  const labels = {
    available: "Available",
    out_of_stock: "Out of stock",
    reserved: "Reserved",
    maintenance: "Maintenance",
    retired: "Retired",
    pending: "Pending review",
    approved: "Approved",
    checked_out: "On loan",
    return_requested: "Return requested",
    returned: "Returned",
    rejected: "Declined",
    cancelled: "Cancelled",
    fulfilled: "Fulfilled",
  };
  return <span className={`pill pill-${value}`}>{labels[value] || value?.replaceAll("_", " ")}</span>;
}

function SignIn({ supabase, configError }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const [gender, setGender] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSendOtp() {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (otpError) throw otpError;
    setIsCodeSent(true);
    setNotice(`A one-time code was sent to ${email}.`);
  }

  async function handleVerifyOtp() {
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: mode === "signup" ? "signup" : "email",
    });

    if (otpError) throw otpError;
  }

  async function handleResendCode() {
    if (mode === "signup") {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) throw resendError;
      setNotice(`A verification code was sent to ${email}.`);
      return;
    }

    await handleSendOtp();
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (!supabase) throw new Error(configError);
      if (mode === "signin") {
        if (isCodeSent) await handleVerifyOtp();
        else await handleSendOtp();
      } else if (mode === "signup") {
        if (isCodeSent) {
          await handleVerifyOtp();
        } else {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: {
              display_name: name.trim(),
              department: department.trim(),
              course: course.trim(),
              gender: gender.trim(),
            } },
          });
          if (signUpError) throw signUpError;
          setIsCodeSent(true);
          setNotice(`A verification code was sent to ${email}.`);
        }
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setNotice("If an account exists for that address, a password reset link is on its way.");
      }
    } catch (submissionError) {
      const message = getErrorMessage(submissionError);
      setError(mode === "signin"
        ? `${isCodeSent ? "Invalid or expired code" : "Error sending code"}: ${message}`
        : mode === "signup" && isCodeSent
          ? `Invalid or expired code: ${message}`
          : message);
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (!supabase) throw new Error(configError);
      await handleResendCode();
    } catch (submissionError) {
      setError(`Error sending code: ${getErrorMessage(submissionError)}`);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setIsCodeSent(false);
    setToken("");
    setError("");
    setNotice("");
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <a className="auth-brand" href="/" aria-label="RMMC-MI equipment home">
          <span className="brand-mark"><HardDrive size={21} /></span>
          <span>RMMC <b>·</b> MI</span>
        </a>
        <div className="showcase-copy">
          <p className="eyebrow">Equipment, accounted for</p>
          <h1>Better care for the tools that move us forward.</h1>
          <p>One dependable place to find equipment, request what you need, and keep every return on track.</p>
          <div className="showcase-stats">
            <div><strong>01</strong><span>Browse available gear</span></div>
            <div><strong>02</strong><span>Request in a few clicks</span></div>
            <div><strong>03</strong><span>Keep your team moving</span></div>
          </div>
        </div>
        <p className="auth-copyright">RMMC-MI EQUIPMENT SERVICES · SECURE ACCESS</p>
        <div className="showcase-orbit" />
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <span className="brand-mark"><HardDrive size={20} /></span>
          <span>RMMC <b>·</b> MI</span>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">{mode === "signup" ? isCodeSent ? "Verify your email" : "Get started" : mode === "reset" ? "Account recovery" : isCodeSent ? "Check your inbox" : "Welcome back"}</p>
            <h2>{mode === "signup" ? isCodeSent ? "Enter your verification code" : "Create your account" : mode === "reset" ? "Reset your password" : isCodeSent ? "Enter your sign-in code" : "Sign in to your workspace"}</h2>
            <p>{mode === "signup" ? isCodeSent ? `Enter the verification code sent to ${email}.` : "Use your institutional email to request access." : mode === "reset" ? "We’ll email you a secure password reset link." : isCodeSent ? `Enter the one-time code sent to ${email}.` : "Access equipment, reservations, and your borrowing history with a one-time email code."}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && !isCodeSent && (
              <label>
                <span>Full name</span>
                <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
              </label>
            )}
            <label>
              <span>Institutional email</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@rmmc.edu.ph" disabled={isCodeSent && (mode === "signin" || mode === "signup")} required />
            </label>
            {(mode === "signin" || mode === "signup") && isCodeSent && (
              <label>
                <span>{mode === "signup" ? "Verification code" : "One-time code"}</span>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter your 6-digit code" required />
              </label>
            )}
            {mode === "signup" && !isCodeSent && (
              <>
                <div className="form-row">
                  <label>
                    <span>Department</span>
                    <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. IT" maxLength={120} required />
                  </label>
                  <label>
                    <span>Course</span>
                    <input value={course} onChange={(event) => setCourse(event.target.value)} placeholder="e.g. BSIT" maxLength={120} required />
                  </label>
                </div>
                <label>
                  <span>Gender</span>
                  <select value={gender} onChange={(event) => setGender(event.target.value)} required>
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
                </label>
              </>
            )}
            {error && <p className="feedback feedback-error" role="alert">{error}</p>}
            {notice && <p className="feedback feedback-success" role="status">{notice}</p>}
            {configError && <p className="setup-hint">Add your Supabase URL and publishable key in <code>.env.local</code>, then restart the dev server.</p>}
            {mode === "signin" && (
              <div className="auth-options">
                <span>Protected by Supabase authentication</span>
                {isCodeSent
                  ? <button type="button" onClick={resendOtp} disabled={busy}>Resend code</button>
                  : <button type="button" onClick={() => changeMode("reset")}>Forgot password?</button>}
              </div>
            )}
            {mode === "signup" && isCodeSent && (
              <div className="auth-options">
                <span>Check your inbox for the verification code.</span>
                <button type="button" onClick={resendOtp} disabled={busy}>Resend code</button>
              </div>
            )}
            <button className="auth-submit" disabled={busy || Boolean(configError)} type="submit">
              {busy ? "Please wait…" : mode === "signup" ? isCodeSent ? "Verify code" : "Create account" : mode === "reset" ? "Send reset link" : isCodeSent ? "Verify code" : "Send sign-in code"}
              <ArrowUpRight size={16} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "signin" && isCodeSent
              ? <button type="button" onClick={() => { setIsCodeSent(false); setToken(""); setError(""); setNotice(""); }}>Use a different email</button>
              : <>
                  {mode === "signin" ? "New to the system?" : "Already have an account?"}
                  <button type="button" onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}>
                    {mode === "signin" ? "Request access" : "Sign in"}
                  </button>
                  {mode === "reset" && <button type="button" onClick={() => changeMode("signin")}>Back to sign in</button>}
                </>}
          </p>
          <p className="auth-terms">Use of this system is subject to your institution’s equipment policies.</p>
          <InstallAppButton />
        </div>
      </section>
    </main>
  );
}

function EmptyState({ title, copy, action, onAction }) {
  return (
    <div className="empty-panel">
      <span><Package size={21} /></span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action && <button className="button-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

function EquipmentCard({ item, onBorrow, onReserve }) {
  const canBorrow = ["available", "checked_out"].includes(item.status) && item.available_quantity > 0;
  const canReserve = ["available", "checked_out"].includes(item.status) && item.quantity > 0;
  return (
    <article className="equipment-card">
      <div className={`equipment-art art-${(item.category || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
        {item.image_url ? <img src={item.image_url} alt="" /> : <Laptop size={42} strokeWidth={1.2} />}
        <StatusPill value={item.quantity === 0 || item.available_quantity === 0 ? "out_of_stock" : item.status} />
      </div>
      <div className="card-body">
        <div className="card-category">{item.category || "General"}</div>
        <h2>{item.name}</h2>
        <div className="item-meta">
          <span>{item.asset_tag}</span><i /><span>{item.location || "Storage not set"}</span>
        </div>
        <p className="item-quantity">Available amount: <strong>{item.available_quantity ?? "—"} / {item.quantity}</strong></p>
        {item.description && <p className="item-description">{item.description}</p>}
        <div className="card-actions">
          <button className="button-primary" disabled={!canBorrow} onClick={() => onBorrow(item)}>
            {canBorrow ? "Request to borrow" : item.available_quantity === null ? "Availability unavailable" : item.quantity === 0 || item.available_quantity === 0 ? "Out of stock" : item.status === "maintenance" ? "Under maintenance" : "Unavailable"}
          </button>
          {canReserve && <button className="button-icon" aria-label={`Reserve ${item.name}`} title="Reserve" onClick={() => onReserve(item)}><CalendarDays size={17} /></button>}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [supabase, setSupabase] = useState(null);
  const [configError, setConfigError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [members, setMembers] = useState([]);
  const [equipmentAudit, setEquipmentAudit] = useState([]);
  const [feedbackThreads, setFeedbackThreads] = useState([]);
  const [borrowerId, setBorrowerId] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [view, setView] = useState("overview");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All equipment");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (clientError) {
      setConfigError(getErrorMessage(clientError));
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async (client, currentUser) => {
    if (!client || !currentUser) return;
    setLoading(true);
    setError("");

    const [profileResult, equipmentResult, categoryResult, borrowingResult, availableQuantitiesResult, borrowerResult, reservationResult, feedbackResult, repliesResult] = await Promise.all([
      client.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
      client.from("equipment").select("*, categories(category_name)").is("deleted_at", null).order("equipment_name"),
      client.from("categories").select("category_id, category_name").order("category_name"),
      client.from("borrowings").select("*, borrowers(borrower_id, first_name, middle_name, last_name, email, department), borrowing_items(*, equipment(equipment_id, asset_code, equipment_name, category_id, storage_location, availability_status, categories(category_name)))").order("created_at", { ascending: false }),
      client.rpc("equipment_available_quantities"),
      client.rpc("current_borrower_id"),
      client.from("reservations").select("*, equipment(equipment_id, asset_code, equipment_name, categories(category_name)), borrowers(borrower_id, first_name, last_name, email)").order("created_at", { ascending: false }),
      client.from("feedback_threads").select("*").order("updated_at", { ascending: false }),
      client.from("feedback_replies").select("*").order("created_at"),
    ]);

    const errors = [];
    if (profileResult.error) {
      setProfile(null);
      errors.push(`Your profile role could not be loaded: ${profileResult.error.message}`);
    } else if (!profileResult.data) {
      setProfile(null);
      errors.push("No profile was found for the signed-in account.");
    } else {
      setProfile({
        ...profileResult.data,
        display_name: profileResult.data.display_name || profileResult.data.full_name || "",
        department: profileResult.data.department || "",
      });
    }
    if (equipmentResult.error) {
      errors.push(`Equipment could not be loaded: ${equipmentResult.error.message}`);
    } else {
      if (availableQuantitiesResult.error) {
        errors.push(`Available equipment amounts could not be loaded: ${availableQuantitiesResult.error.message}`);
      }
      const availableQuantities = new Map(
        (availableQuantitiesResult.data || []).map((item) => [item.equipment_id, item.available_quantity]),
      );
      setEquipment((equipmentResult.data || []).map((item) => ({
        ...item,
        id: item.equipment_id,
        name: item.equipment_name,
        asset_tag: item.asset_code,
        category: item.categories?.category_name || "General",
        location: item.storage_location || "",
        status: item.availability_status === "borrowed" ? "checked_out" : item.availability_status,
        image_url: item.image_url || null,
        quantity: item.quantity ?? 1,
        available_quantity: availableQuantitiesResult.error
          ? null
          : availableQuantities.get(item.equipment_id) ?? null,
      })));
    }
    if (categoryResult.error) errors.push(`Equipment categories could not be loaded: ${categoryResult.error.message}`);
    else setCategoryOptions(categoryResult.data || []);
    if (borrowerResult.error) {
      setBorrowerId(null);
      errors.push(`Your borrower record could not be found: ${borrowerResult.error.message}`);
    } else {
      setBorrowerId(borrowerResult.data || null);
      if (!borrowerResult.data) errors.push(`No active borrower record matches ${currentUser.email || "your signed-in email"}. An administrator must add your account to the borrowers table before you can submit or view borrowing requests.`);
    }
    if (borrowingResult.error) {
      errors.push(`Borrowing records could not be loaded: ${borrowingResult.error.message}`);
    } else {
      const returnRequestsResult = await client.from("return_requests").select("borrowing_id, status");
      if (returnRequestsResult.error) errors.push(`Return requests could not be loaded: ${returnRequestsResult.error.message}`);
      const openReturnIds = new Set((returnRequestsResult.data || []).filter((item) => item.status === "pending").map((item) => item.borrowing_id));
      setBorrowings((borrowingResult.data || []).map((item) => {
        const borrower = item.borrowers;
        const firstItem = item.borrowing_items?.[0];
        const equipmentItem = firstItem?.equipment;
        const equipmentNames = (item.borrowing_items || []).map((borrowingItem) => borrowingItem.equipment?.equipment_name).filter(Boolean);
        const assetCodes = (item.borrowing_items || []).map((borrowingItem) => borrowingItem.equipment?.asset_code).filter(Boolean);
        const status = openReturnIds.has(item.borrowing_id)
          ? "return_requested"
          : item.transaction_status === "borrowed"
            ? "checked_out"
            : item.transaction_status;
        return {
          ...item,
          id: item.borrowing_id,
          borrower_name: [borrower?.first_name, borrower?.middle_name, borrower?.last_name].filter(Boolean).join(" ") || "Borrower",
          borrower_email: borrower?.email || "",
          purpose: item.purpose,
          location_of_use: item.destination,
          start_date: item.request_date,
          expected_return: item.expected_return_date,
          status,
          equipment_id: equipmentItem?.equipment_id,
          equipment: equipmentItem ? {
            id: equipmentItem.equipment_id,
            name: equipmentNames.join(", "),
            asset_tag: assetCodes.join(", "),
            category: equipmentItem.categories?.category_name || "General",
          } : null,
          equipment_items: (item.borrowing_items || []).map((borrowingItem) => borrowingItem.equipment?.equipment_name).filter(Boolean),
        };
      }));
    }
    if (reservationResult.error) errors.push(`Reservations could not be loaded: ${reservationResult.error.message}`);
    else setReservations((reservationResult.data || []).map((item) => ({
      ...item,
      id: item.reservation_id,
      requester_id: item.requested_by,
      requester_email: item.borrowers?.email || "",
      start_date: item.start_date,
      end_date: item.end_date,
      location_of_use: item.destination,
      equipment: item.equipment ? {
        id: item.equipment.equipment_id,
        asset_tag: item.equipment.asset_code,
        name: item.equipment.equipment_name,
        category: item.equipment.categories?.category_name || "General",
      } : null,
    })));
    if (feedbackResult.error) {
      errors.push(`Feedback discussions could not be loaded: ${feedbackResult.error.message}`);
    } else if (repliesResult.error) {
      errors.push(`Feedback replies could not be loaded: ${repliesResult.error.message}`);
    } else {
      const repliesByThread = (repliesResult.data || []).reduce((all, reply) => {
        all[reply.thread_id] = [...(all[reply.thread_id] || []), reply];
        return all;
      }, {});
      setFeedbackThreads((feedbackResult.data || []).map((thread) => ({
        ...thread,
        replies: repliesByThread[thread.id] || [],
      })));
    }
    if (["admin", "property_custodian"].includes(profileResult.data?.role)) {
      const memberResult = await client.from("profiles").select("*").order("full_name");
      if (memberResult.error) errors.push(`Member management could not be loaded: ${memberResult.error.message}`);
      else setMembers((memberResult.data || []).map((member) => ({
        ...member,
        display_name: member.display_name || member.full_name || "",
        department: member.department || "",
      })));
    } else {
      setMembers([]);
    }
    if (profileResult.data?.role === "admin") {
      const auditResult = await client.from("equipment_audit_log").select("*").order("changed_at", { ascending: false }).limit(30);
      if (auditResult.error) errors.push(`Equipment change history could not be loaded: ${auditResult.error.message}`);
      else setEquipmentAudit((auditResult.data || []).map((entry) => ({
        ...entry,
        id: entry.id,
        equipment_id: entry.equipment_id,
        asset_tag: entry.asset_code || `Equipment #${entry.equipment_id}`,
      })));
    } else {
      setEquipmentAudit([]);
    }
    if (errors.length) setError(`${errors.join(" ")} Check that the Supabase schema migrations in supabase/migrations have been applied in order.`);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(getErrorMessage(sessionError));
      setUser(data.session?.user || null);
      if (data.session?.user) loadData(supabase, data.session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setUser(session?.user || null);
      if (session?.user) loadData(supabase, session.user);
      else {
        setProfile(null);
        setEquipment([]);
        setBorrowings([]);
        setReservations([]);
        setMembers([]);
        setEquipmentAudit([]);
        setFeedbackThreads([]);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadData]);

  const isAdmin = profile?.role === "admin";
  const isEquipmentStaff = isAdmin || profile?.role === "property_custodian";

  useEffect(() => {
    const memberViews = ["equipment", "loans", "feedback", "account"];
    if (profile && !isEquipmentStaff && !memberViews.includes(view)) setView("equipment");
  }, [profile, isEquipmentStaff, view]);

  const categories = useMemo(
    () => ["All equipment", ...new Set(equipment.map((item) => item.category).filter(Boolean))],
    [equipment],
  );
  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesCategory = category === "All equipment" || item.category === category;
      const matchesQuery = !query || [item.name, item.asset_tag, item.category, item.location, item.brand, item.model].some((field) => field?.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [equipment, category, search]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const currentLoans = borrowings.filter((item) => ["approved", "checked_out", "return_requested"].includes(item.status));
    return {
      available: equipment.filter((item) => item.status === "available").length,
      borrowed: currentLoans.length,
      dueSoon: currentLoans.filter((item) => item.expected_return && String(item.expected_return).slice(0, 10) <= today).length,
      pending: borrowings.filter((item) => item.status === "pending").length + reservations.filter((item) => item.status === "pending").length,
    };
  }, [equipment, borrowings, reservations]);

  async function refresh() {
    if (supabase && user) await loadData(supabase, user);
  }

  async function runAction(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (result?.error) throw result.error;
      setNotice(successMessage);
      setModal(null);
      await refresh();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!modal || !supabase || !user) return;
    const form = new FormData(event.currentTarget);
    const common = {
      p_equipment_id: modal.item.id,
      p_purpose: String(form.get("purpose") || "").trim(),
      p_destination: String(form.get("use_location") || "").trim(),
    };
    if (modal.kind === "reservation") {
      await runAction(() => supabase.rpc("request_equipment_reservation", {
        ...common,
        p_start_date: form.get("start_date"),
        p_end_date: form.get("end_date"),
      }), "Reservation request submitted.");
    } else {
      await runAction(() => supabase.rpc("request_equipment_borrowing", {
        ...common,
        p_expected_return_date: `${form.get("end_date")}T17:00:00`,
      }), "Borrowing request submitted.");
    }
  }

  async function uploadEquipmentImage(form) {
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return null;
    const allowedTypes = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = allowedTypes[file.type];
    if (!extension) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Equipment images must be 5 MB or smaller.");

    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("equipment-images")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    return supabase.storage.from("equipment-images").getPublicUrl(path).data.publicUrl;
  }

  async function addEquipment(event) {
    event.preventDefault();
    if (!isAdmin || !supabase || !user) return;
    const form = new FormData(event.currentTarget);
    const item = {
      asset_code: String(form.get("asset_tag") || "").trim(),
      equipment_name: String(form.get("name") || "").trim(),
      category_id: Number(form.get("category_id")),
      quantity: Number(form.get("quantity")),
      brand: String(form.get("brand") || "").trim() || null,
      model: String(form.get("model") || "").trim() || null,
      serial_number: String(form.get("serial_number") || "").trim() || null,
      storage_location: String(form.get("location") || "").trim(),
      description: String(form.get("description") || "").trim(),
      availability_status: "available",
      condition_status: "good",
    };
    await runAction(async () => {
      const imageUrl = await uploadEquipmentImage(form);
      const { error: insertError } = await supabase.from("equipment").insert({ ...item, image_url: imageUrl });
      if (insertError) throw insertError;
    }, "Equipment added to inventory.");
  }

  async function updateEquipment(event) {
    event.preventDefault();
    if (!isAdmin || !modal?.item || !supabase || !user) return;
    const form = new FormData(event.currentTarget);
    const item = {
      asset_code: String(form.get("asset_tag") || "").trim(),
      equipment_name: String(form.get("name") || "").trim(),
      category_id: Number(form.get("category_id")),
      quantity: Number(form.get("quantity")),
      brand: String(form.get("brand") || "").trim() || null,
      model: String(form.get("model") || "").trim() || null,
      serial_number: String(form.get("serial_number") || "").trim() || null,
      storage_location: String(form.get("location") || "").trim(),
      description: String(form.get("description") || "").trim(),
      availability_status: String(form.get("status") || "available"),
      condition_status: String(form.get("condition_status") || "good"),
      updated_at: new Date().toISOString(),
    };
    await runAction(async () => {
      const imageUrl = await uploadEquipmentImage(form);
      if (imageUrl) item.image_url = imageUrl;
      else if (form.get("remove_image") === "on") item.image_url = null;
      const { error: updateError } = await supabase.from("equipment").update(item).eq("equipment_id", modal.item.id);
      if (updateError) throw updateError;
    }, "Equipment record updated.");
  }

  async function saveAccount(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nameField = profile?.full_name != null && profile?.display_name == null ? "full_name" : "display_name";
    const updates = {
      [nameField]: String(form.get("display_name") || "").trim(),
      department: String(form.get("department") || "").trim(),
      course: String(form.get("course") || "").trim(),
      gender: String(form.get("gender") || "").trim(),
    };
    await runAction(() => supabase.from("profiles").update(updates).eq("id", user.id), "Account settings saved.");
  }

  async function submitFeedback(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const thread = {
      author_id: user.id,
      author_name: displayName,
      title: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "suggestion"),
      message: String(form.get("message") || "").trim(),
    };
    await runAction(() => supabase.from("feedback_threads").insert(thread), "Feedback posted to the discussion board.");
  }

  async function replyToFeedback(event, threadId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("reply") || "").trim();
    if (!message) return;
    await runAction(() => supabase.from("feedback_replies").insert({
      thread_id: threadId,
      author_id: user.id,
      author_name: displayName,
      message,
    }), "Reply posted.");
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(getErrorMessage(signOutError));
  }

  function downloadReport(reportType) {
    const today = new Date().toISOString().slice(0, 10);
    let rows;
    let suffix;

    if (reportType === "equipment") {
      suffix = "equipment-status";
      rows = [
        ["Equipment", "Asset tag", "Category", "Status", "Storage location", "Current borrower", "Current location of use", "Expected return"],
        ...equipment.map((item) => {
          const activeLoan = borrowings.find((loan) => loan.equipment_id === item.id && ["approved", "checked_out", "return_requested"].includes(loan.status));
          return [item.name, item.asset_tag, item.category, item.status, item.location, activeLoan?.borrower_email || "", activeLoan?.location_of_use || "", activeLoan?.expected_return || ""];
        }),
      ];
    } else {
      const reportRows = reportType === "overdue"
        ? borrowings.filter((item) => ACTIVE_BORROWING.includes(item.status) && String(item.expected_return || "").slice(0, 10) < today)
        : reportType === "returns"
          ? borrowings.filter((item) => item.status === "returned")
          : borrowings;
      suffix = reportType === "overdue" ? "overdue-items" : reportType === "returns" ? "returns" : "borrowing";
      rows = [
        ["Equipment", "Asset tag", "Borrower email", "Purpose", "Location of use", "Start date", "Expected return", "Status"],
        ...reportRows.map((item) => [
          item.equipment?.name || "",
          item.equipment?.asset_tag || "",
          item.borrower_email || item.borrower_id,
          item.purpose || "",
          item.location_of_use || "",
          item.start_date || "",
          item.expected_return || "",
          item.status || "",
        ]),
      ];
    }
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `rmmc-${suffix}-report-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!user) return <SignIn supabase={supabase} configError={configError} />;

  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Member";
  const userRole = profile?.role || "unavailable";

  const sectionHeader = {
    overview: ["Good day", displayName, "Here’s what’s happening with your team’s equipment."],
    equipment: ["Equipment library", "Find the right gear", "Browse available equipment or check when an item is due back."],
    loans: ["Your activity", "My borrowing", "Track requests, check due dates, and close out returns."],
    reservations: ["Plan ahead", "Reservations", "Request equipment for an upcoming date and avoid schedule conflicts."],
    reports: ["At a glance", "Reports & history", "Your complete, exportable record of equipment activity."],
    requests: ["Operations", "Manage requests", "Review member requests and keep equipment moving."],
    members: ["Operations", "Members & roles", "Review account access and keep member permissions up to date."],
    feedback: ["Have a say", "Feedback & ideas", "Share improvements and discuss how the system should grow."],
    account: ["Your profile", "Account settings", "Keep your name and department information up to date."],
  }[view] || ["Workspace", "Equipment", "Manage equipment and requests."];

  const myBorrowings = borrowings.filter((item) => Number(item.borrower_id) === Number(borrowerId));
  const myReservations = reservations.filter((item) => item.requester_id === user.id);
  const displayedRows = view === "loans" ? myBorrowings : view === "reservations" ? myReservations : isEquipmentStaff ? borrowings : myBorrowings;
  const visibleNavItems = !profile ? [] : isEquipmentStaff ? ADMIN_NAV_ITEMS : MEMBER_NAV_ITEMS;

  return (
    <div className="app-shell">
      {mobileNav && <button className="backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="/" aria-label="RMMC-MI home">
          <span className="brand-mark"><HardDrive size={21} /></span>
          <span>RMMC <i>·</i> MI</span>
        </a>
        <div className="workspace-label">EQUIPMENT SERVICES</div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => { setView(id); setMobileNav(false); }}>
              <Icon size={18} /><span>{label}</span>
              {id === "loans" && myBorrowings.some((item) => item.status === "pending") && <i className="nav-badge">!</i>}
            </button>
          ))}
          {isEquipmentStaff && (
            <>
              <p className="nav-label nav-section">Administration</p>
              {ADMIN_ITEMS.map(({ id, label, icon: Icon }) => (
                <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => { setView(id); setMobileNav(false); }}>
                  <Icon size={18} /><span>{label}</span>
                  {id === "requests" && counts.pending > 0 && <i className="nav-badge">{counts.pending}</i>}
                </button>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-card">
          <span className="help-icon"><MessageSquare size={15} /></span>
          <strong>Help shape the system</strong>
          <p>Share ideas, report an issue, or discuss what should come next.</p>
          <button type="button" onClick={() => setView("feedback")}>Open feedback <ArrowUpRight size={14} /></button>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{initials(displayName)}</span>
          <div><strong>{displayName}</strong><span>          {userRole === "admin" ? "Administrator" : userRole === "property_custodian" ? "Property custodian" : userRole === "staff" ? "Staff member" : "Role unavailable"}</span></div>
          <button className="logout-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <span className="topbar-context">RMMC-MI <i>/</i> Equipment services</span>
          <div className="top-actions">
            <InstallAppButton />
            <span className="connection-status"><i /> Live workspace</span>
            <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={18} /></button>
            <div className="user-chip"><span className="avatar">{initials(displayName)}</span><div><strong>{displayName}</strong><span>{user.email}</span></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="page">
          <section className="page-heading">
            <div>
              <p className="eyebrow">{sectionHeader[0]}</p>
              <h1>{sectionHeader[1]}{view === "overview" && <span className="heading-period">.</span>}</h1>
              <p>{sectionHeader[2]}</p>
            </div>
            {view === "equipment" && <div className="availability-note"><span /> <strong>{counts.available}</strong> items available</div>}
            {view === "equipment" && isAdmin && <button className="button-primary" onClick={() => setModal({ kind: "add-equipment" })}><Plus size={17} /> Add equipment</button>}
          </section>

          {(error || notice) && (
            <div className={`banner ${error ? "banner-error" : "banner-success"}`} role={error ? "alert" : "status"}>
              <span>{error ? error : notice}</span>
              {error && <button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>}
            </div>
          )}

          {view === "overview" && (
            <>
              <section className="welcome-strip">
                <div className="welcome-icon"><ShieldCheck size={21} /></div>
                <div><strong>Your equipment workspace</strong><p>Browse gear, check your requests, and keep every return on schedule.</p></div>
                <button onClick={() => setView("equipment")}>Browse equipment <ArrowUpRight size={15} /></button>
                <div className="welcome-decoration" />
              </section>
              <section className="metric-grid" aria-label="Equipment summary">
                <article className="metric-card"><div className="metric-top"><span>Available now</span><span className="metric-icon metric-green"><Package size={18} /></span></div><strong>{loading ? "—" : counts.available}</strong><small>Ready to request</small></article>
                <article className="metric-card"><div className="metric-top"><span>Currently borrowed</span><span className="metric-icon metric-amber"><ArrowLeftRight size={18} /></span></div><strong>{loading ? "—" : counts.borrowed}</strong><small>Approved or checked out</small></article>
                <article className="metric-card"><div className="metric-top"><span>Due today / overdue</span><span className="metric-icon metric-rose"><Clock3 size={18} /></span></div><strong>{loading ? "—" : counts.dueSoon}</strong><small>Items needing attention</small></article>
                <article className="metric-card"><div className="metric-top"><span>Requests to review</span><span className="metric-icon metric-blue"><Bell size={18} /></span></div><strong>{loading ? "—" : counts.pending}</strong><small>{isEquipmentStaff ? "Awaiting your review" : "Across your requests"}</small></article>
              </section>
              <div className="section-title"><div><h2>Recently requested</h2><p>Your latest equipment activity</p></div><button className="text-action" onClick={() => setView("loans")}>View all <ArrowUpRight size={15} /></button></div>
              <BorrowingList rows={myBorrowings.slice(0, 4)} onRequestReturn={(row) => runAction(() => supabase.rpc("request_equipment_return", { p_borrowing_id: row.id }), "Return request submitted.")} loading={loading} />
              <div className="section-title"><div><h2>Find equipment</h2><p>Browse what’s available for your next project</p></div><button className="text-action" onClick={() => setView("equipment")}>Explore library <ArrowUpRight size={15} /></button></div>
              <div className="equipment-grid compact-grid">
                {(equipment.filter((item) => item.status === "available").slice(0, 3)).map((item) => <EquipmentCard key={item.id} item={item} onBorrow={(selected) => setModal({ kind: "borrow", item: selected })} onReserve={(selected) => setModal({ kind: "reservation", item: selected })} />)}
                {!loading && equipment.length === 0 && <EmptyState title="Your equipment library is ready" copy="Once equipment is added to the inventory, it will appear here." action={isAdmin ? "Add equipment" : null} onAction={() => setModal({ kind: "add-equipment" })} />}
              </div>
            </>
          )}

          {view === "equipment" && (
            <>
              <div className="toolbar">
                <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search equipment, tag or location" aria-label="Search equipment" /><kbd>⌘ K</kbd></label>
                <div className="category-tabs" role="group" aria-label="Filter by category">
                  {categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}
                </div>
                <span className="filter-caption"><Filter size={15} /> {filteredEquipment.length} results</span>
              </div>
              {loading ? <LoadingPanel /> : filteredEquipment.length ? (
                <div className="equipment-grid">
                  {filteredEquipment.map((item) => <EquipmentCard key={item.id} item={item} onBorrow={(selected) => setModal({ kind: "borrow", item: selected })} onReserve={(selected) => setModal({ kind: "reservation", item: selected })} />)}
                </div>
              ) : <EmptyState title={equipment.length ? "No matching equipment" : "No equipment has been added yet"} copy={equipment.length ? "Try another search or category." : "The inventory team can add equipment to make it available here."} action={isAdmin && !equipment.length ? "Add equipment" : null} onAction={() => setModal({ kind: "add-equipment" })} />}
              {isAdmin && (
                <>
                  <div className="section-title"><div><h2>Manage equipment</h2><p>Edit item details or remove retired equipment from the active library.</p></div><span className="record-count">{equipment.length} active items</span></div>
                  <EquipmentTable
                    equipment={equipment}
                    onEdit={(item) => setModal({ kind: "edit-equipment", item })}
                    onDelete={(item) => {
                      if (window.confirm(`Remove ${item.name} (${item.asset_tag}) from the active equipment library? Existing borrowing history will be preserved.`)) {
                        runAction(() => supabase.rpc("delete_equipment", { p_equipment_id: item.id }), "Equipment removed from the active library.");
                      }
                    }}
                  />
                  <div className="section-title"><div><h2>Equipment change history</h2><p>Database-recorded additions, edits, and removals.</p></div><span className="record-count">{equipmentAudit.length} recent changes</span></div>
                  <EquipmentAuditLog entries={equipmentAudit} />
                </>
              )}
            </>
          )}

          {(view === "loans" || view === "reservations") && (
            <>
              <div className="toolbar list-toolbar">
                <div className="list-toolbar-copy"><span className="toolbar-icon"><ClipboardList size={17} /></span><div><strong>{view === "loans" ? "Borrowing activity" : "Reservation activity"}</strong><small>Requests and updates tied to your account</small></div></div>
                <span className="record-count">{view === "loans" ? myBorrowings.length : myReservations.length} records</span>
              </div>
              {view === "loans" ? (
                <>
                  <BorrowingList rows={myBorrowings} onRequestReturn={(row) => runAction(() => supabase.rpc("request_equipment_return", { p_borrowing_id: row.id }), "Return request submitted.")} loading={loading} />
                  <div className="section-title"><div><h2>My reservations</h2><p>Upcoming and past reservation requests</p></div><span className="record-count">{myReservations.length} records</span></div>
                  <ReservationList rows={myReservations} loading={loading} />
                </>
              ) : <ReservationList rows={myReservations} loading={loading} />}
            </>
          )}

          {view === "requests" && isEquipmentStaff && (
            <AdminRequests
              borrowings={borrowings}
              reservations={reservations}
              busy={busy}
              runAction={runAction}
              supabase={supabase}
            />
          )}

          {view === "members" && isEquipmentStaff && (
            <>
              <div className="toolbar list-toolbar">
                <div className="list-toolbar-copy"><span className="toolbar-icon"><UsersRound size={17} /></span><div><strong>Workspace members</strong><small>Manage access to equipment operations</small></div></div>
                <span className="record-count">{members.length} accounts</span>
              </div>
              <MemberTable members={members} currentUserId={user.id} runAction={runAction} supabase={supabase} />
            </>
          )}

          {view === "reports" && (
            <>
              {isEquipmentStaff && <div className="report-callout">
                <div className="report-icon"><FileBarChart size={21} /></div>
                <div><strong>Export operational reports</strong><p>Download borrowing, returns, current equipment status, or overdue items as CSV.</p></div>
                <div className="report-actions">
                  <button className="button-secondary" onClick={() => downloadReport("borrowing")}><Download size={14} /> Borrowing</button>
                  <button className="button-secondary" onClick={() => downloadReport("returns")}><Download size={14} /> Returns</button>
                  <button className="button-secondary" onClick={() => downloadReport("equipment")}><Download size={14} /> Equipment</button>
                  <button className="button-secondary" onClick={() => downloadReport("overdue")}><Download size={14} /> Overdue</button>
                </div>
              </div>
              }
              <div className="section-title"><div><h2>Borrowing history</h2><p>{isEquipmentStaff ? "All recorded equipment requests" : "Your recorded equipment requests"}</p></div><span className="record-count">{displayedRows.length} records</span></div>
              <BorrowingTable rows={displayedRows} loading={loading} />
              {isEquipmentStaff && <><div className="section-title"><div><h2>Reservation history</h2><p>Upcoming and completed equipment reservations</p></div></div><ReservationList rows={reservations} loading={loading} admin /></>}
            </>
          )}

          {view === "feedback" && (
            <FeedbackBoard
              threads={feedbackThreads}
              currentUserId={user.id}
              isAdmin={isAdmin}
              busy={busy}
              onCreate={submitFeedback}
              onReply={replyToFeedback}
              onStatusChange={(threadId, status) => runAction(
                () => supabase.from("feedback_threads").update({ status }).eq("id", threadId),
                "Feedback status updated.",
              )}
            />
          )}

          {view === "account" && (
            <AccountSettings profile={profile} user={user} busy={busy} onSave={saveAccount} />
          )}

          <footer className="page-footer"><span>RMMC-MI Equipment Services</span><span>Keep equipment safe. Keep projects moving.</span></footer>
        </div>
      </main>

      {modal && (
        <div className="modal-wrap" role="presentation">
          <button className="modal-backdrop" onClick={() => !busy && setModal(null)} aria-label="Close dialog" />
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close" disabled={busy}><X size={18} /></button>
            {modal.kind === "add-equipment" || modal.kind === "edit-equipment" ? (
              <>
                <div className="modal-kicker">INVENTORY</div>
                <h2 id="modal-title">{modal.kind === "edit-equipment" ? "Edit equipment" : "Add equipment"}</h2>
                <p className="modal-copy">{modal.kind === "edit-equipment" ? "Update this record. Changes are saved to the database audit history." : "Create an equipment record for your team to discover and request."}</p>
                <form className="modal-form" onSubmit={modal.kind === "edit-equipment" ? updateEquipment : addEquipment}>
                  <label><span>Equipment name</span><input name="name" placeholder="e.g. Canon EOS R6" defaultValue={modal.item?.name || ""} required maxLength={160} /></label>
                  <div className="form-row"><label><span>Asset code</span><input name="asset_tag" placeholder="CAM-001" defaultValue={modal.item?.asset_tag || ""} required maxLength={80} /></label><label><span>Category</span><select name="category_id" defaultValue={modal.item?.category_id || ""} required><option value="" disabled>Select a category</option>{categoryOptions.map((option) => <option key={option.category_id} value={option.category_id}>{option.category_name}</option>)}</select></label></div>
                  <label><span>Amount</span><input name="quantity" type="number" min="0" step="1" defaultValue={modal.item?.quantity ?? 1} required /></label>
                  <div className="form-row"><label><span>Brand (optional)</span><input name="brand" defaultValue={modal.item?.brand || ""} maxLength={120} /></label><label><span>Model (optional)</span><input name="model" defaultValue={modal.item?.model || ""} maxLength={120} /></label></div>
                  <label><span>Serial number (optional)</span><input name="serial_number" defaultValue={modal.item?.serial_number || ""} maxLength={160} /></label>
                  <label><span>Storage location</span><input name="location" placeholder="Media office · Cabinet 2" defaultValue={modal.item?.location || ""} maxLength={200} /></label>
                  <label><span>Description (optional)</span><textarea name="description" rows="3" placeholder="Condition, accessories, or notes" defaultValue={modal.item?.description || ""} maxLength={1000} /></label>
                  <label><span>Equipment picture</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /><small className="field-hint">JPEG, PNG, WebP, or GIF; 5 MB maximum.</small></label>
                  {modal.kind === "edit-equipment" && modal.item.image_url && (
                    <div className="equipment-image-preview"><img src={modal.item.image_url} alt={`Current picture of ${modal.item.name}`} /><span>Current picture</span></div>
                  )}
                  {modal.kind === "edit-equipment" && modal.item.image_url && <label className="checkbox-label"><input name="remove_image" type="checkbox" /><span>Remove current picture</span></label>}
                  {modal.kind === "edit-equipment" && <label><span>Condition</span><select name="condition_status" defaultValue={modal.item.condition_status}><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label>}
                  {modal.kind === "edit-equipment" && <label><span>Availability</span><select name="status" defaultValue={modal.item.availability_status}><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>{["borrowed", "reserved"].includes(modal.item.availability_status) && <option value={modal.item.availability_status}>{modal.item.availability_status === "borrowed" ? "Borrowed" : "Reserved"} (manage through requests)</option>}</select></label>}
                  <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button-primary" disabled={busy || (!categoryOptions.length && modal.kind === "add-equipment")} type="submit">{busy ? "Saving…" : modal.kind === "edit-equipment" ? "Save changes" : "Add to inventory"} {modal.kind === "edit-equipment" ? <Check size={15} /> : <Plus size={15} />}</button></div>
                </form>
              </>
            ) : (
              <>
                <div className="modal-kicker">{modal.kind === "reservation" ? "RESERVE EQUIPMENT" : "BORROW EQUIPMENT"}</div>
                <h2 id="modal-title">{modal.kind === "reservation" ? "Plan ahead" : "Request this equipment"}</h2>
                <p className="modal-copy"><strong>{modal.item.name}</strong> · {modal.item.asset_tag} — {modal.kind === "reservation" ? "choose the dates you need it reserved." : "tell us when and where you’ll use it."}</p>
                <form className="modal-form" onSubmit={submitRequest}>
                  <label><span>Purpose</span><input name="purpose" placeholder="What will you use it for?" required maxLength={300} /></label>
                  <label><span>Location of use</span><input name="use_location" placeholder="Room, building, or event venue" required maxLength={200} /></label>
                  {modal.kind === "reservation" ? <div className="form-row">
                    <label><span>Reservation starts</span><input type="date" name="start_date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
                    <label><span>Reservation ends</span><input type="date" name="end_date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></label>
                  </div> : <label><span>Expected return date</span><input type="date" name="end_date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></label>}
                  <div className="modal-info"><ShieldCheck size={19} /><div><strong>Requests are reviewed by the equipment team</strong><span>You’ll see status updates in My borrowing.</span></div></div>
                  <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="button-primary" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit request"} <ArrowUpRight size={15} /></button></div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
      {recoveryMode && <PasswordRecoveryDialog supabase={supabase} onComplete={() => { setRecoveryMode(false); setNotice("Your password has been updated."); }} />}
    </div>
  );
}

function LoadingPanel() {
  return <div className="loading-panel"><span className="spinner" /> Loading workspace data…</div>;
}

function PasswordRecoveryDialog({ supabase, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(getErrorMessage(updateError));
      else onComplete();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-wrap">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <div className="modal-kicker">ACCOUNT RECOVERY</div>
        <h2 id="recovery-title">Choose a new password</h2>
        <p className="modal-copy">Use at least 8 characters, then confirm your new password.</p>
        <form className="modal-form" onSubmit={submit}>
          <label><span>New password</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
          {error && <p className="feedback feedback-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="button-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"} <Check size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}

function BorrowingList({ rows, onRequestReturn, loading }) {
  if (loading) return <LoadingPanel />;
  if (!rows.length) return <EmptyState title="No borrowing activity yet" copy="When you request equipment, updates will appear here." />;
  return (
    <div className="loan-list">
      {rows.map((item) => (
        <article className="loan-card" key={item.id}>
          <div className="loan-art"><Laptop size={25} /></div>
          <div className="loan-main">
            <div className="loan-card-heading"><span className="card-category">{item.equipment?.category || "Equipment"}</span><StatusPill value={item.status} /></div>
            <h2>{item.equipment?.name || "Equipment"}</h2>
            <p>{item.equipment?.asset_tag || "—"} <i /> {item.purpose || "No purpose specified"}</p>
          </div>
          <div className="loan-date"><span>Expected return</span><strong>{dateLabel(item.expected_return)}</strong><small className={item.expected_return && String(item.expected_return).slice(0, 10) < new Date().toISOString().slice(0, 10) && ACTIVE_BORROWING.includes(item.status) ? "due-soon" : ""}>{item.location_of_use || "Location not set"}</small></div>
          <div className="loan-actions">
            {["approved", "checked_out"].includes(item.status) && <button className="button-secondary" onClick={() => onRequestReturn(item)}>Request return</button>}
            {item.status === "return_requested" && <span className="return-note"><Clock3 size={14} /> Return requested</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function ReservationList({ rows, loading, admin = false }) {
  if (loading) return <LoadingPanel />;
  if (!rows.length) return <EmptyState title="No reservations yet" copy="Reserve equipment for an upcoming project from the equipment library." />;
  return (
    <div className="reservation-list">
      {rows.map((item) => (
        <article className="reservation-row" key={item.id}>
          <span className="reservation-icon"><CalendarDays size={18} /></span>
          <div className="reservation-main"><strong>{item.equipment?.name || "Equipment"}</strong><span>{item.equipment?.asset_tag} · {item.purpose || "No purpose specified"}{admin && item.requester_email ? ` · ${item.requester_email}` : ""}</span></div>
          <div className="reservation-dates"><strong>{dateLabel(item.start_date)} — {dateLabel(item.end_date)}</strong><span>{item.location_of_use || "Location not set"}</span></div>
          <StatusPill value={item.status} />
        </article>
      ))}
    </div>
  );
}

function BorrowingTable({ rows, loading }) {
  if (loading) return <LoadingPanel />;
  if (!rows.length) return <EmptyState title="No history yet" copy="Completed and active borrowing requests will be listed here." />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Equipment</th><th>Borrower</th><th>Dates</th><th>Status</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id}>
          <td><strong>{item.equipment?.name || "Equipment"}</strong><small>{item.equipment?.asset_tag}</small></td>
          <td>{item.borrower_email || "Member"}</td>
          <td><strong>{dateLabel(item.start_date)} – {dateLabel(item.expected_return)}</strong><small>{item.location_of_use || item.purpose}</small></td>
          <td><StatusPill value={item.status} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function AdminRequests({ borrowings, reservations, busy, runAction, supabase }) {
  const pendingBorrowings = borrowings.filter((item) => ["pending", "return_requested"].includes(item.status));
  const pendingReservations = reservations.filter((item) => item.status === "pending");
  return (
    <>
      <div className="section-title"><div><h2>Borrowing & return requests</h2><p>Review each member request before updating inventory status.</p></div><span className="record-count">{pendingBorrowings.length} to review</span></div>
      {!pendingBorrowings.length ? <EmptyState title="All caught up" copy="There are no borrowing or return requests waiting for review." /> : (
        <div className="admin-request-list">
          {pendingBorrowings.map((item) => (
            <article className="admin-request" key={item.id}>
              <div className="loan-art"><Laptop size={23} /></div>
              <div className="admin-request-main"><div className="loan-card-heading"><span className="card-category">{item.equipment?.asset_tag}</span><StatusPill value={item.status} /></div><h2>{item.equipment?.name || "Equipment"}</h2><p>{item.borrower_email || item.borrower_id} · {item.purpose}</p><small>{dateLabel(item.start_date)} – {dateLabel(item.expected_return)} · {item.location_of_use}</small></div>
              <div className="admin-actions">
                {item.status === "pending" ? <>
                  <button className="button-secondary" disabled={busy} onClick={() => runAction(() => supabase.rpc("review_borrowing_request", { p_borrowing_id: item.id, p_action: "reject" }), "Request declined.")}>Decline</button>
                  <button className="button-primary" disabled={busy} onClick={() => runAction(() => supabase.rpc("review_borrowing_request", { p_borrowing_id: item.id, p_action: "approve" }), "Borrowing request approved.")}><Check size={15} /> Approve</button>
                </> : <button className="button-primary" disabled={busy} onClick={() => runAction(() => supabase.rpc("complete_equipment_return", { p_borrowing_id: item.id }), "Equipment marked as returned.")}><CheckCircle2 size={15} /> Confirm return</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-title"><div><h2>Reservation requests</h2><p>Check availability before confirming upcoming dates.</p></div><span className="record-count">{pendingReservations.length} to review</span></div>
      {!pendingReservations.length ? <EmptyState title="No reservations to review" copy="New reservation requests will appear here." /> : (
        <div className="admin-request-list">
          {pendingReservations.map((item) => (
            <article className="admin-request" key={item.id}>
              <span className="reservation-icon"><CalendarDays size={19} /></span>
              <div className="admin-request-main"><div className="loan-card-heading"><span className="card-category">{item.equipment?.asset_tag}</span><StatusPill value={item.status} /></div><h2>{item.equipment?.name || "Equipment"}</h2><p>{item.requester_email || item.requester_id} · {item.purpose}</p><small>{dateLabel(item.start_date)} – {dateLabel(item.end_date)} · {item.location_of_use}</small></div>
              <div className="admin-actions">
                <button className="button-secondary" disabled={busy} onClick={() => runAction(() => supabase.rpc("review_equipment_reservation", { p_reservation_id: item.id, p_action: "reject" }), "Reservation declined.")}>Decline</button>
                <button className="button-primary" disabled={busy} onClick={() => runAction(() => supabase.rpc("review_equipment_reservation", { p_reservation_id: item.id, p_action: "approve" }), "Reservation approved.")}><Check size={15} /> Approve</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function EquipmentTable({ equipment, onEdit, onDelete }) {
  if (!equipment.length) return <EmptyState title="No equipment records" copy="Add the first item to start your inventory." />;
  return (
    <div className="table-wrap inventory-table">
      <table><thead><tr><th>Asset</th><th>Category</th><th>Available / total</th><th>Storage</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{equipment.map((item) => <tr key={item.id}>
          <td><div className="inventory-asset">{item.image_url && <img src={item.image_url} alt="" />}<div><strong>{item.name}</strong><small>{item.asset_tag}</small></div></div></td><td>{item.category || "—"}</td><td>{item.available_quantity ?? "—"} / {item.quantity}</td><td>{item.location || "—"}</td><td><StatusPill value={item.quantity === 0 || item.available_quantity === 0 ? "out_of_stock" : item.status} /></td>
          <td><div className="table-actions">
            <button type="button" className="button-secondary" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={14} /> Edit</button>
            <button type="button" className="button-danger" onClick={() => onDelete(item)} aria-label={`Remove ${item.name}`}><Trash2 size={14} /> Delete</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function EquipmentAuditLog({ entries }) {
  if (!entries.length) return <EmptyState title="No equipment changes recorded" copy="Equipment additions, edits, and removals will be captured here automatically." />;
  return (
    <div className="audit-list">
      {entries.map((entry) => (
        <article className="audit-entry" key={entry.id}>
          <span className={`audit-mark audit-${entry.action}`}><Activity size={16} /></span>
          <div className="audit-entry-main">
            <strong>{entry.action === "insert" ? "Equipment added" : entry.action === "delete" ? "Equipment removed" : "Equipment updated"}</strong>
            <p>{entry.asset_tag} · {entry.changed_fields.join(", ")}</p>
            <small>{new Date(entry.changed_at).toLocaleString()} · User {entry.actor_id || "unknown"}</small>
            <details>
              <summary>Show recorded values</summary>
              <div className="audit-values">
                {entry.old_values && <div><b>Before</b><pre>{JSON.stringify(entry.old_values, null, 2)}</pre></div>}
                {entry.new_values && <div><b>After</b><pre>{JSON.stringify(entry.new_values, null, 2)}</pre></div>}
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}

function AccountSettings({ profile, user, busy, onSave }) {
  return (
    <section className="account-panel">
      <div className="account-panel-heading">
        <span className="toolbar-icon"><Settings size={18} /></span>
        <div><h2>Profile information</h2><p>Update the information shown to other workspace members.</p></div>
      </div>
      <form className="modal-form account-form" onSubmit={onSave}>
        <label><span>Full name</span><input name="display_name" defaultValue={profile?.display_name || ""} autoComplete="name" required maxLength={120} /></label>
        <label><span>Email address</span><input value={user.email || ""} readOnly /></label>
        <div className="form-row">
          <label><span>Department</span><input name="department" defaultValue={profile?.department || ""} maxLength={120} placeholder="Your department" required /></label>
          <label><span>Course</span><input name="course" defaultValue={profile?.course || ""} maxLength={120} placeholder="Your course" required /></label>
        </div>
        <label><span>Gender</span><select name="gender" defaultValue={profile?.gender || ""} required><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option><option value="Other">Other</option></select></label>
        <div className="account-form-actions"><span>Your role: <strong>{profile?.role || "member"}</strong></span><button className="button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save account settings"} <Check size={15} /></button></div>
      </form>
    </section>
  );
}

function FeedbackBoard({ threads, currentUserId, isAdmin, busy, onCreate, onReply, onStatusChange }) {
  const statusLabels = {
    open: "Open",
    under_review: "Under review",
    planned: "Planned",
    implemented: "Implemented",
  };
  return (
    <div className="feedback-board">
      <section className="feedback-compose">
        <div className="feedback-compose-heading"><span className="toolbar-icon"><MessageSquare size={18} /></span><div><h2>Start a conversation</h2><p>Suggest a feature, report an issue, or ask how the system should work in the future.</p></div></div>
        <form className="feedback-form" onSubmit={onCreate}>
          <label><span>Topic</span><input name="title" placeholder="A short title for your feedback" maxLength={140} required /></label>
          <div className="form-row">
            <label><span>Type</span><select name="category" defaultValue="suggestion"><option value="suggestion">Suggestion</option><option value="issue">Issue</option><option value="question">Question</option><option value="other">Other</option></select></label>
            <label className="feedback-message-label"><span>Your message</span><textarea name="message" placeholder="Share details so members and admins can discuss it…" rows="3" maxLength={4000} required /></label>
          </div>
          <div className="feedback-submit-row"><small>Visible to signed-in members and admins.</small><button className="button-primary" type="submit" disabled={busy}>{busy ? "Posting…" : "Post feedback"} <Send size={14} /></button></div>
        </form>
      </section>

      <div className="section-title"><div><h2>Community feedback</h2><p>Ideas and updates shared across the equipment community</p></div><span className="record-count">{threads.length} topics</span></div>
      {!threads.length ? <EmptyState title="Start the first conversation" copy="Your feedback will help members and admins decide what to improve next." /> : (
        <div className="feedback-thread-list">
          {threads.map((thread) => (
            <article className="feedback-thread" key={thread.id}>
              <header className="feedback-thread-header">
                <div><span className={`feedback-category category-${thread.category}`}>{thread.category.replaceAll("_", " ")}</span><span className={`feedback-status status-${thread.status}`}>{statusLabels[thread.status]}</span></div>
                {isAdmin && <label className="feedback-status-control"><span className="sr-only">Update discussion status</span><select value={thread.status} disabled={busy} onChange={(event) => onStatusChange(thread.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              </header>
              <h3>{thread.title}</h3>
              <p className="feedback-thread-message">{thread.message}</p>
              <div className="feedback-byline">Started by {thread.author_name} · {new Date(thread.created_at).toLocaleString()}</div>
              {!!thread.replies.length && <div className="feedback-replies">{thread.replies.map((reply) => (
                <div className="feedback-reply" key={reply.id}>
                  <div><strong>{reply.author_name}{reply.author_id === currentUserId ? " (you)" : ""}</strong><time>{new Date(reply.created_at).toLocaleString()}</time></div>
                  <p>{reply.message}</p>
                </div>
              ))}</div>}
              <form className="feedback-reply-form" onSubmit={(event) => onReply(event, thread.id)}>
                <label><span className="sr-only">Reply to {thread.title}</span><textarea name="reply" placeholder="Add a reply to this discussion…" rows="2" maxLength={2000} required /></label>
                <button className="button-secondary" type="submit" disabled={busy}><Send size={14} /> Reply</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberTable({ members, currentUserId, runAction, supabase }) {
  if (!members.length) return <EmptyState title="No member accounts yet" copy="Accounts will appear here after users sign up and confirm their email." />;
  return (
    <div className="table-wrap inventory-table">
      <table><thead><tr><th>Member</th><th>Account status</th><th>Role</th><th>Account created</th></tr></thead>
        <tbody>{members.map((member) => (
          <tr key={member.id}>
            <td><strong>{member.display_name || "Unnamed member"}</strong><small>{member.email || "Email not available"}</small></td>
            <td>{member.account_status || "—"}</td>
            <td>
              <select
                aria-label={`Change role for ${member.display_name || member.email}`}
                value={member.role}
                disabled={member.id === currentUserId}
                onChange={(event) => runAction(
                  () => supabase.rpc("set_profile_role", { p_user_id: member.id, p_role: event.target.value }),
                  "Member role updated.",
                )}
              >
                <option value="staff">Staff member</option>
                <option value="property_custodian">Property custodian</option>
                <option value="admin">Administrator</option>
              </select>
            </td>
            <td>{dateLabel(member.created_at?.slice(0, 10))}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="table-note">Your own role cannot be changed here. Ask another administrator if you need to change your access.</p>
    </div>
  );
}
