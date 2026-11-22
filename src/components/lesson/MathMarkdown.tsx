'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Props {
  content: string;
  large?: boolean;
}

export default function MathMarkdown({ content, large = false }: Props) {
  return (
    <div
      className={`space-y-2 text-slate-700 leading-relaxed ${
        large ? 'text-base sm:text-lg lg:text-xl' : 'text-sm sm:text-[15px]'
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h3: ({ children }) => (
            <h3
              className={`font-bold text-slate-900 mt-5 mb-2 flex items-center gap-2 ${
                large ? 'text-lg sm:text-xl lg:text-2xl' : 'text-base sm:text-lg'
              }`}
            >
              <span className="w-1.5 h-5 rounded-full bg-indigo-500 inline-block shrink-0" />
              <span>{children}</span>
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-2">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900">{children}</strong>
          ),
          p: ({ children }) => <p className="my-2">{children}</p>,
        }}
      >
        {content?.trim() ? content : '*Конспект пока не заполнен.*'}
      </ReactMarkdown>
    </div>
  );
}