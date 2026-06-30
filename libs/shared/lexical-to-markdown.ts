/**
 * Lexical JSON to Markdown Converter
 * Shared between client and server
 */

function convertNodesToMarkdown(nodes: any[]): string {
    let markdown = '';

    for (const node of nodes) {
        if (node.type === 'paragraph') {
            markdown += convertNodesToMarkdown(node.children || []) + '\n\n';
        } else if (node.type === 'heading') {
            const level = node.tag ? parseInt(node.tag.replace('h', '')) : 1;
            const prefix = '#'.repeat(level);
            markdown += prefix + ' ' + convertNodesToMarkdown(node.children || []) + '\n\n';
        } else if (node.type === 'list') {
            markdown += convertListToMarkdown(node) + '\n';
        } else if (node.type === 'quote') {
            const quoteText = convertNodesToMarkdown(node.children || []);
            markdown += '> ' + quoteText.replace(/\n/g, '\n> ') + '\n\n';
        } else if (node.type === 'code') {
            const language = node.language || '';
            const codeText = convertNodesToMarkdown(node.children || []);
            markdown += '```' + language + '\n' + codeText + '\n```\n\n';
        } else if (node.type === 'horizontalrule') {
            markdown += '---\n\n';
        } else if (node.type === 'table') {
            markdown += convertTableToMarkdown(node) + '\n';
        } else if (node.type === 'image') {
            const alt = node.altText || '';
            const src = node.src || '';
            markdown += `![${alt}](${src})\n\n`;
        } else if (node.type === 'linebreak') {
            markdown += '\n';
        } else if (node.type === 'text') {
            let nodeText = node.text || '';
            if (node.format) {
                if (node.format & 1) nodeText = '**' + nodeText + '**';
                if (node.format & 2) nodeText = '*' + nodeText + '*';
                if (node.format & 4) nodeText = '~~' + nodeText + '~~';
                if (node.format & 8) nodeText = '`' + nodeText + '`';
                if (node.format & 16) nodeText = '<u>' + nodeText + '</u>';
                if (node.format & 32) nodeText = '==' + nodeText + '==';
            }
            markdown += nodeText;
        } else if (node.type === 'link') {
            const url = node.url || '';
            const children = convertNodesToMarkdown(node.children || []);
            markdown += `[${children}](${url})`;
        } else if (node.children) {
            markdown += convertNodesToMarkdown(node.children);
        }
    }

    return markdown;
}

function convertListToMarkdown(listNode: any): string {
    let markdown = '';
    const items = listNode.children || [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === 'listitem') {
            const itemText = convertNodesToMarkdown(item.children || []);
            if (listNode.listType === 'number') {
                markdown += `${i + 1}. ${itemText}\n`;
            } else if (listNode.listType === 'check') {
                const checked = item.checked ? '[x]' : '[ ]';
                markdown += `- ${checked} ${itemText}\n`;
            } else {
                markdown += `- ${itemText}\n`;
            }
        }
    }

    return markdown;
}

function convertTableToMarkdown(tableNode: any): string {
    let markdown = '\n';
    const rows = tableNode.children || [];

    rows.forEach((row: any, rowIndex: number) => {
        if (row.type === 'tablerow') {
            const cells = row.children || [];
            const cellTexts = cells.map((cell: any) => {
                if (cell.type === 'tablecell') {
                    return convertNodesToMarkdown(cell.children || []).trim() || ' ';
                }
                return ' ';
            });

            markdown += '| ' + cellTexts.join(' | ') + ' |\n';

            if (rowIndex === 0) {
                markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
            }
        }
    });

    return markdown + '\n';
}

export function convertLexicalToMarkdown(jsonContent: string): string {
    try {
        const data = JSON.parse(jsonContent);
        const root = data.root;
        if (!root || !root.children) {
            return '';
        }
        return convertNodesToMarkdown(root.children);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return jsonContent;
    }
}
