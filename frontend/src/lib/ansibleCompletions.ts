import type {Completion, CompletionContext, CompletionResult} from "@codemirror/autocomplete"

export const ANSIBLE_CATALOG_VERSION = "ansible-core built-ins"
export const YAML_SYNTAX_DOCS = "https://docs.ansible.com/projects/ansible/latest/reference_appendices/YAMLSyntax.html"

interface AnsibleEntry {
  label: string
  detail: string
  args?: string[]
}

const playKeywords: AnsibleEntry[] = [
  {label: "name", detail: "Play name"},
  {label: "hosts", detail: "Target inventory hosts or groups"},
  {label: "gather_facts", detail: "Collect facts before tasks"},
  {label: "become", detail: "Enable privilege escalation"},
  {label: "become_user", detail: "Privilege escalation target user"},
  {label: "connection", detail: "Connection plugin to use"},
  {label: "remote_user", detail: "Remote connection user"},
  {label: "vars", detail: "Play variables"},
  {label: "vars_files", detail: "External variable files"},
  {label: "pre_tasks", detail: "Tasks before roles and tasks"},
  {label: "roles", detail: "Roles applied to the play"},
  {label: "tasks", detail: "Ordered task list"},
  {label: "handlers", detail: "Handler task list"},
  {label: "post_tasks", detail: "Tasks after roles and tasks"},
  {label: "collections", detail: "Collections available to the play"},
  {label: "environment", detail: "Environment variables for the play"},
  {label: "module_defaults", detail: "Default module arguments"},
  {label: "strategy", detail: "Task execution strategy"},
  {label: "serial", detail: "Batch size for hosts"},
  {label: "max_fail_percentage", detail: "Maximum failure percentage"},
]

const taskKeywords: AnsibleEntry[] = [
  {label: "name", detail: "Task name"},
  {label: "when", detail: "Conditional expression"},
  {label: "changed_when", detail: "Custom changed condition"},
  {label: "failed_when", detail: "Custom failure condition"},
  {label: "check_mode", detail: "Override check mode for this task"},
  {label: "register", detail: "Store task result in a variable"},
  {label: "until", detail: "Retry condition"},
  {label: "retries", detail: "Maximum retry count"},
  {label: "delay", detail: "Seconds between retries"},
  {label: "loop", detail: "Repeat task over a list"},
  {label: "loop_control", detail: "Loop labels and behavior"},
  {label: "notify", detail: "Notify one or more handlers"},
  {label: "tags", detail: "Task selection tags"},
  {label: "delegate_to", detail: "Run task on another host"},
  {label: "run_once", detail: "Run task once for the batch"},
  {label: "ignore_errors", detail: "Continue after task failure"},
  {label: "environment", detail: "Environment variables for the task"},
  {label: "become", detail: "Enable privilege escalation for the task"},
  {label: "block", detail: "Group tasks for error handling"},
  {label: "rescue", detail: "Tasks to run after block failure"},
  {label: "always", detail: "Tasks that always run"},
]

const modules: AnsibleEntry[] = [
  {label: "ansible.builtin.apt", detail: "Manage Debian and Ubuntu packages", args: ["name", "state", "update_cache", "cache_valid_time"]},
  {label: "ansible.builtin.command", detail: "Execute a command on a remote host", args: ["cmd", "chdir", "creates", "removes", "stdin"]},
  {label: "ansible.builtin.copy", detail: "Copy files to remote hosts", args: ["src", "dest", "content", "owner", "group", "mode", "backup"]},
  {label: "ansible.builtin.debug", detail: "Print statements during execution", args: ["msg", "var", "verbosity"]},
  {label: "ansible.builtin.dnf", detail: "Manage Fedora and RHEL packages", args: ["name", "state", "enablerepo", "disable_gpg_check"]},
  {label: "ansible.builtin.file", detail: "Manage files, directories, and links", args: ["path", "state", "mode", "owner", "group", "recurse"]},
  {label: "ansible.builtin.fetch", detail: "Fetch files from remote hosts", args: ["src", "dest", "flat", "fail_on_missing"]},
  {label: "ansible.builtin.git", detail: "Deploy software from Git repositories", args: ["repo", "dest", "version", "update", "force", "depth"]},
  {label: "ansible.builtin.include_tasks", detail: "Include a task file", args: ["file", "apply", "free-form"]},
  {label: "ansible.builtin.include_vars", detail: "Load variables from files", args: ["file", "dir", "name"]},
  {label: "ansible.builtin.lineinfile", detail: "Manage lines in text files", args: ["path", "line", "regexp", "state", "insertafter", "insertbefore", "create"]},
  {label: "ansible.builtin.meta", detail: "Execute Ansible controller actions", args: ["free-form"]},
  {label: "ansible.builtin.package", detail: "Generic package manager abstraction", args: ["name", "state", "use"]},
  {label: "ansible.builtin.pause", detail: "Pause playbook execution", args: ["seconds", "minutes", "prompt", "echo"]},
  {label: "ansible.builtin.pip", detail: "Manage Python packages", args: ["name", "state", "requirements", "virtualenv", "executable"]},
  {label: "ansible.builtin.reboot", detail: "Reboot a machine", args: ["msg", "connect_timeout", "pre_reboot_delay", "post_reboot_delay", "reboot_timeout", "test_command"]},
  {label: "ansible.builtin.replace", detail: "Replace text in files using a backreference regex", args: ["path", "regexp", "replace", "backup", "before", "after"]},
  {label: "ansible.builtin.service", detail: "Manage services", args: ["name", "state", "enabled", "arguments", "pattern"]},
  {label: "ansible.builtin.shell", detail: "Execute shell commands on remote hosts", args: ["cmd", "chdir", "creates", "removes", "executable", "stdin"]},
  {label: "ansible.builtin.set_fact", detail: "Set host facts and variables", args: ["cacheable"]},
  {label: "ansible.builtin.setup", detail: "Gather host facts", args: ["gather_subset", "filter", "fact_path"]},
  {label: "ansible.builtin.stat", detail: "Retrieve file or filesystem status", args: ["path", "checksum_algorithm", "get_checksum", "get_mime"]},
  {label: "ansible.builtin.template", detail: "Template files using Jinja2", args: ["src", "dest", "mode", "owner", "group", "validate", "backup"]},
  {label: "ansible.builtin.uri", detail: "Interact with web services", args: ["url", "method", "body", "body_format", "headers", "status_code", "return_content", "validate_certs"]},
  {label: "ansible.builtin.user", detail: "Manage user accounts", args: ["name", "state", "uid", "group", "groups", "shell", "password", "create_home"]},
  {label: "ansible.builtin.wait_for", detail: "Wait for a condition before continuing", args: ["host", "port", "timeout", "state", "path", "search_regex"]},
  {label: "ansible.builtin.yum", detail: "Manage Red Hat package repositories and packages", args: ["name", "state", "enablerepo", "disable_gpg_check"]},
]

const snippets: AnsibleEntry[] = [
  {label: "playbook", detail: "New playbook skeleton", args: []},
  {label: "task", detail: "New task skeleton", args: []},
  {label: "when", detail: "Conditional task skeleton", args: []},
  {label: "loop", detail: "Loop task skeleton", args: []},
]

function options(entries: AnsibleEntry[], documentation = false): Completion[] {
  return entries.map(entry => ({
    label: entry.label,
    type: entry.label.startsWith("ansible.") ? "class" : "property",
    detail: entry.detail,
    info: documentation && entry.label.startsWith("ansible.")
      ? `https://docs.ansible.com/projects/ansible/latest/collections/ansible/builtin/${entry.label.replace("ansible.builtin.", "")}_module.html`
      : undefined,
    apply: entry.label,
  }))
}

function currentLine(context: CompletionContext): {before: string; indent: number; prefix: string; from: number} {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const prefixMatch = before.match(/[A-Za-z0-9_.-]*$/)
  const prefix = prefixMatch?.[0] ?? ""
  return {
    before,
    indent: (before.match(/^\s*/) ?? [""])[0].length,
    prefix,
    from: context.pos - prefix.length,
  }
}

function previousLines(context: CompletionContext): string[] {
  return context.state.doc.toString().slice(0, context.pos).split("\n").slice(0, -1).reverse()
}

function isInsideTasks(context: CompletionContext): boolean {
  return previousLines(context).some(line => /^\s*(tasks|pre_tasks|post_tasks|handlers):\s*$/.test(line))
}

function moduleForArguments(context: CompletionContext): AnsibleEntry | undefined {
  const lines = previousLines(context)
  for (const line of lines) {
    const match = line.match(/^\s*(ansible\.builtin\.[\w-]+):\s*$/)
    if (match) return modules.find(module => module.label === match[1])
    if (line.trim() && !line.match(/^\s+[\w.-]+:/)) break
  }
  return undefined
}

export function ansibleCompletionSource(context: CompletionContext): CompletionResult | null {
  const {before, indent, from} = currentLine(context)
  const trimmed = before.trim()
  const argsModule = moduleForArguments(context)

  if (argsModule && indent > 0) {
    return {from, options: options((argsModule.args ?? []).map(label => ({label, detail: `${argsModule.label} argument`})))}
  }

  if (/ansible\.builtin\.[\w-]*$/.test(before)) {
    return {from, options: options(modules, true)}
  }

  if (isInsideTasks(context) && (trimmed === "-" || trimmed === "" || /^-\s+name:\s+.+$/.test(trimmed))) {
    return {from, options: [...options(taskKeywords), ...options(modules, true), ...options(snippets)]}
  }

  if (trimmed === "-" || trimmed === "" || /^-\s*[\w-]*$/.test(trimmed)) {
    return {from, options: [...options(playKeywords), ...options(snippets)]}
  }

  if (/^(when|changed_when|failed_when):/.test(trimmed) || trimmed.includes("{{")) return null
  return null
}
