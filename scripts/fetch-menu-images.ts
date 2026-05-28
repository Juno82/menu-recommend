/**
 * MENU_POOL의 각 메뉴에 대해 한국어 Wikipedia에서 대표 이미지를 받아 public/menu-images/에 저장한다.
 *
 * 실행:
 *   bun run scripts/fetch-menu-images.ts            # 전체
 *   bun run scripts/fetch-menu-images.ts --sample   # 대표 5개만 (톤 검토용)
 *
 * 동작:
 *   1. ko.wikipedia 검색 API로 메뉴명 → 가장 가까운 페이지 제목 찾기
 *   2. 그 페이지의 pageimages(piprop=original)로 대표 이미지 URL 추출
 *   3. 이미지 다운로드해서 public/menu-images/{메뉴명}.{ext} 저장
 *   4. 매칭 실패 시 로그만 남기고 다음 메뉴 진행 (UI는 fallback 처리)
 *
 * 이미 파일이 있으면 skip. User-Agent 헤더 필수 (Wikimedia 정책).
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MENU_POOL } from "@/config/menu-pool";

const OUTPUT_DIR = resolve(process.cwd(), "public/menu-images");
const SAMPLE_MENUS = ["칼국수", "김치찌개", "짜장면", "피자", "떡볶이"];
const UA = "menu-recommend/0.1 (educational; contact: junho1.kim@lge.com)";
const API = "https://ko.wikipedia.org/w/api.php";

function parseArgs(): { sampleOnly: boolean } {
  return { sampleOnly: process.argv.slice(2).includes("--sample") };
}

async function fileExistsAny(menuName: string): Promise<boolean> {
  try {
    const entries = await readdir(OUTPUT_DIR);
    return entries.some((e) => e.startsWith(`${menuName}.`));
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikiSearchTitle(query: string): Promise<string | null> {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = (await res.json()) as {
    query?: { search?: { title: string }[] };
  };
  return json.query?.search?.[0]?.title ?? null;
}

async function wikiPageImage(title: string): Promise<string | null> {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "512");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`pageimages ${res.status}`);
  const json = (await res.json()) as {
    query?: {
      pages?: Record<string, { thumbnail?: { source?: string } }>;
    };
  };
  const pages = json.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const source = page.thumbnail?.source;
    if (source) return source;
  }
  return null;
}

function extFromUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  const m = path.match(/\.(jpg|jpeg|png|webp|gif|svg)$/);
  return m ? m[1].replace("jpeg", "jpg") : "jpg";
}

async function downloadImage(
  imageUrl: string,
  outPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
}

async function fetchOne(menuName: string): Promise<{
  status: "saved" | "no-page" | "no-image";
  detail?: string;
}> {
  // 1) 정확 제목 시도 → pageimages
  let image = await wikiPageImage(menuName);
  let usedTitle = menuName;
  // 2) 직접 제목 매칭 실패 → 검색으로 가장 가까운 제목 찾고 재시도
  if (!image) {
    const found = await wikiSearchTitle(menuName);
    if (!found) return { status: "no-page" };
    usedTitle = found;
    image = await wikiPageImage(found);
  }
  if (!image) return { status: "no-image", detail: usedTitle };
  const ext = extFromUrl(image);
  const outPath = resolve(OUTPUT_DIR, `${menuName}.${ext}`);
  await downloadImage(image, outPath);
  return { status: "saved", detail: usedTitle };
}

async function main(): Promise<void> {
  const { sampleOnly } = parseArgs();
  await mkdir(OUTPUT_DIR, { recursive: true });

  const targets = sampleOnly
    ? MENU_POOL.filter((m) => SAMPLE_MENUS.includes(m.name))
    : MENU_POOL;
  console.log(
    `output: ${OUTPUT_DIR}\nmode: ${sampleOnly ? "sample (5)" : `full (${MENU_POOL.length})`}`,
  );

  let saved = 0;
  let skipped = 0;
  const failures: { name: string; reason: string }[] = [];

  for (const entry of targets) {
    if (await fileExistsAny(entry.name)) {
      skipped += 1;
      continue;
    }
    try {
      const r = await fetchOne(entry.name);
      if (r.status === "saved") {
        saved += 1;
        console.log(
          `✓ ${entry.name}${r.detail && r.detail !== entry.name ? ` (via "${r.detail}")` : ""} (${saved}/${targets.length - skipped})`,
        );
      } else if (r.status === "no-page") {
        failures.push({ name: entry.name, reason: "no wiki page" });
        console.warn(`- ${entry.name}: no wiki page`);
      } else {
        failures.push({
          name: entry.name,
          reason: `no image on "${r.detail}"`,
        });
        console.warn(`- ${entry.name}: no image on "${r.detail}"`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ name: entry.name, reason: msg });
      console.error(`✗ ${entry.name}: ${msg}`);
    }
    await sleep(200);
  }

  console.log(
    `\nfinished: ${saved} saved, ${skipped} skipped, ${failures.length} missing`,
  );
  if (failures.length > 0) {
    console.log(`missing (UI fallback will handle these):`);
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
