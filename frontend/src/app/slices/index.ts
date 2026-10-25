export type ScriptType = "prerequest" | "postrequest"

export interface ScriptResultDto {
    type: ScriptType
    data?: unknown
}
