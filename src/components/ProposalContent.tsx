import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

type HeadingItem = { id: string; text: string; level: number };

type ProposalContentProps = {
  content: string;
  className?: string;
  onHeadingsCollected?: (headings: HeadingItem[]) => void;
  headingLevels?: Array<1 | 2 | 3 | 4 | 5 | 6>;
};

// Extend sanitize schema to allow common attributes and safe anchors/images.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["target", "_blank"],
      ["rel", "noopener noreferrer"],
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ["src"],
      ["alt"],
      ["title"],
      ["width"],
      ["height"],
      ["loading"],
    ],
    h1: [...(defaultSchema.attributes?.h1 || []), "id"],
    h2: [...(defaultSchema.attributes?.h2 || []), "id"],
    h3: [...(defaultSchema.attributes?.h3 || []), "id"],
    h4: [...(defaultSchema.attributes?.h4 || []), "id"],
    h5: [...(defaultSchema.attributes?.h5 || []), "id"],
    h6: [...(defaultSchema.attributes?.h6 || []), "id"],
  },
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^\w-]/g, "");
}

function dedupeHeadings(list: HeadingItem[]): HeadingItem[] {
  const seen = new Set<string>();
  return list.filter((h) => {
    const key = `${h.id}-${h.level}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ProposalContent({
  content,
  className,
  onHeadingsCollected,
  headingLevels = [1, 2, 3],
}: ProposalContentProps) {
  const safeContent = content?.trim() ?? "";

  const headingsRef = useRef<HeadingItem[]>([]);
  // Reset collected headings each render to avoid duplicates across renders
  headingsRef.current = [];

  const LinkRenderer = (props: React.ComponentProps<"a">) => {
    const { href, children, ...rest } = props;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  };

  const HeadingRenderer = (level: HeadingItem["level"]) => {
    const Component = ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => {
      const text = React.Children.toArray(children)
        .map((child) => (typeof child === "string" ? child : ""))
        .join(" ")
        .trim();
      const baseId =
        slugify(text) || `heading-${level}-${headingsRef.current.length}`;
      const exists = headingsRef.current.find(
        (h) => h.id === baseId && h.level === level
      );
      const id = exists ? baseId : baseId;
      if (headingLevels.includes(level as typeof headingLevels[number])) {
        if (!exists) {
          headingsRef.current.push({ id, text, level });
        }
      }
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag id={id}>{children}</Tag>;
    };
    Component.displayName = `HeadingLevel${level}`;
    return Component;
  };

  useEffect(() => {
    if (!onHeadingsCollected) return;
    const unique = dedupeHeadings(headingsRef.current);
    onHeadingsCollected(unique);
  }, [onHeadingsCollected, safeContent]);

  if (!safeContent) return null;

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-foreground/90 sm:text-base",
        "[&>*]:break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-sm [&_img]:h-auto",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_li]:leading-relaxed",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:text-foreground",
        "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5",
        "[&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
        "[&_hr]:my-4 [&_hr]:border-border/60",
        "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-3 sm:[&_h1]:text-3xl",
        "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 sm:[&_h2]:text-2xl",
        "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 sm:[&_h3]:text-xl",
        "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2",
        "[&_p]:leading-relaxed [&_p:not(:last-child)]:mb-3",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full sm:[&_table]:table",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:whitespace-nowrap sm:[&_th]:px-3 sm:[&_th]:py-2 sm:[&_th]:text-sm",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-xs sm:[&_td]:px-3 sm:[&_td]:py-2 sm:[&_td]:text-sm",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={{
          a: LinkRenderer,
          h1: HeadingRenderer(1),
          h2: HeadingRenderer(2),
          h3: HeadingRenderer(3),
          h4: HeadingRenderer(4),
          h5: HeadingRenderer(5),
          h6: HeadingRenderer(6),
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}

