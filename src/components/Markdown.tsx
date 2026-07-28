import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** 深色主题 Markdown 渲染器 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-2 text-2xl font-bold text-zinc-100">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-8 border-l-4 border-emerald-500 pl-3 text-lg font-semibold text-emerald-300">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-5 text-base font-semibold text-zinc-200">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-7 text-zinc-300">{children}</p>
        ),
        ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-1">{children}</ul>,
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1.5 pl-5 marker:text-emerald-500">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-6 text-zinc-300 before:mr-2 before:text-emerald-500 before:content-['▸'] [&>p]:inline">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-100">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-zinc-600 pl-4 text-zinc-500 italic">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = /language-/.test(className ?? "");
          if (isBlock)
            return (
              <code className="block overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-emerald-300">
                {children}
              </code>
            );
          return (
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-300">
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-left font-medium text-zinc-200">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-zinc-800 px-3 py-2 text-zinc-300">{children}</td>
        ),
        hr: () => <hr className="my-6 border-zinc-800" />,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 underline decoration-emerald-700 underline-offset-2 hover:text-emerald-300"
          >
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
