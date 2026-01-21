import { File } from "node:buffer";
import { FormData, Headers, Request, Response } from "undici";

if (!globalThis.File) globalThis.File = File as unknown as typeof globalThis.File;
if (!globalThis.FormData) globalThis.FormData = FormData as unknown as typeof globalThis.FormData;
if (!globalThis.Headers) globalThis.Headers = Headers as unknown as typeof globalThis.Headers;
if (!globalThis.Request) globalThis.Request = Request as unknown as typeof globalThis.Request;
if (!globalThis.Response) globalThis.Response = Response as unknown as typeof globalThis.Response;

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "service-role";
process.env.OPENAI_API_KEY ||= "test-openai-key";
