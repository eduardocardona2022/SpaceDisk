import { useEffect, useMemo, useRef, useState } from "react";
import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode
} from "d3-hierarchy";
import type { DirListing } from "../../../shared/types";
import { useI18n } from "../i18n";
import { treemapColor } from "../lib/categoryColors";
import { formatBytes, formatPercent } from "../lib/format";

interface TreemapLeaf {
  id: string;
  name: string;
  value: number;
  kind: "dir" | "loose" | "other";
  path?: string;
  color: string;
}

interface TreemapRoot {
  id: string;
  name: string;
  children: TreemapLeaf[];
  value?: number;
}

type TreemapDatum = TreemapLeaf | TreemapRoot;

const TREEMAP_HEIGHT = 390;

function truncateLabel(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value;
  return `${value.slice(0, Math.max(1, maxCharacters - 1))}…`;
}

export function Treemap({
  listing,
  onNavigate
}: {
  listing: DirListing;
  onNavigate: (path: string) => void;
}) {
  const { t, lang } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(820);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setWidth(Math.max(300, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const data = useMemo<TreemapRoot | null>(() => {
    const children: TreemapLeaf[] = listing.children.map((child, index) => ({
      id: child.path,
      name: child.name,
      value: child.bytes,
      kind: "dir",
      path: child.path,
      color: treemapColor(index)
    }));

    const listedBytes = children.reduce((sum, child) => sum + child.value, 0);
    const otherBytes = Math.max(0, listing.bytes - listing.ownBytes - listedBytes);

    if (otherBytes > 0) {
      children.push({
        id: `${listing.path}::other`,
        name: t("folders.otherFolders"),
        value: otherBytes,
        kind: "other",
        color: "#475569"
      });
    }

    if (listing.ownBytes > 0) {
      children.push({
        id: `${listing.path}::loose`,
        name: t("folders.looseFiles"),
        value: listing.ownBytes,
        kind: "loose",
        color: "#64748b"
      });
    }

    if (children.length === 0) return null;
    return { id: listing.path, name: listing.name, children };
  }, [listing, t]);

  const leaves = useMemo(() => {
    if (!data) return [];
    const root = hierarchy<TreemapDatum>(data)
      .sum((datum) => (datum.value ?? 0) as number)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<TreemapDatum>()
      .tile(treemapSquarify)
      .size([width, TREEMAP_HEIGHT])
      .paddingInner(3)
      .paddingOuter(0)
      .round(true)(root);

    return root.leaves() as unknown as HierarchyRectangularNode<TreemapLeaf>[];
  }, [data, width]);

  return (
    <section className="panel treemap-panel">
      <div className="panel-heading compact treemap-heading">
        <div>
          <h2>{t("folders.treemapTitle")}</h2>
          <p>{t("folders.treemapHint")}</p>
        </div>
        <span className="treemap-total">{formatBytes(listing.bytes, lang)}</span>
      </div>

      <div ref={containerRef} className="treemap-container">
        {!data ? (
          <div className="empty-inline">{t("folders.treemapEmpty")}</div>
        ) : (
          <svg
            className="treemap-svg"
            viewBox={`0 0 ${width} ${TREEMAP_HEIGHT}`}
            role="img"
            aria-label={t("folders.treemapTitle")}
          >
            {leaves.map((node) => {
              const datum = node.data;
              const tileWidth = node.x1 - node.x0;
              const tileHeight = node.y1 - node.y0;
              const percent = listing.bytes > 0 ? (datum.value / listing.bytes) * 100 : 0;
              const clickable = datum.kind === "dir" && datum.path;
              const showName = tileWidth > 74 && tileHeight > 30;
              const showSize = tileWidth > 96 && tileHeight > 49;
              const nameCharacters = Math.max(6, Math.floor(tileWidth / 7.2));

              return (
                <g
                  key={datum.id}
                  className={clickable ? "treemap-tile treemap-tile-clickable" : "treemap-tile"}
                  onClick={() => {
                    if (clickable && datum.path) onNavigate(datum.path);
                  }}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (clickable && datum.path && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onNavigate(datum.path);
                    }
                  }}
                >
                  <rect
                    x={node.x0}
                    y={node.y0}
                    width={Math.max(0, tileWidth)}
                    height={Math.max(0, tileHeight)}
                    rx={7}
                    fill={datum.color}
                  />
                  <title>
                    {`${datum.name} · ${formatBytes(datum.value, lang)} (${formatPercent(percent, lang)})`}
                  </title>
                  {showName ? (
                    <text x={node.x0 + 9} y={node.y0 + 20} className="treemap-label">
                      {truncateLabel(datum.name, nameCharacters)}
                    </text>
                  ) : null}
                  {showSize ? (
                    <text x={node.x0 + 9} y={node.y0 + 37} className="treemap-size">
                      {formatBytes(datum.value, lang)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}
