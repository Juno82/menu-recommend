/**
 * 메뉴명 → 정적 이미지 경로. 빌드 타임에 public/menu-images/<menu>.<ext> 형태로
 * fetch-menu-images 스크립트가 다운로드한 결과를 가리킨다.
 *
 * Wikipedia 썸네일은 확장자가 일정하지 않아(jpg/png/svg.png 등) 단일 path를
 * 반환하지 않고 후보 목록을 돌려준다. 컴포넌트는 첫 후보로 시도하다 onError
 * 시 다음 후보, 최종적으로 Utensils 아이콘 fallback으로 이어간다.
 *
 * Next.js의 next/image src는 한글 경로를 자동으로 percent-encode 한다.
 */

const EXTENSIONS = ["jpg", "png", "webp"] as const;

export function getMenuImageCandidates(menuName: string): string[] {
  return EXTENSIONS.map((ext) => `/menu-images/${menuName}.${ext}`);
}
