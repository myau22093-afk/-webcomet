"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SyntaxHighlighter = dynamic(
  () => import("react-syntax-highlighter").then((m) => m.Prism),
  { ssr: false }
);

type Props = {
  language: string;
  code: string;
};

export function CodeBlock({ language, code }: Props) {
  const [style, setStyle] = useState<Record<string, React.CSSProperties> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    import("react-syntax-highlighter/dist/esm/styles/prism").then((mod) => {
      if (!cancelled) {
        setStyle(mod.oneDark as Record<string, React.CSSProperties>);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!style) {
    return (
      <pre className="m-0 min-h-full whitespace-pre-wrap bg-[#0b0f19] p-4 text-[13px] text-zinc-300">
        {code || " "}
      </pre>
    );
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      customStyle={{
        margin: 0,
        minHeight: "100%",
        background: "#0b0f19",
        fontSize: "13px",
      }}
      showLineNumbers
    >
      {code || " "}
    </SyntaxHighlighter>
  );
}
