# Automation Runner Contract v1

This document freezes AR-001 through AR-005. It is the contract for the parser,
runner, REST API, and Socket.IO client. Execution and persistence are implemented
by later backlog items.

## YAML Procedure

A procedure file contains one or more jobs. The root value is a non-empty YAML
list. `hosts` accepts a scalar or a list of target names; parsers normalize both
forms to a list.

```yaml
- name: deploy service
  hosts: dev
  variables:
    artifact: ${jobPath}/build/app.jar
  tasks:
    - name: stop service
      type: ssh
      script: docker compose down
      rollback:
        - name: restore service
          type: ssh
          script: docker compose up -d
    - name: upload artifact
      type: file-transfer
      src: ${artifact}
      dest: /srv/app/app.jar
    - name: verify service
      type: rest-api
      method: GET
      url: https://example.test/health
      timeout: 10s
```

Job fields:

| Field | Required | Description |
| --- | --- | --- |
| `name` | yes | Human-readable job name. |
| `hosts` | yes | Inventory group, explicit host, `local`, or a list of these. |
| `variables` | no | String-to-string job variables. |
| `tasks` | yes | Non-empty ordered task list. |

Task types and required fields:

| Type | Required fields | Optional fields |
| --- | --- | --- |
| `ssh` | `script` | `rollback` |
| `cli-execute` | `script` | `rollback` |
| `file-transfer` | `src`, `dest` | `rollback` |
| `rest-api` | `method`, `url` | `headers`, `body`, `timeout`, `rollback` |
| `log` | `message` | `rollback` |

`dest` and `cli-execute` are the canonical spellings. REST tasks use structured
`method`, `url`, `headers`, `body`, and `timeout` fields; shell `curl-command` is
not part of the contract. `timeout` is a Go duration string such as `10s`.

`rollback` is a non-empty list of task objects. Rollback tasks cannot contain a
nested `rollback`. Unsupported types, missing `type`, missing required fields,
empty documents, and malformed rollback values are validation errors.

Tasks run in declaration order for each host. Hosts run concurrently, and
independent jobs run concurrently. A run request selects one procedure file and
includes all jobs in that file.

## Inventory and Targeting

Inventory files are INI files. Sections are groups and each host entry contains
connection attributes. The initial supported connection type is `ssh`.

```ini
[dev]
app-1 type=ssh host=10.8.7.19 port=2290 username=root password=${password}
app-2 type=ssh host=10.8.7.20 port=2290 username=root password=${password}
```

`local` is built in and never requires inventory access. A non-local target is
resolved as an inventory group first, then as an explicit host. Missing groups,
hosts, empty target resolution, or an inventory-required target without an
inventory are blocking validation errors. Duplicate resolved hosts are removed.

## Runtime Variables

Variables use `${name}`. `$${name}` escapes interpolation and produces the
literal `${name}`. Resolution applies to paths, scripts, REST fields, headers,
bodies, and log messages.

Precedence, from lowest to highest, is inventory-side `.env`, job `variables`,
then request-scoped runtime overrides. `jobPath` is the absolute path of the
selected YAML file and is reserved; it cannot be overridden. A missing variable
is a validation error before execution. `.env` values and secrets never appear
in frontend payloads, logs, history, or error messages.

## REST API

All paths include the existing `/api/v1` prefix.

### Start

`POST /collection/{collectionId}/automation/run`

```json
{
  "filename": "deploy.yaml",
  "inventoryFile": "stage.ini",
  "targets": ["dev"],
  "runtimeOverrides": {"release": "2026.08.31"}
}
```

The server returns immediately with a stable `runId`:

```json
{
  "runId": "run_01J...",
  "automationId": "deploy.yaml",
  "filename": "deploy.yaml",
  "inventoryFile": "stage.ini",
  "status": "queued",
  "startedAt": "2026-08-31T12:00:00Z"
}
```

### Stop

`POST /collection/{collectionId}/automation/stop`

```json
{"runId": "run_01J..."}
```

Stop targets exactly one run. It is idempotent for terminal runs.

### History

`GET /collection/{collectionId}/automation/{filename}/runs?page=1&pageSize=20`

`GET /collection/{collectionId}/automation/{filename}/runs/{runId}`

History is immutable. List responses contain run summaries; detail responses
also contain the ordered event list. Terminal statuses are `passed`, `failed`,
`canceled`, and `rollback-failed`. Non-terminal statuses are `queued`, `running`,
and `stopping`.

Invalid input returns the existing invalid-data response with validation details.
Conflicting state returns HTTP 409 with a stable conflict code.

The contract uses `automation:conflict` as the conflict code. Validation errors
use `automation:validation-error`.

## Socket.IO Events

Clients subscribe by collection plus `runId` and/or automation ID. Event names:

`automation:run-started`, `automation:step-started`, `automation:log`,
`automation:step-finished`, `automation:rollback-started`,
`automation:rollback-finished`, `automation:run-finished`,
`automation:run-error`, and `automation:run-canceled`.

Every event includes `eventId`, `runId`, `automationId`, `filename`, `timestamp`
(RFC3339 UTC), and a monotonically increasing per-run `sequence`. Step events
also include `jobId`, `jobName`, `group`, `host`, `taskId`, `taskName`,
`taskType`, and `rollback`.

Log events additionally include `stream` (`stdout`, `stderr`, or `system`) and
`message`. Secrets are masked before emission. Terminal events include final
status and `finishedAt`.

Ordering is guaranteed within a run by `sequence`; cross-run ordering is not.
On reconnect, the client sends its last sequence. The server returns the current
snapshot and retained events after that sequence. If events are no longer
retained, it returns a fresh snapshot followed by live events. Clients de-dupe
by `eventId`.
