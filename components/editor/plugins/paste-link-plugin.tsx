import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { PASTE_COMMAND, COMMAND_PRIORITY_LOW, $getRoot, $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createLinkNode, $isLinkNode } from '@lexical/link'
import { mergeRegister } from '@lexical/utils'
import noteCache from '../../../libs/web/cache/note'

function getInternalNoteId(url: string): string | null {
    try {
        const parsed = new URL(url)
        if (parsed.origin !== window.location.origin) return null
        const match = parsed.pathname.match(/^\/([A-Za-z0-9_-]+)$/)
        return match ? match[1] : null
    } catch {
        return null
    }
}

function getMarkdownInternalNoteId(text: string): { noteId: string; fullUrl: string } | null {
    const trimmed = text.trim()
    const origin = window.location.origin
    if (trimmed.startsWith(origin)) {
        const noteId = getInternalNoteId(trimmed)
        if (noteId) return { noteId, fullUrl: trimmed }
    }
    return null
}

export function PasteLinkPlugin(): null {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                PASTE_COMMAND,
                (payload: ClipboardEvent) => {
                    const text = payload.clipboardData?.getData('text/plain')
                    if (!text) return false

                    const result = getMarkdownInternalNoteId(text)
                    if (!result) return false

                    const { noteId, fullUrl } = result

                    noteCache.getItem(noteId).then(note => {
                        const title = note?.title || noteId
                        editor.update(() => {
                            const linkNode = $createLinkNode(fullUrl)
                            const textNode = $createTextNode(title)
                            textNode.setFormat('highlight')
                            linkNode.append(textNode)
                            const selection = $getSelection()
                            if ($isRangeSelection(selection)) {
                                selection.insertNodes([linkNode])
                            }
                        })
                    })

                    return true
                },
                COMMAND_PRIORITY_LOW
            )
        )
    }, [editor])

    return null
}

export function LinkSyncPlugin(): null {
    const [editor] = useLexicalComposerContext()
    const hasSynced = useRef(false)

    useEffect(() => {
        const syncLinks = async () => {
            const origin = window.location.origin

            const nodesToUpdate: { node: any; noteId: string }[] = []

            editor.getEditorState().read(() => {
                const root = $getRoot()
                const traverse = (node: any) => {
                    if ($isLinkNode(node)) {
                        const url = node.getURL()
                        if (url.startsWith(origin)) {
                            try {
                                const parsed = new URL(url)
                                const match = parsed.pathname.match(/^\/([A-Za-z0-9_-]+)$/)
                                if (match) {
                                    nodesToUpdate.push({ node, noteId: match[1] })
                                }
                            } catch {}
                        }
                    }
                    if (typeof node.getChildren === 'function') {
                        for (const child of node.getChildren()) {
                            traverse(child)
                        }
                    }
                }
                traverse(root)
            })

            if (nodesToUpdate.length === 0) return

            const results = await Promise.all(
                nodesToUpdate.map(({ node, noteId }) =>
                    noteCache.getItem(noteId).then(note => ({
                        node,
                        title: note?.title || null,
                    }))
                )
            )

            editor.update(() => {
                for (const { node, title } of results) {
                    const currentText = node.getTextContent()
                    if (title !== null) {
                        if (currentText !== title) {
                            node.clear()
                            const newNode = $createTextNode(title)
                            newNode.setFormat('highlight')
                            node.append(newNode)
                        }
                    } else {
                        if (currentText !== '已删除的笔记') {
                            node.clear()
                            const deletedNode = $createTextNode('已删除的笔记')
                            deletedNode.setFormat(8)
                            node.append(deletedNode)
                        }
                    }
                }
            })
        }

        const unregister = editor.registerUpdateListener(() => {
            if (hasSynced.current) return
            hasSynced.current = true
            syncLinks()
        })

        return unregister
    }, [editor])

    return null
}
