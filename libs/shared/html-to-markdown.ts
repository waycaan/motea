/**
 * HTML to Markdown Converter
 *
 * This utility provides a function to convert HTML content to Markdown format.
 * It uses a basic set of regular expressions for common HTML tags.
 * For more complex scenarios, consider using a dedicated library like Turndown.
 */

export function convertHtmlToMarkdown(html: string): string {
    if (!html) {
        return '';
    }

    let markdown = html;

    // Block elements
    markdown = markdown.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6>(.*?)<\/h6>/gi, '###### $1\n\n');
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Inline elements
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
    markdown = markdown.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
    markdown = markdown.replace(/<code>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>');
    markdown = markdown.replace(/<mark>(.*?)<\/mark>/gi, '==$1==');

    // Links
    markdown = markdown.replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)');

    // Images
    markdown = markdown.replace(/<img src="(.*?)" alt="(.*?)"\s*\/?>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img src="(.*?)"\s*\/?>/gi, '![]($1)'); // Image without alt

    // Lists (simplified - does not handle nested lists well)
    markdown = markdown.replace(/<ul>(.*?)<\/ul>/gis, (_match, p1) => {
        return p1.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
    });
    markdown = markdown.replace(/<ol>(.*?)<\/ol>/gis, (_match, p1) => {
        let i = 1;
        return p1.replace(/<li>(.*?)<\/li>/gi, () => `${i++}. $1\n`);
    });

    // Blockquotes (simplified)
    markdown = markdown.replace(/<blockquote>(.*?)<\/blockquote>/gis, (_match, p1) => {
        return p1.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
    });

    // Tables
    markdown = markdown.replace(/<table>(.*?)<\/table>/gis, (_match, p1) => {
        const rows: string[] = [];
        const rowMatches = p1.match(/<tr>(.*?)<\/tr>/gis) || [];
        rowMatches.forEach((rowMatch: string) => {
            const cells: string[] = [];
            const cellMatches = rowMatch.match(/<t[hd]>(.*?)<\/t[hd]>/gis) || [];
            cellMatches.forEach((cellMatch: string) => {
                const text = cellMatch.replace(/<[^>]+>/g, '').trim() || ' ';
                cells.push(text);
            });
            if (cells.length > 0) {
                rows.push('| ' + cells.join(' | ') + ' |');
            }
        });
        if (rows.length > 0) {
            const separator = '| ' + rows[0].split('|').slice(1, -1).map(() => '---').join(' | ') + ' |';
            rows.splice(1, 0, separator);
            return '\n' + rows.join('\n') + '\n\n';
        }
        return '';
    });

    // Code blocks (simplified, assumes pre > code structure)
    markdown = markdown.replace(/<pre><code(?: class="language-(.*?)")?>(.*?)<\/code><\/pre>/gis, (_match, lang, code) => {
        const language = lang || '';
        return '```' + language + '\n' + code.trim() + '\n```\n\n';
    });

    // Remove any remaining HTML tags (basic cleanup)
    markdown = markdown.replace(/<[^>]+>/g, '');

    // Normalize multiple newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
}