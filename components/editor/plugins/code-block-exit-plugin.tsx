import { $createParagraphNode, $isLineBreakNode } from 'lexical';
import { CodeNode } from '@lexical/code';

let patched = false;

export function patchCodeNodeInsertNewAfter(): void {
    if (patched) return;
    patched = true;

    const originalInsertNewAfter = CodeNode.prototype.insertNewAfter;

    CodeNode.prototype.insertNewAfter = function (selection: any, restoreSelection = true) {
        const children = this.getChildren();
        const len = children.length;

        if (len >= 3 && selection.isCollapsed()) {
            const anchorNode = selection.anchor.getNode();
            const last = children[len - 1];
            const secondLast = children[len - 2];
            const thirdLast = children[len - 3];

            if (
                $isLineBreakNode(secondLast) &&
                $isLineBreakNode(thirdLast) &&
                anchorNode === last &&
                selection.anchor.offset === 0
            ) {
                secondLast.remove();
                thirdLast.remove();
                const paragraph = $createParagraphNode();
                this.insertAfter(paragraph, restoreSelection);
                return paragraph;
            }
        }

        return originalInsertNewAfter.call(this, selection, restoreSelection);
    };
}
