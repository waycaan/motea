import { FC, useCallback, useState } from 'react';
import { TextField, Button } from '@material-ui/core';
import UIState from 'libs/web/state/ui';
import useI18n from 'libs/web/hooks/use-i18n';

export const Advanced: FC = () => {
    const { t } = useI18n();
    const {
        settings: { settings, updateSettings },
    } = UIState.useContainer();

    const [trashExpiryDays, setTrashExpiryDays] = useState(settings.trash_expiry_days ?? 1);
    const [preloadNotesCount, setPreloadNotesCount] = useState(settings.preload_notes_count ?? 10);
    const [autoArchiveDays, setAutoArchiveDays] = useState(settings.auto_archive_days ?? 0);
    const [saving, setSaving] = useState(false);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await updateSettings({
                trash_expiry_days: trashExpiryDays,
                preload_notes_count: preloadNotesCount,
                auto_archive_days: autoArchiveDays,
            });
        } catch (e) {
            console.error('Error whilst updating advanced settings: %O', e);
        } finally {
            setSaving(false);
        }
    }, [trashExpiryDays, preloadNotesCount, autoArchiveDays, updateSettings]);

    return (
        <section>
            <TextField
                fullWidth
                margin="normal"
                size="small"
                variant="outlined"
                type="number"
                label={t('Trash auto-delete (days)')}
                helperText={t('Auto-delete trashed notes after specified days')}
                value={trashExpiryDays}
                onChange={(e) => setTrashExpiryDays(Number(e.target.value))}
                inputProps={{ min: 0, max: 365 }}
            />
            <TextField
                fullWidth
                margin="normal"
                size="small"
                variant="outlined"
                type="number"
                label={t('Preload notes count')}
                helperText={t('Number of top-level notes to preload on page load')}
                value={preloadNotesCount}
                onChange={(e) => setPreloadNotesCount(Number(e.target.value))}
                inputProps={{ min: 0, max: 100 }}
            />
            <TextField
                fullWidth
                margin="normal"
                size="small"
                variant="outlined"
                type="number"
                label={t('Auto-archive (days)')}
                helperText={t('Auto-archive main notes after specified days (0=disabled)')}
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(Number(e.target.value))}
                inputProps={{ min: 0, max: 365 }}
            />
            <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: '16px' }}
            >
                {saving ? t('Saving...') : t('Save')}
            </Button>
        </section>
    );
};
