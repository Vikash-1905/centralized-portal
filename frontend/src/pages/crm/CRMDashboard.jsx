import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import useAuth from "../../hooks/useAuth";
import useSchoolData from "../../hooks/useSchoolData";
import { formatDate } from "../../utils/schoolMetrics";

const CRM_STAGES = [
  "New Lead",
  "Contacted",
  "Visit Scheduled",
  "Applied",
  "Converted",
  "Rejected",
];

const PIPELINE_FLOW_STAGES = [
  "New Lead",
  "Contacted",
  "Visit Scheduled",
  "Applied",
  "Converted",
];

const STAGE_RANK = {
  "New Lead": 1,
  Contacted: 2,
  "Visit Scheduled": 3,
  Applied: 4,
  Converted: 6,
  Rejected: 0,
};

const LEGACY_STAGE_MAP = {
  new: "New Lead",
  "new lead": "New Lead",
  counselling: "Contacted",
  interested: "Contacted",
  "campus visit": "Visit Scheduled",
  application: "Applied",
  admitted: "Converted",
  "follow-up today": "Contacted",
  "campus visit booked": "Visit Scheduled",
  "application shared": "Applied",
};

const SYSTEM_OWNER_ROLES = new Set(["admin", "crm"]);
const CRM_SOURCE_OPTIONS = ["Website", "Walk-in", "Referral", "Instagram", "Phone"];
const CRM_STATUS_OPTIONS = ["Active", "Contacted", "Converted", "Rejected"];
const CRM_PREFERENCES_STORAGE_KEY = "crm-preferences-v2";

const getSavedCRMPreferences = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CRM_PREFERENCES_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const isClosedStage = (stage) => stage === "Converted" || stage === "Rejected";

const getTodayISO = () => new Date().toISOString().slice(0, 10);

const normalizeStage = (value, status) => {
  const candidate = String(value || status || "").trim();
  if (!candidate) {
    return "New Lead";
  }

  const normalizedKey = candidate.toLowerCase();
  if (LEGACY_STAGE_MAP[normalizedKey]) {
    return LEGACY_STAGE_MAP[normalizedKey];
  }

  const matched = CRM_STAGES.find((entry) => entry.toLowerCase() === normalizedKey);
  return matched || "New Lead";
};

const normalizeStatus = (value, stage) => {
  const normalizedStage = normalizeStage(stage, value);
  const candidate = String(value || "").trim();
  if (!candidate) {
    return normalizedStage;
  }

  const normalizedKey = candidate.toLowerCase();
  if (LEGACY_STAGE_MAP[normalizedKey]) {
    return LEGACY_STAGE_MAP[normalizedKey];
  }

  const matched = CRM_STAGES.find((entry) => entry.toLowerCase() === normalizedKey);
  return matched || normalizedStage;
};

const createClientNote = (text, author, createdAt = getTodayISO()) => ({
  id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text: String(text || "").trim(),
  author: String(author || "CRM").trim() || "CRM",
  createdAt,
});

const createClientActivity = (type, text, actor, createdAt = getTodayISO()) => ({
  id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: String(type || "update").trim() || "update",
  text: String(text || "").trim(),
  actor: String(actor || "CRM").trim() || "CRM",
  createdAt,
});

const normalizeNotes = (value, fallbackAuthor = "CRM", fallbackDate = getTodayISO()) => {
  const toNoteEntry = (entry, index) => {
    if (typeof entry === "string") {
      const text = entry.trim();
      return text
        ? {
            id: `note-legacy-${index}`,
            text,
            author: fallbackAuthor,
            createdAt: fallbackDate,
          }
        : null;
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const text = String(entry.text || entry.note || entry.message || "").trim();
    if (!text) {
      return null;
    }

    return {
      id: String(entry.id || `note-${index}`).trim(),
      text,
      author: String(entry.author || fallbackAuthor).trim() || fallbackAuthor,
      createdAt: String(entry.createdAt || entry.date || fallbackDate).trim().slice(0, 10),
    };
  };

  if (Array.isArray(value)) {
    return value.map((entry, index) => toNoteEntry(entry, index)).filter(Boolean);
  }

  const single = toNoteEntry(value, 0);
  return single ? [single] : [];
};

const normalizeActivity = (value, fallbackActor = "CRM", fallbackDate = getTodayISO()) => {
  const toActivityEntry = (entry, index) => {
    if (typeof entry === "string") {
      const text = entry.trim();
      return text
        ? {
            id: `activity-legacy-${index}`,
            type: "note",
            text,
            actor: fallbackActor,
            createdAt: fallbackDate,
          }
        : null;
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const text = String(entry.text || entry.message || entry.label || "").trim();
    if (!text) {
      return null;
    }

    return {
      id: String(entry.id || `activity-${index}`).trim(),
      type: String(entry.type || "update").trim() || "update",
      text,
      actor: String(entry.actor || fallbackActor).trim() || fallbackActor,
      createdAt: String(entry.createdAt || entry.date || fallbackDate).trim().slice(0, 10),
    };
  };

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => toActivityEntry(entry, index)).filter(Boolean);
};

const normalizeCallHistory = (value, fallbackActor = "CRM", fallbackDate = getTodayISO()) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const label = String(entry.label || entry.text || "").trim();
      if (!label) {
        return null;
      }

      return {
        id: String(entry.id || `call-${index}`).trim(),
        label,
        outcome: String(entry.outcome || "Connected").trim() || "Connected",
        createdAt: String(entry.createdAt || entry.date || fallbackDate).trim().slice(0, 10),
        actor: String(entry.actor || fallbackActor).trim() || fallbackActor,
      };
    })
    .filter(Boolean);
};

const buildLeadSearchText = (lead) =>
  [
    lead.studentName,
    lead.parentName,
    lead.phone,
    lead.email,
    lead.source,
    lead.assignedTo,
    lead.stage,
    lead.status,
  ]
    .join(" ")
    .toLowerCase();

const createConvertDraftFromLead = (lead) => {
  const parentName = String(lead?.parentName || lead?.guardianName || "").trim();

  return {
    leadId: String(lead?.id || "").trim(),
    studentName: String(lead?.studentName || "").trim(),
    parentName,
    phone: String(lead?.phone || "").trim(),
    classInterest: String(lead?.classInterest || "").trim(),
    dateOfBirth: "",
    address: "",
    totalFees: "",
    documentsNote: "",
  };
};

const getEmptyConvertDraft = () => createConvertDraftFromLead({});

const getLeadConversionStatus = (lead = {}) => {
  const convertedStudentId = String(lead.convertedStudentId || "").trim();
  if (convertedStudentId) {
    return "Converted";
  }

  const raw = String(lead.conversionStatus || "").trim();
  if (raw) {
    return raw;
  }

  return lead.isConverted ? "In Progress" : "Not Converted";
};

function CRMDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { schoolData, saveEnquiry, deleteEnquiry, convertEnquiry } = useSchoolData();

  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = getSavedCRMPreferences();
    return typeof saved.searchTerm === "string" ? saved.searchTerm : "";
  });
  const [stageFilter, setStageFilter] = useState(() => {
    const saved = getSavedCRMPreferences();
    return saved.stageFilter === "All" || CRM_STAGES.includes(saved.stageFilter)
      ? saved.stageFilter
      : "All";
  });
  const [ownerFilter, setOwnerFilter] = useState(() => {
    const saved = getSavedCRMPreferences();
    return typeof saved.ownerFilter === "string" && saved.ownerFilter.trim()
      ? saved.ownerFilter
      : "All";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = getSavedCRMPreferences();
    return typeof saved.statusFilter === "string" && saved.statusFilter.trim()
      ? saved.statusFilter
      : "All";
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    studentName: "",
    guardianName: "",
    classInterest: "",
    phone: "",
    email: "",
    source: CRM_SOURCE_OPTIONS[0],
    assignedTo: "",
    stage: "New Lead",
    status: "Active",
    followUpDate: getTodayISO(),
    notes: "",
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [activePipelineStage, setActivePipelineStage] = useState(PIPELINE_FLOW_STAGES[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDraft, setDrawerDraft] = useState({
    stage: "New Lead",
    status: "Active",
    assignedTo: "",
    followUpDate: getTodayISO(),
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isSubmittingConversion, setIsSubmittingConversion] = useState(false);
  const [convertDraft, setConvertDraft] = useState(getEmptyConvertDraft);
  const [deleteTargetLeadId, setDeleteTargetLeadId] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [savingLeadId, setSavingLeadId] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const todayISO = getTodayISO();
  const canManageEnquiries = user?.role === "crm" || user?.role === "admin";
  const canOpenAdmissionForm = user?.role === "admin";
  const classMasterOptions = useMemo(
    () =>
      [...new Set(
        (Array.isArray(schoolData?.classes) ? schoolData.classes : [])
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      )].sort((first, second) => first.localeCompare(second)),
    [schoolData?.classes]
  );
  const defaultClassInterest = classMasterOptions[0] || "";

  const leads = useMemo(() => {
    const enquiryRows = Array.isArray(schoolData?.enquiries) ? schoolData.enquiries : [];

    return enquiryRows
      .map((entry, index) => {
        const leadId = String(entry.id || `lead-${index + 1}`).trim() || `lead-${index + 1}`;
        const stage = normalizeStage(entry.stage, entry.status);
        const status = normalizeStatus(entry.status, stage);
        const convertedStudentId = String(entry.convertedStudentId || "").trim();
        const isConverted = Boolean(convertedStudentId) || Boolean(entry.isConverted);
        const conversionStatus = getLeadConversionStatus({
          ...entry,
          convertedStudentId,
          isConverted,
        });
        const parentName = String(entry.parentName || entry.guardianName || "").trim();
        const assignedTo = String(entry.assignedTo || entry.owner || "").trim();
        const createdAt = String(entry.createdAt || todayISO).trim().slice(0, 10);
        const notes = normalizeNotes(entry.notes, assignedTo || "CRM", createdAt);
        const activity = normalizeActivity(entry.activity, assignedTo || "CRM", createdAt);

        if (!activity.length) {
          activity.push(createClientActivity("created", "Lead created", assignedTo || "CRM", createdAt));
        }

        const followUpDate = String(entry.followUpDate || createdAt).trim().slice(0, 10);
        const hasFollowUpDate = Boolean(String(entry.followUpDate || "").trim());
        const isFollowUpToday = hasFollowUpDate && followUpDate === todayISO && !isClosedStage(stage);
        const isOverdue = hasFollowUpDate && followUpDate < todayISO && !isClosedStage(stage);

        return {
          ...entry,
          id: leadId,
          parentName,
          guardianName: parentName,
          assignedTo,
          owner: assignedTo,
          stage,
          status,
          source: String(entry.source || "Website").trim() || "Website",
          followUpDate,
          notes,
          activity,
          callHistory: normalizeCallHistory(entry.callHistory, assignedTo || "CRM", createdAt),
          convertedStudentId,
          isConverted,
          conversionStatus,
          createdAt,
          lastUpdatedAt: String(entry.lastUpdatedAt || entry.updatedAt || createdAt)
            .trim()
            .slice(0, 10),
          hasFollowUpDate,
          isFollowUpToday,
          isOverdue,
          isUrgent: isFollowUpToday || isOverdue,
        };
      })
      .sort((first, second) => String(first.followUpDate).localeCompare(String(second.followUpDate)));
  }, [schoolData?.enquiries, todayISO]);

  useEffect(() => {
    if (!leads.length) {
      setSelectedLeadId("");
      setDrawerOpen(false);
      return;
    }

    if (!selectedLeadId) {
      setSelectedLeadId(leads[0].id);
      return;
    }

    const selectedExists = leads.some((entry) => entry.id === selectedLeadId);
    if (selectedExists) {
      return;
    }

    if (drawerOpen) {
      setDrawerOpen(false);
    }

    setSelectedLeadId(leads[0].id);
  }, [leads, selectedLeadId, drawerOpen]);

  const selectedLead = useMemo(
    () => leads.find((entry) => entry.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  const deleteTargetLead = useMemo(
    () => leads.find((entry) => entry.id === deleteTargetLeadId) || null,
    [leads, deleteTargetLeadId]
  );

  const leadOwnerOptions = useMemo(() => {
    const optionMap = new Map();

    (Array.isArray(schoolData?.users) ? schoolData.users : [])
      .filter(
        (account) =>
          SYSTEM_OWNER_ROLES.has(String(account.role || "").toLowerCase()) &&
          String(account.status || "Active").toLowerCase() !== "inactive"
      )
      .map((account) => String(account.name || "").trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name.toLowerCase();
        if (!optionMap.has(key)) {
          optionMap.set(key, name);
        }
      });

    [
      selectedLead?.assignedTo,
      selectedLead?.owner,
      drawerDraft.assignedTo,
      createDraft.assignedTo,
      user?.name,
    ]
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name.toLowerCase();
        if (!optionMap.has(key)) {
          optionMap.set(key, name);
        }
      });

    return [...optionMap.values()].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [schoolData?.users, selectedLead?.assignedTo, selectedLead?.owner, drawerDraft.assignedTo, createDraft.assignedTo, user?.name]);

  const defaultLeadOwner = leadOwnerOptions[0] || "";

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    setDrawerDraft({
      stage: selectedLead.stage,
      status: selectedLead.status,
      assignedTo: selectedLead.assignedTo || defaultLeadOwner,
      followUpDate: selectedLead.followUpDate,
    });
    setNoteDraft("");
  }, [selectedLead, defaultLeadOwner]);

  const ownerFilterOptions = useMemo(
    () => {
      const owners = [
        ...new Set(
          leads
            .map((entry) => String(entry.assignedTo || "").trim())
            .filter(Boolean)
        ),
      ];

      const hasUnassigned = leads.some((entry) => !String(entry.assignedTo || "").trim());

      return [
        "All",
        ...(hasUnassigned || ownerFilter === "Unassigned" ? ["Unassigned"] : []),
        ...owners,
      ];
    },
    [leads, ownerFilter]
  );

  const statusFilterOptions = useMemo(
    () => [
      "All",
      "Today",
      "Overdue",
      ...new Set(
        leads
          .map((entry) => String(entry.status || "").trim())
          .filter(Boolean)
      ),
    ],
    [leads]
  );

  useEffect(() => {
    if (ownerFilter === "All") {
      return;
    }

    if (!ownerFilterOptions.includes(ownerFilter)) {
      setOwnerFilter("All");
    }
  }, [ownerFilter, ownerFilterOptions]);

  useEffect(() => {
    if (statusFilter === "All") {
      return;
    }

    if (!statusFilterOptions.includes(statusFilter)) {
      setStatusFilter("All");
    }
  }, [statusFilter, statusFilterOptions]);

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !normalizedSearch || buildLeadSearchText(lead).includes(normalizedSearch);
      const matchesStage = stageFilter === "All" || lead.stage === stageFilter;
      const matchesOwner =
        ownerFilter === "All"
          ? true
          : ownerFilter === "Unassigned"
            ? !String(lead.assignedTo || "").trim()
            : lead.assignedTo === ownerFilter;
      const matchesStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Today"
            ? lead.isFollowUpToday
            : statusFilter === "Overdue"
              ? lead.isOverdue
              : lead.status === statusFilter;

      return matchesSearch && matchesStage && matchesOwner && matchesStatus;
    });
  }, [leads, searchTerm, stageFilter, ownerFilter, statusFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (searchTerm.trim()) {
      count += 1;
    }
    if (stageFilter !== "All") {
      count += 1;
    }
    if (ownerFilter !== "All") {
      count += 1;
    }
    if (statusFilter !== "All") {
      count += 1;
    }

    return count;
  }, [searchTerm, stageFilter, ownerFilter, statusFilter]);

  const pipelineByStage = useMemo(() => {
    const grouped = Object.fromEntries(CRM_STAGES.map((stage) => [stage, []]));

    filteredLeads.forEach((lead) => {
      if (grouped[lead.stage]) {
        grouped[lead.stage].push(lead);
      }
    });

    CRM_STAGES.forEach((stage) => {
      grouped[stage].sort((first, second) => {
        if (first.isUrgent !== second.isUrgent) {
          return first.isUrgent ? -1 : 1;
        }

        return String(first.followUpDate || "").localeCompare(String(second.followUpDate || ""));
      });
    });

    return grouped;
  }, [filteredLeads]);

  const activePipelineLeads = useMemo(
    () => pipelineByStage[activePipelineStage] || [],
    [pipelineByStage, activePipelineStage]
  );

  useEffect(() => {
    if (!PIPELINE_FLOW_STAGES.includes(activePipelineStage)) {
      setActivePipelineStage(PIPELINE_FLOW_STAGES[0]);
      return;
    }

    if (!filteredLeads.length) {
      return;
    }
  }, [activePipelineStage, filteredLeads.length, pipelineByStage]);

  const clearFilters = () => {
    setSearchTerm("");
    setStageFilter("All");
    setOwnerFilter("All");
    setStatusFilter("All");
  };

  const followUpTodayLeads = useMemo(
    () =>
      leads
        .filter((lead) => lead.isFollowUpToday)
        .sort((first, second) => String(first.followUpDate).localeCompare(String(second.followUpDate)))
        .slice(0, 6),
    [leads]
  );

  const overdueLeads = useMemo(
    () =>
      leads
        .filter((lead) => lead.isOverdue)
        .sort((first, second) => String(first.followUpDate).localeCompare(String(second.followUpDate))),
    [leads]
  );

  const todaysTasks = (() => {
    const tasks = [];

    followUpTodayLeads.slice(0, 3).forEach((lead) => {
      tasks.push({
        id: `call-${lead.id}`,
        label: `Call ${lead.studentName}`,
        detail: `Follow-up due today for ${lead.parentName || "Parent"}`,
        action: () => {
          void handleCallLead(lead);
        },
      });
    });

    if (overdueLeads.length) {
      tasks.push({
        id: "overdue-summary",
        label: `Review ${overdueLeads.length} overdue lead${overdueLeads.length > 1 ? "s" : ""}`,
        detail: "Prioritize urgent follow-up first",
        action: () => {
          const priorityLead = overdueLeads[0];
          if (priorityLead) {
            openLeadDrawer(priorityLead.id);
          }
        },
      });
    }

    const visitCandidate = leads.find(
      (lead) => lead.stage === "Contacted" && !lead.isOverdue
    );
    if (visitCandidate) {
      tasks.push({
        id: "visit-suggestion",
        label: `Schedule visit for ${visitCandidate.studentName}`,
        detail: "Move qualified lead to Visit Scheduled",
        action: () => {
          openLeadDrawer(visitCandidate.id);
        },
      });
    }

    return tasks.slice(0, 5);
  })();

  const nextBestActions = useMemo(() => {
    const actions = [];
    const overdueCount = leads.filter((lead) => lead.isOverdue).length;
    const readyToConvertCount = leads.filter(
      (lead) => lead.stage === "Applied" && !lead.convertedStudentId
    ).length;

    if (overdueCount) {
      actions.push(`Call ${overdueCount} overdue lead${overdueCount > 1 ? "s" : ""}`);
    }

    if (readyToConvertCount) {
      actions.push(`${readyToConvertCount} lead${readyToConvertCount > 1 ? "s are" : " is"} ready to convert`);
    }

    if (!actions.length) {
      actions.push("No urgent backlog. Focus on today follow-ups to keep momentum.");
    }

    return actions;
  }, [leads]);

  const cards = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((lead) => lead.stage === "Converted" || lead.convertedStudentId).length;
    const urgent = leads.filter((lead) => lead.isUrgent).length;
    const active = leads.filter((lead) => !isClosedStage(lead.stage)).length;
    const conversionRate = total ? Math.round((converted / total) * 100) : 0;

    return [
      {
        title: "Total Leads",
        value: total,
        subtitle: `${active} active in pipeline`,
        accent: "bg-slate-900",
      },
      {
        title: "Follow-ups Today",
        value: followUpTodayLeads.length,
        subtitle: urgent ? `${urgent} urgent leads` : "No urgent leads",
        accent: "bg-rose-500",
      },
      {
        title: "Conversion Rate",
        value: `${conversionRate}%`,
        subtitle: `${converted} converted admissions`,
        accent: "bg-emerald-500",
      },
      {
        title: "Overdue",
        value: leads.filter((lead) => lead.isOverdue).length,
        subtitle: "Needs immediate action",
        accent: "bg-amber-500",
      },
    ];
  }, [leads, followUpTodayLeads.length]);

  const openCreateModal = (preferredStage = "New Lead") => {
    const normalizedStage = CRM_STAGES.includes(preferredStage) ? preferredStage : "New Lead";

    setCreateDraft({
      studentName: "",
      guardianName: "",
      classInterest: String(defaultClassInterest || "").trim(),
      phone: "",
      email: "",
      source: CRM_SOURCE_OPTIONS[0],
      assignedTo: user?.name || defaultLeadOwner,
      stage: normalizedStage,
      status: "Active",
      followUpDate: getTodayISO(),
      notes: "",
    });
    setActionError("");
    setMessage("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }

    setIsCreateModalOpen(false);
  };

  const handleCreateInputChange = (event) => {
    const { name, value } = event.target;

    setCreateDraft((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreateLead = async (event) => {
    event.preventDefault();

    if (!canManageEnquiries) {
      setActionError("You do not have permission to add enquiries.");
      return;
    }

    const studentName = String(createDraft.studentName || "").trim();
    const guardianName = String(createDraft.guardianName || "").trim();

    if (!studentName || !guardianName) {
      setActionError("Student and guardian name are required.");
      return;
    }

    const owner =
      String(createDraft.assignedTo || defaultLeadOwner || user?.name || "CRM")
        .trim() || "CRM";

    setIsCreating(true);
    setActionError("");
    setMessage("");

    try {
      await saveEnquiry({
        studentName,
        parentName: guardianName,
        guardianName,
        classInterest:
          String(createDraft.classInterest || defaultClassInterest).trim() || defaultClassInterest,
        phone: String(createDraft.phone || "").trim(),
        email: String(createDraft.email || "").trim().toLowerCase(),
        source: String(createDraft.source || CRM_SOURCE_OPTIONS[0]).trim() || CRM_SOURCE_OPTIONS[0],
        assignedTo: owner,
        owner,
        stage: String(createDraft.stage || "New Lead").trim() || "New Lead",
        status: String(createDraft.status || "Active").trim() || "Active",
        followUpDate:
          String(createDraft.followUpDate || getTodayISO())
            .trim()
            .slice(0, 10) || getTodayISO(),
        notes: String(createDraft.notes || "").trim(),
      });

      setMessage(`${studentName} enquiry was added to CRM.`);
      setIsCreateModalOpen(false);
    } catch (error) {
      setActionError(error.message || "Unable to create enquiry.");
      setMessage("");
    } finally {
      setIsCreating(false);
    }
  };

  const saveLeadChanges = async (lead, updates, successMessage) => {
    if (!lead) {
      setActionError("No lead available to update.");
      return;
    }

    const nextAssignedTo = String(
      updates?.assignedTo ?? lead.assignedTo ?? lead.owner ?? user?.name ?? "CRM"
    )
      .trim()
      || "CRM";
    const nextStage = String(updates?.stage ?? lead.stage ?? "New Lead").trim() || "New Lead";
    const nextStatus = String(updates?.status ?? lead.status ?? "Active").trim() || "Active";
    const nextFollowUpDate =
      String(updates?.followUpDate ?? lead.followUpDate ?? getTodayISO())
        .trim()
        .slice(0, 10) || getTodayISO();

    const payload = {
      ...lead,
      ...updates,
      parentName: String(updates?.parentName ?? lead.parentName ?? lead.guardianName ?? "").trim(),
      guardianName: String(updates?.guardianName ?? lead.guardianName ?? lead.parentName ?? "").trim(),
      assignedTo: nextAssignedTo,
      owner: nextAssignedTo,
      stage: nextStage,
      status: nextStatus,
      followUpDate: nextFollowUpDate,
    };

    setActionError("");
    setMessage("");
    setSavingLeadId(String(lead.id || ""));

    try {
      await saveEnquiry(payload);
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setActionError(error.message || "Unable to update enquiry.");
    } finally {
      setSavingLeadId("");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      CRM_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        searchTerm,
        stageFilter,
        ownerFilter,
        statusFilter,
      })
    );
  }, [searchTerm, stageFilter, ownerFilter, statusFilter]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (isDeleteModalOpen) {
        if (savingLeadId) {
          return;
        }

        setIsDeleteModalOpen(false);
        setDeleteTargetLeadId("");
        return;
      }

      if (isConvertModalOpen) {
        if (isSubmittingConversion) {
          return;
        }

        setIsConvertModalOpen(false);
        setConvertDraft(getEmptyConvertDraft());
        return;
      }

      if (isCreateModalOpen) {
        if (isCreating) {
          return;
        }

        setIsCreateModalOpen(false);
        return;
      }

      if (drawerOpen) {
        setDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    drawerOpen,
    isCreateModalOpen,
    isConvertModalOpen,
    isDeleteModalOpen,
    isCreating,
    isSubmittingConversion,
    savingLeadId,
  ]);

  const pickActionLead = (preferredLead = null) =>
    preferredLead || selectedLead || filteredLeads[0] || leads[0] || null;

  const handleCallLead = async (preferredLead = null) => {
    const lead = pickActionLead(preferredLead);
    if (!lead) {
      setActionError("No lead available for call action.");
      return;
    }

    const actor = user?.name || lead.assignedTo || "CRM";
    const callHistory = [
      ...lead.callHistory,
      {
        id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: `Called ${lead.phone || "lead"}`,
        outcome: "Connected",
        actor,
        createdAt: getTodayISO(),
      },
    ];

    const activity = [
      ...lead.activity,
      createClientActivity("call", `Call logged for ${lead.phone || "lead"}`, actor),
    ];

    await saveLeadChanges(lead, { callHistory, activity }, `Call activity logged for ${lead.studentName}.`);
  };

  const handleWhatsAppLead = (preferredLead = null) => {
    const lead = pickActionLead(preferredLead);
    if (!lead) {
      setActionError("No lead available for WhatsApp action.");
      return;
    }

    const phoneDigits = String(lead.phone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      setActionError(`Phone number is missing for ${lead.studentName}.`);
      return;
    }

    const messageText = encodeURIComponent(
      `Hello ${lead.parentName || "Parent"}, this is a follow-up for ${lead.studentName}'s admission enquiry.`
    );
    window.open(`https://wa.me/${phoneDigits}?text=${messageText}`, "_blank", "noopener,noreferrer");
  };

  const openConvertModal = (lead) => {
    setConvertDraft(createConvertDraftFromLead(lead));
    setIsConvertModalOpen(true);
  };

  const closeConvertModal = (options = {}) => {
    if (isSubmittingConversion && !options.force) {
      return;
    }

    setIsConvertModalOpen(false);
    setConvertDraft(getEmptyConvertDraft());
  };

  const handleConvertDraftChange = (event) => {
    const { name, value } = event.target;
    setConvertDraft((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const buildAdmissionPrefillFromLead = (lead, draft) => {
    const parentName = String(draft.parentName || lead.parentName || lead.guardianName || "").trim();
    const totalFees = Number(draft.totalFees);
    const hasFeeAmount = Number.isFinite(totalFees) && totalFees > 0;

    return {
      enquiryId: lead.id,
      studentName: String(draft.studentName || lead.studentName || "").trim(),
      parentName,
      guardianName: parentName,
      phone: String(draft.phone || lead.phone || "").trim(),
      className: String(draft.classInterest || lead.classInterest || "").trim(),
      classInterest: String(draft.classInterest || lead.classInterest || "").trim(),
      dateOfBirth: String(draft.dateOfBirth || "").trim(),
      address: String(draft.address || "").trim(),
      totalFees: hasFeeAmount ? totalFees : "",
      paidAmount: 0,
      admissionSource: "CRM",
      conversionStatus: "In Progress",
    };
  };

  const handleConvertLead = (preferredLead = null) => {
    const lead = pickActionLead(preferredLead);
    if (!lead) {
      setActionError("No lead selected for conversion.");
      return;
    }

    if (lead.convertedStudentId) {
      setMessage(`${lead.studentName} is already converted.`);
      setActionError("");
      return;
    }

    setActionError("");
    setMessage("");
    openConvertModal(lead);
  };

  const openDeleteLeadModal = (preferredLead = null) => {
    const lead = pickActionLead(preferredLead);
    if (!lead) {
      setActionError("No lead selected for delete action.");
      return;
    }

    if (!canManageEnquiries) {
      setActionError("You do not have permission to delete enquiries.");
      return;
    }

    setActionError("");
    setDeleteTargetLeadId(lead.id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = (options = {}) => {
    if (savingLeadId && !options.force) {
      return;
    }

    setIsDeleteModalOpen(false);
    setDeleteTargetLeadId("");
  };

  const handleDeleteLead = async () => {
    if (!deleteTargetLead) {
      setActionError("Lead not found. Refresh and try again.");
      closeDeleteModal({ force: true });
      return;
    }

    if (!canManageEnquiries) {
      setActionError("You do not have permission to delete enquiries.");
      return;
    }

    setActionError("");
    setMessage("");
    setSavingLeadId(deleteTargetLead.id);

    try {
      await deleteEnquiry(deleteTargetLead.id);
      if (selectedLeadId === deleteTargetLead.id) {
        setDrawerOpen(false);
      }
      setMessage(`${deleteTargetLead.studentName} enquiry deleted.`);
      closeDeleteModal({ force: true });
    } catch (error) {
      setActionError(error.message || "Unable to delete enquiry.");
    } finally {
      setSavingLeadId("");
    }
  };

  const handleConfirmAdmissionConversion = async (event) => {
    event.preventDefault();

    const lead =
      leads.find((entry) => String(entry.id) === String(convertDraft.leadId)) || pickActionLead();

    if (!lead) {
      setActionError("Lead was not found. Refresh and try again.");
      return;
    }

    const studentName = String(convertDraft.studentName || "").trim();
    const parentName = String(convertDraft.parentName || "").trim();
    const phone = String(convertDraft.phone || "").trim();
    const classInterest = String(convertDraft.classInterest || "").trim();

    if (!studentName || !parentName || !phone || !classInterest) {
      setActionError("Student name, parent name, phone, and class are required.");
      return;
    }

    setActionError("");
    setMessage("");
    setIsSubmittingConversion(true);
    setSavingLeadId(lead.id);

    try {
      await convertEnquiry(lead.id);

      if (canOpenAdmissionForm) {
        const admissionPrefill = buildAdmissionPrefillFromLead(lead, convertDraft);
        closeConvertModal({ force: true });
        navigate("/admin/students", {
          state: {
            admissionPrefill,
          },
        });
        return;
      }

      closeConvertModal({ force: true });
      setMessage(`${lead.studentName} marked as In Progress. Ask admin to complete admission.`);
    } catch (error) {
      setActionError(error.message || "Unable to start conversion.");
    } finally {
      setIsSubmittingConversion(false);
      setSavingLeadId("");
    }
  };

  const handleSaveDrawerChanges = async () => {
    if (!selectedLead) {
      return;
    }

    const activity = [
      ...selectedLead.activity,
      createClientActivity("update", "Lead details updated", user?.name || selectedLead.assignedTo || "CRM"),
    ];

    await saveLeadChanges(
      selectedLead,
      {
        stage: drawerDraft.stage,
        status: drawerDraft.status,
        assignedTo: drawerDraft.assignedTo,
        followUpDate: drawerDraft.followUpDate,
        activity,
      },
      `${selectedLead.studentName} details updated.`
    );
  };

  const handleAddNote = async () => {
    if (!selectedLead) {
      return;
    }

    const text = noteDraft.trim();
    if (!text) {
      return;
    }

    const author = user?.name || selectedLead.assignedTo || "CRM";
    const notes = [...selectedLead.notes, createClientNote(text, author)];
    const activity = [
      ...selectedLead.activity,
      createClientActivity("note", "Note added", author),
    ];

    await saveLeadChanges(selectedLead, { notes, activity }, `Note added for ${selectedLead.studentName}.`);
    setNoteDraft("");
  };

  const openLeadDrawer = (leadId) => {
    const normalizedId = String(leadId || "").trim();
    if (!normalizedId) {
      setActionError("Unable to open this enquiry. Please refresh and try again.");
      return;
    }

    if (!leads.some((entry) => entry.id === normalizedId)) {
      setActionError("Unable to open this enquiry. It may have been updated or removed.");
      return;
    }

    setActionError("");

    setSelectedLeadId(normalizedId);
    setDrawerOpen(true);
  };

  return (
    <DashboardLayout>
      <section className="rounded-3xl bg-gray-50 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admission CRM Dashboard</h1>
            <p className="mt-2 max-w-3xl text-slate-500">
              Sales-pipeline control center for enquiries, follow-ups, visits, applications, and
              conversions.
            </p>
          </div>

          {canManageEnquiries ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              + Add Enquiry
            </button>
          ) : null}
        </div>

        {message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}

        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {actionError}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((card) => (
            <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.subtitle}</p>
            </article>
          ))}
        </div>

        <section className="mb-6 rounded-[28px] border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Today's Tasks</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
              {overdueLeads.length} overdue
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-2">
              {todaysTasks.length ? (
                todaysTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={task.action}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-300 hover:shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-900">{task.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.detail}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                  No pending tasks for now. Pipeline is up to date.
                </p>
              )}
            </div>

            <aside className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900">Next Best Action</p>
              <ul className="mt-2 space-y-1.5 text-sm text-blue-800">
                {nextBestActions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>- {suggestion}</li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Search..."
            />

            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="All">Stage: All</option>
              {CRM_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  Stage: {stage}
                </option>
              ))}
            </select>

            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {ownerFilterOptions.map((owner) => (
                <option key={owner} value={owner}>
                  Owner: {owner}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {statusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  Status: {option}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredLeads.length} of {leads.length} leads
            {activeFilterCount ? ` | ${activeFilterCount} filters active` : ""}
          </p>
        </section>

        <section className="mb-6 rounded-[28px] border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/35 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">Lead Pipeline</h2>
              <p className="text-sm text-slate-500">Click a stage card to view the leads inside it.</p>
            </div>

            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-emerald-100 shadow-sm">
              Focus view: Stage cards
            </span>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            {PIPELINE_FLOW_STAGES.map((stage) => {
              const count = pipelineByStage[stage].length;
              const isActive = activePipelineStage === stage;

              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setActivePipelineStage(stage)}
                  className={`min-h-[100px] rounded-[18px] border p-3 text-left transition ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-100"
                      : count === 0
                        ? "border-slate-200/60 bg-slate-50/40 hover:border-slate-200/80"
                        : "border-slate-200 bg-white/90 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-slate-900">{stage}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive ? "bg-emerald-100 text-emerald-700" : count === 0 ? "bg-slate-100/50 text-slate-500" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {count ? `${count} lead${count > 1 ? "s" : ""}` : "No leads"}
                  </p>
                </button>
              );
            })}
          </div>

          <section className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-900">
                {activePipelineStage} Leads
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {activePipelineLeads.length}
              </span>
            </div>

            {activePipelineLeads.length ? (
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {activePipelineLeads.map((lead) => (
                  <article
                    key={`active-${lead.id}`}
                    onClick={() => openLeadDrawer(lead.id)}
                    className="cursor-pointer rounded-[16px] border border-emerald-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{lead.studentName}</p>
                        <p className="text-xs text-slate-500">{lead.phone || "No phone"}</p>
                      </div>
                      <span className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700">
                        ⋯
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-600">Stage: {lead.stage}</p>
                    <p className="mt-1 text-xs text-slate-600">Follow-up: {formatDate(lead.followUpDate)}</p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleCallLead(lead);
                        }}
                        className="rounded bg-blue-50 px-1.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Call
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleWhatsAppLead(lead);
                        }}
                        className="rounded bg-slate-100 px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        WhatsApp
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(lead.convertedStudentId) || savingLeadId === lead.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleConvertLead(lead);
                        }}
                        className="rounded bg-emerald-50 px-1.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Convert
                      </button>

                    </div>

                    <div className="mt-1.5">
                      <button
                        type="button"
                        disabled={savingLeadId === lead.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteLeadModal(lead);
                        }}
                        className="rounded bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingLeadId === lead.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] border border-dashed border-emerald-200 bg-white p-5 text-center">
                <p className="text-sm font-semibold text-slate-700">Empty</p>
                <p className="mt-1 text-xs text-slate-500">
                  No leads available in {activePipelineStage}.
                </p>
              </div>
            )}
          </section>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Leads Table</h2>
            <span className="text-xs text-slate-500">Secondary detail view</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Lead</th>
                  <th className="p-3 font-semibold">Stage</th>
                  <th className="p-3 font-semibold">Owner</th>
                  <th className="p-3 font-semibold">Follow-up</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    onClick={() => openLeadDrawer(lead.id)}
                  >
                    <td className="p-3">
                      <p className="font-semibold text-slate-800">{lead.studentName}</p>
                      <p className="text-xs text-slate-500">{lead.phone || "-"}</p>
                    </td>
                    <td className="p-3 text-slate-700">{lead.stage}</td>
                    <td className="p-3 text-slate-700">{lead.assignedTo || "Unassigned"}</td>
                    <td className="p-3 text-slate-700">{formatDate(lead.followUpDate)}</td>
                    <td className="p-3 text-slate-700">{lead.status}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCallLead(lead);
                          }}
                          className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleWhatsAppLead(lead);
                          }}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(lead.convertedStudentId) || savingLeadId === lead.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleConvertLead(lead);
                          }}
                          className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Convert
                        </button>
                        <button
                          type="button"
                          disabled={savingLeadId === lead.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            openDeleteLeadModal(lead);
                          }}
                          className="rounded bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingLeadId === lead.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredLeads.length ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={6}>
                      No leads match current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

      </section>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeCreateModal}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close create enquiry modal"
          />

          <section className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Add Enquiry</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Capture a lead and push it directly into the pipeline.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Student Name
                  <input
                    name="studentName"
                    value={createDraft.studentName}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Riya Malhotra"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Guardian Name
                  <input
                    name="guardianName"
                    value={createDraft.guardianName}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Sanjay Malhotra"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Class Interest
                  <select
                    name="classInterest"
                    value={createDraft.classInterest}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {classMasterOptions.length ? (
                      classMasterOptions.map((className) => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))
                    ) : (
                      <option value="">Add classes from Admin Masters</option>
                    )}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Source
                  <select
                    name="source"
                    value={createDraft.source}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {CRM_SOURCE_OPTIONS.map((source) => (
                      <option key={source}>{source}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Phone
                  <input
                    name="phone"
                    value={createDraft.phone}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="+91 90000 11111"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={createDraft.email}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="guardian@example.com"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Lead Owner
                  <select
                    name="assignedTo"
                    value={createDraft.assignedTo}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {leadOwnerOptions.length ? (
                      leadOwnerOptions.map((ownerName) => (
                        <option key={ownerName} value={ownerName}>
                          {ownerName}
                        </option>
                      ))
                    ) : (
                      <option value="">Add CRM/Admin users from Admin Users</option>
                    )}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Follow-up Date
                  <input
                    type="date"
                    name="followUpDate"
                    value={createDraft.followUpDate}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Stage
                  <select
                    name="stage"
                    value={createDraft.stage}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {CRM_STAGES.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Status
                  <select
                    name="status"
                    value={createDraft.status}
                    onChange={handleCreateInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {CRM_STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Notes
                  <textarea
                    name="notes"
                    value={createDraft.notes}
                    onChange={handleCreateInputChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Follow-up details"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreating}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreating ? "Saving..." : "Add Enquiry"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isConvertModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => closeConvertModal()}
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close conversion modal"
          />

          <section className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Convert to Admission</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Lead data is pre-filled from CRM. Complete admission details before final student creation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeConvertModal()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleConfirmAdmissionConversion} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Student Name
                  <input
                    name="studentName"
                    value={convertDraft.studentName}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Riya"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Parent Name
                  <input
                    name="parentName"
                    value={convertDraft.parentName}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Sanjay"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Phone
                  <input
                    name="phone"
                    value={convertDraft.phone}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="9876543210"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Class
                  <input
                    name="classInterest"
                    value={convertDraft.classInterest}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Class 6"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  DOB
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={convertDraft.dateOfBirth}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Total Fees
                  <input
                    type="number"
                    min="0"
                    name="totalFees"
                    value={convertDraft.totalFees}
                    onChange={handleConvertDraftChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="65000"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Address
                  <textarea
                    name="address"
                    value={convertDraft.address}
                    onChange={handleConvertDraftChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Street / Area / Landmark"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Documents Note
                  <textarea
                    name="documentsNote"
                    value={convertDraft.documentsNote}
                    onChange={handleConvertDraftChange}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Optional checklist for documents to collect"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                {canOpenAdmissionForm
                  ? "After confirmation, admission form will open with this data pre-filled. Complete mandatory sections to create the student."
                  : "Conversion will be marked In Progress. Admin must open Student Admission to complete and confirm conversion."}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => closeConvertModal()}
                  disabled={isSubmittingConversion}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConversion}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmittingConversion
                    ? "Starting..."
                    : canOpenAdmissionForm
                      ? "Confirm and Open Admission"
                      : "Mark In Progress"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {drawerOpen && selectedLead ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 bg-slate-900/30"
            aria-label="Close lead details"
          />

          <aside className="relative h-full w-full max-w-full overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:max-w-[420px] sm:p-5">
            {/* SECTION 1: HEADER - WHO IS THIS? */}
            <div className="mb-6 border-b border-slate-200 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedLead.studentName}</h2>
                  <p className="mt-1 text-sm text-slate-600">Parent: {selectedLead.parentName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg px-2 py-1 text-2xl text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Contact Info */}
              <div className="mt-4 space-y-2">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">📞</span>
                    <span className="font-medium text-slate-900">{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">✉</span>
                    <span className="font-medium text-slate-900">{selectedLead.email}</span>
                  </div>
                )}
                {selectedLead.source && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                      {selectedLead.source}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div class="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCallLead(selectedLead)}
                  class="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  title="Call lead"
                >
                  📞 Call
                </button>
                <button
                  type="button"
                  onClick={() => handleWhatsAppLead(selectedLead)}
                  class="flex-1 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                  title="Send WhatsApp message"
                >
                  💬 WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertLead(selectedLead)}
                  class="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  title="Convert lead to student"
                >
                  ✓ Convert
                </button>
              </div>
            </div>

            {/* SECTION 2: STATUS - WHERE IS LEAD? */}
            <div class="mb-6 border-b border-slate-200 pb-4">
              <p class="mb-3 text-xs font-semibold uppercase text-slate-500">Pipeline Stage</p>
              <div class="flex flex-wrap gap-1">
                {PIPELINE_FLOW_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setDrawerDraft((current) => ({ ...current, stage }))}
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      stage === drawerDraft.stage
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
            {/* SECTION 3: QUICK UPDATE - SIMPLIFIED CONTROLS */}
            <div className="mb-6 border-b border-slate-200 pb-4">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Update</p>

              <div className="space-y-3">
                <label className="block">
                  <p className="text-xs font-semibold text-slate-600">Assigned To</p>
                  <select
                    value={drawerDraft.assignedTo}
                    onChange={(event) =>
                      setDrawerDraft((current) => ({ ...current, assignedTo: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {leadOwnerOptions.length ? (
                      leadOwnerOptions.map((ownerName) => (
                        <option key={ownerName} value={ownerName}>
                          {ownerName}
                        </option>
                      ))
                    ) : (
                      <option value="">Add CRM/Admin users</option>
                    )}
                  </select>
                </label>

                <label className="block">
                  <p className="text-xs font-semibold text-slate-600">Follow-up Date</p>
                  <input
                    type="date"
                    value={drawerDraft.followUpDate}
                    onChange={(event) =>
                      setDrawerDraft((current) => ({ ...current, followUpDate: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveDrawerChanges()}
                  disabled={savingLeadId === selectedLead.id}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingLeadId === selectedLead.id ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            {/* SECTION 4: TIMELINE - WHAT HAPPENED? */}
            <div className="mb-6 border-b border-slate-200 pb-4">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Timeline</p>

              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {selectedLead.callHistory.length ? (
                  selectedLead.callHistory.slice(-5).reverse().map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <span className="text-xs font-bold text-emerald-700">●</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {entry.outcome} • {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : null}

                {selectedLead.activity.length ? (
                  selectedLead.activity.slice(-5).reverse().map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-xs font-bold text-blue-700">●</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{entry.text}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDate(entry.createdAt)}</p>
                      </div>
                    </div>
                  ))
                ) : null}

                {!selectedLead.callHistory.length && !selectedLead.activity.length ? (
                  <p className="text-xs text-slate-500">No activity yet</p>
                ) : null}
              </div>
            </div>

            {/* SECTION 5: NOTES - MINIMAL & CLEAN */}
            <div className="mb-6 border-b border-slate-200 pb-4">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Notes</p>

              <div className="space-y-2 max-h-32 overflow-y-auto pr-1 mb-3">
                {selectedLead.notes.length ? (
                  selectedLead.notes.slice(-3).map((note) => (
                    <div key={note.id} className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs text-slate-700">{note.text}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{formatDate(note.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No notes yet</p>
                )}
              </div>

              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Add a note..."
              />

              <button
                type="button"
                onClick={() => void handleAddNote()}
                className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                + Add Note
              </button>
            </div>

            {/* DELETE BUTTON - At bottom for visibility but not main action */}
            <button
              type="button"
              onClick={() => openDeleteLeadModal(selectedLead)}
              disabled={savingLeadId === selectedLead.id}
              className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingLeadId === selectedLead.id ? "Deleting..." : "🗑 Delete Enquiry"}
            </button>
          </aside>
        </div>
      ) : null}

      {isDeleteModalOpen && deleteTargetLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => closeDeleteModal()}
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close delete modal"
          />

          <section className="relative z-10 w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Delete Enquiry</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete {deleteTargetLead.studentName}?
            </p>
            <p className="mt-1 text-xs text-rose-700">
              This action is permanent and cannot be undone.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDeleteModal()}
                disabled={savingLeadId === deleteTargetLead.id}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteLead()}
                disabled={savingLeadId === deleteTargetLead.id}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingLeadId === deleteTargetLead.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default CRMDashboard;
