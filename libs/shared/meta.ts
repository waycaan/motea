export enum NOTE_DELETED {
    NORMAL,
    DELETED,
}

export enum NOTE_SHARED {
    PRIVATE,
    PUBLIC,
}

export enum NOTE_ARCHIVED {
    UNARCHIVED,
    ARCHIVED,
}

export enum NOTE_STARRED {
    UNSTARRED,
    STARRED,
}

export enum NOTE_STATUS {
    NORMAL = 0,
    ARCHIVED = 1,
    STARRED = 2,
}

export enum EDITOR_SIZE {
    SMALL,
    LARGE,
    FULL = 2
}

export const PAGE_META_KEY = <const>[
    'title',
    'pid',
    'id',
    'shared',
    'pic',
    'date',
    'deleted',
    'archived',
    'starred',
    'editorsize',
    'hasVersions',
];

export type metaKey = typeof PAGE_META_KEY[number];

export const NUMBER_KEYS: metaKey[] = [
    'deleted',
    'shared',
    'archived',
    'starred',
    'editorsize',
];
