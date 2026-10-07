"use client";

import React, { FormEvent, KeyboardEvent, useEffect, useState, useMemo } from "react";
import {
  Search,
  Globe,
  ExternalLink,
  Bookmark,
  Share2,
  Sparkles,
  Layers,
  GraduationCap,
  User,
  Users,
  CheckCircle2,
  Lock,
  Eye,
  Plus,
  Pencil,
  Trash2,
  X,
  Code2,
  Tag,
  ArrowUpDown,
  BookOpen,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  FolderGit2,
} from "lucide-react";
import { authFetch, getCurrentUser, DecodedUser } from "@/lib/auth";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export interface ProjectStudentInfo {
  user: {
    id: string;
    name: string;
    studentId: string | null;
    email: string;
    currentSemester: number | null;
    department: {
      id: string;
      name: string;
      code: string;
    } | null;
    class: {
      batchYear: number;
      section: string | null;
      currentSemester: number;
    } | null;
  };
}

export interface ProjectMentorInfo {
  id: string;
  designation: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  domain: string;
  technologies: string[];
  githubUrl: string | null;
  liveDemoUrl: string | null;
  imageUrl: string | null;
  status: "PROPOSED" | "IN_PROGRESS" | "COMPLETED" | "PUBLISHED";
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  students?: ProjectStudentInfo[];
  mentor?: ProjectMentorInfo | null;
}

type ProjectForm = {
  title: string;
  description: string;
  domain: string;
  status: "PROPOSED" | "IN_PROGRESS" | "COMPLETED";
  technologies: string[];
  githubUrl: string;
  liveDemoUrl: string;
  imageUrl: string;
  isPublished: boolean;
};

const emptyForm: ProjectForm = {
  title: "",
  description: "",
  domain: "",
  status: "IN_PROGRESS",
  technologies: [],
  githubUrl: "",
  liveDemoUrl: "",
  imageUrl: "",
  isPublished: false,
};

const DOMAIN_OPTIONS = [
  "Artificial Intelligence",
  "Web & Cloud Platforms",
  "Internet of Things (IoT)",
  "Cybersecurity",
  "Mobile Applications",
  "Robotics & Automation",
  "Data Science & Analytics",
  "Blockchain & Web3",
  "Embedded Systems",
  "Other Engineering",
];

export default function ProjectsPage() {
  const [currentUser, setCurrentUser] = useState<DecodedUser | null>(null);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"community" | "my-projects" | "bookmarks">("community");

  // Data states
  const [communityProjects, setCommunityProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [loadingMyProjects, setLoadingMyProjects] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedSort, setSelectedSort] = useState<"newest" | "oldest" | "alphabetical">("newest");

  // Filter metadata (departments, dynamic domains)
  const [availableDepartments, setAvailableDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Bookmarks (stored in localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Modals & Action states
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);

  // Form states
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [technologyInput, setTechnologyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Initialize user and bookmarks
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    try {
      const saved = localStorage.getItem("acadify_bookmarked_projects");
      if (saved) {
        setBookmarkedIds(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save bookmarks
  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBookmarkedIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem("acadify_bookmarked_projects", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Fetch Community Projects
  const fetchCommunityProjects = async () => {
    setLoadingCommunity(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (selectedDomain !== "ALL") params.set("domain", selectedDomain);
      if (selectedDept !== "ALL") params.set("departmentId", selectedDept);
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedSort) params.set("sort", selectedSort);

      const res = await authFetch(`/projects/community?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCommunityProjects(data);
      }
    } catch (err: any) {
      setToast({ message: "Failed to load community projects", type: "error" });
    } finally {
      setLoadingCommunity(false);
    }
  };

  // Fetch Community Metadata (Departments, domains)
  const fetchMetadata = async () => {
    try {
      const res = await authFetch("/projects/community/meta");
      if (res.ok) {
        const data = await res.json();
        if (data.departments) setAvailableDepartments(data.departments);
      }
    } catch {
      // fallback
    }
  };

  // Fetch My Projects
  const fetchMyProjects = async () => {
    setLoadingMyProjects(true);
    try {
      const res = await authFetch("/projects");
      if (res.ok) {
        const data = await res.json();
        setMyProjects(data);
      }
    } catch (err: any) {
      setToast({ message: "Failed to load your personal projects", type: "error" });
    } finally {
      setLoadingMyProjects(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchMyProjects();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommunityProjects();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedDomain, selectedDept, selectedStatus, selectedSort]);

  // Form Handlers
  const openCreateForm = () => {
    setEditingProject(null);
    setForm(emptyForm);
    setTechnologyInput("");
    setShowFormModal(true);
  };

  const openEditForm = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedProject(null);
    setEditingProject(project);
    setTechnologyInput("");
    setForm({
      title: project.title,
      description: project.description,
      domain: project.domain,
      status: (project.status === "PUBLISHED" ? "COMPLETED" : project.status) as any,
      technologies: [...project.technologies],
      githubUrl: project.githubUrl || "",
      liveDemoUrl: project.liveDemoUrl || "",
      imageUrl: project.imageUrl || "",
      isPublished: Boolean(project.isPublished),
    });
    setShowFormModal(true);
  };

  const addTechnology = (e?: FormEvent | KeyboardEvent) => {
    e?.preventDefault();
    const tech = technologyInput.trim();
    if (!tech || form.technologies.some((t) => t.toLowerCase() === tech.toLowerCase())) return;
    setForm((prev) => ({ ...prev, technologies: [...prev.technologies, tech] }));
    setTechnologyInput("");
  };

  const removeTechnology = (tech: string) => {
    setForm((prev) => ({
      ...prev,
      technologies: prev.technologies.filter((t) => t !== tech),
    }));
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.domain.trim()) {
      setToast({ message: "Title, description, and domain are required.", type: "error" });
      return;
    }
    if (form.technologies.length === 0) {
      setToast({ message: "Please add at least one technology in the tech stack.", type: "error" });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        domain: form.domain.trim(),
        status: form.status,
        techStack: form.technologies,
        githubUrl: form.githubUrl.trim() || null,
        liveDemoUrl: form.liveDemoUrl.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        isPublished: form.isPublished,
      };

      const url = editingProject ? `/projects/${editingProject.id}` : "/projects";
      const method = editingProject ? "PATCH" : "POST";

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save project");
      }

      setToast({
        message: editingProject
          ? "Project updated successfully."
          : form.isPublished
          ? "Project created and published to Community Showcase!"
          : "Project created in your private workspace.",
        type: "success",
      });

      setShowFormModal(false);
      fetchMyProjects();
      fetchCommunityProjects();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save project", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Quick 1-Click Publish Toggle
  const handleTogglePublish = async (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setTogglingPublishId(project.id);
      const res = await authFetch(`/projects/${project.id}/publish-toggle`, {
        method: "PATCH",
      });

      if (!res.ok) {
        throw new Error("Failed to update visibility");
      }

      const updated = await res.json();
      const willBePublished = updated.isPublished;

      // Optimistic state updates
      setMyProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, isPublished: willBePublished } : p))
      );
      if (selectedProject?.id === project.id) {
        setSelectedProject((prev) => (prev ? { ...prev, isPublished: willBePublished } : null));
      }

      setToast({
        message: willBePublished
          ? `“${project.title}” is now published to Community Showcase!`
          : `“${project.title}” set to Private Workspace.`,
        type: willBePublished ? "success" : "info",
      });

      fetchCommunityProjects();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to toggle publish state", type: "error" });
    } finally {
      setTogglingPublishId(null);
    }
  };

  // Delete project
  const confirmDeleteProject = async () => {
    if (!deleteProjectTarget) return;
    try {
      setDeleting(true);
      const res = await authFetch(`/projects/${deleteProjectTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete project");

      setToast({ message: `“${deleteProjectTarget.title}” was deleted.`, type: "success" });
      setDeleteProjectTarget(null);
      if (selectedProject?.id === deleteProjectTarget.id) setSelectedProject(null);
      fetchMyProjects();
      fetchCommunityProjects();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to delete project", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // Active filters helper
  const isAnyFilterActive =
    searchQuery.trim().length > 0 ||
    selectedDomain !== "ALL" ||
    selectedDept !== "ALL" ||
    selectedStatus !== "ALL" ||
    selectedSort !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedDomain("ALL");
    setSelectedDept("ALL");
    setSelectedStatus("ALL");
    setSelectedSort("newest");
  };

  // Bookmarked projects list
  const bookmarkedProjects = useMemo(() => {
    return communityProjects.filter((p) => bookmarkedIds.includes(p.id));
  }, [communityProjects, bookmarkedIds]);

  // Personal projects stats
  const publishedCount = myProjects.filter((p) => p.isPublished).length;
  const privateCount = myProjects.length - publishedCount;

  return (
    <div className="space-y-6 pb-16 font-(--font-manrope)">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#2B2B2E]/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 items-center gap-1.5 rounded-full bg-[#E8A33D]/15 px-2.5 text-[11px] font-bold uppercase tracking-wider text-[#A4123F]">
              <Sparkles className="h-3 w-3" /> Project Innovation Hub
            </span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Live Community Feed" />
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2B2B2E]">
            Project Community
          </h1>
          <p className="mt-1 text-sm text-[#2B2B2E]/65 max-w-2xl">
            Discover peer projects, explore emerging tech stacks across departments, or showcase your own portfolio to the university.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-[#A4123F] px-4.5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#8D0F36] hover:shadow-md cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2B2B2E]/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("community")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "community"
                ? "bg-[#A4123F] text-white shadow-2xs"
                : "text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/5 hover:text-[#2B2B2E]"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Explore Community</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                activeTab === "community" ? "bg-white/20 text-white" : "bg-[#2B2B2E]/10 text-[#2B2B2E]/70"
              }`}
            >
              {communityProjects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("my-projects")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "my-projects"
                ? "bg-[#A4123F] text-white shadow-2xs"
                : "text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/5 hover:text-[#2B2B2E]"
            }`}
          >
            <FolderGit2 className="h-4 w-4" />
            <span>My Projects</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                activeTab === "my-projects" ? "bg-white/20 text-white" : "bg-[#2B2B2E]/10 text-[#2B2B2E]/70"
              }`}
            >
              {myProjects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bookmarks")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "bookmarks"
                ? "bg-[#A4123F] text-white shadow-2xs"
                : "text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/5 hover:text-[#2B2B2E]"
            }`}
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved Projects</span>
            {bookmarkedIds.length > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  activeTab === "bookmarks" ? "bg-white/20 text-white" : "bg-[#2B2B2E]/10 text-[#2B2B2E]/70"
                }`}
              >
                {bookmarkedIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Workspace Quick Stats in My Projects Tab */}
        {activeTab === "my-projects" && (
          <div className="flex items-center gap-3 text-xs text-[#2B2B2E]/70">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <strong>{publishedCount}</strong> Published
            </span>
            <span className="text-[#2B2B2E]/20">•</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <strong>{privateCount}</strong> Private
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXPLORE COMMUNITY FEED                                  */}
      {/* ============================================================== */}
      {activeTab === "community" && (
        <div className="space-y-6">
          {/* Integrated Search & Filter Controls */}
          <div className="rounded-xl border border-[#2B2B2E]/10 bg-white p-4.5 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-center">
              {/* Search Bar */}
              <div className="relative md:col-span-5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#2B2B2E]/40" />
                <input
                  type="text"
                  placeholder="Search projects, technologies, or authors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[#2B2B2E]/20 bg-[#F5F3EF]/40 pl-10 pr-9 py-2 text-sm text-[#2B2B2E] placeholder-[#2B2B2E]/45 focus:border-[#A4123F] focus:bg-white focus:outline-hidden transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2B2B2E]/40 hover:text-[#2B2B2E] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Department Dropdown */}
              <div className="md:col-span-3">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full rounded-lg border border-[#2B2B2E]/20 bg-[#F5F3EF]/40 px-3 py-2 text-xs font-medium text-[#2B2B2E] focus:border-[#A4123F] focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">All Departments</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.code} — {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lifecycle Status Dropdown */}
              <div className="md:col-span-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-lg border border-[#2B2B2E]/20 bg-[#F5F3EF]/40 px-3 py-2 text-xs font-medium text-[#2B2B2E] focus:border-[#A4123F] focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PROPOSED">Proposed</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="md:col-span-2">
                <select
                  value={selectedSort}
                  onChange={(e) => setSelectedSort(e.target.value as any)}
                  className="w-full rounded-lg border border-[#2B2B2E]/20 bg-[#F5F3EF]/40 px-3 py-2 text-xs font-medium text-[#2B2B2E] focus:border-[#A4123F] focus:bg-white focus:outline-hidden"
                >
                  <option value="newest">Recently Added</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Quick Domain Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
              <span className="text-[#2B2B2E]/50 font-bold uppercase text-[10px] tracking-wider pr-1 shrink-0">
                Domain:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDomain("ALL")}
                className={`rounded-full px-3 py-1 font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedDomain === "ALL"
                    ? "bg-[#A4123F] text-white"
                    : "bg-[#2B2B2E]/5 text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/10"
                }`}
              >
                All Domains
              </button>
              {DOMAIN_OPTIONS.map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setSelectedDomain(dom)}
                  className={`rounded-full px-3 py-1 font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedDomain === dom
                      ? "bg-[#A4123F] text-white"
                      : "bg-[#2B2B2E]/5 text-[#2B2B2E]/70 hover:bg-[#2B2B2E]/10"
                  }`}
                >
                  {dom}
                </button>
              ))}

              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#A4123F] hover:underline cursor-pointer pl-2"
                >
                  <X className="h-3 w-3" /> Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Project Cards Grid */}
          {loadingCommunity ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : communityProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2B2B2E]/20 bg-white/60 p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8A33D]/10 text-[#E8A33D]">
                <Globe className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#2B2B2E]">No Community Projects Found</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#2B2B2E]/60">
                {isAnyFilterActive
                  ? "No published projects match your current search and filter criteria. Try clearing some filters."
                  : "No students have published projects to the campus showcase yet. Be the first to share your work!"}
              </p>
              {isAnyFilterActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl border border-[#2B2B2E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF]"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 rounded-xl bg-[#A4123F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#8D0F36]"
                >
                  Publish Your First Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {communityProjects.map((project) => {
                const isBookmarked = bookmarkedIds.includes(project.id);
                const isOwner = project.students?.some((s) => s.user.id === currentUser?.userId);

                return (
                  <CommunityProjectCard
                    key={project.id}
                    project={project}
                    isBookmarked={isBookmarked}
                    isOwner={Boolean(isOwner)}
                    onView={() => setSelectedProject(project)}
                    onToggleBookmark={(e) => toggleBookmark(project.id, e)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MY PROJECTS WORKSPACE                                   */}
      {/* ============================================================== */}
      {activeTab === "my-projects" && (
        <div className="space-y-6">
          {loadingMyProjects ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : myProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2B2B2E]/20 bg-white/60 p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#A4123F]/10 text-[#A4123F]">
                <FolderGit2 className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#2B2B2E]">Your Project Workspace is Empty</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#2B2B2E]/60">
                You haven&apos;t added any projects yet. Start building your portfolio and choose when to publish them to the community showcase.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 rounded-xl bg-[#A4123F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#8D0F36] cursor-pointer"
              >
                + Create Your First Project
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {myProjects.map((project) => (
                <MyProjectCard
                  key={project.id}
                  project={project}
                  toggling={togglingPublishId === project.id}
                  onView={() => setSelectedProject(project)}
                  onEdit={(e) => openEditForm(project, e)}
                  onDelete={(e) => {
                    e?.stopPropagation();
                    setDeleteProjectTarget(project);
                  }}
                  onTogglePublish={(e) => handleTogglePublish(project, e)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BOOKMARKED PROJECTS                                     */}
      {/* ============================================================== */}
      {activeTab === "bookmarks" && (
        <div className="space-y-6">
          {bookmarkedProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2B2B2E]/20 bg-white/60 p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <Bookmark className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#2B2B2E]">No Saved Projects Yet</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#2B2B2E]/60">
                You can bookmark any inspiring community project by clicking the bookmark icon on its card to save it here.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("community")}
                className="mt-5 rounded-xl border border-[#2B2B2E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF] cursor-pointer"
              >
                Browse Community Showcase
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {bookmarkedProjects.map((project) => (
                <CommunityProjectCard
                  key={project.id}
                  project={project}
                  isBookmarked={true}
                  isOwner={Boolean(project.students?.some((s) => s.user.id === currentUser?.userId))}
                  onView={() => setSelectedProject(project)}
                  onToggleBookmark={(e) => toggleBookmark(project.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* PROJECT CREATE / EDIT MODAL                                    */}
      {/* ============================================================== */}
      {showFormModal && (
        <Modal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingProject ? "Edit Project" : "Create New Project"}
          subtitle="Add engineering details and choose community visibility."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveProject} className="space-y-5">
            {/* Project Title & Domain */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autonomous Drone Navigation System"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  Engineering Domain <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 bg-white px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                >
                  <option value="">-- Select Domain --</option>
                  {DOMAIN_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lifecycle Status & Image */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 bg-white px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                >
                  <option value="IN_PROGRESS">In Progress (Active Development)</option>
                  <option value="COMPLETED">Completed (Finished Project)</option>
                  <option value="PROPOSED">Proposed (Planning Stage)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  Project Banner Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                Project Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Describe the problem, solution, architecture, and core outcomes..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden resize-none"
              />
            </div>

            {/* Tech Stack Interactive Tags */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                Technology Stack <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type technology (e.g. Next.js, PyTorch, ROS) and press Enter"
                  value={technologyInput}
                  onChange={(e) => setTechnologyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTechnology();
                    }
                  }}
                  className="flex-1 rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={addTechnology}
                  className="rounded-xl border border-[#2B2B2E]/20 bg-[#F5F3EF] px-4 py-2 text-xs font-bold text-[#2B2B2E] hover:bg-[#2B2B2E]/10 cursor-pointer"
                >
                  Add Tag
                </button>
              </div>

              {form.technologies.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {form.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#A4123F]/8 border border-[#A4123F]/20 px-3 py-1 text-xs font-semibold text-[#A4123F]"
                    >
                      {tech}
                      <button
                        type="button"
                        onClick={() => removeTechnology(tech)}
                        className="hover:text-red-700 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Links */}
            <div className="grid gap-4 md:grid-cols-2 border-t border-[#2B2B2E]/10 pt-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  GitHub Repository URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/username/project"
                  value={form.githubUrl}
                  onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#2B2B2E] mb-1">
                  Live Demo / Deployment URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://myproject.vercel.app"
                  value={form.liveDemoUrl}
                  onChange={(e) => setForm({ ...form, liveDemoUrl: e.target.value })}
                  className="w-full rounded-xl border border-[#2B2B2E]/20 px-3.5 py-2.5 text-sm text-[#2B2B2E] focus:border-[#A4123F] focus:outline-hidden"
                />
              </div>
            </div>

            {/* DEDICATED "PUBLISH TO COMMUNITY SHOWCASE" TOGGLE CONTROL */}
            <div className="rounded-xl border border-[#2B2B2E]/15 bg-[#FBFBFA] p-4.5 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-[#2B2B2E]">
                      Publish to Community Showcase
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        form.isPublished
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-[#2B2B2E]/10 text-[#2B2B2E]/60"
                      }`}
                    >
                      {form.isPublished ? "Visible to Campus" : "Private Draft"}
                    </span>
                  </div>
                  <p className="text-xs text-[#2B2B2E]/65 leading-relaxed">
                    Make this project visible to peers and faculty across the university in the Explore Community showcase.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isPublished}
                  onClick={() => setForm((prev) => ({ ...prev, isPublished: !prev.isPublished }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    form.isPublished ? "bg-[#A4123F]" : "bg-[#2B2B2E]/20"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      form.isPublished ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#2B2B2E]/10">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="rounded-xl border border-[#2B2B2E]/20 px-4.5 py-2 text-sm font-semibold text-[#2B2B2E]/70 hover:bg-[#F5F3EF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#A4123F] px-6 py-2 text-sm font-bold text-white shadow-xs hover:bg-[#8D0F36] disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* PROJECT DETAIL SHOWCASE MODAL                                  */}
      {/* ============================================================== */}
      {selectedProject && (
        <Modal
          isOpen={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          title={selectedProject.title}
          subtitle={`Domain: ${selectedProject.domain}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Banner image if available */}
            {selectedProject.imageUrl && (
              <div className="overflow-hidden rounded-xl border border-[#2B2B2E]/10">
                <img
                  src={selectedProject.imageUrl}
                  alt={selectedProject.title}
                  className="h-56 w-full object-cover"
                />
              </div>
            )}

            {/* Badges and Published Status */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#2B2B2E]/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E8A33D]/15 px-3 py-1 text-xs font-bold uppercase text-[#A4123F]">
                  {selectedProject.domain}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    selectedProject.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedProject.status === "IN_PROGRESS"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {selectedProject.status === "COMPLETED"
                    ? "Completed"
                    : selectedProject.status === "IN_PROGRESS"
                    ? "In Progress"
                    : "Proposed"}
                </span>
              </div>

              <div>
                {selectedProject.isPublished ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Published to Community
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    <Lock className="h-3 w-3" />
                    Private Workspace
                  </span>
                )}
              </div>
            </div>

            {/* Full Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/50">Project Overview</h4>
              <p className="text-sm leading-relaxed text-[#2B2B2E]/80 whitespace-pre-line">
                {selectedProject.description}
              </p>
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/50">Tech Stack & Tools</h4>
              <div className="flex flex-wrap gap-2">
                {selectedProject.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-[#2B2B2E]/10 bg-[#F5F3EF] px-3 py-1 text-xs font-semibold text-[#2B2B2E]/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Authors & Team */}
            {selectedProject.students && selectedProject.students.length > 0 && (
              <div className="space-y-2 border-t border-[#2B2B2E]/10 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/50">Project Team</h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {selectedProject.students.map(({ user }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-xl border border-[#2B2B2E]/10 bg-[#FBFBFA] p-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A4123F] font-bold text-xs text-white">
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#2B2B2E] truncate">{user.name}</p>
                        <p className="text-[11px] text-[#2B2B2E]/60 truncate">
                          {user.studentId ? `${user.studentId} • ` : ""}
                          {user.department?.code || "Student"}
                          {user.class ? ` (Batch ${user.class.batchYear})` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Faculty Mentor (if assigned) */}
            {selectedProject.mentor && (
              <div className="space-y-2 border-t border-[#2B2B2E]/10 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2B2E]/50">Faculty Mentor</h4>
                <div className="flex items-center gap-3 rounded-xl border border-[#2B2B2E]/10 bg-[#FBFBFA] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8A33D] font-bold text-xs text-[#2B2B2E]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2B2B2E]">{selectedProject.mentor.user.name}</p>
                    <p className="text-[11px] text-[#2B2B2E]/60">
                      {selectedProject.mentor.designation || "Faculty Mentor"} • {selectedProject.mentor.user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Links & External Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2B2B2E]/10 pt-4">
              <div className="flex items-center gap-3">
                {selectedProject.githubUrl && (
                  <a
                    href={selectedProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2B2B2E]/20 bg-white px-3.5 py-2 text-xs font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF]"
                  >
                    <GithubIcon className="h-4 w-4" />
                    <span>View Repository ↗</span>
                  </a>
                )}
                {selectedProject.liveDemoUrl && (
                  <a
                    href={selectedProject.liveDemoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#A4123F] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#8D0F36]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Live Demo ↗</span>
                  </a>
                )}
              </div>

              {/* Author Actions if current user is owner */}
              {selectedProject.students?.some((s) => s.user.id === currentUser?.userId) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleTogglePublish(selectedProject, e)}
                    className="rounded-lg border border-[#2B2B2E]/20 bg-white px-3 py-2 text-xs font-semibold text-[#2B2B2E] hover:bg-[#F5F3EF] cursor-pointer"
                  >
                    {selectedProject.isPublished ? "Set to Private" : "Publish to Community"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openEditForm(selectedProject, e)}
                    className="rounded-lg bg-[#A4123F]/10 px-3 py-2 text-xs font-semibold text-[#A4123F] hover:bg-[#A4123F]/20 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteProjectTarget)}
        onClose={() => setDeleteProjectTarget(null)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to permanently delete “${deleteProjectTarget?.title}”? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete Project"}
        isDanger={true}
        isLoading={deleting}
      />
    </div>
  );
}

// ====================================================================
// SUB-COMPONENTS: POLISHED CARDS & SKELETONS
// ====================================================================

function CommunityProjectCard({
  project,
  isBookmarked,
  isOwner,
  onView,
  onToggleBookmark,
}: {
  project: Project;
  isBookmarked: boolean;
  isOwner: boolean;
  onView: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
}) {
  const primaryAuthor = project.students?.[0]?.user;

  return (
    <article
      onClick={onView}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer"
    >
      <div>
        {/* Top Header: Domain Pill & Bookmark Button */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#E8A33D]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#A4123F]">
            {project.domain}
          </span>

          <div className="flex items-center gap-1.5">
            {isOwner && (
              <span className="rounded-full bg-[#A4123F]/10 px-2 py-0.5 text-[10px] font-bold text-[#A4123F]">
                Your Project
              </span>
            )}

            <button
              type="button"
              onClick={onToggleBookmark}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
                isBookmarked
                  ? "bg-amber-100 text-amber-700"
                  : "text-[#2B2B2E]/40 hover:bg-[#2B2B2E]/5 hover:text-[#2B2B2E]"
              }`}
              title={isBookmarked ? "Remove bookmark" : "Save project"}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-amber-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* Project Title */}
        <h3 className="mt-3 text-lg font-bold text-[#2B2B2E] transition-colors group-hover:text-[#A4123F] line-clamp-1">
          {project.title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-xs leading-relaxed text-[#2B2B2E]/65 line-clamp-3">
          {project.description}
        </p>

        {/* Tech Stack Pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="rounded-md bg-[#F5F3EF] px-2 py-0.5 text-[11px] font-medium text-[#2B2B2E]/70"
            >
              {tech}
            </span>
          ))}
          {project.technologies.length > 4 && (
            <span className="rounded-md bg-[#F5F3EF] px-1.5 py-0.5 text-[10px] font-semibold text-[#2B2B2E]/50">
              +{project.technologies.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Author Info & External Links */}
      <div className="mt-5 border-t border-[#2B2B2E]/8 pt-3.5 flex items-center justify-between gap-3">
        {primaryAuthor ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#A4123F] text-[10px] font-bold text-white">
              {primaryAuthor.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#2B2B2E] truncate">{primaryAuthor.name}</p>
              <p className="text-[10px] text-[#2B2B2E]/50 truncate">
                {primaryAuthor.department?.code || "Student"}
                {primaryAuthor.class ? ` '` + String(primaryAuthor.class.batchYear).slice(-2) : ""}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-[#2B2B2E]/40 italic">Student Project</span>
        )}

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-[#2B2B2E]/50 hover:text-[#2B2B2E] transition-colors"
              title="GitHub Repo"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
          )}
          {project.liveDemoUrl && (
            <a
              href={project.liveDemoUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-[#2B2B2E]/50 hover:text-[#A4123F] transition-colors"
              title="Live Demo"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span className="text-xs font-semibold text-[#A4123F] group-hover:underline ml-1">
            Details →
          </span>
        </div>
      </div>
    </article>
  );
}

function MyProjectCard({
  project,
  toggling,
  onView,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  project: Project;
  toggling: boolean;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePublish: (e: React.MouseEvent) => void;
}) {
  return (
    <article
      onClick={onView}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer"
    >
      <div>
        {/* Visibility Status Bar & 1-Click Toggle */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2B2B2E]/8">
          <div className="flex items-center gap-1.5">
            {project.isPublished ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Published to Community
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                <Lock className="h-3 w-3" />
                Private Workspace
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={toggling}
            onClick={onTogglePublish}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              project.isPublished
                ? "bg-[#2B2B2E]/5 text-[#2B2B2E]/70 hover:bg-red-50 hover:text-red-700"
                : "bg-[#A4123F]/10 text-[#A4123F] hover:bg-[#A4123F]/20"
            }`}
            title="Toggle visibility in community showcase"
          >
            {toggling ? "Updating..." : project.isPublished ? "Make Private" : "Publish 🌐"}
          </button>
        </div>

        {/* Domain and Title */}
        <div className="mt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8A33D]">
            {project.domain}
          </span>
          <h3 className="mt-1 text-lg font-bold text-[#2B2B2E] transition-colors group-hover:text-[#A4123F] line-clamp-1">
            {project.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-[#2B2B2E]/65 line-clamp-3">
            {project.description}
          </p>
        </div>

        {/* Tech Stack Pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="rounded-md bg-[#F5F3EF] px-2 py-0.5 text-[11px] font-medium text-[#2B2B2E]/70"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-5 border-t border-[#2B2B2E]/8 pt-3.5 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] text-[#2B2B2E]/45 font-medium">
          Updated {new Date(project.updatedAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={onView}
            className="rounded-md px-2 py-1 font-semibold text-[#2B2B2E]/60 hover:text-[#2B2B2E] hover:bg-[#2B2B2E]/5 cursor-pointer"
          >
            View
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 font-semibold text-[#A4123F] hover:bg-[#A4123F]/10 cursor-pointer"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 font-semibold text-red-600/70 hover:text-red-700 hover:bg-red-50 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#2B2B2E]/10 bg-white p-5 shadow-xs space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-14 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="border-t border-[#2B2B2E]/10 pt-3 flex justify-between items-center">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
