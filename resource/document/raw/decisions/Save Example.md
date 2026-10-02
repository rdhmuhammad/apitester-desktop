---
source_code: D:\personal\apitester
---

### Feature Architecture & Knowledge Graph Overview

In the API Tester architecture, saving a response example bridges the active HTTP execution view ([`ResponseView.tsx`](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx)) and the collection document model ([`CollectionResponse`](file:///d:/personal/apitester/frontend/src/pages/editor/types/api.ts#L35-L45)) following the Postman Collection v2.1 schema.

The feature works across three core components:
1. **User Interface** ([`ResponseView.tsx`](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx)): Captures the user's intent to save the live response, asks for a descriptive name via a dialog, and provides a tabbed UI allowing switching between the actual response and saved example responses.
2. **State Slice & Reducers** ([`collectionSlices.ts`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts)): Creates a snapshot of the current `response` and `request`, assigns a unique identifier (`crypto.randomUUID()`), appends it to `exampleResponse[]`, and marks the tab dirty for persistence.
3. **Request Synchronization** ([`requestSlices.ts`](file:///d:/personal/apitester/frontend/src/app/slices/requestSlices.ts)): Associates the example with its `originalRequest`, allowing the user to inspect what request produced that example.

---

### Code Locations & Line References

#### 1. UI Layer: [`ResponseView.tsx`](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx)
- **Action & Selector Imports**: [ResponseView.tsx#L26-L41](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L26-L41)
  Imports [`saveExampleResponse`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L214-L236), [`selectActiveExampleId`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L679-L680), [`selectActiveExample`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L682-L686), etc.
- **Active State Hooks**: [ResponseView.tsx#L111-L116](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L111-L116)
  Retrieves `examples`, `activeExampleId`, and `activeExample` from Redux state.
- **Dialog State**: [ResponseView.tsx#L227-L228](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L227-L228)
  Local component state for `dialogOpen` and `exampleName`.
- **Save Action Handler [`handleSaveExample`](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L248-L253)**: [ResponseView.tsx#L248-L253](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L248-L253)
  Dispatches `saveExampleResponse({ id: selectedRequest.id, name: exampleName.trim() })`.
- **Toolbar "Save" Trigger Button**: [ResponseView.tsx#L464-L469](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L464-L469)
  Renders the Save button with disabling logic: `disabled={!currResponse || Boolean(activeExample)}`.
- **Save Name Modal Dialog**: [ResponseView.tsx#L693-L714](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L693-L714)
  Modal dialog containing `<Input>` for naming the example and Triggering `handleSaveExample()`.
- **Tab Header & Management (Rename, Delete, Switch)**: [ResponseView.tsx#L375-L455](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L375-L455)
  Displays "Actual Response" along with each saved example, supporting inline renaming and deletion.
- **Status Code Selector for Examples**: [ResponseView.tsx#L312-L362](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L312-L362)
  Switches the static status badge to a dropdown selector to alter HTTP status code when an example tab is active.
- **Editable Sandbox Body for Examples**: [ResponseView.tsx#L524-L541](file:///d:/personal/apitester/frontend/src/pages/editor/components/ResponseView.tsx#L524-L541)
  Sets `readOnly={!activeExample}` so example bodies can be modified directly in the editor.

#### 2. Redux State & Persistence: [`collectionSlices.ts`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts)
- **[`saveExampleResponse`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L214-L236)**: [collectionSlices.ts#L214-L236](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L214-L236)
  Creates snapshot: captures `active.response.statusCode`, `active.response.statusText`, `active.response.data`, headers, and `originalRequest: active.request`, pushing to `active.exampleResponse`.
- **[`addExampleResponse`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L237-L272)**: [collectionSlices.ts#L237-L272](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L237-L272)
  Creates a blank template example.
- **[`removeExampleResponse`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L273-L327)**: [collectionSlices.ts#L273-L327](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L273-L327)
  Removes the example and resets `activeExampleId` to `null` if active.
- **[`updateExampleResponseBody`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L344-L357)** & **[`updateExampleResponseStatus`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L358-L372)**: [collectionSlices.ts#L344-L372](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L344-L372)
  Permits editing the saved response body and status code.
- **[`saveActiveToData`](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L179-L195)**: [collectionSlices.ts#L179-L195](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L179-L195)
  Copies `active.exampleResponse` to `target.response` in the collection tree for file/database persistence.
- **Selectors**: [collectionSlices.ts#L679-L686](file:///d:/personal/apitester/frontend/src/app/slices/collectionSlices.ts#L679-L686)
  Exports `selectActiveExampleId` and `selectActiveExample`.

#### 3. Types & Request Binding
- **[`CollectionResponse`](file:///d:/personal/apitester/frontend/src/pages/editor/types/api.ts#L35-L45)**: [api.ts#L35-L45](file:///d:/personal/apitester/frontend/src/pages/editor/types/api.ts#L35-L45)
  Defines `id`, `name`, `status`, `code`, `header`, `cookie`, `body`, and `originalRequest`.
- **[`getSelectedRequest`](file:///d:/personal/apitester/frontend/src/app/slices/requestSlices.ts#L64-L84)**: [requestSlices.ts#L64-L84](file:///d:/personal/apitester/frontend/src/app/slices/requestSlices.ts#L64-L84)
  Returns `example.originalRequest` whenever `activeExampleId` is active.

---

### The Specification Prompt

Below is the implementation prompt that can be supplied to an AI or developer to construct this feature:

```markdown
### Task: Implement "Save Response as Example" Feature in ResponseView

#### Objective
Enable users in `ResponseView.tsx` to save the active HTTP response as a mock/example response into the active request collection item, compatible with Postman Collection v2.1 format.

#### 1. Data Contract & Types (`frontend/src/pages/editor/types/api.ts`)
Ensure the `CollectionResponse` interface includes:
```ts
export interface CollectionResponse {
  id?: string;
  name: string;
  originalRequest?: Request;
  status: string;
  code: number;
  header: ItemUrl[];
  cookie: ResponseCookie[];
  body: string;
}
```
Add `exampleResponse?: CollectionResponse[]` and `activeExampleId?: string | null` to the active request tab state in `ActiveItem` (`frontend/src/app/slices/index.ts`).

#### 2. Redux Slice Reducers (`frontend/src/app/slices/collectionSlices.ts`)
Implement the following reducers:
- `saveExampleResponse({ id: string; name: string })`:
  1. Locate the active tab by `id`.
  2. If `active.response` or `active.request` is absent, return early.
  3. Construct a `CollectionResponse` taking `statusCode`, `statusText`, serialized JSON `body: JSON.stringify(active.response.data)`, headers, and `originalRequest: active.request`.
  4. Append to `active.exampleResponse` and mark `id` in `state.dirtyRequestIds`.
- `addExampleResponse`: Generates a blank 200 OK default example.
- `removeExampleResponse`: Filters out the example and clears `activeExampleId` if it was active.
- `renameExampleResponse`: Renames the example.
- `updateExampleResponseBody` & `updateExampleResponseStatus`: Modifies example body and status code.
- `saveActiveToData`: Sync `tab.exampleResponse` to `target.response` in `state.data.item`.
- Selectors: `selectActiveExampleId` and `selectActiveExample`.

#### 3. Request Sync (`frontend/src/app/slices/requestSlices.ts`)
In `getSelectedRequest`:
- If `currentActive.activeExampleId` is active, return `example.originalRequest` so the request editor displays the parameters that generated this example.

#### 4. UI Implementation (`frontend/src/pages/editor/components/ResponseView.tsx`)
- **Save Trigger Button**:
  - Add a button in the response actions bar with icon `<Download className="mr-1 h-4 w-4"/> Save`.
  - Disable condition: `disabled={!currResponse || Boolean(activeExample)}` (cannot save if no response exists, or if already viewing an example).
  - Clicking sets `dialogOpen = true`.
- **Save Modal Dialog**:
  - Modal with title "Save Example Response" and description "Enter a name for this response example.".
  - Text input for `exampleName` (placeholder: "e.g. Success 200"). Pressing Enter or clicking "Save" calls `handleSaveExample()`.
  - `handleSaveExample` dispatches `saveExampleResponse` and closes the modal.
- **Example Tabs Header**:
  - Add a sub-tab bar above the editor: "Actual Response" tab plus a tab for each item in `examples`.
  - When an example tab is active:
    - Display the example body in the Sandpack editor with `readOnly={false}` and dispatch `updateExampleResponseBody` on change.
    - Transform the HTTP status badge into an interactive dropdown (`<Select>`) allowing the user to select HTTP codes/status text.
    - Provide inline rename (`<Pencil>`) and delete (`<X>`) controls on each example tab.