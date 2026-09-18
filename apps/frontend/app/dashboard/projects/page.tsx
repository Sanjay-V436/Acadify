"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";

interface Project {
  id: string;
  title: string;
  description: string;
  domain: string;
  technologies: string[];
  githubUrl: string | null;
  liveDemoUrl: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type ProjectForm = {
  title: string;
  description: string;
  domain: string;
  technologies: string[];
  githubUrl: string;
  liveDemoUrl: string;
  imageUrl: string;
};

const emptyForm: ProjectForm = { title: "", description: "", domain: "", technologies: [], githubUrl: "", liveDemoUrl: "", imageUrl: "" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [technologyInput, setTechnologyInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProjects() {
    setLoading(true);
    try {
      const response = await request("/projects");
      setProjects((await response.json()) as Project[]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void loadProjects(), 0);
    return () => clearTimeout(timer);
  }, []);

  function openCreateForm() {
    setEditingProject(null); setForm(emptyForm); setTechnologyInput(""); setError(""); setSuccess(""); setShowForm(true);
  }

  function openEditForm(project: Project) {
    setSelectedProject(null); setEditingProject(project); setTechnologyInput(""); setError(""); setSuccess(""); setShowForm(true);
    setForm({ title: project.title, description: project.description, domain: project.domain, technologies: project.technologies, githubUrl: project.githubUrl ?? "", liveDemoUrl: project.liveDemoUrl ?? "", imageUrl: project.imageUrl ?? "" });
  }

  function addTechnology(event?: FormEvent | KeyboardEvent) {
    event?.preventDefault();
    const technology = technologyInput.trim();
    if (!technology || form.technologies.includes(technology)) return;
    setForm((current) => ({ ...current, technologies: [...current.technologies, technology] })); setTechnologyInput("");
  }

  function removeTechnology(technology: string) {
    setForm((current) => ({ ...current, technologies: current.technologies.filter((item) => item !== technology) }));
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!form.title.trim() || !form.description.trim() || !form.domain.trim()) return setError("Title, description, and domain are required.");
    if (!form.technologies.length) return setError("Add at least one technology.");
    setSaving(true);
    try {
      const response = await request(editingProject ? `/projects/${editingProject.id}` : "/projects", { method: editingProject ? "PATCH" : "POST", body: JSON.stringify({ title: form.title, description: form.description, domain: form.domain, techStack: form.technologies, githubUrl: form.githubUrl || null, liveDemoUrl: form.liveDemoUrl || null, imageUrl: form.imageUrl || null }) });
      const project = (await response.json()) as Project;
      setProjects((current) => editingProject ? current.map((item) => item.id === project.id ? project : item) : [project, ...current]);
      setShowForm(false); setSuccess(editingProject ? "Project updated successfully." : "Project created successfully.");
    } catch (requestError) { setError(getErrorMessage(requestError)); } finally { setSaving(false); }
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete “${project.title}”?\n\nThis action cannot be undone.`)) return;
    setDeletingId(project.id); setError("");
    try {
      await request(`/projects/${project.id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== project.id)); setSelectedProject(null); setSuccess("Project deleted successfully.");
    } catch (requestError) { setError(getErrorMessage(requestError)); } finally { setDeletingId(null); }
  }

  return (
    <div className="min-h-full pb-12 font-(--font-manrope)">
      <header className="flex flex-col justify-between gap-5 border-b border-[#2B2B2E]/10 pb-7 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8A33D]">Student workspace</p><h1 className="mt-2 font-(--font-display) text-4xl tracking-tight text-[#2B2B2E]">My Projects</h1><p className="mt-2 text-sm text-[#2B2B2E]/60">Showcase the projects you&apos;ve built.</p></div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#A4123F] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8D0F36] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A4123F]/30">+ Add Project</button>
      </header>
      {success && <Notice tone="success">{success}</Notice>}{error && <Notice tone="error">{error}</Notice>}
      {loading ? <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <ProjectSkeleton key={item} />)}</div> : projects.length === 0 ? <EmptyState onCreate={openCreateForm} /> : <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} onView={() => setSelectedProject(project)} onEdit={() => openEditForm(project)} onDelete={() => void deleteProject(project)} deleting={deletingId === project.id} />)}</div>}
      {showForm && <ProjectFormModal editing={Boolean(editingProject)} form={form} technologyInput={technologyInput} saving={saving} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onTechnologyChange={setTechnologyInput} onAddTechnology={addTechnology} onRemoveTechnology={removeTechnology} onSubmit={saveProject} onClose={() => setShowForm(false)} />}
      {selectedProject && <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onEdit={() => openEditForm(selectedProject)} onDelete={() => void deleteProject(selectedProject)} />}
    </div>
  );
}

async function request(path: string, options: RequestInit = {}) {
  const response = await authFetch(path, options);
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try { const body = (await response.json()) as { message?: string | string[] }; if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message; } catch { /* use generic message */ }
    throw new Error(message);
  }
  return response;
}

function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }

function ProjectCard({ project, onView, onEdit, onDelete, deleting }: { project: Project; onView: () => void; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return <article className="group overflow-hidden rounded-2xl border border-[#2B2B2E]/10 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">{project.imageUrl ? <img src={project.imageUrl} alt="" className="h-36 w-full object-cover" /> : <div className="h-3 w-full bg-linear-to-r from-[#A4123F] via-[#A4123F]/80 to-[#E8A33D]" />}<div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E8A33D]">{project.domain}</p><h2 className="mt-2 font-(--font-display) text-2xl leading-tight text-[#2B2B2E]">{project.title}</h2></div><span className="rounded-full bg-[#A4123F]/8 px-2.5 py-1 text-[10px] font-bold uppercase text-[#A4123F]">{project.status}</span></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-[#2B2B2E]/65">{project.description}</p><div className="mt-4 flex flex-wrap gap-2">{project.technologies.slice(0, 5).map((technology) => <span key={technology} className="rounded-full bg-[#F5F3EF] px-2.5 py-1 text-xs font-medium text-[#2B2B2E]/70">{technology}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-[#2B2B2E]/8 pt-4"><div className="flex gap-3 text-xs font-semibold">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-[#2B2B2E]/60 hover:text-[#A4123F]">GitHub ↗</a>}{project.liveDemoUrl && <a href={project.liveDemoUrl} target="_blank" rel="noreferrer" className="text-[#2B2B2E]/60 hover:text-[#A4123F]">Live demo ↗</a>}</div><div className="flex gap-2 text-xs font-bold"><button type="button" onClick={onView} className="text-[#A4123F] hover:underline">View</button><button type="button" onClick={onEdit} className="text-[#2B2B2E]/55 hover:text-[#A4123F]">Edit</button><button type="button" onClick={onDelete} disabled={deleting} className="text-red-600/70 hover:text-red-700 disabled:opacity-50">{deleting ? "..." : "Delete"}</button></div></div></div></article>;
}

function ProjectFormModal({ editing, form, technologyInput, saving, onChange, onTechnologyChange, onAddTechnology, onRemoveTechnology, onSubmit, onClose }: { editing: boolean; form: ProjectForm; technologyInput: string; saving: boolean; onChange: (field: keyof ProjectForm, value: string) => void; onTechnologyChange: (value: string) => void; onAddTechnology: (event: KeyboardEvent<HTMLInputElement>) => void; onRemoveTechnology: (technology: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <Modal title={editing ? "Edit project" : "Add project"} onClose={onClose}><form onSubmit={onSubmit} className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><Field label="Project title *" value={form.title} onChange={(value) => onChange("title", value)} placeholder="e.g. Campus navigation assistant" /><Field label="Domain *" value={form.domain} onChange={(value) => onChange("domain", value)} placeholder="e.g. Artificial Intelligence" /></div><Field label="Short description *" value={form.description} onChange={(value) => onChange("description", value)} placeholder="What does this project do?" textarea /><div><label className="text-sm font-bold text-[#2B2B2E]">Tech stack *</label><div className="mt-2 flex flex-wrap gap-2">{form.technologies.map((technology) => <span key={technology} className="flex items-center gap-2 rounded-full bg-[#A4123F]/8 px-3 py-1.5 text-xs font-semibold text-[#A4123F]">{technology}<button type="button" onClick={() => onRemoveTechnology(technology)} aria-label={`Remove ${technology}`}>×</button></span>)}</div><input value={technologyInput} onChange={(event) => onTechnologyChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddTechnology(event); }} placeholder="Type a technology and press Enter" className="mt-3 w-full rounded-xl border border-[#2B2B2E]/15 px-4 py-3 text-sm outline-none transition focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20" /></div><div className="border-t border-[#2B2B2E]/10 pt-5"><p className="text-sm font-bold text-[#2B2B2E]">Project links</p><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="GitHub repository" type="url" value={form.githubUrl} onChange={(value) => onChange("githubUrl", value)} placeholder="https://github.com/..." /><Field label="Live demo" type="url" value={form.liveDemoUrl} onChange={(value) => onChange("liveDemoUrl", value)} placeholder="https://..." /><Field label="Project image URL" type="url" value={form.imageUrl} onChange={(value) => onChange("imageUrl", value)} placeholder="Optional image URL" /></div></div><div className="flex justify-end gap-3 border-t border-[#2B2B2E]/10 pt-5"><button type="button" onClick={onClose} className="rounded-xl border border-[#2B2B2E]/15 px-4 py-2.5 text-sm font-semibold text-[#2B2B2E]/70 hover:bg-[#F5F3EF]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#A4123F] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#8D0F36] disabled:opacity-50">{saving ? "Saving..." : editing ? "Save changes" : "Create project"}</button></div></form></Modal>;
}

function ProjectDetailModal({ project, onClose, onEdit, onDelete }: { project: Project; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return <Modal title={project.title} onClose={onClose}><p className="text-sm leading-7 text-[#2B2B2E]/70">{project.description}</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Detail label="Domain" value={project.domain} /><Detail label="Status" value={project.status} /></div><div className="mt-6 flex flex-wrap gap-2">{project.technologies.map((technology) => <span key={technology} className="rounded-full bg-[#F5F3EF] px-3 py-1.5 text-xs font-semibold text-[#2B2B2E]/70">{technology}</span>)}</div><div className="mt-7 flex flex-wrap gap-3 border-t border-[#2B2B2E]/10 pt-5">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[#2B2B2E]/15 px-4 py-2.5 text-sm font-semibold text-[#2B2B2E]/75">Open GitHub ↗</a>}{project.liveDemoUrl && <a href={project.liveDemoUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#E8A33D] px-4 py-2.5 text-sm font-bold text-[#2B2B2E]">Live Demo ↗</a>}<button type="button" onClick={onEdit} className="rounded-xl bg-[#A4123F] px-4 py-2.5 text-sm font-bold text-white">Edit Project</button><button type="button" onClick={onDelete} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600">Delete</button></div></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2B2B2E]/35 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="font-(--font-display) text-3xl text-[#2B2B2E]">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-2xl text-[#2B2B2E]/45 hover:text-[#A4123F]">×</button></div>{children}</div></div>;
}

function Field({ label, value, onChange, placeholder, textarea = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; textarea?: boolean; type?: string }) {
  const className = "mt-2 w-full rounded-xl border border-[#2B2B2E]/15 px-4 py-3 text-sm text-[#2B2B2E] outline-none transition placeholder:text-[#2B2B2E]/35 focus:border-[#A4123F] focus:ring-2 focus:ring-[#A4123F]/20";
  return <div><label className="text-sm font-bold text-[#2B2B2E]">{label}</label>{textarea ? <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${className} resize-none`} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} />}</div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E8A33D]">{label}</p><p className="mt-1 text-sm text-[#2B2B2E]/75">{value}</p></div>; }
function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) { return <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{children}</p>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="mt-16 max-w-xl rounded-2xl border border-dashed border-[#2B2B2E]/20 bg-white/70 p-10 text-center shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8A33D]">Your portfolio starts here</p><h2 className="mt-3 font-(--font-display) text-3xl text-[#2B2B2E]">No projects yet</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#2B2B2E]/60">Start building your academic portfolio by adding your first project.</p><button type="button" onClick={onCreate} className="mt-6 rounded-xl bg-[#A4123F] px-5 py-3 text-sm font-bold text-white hover:bg-[#8D0F36]">Create your first project</button></div>; }
function ProjectSkeleton() { return <div className="animate-pulse rounded-2xl border border-[#2B2B2E]/10 bg-white p-5 shadow-sm"><div className="h-2 w-1/3 rounded bg-[#E8A33D]/30" /><div className="mt-5 h-7 w-3/4 rounded bg-[#2B2B2E]/10" /><div className="mt-4 h-12 rounded bg-[#2B2B2E]/6" /><div className="mt-5 h-6 rounded bg-[#2B2B2E]/6" /></div>; }
