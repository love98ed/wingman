import { YouCamError, fromEngineError } from "./errors";

const YOUCAM_BASE_URL = "https://yce-api-01.makeupar.com";

type FetchLike = typeof fetch;

type TaskStatus = "running" | "success" | "error";

/** Shape of GET /s2s/v2.0/task/{feature}/{task_id} (per YouCam reference). */
type TaskPollResponse = {
  status: number;
  data: {
    task_status: TaskStatus;
    error?: string | null;
    error_message?: string;
    results?: unknown;
  };
};

export type PollOptions = {
  timeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class YouCamHttp {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = YOUCAM_BASE_URL,
  ) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 429 && attempt < 3) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      const json = (await res.json().catch(() => null)) as
        | (T & { error?: string; error_code?: string })
        | null;
      if (!res.ok || !json) {
        const errorCode = json?.error_code;
        if (errorCode === "CreditInsufficiency") {
          throw new YouCamError("QUOTA", "YouCam account is out of units", errorCode);
        }
        throw new YouCamError(
          "UNKNOWN",
          `YouCam ${method} ${path} failed: HTTP ${res.status} ${json?.error ?? ""}`.trim(),
          errorCode,
        );
      }
      return json;
    }
  }

  /** File API: register the file, then PUT the bytes to the presigned URL. Returns file_id. */
  async uploadFile(bytes: Buffer, fileName: string, contentType = "image/jpg"): Promise<string> {
    type FileResponse = {
      data: {
        files: {
          file_id: string;
          requests: { method: string; url: string; headers: Record<string, string> }[];
        }[];
      };
    };
    const created = await this.request<FileResponse>("POST", "/s2s/v2.0/file", {
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    });
    const file = created.data.files[0];
    const put = file?.requests[0];
    if (!file || !put) throw new YouCamError("UNKNOWN", "File API returned no upload URL");

    const res = await this.fetchImpl(put.url, {
      method: put.method,
      headers: put.headers,
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new YouCamError("UNKNOWN", `File upload failed: HTTP ${res.status}`);
    return file.file_id;
  }

  async createTask(path: string, body: Record<string, unknown>): Promise<string> {
    const res = await this.request<{ data: { task_id: string } }>("POST", path, body);
    return res.data.task_id;
  }

  /**
   * Poll until success or error, backing off between checks. YouCam charges units
   * only on success, but a task that is never polled again still consumes them,
   * so callers should keep timeouts generous.
   */
  async pollTask(path: string, taskId: string, opts: PollOptions = {}): Promise<TaskPollResponse> {
    const { timeoutMs = 120_000, initialDelayMs = 1500, maxDelayMs = 5000 } = opts;
    const started = Date.now();
    let delay = initialDelayMs;
    while (Date.now() - started < timeoutMs) {
      await sleep(delay);
      const res = await this.request<TaskPollResponse>("GET", `${path}/${encodeURIComponent(taskId)}`);
      const { task_status, error, error_message } = res.data;
      if (task_status === "success") return res;
      if (task_status === "error") throw fromEngineError(error, error_message);
      delay = Math.min(Math.round(delay * 1.5), maxDelayMs);
    }
    throw new YouCamError("TIMEOUT", `Task ${taskId} did not finish in ${timeoutMs / 1000}s`);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async download(url: string): Promise<Buffer> {
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new YouCamError("UNKNOWN", `Result download failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
