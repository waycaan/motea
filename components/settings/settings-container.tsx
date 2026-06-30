import { TextFieldProps } from '@material-ui/core';
import { FC } from 'react';
import { DailyNotes } from './daily-notes';
import { Language } from './language';
import { Theme } from './theme';
import { EditorWidth } from './editor-width';
import { ImportOrExport } from './import-or-export';
import { Advanced } from './advanced';
import useI18n from 'libs/web/hooks/use-i18n';
import { SettingsHeader } from './settings-header';

export const defaultFieldConfig: TextFieldProps = {
    fullWidth: true,
    margin: 'normal',
    size: 'small',
    variant: 'outlined',
    InputLabelProps: {
        shrink: true,
    },
    classes: {
        root: 'text-lg',
    },
};

const HR = () => {
    return <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '2px solid #c4c4c4' }} />;
};

export const SettingsContainer: FC = () => {
    const { t } = useI18n();

    return (
        <section>
            <SettingsHeader id="basic" title={t('Basic')}></SettingsHeader>
            <DailyNotes></DailyNotes>
            <Language></Language>
            <Theme></Theme>
            <EditorWidth></EditorWidth>

            <HR />
            <SettingsHeader
                id="import-and-export"
                title={t('Import & Export')}
            ></SettingsHeader>
            <ImportOrExport></ImportOrExport>

            <HR />
            <SettingsHeader
                id="advanced"
                title={t('Advanced')}
                description={t('Configure backend behavior parameters')}
            ></SettingsHeader>
            <Advanced></Advanced>
        </section>
    );
};
