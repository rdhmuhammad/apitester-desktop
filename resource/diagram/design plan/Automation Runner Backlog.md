# Automation Runner Backlog

Source design: `Automation Runner Design Plan.md`

## Backlog Group: Custom Automation Runner

### P0 - Contract and Foundation

- [x] **AR-001 Define the custom YAML schema**
  - Document the top-level job list, job fields, task fields, supported task types, and rollback shape.
  - Standardize `dest`, `cli-execute`, and structured REST fields.
  - Decide whether one file can contain multiple jobs.
  - Dependency: none.

- [x] **AR-002 Define inventory and host targeting**
  - Specify inventory group, explicit host, and `local` behavior.
  - Define host and task concurrency rules.
  - Define behavior when a group or host does not exist.
  - Dependency: AR-001.

- [x] **AR-003 Define runtime variable resolution**
  - Document built-ins such as `jobPath`.
  - Define precedence between built-ins, inventory-side `.env`, job variables, and runtime overrides.
  - Define missing-variable and escaped-variable behavior.
  - Dependency: AR-001.

- [x] **AR-004 Define execution API contract**
  - Define run, stop, history-list, and history-detail request and response payloads.
  - Return a stable `runId` when a run starts.
  - Define validation and conflict error responses.
  - Dependency: AR-001, AR-002, AR-003.

- [x] **AR-005 Define Socket.IO event contract**
  - Define event names, payloads, identifiers, timestamps, stream type, and terminal states.
  - Include `runId`, automation ID, group, host, and task identifiers in events.
  - Define reconnect and initial-snapshot behavior.
  - Dependency: AR-004.

### P0 - Backend Runner

- [ ] **AR-006 Create runner domain models**
  - Add job, task, rollback, inventory host, run, and run-event models.
  - Validate required fields by task type.
  - Dependency: AR-001, AR-002.

- [ ] **AR-007 Implement YAML parser and validator**
  - Parse the custom YAML format.
  - Return line, column, job, task, and field errors.
  - Reject unsupported task types and malformed rollback definitions.
  - Dependency: AR-006.

- [ ] **AR-008 Implement inventory INI and `.env` loader**
  - Load inventory groups and hosts.
  - Resolve `local` without inventory access.
  - Load `.env` beside the selected inventory.
  - Mask secret values in errors and logs.
  - Dependency: AR-002, AR-003, AR-006.

- [ ] **AR-009 Implement CLI task execution**
  - Execute local commands with cancellation support.
  - Stream stdout and stderr separately.
  - Capture exit code and duration.
  - Dependency: AR-005, AR-006.

- [ ] **AR-010 Implement SSH task execution**
  - Connect using inventory credentials or certificate configuration.
  - Execute scripts remotely with cancellation support.
  - Stream stdout and stderr separately.
  - Dependency: AR-008, AR-009.

- [ ] **AR-011 Implement file-transfer task execution**
  - Transfer files over SFTP.
  - Validate source and destination paths.
  - Report transfer progress or meaningful transfer status.
  - Dependency: AR-008, AR-005.

- [ ] **AR-012 Implement REST API task execution**
  - Support method, URL, headers, body, timeout, and variable interpolation.
  - Return status, response headers, and response body safely.
  - Mask configured secrets in output.
  - Dependency: AR-003, AR-005.

- [ ] **AR-013 Implement log task execution**
  - Emit a structured log event without invoking a process.
  - Resolve runtime variables using the common resolver.
  - Dependency: AR-003, AR-005.

- [ ] **AR-014 Implement sequential task execution and parallel runs**
  - Run tasks in declared order within a job and host.
  - Allow independent automation jobs to run concurrently.
  - Isolate cancellation, status, events, and output by `runId`.
  - Dependency: AR-009, AR-010, AR-011, AR-012, AR-013.

- [ ] **AR-015 Implement cancellation**
  - Stop exactly one run by `runId`.
  - Propagate cancellation to local processes, SSH commands, transfers, and REST requests.
  - Emit a terminal canceled event.
  - Dependency: AR-014.

- [ ] **AR-016 Implement per-task rollback**
  - Define whether rollback runs after failure, manual stop, or both.
  - Execute rollback in reverse completed-task order where applicable.
  - Emit rollback start, output, completion, and failure events.
  - Dependency: AR-014, AR-005.

### P0 - Frontend Run Experience

- [ ] **AR-017 Add automation run types and Redux state**
  - Store runs by `runId`, not one global running flag.
  - Track active step, event list, status, error, and rollback status.
  - Keep runs for other jobs active when changing tabs.
  - Dependency: AR-004, AR-005.

- [ ] **AR-018 Add run and stop service methods**
  - Implement typed REST calls for starting and stopping a run.
  - Normalize API errors for toast and inline display.
  - Dependency: AR-004.

- [ ] **AR-019 Add Socket.IO client integration**
  - Subscribe by `runId` and automation ID.
  - Dispatch incoming events to the automation slice.
  - Unsubscribe when changing tabs, collections, or completing a run.
  - Handle reconnect without duplicating events.
  - Dependency: AR-005, AR-017.

- [ ] **AR-020 Add header run controls**
  - Add `Run` and `Stop` to `AutomationEditorHeader.tsx`.
  - Show running, stopping, passed, failed, canceled, and rollback-failed states.
  - Show inventory/target summary and active `runId` where useful.
  - Disable Run when YAML is invalid or content is unpushed.
  - Dependency: AR-017, AR-018, AR-019, AR-023.

- [ ] **AR-021 Add live step log panel**
  - Replace the placeholder Last run panel in `AutomationEditor.tsx`.
  - Group output by job, group, host, and task.
  - Separate stdout and stderr.
  - Show task status, timestamps, duration, errors, and rollback output.
  - Dependency: AR-017, AR-019.

- [ ] **AR-022 Add execution history panel**
  - Load recent runs for the selected automation.
  - Show status, duration, inventory, task/host counts, and rollback summary.
  - Open immutable historical logs without replacing an active run.
  - Add pagination or retention handling.
  - Dependency: AR-004, AR-017.

- [ ] **AR-023 Add collection push state handling**
  - Show unsaved and unpushed YAML, inventory, and configuration changes.
  - Block execution of stale persisted content or provide explicit push-before-run.
  - Keep collection push as the persistence boundary.
  - Dependency: existing collection push flow.

### P1 - Editor and Configuration

- [ ] **AR-024 Replace Ansible-only editor language**
  - Replace the Ansible catalog badge and wording with the custom runner/schema version.
  - Replace or explicitly map `limit`, `tags`, `extraVars`, check mode, and diff mode.
  - Update starter YAML and help links.
  - Dependency: AR-001.

- [ ] **AR-025 Add custom YAML completion**
  - Provide completion for job, task, rollback, host, variable, and type fields.
  - Add task-type-specific examples.
  - Dependency: AR-001, AR-007.

- [ ] **AR-026 Add inline YAML validation**
  - Show syntax and semantic errors with line and column information.
  - Prevent Run when validation errors exist.
  - Distinguish warnings from blocking errors.
  - Dependency: AR-007.

- [ ] **AR-027 Add target and runtime variable controls**
  - Select inventory file and target group/host.
  - Explain `local` execution.
  - Support non-secret runtime overrides.
  - Never display `.env` secret values in plaintext.
  - Dependency: AR-003, AR-008.

- [ ] **AR-028 Add rollback editor guidance**
  - Document and complete rollback fields in YAML.
  - Validate rollback task types and required fields.
  - Show rollback behavior in the run panel.
  - Dependency: AR-016, AR-025, AR-026.

- [ ] **AR-029 Remove duplicate inventory dialog**
  - Render the inventory creation `PromptDialog` only once.
  - Keep create, attach, and persist behavior unchanged.
  - Dependency: none.

### P1 - Persistence and Security

- [ ] **AR-030 Persist execution history**
  - Store run metadata and immutable events in BoltDB or the selected history store.
  - Support list and detail queries by automation and `runId`.
  - Define retention limits.
  - Dependency: AR-004, AR-005, AR-014.

- [ ] **AR-031 Implement secret masking**
  - Mask passwords, tokens, private key material, and configured secret values.
  - Apply masking to live logs, errors, history, and API responses.
  - Ensure ordinary collection push does not include `.env` secrets.
  - Dependency: AR-008, AR-030.

- [ ] **AR-032 Add authorization and path safety**
  - Prevent path traversal for job, inventory, `.env`, source, and destination paths.
  - Restrict access to the active collection.
  - Validate remote destination paths and command execution permissions.
  - Dependency: AR-008, AR-011, AR-030.

### P1 - Verification and Operations

- [ ] **AR-033 Add backend runner unit tests**
  - Cover YAML validation, interpolation, inventory parsing, task dispatch, cancellation, rollback, and masking.
  - Use fakes for SSH, SFTP, REST, and process execution.
  - Dependency: AR-007 through AR-016.

- [ ] **AR-034 Add backend API and event tests**
  - Cover run, stop, history, event ordering, reconnect snapshot, and concurrent `runId` isolation.
  - Dependency: AR-004, AR-005, AR-014, AR-030.

- [ ] **AR-035 Add frontend state and component tests**
  - Cover Run/Stop states, invalid YAML blocking, unpushed content blocking, event rendering, tab changes, and history selection.
  - Dependency: AR-017 through AR-022, AR-026.

- [ ] **AR-036 Add end-to-end execution tests**
  - Verify local CLI, SSH, file transfer, REST, log, cancellation, rollback, and parallel jobs.
  - Verify secret values never appear in UI or persisted logs.
  - Dependency: AR-033, AR-034, AR-035.

- [ ] **AR-037 Add runner observability**
  - Add structured server logs, run correlation IDs, durations, task counters, and failure causes.
  - Ensure operational logs also apply secret masking.
  - Dependency: AR-014, AR-031.

## Suggested Delivery Order

1. AR-001 through AR-005: freeze the contract.
2. AR-006 through AR-008: parse and resolve inputs.
3. AR-009 through AR-016: implement runner execution.
4. AR-017 through AR-023: connect the frontend run experience.
5. AR-024 through AR-029: complete the editor experience.
6. AR-030 through AR-032: persistence and security hardening.
7. AR-033 through AR-037: verification and operations.
