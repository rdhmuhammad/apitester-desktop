import {useState} from "react"
import {Check, ChevronDown, FolderOpen, X} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx"
import {cn} from "@/lib/utils.ts"
import {pickFolderPath} from "@/lib/pickFolderPath.ts"
import {useProject} from "@/layout/hooks/useProject.ts"
import type {Project} from "@/layout/services/collection.ts"

const AVATAR_COLORS = [
    "bg-teal-600",
    "bg-orange-500",
    "bg-indigo-600",
    "bg-rose-600",
    "bg-emerald-600",
    "bg-sky-600",
    "bg-violet-600",
    "bg-amber-600",
]

// GoLand-style initials: "apitester" -> "A", "apitester-desktop" -> "AD"
const projectInitials = (name: string) =>
    name.split(/[\s\-_.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"

const avatarColor = (name: string) => {
    let hash = 0
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const ProjectAvatar: React.FC<{name: string; className?: string}> = ({name, className}) => (
    <span
        className={cn(
            "flex shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white",
            avatarColor(name),
            className,
        )}
    >
        {projectInitials(name)}
    </span>
)

const ProjectSwitcher: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false)
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
    const {projects, activeProject, openProjectMutation, selectProjectMutation, deleteProjectMutation} = useProject()

    const handleOpen = async () => {
        const path = await pickFolderPath()
        if (path) openProjectMutation.mutate(path)
    }

    const handleSelect = (project: Project) => {
        if (project.id === activeProject?.id) return
        selectProjectMutation.mutate(project.id)
    }

    const handleConfirmDelete = () => {
        if (projectToDelete) deleteProjectMutation.mutate(projectToDelete.id)
        setProjectToDelete(null)
    }

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex h-6 max-w-[220px] items-center gap-1.5 rounded px-1.5 text-sm text-foreground hover:bg-muted focus:outline-none"
                        title={activeProject?.path ?? "Open a project"}
                    >
                        {activeProject ? (
                            <>
                                <ProjectAvatar name={activeProject.name} className="h-4 w-4"/>
                                <span className="truncate font-medium">{activeProject.name}</span>
                            </>
                        ) : (
                            <span className="truncate text-muted-foreground">Open project</span>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[110] w-72">
                    <DropdownMenuItem onSelect={handleOpen}>
                        <FolderOpen className="h-4 w-4"/>
                        Open...
                    </DropdownMenuItem>
                    {projects.length > 0 && (
                        <>
                            <DropdownMenuSeparator/>
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Open Projects
                            </DropdownMenuLabel>
                        </>
                    )}
                    {projects.map((project) => {
                        const isActive = project.id === activeProject?.id
                        return (
                            <DropdownMenuItem
                                key={project.id}
                                onSelect={() => handleSelect(project)}
                                className={cn("group items-start gap-2", isActive && "bg-accent/60")}
                            >
                                <ProjectAvatar name={project.name} className="mt-0.5 h-6 w-6 text-xs"/>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm">{project.name}</span>
                                    <span className="truncate text-xs text-muted-foreground">{project.path}</span>
                                </div>
                                {isActive && <Check className="mt-1 h-3.5 w-3.5 text-indigo-600"/>}
                                <button
                                    type="button"
                                    title="Delete project"
                                    className="mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        setMenuOpen(false)
                                        setProjectToDelete(project)
                                    }}
                                >
                                    <X className="h-3.5 w-3.5"/>
                                </button>
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove project "{projectToDelete?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the project from the list. Your files on disk will not be touched.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default ProjectSwitcher
