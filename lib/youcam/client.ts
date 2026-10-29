import { sha256 } from "@/lib/utils/hash";
import { YOUCAM_APIS, findResultUrl, skinUnits, TEMPLATE_PATHS, DEFAULT_SKIN_CONCERNS, type SdConcern, type YouCamApi } from "./apis";
import { renderCacheKey, type RenderCacheStore } from "./cache";
import { YouCamError } from "./errors";
import type { UnitGuard } from "./guard";
import type { YouCamHttp, PollOptions } from "./http";
import { loadFixture } from "./mock";

export type YouCamResult = {
  api: YouCamApi;
  cacheKey: string;
  source: "live" | "cache" | "mock";
  /** Raw final poll response. */
  response: unknown;
  /** Result image for try-on APIs. */
  image?: Buffer;
  /** Storage path of the cached image, when stored. */
  imagePath?: string;
};

export type Template = { id: string; title: string; category_name?: string; thumb?: string };

type YouCamDeps = {
  http: YouCamHttp;
  guard: UnitGuard;
  cache: RenderCacheStore;
  mock: boolean;
  poll?: PollOptions;
};

type RunInput = {
  api: YouCamApi;
  selfieHash: string;
  productId?: string | null;
  /** Everything that changes the output. Part of the cache key. */
  params: Record<string, unknown>;
  src: Buffer;
  units: number;
  body: (srcFileId: string) => Record<string, unknown>;
  /** Fixture name for mock mode. Defaults to the API name. */
  fixture?: string;
};

export class YouCamClient {
  constructor(private readonly deps: YouCamDeps) {}

  private async run(input: RunInput): Promise<YouCamResult> {
    const { api, selfieHash, productId, params } = input;
    const cacheKey = renderCacheKey({ selfieHash, productId, api, params });

    if (this.deps.mock) {
      const fx = await loadFixture(input.fixture ?? api);
      return { api, cacheKey, source: "mock", response: fx.response, image: fx.image };
    }

    const hit = await this.deps.cache.get(cacheKey);
    if (hit) return { ...hit, api, source: "cache" };

    const spec = YOUCAM_APIS[api];
    const { response, image } = await this.deps.guard.run(api, input.units, cacheKey, async () => {
      const fileId = await this.deps.http.uploadFile(input.src, `${api}-${sha256(input.src).slice(0, 12)}.jpg`);
      const taskId = await this.deps.http.createTask(spec.path, input.body(fileId));
      const polled = await this.deps.http.pollTask(spec.path, taskId, this.deps.poll);
      if (spec.output !== "image") return { response: polled, image: undefined };
      const url = findResultUrl(polled.data.results);
      if (!url) throw new YouCamError("UNKNOWN", `${api} succeeded without a result URL`);
      return { response: polled, image: await this.deps.http.download(url) };
    });

    // Paid for already: if caching fails, still return it (shown inline instead of from storage).
    const stored = await this.deps.cache
      .put({ cacheKey, api, response, image, selfieHash, productId, params })
      .catch((err: Error) => {
        console.warn(`[youcam] ${api} result not cached: ${err.message}`);
        return { imagePath: undefined };
      });
    return { api, cacheKey, source: "live", response, image, imagePath: stored.imagePath };
  }

  /** Clothes try-on (v3). `garmentUrl` must be a public product image. */
  tryOnClothes(args: { photo: Buffer; selfieHash: string; productId: string; garmentUrl: string; fixture?: string }) {
    const params = { garment_category: "auto", ref_file_url: args.garmentUrl };
    return this.run({
      api: "clothes",
      selfieHash: args.selfieHash,
      productId: args.productId,
      params,
      src: args.photo,
      units: YOUCAM_APIS.clothes.units,
      body: (src_file_id) => ({ src_file_id, ...params }),
      fixture: args.fixture,
    });
  }

  /** Hair try-on from a preset template. `source` names what `photo` is (e.g. "photo", "clothes:<id>"). */
  tryOnHair(args: { photo: Buffer; selfieHash: string; templateId: string; source?: string; fixture?: string }) {
    const params = { template_id: args.templateId, source: args.source ?? "photo" };
    return this.run({
      api: "hair",
      selfieHash: args.selfieHash,
      params,
      src: args.photo,
      units: YOUCAM_APIS.hair.units,
      body: (src_file_id) => ({ src_file_id, template_id: args.templateId }),
      fixture: args.fixture,
    });
  }

  tryOnBeard(args: { photo: Buffer; selfieHash: string; templateId: string; fixture?: string }) {
    const params = { template_id: args.templateId };
    return this.run({
      api: "beard",
      selfieHash: args.selfieHash,
      params,
      src: args.photo,
      units: YOUCAM_APIS.beard.units,
      body: (src_file_id) => ({ src_file_id, template_id: args.templateId }),
      fixture: args.fixture,
    });
  }

  /** SD skin analysis on the close face crop. */
  analyzeSkin(args: { photo: Buffer; selfieHash: string; concerns?: SdConcern[] }) {
    const concerns = [...(args.concerns ?? DEFAULT_SKIN_CONCERNS)].sort();
    const params = { dst_actions: concerns, format: "json" };
    return this.run({
      api: "skin",
      selfieHash: args.selfieHash,
      params,
      src: args.photo,
      units: skinUnits(concerns.length),
      body: (src_file_id) => ({ src_file_id, ...params }),
    });
  }

  /** Preset hair or beard templates (free; no units). */
  async listTemplates(kind: keyof typeof TEMPLATE_PATHS): Promise<Template[]> {
    if (this.deps.mock) {
      const fx = await loadFixture(`${kind}-templates`, 0);
      return fx.response as Template[];
    }
    const out: Template[] = [];
    let next: string | undefined;
    do {
      const query = new URLSearchParams({ page_size: "20", ...(next ? { starting_token: next } : {}) });
      const res = await this.deps.http.get<{ data: { templates: Template[]; next_token?: string } }>(
        `${TEMPLATE_PATHS[kind]}?${query}`,
      );
      out.push(...res.data.templates);
      next = res.data.next_token || undefined;
    } while (next && out.length < 500);
    return out;
  }
}
