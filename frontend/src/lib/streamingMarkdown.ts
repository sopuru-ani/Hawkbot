const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(\s.*)?$/
const COMMAND_LINE =
  /^(npm |npx |yarn |pnpm |bun |cd |node |python |pip |cargo |go run |docker )/

export type StreamingMarkdownParts = {
  stable: string
  pendingCode: string | null
  pendingTail: string | null
}

function findFenceLineIndices(content: string): number[] {
  const lines = content.split('\n')
  const fenceLineIndices: number[] = []

  for (let index = 0; index < lines.length; index += 1) {
    if (FENCE_LINE.test(lines[index])) {
      fenceLineIndices.push(index)
    }
  }

  return fenceLineIndices
}

function hasBalancedFences(content: string): boolean {
  return findFenceLineIndices(content).length % 2 === 0
}

function isClosingFence(line: string): boolean {
  return /^ {0,3}```\s*$/.test(line)
}

export function isDividerLine(line: string): boolean {
  return /^(or|and)$/i.test(line.trim())
}

export function isProseBleedingIntoCode(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (isDividerLine(trimmed)) return true
  if (FENCE_LINE.test(trimmed)) return true
  if (/^\d+\.\s/.test(trimmed)) return true
  if (/^#{1,6}\s/.test(trimmed)) return true
  if (
    /^(here'?s|you can|this |your |the |start |note:|important:|now,|after )/i.test(
      trimmed,
    )
  ) {
    return true
  }
  if (
    /\*\*[^*]+\*\*/.test(trimmed) &&
    !COMMAND_LINE.test(trimmed) &&
    !/^`/.test(trimmed)
  ) {
    return true
  }
  if (
    /^[A-Za-z][^`\n]{8,}[.:!?…]$/.test(trimmed) &&
    !COMMAND_LINE.test(trimmed)
  ) {
    return true
  }
  return false
}

/** Remove fenced blocks that contain no code. */
export function removeEmptyFencedBlocks(content: string): string {
  return content.replace(/(^|\n)```[^\n`]*\n\s*```(?=\n|$)/g, '$1')
}

/**
 * Walk line-by-line and close fences before prose/dividers, or when the model
 * opens a second fence without closing the first.
 */
export function repairFenceBleeding(content: string): string {
  const lines = content.split('\n')
  const output: string[] = []
  let inFence = false
  let fenceOpener = ''
  let codeLines: string[] = []

  const flushCodeBlock = (close: boolean) => {
    if (!inFence) return

    if (codeLines.some((line) => line.trim())) {
      output.push(fenceOpener)
      output.push(...codeLines)
      if (close) output.push('```')
    }

    inFence = false
    fenceOpener = ''
    codeLines = []
  }

  for (const line of lines) {
    if (FENCE_LINE.test(line)) {
      if (inFence) {
        if (isClosingFence(line)) {
          flushCodeBlock(true)
        } else {
          flushCodeBlock(true)
          inFence = true
          fenceOpener = line
        }
      } else {
        inFence = true
        fenceOpener = line
      }
      continue
    }

    if (inFence && isProseBleedingIntoCode(line)) {
      flushCodeBlock(true)
      output.push(line)
      continue
    }

    if (inFence) {
      codeLines.push(line)
      continue
    }

    output.push(line)
  }

  if (inFence && codeLines.some((line) => line.trim())) {
    output.push(fenceOpener)
    output.push(...codeLines)
  }

  return output.join('\n')
}

/**
 * The model often opens a fence, gives one command, then writes "or" and a second
 * fenced command without closing the first. Insert the missing close fence.
 */
export function repairSplitAlternatives(content: string): string {
  let result = content
  let previous = ''

  while (previous !== result) {
    previous = result
    result = result.replace(
      /(```[^\n`]*\n)([\s\S]*?)\n\s*(or|and)\s*\n\s*(```[^\n`]*\n)/gi,
      (match, open: string, body: string, conj: string, nextOpen: string) => {
        if (body.includes('\n```')) return match
        if (!body.trim()) return match
        return `${open}${body}\n\`\`\`\n\n${conj}\n\n${nextOpen}`
      },
    )
  }

  return result
}

/** Move introductory prose the model placed inside a JSX fence to before it. */
export function extractLeadingProseFromCodeFences(content: string): string {
  return content.replace(
    /(```(?:jsx|tsx|javascript|js|typescript|ts)\n)([A-Za-z][^\n`]*[.:])\n\n((?:import |export |\/\/|function |const |let |class |\/\*|@))/gm,
    '$2\n\n$1$3',
  )
}

/** Wrap standalone shell one-liners that the model left outside fences. */
export function wrapOrphanCommandLines(content: string): string {
  const lines = content.split('\n')
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (FENCE_LINE.test(line)) {
      if (inFence && isClosingFence(line)) {
        inFence = false
        output.push(line)
      } else if (!inFence) {
        inFence = true
        output.push(line)
      } else {
        output.push('```')
        output.push(line)
      }
      continue
    }

    const trimmed = line.trim()
    if (!inFence && trimmed && COMMAND_LINE.test(trimmed) && !trimmed.includes('`')) {
      output.push('```bash')
      output.push(trimmed)
      output.push('```')
      continue
    }

    output.push(line)
  }

  return output.join('\n')
}

/** Remove a duplicated opening fence line the model sometimes emits back-to-back. */
export function removeDuplicateOpeningFences(content: string): string {
  return content.replace(
    /(```(?:bash|sh|shell|jsx|tsx|javascript|js|typescript|ts)\n)```(?:bash|sh|shell|jsx|tsx|javascript|js|typescript|ts)\n/gi,
    '$1',
  )
}

export function normalizeAiMarkdown(content: string): string {
  let normalized = removeEmptyFencedBlocks(content)
  normalized = repairFenceBleeding(normalized)
  normalized = repairSplitAlternatives(normalized)
  normalized = repairFenceBleeding(normalized)
  normalized = extractLeadingProseFromCodeFences(normalized)
  normalized = removeDuplicateOpeningFences(normalized)
  normalized = wrapOrphanCommandLines(normalized)
  return normalized
}

/** Close a single dangling fence so completed messages still parse. */
export function closeDanglingFence(content: string): string {
  if (!content) return content

  if (hasBalancedFences(content)) {
    return content
  }

  return `${content}\n\`\`\``
}

/**
 * ReactMarkdown must never receive a prefix with an unclosed fence — it will
 * swallow the rest of the document into one code block.
 */
export function peelUnclosedFenceFromStable(
  stable: string,
  pendingCode: string | null,
  pendingTail: string | null,
): StreamingMarkdownParts {
  if (!stable || hasBalancedFences(stable)) {
    return { stable, pendingCode, pendingTail }
  }

  const lines = stable.split('\n')
  const openIndex = findFenceLineIndices(stable).at(-1)!
  const safeStable = lines.slice(0, openIndex).join('\n')
  const overflow = lines.slice(openIndex + 1).join('\n')

  const mergedPending = [overflow, pendingCode].filter((part) => part?.trim()).join('\n')
  const { code, tail } = splitPendingCodeTail(mergedPending)
  const mergedTail = [tail, pendingTail].filter((part) => part?.trim()).join('\n\n') || null

  return {
    stable: safeStable,
    pendingCode: code || null,
    pendingTail: mergedTail,
  }
}

function splitAtLastOpenFence(content: string): StreamingMarkdownParts {
  if (hasBalancedFences(content)) {
    return { stable: content, pendingCode: null, pendingTail: null }
  }

  const lines = content.split('\n')
  const openLineIndex = findFenceLineIndices(content).at(-1)!
  const stable = lines.slice(0, openLineIndex).join('\n')
  const pendingCode = lines.slice(openLineIndex + 1).join('\n')
  const { code, tail } = splitPendingCodeTail(pendingCode)

  return peelUnclosedFenceFromStable(stable, code || null, tail)
}

/** Keep prose/dividers out of the live streaming code block UI. */
export function splitPendingCodeTail(pending: string): { code: string; tail: string | null } {
  if (!pending) return { code: '', tail: null }

  const lines = pending.split('\n')
  const codeLines: string[] = []
  let index = 0

  for (; index < lines.length; index += 1) {
    if (isProseBleedingIntoCode(lines[index])) break
    codeLines.push(lines[index])
  }

  if (index >= lines.length) {
    return { code: pending.replace(/\s+$/, ''), tail: null }
  }

  const tail = lines.slice(index).join('\n').trim()
  if (!tail) {
    return { code: codeLines.join('\n').replace(/\s+$/, ''), tail: null }
  }

  const firstLine = tail.split('\n')[0] ?? ''
  if (FENCE_LINE.test(firstLine)) {
    return { code: codeLines.join('\n').replace(/\s+$/, ''), tail: null }
  }

  return { code: codeLines.join('\n').replace(/\s+$/, ''), tail }
}

/** Only pass balanced, repaired markdown into ReactMarkdown. */
export function sanitizeMarkdownForParse(text: string): string {
  if (!text.trim()) return ''

  let normalized = normalizeAiMarkdown(text)
  let parts = peelUnclosedFenceFromStable(normalized, null, null)

  while (parts.pendingCode || parts.pendingTail) {
    const overflow = [parts.pendingCode, parts.pendingTail].filter(Boolean).join('\n\n')
    normalized = normalizeAiMarkdown(overflow)
    parts = peelUnclosedFenceFromStable(
      [parts.stable, normalized].filter(Boolean).join('\n\n'),
      null,
      null,
    )
  }

  return closeDanglingFence(parts.stable)
}

/**
 * While streaming, an unclosed fenced code block would make the markdown parser
 * treat the rest of the message as code. Split at the last open fence so the
 * stable prefix can be rendered as markdown and the tail as plain code text.
 */
export function splitStreamingMarkdown(
  content: string,
  streaming: boolean,
): StreamingMarkdownParts {
  if (!streaming || !content) {
    return { stable: content, pendingCode: null, pendingTail: null }
  }

  return splitAtLastOpenFence(content)
}

export function prepareMarkdownForRender(
  content: string,
  streaming: boolean,
): StreamingMarkdownParts {
  const normalized = normalizeAiMarkdown(content)

  if (streaming) {
    return splitStreamingMarkdown(normalized, true)
  }

  return {
    stable: sanitizeMarkdownForParse(normalized),
    pendingCode: null,
    pendingTail: null,
  }
}
