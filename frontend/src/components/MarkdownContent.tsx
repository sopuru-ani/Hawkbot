import { Check, Copy } from 'lucide-react'
import { isValidElement, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { prepareMarkdownForRender, sanitizeMarkdownForParse } from '../lib/streamingMarkdown'

function StreamingCursor() {
  return <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-muted align-middle" />
}

function getCodeText(children: ReactNode): string {
  if (typeof children === 'string') return children.replace(/\n$/, '')
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return String(children.props.children ?? '').replace(/\n$/, '')
  }
  return ''
}

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable outside secure context.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={!text}
      aria-label={copied ? 'Copied' : 'Copy code'}
      className="code-block-copy"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function CodeBlock({ children, text }: { children?: ReactNode; text?: string }) {
  const codeText = text ?? getCodeText(children)

  if (!codeText.trim()) {
    return null
  }

  return (
    <div className="code-block">
      <CopyCodeButton text={codeText} />
      <pre>
        {children ?? <code>{codeText}</code>}
      </pre>
    </div>
  )
}

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = href?.startsWith('http')
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    )
  },
  pre({ children }) {
    return <CodeBlock>{children}</CodeBlock>
  },
  code({ className, children, ...props }) {
    if (className) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }
    return <code {...props}>{children}</code>
  },
}

type MarkdownContentProps = {
  content: string
  streaming?: boolean
  error?: boolean
}

export function MarkdownContent({ content, streaming, error }: MarkdownContentProps) {
  const isStreaming = Boolean(streaming)
  const { stable, pendingCode, pendingTail } = prepareMarkdownForRender(content, isStreaming)
  const showCursorAfterStable = Boolean(isStreaming && pendingCode === null && !pendingTail && content)

  return (
    <div
      className={`markdown text-sm leading-relaxed ${
        error ? 'text-destructive' : 'text-foreground'
      }`}
    >
      {stable ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {sanitizeMarkdownForParse(stable)}
        </ReactMarkdown>
      ) : null}

      {pendingCode !== null && pendingCode.trim() ? (
        <CodeBlock text={pendingCode}>
          <code>
            {pendingCode}
            {!pendingTail ? <StreamingCursor /> : null}
          </code>
        </CodeBlock>
      ) : null}

      {pendingTail ? (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {sanitizeMarkdownForParse(pendingTail)}
          </ReactMarkdown>
          {isStreaming ? <StreamingCursor /> : null}
        </div>
      ) : null}

      {showCursorAfterStable ? <StreamingCursor /> : null}
    </div>
  )
}
