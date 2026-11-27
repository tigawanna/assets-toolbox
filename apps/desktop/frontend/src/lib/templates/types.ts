export type TemplateTool = "brand" | "studio";

export interface TemplateRecord<T = unknown> {
  id: string;
  tool: TemplateTool;
  name: string;
  description: string;
  data: T;
  createdAt: string;
}

export interface TemplateInput<T = unknown> {
  tool: TemplateTool;
  name: string;
  description?: string;
  data: T;
}
