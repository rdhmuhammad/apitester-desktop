export type ColtBodyType = "raw" | "formdata" | "urlencoded" | "file" | "graphql";

export interface GetCollectionResponse {
  changed: boolean;
  content: DocsContent;
  updatedAt: string;
  version: string;
}

export interface DocsContent {
  info: CollectionInfo;
  item: CollectionItem[];
  auth?: CollectionAuth;
  variable: CollectionVar[];
  event?: CollectionEvent[];
}

export interface CollectionInfo {
  _postman_id: string;
  name: string;
  description: string;
  schema: string;
}

export interface CollectionItem {
  funIden?: string;
  name: string;
  item?: CollectionItem[];
  request?: Request;
  response?: CollectionResponse[];
  event?: CollectionEvent[];
  id: string;
  description?: string;
}

export interface CollectionResponse {
  id?: string;
  name: string;
  originalRequest?: Request;
  status: string;
  code: number;
  _postman_previewlanguage?: string | null;
  header: ItemUrl[];
  cookie: ResponseCookie[];
  body: string;
}

export interface ResponseCookie {
  key: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface ReqAuth {
  id?: string;
  name?: string;
  type: string;
  disabled?: boolean;
  bearer?: ItemUrl[];
  basic?: ItemUrl[];
  apikey?: ItemUrl[];
  oauth2?: ItemUrl[];
  authSource?: "inherit" | "onrequest" | "none" | string;
}

export interface Request {
  funIden?: string;
  method: string;
  auth?: ReqAuth;
  header: ItemUrl[];
  body?: RequestBody;
  url: RequestURL;
  description?: string;
}

export interface RequestBody {
  mode: ColtBodyType;
  raw?: string;
  formdata?: ItemUrl[];
  urlencoded?: ItemUrl[];
  file?: { src?: string } | Record<string, unknown>;
  graphql?: { query?: string; variables?: string } | Record<string, unknown>;
  options?: Record<string, unknown>;
  disabled?: boolean;
}

export interface ItemUrl {
  id?: string;
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
  type?: string;
  src?: string;
}

export interface PathVariable {
  id: string;
  key: string;
  value: string;
}

export interface URLAuth {
  user?: string;
  password?: string;
}

export interface RequestURL {
  raw: string;
  protocol?: string;
  host: string[];
  port?: string;
  path: string[];
  query: ItemUrl[];
  hash?: string;
  auth?: URLAuth;
  variable?: PathVariable[];
}

export interface CollectionAuth {
  type: string;
  bearer?: AuthProperty[];
}

export interface AuthProperty {
  key: string;
  value: string;
  type: string;
}

export interface CollectionEvent {
  id?: string;
  listen: string;
  disabled?: boolean;
  script: EventScript;
}

export interface EventScript {
  id?: string;
  name?: string;
  exec: string[];
  type: string;
  src?: string | RequestURL;
}

export interface CollectionVar {
  id: string;
  key: string;
  value: string;
  category: string;
  type: string;
  isSelected?: boolean;
}
