export type DocumentKind = "id-card" | "house-registration" | "payment-slip";
export type DemoDocumentScenario = "clear" | "blurred" | "expired" | "mismatch";
export interface DocumentField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  input: "text" | "date" | "number";
  reviewed: boolean;
  edited?: boolean | undefined;
}
export interface DocumentAnalysis {
  id: string;
  provider: "demo" | "api";
  kind: DocumentKind;
  sourceName: string;
  scenario: DemoDocumentScenario;
  analyzedAt: string;
  fields: DocumentField[];
  confirmedAt?: string | undefined;
  confirmedBy?: string | undefined;
}
export interface DocumentSubject {
  bookingId: string;
  name: string;
  idNumber: string;
  deposit: number;
}
export interface DocumentAnalysisRequest {
  kind: DocumentKind;
  scenario: DemoDocumentScenario;
  sourceName: string;
  subject: DocumentSubject;
  /** Ephemeral upload input for a future server adapter; never stored in Booking. */
  file?: File | undefined;
}
export interface DocumentIssue {
  key: string;
  message: string;
  level: "block" | "review";
}
export interface DocumentProvider {
  analyze(request: DocumentAnalysisRequest, signal?: AbortSignal): Promise<DocumentAnalysis>;
}
export interface AssistantRecord {
  id: string;
  title: string;
  detail: string;
  href: string;
}
export interface AssistantContext {
  roleName: string;
  branchLabel: string;
  currentPath: string;
  currentBookingId?: string | undefined;
  bookings: (AssistantRecord & {
    status: string;
    step: string;
    remaining: number;
    expiresIn: number;
  })[];
  tasks: (AssistantRecord & { days: number; status: string })[];
  vehicles: (AssistantRecord & { ready: boolean; bonus: number })[];
  commissions: AssistantRecord[];
  refunds: AssistantRecord[];
  loyalty: AssistantRecord[];
  documents: AssistantRecord[];
}
export interface AssistantReply {
  text: string;
  references: AssistantRecord[];
  suggestions: string[];
}
export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AssistantRecord[] | undefined;
  suggestions?: string[] | undefined;
}
export interface ChatRequest {
  question: string;
  context: AssistantContext;
  history: Pick<AssistantMessage, "role" | "text">[];
}
export interface ChatProvider {
  reply(request: ChatRequest, signal?: AbortSignal): Promise<AssistantReply>;
}
